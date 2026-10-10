"""
SQLAlchemy ORM models for Every Complaint Heard.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Integer, Float, Boolean, Text, DateTime, Enum as SAEnum, Index
)
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base
import enum


class DepartmentEnum(str, enum.Enum):
    safety = "Safety"
    cleanliness = "Cleanliness"
    fare_ticketing = "Fare and Ticketing"
    lifts_escalators = "Lifts and Escalators"
    staff_behaviour = "Staff Behaviour"
    other = "Other/General"


class UrgencyEnum(str, enum.Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"


class StatusEnum(str, enum.Enum):
    pending = "Pending"
    in_review = "In Review"
    replied = "Replied"
    resolved = "Resolved"
    escalated = "Escalated"


class SourceChannelEnum(str, enum.Enum):
    kiosk = "Kiosk"
    mobile_app = "Mobile App"
    email = "Email"
    phone = "Phone"
    in_person = "In Person"
    import_batch = "Import Batch"
    other = "Other"


class ClassificationModeEnum(str, enum.Enum):
    ai = "AI"
    fallback = "Fallback"


class ReviewStateEnum(str, enum.Enum):
    pending = "Pending Review"
    approved = "Approved"
    rejected = "Rejected"


class SyncStateEnum(str, enum.Enum):
    local_only = "Local Only"
    pending_sync = "Pending Sync"
    synced = "Synced"
    sync_failed = "Sync Failed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Complaint(Base):
    __tablename__ = "complaints"

    # Primary key
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)

    # Core complaint fields
    text: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(32), nullable=False, default="en")
    station: Mapped[str] = mapped_column(String(128), nullable=False, default="Unknown")
    source_channel: Mapped[str] = mapped_column(
        SAEnum(SourceChannelEnum), nullable=False, default=SourceChannelEnum.other
    )

    # Classification
    department: Mapped[str] = mapped_column(
        SAEnum(DepartmentEnum), nullable=False, default=DepartmentEnum.other
    )
    classification_mode: Mapped[str] = mapped_column(
        SAEnum(ClassificationModeEnum), nullable=False, default=ClassificationModeEnum.fallback
    )
    classification_confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)

    # Urgency
    urgency_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    urgency_level: Mapped[str] = mapped_column(
        SAEnum(UrgencyEnum), nullable=False, default=UrgencyEnum.low
    )
    safety_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Status and workflow
    status: Mapped[str] = mapped_column(
        SAEnum(StatusEnum), nullable=False, default=StatusEnum.pending
    )
    review_state: Mapped[str] = mapped_column(
        SAEnum(ReviewStateEnum), nullable=False, default=ReviewStateEnum.pending
    )

    # AI draft reply
    draft_reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    reply_language: Mapped[str] = mapped_column(String(32), nullable=False, default="en")
    reply_edited: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    approved_reply: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Sync
    sync_state: Mapped[str] = mapped_column(
        SAEnum(SyncStateEnum), nullable=False, default=SyncStateEnum.local_only
    )
    sync_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    remote_id: Mapped[str | None] = mapped_column(String(128), nullable=True)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow, onupdate=_utcnow
    )

    # Indexes
    __table_args__ = (
        Index("ix_complaints_status", "status"),
        Index("ix_complaints_urgency_level", "urgency_level"),
        Index("ix_complaints_department", "department"),
        Index("ix_complaints_created_at", "created_at"),
        Index("ix_complaints_safety_flag", "safety_flag"),
    )


class SyncOutbox(Base):
    """
    Local outbox for records awaiting synchronisation (FR-07).
    Safe interface: never marks synced without a confirmed server response.
    """
    __tablename__ = "sync_outbox"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    complaint_id: Mapped[str] = mapped_column(String(36), nullable=False)
    operation: Mapped[str] = mapped_column(String(32), nullable=False)  # create | update
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
    next_retry_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utcnow
    )
