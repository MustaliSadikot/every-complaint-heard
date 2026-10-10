"""
Synchronisation and configuration routers — FR-07.
"""

from __future__ import annotations
import logging
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.core.sync_service import get_sync_status, trigger_sync
from app.core.ai_engine import check_ai_available
from app.schemas import SyncStatus, SyncTriggerResult, ThresholdConfig
from app.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["system"])


@router.get("/sync/status", response_model=SyncStatus)
async def sync_status(db: AsyncSession = Depends(get_db)) -> SyncStatus:
    """Return current synchronisation status (FR-07)."""
    return await get_sync_status(db)


@router.post("/sync/trigger", response_model=SyncTriggerResult)
async def sync_trigger(db: AsyncSession = Depends(get_db)) -> SyncTriggerResult:
    """
    Manually trigger synchronisation of pending records (FR-07).
    Will only report success if the remote server confirms receipt.
    """
    return await trigger_sync(db)


@router.get("/ai/status")
async def ai_status() -> dict:
    """Probe local Ollama and return availability (FR-08)."""
    available = await check_ai_available()
    return {
        "available": available,
        "model": settings.ollama_model,
        "endpoint": settings.ollama_base_url,
        "message": (
            f"Model '{settings.ollama_model}' is available at {settings.ollama_base_url}."
            if available
            else f"Ollama not reachable at {settings.ollama_base_url} or model not installed."
        ),
    }


@router.get("/config/thresholds", response_model=ThresholdConfig)
async def get_thresholds() -> ThresholdConfig:
    """Return current urgency threshold configuration."""
    return ThresholdConfig(
        urgency_critical_min=settings.urgency_critical_min,
        urgency_high_min=settings.urgency_high_min,
        urgency_medium_min=settings.urgency_medium_min,
    )


@router.put("/config/thresholds", response_model=ThresholdConfig)
async def update_thresholds(payload: ThresholdConfig) -> ThresholdConfig:
    """Update urgency thresholds at runtime (prototype — not persisted to disk)."""
    settings.urgency_critical_min = payload.urgency_critical_min
    settings.urgency_high_min = payload.urgency_high_min
    settings.urgency_medium_min = payload.urgency_medium_min
    logger.info(
        "Urgency thresholds updated: critical≥%d high≥%d medium≥%d",
        payload.urgency_critical_min, payload.urgency_high_min, payload.urgency_medium_min,
    )
    return payload
