CREATE TABLE IF NOT EXISTS jobs (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    city TEXT,
    work_model TEXT,
    source TEXT,
    source_url TEXT,
    external_job_id TEXT,
    description TEXT,
    posted_at TIMESTAMPTZ,
    match_score INTEGER,
    ai_recommendation TEXT,
    ai_summary TEXT,
    matched_skills JSONB,
    missing_skills JSONB,
    ai_analyzed_at TIMESTAMPTZ,
    discovered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT jobs_match_score_range_check
        CHECK (match_score IS NULL OR match_score BETWEEN 0 AND 100),
    CONSTRAINT jobs_ai_recommendation_check
        CHECK (ai_recommendation IS NULL OR ai_recommendation IN ('strong_apply', 'apply', 'maybe', 'skip'))
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_external_job_id_uidx
    ON jobs (source, external_job_id)
    WHERE source IS NOT NULL AND external_job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS jobs_source_url_uidx
    ON jobs (source_url)
    WHERE source_url IS NOT NULL;

CREATE TABLE IF NOT EXISTS daily_digests (
    id BIGSERIAL PRIMARY KEY,
    digest_date DATE NOT NULL UNIQUE,
    total_new_jobs INTEGER NOT NULL DEFAULT 0,
    strong_apply_count INTEGER NOT NULL DEFAULT 0,
    apply_count INTEGER NOT NULL DEFAULT 0,
    maybe_count INTEGER NOT NULL DEFAULT 0,
    top_jobs JSONB NOT NULL DEFAULT '[]'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS job_applications (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL UNIQUE REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    applied_at TIMESTAMPTZ,
    follow_up_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT job_applications_status_check
        CHECK (status IN ('saved', 'ready_to_apply', 'applied', 'interview', 'rejected', 'offer', 'withdrawn'))
);

CREATE INDEX IF NOT EXISTS job_applications_status_idx
    ON job_applications (status);
