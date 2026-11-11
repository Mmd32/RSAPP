import express, { Request, Response, NextFunction, RequestHandler } from 'express';
import cors, { CorsOptions } from 'cors';
import fs from 'fs';
import path from 'path';
import { logger } from './logger.js';
import {
  ALLOWED_ORIGINS,
  CLIENT_DIST_DIR,
  DATA_DIR,
  HOST,
  PORT,
  SERVE_CLIENT,
  dataPath,
  ensureDir,
} from './config.js';
import { defaultStorageProvider } from './storage/storageProvider.js';
import { createDataStore, DataStore } from './store/index.js';
import { registerAuthRoutes, requireAuth, requirePermission } from './auth/routes.js';
import { hasPermission } from '../../src/auth/permissions.js';
import {
  CorrectiveAction,
  ActionAuditLog,
  UserRole,
} from './types/actions.js';
import {
  calculateVisitSummary,
  DEFAULT_CONSULTING_PROFILE,
  SCORING_PROFILES_REGISTRY,
} from '../../src/engine/scoringEngine.js';

const DEFAULT_TENANT = 'org_retail_holding';
const CATALOG_PATH = dataPath('catalog.json');

ensureDir(DATA_DIR);

const app = express();
// Behind Vercel/Render's proxy: trust X-Forwarded-* so req.ip and req.secure
// (used for rate limiting and the Secure cookie flag) are the client's.
app.set('trust proxy', 1);

// Same-origin deployments need no allowlist; set ALLOWED_ORIGINS once the
// frontend is served from a different domain than the API.
const corsOptions: CorsOptions =
  ALLOWED_ORIGINS.length > 0
    ? {
        origin: (origin, callback) => {
          // Non-browser callers (curl, health checks) send no Origin header.
          if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
          }
          logger.security('Blocked cross-origin request', { origin });
          return callback(new Error('Origin not allowed by CORS policy'));
        },
        credentials: true,
      }
    : {};

app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`HTTP ${req.method} ${req.path}`, {
      status: res.statusCode,
      durationMs: Date.now() - start,
      tenantId: req.user?.tenantId || '-',
      userId: req.user?.id || '-',
      userRole: req.user?.role || '-',
    });
  });
  next();
});

/**
 * Express 4 does not forward rejected promises to the error handler, so every
 * async route is wrapped: a failed query returns 500 instead of hanging.
 */
function route(handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

// Identity always comes from the signed session (requireAuth), never from
// request headers: those used to be sent by the browser and could be forged.
const tenantOf = (req: Request): string => req.user?.tenantId || DEFAULT_TENANT;
const roleOf = (req: Request): UserRole => (req.user?.role as UserRole) || 'Evaluator';
const userOf = (req: Request): string => req.user?.name || 'کاربر';


/** Whether the signed-in user may read a visit. */
function canSeeVisit(req: Request, visit: any): boolean {
  const user = req.user!;
  if ((visit.tenantId || DEFAULT_TENANT) !== user.tenantId) return false;
  if (hasPermission(user, 'visits.viewAll') || hasPermission(user, 'visits.review')) return true;
  // Everyone else sees their own questionnaires only.
  return visit.evaluatorId ? visit.evaluatorId === user.id : visit.auditorName === user.name;
}

/**
 * Who may write a visit, and into which status. Returns null when allowed.
 *
 * - Evaluators write their own questionnaire while it is in progress (or sent
 *   back to them), and may submit it; after that it is locked for them.
 * - Supervisors and admins may also approve or return a *submitted* visit.
 * - Other roles only read visits.
 */
function visitWriteProblem(
  req: Request,
  existing: any | null,
  nextStatus: string
): { status: number; error: string; code: string } | null {
  const user = req.user!;
  const isReviewer = hasPermission(user, 'visits.review');
  if (!hasPermission(user, 'visits.fill') && !isReviewer) {
    return { status: 403, error: 'شما دسترسی ثبت پرسشنامه ندارید.', code: 'FORBIDDEN' };
  }
  if (existing && !canSeeVisit(req, existing)) {
    return { status: 403, error: 'این پرسشنامه متعلق به کاربر دیگری است.', code: 'FORBIDDEN' };
  }
  const current = existing?.status;
  if (nextStatus === 'APPROVED' || nextStatus === 'REVISION_REQUESTED') {
    if (nextStatus === current) {
      if (!isReviewer && nextStatus === 'APPROVED') {
        return { status: 409, error: 'این پرسشنامه تأیید شده و قابل ویرایش نیست.', code: 'LOCKED' };
      }
      return null; // re-saving the same state
    }
    if (!isReviewer) {
      return { status: 403, error: 'تأیید یا بازگرداندن پرسشنامه فقط با سرپرست است.', code: 'FORBIDDEN' };
    }
    if (current !== 'SUBMITTED') {
      return { status: 409, error: 'فقط پرسشنامهٔ ارسال‌شده قابل تأیید یا بازگرداندن است.', code: 'INVALID_TRANSITION' };
    }
    return null;
  }
  // IN_PROGRESS or SUBMITTED from here on.
  if (!isReviewer && (current === 'SUBMITTED' || current === 'APPROVED')) {
    return { status: 409, error: 'این پرسشنامه ارسال شده و دیگر قابل ویرایش نیست.', code: 'LOCKED' };
  }
  return null;
}

/** Loads an action of the user's own tenant; anything else reads as missing. */
async function actionFor(req: Request): Promise<CorrectiveAction | null> {
  const action = await store.getAction(req.params.id);
  return action && (action.tenantId || DEFAULT_TENANT) === tenantOf(req) ? action : null;
}

let catalog: any = null;

try {
  if (fs.existsSync(CATALOG_PATH)) {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    console.log(`Loaded catalog with ${catalog.indicators.length} indicators.`);
  }
} catch (e) {
  logger.error('Error loading catalog', e);
}

// Assigned before any route runs, by the middleware below. A serverless
// instance cannot initialise at boot the way a long-running process does, so
// the store is created once per process on the first request and reused.
let store: DataStore;
let storePromise: Promise<DataStore> | null = null;

function getStore(): Promise<DataStore> {
  if (!storePromise) {
    storePromise = createDataStore().catch((e) => {
      // Do not cache the failure: the next request should retry, since a
      // managed database may simply have been waking up.
      storePromise = null;
      throw e;
    });
  }
  return storePromise;
}

/**
 * Diagnostics endpoint. Registered before the store middleware so it still
 * answers when the database is unreachable, and reports why rather than
 * failing — without echoing the connection string, since this is public.
 */
app.get('/api/health', async (req: Request, res: Response) => {
  const base = {
    timestamp: new Date().toISOString(),
    indicatorsCount: catalog?.indicators?.length || 0,
    storageConfigured: process.env.DATABASE_URL ? 'postgres' : 'json-files',
  };

  try {
    const active = await getStore();
    res.json({
      status: 'healthy',
      ...base,
      storage: active.name,
      visitsCount: await active.countVisits(),
      actionsCount: await active.countActions(),
    });
  } catch (e: any) {
    logger.error('Health check could not reach the data store', e);
    res.status(503).json({
      status: 'degraded',
      ...base,
      storage: 'unavailable',
      // A code such as ENOTFOUND or 28P01 says what is wrong without
      // disclosing host, user or password.
      errorCode: e?.code || e?.cause?.code || 'UNKNOWN',
    });
  }
});

app.use((req: Request, res: Response, next: NextFunction) => {
  getStore()
    .then((s) => {
      store = s;
      next();
    })
    .catch(next);
});

// Cookies ride along on cross-site form posts; SameSite=Lax stops most of
// that, and this closes the rest: a state-changing request from a page on
// another origin is refused.
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  let sameHost = false;
  try {
    sameHost = new URL(origin).host === req.headers.host;
  } catch {
    sameHost = false;
  }
  if (sameHost || ALLOWED_ORIGINS.includes(origin)) return next();
  logger.security('Blocked cross-origin write', { origin, path: req.path });
  res.status(403).json({ error: 'Cross-origin request refused.' });
});

