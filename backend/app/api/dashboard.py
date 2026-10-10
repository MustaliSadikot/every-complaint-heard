"""
Dashboard and statistics router — FR-05.
"""

from __future__ import annotations
import logging
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.db.database import get_db
from app.db.models import Complaint, SyncOutbox, SyncStateEnum
from app.schemas import DashboardStats, DepartmentCount
from app.core.ai_engine import check_ai_available, get_ai_status

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
) -> DashboardStats:
    """Aggregate statistics for the complaint dashboard (FR-05, FR-06)."""

    # Total and pending counts
    total_result = await db.execute(select(func.count(Complaint.id)))
    total = total_result.scalar_one() or 0

    pending_result = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.status == "Pending")
    )
    pending = pending_result.scalar_one() or 0

    # Urgency counts
    async def count_urgency(level: str) -> int:
        r = await db.execute(
            select(func.count(Complaint.id)).where(Complaint.urgency_level == level)
        )
        return r.scalar_one() or 0

    critical_count = await count_urgency("Critical")
    high_count = await count_urgency("High")
    medium_count = await count_urgency("Medium")
    low_count = await count_urgency("Low")

    # Safety flagged
    safety_result = await db.execute(
        select(func.count(Complaint.id)).where(Complaint.safety_flag == True)
    )
    safety_flagged = safety_result.scalar_one() or 0

    # Pending sync
    sync_result = await db.execute(
        select(func.count(Complaint.id)).where(
            Complaint.sync_state == SyncStateEnum.pending_sync.value
        )
    )
    pending_sync = sync_result.scalar_one() or 0

    # Department counts
    dept_result = await db.execute(
        select(Complaint.department, func.count(Complaint.id))
        .group_by(Complaint.department)
    )
    dept_counts = [
        DepartmentCount(department=row[0], count=row[1])
        for row in dept_result.all()
    ]

    ai_available = get_ai_status()

    return DashboardStats(
        total_complaints=total,
        pending_count=pending,
        critical_count=critical_count,
        high_count=high_count,
        medium_count=medium_count,
        low_count=low_count,
        safety_flagged_count=safety_flagged,
        pending_sync_count=pending_sync,
        ai_available=ai_available,
        department_counts=dept_counts,
    )
