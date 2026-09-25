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
import {
  CorrectiveAction,
  ActionAuditLog,
  UserRole,
  ROLE_PERMISSIONS,
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
      tenantId: identityHeader(req, 'x-tenant-id') || 'default',
      userRole: identityHeader(req, 'x-user-role') || 'Admin',
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

/**
 * Reads an identity header.
 *
 * HTTP header values are Latin-1, so a Persian name sent raw arrives as
 * mojibake — which silently defeated the self-verification check, since the
 * mangled header never matched the correctly stored owner name. The client
 * percent-encodes these headers; decoding is tolerant so that plain ASCII sent
 * by curl or an older client still works.
 */
function identityHeader(req: Request, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

const tenantOf = (req: Request): string =>
  identityHeader(req, 'x-tenant-id') || DEFAULT_TENANT;
const roleOf = (req: Request, fallback: UserRole): UserRole =>
  (identityHeader(req, 'x-user-role') as UserRole) || fallback;
const userOf = (req: Request, fallback: string): string =>
  identityHeader(req, 'x-user-name') || fallback;

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
app.get(
  '/api/organizations',
  route(async (req, res) => {
    res.json(await store.listOrganizations());
  })
);

app.post(
  '/api/organizations',
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

    await store.saveStore(savedStore);
    res.status(201).json(savedStore);
  })
);

app.delete(
  '/api/stores/:id',
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
    const { tenantId, branchName, brandName } = req.query;
    res.json(
      await store.listVisits({
        tenantId: tenantId as string | undefined,
        branchName: branchName as string | undefined,
        brandName: brandName as string | undefined,
      })
    );
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

    // navigator.sendBeacon cannot set headers, so the unload path passes the
    // tenant in the query string instead.
    const tenantId =
      visitData.tenantId || (req.query.tenantId as string) || tenantOf(req);

    // Saves are repeated upserts of the same questionnaire as it is filled in,
    // so the original creation time must not be rewritten on every save.
    const existing = await store.getVisit(id);
    const visit = {
      ...visitData,
      id,
      tenantId,
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
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    res.json(visit);
  })
);

app.post(
  '/api/visits/:id/responses',
  route(async (req, res) => {
    const visit = await store.getVisit(req.params.id);
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

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
  route(async (req, res) => {
    const { tenantId, brand, branch, owner, department, priority, status, overdue } = req.query;
    const activeTenant = identityHeader(req, 'x-tenant-id') || (tenantId as string) || DEFAULT_TENANT;

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
  route(async (req, res) => {
    const userRole = roleOf(req, 'Supervisor');
    const perms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.Supervisor;

    if (!perms.canCreateActions) {
      logger.security('Forbidden action creation attempt', { userRole });
      return res.status(403).json({ error: `Role ${userRole} is not permitted to create actions.` });
    }

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
      createdBy: userOf(req, 'Supervisor'),
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
  route(async (req, res) => {
    const action = await store.getAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }
    res.json({ action, auditLogs: await store.listAuditLogs(req.params.id) });
  })
);

// Update assignment, priority, due date, status
app.patch(
  '/api/actions/:id',
  route(async (req, res) => {
    const action = await store.getAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const userRole = roleOf(req, 'Supervisor');
    const userName = userOf(req, 'User');
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
  route(async (req, res) => {
    const action = await store.getAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const { resolutionNote, completionDate, afterPhotos, rootCause } = req.body;
    if (!resolutionNote) {
      return res.status(400).json({ error: 'Resolution note is required.' });
    }

    const userRole = roleOf(req, 'Owner');
    const userName = userOf(req, action.owner || 'Owner');
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
  route(async (req, res) => {
    const action = await store.getAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const userRole = roleOf(req, 'Supervisor');
    const userName = userOf(req, 'Supervisor');
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

    const perms = ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.Supervisor;
    if (!perms.canVerifyActions) {
      return res.status(403).json({ error: `Role ${userRole} is not permitted to verify actions.` });
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
  route(async (req, res) => {
    const action = await store.getAction(req.params.id);
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    const { comment } = req.body;
    if (!comment) {
      return res.status(400).json({ error: 'Comment is required when reopening an action.' });
    }

    const userRole = roleOf(req, 'Supervisor');
    const userName = userOf(req, 'Supervisor');
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
    const list = await store.listVisits({ branchName: req.params.branchName });
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
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }
    res.setHeader('Content-Type', photo.mimeType);
    res.setHeader('Content-Length', String(photo.sizeBytes));
    // Photo bytes never change once stored, so they can be cached hard.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(photo.data);
  })
);

app.delete(
  '/api/photos/:id',
  route(async (req, res) => {
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
