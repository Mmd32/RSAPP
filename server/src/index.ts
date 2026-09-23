import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from './logger.js';
import { defaultStorageProvider } from './storage/storageProvider.js';
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
} from '../../src/engine/scoringEngine';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CATALOG_PATH = path.resolve(__dirname, '../../data/catalog.json');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    logger.info(`HTTP ${req.method} ${req.path}`, {
      status: res.statusCode,
      durationMs: Date.now() - start,
      tenantId: (req.headers['x-tenant-id'] as string) || 'default',
      userRole: (req.headers['x-user-role'] as string) || 'Admin',
    });
  });
  next();
});

let catalog: any = null;

try {
  if (fs.existsSync(CATALOG_PATH)) {
    catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
    console.log(`Loaded catalog with ${catalog.indicators.length} indicators.`);
  }
} catch (e) {
  logger.error('Error loading catalog', e);
}

// ----------------------------------------------------------------------------
// PERSISTENT DATA STORES
// ----------------------------------------------------------------------------
const VISITS_STORE_PATH = path.resolve(__dirname, '../../data/visits.json');
const ACTIONS_STORE_PATH = path.resolve(__dirname, '../../data/actions.json');
const AUDIT_STORE_PATH = path.resolve(__dirname, '../../data/action_audit_logs.json');
const ORGS_STORE_PATH = path.resolve(__dirname, '../../data/organizations.json');

let visits: Record<string, any> = {};
let actions: Record<string, CorrectiveAction> = {};
let auditLogs: ActionAuditLog[] = [];
let organizations: Record<string, any> = {
  org_retail_holding: {
    id: 'org_retail_holding',
    name: 'هلدینگ ریتیل سلوشنز',
    code: 'RS_HOLDING',
    brands: ['ZARA', 'LC Waikiki', 'کوروش مال', 'مانگو'],
    isActive: true,
    createdAt: new Date().toISOString(),
  },
};

function loadStores() {
  if (fs.existsSync(VISITS_STORE_PATH)) {
    try {
      visits = JSON.parse(fs.readFileSync(VISITS_STORE_PATH, 'utf-8'));
    } catch (e) {}
  }
  if (fs.existsSync(ACTIONS_STORE_PATH)) {
    try {
      actions = JSON.parse(fs.readFileSync(ACTIONS_STORE_PATH, 'utf-8'));
    } catch (e) {}
  }
  if (fs.existsSync(AUDIT_STORE_PATH)) {
    try {
      auditLogs = JSON.parse(fs.readFileSync(AUDIT_STORE_PATH, 'utf-8'));
    } catch (e) {}
  }
  if (fs.existsSync(ORGS_STORE_PATH)) {
    try {
      organizations = JSON.parse(fs.readFileSync(ORGS_STORE_PATH, 'utf-8'));
    } catch (e) {}
  }
}

loadStores();

function persistVisits() {
  fs.writeFileSync(VISITS_STORE_PATH, JSON.stringify(visits, null, 2), 'utf-8');
}
function persistActions() {
  fs.writeFileSync(ACTIONS_STORE_PATH, JSON.stringify(actions, null, 2), 'utf-8');
}
function persistAudit() {
  fs.writeFileSync(AUDIT_STORE_PATH, JSON.stringify(auditLogs, null, 2), 'utf-8');
}
function persistOrgs() {
  fs.writeFileSync(ORGS_STORE_PATH, JSON.stringify(organizations, null, 2), 'utf-8');
}

// ----------------------------------------------------------------------------
// HEALTH & CATALOG
// ----------------------------------------------------------------------------
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    indicatorsCount: catalog?.indicators?.length || 0,
    visitsCount: Object.keys(visits).length,
    actionsCount: Object.keys(actions).length,
  });
});

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
app.get('/api/organizations', (req: Request, res: Response) => {
  res.json(Object.values(organizations));
});

app.post('/api/organizations', (req: Request, res: Response) => {
  const { name, code, brands } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Name and code are required' });
  }
  const id = `org_${Date.now()}`;
  organizations[id] = {
    id,
    name,
    code,
    brands: brands || [],
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  persistOrgs();
  res.status(201).json(organizations[id]);
});

// ----------------------------------------------------------------------------
// VISITS ENDPOINTS
// ----------------------------------------------------------------------------
app.get('/api/visits', (req: Request, res: Response) => {
  const { tenantId, branchName, brandName } = req.query;
  let list = Object.values(visits);
  if (tenantId) list = list.filter((v: any) => (v.tenantId || 'org_retail_holding') === tenantId);
  if (branchName) list = list.filter((v: any) => v.branchName === branchName);
  if (brandName) list = list.filter((v: any) => v.brandName === brandName);
  res.json(list);
});

