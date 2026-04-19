-- ════════════════════════════════════════════
-- TraceNow — PostgreSQL + PostGIS Schema
-- ════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for text search on child name

-- ────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone           VARCHAR(20) UNIQUE NOT NULL,
    name            VARCHAR(120),
    role            VARCHAR(20) NOT NULL DEFAULT 'citizen'  -- citizen | authority | admin
                    CHECK (role IN ('citizen', 'authority', 'admin')),
    fcm_token       TEXT,
    location        GEOGRAPHY(POINT, 4326),            -- current lat/lng (updated by app)
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_location  ON users USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_users_phone     ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users (role);

-- ────────────────────────────────────────────
-- AUTHORITIES (extended profile for police/admin)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS authorities (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_number    VARCHAR(50) UNIQUE,
    department      VARCHAR(120),
    verified        BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- CASES (missing child reports)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id     UUID NOT NULL REFERENCES users(id),
    child_name      VARCHAR(120) NOT NULL,
    child_age       SMALLINT NOT NULL CHECK (child_age BETWEEN 0 AND 18),
    description     TEXT,
    last_seen_at    TIMESTAMPTZ NOT NULL,
    last_seen_loc   GEOGRAPHY(POINT, 4326) NOT NULL,
    last_seen_addr  TEXT,
    image_url       TEXT,                               -- S3 signed URL
    embedding_id    UUID,                               -- FK to embeddings table
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'investigating', 'found_safe', 'closed')),
    alert_radius_km FLOAT NOT NULL DEFAULT 5.0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_status       ON cases (status);
CREATE INDEX IF NOT EXISTS idx_cases_last_seen    ON cases USING GIST (last_seen_loc);
CREATE INDEX IF NOT EXISTS idx_cases_reporter     ON cases (reporter_id);
CREATE INDEX IF NOT EXISTS idx_cases_child_name   ON cases USING GIN (child_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_cases_created_at   ON cases (created_at DESC);

-- ────────────────────────────────────────────
-- FACE EMBEDDINGS (metadata; vectors in FAISS)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
    sighting_id     UUID,                               -- set after sightings table created
    embedding_type  VARCHAR(20) NOT NULL                -- 'case' | 'sighting'
                    CHECK (embedding_type IN ('case', 'sighting')),
    faiss_index     INTEGER UNIQUE NOT NULL,            -- position in FAISS flat index
    model           VARCHAR(50) NOT NULL DEFAULT 'facenet',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────
-- SIGHTINGS (citizen uploads)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sightings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    uploader_id     UUID NOT NULL REFERENCES users(id),
    location        GEOGRAPHY(POINT, 4326),
    address         TEXT,
    image_url       TEXT,
    embedding_id    UUID REFERENCES embeddings(id),
    confidence      FLOAT CHECK (confidence BETWEEN 0 AND 1),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sightings_case      ON sightings (case_id);
CREATE INDEX IF NOT EXISTS idx_sightings_location  ON sightings USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_sightings_confidence ON sightings (confidence DESC);

-- Back-fill FK on embeddings
ALTER TABLE embeddings
    ADD CONSTRAINT fk_embeddings_sighting
    FOREIGN KEY (sighting_id) REFERENCES sightings(id) ON DELETE CASCADE
    DEFERRABLE INITIALLY DEFERRED;

-- ────────────────────────────────────────────
-- ALERTS (records which users were notified)
-- ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alerts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel         VARCHAR(20) NOT NULL DEFAULT 'fcm'
                    CHECK (channel IN ('fcm', 'websocket', 'both')),
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (case_id, user_id)                          -- prevent duplicate alerts
);

CREATE INDEX IF NOT EXISTS idx_alerts_case     ON alerts (case_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user     ON alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_sent_at  ON alerts (sent_at DESC);

-- ────────────────────────────────────────────
-- HELPER: update updated_at on row change
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_cases_updated_at
    BEFORE UPDATE ON cases
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────
-- HELPER: geo query function (ST_DWithin)
-- Usage: SELECT * FROM users_within_radius(lng, lat, radius_km)
-- ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION users_within_radius(
    p_lng     FLOAT,
    p_lat     FLOAT,
    p_radius  FLOAT   -- kilometres
)
RETURNS TABLE (
    user_id   UUID,
    phone     VARCHAR,
    fcm_token TEXT,
    distance  FLOAT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        u.id,
        u.phone,
        u.fcm_token,
        ST_Distance(
            u.location::GEOGRAPHY,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY
        ) / 1000.0 AS distance
    FROM users u
    WHERE
        u.is_active = TRUE
        AND u.fcm_token IS NOT NULL
        AND u.location IS NOT NULL
        AND ST_DWithin(
            u.location::GEOGRAPHY,
            ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY,
            p_radius * 1000   -- convert km to metres
        )
    ORDER BY distance ASC;
END;
$$ LANGUAGE plpgsql;
