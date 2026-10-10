"""
Complaints API router — FR-01 through FR-06.
"""

from __future__ import annotations
import csv
import io
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, status as http_status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import (
    Complaint, DepartmentEnum, UrgencyEnum, StatusEnum,
    SyncStateEnum, ClassificationModeEnum
)
from app.schemas import (
    ComplaintCreate, ComplaintUpdate, ComplaintOut, ComplaintListItem,
    ImportedComplaint, ImportResult, PaginatedComplaints,
)
from app.core.ai_engine import classify_with_ai
from app.core.classifier import compute_urgency_level, classify_fallback
from app.core.sync_service import enqueue_for_sync

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/complaints", tags=["complaints"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _apply_classification(complaint: Complaint, use_ai: bool = True) -> Complaint:
    """Run AI or fallback classification and update complaint fields in-place."""
    if use_ai:
        result = await classify_with_ai(complaint.text, complaint.language)
    else:
        result = classify_fallback(complaint.text, complaint.language)

    complaint.department = result.department.value
    complaint.classification_mode = result.mode.value
    complaint.classification_confidence = result.confidence
    complaint.urgency_score = result.urgency_score
    complaint.urgency_level = compute_urgency_level(result.urgency_score)
    complaint.safety_flag = result.safety_flag
    complaint.draft_reply = result.draft_reply
    complaint.reply_language = result.reply_language
    return complaint


@router.post("/", response_model=ComplaintOut, status_code=http_status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
) -> ComplaintOut:
    """Create a single new complaint and run triage (FR-01, FR-02, FR-03, FR-04)."""
    complaint = Complaint(
        id=str(uuid.uuid4()),
        text=payload.text,
        language=payload.language,
        station=payload.station,
        source_channel=payload.source_channel.value,
    )
    complaint = await _apply_classification(complaint, use_ai=True)
    db.add(complaint)
    await db.flush()  # get the id assigned
    await enqueue_for_sync(db, complaint, "create")
    await db.commit()
    await db.refresh(complaint)
    logger.info(
        "Created complaint %s | dept=%s | urgency=%s | mode=%s",
        complaint.id, complaint.department, complaint.urgency_level, complaint.classification_mode,
    )
    return ComplaintOut.model_validate(complaint)


