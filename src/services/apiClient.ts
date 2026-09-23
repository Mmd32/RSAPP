/**
 * Central API client.
 *
 * The base URL is resolved once, from `VITE_API_BASE_URL`, and falls back to the
 * relative `/api` prefix. Keeping it relative means the same build works in dev
 * (Vite proxies `/api` to the local backend) and in production when the backend
 * serves the built frontend from the same origin. Set `VITE_API_BASE_URL` at
 * build time only when the backend lives on a different host, e.g.
 * `VITE_API_BASE_URL=https://rsapp-api.onrender.com/api`.
 */
const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '/api').trim();

export const API_BASE_URL = RAW_BASE.replace(/\/+$/, '') || '/api';

/** Builds an absolute-or-relative URL for an API path such as `/actions`. */
export function apiUrl(path: string): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${suffix}`;
}

export interface ApiFetchOptions extends RequestInit {
  /** Sent as `x-tenant-id`; the backend scopes corrective actions by tenant. */
  tenantId?: string;
  /** Sent as `x-user-role`; the backend enforces RBAC on it. */
  userRole?: string;
  /** Sent as `x-user-name`; used for audit logs and self-verification checks. */
  userName?: string;
}

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { tenantId, userRole, userName, headers, ...rest } = options;

  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((headers as Record<string, string>) || {}),
  };
  if (tenantId) mergedHeaders['x-tenant-id'] = tenantId;
  if (userRole) mergedHeaders['x-user-role'] = userRole;
  if (userName) mergedHeaders['x-user-name'] = userName;

  return fetch(apiUrl(path), { ...rest, headers: mergedHeaders });
}

/**
 * Fire-and-forget variant for background sync. The app is offline-first: local
 * state and localStorage are already authoritative, so a failed sync is logged
 * and swallowed rather than surfaced to the field user.
 */
export function apiSync(path: string, options: ApiFetchOptions = {}): void {
  apiFetch(path, options).catch((err) => {
    console.warn(`Backend sync deferred (offline or unreachable): ${path}`, err);
  });
}
