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
  /**
   * Ignored. Identity now comes from the session cookie, which the server
   * verifies; these used to be sent as headers the browser could forge.
   * Kept so existing call sites compile.
   */
  tenantId?: string;
  userRole?: string;
  userName?: string;
}

/** Fired on any 401 from a non-auth endpoint: the session ended or was revoked. */
export const UNAUTHORIZED_EVENT = 'rsapp:unauthorized';

export async function apiFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const { tenantId: _t, userRole: _r, userName: _n, headers, ...rest } = options;

  const res = await fetch(apiUrl(path), {
    // Same-origin in every deployment we ship, so the session cookie rides along.
    credentials: 'same-origin',
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...((headers as Record<string, string>) || {}),
    },
  });
  if (res.status === 401 && !path.startsWith('/auth/')) {
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
  }
  return res;
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
