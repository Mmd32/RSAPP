import pg from 'pg';
import { logger } from '../logger.js';
import { CorrectiveAction, ActionAuditLog } from '../types/actions.js';
import { DataStore, VisitFilter, StoredPhoto, PhotoMetadata, StoredUser } from './types.js';
import { DOCUMENT_STORE_SCHEMA } from './schema.js';

const { Pool } = pg;

const DEFAULT_TENANT = 'org_retail_holding';

const SEED_ORGANIZATION = {
  id: DEFAULT_TENANT,
  name: 'هلدینگ ریتیل سلوشنز',
  code: 'RS_HOLDING',
  brands: ['ZARA', 'LC Waikiki', 'کوروش مال', 'مانگو'],
  isActive: true,
  createdAt: new Date().toISOString(),
};

/** Postgres rejects timestamps it cannot parse; treat anything odd as null. */
function toTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * PostgreSQL-backed store, used whenever DATABASE_URL is set.
 *
 * Each entity is stored as a JSONB document with the filterable fields lifted
 * into columns, so nothing the frontend sends is lost on a round trip. Managed
 * providers (Neon, Supabase, Render) require TLS, which is enabled by default
 * and can be turned off with PGSSL=disable for a local server.
 */
export class PostgresDataStore implements DataStore {
  readonly name = 'postgres';
  private pool: pg.Pool;

  constructor(connectionString: string) {
    const sslDisabled =
      process.env.PGSSL === 'disable' ||
      /[?&]sslmode=disable/.test(connectionString) ||
      /localhost|127\.0\.0\.1/.test(connectionString);

    this.pool = new Pool({
      connectionString,
      // Managed providers terminate TLS with certificates this process has no
      // root for; the connection is still encrypted.
      ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.PGPOOL_MAX) || 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });

