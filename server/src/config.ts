import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Repository root — two levels up from `server/src`. */
export const PROJECT_ROOT = path.resolve(__dirname, '../..');

/**
 * Writable data directory. Point `DATA_DIR` at a mounted volume (Railway,
 * Fly.io, Render disk) so JSON stores, logs and uploads survive redeploys.
 * Defaults to `<repo>/data` for local development.
 */
export const DATA_DIR = path.resolve(PROJECT_ROOT, process.env.DATA_DIR || 'data');

/** Directory holding the built frontend that the API serves in production. */
export const CLIENT_DIST_DIR = path.resolve(PROJECT_ROOT, process.env.CLIENT_DIST_DIR || 'dist');

export const PORT = Number(process.env.PORT) || 3001;
export const HOST = process.env.HOST || '0.0.0.0';

/**
 * Comma-separated list of browser origins allowed to call the API. Empty (the
 * default) means "reflect any origin", which is what local development and a
 * single-origin deployment need; set it once the frontend has a fixed domain.
 */
export const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** Whether the API should also serve the built frontend from CLIENT_DIST_DIR. */
export const SERVE_CLIENT = process.env.SERVE_CLIENT !== 'false';

/**
 * Creates a directory, reporting failure instead of throwing. Managed hosts
 * sometimes expose a read-only filesystem; the API must still start and serve
 * reads rather than crash on boot.
 */
export function ensureDir(dir: string): boolean {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}

/**
 * Writes JSON through a temporary file and renames it into place, so a crash
 * mid-write cannot leave a truncated store behind.
 */
export function writeJsonAtomic(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
