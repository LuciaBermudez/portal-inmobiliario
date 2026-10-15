
BEGIN;

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE schema_migrations (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE agencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(160) NOT NULL,
    slug VARCHAR(180) NOT NULL UNIQUE,
    description TEXT,
    contact_email VARCHAR(254),
    phone VARCHAR(30),
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(254) NOT NULL,
    name VARCHAR(120) NOT NULL,
    password_hash TEXT NOT NULL,
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('admin', 'seller', 'client')),
    agency_id UUID REFERENCES agencies(id) ON DELETE RESTRICT,
    phone VARCHAR(30),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (agency_id IS NULL OR role = 'seller')
);

CREATE UNIQUE INDEX users_email_lower_uq
    ON users (LOWER(email));

CREATE INDEX users_agency_idx ON users (agency_id);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_hash CHAR(64),
    CHECK (expires_at > created_at)
);

CREATE INDEX sessions_user_active_idx
    ON sessions (user_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    replaced_by_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    CHECK (expires_at > created_at)
);

CREATE INDEX refresh_tokens_session_idx
    ON refresh_tokens (session_id);

CREATE TABLE import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    file_sha256 CHAR(64),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN (
            'queued', 'processing', 'completed', 'failed', 'cancelled'
        )),
    total_rows INTEGER NOT NULL DEFAULT 0 CHECK (total_rows >= 0),
    processed_rows INTEGER NOT NULL DEFAULT 0 CHECK (processed_rows >= 0),
    success_rows INTEGER NOT NULL DEFAULT 0 CHECK (success_rows >= 0),
    error_rows INTEGER NOT NULL DEFAULT 0 CHECK (error_rows >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    CHECK (processed_rows = success_rows + error_rows),
    CHECK (processed_rows <= total_rows)
);

CREATE INDEX import_jobs_creator_idx
    ON import_jobs (created_by, created_at DESC);

CREATE TABLE properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    agency_id UUID REFERENCES agencies(id) ON DELETE RESTRICT,
    source_import_job_id UUID
        REFERENCES import_jobs(id) ON DELETE RESTRICT,
    source_row_number INTEGER,

    title VARCHAR(180) NOT NULL,
    description TEXT NOT NULL,

    property_type VARCHAR(30) NOT NULL
        CHECK (property_type IN (
            'apartment', 'house', 'land', 'commercial',
            'office', 'warehouse', 'other'
        )),
    operation VARCHAR(10) NOT NULL CHECK (operation IN ('sale', 'rent')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
        CHECK (status IN (
            'draft', 'published', 'paused', 'sold', 'rented', 'archived'
        )),

    price NUMERIC(14,2) NOT NULL CHECK (price > 0),
    currency CHAR(3) NOT NULL DEFAULT 'COP'
        CHECK (currency IN ('COP', 'USD')),

    bedrooms SMALLINT CHECK (bedrooms >= 0),
    bathrooms NUMERIC(4,1) CHECK (bathrooms >= 0),
    area_m2 NUMERIC(12,2) CHECK (area_m2 > 0),
    built_area_m2 NUMERIC(12,2) CHECK (built_area_m2 > 0),
    parking_spaces SMALLINT CHECK (parking_spaces >= 0),

    address_line VARCHAR(255),
    neighborhood VARCHAR(120),
    city VARCHAR(120),
    department VARCHAR(120),
    postal_code VARCHAR(20),

    location GEOGRAPHY(POINT, 4326),

    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (LENGTH(BTRIM(title)) > 0),
    CHECK (
        (source_import_job_id IS NULL AND source_row_number IS NULL)
        OR
        (source_import_job_id IS NOT NULL AND source_row_number > 0)
    ),
    CHECK (
        status <> 'published'
        OR (
            location IS NOT NULL
            AND address_line IS NOT NULL
            AND city IS NOT NULL
            AND department IS NOT NULL
        )
    )
);

CREATE INDEX properties_owner_idx ON properties (owner_id);
CREATE INDEX properties_agency_idx ON properties (agency_id);

CREATE INDEX properties_catalog_idx
    ON properties (operation, city, price)
    WHERE status = 'published';

CREATE INDEX properties_location_gix
    ON properties USING GIST (location)
    WHERE location IS NOT NULL;

CREATE UNIQUE INDEX properties_import_row_uq
    ON properties (source_import_job_id, source_row_number)
    WHERE source_import_job_id IS NOT NULL;

CREATE TABLE property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL
        REFERENCES properties(id) ON DELETE CASCADE,
    storage_key TEXT NOT NULL UNIQUE,
    alt_text VARCHAR(255),
    position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (property_id, position)
);

CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_job_id UUID NOT NULL
        REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL CHECK (row_number > 0),
    field_name VARCHAR(120),
    error_code VARCHAR(80) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX import_errors_job_row_idx
    ON import_errors (import_job_id, row_number);

INSERT INTO schema_migrations (version)
VALUES ('001_initial_schema');

COMMIT;
