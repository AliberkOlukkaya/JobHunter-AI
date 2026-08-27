from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import BigInteger, CheckConstraint, Date, DateTime, ForeignKey, Integer, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    company: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str | None] = mapped_column(Text)
    work_model: Mapped[str | None] = mapped_column(Text)
    source: Mapped[str | None] = mapped_column(Text)
    source_url: Mapped[str | None] = mapped_column(Text)
    external_job_id: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    match_score: Mapped[int | None] = mapped_column(Integer)
    ai_recommendation: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    matched_skills: Mapped[list[str] | None] = mapped_column(JSONB)
    missing_skills: Mapped[list[str] | None] = mapped_column(JSONB)
    ai_analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DailyDigest(Base):
    __tablename__ = "daily_digests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    digest_date: Mapped[date] = mapped_column(Date, nullable=False, unique=True)
    total_new_jobs: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    strong_apply_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    apply_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    maybe_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    top_jobs: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class JobApplication(Base):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("job_id", name="job_applications_job_id_key"),
        CheckConstraint(
            "status IN ('saved', 'ready_to_apply', 'applied', 'interview', 'rejected', 'offer', 'withdrawn')",
            name="job_applications_status_check",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False)
    applied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
