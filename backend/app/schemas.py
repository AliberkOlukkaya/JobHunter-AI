from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .text import clean_display_text, preserve_source_url


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

    @field_validator("title", "company", "city", "work_model", "ai_summary", mode="before")
    @classmethod
    def clean_single_line_display_fields(cls, value: str | None) -> str | None:
        return clean_display_text(value)

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        return clean_display_text(value, multiline=True)

    @field_validator("source_url", mode="before")
    @classmethod
    def retain_original_source_url(cls, value: str | None) -> str | None:
        return preserve_source_url(value)

    @field_validator("matched_skills", "missing_skills", mode="before")
    @classmethod
    def normalize_nullable_skill_lists(cls, value: list[str] | None) -> list[str]:
        return value or []


class JobLinkResponse(BaseModel):
    status: Literal["resolved", "unavailable"]
    url: str | None = None
    source: str


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

    @field_validator("top_jobs", mode="before")
    @classmethod
    def clean_digest_jobs(cls, value: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
        jobs = value or []
        for job in jobs:
            for field in ("title", "company", "city"):
                if field in job:
                    job[field] = clean_display_text(job[field])
        return jobs


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

    @field_validator("title", "company", "city", mode="before")
    @classmethod
    def clean_application_job_fields(cls, value: str | None) -> str | None:
        return clean_display_text(value)

    @field_validator("source_url", mode="before")
    @classmethod
    def retain_application_job_url(cls, value: str | None) -> str | None:
        return preserve_source_url(value)


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


class LinkedInJobImport(BaseModel):
    source_url: str
    title: str = Field(min_length=1, max_length=500)
    company: str = Field(min_length=1, max_length=500)
    city: str | None = Field(default=None, max_length=500)
    work_model: str | None = Field(default=None, max_length=100)
    description: str | None = None

    @field_validator("source_url", "title", "company", "city", "work_model", mode="before")
    @classmethod
    def strip_import_text(cls, value: str | None) -> str | None:
        return value.strip() if isinstance(value, str) else value


class LinkedInJobImportResponse(BaseModel):
    status: Literal["created", "existing"]
    job_id: int
