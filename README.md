# JobHunter AI

AI-assisted job discovery, ranking and application tracking platform.

## Overview

JobHunter AI collects job listings from multiple sources, applies deterministic career and relevance filters, ranks suitable roles with an AI provider fallback chain, and presents the results in a responsive dashboard. It also stores daily digests and lets users track applications and follow-up dates without submitting applications on their behalf.

## Features

- Multi-source ingestion with Jooble, Remotive, and safe LinkedIn imports
- LinkedIn job import through the dashboard
- LinkedIn Job Alert email ingestion workflow, ready for a user-supplied Gmail credential
- User-controlled LinkedIn approval and manual application handoff
- Turkey city and role searches through Jooble
- Remote job discovery through Remotive
- Seniority, experience, and high-precision relevance filtering
- Gemini → OpenAI → deterministic fallback scoring
- Candidate-to-job skill matching
- Scheduled daily automation and digest generation
- Application and follow-up tracking
- FastAPI REST API and responsive Next.js dashboard
- PostgreSQL persistence and Dockerized local development

## Architecture

```text
Jooble --------\
Remotive -------+--> n8n
LinkedIn Alerts-/      |
                       v
              Filtering + AI Ranking
                       |
                       v
                  PostgreSQL
                  /        \
             FastAPI    Daily Digest
                |
                v
        Next.js Dashboard
                |
                v
        User Approves Job
                |
                v
      Open Original Listing
                |
                v
       Manual Application
```

## Tech Stack

- Backend: FastAPI, SQLAlchemy, PostgreSQL, Pydantic
- Frontend: Next.js, React, TypeScript, Tailwind CSS
- Automation: n8n
- AI: Gemini API, OpenAI API, deterministic fallback
- Infrastructure: Docker Compose

## Quick Start

Docker Desktop is required. Create a local environment file:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Set a strong PostgreSQL password and add any provider keys you intend to use, then start the stack:

```bash
docker compose up -d --build
```

```text
Dashboard: http://localhost:3000
API:       http://localhost:8000
API Docs:  http://localhost:8000/docs
n8n:       http://localhost:5678
```

Stop the services with `docker compose down`. Do not add `-v` unless you intentionally want to remove persistent data.

## Environment Variables

| Variable | Purpose |
|---|---|
| `POSTGRES_DB` | PostgreSQL database name |
| `POSTGRES_USER` | PostgreSQL user |
| `POSTGRES_PASSWORD` | Local PostgreSQL password |
| `JOOBLE_API_KEY` | Jooble API access |
| `GEMINI_API_KEY` | Gemini API access |
| `GEMINI_MODEL` | Gemini model selection |
| `OPENAI_API_KEY` | OpenAI API access |
| `OPENAI_MODEL` | OpenAI model selection; Compose has a safe default |
| `NEXT_PUBLIC_API_URL` | Browser-accessible FastAPI URL |

Real values belong only in the ignored `.env` file.

## Workflows

- **Remotive Ingestion** fetches and filters remote roles.
- **Jooble Turkey Ingestion** searches configured Turkish cities and roles.
- **AI Job Scoring** uses Gemini, then OpenAI, then deterministic fallback and shared validation.
- **Daily Automation** runs ingestion and scoring workflows and stores a daily digest.
- **LinkedIn Job Alert Import** parses alert email text or HTML, canonicalizes listing URLs, applies the shared filters, and blocks mock data from production inserts. Its Gmail trigger placeholder is disabled until the user connects a credential.

Workflow exports are stored in [`automation/`](automation/).

## Application Tracking

Each job can have one application record with one of these statuses: `saved`, `ready_to_apply`, `applied`, `interview`, `rejected`, `offer`, or `withdrawn`. Notes and optional follow-up dates are editable in the dashboard. The platform does not log in to job sites or submit applications.

LinkedIn manual dashboard import is ready. LinkedIn job-alert email ingestion becomes available after a Gmail credential is connected to the disabled trigger placeholder. Approving a LinkedIn job only sets it to `ready_to_apply`; it does not submit anything.

JobHunter AI discovers, ranks, and prepares jobs for review. Final applications are always submitted manually by the user.

## Current Limitations

- LinkedIn browser scraping, login automation, and automated Easy Apply are intentionally not included.
- Jooble requires a user-provided API key.
- Gemini and OpenAI scoring require valid provider access.
- Deterministic scoring is used when AI providers are unavailable.

## Testing

Backend tests run against an isolated SQLite database:

```bash
cd backend
pytest
```

They can also run inside Docker:

```bash
docker compose run --rm --build backend pytest -q
```

Frontend production build:

```bash
cd frontend
npm run build
```

Docker verification:

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps
```

## License

MIT. See [`LICENSE`](LICENSE).
