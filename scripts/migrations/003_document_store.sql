-- ============================================================================
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
