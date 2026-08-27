# Portfolio Summary

## Project

JobHunter AI

## One-line description

Built an AI-assisted job discovery, ranking, daily digest, and application tracking platform using n8n, FastAPI, Next.js, and PostgreSQL.

## Short CV version

Developed a Dockerized job-search automation platform that ingests listings from Jooble and Remotive, applies career-focused filters, and ranks opportunities through a Gemini → OpenAI → deterministic fallback chain. Added a FastAPI API, responsive dashboard, daily digests, and application follow-up tracking.

## Portfolio version

JobHunter AI is an end-to-end job discovery workspace. n8n orchestrates multi-source ingestion, deterministic seniority/experience/relevance filtering, provider-aware AI scoring, and daily digest generation. PostgreSQL provides durable storage, FastAPI exposes the data through a tested REST API, and a responsive Next.js dashboard supports job review and application tracking without automating submissions.

## Key Technologies

Python, FastAPI, SQLAlchemy, Pydantic, PostgreSQL, n8n, Next.js, React, TypeScript, Tailwind CSS, Docker Compose, Gemini API, OpenAI API.

## Key Achievement

Delivered one reproducible system covering two live ingestion sources, multi-stage filtering, validated three-provider scoring behavior, scheduled daily automation, digest persistence, and seven-state application tracking with follow-up dates.
