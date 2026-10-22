/**
 * PostgreSQL schema, applied on every start. Idempotent.
 *
 * Kept as a TypeScript module rather than a .sql file on disk: serverless
 * bundlers ship only the JavaScript they can trace through imports, so a
 * runtime `readFileSync` of a .sql file is the first thing to break on Vercel.
 */
export const DOCUMENT_STORE_SCHEMA = `-- ============================================================================
-- RSAPP — PostgreSQL document store
-- ============================================================================
-- The API exchanges whole entities with the frontend (a visit carries its full
-- indicator list, responses and analytics), so each table keeps the entity as a
-- JSONB document and lifts out only the columns the API filters or sorts on.
-- That keeps reads and writes lossless while still being indexable.
--
-- Idempotent: the server runs this on every boot.
-- ============================================================================

CREATE TABLE IF NOT EXISTS organizations (
    id          TEXT PRIMARY KEY,
    doc         JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stores (
    id           TEXT PRIMARY KEY,
    brand_name   TEXT,
    branch_name  TEXT,
    doc          JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stores_brand_branch ON stores (brand_name, branch_name);

CREATE TABLE IF NOT EXISTS visits (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL DEFAULT 'org_retail_holding',
    brand_name   TEXT,
    branch_name  TEXT,
    started_at   TIMESTAMPTZ,
    doc          JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_tenant ON visits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_visits_branch ON visits (branch_name);
CREATE INDEX IF NOT EXISTS idx_visits_started_at ON visits (started_at);

CREATE TABLE IF NOT EXISTS corrective_actions (
    id           TEXT PRIMARY KEY,
    tenant_id    TEXT NOT NULL DEFAULT 'org_retail_holding',
    status       TEXT,
    priority     TEXT,
    brand_name   TEXT,
    branch_name  TEXT,
    owner_name   TEXT,
    department   TEXT,
    due_date     TIMESTAMPTZ,
    doc          JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_actions_tenant ON corrective_actions (tenant_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON corrective_actions (status);
CREATE INDEX IF NOT EXISTS idx_actions_priority ON corrective_actions (priority);
CREATE INDEX IF NOT EXISTS idx_actions_branch ON corrective_actions (branch_name);
CREATE INDEX IF NOT EXISTS idx_actions_due_date ON corrective_actions (due_date);

-- Append-only history. Deliberately has no foreign key to corrective_actions:
-- the audit trail must outlive the row it describes.
CREATE TABLE IF NOT EXISTS action_audit_logs (
    id          TEXT PRIMARY KEY,
    action_id   TEXT NOT NULL,
    doc         JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_action_id ON action_audit_logs (action_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON action_audit_logs (created_at);


-- Evidence photos. Kept out of the visit document so that a questionnaire
-- sync, which re-sends the whole document, never re-uploads image data.
CREATE TABLE IF NOT EXISTS evidence_photos (
    id              TEXT PRIMARY KEY,
    tenant_id       TEXT NOT NULL DEFAULT 'org_retail_holding',
    visit_id        TEXT,
    indicator_code  TEXT,
    mime_type       TEXT NOT NULL,
    size_bytes      INTEGER NOT NULL,
    data            BYTEA NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_photos_visit ON evidence_photos (visit_id);
CREATE INDEX IF NOT EXISTS idx_photos_tenant ON evidence_photos (tenant_id);

-- Login accounts. The email is lifted out lower-cased so it can be unique
-- regardless of how it was typed; the password lives in doc as a scrypt hash.
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    tenant_id   TEXT NOT NULL,
    email       TEXT NOT NULL,
    doc         JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users (tenant_id);

-- Hand edits of indicator wording and auditor notes, one row per indicator.
CREATE TABLE IF NOT EXISTS indicator_overrides (
    tenant_id     TEXT NOT NULL,
    indicator_id  TEXT NOT NULL,
    doc           JSONB NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, indicator_id)
);

-- Indicators added by hand in the question bank.
CREATE TABLE IF NOT EXISTS custom_indicators (
    tenant_id     TEXT NOT NULL,
    indicator_id  TEXT NOT NULL,
    doc           JSONB NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, indicator_id)
);

-- Small server-side key/value settings, e.g. the session signing key.
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;
