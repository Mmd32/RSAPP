import crypto from 'crypto';
import type { Express, NextFunction, Request, RequestHandler, Response } from 'express';
import { logger } from '../logger.js';
import type { DataStore, StoredUser } from '../store/index.js';
import {
  generateTemporaryPassword,
  getDecoyHash,
  hashPassword,
  passwordProblem,
  verifyPassword,
} from './password.js';
import {
  SESSION_TTL_SECONDS,
  clearSessionCookie,
  getSigningKey,
  readSessionCookie,
  setSessionCookie,
  signSession,
  verifySession,
} from './session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** The signed-in account, set by requireAuth. */
      user?: StoredUser;
    }
  }
}

export const ROLES = ['Admin', 'Supervisor', 'Evaluator', 'Manager', 'Owner', 'Verifier'] as const;
export type Role = (typeof ROLES)[number];

const DEFAULT_TENANT = 'org_retail_holding';
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

/** Per-IP throttle on top of the per-account lockout (per instance; best effort). */
const ipAttempts = new Map<string, { count: number; resetAt: number }>();
function tooManyFromIp(req: Request): boolean {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const entry = ipAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 30;
}

/** What the API ever reveals about an account. Never the hash. */
export function publicUser(u: StoredUser) {
  return {
    id: u.id,
    tenantId: u.tenantId,
    email: u.email,
    name: u.name,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: !!u.mustChangePassword,
    lastLoginAt: u.lastLoginAt ?? null,
    createdAt: u.createdAt,
  };
}

const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const isName = (v: unknown): v is string => typeof v === 'string' && v.trim().length >= 2 && v.length <= 100;
const isRole = (v: unknown): v is Role => typeof v === 'string' && (ROLES as readonly string[]).includes(v);

async function startSession(store: DataStore, req: Request, res: Response, user: StoredUser) {
  const now = Math.floor(Date.now() / 1000);
  const token = signSession(
    { sub: user.id, sv: user.sessionVersion, iat: now, exp: now + SESSION_TTL_SECONDS },
    await getSigningKey(store)
  );
  setSessionCookie(req, res, token);
}

function newUser(fields: {
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  mustChangePassword: boolean;
}): StoredUser {
  const now = new Date().toISOString();
  return {
    id: `usr_${crypto.randomBytes(9).toString('base64url')}`,
    ...fields,
    email: fields.email.trim().toLowerCase(),
    name: fields.name.trim(),
    isActive: true,
    sessionVersion: 1,
    failedLogins: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Requires a valid session cookie. The account is re-read on every request so
 * that deactivation, a role change or a password reset takes effect at once.
 */
export function requireAuth(getStore: () => DataStore): RequestHandler {
  return (req, res, next) => {
    (async () => {
      const token = readSessionCookie(req);
      if (!token) return res.status(401).json({ error: 'ابتدا وارد حساب کاربری شوید.', code: 'UNAUTHENTICATED' });
      const store = getStore();
      const claims = verifySession(token, await getSigningKey(store));
      const user = claims ? await store.getUser(claims.sub) : null;
      if (!claims || !user || !user.isActive || user.sessionVersion !== claims.sv) {
        clearSessionCookie(req, res);
        return res.status(401).json({ error: 'نشست شما منقضی شده است. دوباره وارد شوید.', code: 'UNAUTHENTICATED' });
      }
      req.user = user;
      next();
    })().catch(next);
  };
}

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role as Role)) {
      logger.security('Forbidden by role', { path: req.path, role: req.user?.role });
      return res.status(403).json({ error: 'دسترسی به این بخش برای نقش شما مجاز نیست.', code: 'FORBIDDEN' });
    }
    next();
  };
}

/**
 * Registers /api/auth/* and /api/users/*. `getStore` must return the store
 * already initialised by the app's store middleware.
 */
