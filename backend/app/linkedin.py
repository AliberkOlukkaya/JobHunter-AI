import re
from urllib.parse import parse_qs, unquote, urlsplit


LINKEDIN_JOB_PATH = re.compile(r"^/jobs/view/(?:[^/?#]*-)?(?P<job_id>\d+)/?$", re.IGNORECASE)


def canonicalize_linkedin_job_url(value: str) -> tuple[str, str | None]:
    """Validate a public LinkedIn job URL and remove tracking parameters."""
    try:
        parsed = urlsplit(value.strip())
    except ValueError as exc:
        raise ValueError("Invalid LinkedIn job URL") from exc
    hostname = (parsed.hostname or "").lower().rstrip(".")
    if parsed.scheme != "https" or hostname not in {"linkedin.com", "www.linkedin.com"}:
        raise ValueError("URL must use https://www.linkedin.com")
    if parsed.username or parsed.password or parsed.port:
        raise ValueError("Invalid LinkedIn job URL")
    path = unquote(parsed.path).replace("//", "/")
    match = LINKEDIN_JOB_PATH.match(path)
    query_id = (parse_qs(parsed.query).get("currentJobId") or [None])[0]
    job_id = match.group("job_id") if match else query_id if query_id and query_id.isdigit() else None
    if not path.lower().startswith("/jobs/view/") or path.lower() == "/jobs/view/":
        raise ValueError("URL must be a LinkedIn job listing")
    if job_id:
        return f"https://www.linkedin.com/jobs/view/{job_id}/", job_id
    return f"https://www.linkedin.com{path.rstrip('/')}/", None
