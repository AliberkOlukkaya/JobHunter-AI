from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..database import get_db
from ..linkedin import canonicalize_linkedin_job_url
from ..models import Job
from ..schemas import JobResponse, LinkedInJobImport, LinkedInJobImportResponse, StatsResponse

router = APIRouter(prefix="/api", tags=["jobs"])
Recommendation = Literal["strong_apply", "apply", "maybe", "skip"]


@router.post("/jobs/import/linkedin", response_model=LinkedInJobImportResponse)
def import_linkedin_job(payload: LinkedInJobImport, db: Annotated[Session, Depends(get_db)]) -> LinkedInJobImportResponse:
    try:
        canonical_url, external_job_id = canonicalize_linkedin_job_url(payload.source_url)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    duplicate_filters = [Job.source_url == canonical_url]
    if external_job_id:
        duplicate_filters.append((Job.source == "LinkedIn") & (Job.external_job_id == external_job_id))
    existing = db.scalar(select(Job).where(or_(*duplicate_filters)))
    if existing:
        return LinkedInJobImportResponse(status="existing", job_id=existing.id)

    now = datetime.now(UTC)
    job = Job(
        title=payload.title,
        company=payload.company,
        city=payload.city,
        work_model=payload.work_model,
        source="LinkedIn",
        source_url=canonical_url,
        external_job_id=external_job_id,
        description=payload.description,
        posted_at=None,
        match_score=None,
        discovered_at=now,
        created_at=now,
        updated_at=now,
    )
    db.add(job)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.scalar(select(Job).where(or_(*duplicate_filters)))
        if existing:
            return LinkedInJobImportResponse(status="existing", job_id=existing.id)
        raise
    db.refresh(job)
    return LinkedInJobImportResponse(status="created", job_id=job.id)


@router.get("/jobs", response_model=list[JobResponse])
def list_jobs(
    db: Annotated[Session, Depends(get_db)],
    city: str | None = None,
    recommendation: Recommendation | None = None,
    min_score: Annotated[int | None, Query(ge=0, le=100)] = None,
    source: str | None = None,
    search: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[Job]:
    statement = select(Job)

    if city:
        statement = statement.where(Job.city.ilike(f"%{city}%"))
    if recommendation:
        statement = statement.where(Job.ai_recommendation == recommendation)
    else:
        statement = statement.where(or_(Job.ai_recommendation.is_(None), Job.ai_recommendation != "skip"))
    if min_score is not None:
        statement = statement.where(Job.match_score >= min_score)
    if source:
        statement = statement.where(Job.source.ilike(source))
    if search:
        pattern = f"%{search}%"
        statement = statement.where(or_(Job.title.ilike(pattern), Job.company.ilike(pattern)))

    statement = statement.order_by(Job.match_score.desc().nulls_last(), Job.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(statement).all())


@router.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: int, db: Annotated[Session, Depends(get_db)]) -> Job:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Annotated[Session, Depends(get_db)]) -> StatsResponse:
    statement = select(
        func.count(Job.id),
        func.count(Job.id).filter(Job.ai_recommendation == "strong_apply"),
        func.count(Job.id).filter(Job.ai_recommendation == "apply"),
        func.count(Job.id).filter(Job.ai_recommendation == "maybe"),
        func.count(Job.id).filter(Job.ai_recommendation == "skip"),
        func.coalesce(func.avg(Job.match_score), 0),
        func.count(Job.id).filter(Job.match_score.is_(None)),
    )
    total, strong_apply, apply_count, maybe, skip, average, unanalyzed = db.execute(statement).one()
    return StatsResponse(
        total_jobs=total,
        strong_apply=strong_apply,
        apply=apply_count,
        maybe=maybe,
        skip=skip,
        average_score=round(float(average), 1),
        unanalyzed=unanalyzed,
    )