    this.pool.on('error', (err) => {
      // Idle client dropped by the provider; the pool replaces it on next use.
      logger.error('Postgres pool error', err);
    });
  }

  async init(): Promise<void> {
    await this.pool.query(DOCUMENT_STORE_SCHEMA);

    // Guarantee the default tenant exists so the app has somewhere to write.
    await this.pool.query(
      `INSERT INTO organizations (id, doc) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
      [SEED_ORGANIZATION.id, SEED_ORGANIZATION]
    );

    const { rows } = await this.pool.query('SELECT current_database() AS db');
    logger.info('Connected to PostgreSQL', { database: rows[0]?.db });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  // --- visits --------------------------------------------------------------

  async listVisits(filter: VisitFilter = {}): Promise<any[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filter.tenantId) {
      params.push(filter.tenantId);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (filter.brandName) {
      params.push(filter.brandName);
      conditions.push(`brand_name = $${params.length}`);
    }
    if (filter.branchName) {
      params.push(filter.branchName);
      conditions.push(`branch_name = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query(
      `SELECT doc FROM visits ${where} ORDER BY started_at NULLS LAST, created_at`
    , params);
    return rows.map((r) => r.doc);
  }

  async getVisit(id: string): Promise<any | null> {
    const { rows } = await this.pool.query('SELECT doc FROM visits WHERE id = $1', [id]);
    return rows[0]?.doc ?? null;
  }

  async saveVisit(visit: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO visits (id, tenant_id, brand_name, branch_name, started_at, doc)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         brand_name = EXCLUDED.brand_name,
         branch_name = EXCLUDED.branch_name,
         started_at = EXCLUDED.started_at,
         doc = EXCLUDED.doc,
         updated_at = now()`,
      [
        visit.id,
        visit.tenantId || DEFAULT_TENANT,
        visit.brandName ?? null,
        visit.branchName ?? null,
        toTimestamp(visit.startedAt),
        visit,
      ]
    );
  }

  async countVisits(): Promise<number> {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM visits');
    return rows[0].n;
  }

  // --- stores --------------------------------------------------------------

  async listStores(): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT doc FROM stores ORDER BY updated_at DESC');
    return rows.map((r) => r.doc);
  }

  async saveStore(store: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO stores (id, brand_name, branch_name, doc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         brand_name = EXCLUDED.brand_name,
         branch_name = EXCLUDED.branch_name,
         doc = EXCLUDED.doc,
         updated_at = now()`,
      [store.id, store.brandName ?? null, store.branchName ?? null, store]
    );
  }

  async deleteStore(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM stores WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  // --- organizations -------------------------------------------------------

  async listOrganizations(): Promise<any[]> {
    const { rows } = await this.pool.query('SELECT doc FROM organizations ORDER BY created_at');
    return rows.map((r) => r.doc);
  }

  async saveOrganization(organization: any): Promise<void> {
    await this.pool.query(
      `INSERT INTO organizations (id, doc) VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET doc = EXCLUDED.doc, updated_at = now()`,
      [organization.id, organization]
    );
  }

  // --- corrective actions --------------------------------------------------

  async listActions(tenantId?: string): Promise<CorrectiveAction[]> {
    const { rows } = tenantId
      ? await this.pool.query(
          'SELECT doc FROM corrective_actions WHERE tenant_id = $1 ORDER BY created_at DESC',
          [tenantId]
        )
      : await this.pool.query('SELECT doc FROM corrective_actions ORDER BY created_at DESC');
    return rows.map((r) => r.doc as CorrectiveAction);
  }

  async getAction(id: string): Promise<CorrectiveAction | null> {
    const { rows } = await this.pool.query('SELECT doc FROM corrective_actions WHERE id = $1', [id]);
    return (rows[0]?.doc as CorrectiveAction) ?? null;
  }

  async saveAction(action: CorrectiveAction): Promise<void> {
    await this.pool.query(
      `INSERT INTO corrective_actions
         (id, tenant_id, status, priority, brand_name, branch_name, owner_name, department, due_date, doc, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, now()))
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         status = EXCLUDED.status,
         priority = EXCLUDED.priority,
         brand_name = EXCLUDED.brand_name,
         branch_name = EXCLUDED.branch_name,
         owner_name = EXCLUDED.owner_name,
         department = EXCLUDED.department,
         due_date = EXCLUDED.due_date,
         doc = EXCLUDED.doc,
         updated_at = now()`,
      [
        action.id,
        action.tenantId || DEFAULT_TENANT,
        action.status ?? null,
        action.priority ?? null,
        action.brandName ?? null,
        action.branchName ?? null,
        action.owner ?? null,
        action.department ?? null,
        toTimestamp(action.dueDate),
        action,
        toTimestamp(action.createdAt),
      ]
    );
  }

  async countActions(): Promise<number> {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM corrective_actions');
    return rows[0].n;
  }

  // --- audit logs ----------------------------------------------------------

  async listAuditLogs(actionId: string): Promise<ActionAuditLog[]> {
    const { rows } = await this.pool.query(
      'SELECT doc FROM action_audit_logs WHERE action_id = $1 ORDER BY created_at',
      [actionId]
    );
    return rows.map((r) => r.doc as ActionAuditLog);
  }

  // --- users ---------------------------------------------------------------

  async listUsers(tenantId?: string): Promise<StoredUser[]> {
    const { rows } = tenantId
      ? await this.pool.query('SELECT doc FROM users WHERE tenant_id = $1 ORDER BY created_at', [tenantId])
      : await this.pool.query('SELECT doc FROM users ORDER BY created_at');
    return rows.map((r) => r.doc);
  }

  async getUser(id: string): Promise<StoredUser | null> {
    const { rows } = await this.pool.query('SELECT doc FROM users WHERE id = $1', [id]);
    return rows[0]?.doc ?? null;
  }

  async getUserByEmail(email: string): Promise<StoredUser | null> {
    const { rows } = await this.pool.query('SELECT doc FROM users WHERE email = $1', [
      email.trim().toLowerCase(),
    ]);
    return rows[0]?.doc ?? null;
  }

  async saveUser(user: StoredUser): Promise<void> {
    await this.pool.query(
      `INSERT INTO users (id, tenant_id, email, doc)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         tenant_id = EXCLUDED.tenant_id,
         email = EXCLUDED.email,
         doc = EXCLUDED.doc,
         updated_at = now()`,
      [user.id, user.tenantId, user.email.trim().toLowerCase(), user]
    );
  }

  async countUsers(): Promise<number> {
    const { rows } = await this.pool.query('SELECT count(*)::int AS n FROM users');
    return rows[0].n;
  }

  // --- settings ------------------------------------------------------------

  async getSetting(key: string): Promise<string | null> {
    const { rows } = await this.pool.query('SELECT value FROM app_settings WHERE key = $1', [key]);
    return rows[0]?.value ?? null;
  }

  async setSettingIfAbsent(key: string, value: string): Promise<string> {
    await this.pool.query(
      'INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
    return (await this.getSetting(key)) as string;
  }

  // --- evidence photos ------------------------------------------------------

  async savePhoto(photo: StoredPhoto): Promise<PhotoMetadata> {
    await this.pool.query(
      `INSERT INTO evidence_photos
         (id, tenant_id, visit_id, indicator_code, mime_type, size_bytes, data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()))
       ON CONFLICT (id) DO NOTHING`,
      [
        photo.id,
        photo.tenantId,
        photo.visitId ?? null,
        photo.indicatorCode ?? null,
        photo.mimeType,
        photo.sizeBytes,
        photo.data,
        toTimestamp(photo.createdAt),
      ]
    );
    const { data, ...meta } = photo;
    return meta;
  }

  async getPhoto(id: string): Promise<StoredPhoto | null> {
    const { rows } = await this.pool.query(
      `SELECT id, tenant_id, visit_id, indicator_code, mime_type, size_bytes, data, created_at
       FROM evidence_photos WHERE id = $1`,
      [id]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      tenantId: row.tenant_id,
      visitId: row.visit_id ?? undefined,
      indicatorCode: row.indicator_code ?? undefined,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      data: row.data as Buffer,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async deletePhoto(id: string): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM evidence_photos WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async appendAuditLog(log: ActionAuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO action_audit_logs (id, action_id, doc, created_at)
       VALUES ($1, $2, $3, COALESCE($4, now()))
       ON CONFLICT (id) DO NOTHING`,
      [log.id, log.actionId, log, toTimestamp(log.timestamp)]
    );
  }
}
