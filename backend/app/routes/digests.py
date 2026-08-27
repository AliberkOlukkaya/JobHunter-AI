from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import DailyDigest
from ..schemas import DailyDigestResponse

router = APIRouter(prefix="/api/digests", tags=["digests"])


@router.get("/latest", response_model=DailyDigestResponse)
def latest_digest(db: Annotated[Session, Depends(get_db)]) -> DailyDigest:
    statement = select(DailyDigest).order_by(
        DailyDigest.digest_date.desc(), DailyDigest.created_at.desc()
    ).limit(1)
    digest = db.scalar(statement)
    if digest is None:
        raise HTTPException(status_code=404, detail="No daily digest generated yet")
    return digest


@router.get("", response_model=list[DailyDigestResponse])
def list_digests(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=30)] = 7,
) -> list[DailyDigest]:
    statement = select(DailyDigest).order_by(
        DailyDigest.digest_date.desc(), DailyDigest.created_at.desc()
    ).limit(limit)
    return list(db.scalars(statement).all())
