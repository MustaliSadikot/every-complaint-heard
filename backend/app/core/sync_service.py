"""
Synchronisation service — FR-07.

Manages the local outbox. Attempts to sync pending records to a configured
remote server. Never marks a record as synced without a confirmed HTTP 2xx
response. Provides retry with exponential backoff and duplicate prevention.

The app NEVER claims synchronisation succeeded unless confirmed.
"""

from __future__ import annotations
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import Complaint, SyncOutbox, SyncStateEnum
from app.schemas import SyncStatus, SyncTriggerResult

logger = logging.getLogger(__name__)

BACKOFF_BASE_SECONDS = [10, 60, 300]   # 10s, 1min, 5min


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def enqueue_for_sync(
    db: AsyncSession,
    complaint: Complaint,
    operation: str = "create",
) -> None:
    """Add a complaint to the sync outbox. Safe to call multiple times (idempotent by complaint_id+operation)."""
    existing = await db.execute(
        select(SyncOutbox).where(
            SyncOutbox.complaint_id == complaint.id,
            SyncOutbox.operation == operation,
        )
    )
    if existing.scalar_one_or_none():
        logger.debug("Sync outbox already has entry for %s op=%s — skip.", complaint.id, operation)
        return

    outbox_entry = SyncOutbox(
        complaint_id=complaint.id,
        operation=operation,
        payload_json=json.dumps({
            "id": complaint.id,
            "text": complaint.text,
            "language": complaint.language,
            "station": complaint.station,
            "source_channel": complaint.source_channel,
            "department": complaint.department,
            "urgency_score": complaint.urgency_score,
            "urgency_level": complaint.urgency_level,
            "safety_flag": complaint.safety_flag,
            "status": complaint.status,
            "created_at": complaint.created_at.isoformat(),
        }),
    )
    db.add(outbox_entry)

    await db.execute(
        update(Complaint)
        .where(Complaint.id == complaint.id)
        .values(sync_state=SyncStateEnum.pending_sync)
    )
    logger.info("Enqueued complaint %s for sync (op=%s).", complaint.id, operation)


async def get_sync_status(db: AsyncSession) -> SyncStatus:
    result = await db.execute(select(SyncOutbox))
    pending_count = len(result.scalars().all())
    server_configured = bool(settings.sync_server_url)
    msg = (
        f"Server configured at {settings.sync_server_url}. {pending_count} record(s) pending."
        if server_configured
        else "No remote server configured. Changes remain local-only."
    )
    return SyncStatus(
        server_configured=server_configured,
        pending_count=pending_count,
        message=msg,
    )


async def trigger_sync(db: AsyncSession) -> SyncTriggerResult:
    """
    Attempt to push all pending outbox entries to the remote server.
    Marks synced ONLY on confirmed HTTP 2xx response.
    """
    if not settings.sync_server_url:
        return SyncTriggerResult(
            attempted=0, succeeded=0, failed=0,
            message="No remote server configured. Nothing to sync.",
        )

    now = _utcnow()
    result = await db.execute(
        select(SyncOutbox).where(SyncOutbox.next_retry_at <= now)
    )
    entries = result.scalars().all()

    attempted = len(entries)
    succeeded = 0
    failed = 0

    for entry in entries:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{settings.sync_server_url}/api/complaints/sync",
                    content=entry.payload_json,
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()

            # Confirmed: delete from outbox and mark complaint synced
            remote_data = resp.json()
            remote_id = remote_data.get("id", entry.complaint_id)

            await db.execute(
                update(Complaint)
                .where(Complaint.id == entry.complaint_id)
                .values(
                    sync_state=SyncStateEnum.synced,
                    remote_id=remote_id,
                )
            )
            await db.delete(entry)
            succeeded += 1
            logger.info("Synced complaint %s → remote id %s.", entry.complaint_id, remote_id)

        except Exception as exc:
            entry.attempts += 1
            entry.last_error = str(exc)[:500]
            backoff_idx = min(entry.attempts - 1, len(BACKOFF_BASE_SECONDS) - 1)
            entry.next_retry_at = now + timedelta(seconds=BACKOFF_BASE_SECONDS[backoff_idx])

            if entry.attempts >= settings.sync_retry_max:
                await db.execute(
                    update(Complaint)
                    .where(Complaint.id == entry.complaint_id)
                    .values(sync_state=SyncStateEnum.sync_failed)
                )

            failed += 1
            logger.warning("Sync failed for %s: %s", entry.complaint_id, exc)

    await db.commit()

    return SyncTriggerResult(
        attempted=attempted,
        succeeded=succeeded,
        failed=failed,
        message=f"Sync attempted {attempted} record(s): {succeeded} succeeded, {failed} failed.",
    )