app.post('/api/visits', (req: Request, res: Response) => {
  const visitData = req.body;
  const id = visitData.id || `visit_${Date.now()}`;
  visits[id] = {
    ...visitData,
    id,
    tenantId: visitData.tenantId || (req.headers['x-tenant-id'] as string) || 'org_retail_holding',
    createdAt: new Date().toISOString(),
  };
  persistVisits();
  res.status(201).json(visits[id]);
});

app.get('/api/visits/:id', (req: Request, res: Response) => {
  const visit = visits[req.params.id];
  if (!visit) {
    return res.status(404).json({ error: 'Visit not found' });
  }
  res.json(visit);
});

app.post('/api/visits/:id/responses', (req: Request, res: Response) => {
  const visit = visits[req.params.id];
  if (!visit) {
    return res.status(404).json({ error: 'Visit not found' });
  }

  const { indicatorId, response } = req.body;
  if (!visit.responses) {
    visit.responses = {};
  }
  visit.responses[indicatorId] = response;
  visit.updatedAt = new Date().toISOString();

  persistVisits();
  res.json({ success: true, visitId: visit.id, response });
});

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

// List actions with rich filtering
app.get('/api/actions', (req: Request, res: Response) => {
  const { tenantId, brand, branch, owner, department, priority, status, overdue } = req.query;
  const activeTenant = (req.headers['x-tenant-id'] as string) || (tenantId as string) || 'org_retail_holding';

  let list = Object.values(actions).filter(
    (a) => (a.tenantId || 'org_retail_holding') === activeTenant
  );

  if (brand) list = list.filter((a) => a.brandName === brand);
  if (branch) list = list.filter((a) => a.branchName === branch || a.branchId === branch);
  if (owner) list = list.filter((a) => a.owner?.toLowerCase() === (owner as string).toLowerCase());
  if (department) list = list.filter((a) => a.department === department);
  if (priority) list = list.filter((a) => a.priority === priority);
  if (status) list = list.filter((a) => a.status === status);

  if (overdue === 'true') {
    const now = new Date().getTime();
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
});

// Create corrective action (single or from finding)
app.post('/api/actions', (req: Request, res: Response) => {
  const userRole = (req.headers['x-user-role'] as UserRole) || 'Supervisor';
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

  const id = `act_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
  const tenantId = (req.headers['x-tenant-id'] as string) || 'org_retail_holding';
  const now = new Date().toISOString();

  const newAction: CorrectiveAction = {
    id,
    tenantId,
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
    createdBy: (req.headers['x-user-name'] as string) || 'Supervisor',
    createdAt: now,
    updatedAt: now,
  };

  actions[id] = newAction;
  persistActions();

  // Audit log
  const log: ActionAuditLog = {
    id: `log_${Date.now()}`,
    actionId: id,
    who: newAction.createdBy,
    userRole,
    what: 'ACTION_CREATED',
    fromStatus: 'NONE',
    toStatus: newAction.status,
    details: { priority: newAction.priority, department: newAction.department, owner: newAction.owner },
    timestamp: now,
  };
  auditLogs.push(log);
  persistAudit();

  logger.info('Corrective action created', { actionId: id, indicatorCode, priority: newAction.priority });
  res.status(201).json(newAction);
});

// Get action by ID with audit logs
app.get('/api/actions/:id', (req: Request, res: Response) => {
  const action = actions[req.params.id];
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }
  const logs = auditLogs.filter((l) => l.actionId === req.params.id);
  res.json({ action, auditLogs: logs });
});

// Update assignment, priority, due date, status
app.patch('/api/actions/:id', (req: Request, res: Response) => {
  const action = actions[req.params.id];
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  const userRole = (req.headers['x-user-role'] as UserRole) || 'Supervisor';
  const userName = (req.headers['x-user-name'] as string) || 'User';
  const fromStatus = action.status;
  const updates = req.body;

  // Status transitions
  if (updates.owner && action.status === 'OPEN') {
    updates.status = 'ASSIGNED';
  }

  Object.assign(action, updates, { updatedAt: new Date().toISOString() });
  actions[action.id] = action;
  persistActions();

  const log: ActionAuditLog = {
    id: `log_${Date.now()}`,
    actionId: action.id,
    who: userName,
    userRole,
    what: 'ACTION_UPDATED',
    fromStatus,
    toStatus: action.status,
    details: updates,
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(log);
  persistAudit();

  res.json(action);
});

// Owner Resolution (Requirements 6-7)
app.post('/api/actions/:id/resolve', (req: Request, res: Response) => {
  const action = actions[req.params.id];
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  const { resolutionNote, completionDate, afterPhotos, rootCause } = req.body;
  if (!resolutionNote) {
    return res.status(400).json({ error: 'Resolution note is required.' });
  }

  const userRole = (req.headers['x-user-role'] as UserRole) || 'Owner';
  const userName = (req.headers['x-user-name'] as string) || action.owner || 'Owner';
  const fromStatus = action.status;

  action.status = 'WAITING_REVIEW';
  action.resolutionNote = resolutionNote;
  action.completionDate = completionDate || new Date().toISOString();
  if (afterPhotos && Array.isArray(afterPhotos)) {
    action.afterPhotos = [...action.afterPhotos, ...afterPhotos];
  }
  if (rootCause) action.rootCause = rootCause;
  action.updatedAt = new Date().toISOString();

  actions[action.id] = action;
  persistActions();

  const log: ActionAuditLog = {
    id: `log_${Date.now()}`,
    actionId: action.id,
    who: userName,
    userRole,
    what: 'ACTION_RESOLVED_PENDING_REVIEW',
    fromStatus,
    toStatus: action.status,
    details: { resolutionNote, completionDate: action.completionDate, photosCount: afterPhotos?.length || 0 },
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(log);
  persistAudit();

  res.json(action);
});

// Verification Endpoint (Requirement 8: Resolver CANNOT self-verify)
app.post('/api/actions/:id/verify', (req: Request, res: Response) => {
  const action = actions[req.params.id];
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  const userRole = (req.headers['x-user-role'] as UserRole) || 'Supervisor';
  const userName = (req.headers['x-user-name'] as string) || 'Supervisor';
  const { verificationNote } = req.body;

  // Strict constraint: Resolver / Owner cannot self-verify!
  if (action.owner && userName.toLowerCase() === action.owner.toLowerCase()) {
    logger.security('Self-verification violation prevented', { actionId: action.id, user: userName });
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

  actions[action.id] = action;
  persistActions();

  const log: ActionAuditLog = {
    id: `log_${Date.now()}`,
    actionId: action.id,
    who: userName,
    userRole,
    what: 'ACTION_VERIFIED',
    fromStatus,
    toStatus: 'VERIFIED',
    details: { verificationNote: action.verificationNote },
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(log);
  persistAudit();

  res.json(action);
});

// Reopen Endpoint (Requirement 9: REOPEN with comment)
app.post('/api/actions/:id/reopen', (req: Request, res: Response) => {
  const action = actions[req.params.id];
  if (!action) {
    return res.status(404).json({ error: 'Action not found' });
  }

  const { comment } = req.body;
  if (!comment) {
    return res.status(400).json({ error: 'Comment is required when reopening an action.' });
  }

  const userRole = (req.headers['x-user-role'] as UserRole) || 'Supervisor';
  const userName = (req.headers['x-user-name'] as string) || 'Supervisor';
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

  actions[action.id] = action;
  persistActions();

  const log: ActionAuditLog = {
    id: `log_${Date.now()}`,
    actionId: action.id,
    who: userName,
    userRole,
    what: 'ACTION_REOPENED',
    fromStatus,
    toStatus: 'REOPENED',
    details: { comment, reopenCount: action.reopenCount },
    timestamp: new Date().toISOString(),
  };
  auditLogs.push(log);
  persistAudit();

  res.json(action);
});

// Action Analytics Endpoint (Requirement 18)
app.get('/api/actions-analytics', (req: Request, res: Response) => {
  const list = Object.values(actions);
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
    const isOpen = a.status === 'OPEN' || a.status === 'ASSIGNED' || a.status === 'IN_PROGRESS' || a.status === 'REOPENED';
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
      const dur = (new Date(a.completionDate).getTime() - new Date(a.createdAt).getTime()) / (1000 * 3600);
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
    criticalResolutionRate: critical > 0 ? Math.round((criticalResolvedCount(list) / critical) * 100) : 100,
  });
});

function criticalResolvedCount(list: CorrectiveAction[]) {
  return list.filter((a) => a.priority === 'CRITICAL' && (a.status === 'RESOLVED' || a.status === 'VERIFIED')).length;
}

// ----------------------------------------------------------------------------
// REVISIT & HISTORICAL COMPARISON (Requirements 13-17, 19)
// ----------------------------------------------------------------------------
app.get('/api/branches/:branchName/visits', (req: Request, res: Response) => {
  const branchName = req.params.branchName;
  const list = Object.values(visits)
    .filter((v: any) => v.branchName === branchName)
    .sort((a: any, b: any) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
  res.json(list);
});

// Storage upload verification endpoint
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

app.listen(PORT, () => {
  console.log(`RSAPP Backend API Server running on port ${PORT}`);
});
