import json
import os
import re
import threading
import time
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any, Protocol
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


JOOBLE_API_BASE = "https://tr.jooble.org/api/"
CACHE_TTL_SECONDS = 600
_ID_FROM_LINK = re.compile(r"/(?:jdp|desc)/(-?\d+)(?:[/?#]|$)", re.IGNORECASE)


class JoobleJob(Protocol):
    id: int
    title: str
    company: str
    city: str | None
    source_url: str | None
    external_job_id: str | None


@dataclass(frozen=True)
class LinkResolution:
    status: str
    url: str | None
    source: str = "Jooble"


class JoobleAPIError(RuntimeError):
    pass


_cache: dict[tuple[Any, ...], tuple[float, LinkResolution]] = {}
_cache_lock = threading.Lock()


def _normalize(value: Any) -> str:
    text = unicodedata.normalize("NFKD", str(value or "").casefold())
    text = "".join(character for character in text if not unicodedata.combining(character))
    return " ".join(re.findall(r"[a-z0-9]+", text))


def _candidate_id(candidate: dict[str, Any]) -> str | None:
    identifier = candidate.get("id")
    if identifier is not None:
        return str(identifier)
    match = _ID_FROM_LINK.search(str(candidate.get("link") or ""))
    return match.group(1) if match else None


def _usable_link(candidate: dict[str, Any]) -> str | None:
    link = candidate.get("link")
    return link if isinstance(link, str) and link.startswith(("https://", "http://")) else None


def _fetch_jobs(keywords: str, location: str | None) -> list[dict[str, Any]]:
    api_key = os.getenv("JOOBLE_API_KEY", "").strip()
    if not api_key:
        raise JoobleAPIError("Jooble API is not configured")
    payload = json.dumps({"keywords": keywords, "location": location or ""}).encode("utf-8")
    request = Request(
        f"{JOOBLE_API_BASE}{api_key}",
        data=payload,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=12) as response:
            body = json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise JoobleAPIError("Jooble API request failed") from exc
    jobs = body.get("jobs") if isinstance(body, dict) else None
    if not isinstance(jobs, list):
        raise JoobleAPIError("Jooble API returned a malformed response")
    return [item for item in jobs if isinstance(item, dict)]


def _find_match(job: JoobleJob, candidates: list[dict[str, Any]]) -> str | None:
    external_id = str(job.external_job_id or "").strip()
    if external_id:
        exact_id_matches = [candidate for candidate in candidates if _candidate_id(candidate) == external_id and _usable_link(candidate)]
        if len(exact_id_matches) == 1:
            return _usable_link(exact_id_matches[0])

    title = _normalize(job.title)
    company = _normalize(job.company)
    exact_matches = [
        candidate for candidate in candidates
        if _normalize(candidate.get("title")) == title
        and _normalize(candidate.get("company")) == company
        and _usable_link(candidate)
    ]
    if len(exact_matches) == 1:
        return _usable_link(exact_matches[0])
    if len(exact_matches) > 1:
        return None

    scored: list[tuple[float, dict[str, Any]]] = []
    for candidate in candidates:
        link = _usable_link(candidate)
        if not link:
            continue
        title_ratio = SequenceMatcher(None, title, _normalize(candidate.get("title"))).ratio()
        company_ratio = SequenceMatcher(None, company, _normalize(candidate.get("company"))).ratio()
        if title_ratio >= 0.92 and company_ratio >= 0.85:
            scored.append(((title_ratio * 0.7) + (company_ratio * 0.3), candidate))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored or (len(scored) > 1 and scored[0][0] - scored[1][0] < 0.08):
        return None
    return _usable_link(scored[0][1])


def resolve_jooble_job_url(job: JoobleJob) -> LinkResolution:
    cache_key = (job.id, job.external_job_id, job.title, job.company, job.city)
    now = time.monotonic()
    with _cache_lock:
        cached = _cache.get(cache_key)
        if cached and cached[0] > now:
            return cached[1]

    all_candidates: list[dict[str, Any]] = []
    queries = [job.title]
    combined_query = f"{job.title} {job.company}".strip()
    if _normalize(combined_query) != _normalize(job.title):
        queries.append(combined_query)

    resolution = LinkResolution(status="unavailable", url=None)
    for query in queries[:2]:
        candidates = _fetch_jobs(query, job.city)
        all_candidates.extend(candidates)
        matched_url = _find_match(job, all_candidates)
        if matched_url:
            resolution = LinkResolution(status="resolved", url=matched_url)
            break

    with _cache_lock:
        _cache[cache_key] = (now + CACHE_TTL_SECONDS, resolution)
    return resolution


def clear_jooble_link_cache() -> None:
    with _cache_lock:
        _cache.clear()
