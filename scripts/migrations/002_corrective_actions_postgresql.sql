-- ============================================================================
-- RSAPP PROMPT 4: POSTGRESQL PRODUCTION MIGRATION
-- Continuous Improvement, Corrective Actions & Multi-Tenant Isolation
-- ============================================================================

BEGIN;

-- 1. Organizations / Tenants
CREATE TABLE IF NOT EXISTS organizations (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(64) UNIQUE NOT NULL,
    brands JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Corrective Actions Entity
CREATE TABLE IF NOT EXISTS corrective_actions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    finding_id VARCHAR(64) NOT NULL,
    indicator_code VARCHAR(32) NOT NULL,
    visit_id VARCHAR(64) NOT NULL,
    branch_id VARCHAR(64) NOT NULL,
    branch_name VARCHAR(255) NOT NULL,
    brand_name VARCHAR(255) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(30) NOT NULL CHECK (status IN ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING_REVIEW', 'RESOLVED', 'VERIFIED', 'REOPENED', 'CANCELLED')),
    owner VARCHAR(255),
    department VARCHAR(50) NOT NULL CHECK (department IN ('Branch Manager', 'Operations', 'Maintenance', 'Marketing', 'HR', 'IT', 'Other')),
    due_date TIMESTAMPTZ NOT NULL,
    root_cause VARCHAR(30) CHECK (root_cause IN ('PROCESS', 'PEOPLE', 'EQUIPMENT', 'FACILITY', 'TRAINING', 'POLICY', 'TECHNOLOGY', 'OTHER')),
    resolution_note TEXT,
    completion_date TIMESTAMPTZ,
    verified_by VARCHAR(255),
    verified_at TIMESTAMPTZ,
    verification_note TEXT,
    reopen_count INT NOT NULL DEFAULT 0,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for Corrective Actions
CREATE INDEX IF NOT EXISTS idx_corrective_actions_tenant ON corrective_actions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_status ON corrective_actions(status);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_priority ON corrective_actions(priority);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_branch ON corrective_actions(branch_id);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_indicator ON corrective_actions(indicator_code);
CREATE INDEX IF NOT EXISTS idx_corrective_actions_due_date ON corrective_actions(due_date);

-- 3. Action Evidence Photos (Before & After)
CREATE TABLE IF NOT EXISTS action_evidence_photos (
    id VARCHAR(64) PRIMARY KEY,
    action_id VARCHAR(64) NOT NULL REFERENCES corrective_actions(id) ON DELETE CASCADE,
    photo_type VARCHAR(10) NOT NULL CHECK (photo_type IN ('BEFORE', 'AFTER')),
    url TEXT NOT NULL,
    caption TEXT,
    storage_key VARCHAR(512),
    mime_type VARCHAR(100),
    file_size_bytes BIGINT,
    uploaded_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_evidence_action_id ON action_evidence_photos(action_id);

-- 4. Action Audit Log (Immutable State History)
CREATE TABLE IF NOT EXISTS action_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    action_id VARCHAR(64) NOT NULL REFERENCES corrective_actions(id) ON DELETE CASCADE,
    who VARCHAR(255) NOT NULL,
    user_role VARCHAR(50) NOT NULL,
    what VARCHAR(255) NOT NULL,
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_action_audit_action_id ON action_audit_logs(action_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_created_at ON action_audit_logs(created_at);

-- 5. Row-Level Security (RLS) for Tenant Isolation
ALTER TABLE corrective_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_evidence_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select/modify records where tenant_id matches current tenant session variable
CREATE POLICY tenant_isolation_corrective_actions ON corrective_actions
    FOR ALL
    USING (tenant_id = CURRENT_SETTING('app.current_tenant_id', true));

COMMIT;
