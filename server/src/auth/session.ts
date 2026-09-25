import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { DataStore } from '../store/index.js';

export const SESSION_COOKIE = 'rsapp_session';
/** Field evaluators should not be logged out mid-week; tokens are revocable via sessionVersion. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface SessionClaims {
  /** User id. */
  sub: string;
  /** Matches StoredUser.sessionVersion; bumping it revokes older tokens. */
  sv: number;
  iat: number;
  exp: number;
}

let keyPromise: Promise<Buffer> | null = null;

/**
 * Signing key: AUTH_SECRET when set, otherwise a random key generated once and
 * kept in the database, so a deployment works without extra configuration and
 * every serverless instance agrees on the same key.
 */
export function getSigningKey(store: DataStore): Promise<Buffer> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const fromEnv = process.env.AUTH_SECRET;
      if (fromEnv && fromEnv.length >= 32) return Buffer.from(fromEnv, 'utf8');
      const generated = crypto.randomBytes(48).toString('base64');
      const stored = await store.setSettingIfAbsent('auth_signing_key', generated);
      return Buffer.from(stored, 'base64');
    })().catch((e) => {
      keyPromise = null;
      throw e;
    });
  }
  return keyPromise;
}

const b64url = (buf: Buffer) => buf.toString('base64url');

export function signSession(claims: SessionClaims, key: Buffer): string {
  const payload = b64url(Buffer.from(JSON.stringify(claims), 'utf8'));
  const sig = b64url(crypto.createHmac('sha256', key).update(payload).digest());
  return `${payload}.${sig}`;
}

export function verifySession(token: string, key: Buffer): SessionClaims | null {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', key).update(payload).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SessionClaims;
    if (typeof claims.exp !== 'number' || claims.exp * 1000 < Date.now()) return null;
    if (typeof claims.sub !== 'string' || typeof claims.sv !== 'number') return null;
    return claims;
  } catch {
    return null;
  }
}

export function readSessionCookie(req: Request): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/** Secure is on whenever the request reached us over HTTPS (Vercel, Render...). */
function isHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const attrs = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_TTL_SECONDS}`,
  ];
  if (isHttps(req)) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}

export function clearSessionCookie(req: Request, res: Response): void {
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isHttps(req)) attrs.push('Secure');
  res.append('Set-Cookie', attrs.join('; '));
}
