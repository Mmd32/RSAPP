/**
 * Permissions — the single list shared by the server (which enforces them)
 * and the app (which only hides what would be refused).
 *
 * A role is a starting template. An administrator can then grant or remove
 * any individual permission per person; the user record stores the result.
 * No imports here: the server loads this file directly.
 */

export const PERMISSIONS = [
  'visits.fill',
  'visits.viewAll',
  'visits.review',
  'reports.view',
  'actions.view',
  'actions.manage',
  'actions.resolve',
  'actions.verify',
  'catalog.manage',
  'users.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const PERMISSION_INFO: Record<Permission, { group: string; label: string; hint: string }> = {
  'visits.fill': {
    group: 'پرسشنامه‌ها',
    label: 'ثبت و تکمیل پرسشنامه',
    hint: 'شروع بازدید جدید، پاسخ به سؤال‌ها و ارسال برای سرپرست',
  },
  'visits.viewAll': {
    group: 'پرسشنامه‌ها',
    label: 'دیدن پرسشنامه‌های همه',
    hint: 'بدون این دسترسی، هر نفر فقط پرسشنامه‌های خودش را می‌بیند',
  },
  'visits.review': {
    group: 'پرسشنامه‌ها',
    label: 'بازبینی و تأیید پرسشنامه‌ها',
    hint: 'کارتابل سرپرست: تأیید نهایی یا بازگرداندن به ارزیاب',
  },
  'reports.view': {
    group: 'گزارش‌ها',
    label: 'گزارش، بایگانی و مقایسه',
    hint: 'دیدن گزارش و رادار، بایگانی پرسشنامه‌ها و مقایسهٔ بازدیدها',
  },
  'actions.view': {
    group: 'اقدامات اصلاحی',
    label: 'دیدن اقدامات اصلاحی',
    hint: 'دسترسی به کارتابل اقدامات اصلاحی',
  },
  'actions.manage': {
    group: 'اقدامات اصلاحی',
    label: 'ایجاد و تخصیص اقدام',
    hint: 'تعریف اقدام، تعیین مسئول، اولویت و مهلت',
  },
  'actions.resolve': {
    group: 'اقدامات اصلاحی',
    label: 'ثبت رفع نقص',
    hint: 'اعلام انجام اقدام با توضیح و عکس بعد',
  },
  'actions.verify': {
    group: 'اقدامات اصلاحی',
    label: 'راستی‌آزمایی و بازگشایی',
    hint: 'تأیید رفع نقص یا بازگشایی اقدام (کسی نمی‌تواند کار خودش را تأیید کند)',
  },
  'catalog.manage': {
    group: 'تنظیمات',
    label: 'بانک شاخص‌ها، مدیریت برندها و تست سناریو',
    hint: 'ابزارهای مدیریتی فرم ارزیابی',
  },
  'users.manage': {
    group: 'تنظیمات',
    label: 'مدیریت کاربران و دسترسی‌ها',
    hint: 'تعریف نفرات، تعیین دسترسی، غیرفعال‌سازی و رمز جدید',
  },
};

export const ROLE_DEFAULT_PERMISSIONS: Record<string, Permission[]> = {
  Admin: [...PERMISSIONS],
  Supervisor: [
    'visits.fill',
    'visits.viewAll',
    'visits.review',
    'reports.view',
    'actions.view',
    'actions.manage',
    'actions.verify',
    'catalog.manage',
  ],
  // Field evaluators only record; reports are for the project and the brand.
  Evaluator: ['visits.fill'],
  Manager: ['visits.viewAll', 'reports.view', 'actions.view', 'actions.manage', 'actions.resolve'],
  Owner: ['visits.viewAll', 'reports.view', 'actions.view', 'actions.resolve'],
  Verifier: ['visits.viewAll', 'reports.view', 'actions.view', 'actions.verify'],
};

export function isPermission(value: unknown): value is Permission {
  return typeof value === 'string' && (PERMISSIONS as readonly string[]).includes(value);
}

/** Effective permissions: the user's own list when customised, else the role's. */
export function effectivePermissions(user: { role?: string; permissions?: string[] | null }): Permission[] {
  if (Array.isArray(user.permissions)) return user.permissions.filter(isPermission);
  return ROLE_DEFAULT_PERMISSIONS[user.role || ''] || [];
}

export function hasPermission(
  user: { role?: string; permissions?: string[] | null } | null | undefined,
  permission: Permission
): boolean {
  return !!user && effectivePermissions(user).includes(permission);
}

/** Whether a stored list differs from the role template. */
export function isCustomised(role: string, permissions: string[] | null | undefined): boolean {
  if (!Array.isArray(permissions)) return false;
  const base = new Set(ROLE_DEFAULT_PERMISSIONS[role] || []);
  return permissions.length !== base.size || permissions.some((p) => !base.has(p as Permission));
}