@router.get("/", response_model=PaginatedComplaints)
async def list_complaints(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: Optional[str] = Query(default=None),
    urgency_level: Optional[str] = Query(default=None),
    department: Optional[str] = Query(default=None),
    safety_flag: Optional[bool] = Query(default=None),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc"),
    db: AsyncSession = Depends(get_db),
) -> PaginatedComplaints:
    """List complaints with filtering, searching, sorting and pagination (FR-05)."""
    conditions = []
    if status:
        conditions.append(Complaint.status == status)
    if urgency_level:
        conditions.append(Complaint.urgency_level == urgency_level)
    if department:
        conditions.append(Complaint.department == department)
    if safety_flag is not None:
        conditions.append(Complaint.safety_flag == safety_flag)
    if search:
        like_expr = f"%{search}%"
        conditions.append(
            or_(
                Complaint.text.ilike(like_expr),
                Complaint.station.ilike(like_expr),
            )
        )

    base_q = select(Complaint)
    if conditions:
        base_q = base_q.where(and_(*conditions))

    # Count total
    count_q = select(func.count()).select_from(base_q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar_one()

    # Sorting
    sort_col = getattr(Complaint, sort_by, Complaint.created_at)
    if sort_order.lower() == "asc":
        base_q = base_q.order_by(sort_col.asc())
    else:
        base_q = base_q.order_by(sort_col.desc())

    # Pagination
    offset = (page - 1) * page_size
    base_q = base_q.offset(offset).limit(page_size)

    result = await db.execute(base_q)
    items = result.scalars().all()

    total_pages = max(1, (total + page_size - 1) // page_size)
    return PaginatedComplaints(
        items=[ComplaintListItem.model_validate(c) for c in items],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{complaint_id}", response_model=ComplaintOut)
async def get_complaint(
    complaint_id: str,
    db: AsyncSession = Depends(get_db),
) -> ComplaintOut:
    """Get a single complaint by ID."""
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id!r} not found.")
    return ComplaintOut.model_validate(complaint)


@router.patch("/{complaint_id}", response_model=ComplaintOut)
async def update_complaint(
    complaint_id: str,
    payload: ComplaintUpdate,
    db: AsyncSession = Depends(get_db),
) -> ComplaintOut:
    """Update status, review state, reply, etc. (FR-04, FR-05)."""
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id!r} not found.")

    update_data = payload.model_dump(exclude_none=True)
    for key, val in update_data.items():
        # Handle enum values
        if hasattr(val, "value"):
            setattr(complaint, key, val.value)
        else:
            setattr(complaint, key, val)

    complaint.updated_at = _utcnow()

    # If approved_reply is set, update sync outbox
    if payload.approved_reply is not None:
        await enqueue_for_sync(db, complaint, "update")

    await db.commit()
    await db.refresh(complaint)
    return ComplaintOut.model_validate(complaint)


@router.delete("/{complaint_id}", status_code=204)
async def delete_complaint(
    complaint_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a complaint record."""
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id!r} not found.")
    await db.delete(complaint)
    await db.commit()


@router.post("/{complaint_id}/reclassify", response_model=ComplaintOut)
async def reclassify_complaint(
    complaint_id: str,
    db: AsyncSession = Depends(get_db),
) -> ComplaintOut:
    """Re-run AI/fallback classification on an existing complaint."""
    result = await db.execute(select(Complaint).where(Complaint.id == complaint_id))
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail=f"Complaint {complaint_id!r} not found.")

    complaint = await _apply_classification(complaint, use_ai=True)
    complaint.updated_at = _utcnow()
    await db.commit()
    await db.refresh(complaint)
    return ComplaintOut.model_validate(complaint)


# ─── Batch Import ─────────────────────────────────────────────────────────────

@router.post("/import/json", response_model=ImportResult, status_code=201)
async def import_json(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ImportResult:
    """
    Batch-import complaints from a JSON file (array of objects) — FR-01.
    Idempotent: records with duplicate IDs are skipped, not duplicated.
    """
    raw = await file.read()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="JSON must be an array of complaint objects.")

    return await _process_import_batch(data, db)


@router.post("/import/csv", response_model=ImportResult, status_code=201)
async def import_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> ImportResult:
    """
    Batch-import complaints from a CSV file — FR-01.
    Expected columns: id (optional), text, language, station, source_channel, timestamp.
    """
    raw = await file.read()
    try:
        text_content = raw.decode("utf-8-sig")  # handle BOM
        reader = csv.DictReader(io.StringIO(text_content))
        data = list(reader)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid CSV: {exc}")

    return await _process_import_batch(data, db)


async def _process_import_batch(records: list, db: AsyncSession) -> ImportResult:
    imported = 0
    skipped = 0
    errors: List[str] = []
    complaint_ids: List[str] = []

    for i, record in enumerate(records):
        if isinstance(record, dict) and not record:
            continue  # skip empty rows
        try:
            parsed = ImportedComplaint.model_validate(record)
        except Exception as exc:
            errors.append(f"Row {i + 1}: validation error — {exc}")
            skipped += 1
            continue

        # Duplicate prevention
        if parsed.id:
            existing = await db.execute(select(Complaint).where(Complaint.id == parsed.id))
            if existing.scalar_one_or_none():
                logger.debug("Import: duplicate id=%s — skipping.", parsed.id)
                skipped += 1
                continue

        complaint = Complaint(
            id=parsed.id or str(uuid.uuid4()),
            text=parsed.text,
            language=parsed.language,
            station=parsed.station,
            source_channel=parsed.source_channel.value,
            created_at=parsed.timestamp or datetime.now(timezone.utc),
        )
        complaint = await _apply_classification(complaint, use_ai=False)  # use fallback for batch
        db.add(complaint)
        complaint_ids.append(complaint.id)
        imported += 1

    await db.commit()
    logger.info("Import complete: %d imported, %d skipped, %d errors.", imported, skipped, len(errors))
    return ImportResult(imported=imported, skipped=skipped, errors=errors, complaint_ids=complaint_ids)