registerAuthRoutes(app, () => store);

// Everything below requires a signed-in user.
const PUBLIC_API_PATHS = new Set(['/auth/status', '/auth/setup', '/auth/login', '/auth/logout']);
const authenticate = requireAuth(() => store);
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (PUBLIC_API_PATHS.has(req.path)) return next();
  authenticate(req, res, next);
});

// ----------------------------------------------------------------------------
// HEALTH & CATALOG
// ----------------------------------------------------------------------------
app.get('/api/catalog', (req: Request, res: Response) => {
  if (!catalog) {
    return res.status(500).json({ error: 'Catalog not loaded' });
  }
  res.json(catalog);
});

app.get('/api/indicators', (req: Request, res: Response) => {
  if (!catalog) {
    return res.status(500).json({ error: 'Catalog not loaded' });
  }

  const { template, businessType, group, search } = req.query;
  let result = catalog.indicators;

  if (template) {
    result = result.filter((i: any) => i.template === template);
  }
  if (businessType) {
    result = result.filter((i: any) =>
      i.applicableBusinessTypes?.includes(businessType as string)
    );
  }
  if (group) {
    result = result.filter((i: any) => i.group === group);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    result = result.filter(
      (i: any) =>
        i.code.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.statement.toLowerCase().includes(q)
    );
  }

  res.json({
    total: result.length,
    indicators: result,
  });
});

// ----------------------------------------------------------------------------
// ORGANIZATIONS & TENANTS (Requirement 25)
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// INDICATOR EDITS (wording and auditor notes)
// ----------------------------------------------------------------------------
const MAX_STATEMENT = 600;
const MAX_NOTE = 1200;

/** Marker row: the checklist file's indicators are all removed for this account (Restore deletes it). */
const CLEARED_ID = '__CATALOG_CLEARED__';
const catalogCleared = async (tenantId: string) =>
  (await store.listIndicatorOverrides(tenantId)).some((o) => o.indicatorId === CLEARED_ID);
/** Codes of the checklist file that still exist for this account. */
const liveCatalogCodes = async (tenantId: string): Promise<string[]> =>
  (await catalogCleared(tenantId)) ? [] : (catalog?.indicators || []).map((i: any) => i.code);

const catalogIndicator = (id: string): any | undefined =>
  catalog?.indicators?.find((i: any) => i.id === id);

/**
 * One-time moves to the store-format workbooks: a sector's checklist is now exactly its workbooks.
 * Rows of that sector added by hand or imported earlier (they would sit next to the workbook's rows as
 * duplicates) are removed, and the checklist is brought back if it had been cleared. Each move runs
 * once per account (a marker row records it); other sectors' hand-added rows are left alone.
 */
const FORMAT_MIGRATIONS = [
  { marker: '__FASHION_FORMATS_V1__', sector: 'Fashion' },
  { marker: '__FB_FORMATS_V1__', sector: 'F_B' },
];
const migrating = new Map<string, Promise<void>>();
const migrateToFormatWorkbooks = (tenantId: string): Promise<void> => {
  let job = migrating.get(tenantId);
  if (!job) {
    job = (async () => {
      for (const { marker, sector } of FORMAT_MIGRATIONS) {
        const overrides = await store.listIndicatorOverrides(tenantId);
        if (overrides.some((o) => o.indicatorId === marker)) continue;
        let removed = 0;
        for (const c of await store.listCustomIndicators(tenantId)) {
          if (c.template === 'STORE' && c.applicableBusinessTypes?.includes(sector)) {
            if (await store.deleteCustomIndicator(tenantId, c.id)) removed += 1;
          }
        }
        await store.deleteIndicatorOverride(tenantId, CLEARED_ID);
        await store.saveIndicatorOverride(tenantId, {
          indicatorId: marker,
          code: marker,
          disabled: false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
        logger.security('Format workbooks applied', { tenantId, sector, removedCustom: removed });
      }
    })().catch((e) => {
      migrating.delete(tenantId);
      throw e;
    });
    migrating.set(tenantId, job);
  }
  return job;
};
const isMigrationMarker = (id: string) => FORMAT_MIGRATIONS.some((m) => m.marker === id);

/** Everyone signed in reads the edits (a questionnaire is built from them); only catalog managers write. */
app.get(
  '/api/indicator-overrides',
  route(async (req, res) => {
    await migrateToFormatWorkbooks(tenantOf(req));
    res.json((await store.listIndicatorOverrides(tenantOf(req))).filter((o) => !isMigrationMarker(o.indicatorId)));
  })
);

app.put(
  '/api/indicator-overrides/:indicatorId',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const indicator = catalogIndicator(req.params.indicatorId);
    if (!indicator) return res.status(404).json({ error: 'شاخص پیدا نشد.' });

    const body = req.body || {};
    const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : undefined);
    const existing = (await store.listIndicatorOverrides(tenantOf(req))).find((o) => o.indicatorId === indicator.id);
    let statement = existing?.statement;
    let auditorNote = existing?.auditorNote;
    let disabled = existing?.disabled;
    if (body.disabled !== undefined) {
      if (typeof body.disabled !== 'boolean') return res.status(400).json({ error: 'وضعیت فعال بودن معتبر نیست.' });
      disabled = body.disabled ? true : undefined;
    }

    if (body.statement !== undefined) {
      const text = clean(body.statement);
      if (text === undefined || text.length < 3) return res.status(400).json({ error: 'متن شاخص باید دست‌کم ۳ نویسه باشد.' });
      if (text.length > MAX_STATEMENT) return res.status(400).json({ error: `متن شاخص حداکثر ${MAX_STATEMENT} نویسه است.` });
      statement = text;
    }
    if (body.auditorNote !== undefined) {
      const text = body.auditorNote === null ? '' : clean(body.auditorNote);
      if (text === undefined) return res.status(400).json({ error: 'نکتهٔ ارزیاب معتبر نیست.' });
      if (text.length > MAX_NOTE) return res.status(400).json({ error: `نکتهٔ ارزیاب حداکثر ${MAX_NOTE} نویسه است.` });
      auditorNote = text;
    }

    // A field equal to the workbook's own value is not an edit.
    if (statement !== undefined && statement === indicator.statement) statement = undefined;
    if (auditorNote !== undefined && auditorNote === (indicator.auditorNote || '')) auditorNote = undefined;

    if (statement === undefined && auditorNote === undefined && !disabled) {
      await store.deleteIndicatorOverride(tenantOf(req), indicator.id);
      return res.json({ override: null });
    }
    const override = {
      indicatorId: indicator.id,
      code: indicator.code,
      ...(statement !== undefined ? { statement } : {}),
      ...(auditorNote !== undefined ? { auditorNote } : {}),
      ...(disabled ? { disabled: true } : {}),
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.id,
      updatedByName: req.user!.name,
    };
    await store.saveIndicatorOverride(tenantOf(req), override);
    logger.security('Indicator edited', { by: req.user!.id, indicatorId: indicator.id, code: indicator.code });
    res.json({ override });
  })
);

app.delete(
  '/api/indicator-overrides/:indicatorId',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    await store.deleteIndicatorOverride(tenantOf(req), req.params.indicatorId);
    res.json({ override: null });
  })
);

// ----------------------------------------------------------------------------
// INDICATORS ADDED BY HAND
// ----------------------------------------------------------------------------
const STORE_ZONES = ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'];
const SECTOR_CODES = ['Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware', 'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services'];
const MALL_TYPE_CODES = ['SM', 'Neighborhood', 'Community', 'Regional', 'Super_Regional'];
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/;

const collapse = (v: unknown): string | undefined => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : undefined);
const majorityOf = (items: any[], field: string): string =>
  Object.entries(items.reduce((m: Record<string, number>, i: any) => ((m[i[field]] = (m[i[field]] || 0) + 1), m), {}))
    .sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || '';

