"""
Pydantic schemas for request/response validation — Every Complaint Heard.
"""

from __future__ import annotations
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
from app.db.models import (
    DepartmentEnum, UrgencyEnum, StatusEnum,
    SourceChannelEnum, ReviewStateEnum, SyncStateEnum, ClassificationModeEnum
)


# ─── Complaint Schemas ──────────────────────────────────────────────────────

class ComplaintCreate(BaseModel):
    text: str = Field(..., min_length=1, max_length=5000, description="Complaint text")
    language: str = Field(default="en", max_length=32)
    station: str = Field(default="Unknown", max_length=128)
    source_channel: SourceChannelEnum = SourceChannelEnum.other

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Complaint text must not be blank.")
        return v.strip()


class ComplaintUpdate(BaseModel):
    status: Optional[StatusEnum] = None
    review_state: Optional[ReviewStateEnum] = None
    department: Optional[DepartmentEnum] = None
    draft_reply: Optional[str] = Field(default=None, max_length=5000)
    approved_reply: Optional[str] = Field(default=None, max_length=5000)
    reply_edited: Optional[bool] = None


class ComplaintOut(BaseModel):
    id: str
    text: str
    language: str
    station: str
    source_channel: str
    department: str
    classification_mode: str
    classification_confidence: float
    urgency_score: int
    urgency_level: str
    safety_flag: bool
    status: str
    review_state: str
    draft_reply: Optional[str]
    reply_language: str
    reply_edited: bool
    approved_reply: Optional[str]
    sync_state: str
    sync_attempts: int
    remote_id: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ComplaintListItem(BaseModel):
    id: str
    text: str
    language: str
    station: str
    department: str
    urgency_score: int
    urgency_level: str
    safety_flag: bool
    status: str
    review_state: str
    classification_mode: str
    sync_state: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Import Schemas ──────────────────────────────────────────────────────────

class ImportedComplaint(BaseModel):
    """Shape of each record in a JSON/CSV batch import."""
    id: Optional[str] = None
    text: str = Field(..., min_length=1, max_length=5000)
    language: str = "en"
    station: str = "Unknown"
    source_channel: SourceChannelEnum = SourceChannelEnum.import_batch
    timestamp: Optional[datetime] = None

    @field_validator("text")
    @classmethod
    def text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Complaint text must not be blank.")
        return v.strip()


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]
    complaint_ids: List[str]


# ─── Dashboard / Stats Schemas ───────────────────────────────────────────────

class DepartmentCount(BaseModel):
    department: str
    count: int


class DashboardStats(BaseModel):
    total_complaints: int
    pending_count: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    safety_flagged_count: int
    pending_sync_count: int
    ai_available: bool
    department_counts: List[DepartmentCount]


# ─── AI / Classification Schemas ─────────────────────────────────────────────

class AIClassificationResult(BaseModel):
    department: DepartmentEnum
    confidence: float = Field(ge=0.0, le=1.0)
    urgency_score: int = Field(ge=0, le=100)
    safety_flag: bool
    draft_reply: str
    reply_language: str
    mode: ClassificationModeEnum = ClassificationModeEnum.ai


# ─── Sync Schemas ────────────────────────────────────────────────────────────

class SyncStatus(BaseModel):
    server_configured: bool
    pending_count: int
    message: str


class SyncTriggerResult(BaseModel):
    attempted: int
    succeeded: int
    failed: int
    message: str


# ─── Config Schemas ──────────────────────────────────────────────────────────

class ThresholdConfig(BaseModel):
    urgency_critical_min: int = Field(ge=0, le=100)
    urgency_high_min: int = Field(ge=0, le=100)
    urgency_medium_min: int = Field(ge=0, le=100)


# ─── Pagination ──────────────────────────────────────────────────────────────

class PaginatedComplaints(BaseModel):
    items: List[ComplaintListItem]
    total: int
    page: int
    page_size: int
    total_pages: int
