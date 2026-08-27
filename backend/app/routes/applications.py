from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Job, JobApplication
from ..schemas import (
    ApplicationCreate,
    ApplicationResponse,
    ApplicationStatsResponse,
    ApplicationStatus,
    ApplicationUpdate,
)

router = APIRouter(prefix="/api", tags=["applications"])


def response_for(application: JobApplication, db: Session) -> ApplicationResponse:
    job = db.get(Job, application.job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return ApplicationResponse.model_validate({**application.__dict__, "job": job})


def apply_changes(application: JobApplication, payload: ApplicationUpdate) -> None:
    changes = payload.model_dump(exclude_unset=True)
    if changes.get("status") == "applied" and application.applied_at is None:
        application.applied_at = datetime.now(UTC)
    for field, value in changes.items():
        setattr(application, field, value)
    application.updated_at = datetime.now(UTC)


@router.get("/applications", response_model=list[ApplicationResponse])
def list_applications(
    db: Annotated[Session, Depends(get_db)],
    application_status: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
) -> list[ApplicationResponse]:
    statement = select(JobApplication).order_by(JobApplication.updated_at.desc(), JobApplication.id.desc())
    if application_status:
        statement = statement.where(JobApplication.status == application_status)
    return [response_for(item, db) for item in db.scalars(statement).all()]


@router.get("/applications/stats", response_model=ApplicationStatsResponse)
def application_stats(db: Annotated[Session, Depends(get_db)]) -> ApplicationStatsResponse:
    rows = db.execute(select(JobApplication.status, func.count(JobApplication.id)).group_by(JobApplication.status)).all()
    return ApplicationStatsResponse(**{name: count for name, count in rows})


@router.get("/applications/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: int, db: Annotated[Session, Depends(get_db)]) -> ApplicationResponse:
    application = db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return response_for(application, db)


@router.post("/applications", response_model=ApplicationResponse)
def create_application(payload: ApplicationCreate, db: Annotated[Session, Depends(get_db)]) -> ApplicationResponse:
    if db.get(Job, payload.job_id) is None:
        raise HTTPException(status_code=404, detail="Job not found")
    application = db.scalar(select(JobApplication).where(JobApplication.job_id == payload.job_id))
    if application is None:
        now = datetime.now(UTC)
        application = JobApplication(job_id=payload.job_id, status=payload.status, follow_up_at=payload.follow_up_at, notes=payload.notes, created_at=now, updated_at=now)
        if payload.status == "applied":
            application.applied_at = now
        db.add(application)
    else:
        apply_changes(application, ApplicationUpdate(status=payload.status, follow_up_at=payload.follow_up_at, notes=payload.notes))
    db.commit()
    db.refresh(application)
    return response_for(application, db)


@router.patch("/applications/{application_id}", response_model=ApplicationResponse)
def update_application(application_id: int, payload: ApplicationUpdate, db: Annotated[Session, Depends(get_db)]) -> ApplicationResponse:
    application = db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    apply_changes(application, payload)
    db.commit()
    db.refresh(application)
    return response_for(application, db)


@router.delete("/applications/{application_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(application_id: int, db: Annotated[Session, Depends(get_db)]) -> Response:
    application = db.get(JobApplication, application_id)
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(application)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/jobs/{job_id}/application", response_model=ApplicationResponse)
def get_job_application(job_id: int, db: Annotated[Session, Depends(get_db)]) -> ApplicationResponse:
    application = db.scalar(select(JobApplication).where(JobApplication.job_id == job_id))
    if application is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return response_for(application, db)


@router.put("/jobs/{job_id}/application", response_model=ApplicationResponse)
def upsert_job_application(job_id: int, payload: ApplicationUpdate, db: Annotated[Session, Depends(get_db)]) -> ApplicationResponse:
    if db.get(Job, job_id) is None:
        raise HTTPException(status_code=404, detail="Job not found")
    application = db.scalar(select(JobApplication).where(JobApplication.job_id == job_id))
    if application is None:
        now = datetime.now(UTC)
        application = JobApplication(job_id=job_id, status=payload.status or "saved", created_at=now, updated_at=now)
        db.add(application)
    apply_changes(application, payload)
    db.commit()
    db.refresh(application)
    return response_for(application, db)