/** The form orders questions by journey stage, so a new row takes the stage of the topic it joins (else of its zone). */
function legacyFields(template: string, group: string, subject: string) {
  const all: any[] = (catalog?.indicators || []).filter((i: any) => i.template === template);
  const sameTopic = all.filter((i) => i.subject === subject);
  const sameGroup = all.filter((i) => i.group === group);
  const donor = sameTopic.length ? sameTopic : sameGroup.length ? sameGroup : all;
  return { journeyStage: majorityOf(donor, 'journeyStage'), reportingDimension: majorityOf(donor, 'reportingDimension') };
}

/** Right after the last row of the same topic (else zone), so the question sits with its neighbours. */
function nextDisplayOrder(template: string, group: string, subject: string, customs: any[], selfId?: string): number {
  const rows: any[] = [...(catalog?.indicators || []), ...customs.filter((c) => c.id !== selfId)].filter((i) => i.template === template);
  const pick = (test: (i: any) => boolean) => rows.filter(test).map((i) => i.displayOrder);
  const near = pick((i) => i.subject === subject).length ? pick((i) => i.subject === subject) : pick((i) => i.group === group);
  const taken = new Set(rows.map((i) => i.displayOrder));
  let order = Math.round(((near.length ? Math.max(...near) : Math.max(0, ...rows.map((i) => i.displayOrder))) + 0.001) * 1000) / 1000;
  while (taken.has(order)) order = Math.round((order + 0.001) * 1000) / 1000;
  return order;
}

type Fields = Record<string, any>;

/** Validates a create or update body; returns the cleaned fields or an error message. */
function cleanCustomFields(body: Fields, template: string, partial: boolean): { fields?: Fields; error?: string } {
  const out: Fields = {};
  const has = (k: string) => body[k] !== undefined;
  if (!partial || has('group')) {
    const group = collapse(body.group);
    if (!group) return { error: 'منطقه یا گروه شاخص را مشخص کنید.' };
    if (template === 'STORE' && !STORE_ZONES.includes(group)) return { error: 'منطقه باید یکی از پنج منطقهٔ فروشگاه باشد.' };
    if (group.length > 80) return { error: 'نام گروه حداکثر ۸۰ نویسه است.' };
    out.group = group;
  }
  if (!partial || has('subject')) {
    const subject = collapse(body.subject);
    if (!subject || subject.length < 2) return { error: 'موضوع شاخص را بنویسید (دست‌کم ۲ نویسه).' };
    if (subject.length > 100) return { error: 'موضوع حداکثر ۱۰۰ نویسه است.' };
    out.subject = subject;
  }
  if (!partial || has('statement')) {
    const statement = collapse(body.statement);
    if (!statement || statement.length < 3) return { error: 'متن شاخص باید دست‌کم ۳ نویسه باشد.' };
    if (statement.length > MAX_STATEMENT) return { error: `متن شاخص حداکثر ${MAX_STATEMENT} نویسه است.` };
    out.statement = statement;
  }
  if (has('auditorNote')) {
    const note = body.auditorNote === null ? '' : collapse(body.auditorNote);
    if (note === undefined) return { error: 'نکتهٔ ارزیاب معتبر نیست.' };
    if (note.length > MAX_NOTE) return { error: `نکتهٔ ارزیاب حداکثر ${MAX_NOTE} نویسه است.` };
    out.auditorNote = note || undefined;
  }
  const list = (key: string, allowed: string[], label: string) => {
    if (partial && !has(key)) return null;
    const v = body[key];
    if (!Array.isArray(v) || v.some((x) => typeof x !== 'string' || !allowed.includes(x))) return `${label} معتبر نیست.`;
    out[key] = [...new Set(v as string[])];
    return null;
  };
  if (template === 'STORE') {
    const err = list('applicableBusinessTypes', SECTOR_CODES, 'فهرست سکتورها');
    if (err) return { error: err };
    if (!partial || has('applicableBusinessTypes')) {
      if (!out.applicableBusinessTypes?.length) return { error: 'دست‌کم یک سکتور را انتخاب کنید.' };
      out.applicableMallTypes = [];
    }
  } else {
    const err = list('applicableMallTypes', MALL_TYPE_CODES, 'فهرست نوع مرکز خرید');
    if (err) return { error: err };
    if (!partial || has('applicableMallTypes')) {
      if (!out.applicableMallTypes?.length) return { error: 'دست‌کم یک نوع مرکز خرید را انتخاب کنید.' };
      out.applicableBusinessTypes = [];
    }
  }
  for (const k of ['requiresPhoto', 'requiresComment']) {
    if (has(k)) {
      if (typeof body[k] !== 'boolean') return { error: 'گزینهٔ عکس یا توضیح معتبر نیست.' };
      out[k] = body[k];
    }
  }
  if (has('weight')) {
    const w = Number(body.weight);
    if (!Number.isFinite(w) || w < 0.5 || w > 5) return { error: 'وزن باید عددی بین ۰٫۵ و ۵ باشد.' };
    out.weight = Math.round(w * 10) / 10;
  }
  if (has('status')) {
    if (body.status !== 'ACTIVE' && body.status !== 'ARCHIVED') return { error: 'وضعیت معتبر نیست.' };
    out.status = body.status;
  }
  return { fields: out };
}

app.get(
  '/api/custom-indicators',
  route(async (req, res) => {
    await migrateToFormatWorkbooks(tenantOf(req));
    res.json(await store.listCustomIndicators(tenantOf(req)));
  })
);

