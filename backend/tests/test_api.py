from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import DailyDigest, Job


@compiles(JSONB, "sqlite")
def compile_jsonb_sqlite(_type, _compiler, **_kwargs):
    return "JSON"


engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Base.metadata.create_all(engine)


def override_db():
    with Session(engine) as session:
        yield session


app.dependency_overrides[get_db] = override_db
client = TestClient(app)


def setup_module():
    now = datetime.now(UTC)
    with Session(engine) as session:
        session.add(
            Job(
                id=1,
                title="Python Backend Developer",
                company="Example",
                city="İstanbul",
                work_model="Remote",
                source="Jooble",
                description="Python and SQL",
                match_score=90,
                ai_recommendation="strong_apply",
                matched_skills=["Python", "SQL"],
                missing_skills=[],
                discovered_at=now,
                created_at=now,
                updated_at=now,
            )
        )
        session.add(
            DailyDigest(
                id=1,
                digest_date=date(2026, 8, 26),
                total_new_jobs=4,
                strong_apply_count=1,
                apply_count=2,
                maybe_count=1,
                top_jobs=[{"id": 1, "title": "Python Backend Developer", "match_score": 90}],
                created_at=now,
            )
        )
        session.commit()


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_jobs():
    response = client.get("/api/jobs", params={"search": "python", "min_score": 70})
    assert response.status_code == 200
    assert response.json()[0]["title"] == "Python Backend Developer"
    assert response.json()[0]["missing_skills"] == []


def test_stats():
    response = client.get("/api/stats")
    assert response.status_code == 200
    assert response.json()["strong_apply"] == 1


def test_latest_digest():
    response = client.get("/api/digests/latest")
    assert response.status_code == 200
    assert response.json()["digest_date"] == "2026-08-26"
    assert response.json()["top_jobs"][0]["match_score"] == 90


def test_list_digests():
    response = client.get("/api/digests", params={"limit": 7})
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_create_application():
    response = client.post("/api/applications", json={"job_id": 1, "status": "saved", "notes": "Review CV"})
    assert response.status_code == 200
    assert response.json()["status"] == "saved"
    assert response.json()["job"]["title"] == "Python Backend Developer"


def test_duplicate_job_application_prevention():
    response = client.post("/api/applications", json={"job_id": 1, "status": "ready_to_apply"})
    assert response.status_code == 200
    assert response.json()["status"] == "ready_to_apply"
    assert len(client.get("/api/applications").json()) == 1


def test_update_status_sets_applied_at():
    application_id = client.get("/api/applications").json()[0]["id"]
    response = client.patch(f"/api/applications/{application_id}", json={"status": "applied"})
    assert response.status_code == 200
    assert response.json()["applied_at"] is not None
    applied_at = response.json()["applied_at"]
    response = client.patch(f"/api/applications/{application_id}", json={"status": "interview"})
    assert response.json()["applied_at"] == applied_at


def test_invalid_status_rejection():
    response = client.put("/api/jobs/1/application", json={"status": "pending"})
    assert response.status_code == 422


def test_application_list():
    response = client.get("/api/applications", params={"status": "interview"})
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["job_id"] == 1


def test_application_stats():
    response = client.get("/api/applications/stats")
    assert response.status_code == 200
    assert response.json()["interview"] == 1
    assert response.json()["saved"] == 0
