from datetime import UTC, date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import JSON, create_engine
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.linkedin import canonicalize_linkedin_job_url
from app.models import DailyDigest, Job
from app.schemas import JobResponse
from app.text import clean_display_text, preserve_source_url


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
    posted_at = datetime(2026, 8, 25, 12, 30, tzinfo=UTC)
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
                posted_at=posted_at,
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
    assert response.json()[0]["posted_at"] == "2026-08-25T12:30:00"


def test_timezone_aware_posted_at_serialization():
    posted_at = datetime(2026, 8, 25, 12, 30, tzinfo=UTC)
    response = JobResponse(id=101, title="Data Engineer", company="Example", posted_at=posted_at)
    assert '"posted_at":"2026-08-25T12:30:00Z"' in response.model_dump_json()


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


def test_valid_linkedin_import():
    response = client.post("/api/jobs/import/linkedin", json={
        "source_url": "https://www.linkedin.com/jobs/view/junior-data-engineer-1234567890/?trackingId=secret-tracker&refId=alert",
        "title": "Junior Data Engineer",
        "company": "LinkedIn Test Company",
        "city": "Ankara",
        "work_model": "Hybrid",
    })
    assert response.status_code == 200
    assert response.json()["status"] == "created"
    job = client.get(f"/api/jobs/{response.json()['job_id']}").json()
    assert job["source"] == "LinkedIn"
    assert job["match_score"] is None
    assert job["source_url"] == "https://www.linkedin.com/jobs/view/1234567890/"


def test_invalid_non_linkedin_url_rejection():
    response = client.post("/api/jobs/import/linkedin", json={
        "source_url": "https://example.com/jobs/view/1234567890/",
        "title": "Data Engineer",
        "company": "Example",
    })
    assert response.status_code == 422


def test_duplicate_linkedin_import():
    response = client.post("/api/jobs/import/linkedin", json={
        "source_url": "https://linkedin.com/jobs/view/1234567890/?utm_source=email",
        "title": "Same Job",
        "company": "Same Company",
    })
    assert response.status_code == 200
    assert response.json()["status"] == "existing"


def test_linkedin_external_job_id_extraction():
    canonical, job_id = canonicalize_linkedin_job_url("https://www.linkedin.com/jobs/view/platform-engineer-99887766/")
    assert job_id == "99887766"
    assert canonical.endswith("/jobs/view/99887766/")


def test_linkedin_canonical_url_behavior():
    canonical, job_id = canonicalize_linkedin_job_url("https://www.linkedin.com/jobs/view/data-role/?currentJobId=445566&trackingId=abc")
    assert canonical == "https://www.linkedin.com/jobs/view/445566/"
    assert job_id == "445566"


def test_jooble_original_url_preserved():
    url = "https://tr.jooble.org/jdp/1234567890123456789?ref=original&position=1"
    assert preserve_source_url(url) == url
    response = JobResponse(id=99, title="Data Engineer", company="Example", source="Jooble", source_url=url)
    assert response.source_url == url


def test_provider_source_urls_are_preserved():
    urls = {
        "Jooble": "https://tr.jooble.org/desc/123?ckey=Python%20Developer&pos=1",
        "Remotive": "https://remotive.com/remote-jobs/software-dev/python-engineer-123",
        "LinkedIn": "https://www.linkedin.com/jobs/view/1234567890/",
    }
    for source, url in urls.items():
        response = JobResponse(id=100, title="Python Engineer", company="Example", source=source, source_url=url)
        assert response.source_url == url


def test_html_entities_decoded_and_html_removed():
    value = "<p>Python &amp; SQL&nbsp;role</p><script>alert('x')</script><p>Next &#39;step&#39;</p>"
    assert clean_display_text(value, multiline=True) == "Python & SQL role\nNext 'step'"


def test_turkish_utf8_text_preserved():
    value = "İstanbul, İzmir, Çeşme, görüşme ve iş"
    assert clean_display_text(value) == value