app.post(
  '/api/custom-indicators',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const body = req.body || {};
    const template = body.template;
    if (template !== 'STORE' && template !== 'MALL') return res.status(400).json({ error: 'نوع ارزیابی (فروشگاه یا مرکز خرید) را مشخص کنید.' });
    const cleaned = cleanCustomFields(body, template, false);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    const f = cleaned.fields!;
    const customs = await store.listCustomIndicators(tenantOf(req));

    const taken = new Set([...(await liveCatalogCodes(tenantOf(req))), ...customs.map((c) => c.code)].map((c: string) => c.toLowerCase()));
    let code = collapse(body.code);
    if (code) {
      if (!CODE_PATTERN.test(code)) return res.status(400).json({ error: 'کد فقط حروف انگلیسی، عدد، خط تیره یا زیرخط و بین ۲ تا ۲۰ نویسه است.' });
      if (taken.has(code.toLowerCase())) return res.status(409).json({ error: 'این کد برای شاخص دیگری استفاده شده است.' });
    } else {
      let n = 1;
      while (taken.has(`u${String(n).padStart(3, '0')}`)) n += 1;
      code = `U${String(n).padStart(3, '0')}`;
    }

    const now = new Date().toISOString();
    const indicator = {
      id: `IND_CU_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      code,
      template,
      group: f.group,
      subject: f.subject,
      statement: f.statement,
      ...(f.auditorNote ? { auditorNote: f.auditorNote } : {}),
      applicableBusinessTypes: f.applicableBusinessTypes || [],
      applicableMallTypes: f.applicableMallTypes || [],
      requiresPhoto: f.requiresPhoto ?? false,
      requiresComment: f.requiresComment ?? false,
      weight: f.weight ?? 1,
      ...legacyFields(template, f.group, f.subject),
      displayOrder: nextDisplayOrder(template, f.group, f.subject, customs),
      status: (f.status as 'ACTIVE' | 'ARCHIVED') || 'ACTIVE',
      createdAt: now,
      createdBy: req.user!.id,
      createdByName: req.user!.name,
      updatedAt: now,
      updatedBy: req.user!.id,
      updatedByName: req.user!.name,
    };
    await store.saveCustomIndicator(tenantOf(req), indicator);
    logger.security('Indicator added', { by: req.user!.id, indicatorId: indicator.id, code });
    res.status(201).json(indicator);
  })
);

app.put(
  '/api/custom-indicators/:id',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const customs = await store.listCustomIndicators(tenantOf(req));
    const current = customs.find((c) => c.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'شاخص پیدا نشد.' });
    const body = req.body || {};
    const cleaned = cleanCustomFields(body, current.template, true);
    if (cleaned.error) return res.status(400).json({ error: cleaned.error });
    const f = cleaned.fields!;

    let code = current.code;
    if (body.code !== undefined) {
      const next = collapse(body.code) || '';
      if (!CODE_PATTERN.test(next)) return res.status(400).json({ error: 'کد فقط حروف انگلیسی، عدد، خط تیره یا زیرخط و بین ۲ تا ۲۰ نویسه است.' });
      const others = [...(await liveCatalogCodes(tenantOf(req))), ...customs.filter((c) => c.id !== current.id).map((c) => c.code)];
      if (others.some((c: string) => c.toLowerCase() === next.toLowerCase())) return res.status(409).json({ error: 'این کد برای شاخص دیگری استفاده شده است.' });
      code = next;
    }

    const updated: any = { ...current, ...f, code, updatedAt: new Date().toISOString(), updatedBy: req.user!.id, updatedByName: req.user!.name };
    if (f.auditorNote === undefined && body.auditorNote !== undefined) delete updated.auditorNote;
    if ((f.group && f.group !== current.group) || (f.subject && f.subject !== current.subject)) {
      Object.assign(updated, legacyFields(updated.template, updated.group, updated.subject));
      updated.displayOrder = nextDisplayOrder(updated.template, updated.group, updated.subject, customs, current.id);
    }
    await store.saveCustomIndicator(tenantOf(req), updated);
    logger.security('Indicator changed', { by: req.user!.id, indicatorId: current.id, code });
    res.json(updated);
  })
);

// Remove every indicator of the app: the ones added by hand are deleted, the checklist file's are switched off for good.
app.post(
  '/api/indicators/clear',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const tenantId = tenantOf(req);
    const customs = await store.listCustomIndicators(tenantId);
    for (const c of customs) await store.deleteCustomIndicator(tenantId, c.id);
    for (const o of await store.listIndicatorOverrides(tenantId)) await store.deleteIndicatorOverride(tenantId, o.indicatorId);
    await store.saveIndicatorOverride(tenantId, {
      indicatorId: CLEARED_ID,
      code: CLEARED_ID,
      disabled: true,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.id,
      updatedByName: req.user!.name,
    });
    logger.security('All indicators removed', { by: req.user!.id, custom: customs.length });
    res.json({ ok: true, removedCustom: customs.length });
  })
);

// Bring the checklist file's indicators back (the wording edits and hand-added indicators removed by "clear" stay gone).
app.post(
  '/api/indicators/restore',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    await store.deleteIndicatorOverride(tenantOf(req), CLEARED_ID);
    logger.security('Checklist restored', { by: req.user!.id });
    res.json({ ok: true });
  })
);

app.delete(
  '/api/custom-indicators/:id',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const removed = await store.deleteCustomIndicator(tenantOf(req), req.params.id);
    if (!removed) return res.status(404).json({ error: 'شاخص پیدا نشد.' });
    logger.security('Indicator removed', { by: req.user!.id, indicatorId: req.params.id });
    res.json({ ok: true });
  })
);

app.get(
  '/api/organizations',
  route(async (req, res) => {
    res.json(await store.listOrganizations());
  })
);

app.post(
  '/api/organizations',
  requirePermission('users.manage'),
  route(async (req, res) => {
    const { name, code, brands } = req.body;
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
    const organization = {
      id: `org_${Date.now()}`,
      name,
      code,
      brands: brands || [],
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    await store.saveOrganization(organization);
    res.status(201).json(organization);
  })
);

// ----------------------------------------------------------------------------
// BRANDS (businesses). A brand's branches are the stores directory entries that
// carry its name. Renaming or merging keeps the old names as aliases, so visits
// recorded under them still belong to the brand in reports.
// ----------------------------------------------------------------------------
/** Spellings of one name are the same name: spaces, Arabic ي/ك, half-spaces, case. */
const nameKey = (v: unknown) =>
  String(v ?? '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u200c\u200f\u200e\s]+/g, ' ')
    .trim()
    .toLowerCase();
const tidyName = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim();
const brandKeys = (b: { name: string; aliases?: string[] }) => [b.name, ...(b.aliases || [])].map(nameKey);
const MAX_NAME = 80;

/** Brands that exist only as names on stores or visits get a registry entry, once. */
async function backfillBrands(tenantId: string) {
  const brands = await store.listBrands(tenantId);
  const known = new Set(brands.flatMap(brandKeys));
  const names = new Map<string, string>();
  for (const s of await store.listStores()) if (s.brandName) names.set(nameKey(s.brandName), tidyName(s.brandName));
  for (const v of await store.listVisits({ tenantId })) if (v.brandName) names.set(nameKey(v.brandName), tidyName(v.brandName));
  const now = new Date().toISOString();
  for (const [key, name] of names) {
    if (!key || known.has(key)) continue;
    const brand = { id: `brand_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, aliases: [], isActive: true, createdAt: now, updatedAt: now };
    await store.saveBrand(tenantId, brand);
    brands.push(brand);
    known.add(key);
  }
  return brands;
}

app.get(
  '/api/brands',
  route(async (req, res) => {
    const list = await backfillBrands(tenantOf(req));
    res.json(list.sort((a, b) => a.name.localeCompare(b.name, 'fa')));
  })
);

