from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    city: str | None = None
    work_model: str | None = None
    source: str | None = None
    source_url: str | None = None
    external_job_id: str | None = None
    description: str | None = None
    posted_at: datetime | None = None
    match_score: int | None = Field(default=None, ge=0, le=100)
    ai_recommendation: str | None = None
    ai_summary: str | None = None
    matched_skills: list[str] = Field(default_factory=list)
    missing_skills: list[str] = Field(default_factory=list)
    ai_analyzed_at: datetime | None = None

    @field_validator("matched_skills", "missing_skills", mode="before")
    @classmethod
    def normalize_nullable_skill_lists(cls, value: list[str] | None) -> list[str]:
        return value or []


class StatsResponse(BaseModel):
    total_jobs: int
    strong_apply: int
    apply: int
    maybe: int
    skip: int
    average_score: float
    unanalyzed: int


class DailyDigestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    digest_date: date
    total_new_jobs: int
    strong_apply_count: int
    apply_count: int
    maybe_count: int
    top_jobs: list[dict[str, Any]] = Field(default_factory=list)
    created_at: datetime


ApplicationStatus = Literal["saved", "ready_to_apply", "applied", "interview", "rejected", "offer", "withdrawn"]


class ApplicationCreate(BaseModel):
    job_id: int
    status: ApplicationStatus = "saved"
    follow_up_at: datetime | None = None
    notes: str | None = None


class ApplicationUpdate(BaseModel):
    status: ApplicationStatus | None = None
    follow_up_at: datetime | None = None
    notes: str | None = None


class ApplicationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    company: str
    city: str | None = None
    match_score: int | None = None
    source_url: str | None = None


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    job_id: int
    status: ApplicationStatus
    applied_at: datetime | None = None
    follow_up_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime
    job: ApplicationJobResponse


class ApplicationStatsResponse(BaseModel):
    saved: int = 0
    ready_to_apply: int = 0
    applied: int = 0
    interview: int = 0
    rejected: int = 0
    offer: int = 0
    withdrawn: int = 0
