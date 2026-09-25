import crypto from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// N=2^15 costs ~50-100ms per check: slow enough to blunt offline guessing,
// fast enough for a serverless login. maxmem must cover 128*N*r bytes.
const PARAMS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

/** Hash format: scrypt$N$r$p$saltB64$hashB64 — self-describing so costs can change later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, PARAMS);
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: PARAMS.maxmem,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/**
 * A hash of a random password, verified against when the email is unknown so
 * that a failed login takes the same time whether or not the account exists.
 */
let decoyHash: Promise<string> | null = null;
export function getDecoyHash(): Promise<string> {
  if (!decoyHash) decoyHash = hashPassword(crypto.randomBytes(16).toString('hex'));
  return decoyHash;
}

/** Returns a Persian error message, or null when the password is acceptable. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string') return 'رمز عبور وارد نشده است.';
  if (password.length < 8) return 'رمز عبور باید دست‌کم ۸ کاراکتر باشد.';
  if (password.length > 200) return 'رمز عبور بیش از حد طولانی است.';
  if (!/\p{L}/u.test(password) || !/\p{N}/u.test(password)) {
    return 'رمز عبور باید هم حرف و هم عدد داشته باشد.';
  }
  return null;
}

/** Readable one-time password for an admin to hand over (no 0/O, 1/l). */
export function generateTemporaryPassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(12);
  let out = '';
  for (const b of bytes) out += alphabet[b % alphabet.length];
  // Guarantee at least one digit so it passes passwordProblem().
  return out.slice(0, 10) + String(2 + (bytes[0] % 8));
}