app.post(
  '/api/brands',
  requirePermission('visits.fill', 'catalog.manage'),
  route(async (req, res) => {
    const name = tidyName(req.body?.name);
    if (name.length < 2 || name.length > MAX_NAME) return res.status(400).json({ error: `نام برند باید بین ۲ و ${MAX_NAME} نویسه باشد.` });
    const brands = await store.listBrands(tenantOf(req));
    const taken = brands.find((b) => brandKeys(b).includes(nameKey(name)));
    if (taken) return res.status(409).json({ error: 'این برند قبلاً تعریف شده است.', brand: taken });
    const now = new Date().toISOString();
    const brand = {
      id: `brand_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      aliases: [] as string[],
      ...(typeof req.body?.businessType === 'string' && req.body.businessType ? { businessType: req.body.businessType } : {}),
      ...(tidyName(req.body?.notes) ? { notes: tidyName(req.body.notes).slice(0, 500) } : {}),
      isActive: true,
      createdAt: now,
      createdBy: req.user!.id,
      updatedAt: now,
    };
    await store.saveBrand(tenantOf(req), brand);
    res.status(201).json(brand);
  })
);

/** Points every directory branch of `from` (a brand's names) at `to`. */
async function moveBranches(fromKeys: string[], toName: string) {
  for (const s of await store.listStores()) {
    if (fromKeys.includes(nameKey(s.brandName))) await store.saveStore({ ...s, brandName: toName, updatedAt: new Date().toISOString() });
  }
}

app.put(
  '/api/brands/:id',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const tenantId = tenantOf(req);
    const brands = await store.listBrands(tenantId);
    const brand = brands.find((b) => b.id === req.params.id);
    if (!brand) return res.status(404).json({ error: 'برند پیدا نشد.' });
    const body = req.body || {};
    const updated: any = { ...brand, updatedAt: new Date().toISOString() };
    if (body.name !== undefined) {
      const name = tidyName(body.name);
      if (name.length < 2 || name.length > MAX_NAME) return res.status(400).json({ error: `نام برند باید بین ۲ و ${MAX_NAME} نویسه باشد.` });
      const clash = brands.find((b) => b.id !== brand.id && brandKeys(b).includes(nameKey(name)));
      if (clash) return res.status(409).json({ error: `نام «${clash.name}» برای برند دیگری است؛ برای یکی کردن، از «ادغام» استفاده کنید.` });
      if (nameKey(name) !== nameKey(brand.name) || name !== brand.name) {
        updated.aliases = [...new Set([...brand.aliases, brand.name].filter((a) => nameKey(a) !== nameKey(name)))];
        updated.name = name;
      }
    }
    if (body.businessType !== undefined) updated.businessType = typeof body.businessType === 'string' && body.businessType ? body.businessType : undefined;
    if (body.notes !== undefined) updated.notes = tidyName(body.notes).slice(0, 500) || undefined;
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return res.status(400).json({ error: 'وضعیت معتبر نیست.' });
      updated.isActive = body.isActive;
    }
    await store.saveBrand(tenantId, updated);
    if (updated.name !== brand.name) await moveBranches(brandKeys(brand), updated.name);
    logger.security('Brand changed', { by: req.user!.id, brandId: brand.id });
    res.json(updated);
  })
);

// Merge a brand into another: its name and aliases become aliases of the target, its branches move over.
app.post(
  '/api/brands/:id/merge',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const tenantId = tenantOf(req);
    const brands = await store.listBrands(tenantId);
    const from = brands.find((b) => b.id === req.params.id);
    const into = brands.find((b) => b.id === req.body?.intoId);
    if (!from || !into) return res.status(404).json({ error: 'برند پیدا نشد.' });
    if (from.id === into.id) return res.status(400).json({ error: 'یک برند را نمی‌شود در خودش ادغام کرد.' });
    const merged = {
      ...into,
      aliases: [...new Set([...into.aliases, from.name, ...from.aliases].filter((a) => nameKey(a) !== nameKey(into.name)))],
      updatedAt: new Date().toISOString(),
    };
    await store.saveBrand(tenantId, merged);
    await moveBranches(brandKeys(from), into.name);
    await store.deleteBrand(tenantId, from.id);
    logger.security('Brands merged', { by: req.user!.id, from: from.id, into: into.id });
    res.json(merged);
  })
);

// Removes the brand and its branches from the directory. Visits already recorded are kept as they are.
app.delete(
  '/api/brands/:id',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const tenantId = tenantOf(req);
    const brand = (await store.listBrands(tenantId)).find((b) => b.id === req.params.id);
    if (!brand) return res.status(404).json({ error: 'برند پیدا نشد.' });
    const keys = brandKeys(brand);
    let branches = 0;
    for (const s of await store.listStores()) {
      if (keys.includes(nameKey(s.brandName))) {
        await store.deleteStore(s.id);
        branches += 1;
      }
    }
    await store.deleteBrand(tenantId, brand.id);
    logger.security('Brand removed', { by: req.user!.id, brandId: brand.id, branches });
    res.json({ ok: true, removedBranches: branches });
  })
);

// ----------------------------------------------------------------------------
// STORES DIRECTORY PERSISTENCE ENDPOINTS
// ----------------------------------------------------------------------------
app.get(
  '/api/stores',
  route(async (req, res) => {
    const { search, assessmentType, brandName } = req.query;
    let list = await store.listStores();

    if (assessmentType) {
      list = list.filter((s) => s.assessmentType === assessmentType);
    }
    if (brandName) {
      list = list.filter((s) => s.brandName === brandName);
    }
    if (search) {
      const q = (search as string).toLowerCase();
      list = list.filter(
        (s) =>
          (s.brandName && s.brandName.toLowerCase().includes(q)) ||
          (s.branchName && s.branchName.toLowerCase().includes(q)) ||
          (s.address && s.address.toLowerCase().includes(q)) ||
          (s.businessType && s.businessType.toLowerCase().includes(q))
      );
    }

    // Sort by last visited or created date
    list.sort(
      (a, b) =>
        new Date(b.lastVisitedAt || b.createdAt).getTime() -
        new Date(a.lastVisitedAt || a.createdAt).getTime()
    );
    res.json(list);
  })
);

/** Matches a directory entry by brand + branch, the app's natural key. */
function findStoreByName(list: any[], brandName: string, branchName: string) {
  return list.find(
    (s) =>
      s.brandName?.trim().toLowerCase() === brandName.trim().toLowerCase() &&
      s.branchName?.trim().toLowerCase() === branchName.trim().toLowerCase()
  );
}

app.post(
  '/api/stores',
  route(async (req, res) => {
    const storeData = req.body;
    if (!storeData.brandName || !storeData.branchName) {
      return res.status(400).json({ error: 'brandName and branchName are required' });
    }

    const existing = findStoreByName(
      await store.listStores(),
      storeData.brandName,
      storeData.branchName
    );
    const now = new Date().toISOString();

    const savedStore = existing
      ? { ...existing, ...storeData, id: existing.id, updatedAt: now }
      : {
          id: storeData.id || `store_${Date.now()}`,
          ...storeData,
          createdAt: now,
          updatedAt: now,
        };

    // A branch always belongs to a registered brand, under the brand's current name.
    const tenantId = tenantOf(req);
    const brands = await store.listBrands(tenantId);
    let brand = brands.find((b) => brandKeys(b).includes(nameKey(savedStore.brandName)));
    if (!brand) {
      const now = new Date().toISOString();
      brand = { id: `brand_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: tidyName(savedStore.brandName), aliases: [], isActive: true, createdAt: now, updatedAt: now };
      await store.saveBrand(tenantId, brand);
    }
    savedStore.brandName = brand.name;
    await store.saveStore(savedStore);
    res.status(201).json(savedStore);
  })
);

// Edit a branch: name (the old one stays as an alias), city, address, manager, active, or move it to another brand.
app.put(
  '/api/stores/:id',
  requirePermission('catalog.manage'),
  route(async (req, res) => {
    const tenantId = tenantOf(req);
    const list = await store.listStores();
    const current = list.find((s) => s.id === req.params.id);
    if (!current) return res.status(404).json({ error: 'شعبه پیدا نشد.' });
    const body = req.body || {};
    const updated: any = { ...current, updatedAt: new Date().toISOString() };
    const text = (k: string, max: number) => {
      if (body[k] === undefined) return;
      const v = tidyName(body[k]).slice(0, max);
      updated[k] = v || undefined;
    };
    text('city', 60);
    text('address', 200);
    text('supervisorName', 80);
    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') return res.status(400).json({ error: 'وضعیت معتبر نیست.' });
      updated.isActive = body.isActive;
    }
    if (body.brandId !== undefined) {
      const target = (await store.listBrands(tenantId)).find((b) => b.id === body.brandId);
      if (!target) return res.status(404).json({ error: 'برند مقصد پیدا نشد.' });
      if (nameKey(target.name) !== nameKey(current.brandName)) updated.previousBrands = [...new Set([...(current.previousBrands || []), current.brandName])];
      updated.brandName = target.name;
    }
    if (body.branchName !== undefined) {
      const name = tidyName(body.branchName);
      if (name.length < 1 || name.length > MAX_NAME) return res.status(400).json({ error: `نام شعبه باید بین ۱ و ${MAX_NAME} نویسه باشد.` });
      if (nameKey(name) !== nameKey(current.branchName)) updated.aliases = [...new Set([...(current.aliases || []), current.branchName])];
      updated.branchName = name;
    }
    if (updated.brandName !== current.brandName || updated.branchName !== current.branchName) {
      const clash = list.find((s) => s.id !== current.id && nameKey(s.brandName) === nameKey(updated.brandName) && nameKey(s.branchName) === nameKey(updated.branchName));
      if (clash) return res.status(409).json({ error: 'در این برند شعبه‌ای با همین نام وجود دارد.' });
    }
    await store.saveStore(updated);
    logger.security('Branch changed', { by: req.user!.id, storeId: current.id });
    res.json(updated);
  })
);

app.delete(
  '/api/stores/:id',
  requirePermission('visits.review', 'users.manage'),
  route(async (req, res) => {
    const removed = await store.deleteStore(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Store not found' });
    }
    res.json({ success: true, message: 'Store removed from directory' });
  })
);