export function registerAuthRoutes(app: Express, getStore: () => DataStore) {
  const wrap =
    (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
    (req: Request, res: Response, next: NextFunction) => {
      fn(req, res).catch(next);
    };
  const auth = requireAuth(getStore);

  /** Tells the login screen whether the first administrator still has to be created. */
  app.get(
    '/api/auth/status',
    wrap(async (_req, res) => {
      const store = getStore();
      res.json({
        setupRequired: (await store.countUsers()) === 0,
        setupTokenRequired: !!process.env.SETUP_TOKEN,
      });
    })
  );

  /** First-run: creates the first administrator. Closed as soon as any user exists. */
  app.post(
    '/api/auth/setup',
    wrap(async (req, res) => {
      const store = getStore();
      if ((await store.countUsers()) > 0) {
        return res.status(409).json({ error: 'راه‌اندازی اولیه قبلاً انجام شده است.' });
      }
      const { name, email, password, setupToken } = req.body || {};
      const expected = process.env.SETUP_TOKEN;
      if (
        expected &&
        (typeof setupToken !== 'string' ||
          setupToken.length !== expected.length ||
          !crypto.timingSafeEqual(Buffer.from(setupToken), Buffer.from(expected)))
      ) {
        logger.security('Setup attempted with a wrong token', { ip: req.ip });
        return res.status(403).json({ error: 'کد راه‌اندازی نادرست است.' });
      }
      if (!isName(name)) return res.status(400).json({ error: 'نام را کامل وارد کنید.' });
      if (!isEmail(email)) return res.status(400).json({ error: 'ایمیل معتبر نیست.' });
      const problem = passwordProblem(password);
      if (problem) return res.status(400).json({ error: problem });

      const user = newUser({
        tenantId: DEFAULT_TENANT,
        email,
        name,
        role: 'Admin',
        passwordHash: await hashPassword(password),
        mustChangePassword: false,
      });
      // Re-check just before writing to narrow the race between two first visitors.
      if ((await store.countUsers()) > 0) {
        return res.status(409).json({ error: 'راه‌اندازی اولیه قبلاً انجام شده است.' });
      }
      await store.saveUser({ ...user, lastLoginAt: new Date().toISOString() });
      logger.security('First administrator created', { userId: user.id });
      await startSession(store, req, res, user);
      res.status(201).json({ user: publicUser(user) });
    })
  );

  app.post(
    '/api/auth/login',
    wrap(async (req, res) => {
      const store = getStore();
      const { email, password } = req.body || {};
      const generic = { error: 'ایمیل یا رمز عبور نادرست است.' };

      if (tooManyFromIp(req)) {
        return res.status(429).json({ error: 'تلاش‌های ورود زیاد بوده است. چند دقیقه بعد دوباره امتحان کنید.' });
      }
      if (typeof email !== 'string' || typeof password !== 'string' || password.length > 200) {
        return res.status(400).json(generic);
      }

      const user = await store.getUserByEmail(email);
      if (!user) {
        await verifyPassword(password, await getDecoyHash()); // equalise timing
        return res.status(401).json(generic);
      }
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        return res.status(423).json({
          error: `به دلیل تلاش‌های ناموفق، ورود به این حساب تا ${LOCKOUT_MINUTES} دقیقه قفل شده است.`,
        });
      }

      const ok = await verifyPassword(password, user.passwordHash);
      if (!ok) {
        const failedLogins = (user.failedLogins || 0) + 1;
        const locked = failedLogins >= MAX_FAILED_LOGINS;
        await store.saveUser({
          ...user,
          failedLogins: locked ? 0 : failedLogins,
          lockedUntil: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : user.lockedUntil ?? null,
          updatedAt: new Date().toISOString(),
        });
        logger.security('Failed login', { userId: user.id, locked });
        return res.status(401).json(generic);
      }
      if (!user.isActive) {
        return res.status(403).json({ error: 'این حساب غیرفعال شده است. با مدیر سامانه تماس بگیرید.' });
      }

      const updated: StoredUser = {
        ...user,
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await store.saveUser(updated);
      await startSession(store, req, res, updated);
      res.json({ user: publicUser(updated) });
    })
  );

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', auth, (req, res) => {
    res.json({ user: publicUser(req.user!) });
  });

  app.post(
    '/api/auth/change-password',
    auth,
    wrap(async (req, res) => {
      const store = getStore();
      const { currentPassword, newPassword } = req.body || {};
      const user = req.user!;
      if (typeof currentPassword !== 'string' || !(await verifyPassword(currentPassword, user.passwordHash))) {
        return res.status(400).json({ error: 'رمز عبور فعلی نادرست است.' });
      }
      const problem = passwordProblem(newPassword);
      if (problem) return res.status(400).json({ error: problem });
      if (newPassword === currentPassword) {
        return res.status(400).json({ error: 'رمز عبور جدید باید با رمز فعلی متفاوت باشد.' });
      }
      const updated: StoredUser = {
        ...user,
        passwordHash: await hashPassword(newPassword),
        mustChangePassword: false,
        // Sign out every other device that still holds an old token.
        sessionVersion: user.sessionVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      await store.saveUser(updated);
      await startSession(store, req, res, updated);
      res.json({ user: publicUser(updated) });
    })
  );

  // --- user management (Admin) ------------------------------------------------

  const admin = requireRole('Admin');

  app.get(
    '/api/users',
    auth,
    admin,
    wrap(async (req, res) => {
      const users = await getStore().listUsers(req.user!.tenantId);
      res.json(users.map(publicUser));
    })
  );

  app.post(
    '/api/users',
    auth,
    admin,
    wrap(async (req, res) => {
      const store = getStore();
      const { name, email, role } = req.body || {};
      if (!isName(name)) return res.status(400).json({ error: 'نام را کامل وارد کنید.' });
      if (!isEmail(email)) return res.status(400).json({ error: 'ایمیل معتبر نیست.' });
      if (!isRole(role)) return res.status(400).json({ error: 'نقش انتخاب‌شده معتبر نیست.' });
      if (await store.getUserByEmail(email)) {
        return res.status(409).json({ error: 'کاربری با این ایمیل وجود دارد.' });
      }
      const temporaryPassword = generateTemporaryPassword();
      const user = newUser({
        tenantId: req.user!.tenantId,
        email,
        name,
        role,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      });
      await store.saveUser(user);
      logger.security('User created', { by: req.user!.id, userId: user.id, role });
      // The temporary password is shown to the admin once and never stored in clear.
      res.status(201).json({ user: publicUser(user), temporaryPassword });
    })
  );

  /** Loads a user of the admin's own tenant, or answers 404. */
  async function loadTarget(req: Request, res: Response): Promise<StoredUser | null> {
    const target = await getStore().getUser(req.params.id);
    if (!target || target.tenantId !== req.user!.tenantId) {
      res.status(404).json({ error: 'کاربر پیدا نشد.' });
      return null;
    }
    return target;
  }

  /** Refuses changes that would leave the tenant without an active administrator. */
  async function wouldRemoveLastAdmin(target: StoredUser, next: Partial<StoredUser>): Promise<boolean> {
    const stillAdmin = (next.role ?? target.role) === 'Admin' && (next.isActive ?? target.isActive);
    if (target.role !== 'Admin' || !target.isActive || stillAdmin) return false;
    const admins = (await getStore().listUsers(target.tenantId)).filter((u) => u.role === 'Admin' && u.isActive);
    return admins.length <= 1;
  }

  app.patch(
    '/api/users/:id',
    auth,
    admin,
    wrap(async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      const { name, role, isActive } = req.body || {};
      const changes: Partial<StoredUser> = {};
      if (name !== undefined) {
        if (!isName(name)) return res.status(400).json({ error: 'نام را کامل وارد کنید.' });
        changes.name = name.trim();
      }
      if (role !== undefined) {
        if (!isRole(role)) return res.status(400).json({ error: 'نقش انتخاب‌شده معتبر نیست.' });
        changes.role = role;
      }
      if (isActive !== undefined) {
        if (typeof isActive !== 'boolean') return res.status(400).json({ error: 'وضعیت نامعتبر است.' });
        changes.isActive = isActive;
      }
      if (await wouldRemoveLastAdmin(target, changes)) {
        return res.status(400).json({ error: 'دست‌کم یک مدیر فعال باید باقی بماند.' });
      }
      const updated: StoredUser = {
        ...target,
        ...changes,
        // Role or access changes apply immediately: invalidate existing sessions.
        sessionVersion:
          changes.role !== undefined && changes.role !== target.role || changes.isActive === false
            ? target.sessionVersion + 1
            : target.sessionVersion,
        updatedAt: new Date().toISOString(),
      };
      await getStore().saveUser(updated);
      logger.security('User updated', { by: req.user!.id, userId: target.id, changes: Object.keys(changes) });
      res.json({ user: publicUser(updated) });
    })
  );

  app.post(
    '/api/users/:id/reset-password',
    auth,
    admin,
    wrap(async (req, res) => {
      const target = await loadTarget(req, res);
      if (!target) return;
      const temporaryPassword = generateTemporaryPassword();
      const updated: StoredUser = {
        ...target,
        passwordHash: await hashPassword(temporaryPassword),
        mustChangePassword: true,
        failedLogins: 0,
        lockedUntil: null,
        sessionVersion: target.sessionVersion + 1,
        updatedAt: new Date().toISOString(),
      };
      await getStore().saveUser(updated);
      logger.security('Password reset by admin', { by: req.user!.id, userId: target.id });
      res.json({ user: publicUser(updated), temporaryPassword });
    })
  );
}
