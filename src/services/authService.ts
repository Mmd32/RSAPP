import { apiFetch } from './apiClient';
import type { Role } from '../auth/roles';
import type { Permission } from '../auth/permissions';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: Role;
  /** Effective permissions (role template or the person's custom list). */
  permissions: Permission[];
  customPermissions: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await apiFetch(path, init);
  } catch {
    throw new ApiError('اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.', 0);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.error || 'خطای غیرمنتظره رخ داد.', res.status);
  return body as T;
}

const post = <T>(path: string, body?: unknown) =>
  call<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const AuthService = {
  status: () => call<{ setupRequired: boolean; setupTokenRequired: boolean }>('/auth/status'),
  me: () => call<{ user: AuthUser }>('/auth/me').then((r) => r.user),
  login: (email: string, password: string) =>
    post<{ user: AuthUser }>('/auth/login', { email, password }).then((r) => r.user),
  setup: (fields: { name: string; email: string; password: string; setupToken?: string }) =>
    post<{ user: AuthUser }>('/auth/setup', fields).then((r) => r.user),
  logout: () => post<{ ok: true }>('/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<{ user: AuthUser }>('/auth/change-password', { currentPassword, newPassword }).then((r) => r.user),

  listUsers: () => call<AuthUser[]>('/users'),
  createUser: (fields: { name: string; email: string; role: Role; permissions?: Permission[] }) =>
    post<{ user: AuthUser; temporaryPassword: string }>('/users', fields),
  updateUser: (
    id: string,
    fields: Partial<Pick<AuthUser, 'name' | 'role' | 'isActive'>> & { permissions?: Permission[] | null }
  ) =>
    call<{ user: AuthUser }>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(fields) }).then(
      (r) => r.user
    ),
  resetPassword: (id: string) =>
    post<{ user: AuthUser; temporaryPassword: string }>(`/users/${encodeURIComponent(id)}/reset-password`),
};