const VISIT_STATUSES = new Set(['IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'REVISION_REQUESTED']);

// ----------------------------------------------------------------------------
// VISITS ENDPOINTS
// ----------------------------------------------------------------------------
app.get(
  '/api/visits',
  route(async (req, res) => {
    const { branchName, brandName } = req.query;
    const list = await store.listVisits({
      tenantId: tenantOf(req),
      branchName: branchName as string | undefined,
      brandName: brandName as string | undefined,
    });
    res.json(list.filter((v) => canSeeVisit(req, v)));
  })
);

app.post(
  '/api/visits',
  route(async (req, res) => {
    const visitData = req.body;
    if (!visitData || typeof visitData !== 'object' || Array.isArray(visitData)) {
      return res.status(400).json({ error: 'A visit object is required.' });
    }
    // Reject shapes the app cannot open later: an archived visit without its
    // store, questions or answers breaks the archive, report and comparison.
    const problems: string[] = [];
    if (typeof visitData.brandName !== 'string' || !visitData.brandName.trim()) problems.push('brandName');
    if (typeof visitData.branchName !== 'string' || !visitData.branchName.trim()) problems.push('branchName');
    if (!Array.isArray(visitData.indicators)) problems.push('indicators');
    if (!visitData.responses || typeof visitData.responses !== 'object' || Array.isArray(visitData.responses)) problems.push('responses');
    if (!VISIT_STATUSES.has(visitData.status)) problems.push('status');
    if (typeof visitData.startedAt !== 'string') problems.push('startedAt');
    if (problems.length) {
      return res.status(400).json({ error: `Invalid visit: missing or invalid ${problems.join(', ')}.` });
    }

    const id = visitData.id || `visit_${Date.now()}`;

    const user = req.user!;
    const tenantId = user.tenantId;

    // Saves are repeated upserts of the same questionnaire as it is filled in,
    // so the original creation time must not be rewritten on every save.
    const existing = await store.getVisit(id);
    const denied = visitWriteProblem(req, existing, visitData.status);
    if (denied) {
      logger.security('Visit write refused', { userId: user.id, visitId: id, reason: denied.error });
      return res.status(denied.status).json({ error: denied.error, code: denied.code });
    }

    const statusChanged = !existing || existing.status !== visitData.status;
    const reviewed =
      statusChanged && (visitData.status === 'APPROVED' || visitData.status === 'REVISION_REQUESTED');
    const visit = {
      ...visitData,
      id,
      tenantId,
      // Authorship is stamped by the server, not trusted from the client.
      evaluatorId:
        existing?.evaluatorId || (hasPermission(user, 'visits.review') ? visitData.evaluatorId || user.id : user.id),
      auditorName:
        existing?.auditorName || (hasPermission(user, 'visits.review') ? visitData.auditorName || user.name : user.name),
      // The evaluator code follows the author; it is taken when the visit is first saved.
      evaluatorCode: existing
        ? existing.evaluatorCode ?? null
        : hasPermission(user, 'visits.review')
          ? (typeof visitData.evaluatorCode === 'string' && visitData.evaluatorCode) || user.code || null
          : user.code || null,
      ...(reviewed
        ? { supervisorId: user.id, supervisorName: user.name, reviewedAt: new Date().toISOString() }
        : {}),
      createdAt: existing?.createdAt || visitData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await store.saveVisit(visit);

    // Auto-upsert into stores directory for instant future reuse
    if (visitData.brandName && visitData.branchName) {
      const existing = findStoreByName(
        await store.listStores(),
        visitData.brandName,
        visitData.branchName
      );
      const now = new Date().toISOString();

      if (existing) {
        await store.saveStore({
          ...existing,
          assessmentType: visitData.assessmentType || existing.assessmentType,
          businessType: visitData.businessType || existing.businessType,
          locationContext: visitData.locationContext || existing.locationContext,
          fbType: visitData.fbType || existing.fbType,
          fbService: visitData.fbService || existing.fbService,
          storeFormat: visitData.storeFormat || existing.storeFormat,
          mallType: visitData.mallType || existing.mallType,
          attributes: visitData.attributes || existing.attributes,
          auditorName: visitData.auditorName || existing.auditorName,
          supervisorName: visitData.supervisorName || existing.supervisorName,
          lastVisitedAt: now,
        });
      } else {
        await store.saveStore({
          id: `store_${Date.now()}`,
          brandName: visitData.brandName,
          branchName: visitData.branchName,
          assessmentType: visitData.assessmentType || 'STORE',
          businessType: visitData.businessType || 'Fashion',
          locationContext: visitData.locationContext || 'STREET_STORE',
          ...(visitData.fbType ? { fbType: visitData.fbType } : {}),
          ...(visitData.fbService ? { fbService: visitData.fbService } : {}),
          storeFormat: visitData.storeFormat || 'CHAIN',
          mallType: visitData.mallType,
          attributes: visitData.attributes || {},
          auditorName: visitData.auditorName,
          supervisorName: visitData.supervisorName,
          lastVisitedAt: now,
          createdAt: now,
        });
      }
    }

    res.status(201).json(visit);
  })
);

app.get(
  '/api/visits/:id',
  route(async (req, res) => {
    const visit = await store.getVisit(req.params.id);
    if (!visit || !canSeeVisit(req, visit)) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    res.json(visit);
  })
);

app.post(
  '/api/visits/:id/responses',
  route(async (req, res) => {
    const visit = await store.getVisit(req.params.id);
    if (!visit || !canSeeVisit(req, visit)) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    const denied = visitWriteProblem(req, visit, visit.status);
    if (denied) return res.status(denied.status).json({ error: denied.error, code: denied.code });

    const { indicatorId, response } = req.body;
    if (!visit.responses) {
      visit.responses = {};
    }
    visit.responses[indicatorId] = response;
    visit.updatedAt = new Date().toISOString();

    await store.saveVisit(visit);
    res.json({ success: true, visitId: visit.id, response });
  })
);

// ----------------------------------------------------------------------------
// PROMPT 3: SCORING & PROFILES ENDPOINTS (Requirements 1, 4, 5, 22)
// ----------------------------------------------------------------------------
app.get('/api/scoring/profiles', (req: Request, res: Response) => {
  res.json(Object.values(SCORING_PROFILES_REGISTRY));
});

app.post('/api/scoring/calculate', (req: Request, res: Response) => {
  const { indicators, responses, assessmentType, profileId } = req.body;
  if (!indicators || !responses) {
    return res.status(400).json({ error: 'Indicators and responses are required' });
  }
  const profile = (profileId && SCORING_PROFILES_REGISTRY[profileId]) || DEFAULT_CONSULTING_PROFILE;
  const summary = calculateVisitSummary(indicators, responses, assessmentType || 'STORE', profile);
  res.json(summary);
});

// ----------------------------------------------------------------------------
// PROMPT 4: CORRECTIVE ACTIONS ENDPOINTS (Requirements 1-12, 20, 22-25)
// ----------------------------------------------------------------------------

/** Records a state transition on the immutable audit trail. */
async function writeAuditLog(
  action: CorrectiveAction,
  who: string,
  userRole: UserRole,
  what: string,
  fromStatus: string,
  details: Record<string, any>
): Promise<void> {
  const log: ActionAuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    actionId: action.id,
    who,
    userRole,
    what: what as ActionAuditLog['what'],
    fromStatus: fromStatus as ActionAuditLog['fromStatus'],
    toStatus: action.status,
    details,
    timestamp: new Date().toISOString(),
  };
  await store.appendAuditLog(log);
}

// List actions with rich filtering
app.get(
  '/api/actions',
  requirePermission('actions.view'),
  route(async (req, res) => {
    const { brand, branch, owner, department, priority, status, overdue } = req.query;
    const activeTenant = tenantOf(req);

    let list = await store.listActions(activeTenant);

    if (brand) list = list.filter((a) => a.brandName === brand);
    if (branch) list = list.filter((a) => a.branchName === branch || a.branchId === branch);
    if (owner) list = list.filter((a) => a.owner?.toLowerCase() === (owner as string).toLowerCase());
    if (department) list = list.filter((a) => a.department === department);
    if (priority) list = list.filter((a) => a.priority === priority);
    if (status) list = list.filter((a) => a.status === status);

    if (overdue === 'true') {
      const now = Date.now();
      list = list.filter(
        (a) =>
          (a.status === 'OPEN' ||
            a.status === 'ASSIGNED' ||
            a.status === 'IN_PROGRESS' ||
            a.status === 'REOPENED') &&
          new Date(a.dueDate).getTime() < now
      );
    }

    res.json(list);
  })
);

// Create corrective action (single or from finding)
app.post(
  '/api/actions',
  requirePermission('actions.manage'),
  route(async (req, res) => {
    const userRole = roleOf(req);

    const {
      findingId,
      indicatorCode,
      visitId,
      branchId,
      branchName,
      brandName,
      title,
      description,
      priority,
      owner,
      department,
      dueDate,
      rootCause,
      beforePhotos,
    } = req.body;

    if (!indicatorCode || !title || !branchName) {
      return res.status(400).json({ error: 'indicatorCode, title, and branchName are required.' });
    }

    const id = `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const newAction: CorrectiveAction = {
      id,
      tenantId: tenantOf(req),
      findingId: findingId || `finding_${Date.now()}`,
      indicatorCode,
      visitId: visitId || 'manual',
      branchId: branchId || branchName,
      branchName,
      brandName: brandName || 'برند عمومی',
      title,
      description: description || '',
      priority: priority || 'MEDIUM',
      status: owner ? 'ASSIGNED' : 'OPEN',
      owner: owner || undefined,
      department: department || 'Operations',
      dueDate: dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      rootCause: rootCause || undefined,
      beforePhotos: beforePhotos || [],
      afterPhotos: [],
      reopenCount: 0,
      reopenComments: [],
      createdBy: userOf(req),
      createdAt: now,
      updatedAt: now,
    };

    await store.saveAction(newAction);
    await writeAuditLog(newAction, newAction.createdBy, userRole, 'ACTION_CREATED', 'NONE', {
      priority: newAction.priority,
      department: newAction.department,
      owner: newAction.owner,
    });

    logger.info('Corrective action created', {
      actionId: id,
      indicatorCode,
      priority: newAction.priority,
    });
    res.status(201).json(newAction);
  })
);

// Get action by ID with audit logs
app.get(
  '/api/actions/:id',
  requirePermission('actions.view'),
  route(async (req, res) => {
    const action = await actionFor(req);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }
    res.json({ action, auditLogs: await store.listAuditLogs(req.params.id) });
  })
);

// Update assignment, priority, due date, status
app.patch(
  '/api/actions/:id',
  requirePermission('actions.manage', 'actions.resolve'),
  route(async (req, res) => {
    const action = await actionFor(req);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const userRole = roleOf(req);
    const userName = userOf(req);
    const fromStatus = action.status;
    const updates = { ...req.body };

    // Assigning an owner moves an untouched action into ASSIGNED.
    if (updates.owner && action.status === 'OPEN') {
      updates.status = 'ASSIGNED';
    }

    // The id and tenant are server-owned and must not be client-writable.
    delete updates.id;
    delete updates.tenantId;

    Object.assign(action, updates, { updatedAt: new Date().toISOString() });
    await store.saveAction(action);
    await writeAuditLog(action, userName, userRole, 'ACTION_UPDATED', fromStatus, updates);

    res.json(action);
  })
);

// Owner Resolution (Requirements 6-7)
app.post(
  '/api/actions/:id/resolve',
  requirePermission('actions.resolve', 'actions.manage'),
  route(async (req, res) => {
    const action = await actionFor(req);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const { resolutionNote, completionDate, afterPhotos, rootCause } = req.body;
    if (!resolutionNote) {
      return res.status(400).json({ error: 'Resolution note is required.' });
    }

    const userRole = roleOf(req);
    const userName = userOf(req);
    const fromStatus = action.status;

    action.status = 'WAITING_REVIEW';
    action.resolutionNote = resolutionNote;
    action.completionDate = completionDate || new Date().toISOString();
    if (afterPhotos && Array.isArray(afterPhotos)) {
      action.afterPhotos = [...action.afterPhotos, ...afterPhotos];
    }
    if (rootCause) action.rootCause = rootCause;
    action.updatedAt = new Date().toISOString();

    await store.saveAction(action);
    await writeAuditLog(
      action,
      userName,
      userRole,
      'ACTION_RESOLVED_PENDING_REVIEW',
      fromStatus,
      {
        resolutionNote,
        completionDate: action.completionDate,
        photosCount: afterPhotos?.length || 0,
      }
    );

    res.json(action);
  })
);

// Verification Endpoint (Requirement 8: Resolver CANNOT self-verify)
app.post(
  '/api/actions/:id/verify',
  requirePermission('actions.verify'),
  route(async (req, res) => {
    const action = await actionFor(req);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const userRole = roleOf(req);
    const userName = userOf(req);
    const { verificationNote } = req.body;

    // Strict constraint: Resolver / Owner cannot self-verify!
    const sameIdentity = (a: string, b: string) =>
      a.trim().normalize('NFC').toLowerCase() === b.trim().normalize('NFC').toLowerCase();

    if (action.owner && sameIdentity(userName, action.owner)) {
      logger.security('Self-verification violation prevented', {
        actionId: action.id,
        user: userName,
      });
      return res.status(403).json({ error: 'Conflict of interest: The action owner cannot self-verify.' });
    }


    const fromStatus = action.status;
    action.status = 'VERIFIED';
    action.verifiedBy = userName;
    action.verifiedAt = new Date().toISOString();
    action.verificationNote = verificationNote || 'Approved';
    action.updatedAt = new Date().toISOString();

    await store.saveAction(action);
    await writeAuditLog(action, userName, userRole, 'ACTION_VERIFIED', fromStatus, {
      verificationNote: action.verificationNote,
    });

    res.json(action);
  })
);

// Reopen Endpoint (Requirement 9: REOPEN with comment)
app.post(
  '/api/actions/:id/reopen',
  requirePermission('actions.verify', 'actions.manage'),
  route(async (req, res) => {
    const action = await actionFor(req);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'Comment is required when reopening an action.' });
    }

    const userRole = roleOf(req);
    const userName = userOf(req);
    const fromStatus = action.status;

    action.status = 'REOPENED';
    action.reopenCount = (action.reopenCount || 0) + 1;
    action.reopenComments = action.reopenComments || [];
    action.reopenComments.push({
      id: `rc_${Date.now()}`,
      comment,
      reopenedBy: userName,
      timestamp: new Date().toISOString(),
    });
    action.updatedAt = new Date().toISOString();

    await store.saveAction(action);
    await writeAuditLog(action, userName, userRole, 'ACTION_REOPENED', fromStatus, {
      comment,
      reopenCount: action.reopenCount,
    });

    res.json(action);
  })
);

// Action Analytics Endpoint (Requirement 18)
app.get(
  '/api/actions-analytics',
  requirePermission('actions.view'),
  route(async (req, res) => {
    const list = await store.listActions(tenantOf(req));
    const total = list.length;
    const now = Date.now();

    let open = 0;
    let overdue = 0;
    let critical = 0;
    let resolved = 0;
    let awaiting = 0;
    let verified = 0;
    let criticalResolved = 0;
    const resolutionTimesHours: number[] = [];

    for (const a of list) {
      const isResolved = a.status === 'RESOLVED' || a.status === 'VERIFIED';
      const isOpen =
        a.status === 'OPEN' ||
        a.status === 'ASSIGNED' ||
        a.status === 'IN_PROGRESS' ||
        a.status === 'REOPENED';
      if (isOpen) open++;
      if (a.status === 'WAITING_REVIEW') awaiting++;
      if (a.status === 'RESOLVED') resolved++;
      if (a.status === 'VERIFIED') verified++;
      if (a.priority === 'CRITICAL') {
        critical++;
        if (isResolved) criticalResolved++;
      }
      if (isOpen && a.dueDate && now > new Date(a.dueDate).getTime()) overdue++;
      if (isResolved && a.completionDate && a.createdAt) {
        const dur =
          (new Date(a.completionDate).getTime() - new Date(a.createdAt).getTime()) / (1000 * 3600);
        if (dur >= 0) resolutionTimesHours.push(dur);
      }
    }

    let medianHours = 0;
    if (resolutionTimesHours.length > 0) {
      resolutionTimesHours.sort((a, b) => a - b);
      medianHours = Math.round(resolutionTimesHours[Math.floor(resolutionTimesHours.length / 2)]);
    }

    res.json({
      totalActions: total,
      openActions: open,
      overdueActions: overdue,
      criticalActions: critical,
      resolvedActions: resolved,
      awaitingVerificationActions: awaiting,
      verifiedActions: verified,
      resolutionRate: total > 0 ? Math.round(((resolved + verified) / total) * 100) : 0,
      medianResolutionHours: medianHours,
      overdueRate: open > 0 ? Math.round((overdue / open) * 100) : 0,
      recurrenceRate: 0,
      criticalResolutionRate: critical > 0 ? Math.round((criticalResolved / critical) * 100) : 100,
    });
  })
);

// ----------------------------------------------------------------------------
// REVISIT & HISTORICAL COMPARISON (Requirements 13-17, 19)
// ----------------------------------------------------------------------------
app.get(
  '/api/branches/:branchName/visits',
  route(async (req, res) => {
    const list = (await store.listVisits({ tenantId: tenantOf(req), branchName: req.params.branchName })).filter(
      (v) => canSeeVisit(req, v)
    );
    list.sort(
      (a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
    );
    res.json(list);
  })
);

// ----------------------------------------------------------------------------
// FILE STORAGE
// ----------------------------------------------------------------------------
app.post('/api/storage/upload', (req: Request, res: Response) => {
  const { key, base64Data, mimeType } = req.body;
  if (!key || !base64Data) {
    return res.status(400).json({ error: 'Key and base64Data required' });
  }
  const buffer = Buffer.from(base64Data, 'base64');
  defaultStorageProvider
    .saveBuffer(buffer, path.basename(key), mimeType || 'image/jpeg', 'default')
    .then((meta) => res.json(meta))
    .catch((err) => res.status(400).json({ error: err.message }));
});

// ----------------------------------------------------------------------------
// EVIDENCE PHOTOS
// ----------------------------------------------------------------------------
// Photos go through the data store rather than the local filesystem, so they
// survive on a serverless deployment where the disk is read-only and
// per-invocation. They are addressed by URL and never travel inside a visit
// document, which is re-sent in full on every questionnaire sync.

const ALLOWED_PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
// The client downscales before sending; this only guards against a client that
// could not compress, or a hand-crafted request.
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

app.post(
  '/api/photos',
  route(async (req, res) => {
    const { data, mimeType, visitId, indicatorCode } = req.body || {};

    if (!data || typeof data !== 'string') {
      return res.status(400).json({ error: 'A base64 "data" field is required.' });
    }
    if (!ALLOWED_PHOTO_TYPES.has(mimeType)) {
      return res.status(415).json({
        error: `Unsupported image type: ${mimeType || 'unknown'}. Use JPEG, PNG or WebP.`,
      });
    }

    const buffer = Buffer.from(data, 'base64');
    if (buffer.length === 0) {
      return res.status(400).json({ error: 'The image data could not be decoded.' });
    }
    if (buffer.length > MAX_PHOTO_BYTES) {
      return res.status(413).json({
        error: `Image is ${Math.round(buffer.length / 1024 / 1024)}MB; the limit is 8MB.`,
      });
    }

    const meta = await store.savePhoto({
      id: `photo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      tenantId: tenantOf(req),
      visitId: typeof visitId === 'string' ? visitId : undefined,
      indicatorCode: typeof indicatorCode === 'string' ? indicatorCode : undefined,
      mimeType,
      sizeBytes: buffer.length,
      data: buffer,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ ...meta, url: `/api/photos/${meta.id}` });
  })
);

