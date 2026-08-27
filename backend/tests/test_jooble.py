from types import SimpleNamespace

from app import jooble


def make_job(**overrides):
    values = {
        "id": 501,
        "title": "Python Developer",
        "company": "Example Tech",
        "city": "Istanbul",
        "source_url": "https://tr.jooble.org/desc/old",
        "external_job_id": "1234567890123456789",
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_jooble_exact_id_resolve_and_cache(monkeypatch):
    jooble.clear_jooble_link_cache()
    calls = []

    def fake_fetch(keywords, location):
        calls.append((keywords, location))
        return [{"id": 1234567890123456789, "title": "Different title", "company": "Other", "link": "https://tr.jooble.org/jdp/1234567890123456789"}]

    monkeypatch.setattr(jooble, "_fetch_jobs", fake_fetch)
    job = make_job()
    first = jooble.resolve_jooble_job_url(job)
    second = jooble.resolve_jooble_job_url(job)
    assert first.status == "resolved"
    assert first.url == "https://tr.jooble.org/jdp/1234567890123456789"
    assert second == first
    assert len(calls) == 1


def test_jooble_title_company_fallback_resolve(monkeypatch):
    jooble.clear_jooble_link_cache()
    calls = []

    def fake_fetch(keywords, _location):
        calls.append(keywords)
        if len(calls) == 1:
            return []
        return [{"id": "999", "title": "Python Developer", "company": "Example Tech", "link": "https://tr.jooble.org/jdp/999"}]

    monkeypatch.setattr(jooble, "_fetch_jobs", fake_fetch)
    result = jooble.resolve_jooble_job_url(make_job(external_job_id="missing"))
    assert result.status == "resolved"
    assert result.url == "https://tr.jooble.org/jdp/999"
    assert len(calls) == 2


def test_jooble_unavailable_result(monkeypatch):
    jooble.clear_jooble_link_cache()
    calls = []

    def fake_fetch(keywords, location):
        calls.append((keywords, location))
        return [{"id": "other", "title": "Sales Manager", "company": "Other", "link": "https://tr.jooble.org/jdp/other"}]

    monkeypatch.setattr(jooble, "_fetch_jobs", fake_fetch)
    result = jooble.resolve_jooble_job_url(make_job())
    assert result.status == "unavailable"
    assert result.url is None
    assert len(calls) == 2
