-- Job Tracker: Initial Database Schema

-- 1. Users
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Companies
CREATE TABLE companies (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    website TEXT,
    location VARCHAR(200),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT companies_user_name_unique UNIQUE (user_id, name)
);

-- 3. Jobs
CREATE TABLE jobs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    employment_type VARCHAR(50),
    job_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Applications
CREATE TABLE applications (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id BIGINT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,

    status VARCHAR(30) NOT NULL DEFAULT 'applied',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    follow_up_at TIMESTAMPTZ,
    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT applications_status_valid CHECK (
        status IN (
            'applied',
            'assessment',
            'interview',
            'offer',
            'rejected',
            'withdrawn'
        )
    ),

    CONSTRAINT applications_user_job_unique UNIQUE (user_id, job_id)
);

-- 5. Status History
CREATE TABLE status_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL
        REFERENCES applications(id) ON DELETE CASCADE,

    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

-- 6. Interviews
CREATE TABLE interviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    application_id BIGINT NOT NULL
        REFERENCES applications(id) ON DELETE CASCADE,

    interview_round VARCHAR(100) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    interview_type VARCHAR(50),
    meeting_url TEXT,
    notes TEXT,
    outcome VARCHAR(50),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Initial indexes for common queries
CREATE INDEX idx_companies_user_id
    ON companies(user_id);

CREATE INDEX idx_jobs_company_id
    ON jobs(company_id);

CREATE INDEX idx_applications_user_status
    ON applications(user_id, status);

CREATE INDEX idx_applications_follow_up
    ON applications(follow_up_at);

CREATE INDEX idx_status_history_application
    ON status_history(application_id, changed_at DESC);

CREATE INDEX idx_interviews_application
    ON interviews(application_id);

CREATE INDEX idx_interviews_scheduled_at
    ON interviews(scheduled_at);