app.get(
  '/api/photos/:id',
  route(async (req, res) => {
    const photo = await store.getPhoto(req.params.id);
    if (!photo || (photo.tenantId || DEFAULT_TENANT) !== tenantOf(req)) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Length', String(photo.sizeBytes));
    // Bytes never change once stored; 'private' keeps shared caches from
    // serving evidence to someone who is not signed in.
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.send(photo.data);
  })
);

app.delete(
  '/api/photos/:id',
  route(async (req, res) => {
    const photo = await store.getPhoto(req.params.id);
    if (!photo || (photo.tenantId || DEFAULT_TENANT) !== tenantOf(req)) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    const removed = await store.deletePhoto(req.params.id);
    if (!removed) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.json({ success: true });
  })
);

// Serves an uploaded evidence file. Matches the download URLs the storage
// provider hands out (`/api/storage/files/<tenant>/<uuid>.<ext>`).
app.get('/api/storage/files/:storageKey(*)', (req: Request, res: Response) => {
  const storageKey = decodeURIComponent(req.params.storageKey);
  const filePath = defaultStorageProvider.resolveKey(storageKey);

  if (!filePath) {
    logger.security('Blocked path traversal attempt on storage', { storageKey });
    return res.status(400).json({ error: 'Invalid storage key' });
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.sendFile(filePath);
});

// Scenarios evaluation endpoint (Unchanged)
app.get('/api/test-scenarios', (req: Request, res: Response) => {
  const scenarios = [
    { id: 'A', name: 'Fashion - Street Store', applicableCount: 249, excludedCount: 6 },
    { id: 'B', name: 'Fashion - Mall Store', applicableCount: 252, excludedCount: 3 },
    { id: 'C', name: 'F&B - Street Store', applicableCount: 105, excludedCount: 150 },
    { id: 'D', name: 'F&B - Food Court', applicableCount: 103, excludedCount: 152 },
    { id: 'E', name: 'Watch & Jewelry - Mall', applicableCount: 156, excludedCount: 99 },
    { id: 'F', name: 'Mall - SM', applicableCount: 151, excludedCount: 75 },
    { id: 'G', name: 'Mall - Regional Mall', applicableCount: 226, excludedCount: 0 },
  ];
  res.json(scenarios);
});

// Unknown API routes must return JSON, never the SPA shell below.
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({ error: `Unknown API endpoint: ${req.method} ${req.path}` });
});

// ----------------------------------------------------------------------------
// STATIC FRONTEND (single-service deployment)
// ----------------------------------------------------------------------------
// When `npm run build` has produced `dist/`, the API also serves the SPA, so
// one free-tier web service can host the whole app on a single origin.
const clientAvailable = SERVE_CLIENT && fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'));

if (clientAvailable) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
} else if (SERVE_CLIENT) {
  console.log(
    `No frontend build found at ${CLIENT_DIST_DIR}; serving API only. Run "npm run build" to bundle the UI.`
  );
}

// ----------------------------------------------------------------------------
// ERROR HANDLING & STARTUP
// ----------------------------------------------------------------------------
app.use((err: Error & { type?: string; status?: number }, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  // body-parser errors are the client's fault, not the server's.
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Request body is not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body is too large.' });
  }
  logger.error('Unhandled request error', err, { method: req.method, path: req.path });
  res.status(500).json({ error: 'Internal server error' });
});

/** Starts the long-running server. Not used when running as a serverless function. */
export async function start() {
  // Fail fast here rather than on the first request, so a bad DATABASE_URL is
  // visible in the deploy log instead of as a 500 later.
  store = await getStore();

  const server = app.listen(PORT, HOST, () => {
    console.log(`RSAPP Backend API Server running on http://${HOST}:${PORT}`);
    console.log(`Storage backend: ${store.name}`);
    if (store.name === 'json-files') {
      console.log(`Data directory: ${DATA_DIR}`);
    }
    console.log(`Frontend: ${clientAvailable ? CLIENT_DIST_DIR : 'not served (API only)'}`);
  });

  // Managed hosts send SIGTERM on redeploy; finish in-flight requests first.
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.on(signal, () => {
      console.log(`${signal} received, shutting down.`);
      server.close(async () => {
        await store.close().catch(() => undefined);
        process.exit(0);
      });
    });
  }
}

export default app;
export { app };
