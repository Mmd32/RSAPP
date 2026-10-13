export type Role = 'Admin' | 'Supervisor' | 'Evaluator' | 'Manager' | 'Owner' | 'Verifier';

export const ROLE_LABEL: Record<Role, string> = {
  Admin: 'مسئول پروژه',
  Supervisor: 'سرپرست ارزیابی',
  Evaluator: 'ارزیاب میدانی',
  Manager: 'مدیر برند / شعبه',
  Owner: 'مسئول رفع نقص',
  Verifier: 'راستی‌آزما',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: 'دسترسی کامل به همه‌ی بخش‌ها، گزارش‌ها و تعریف نفرات و دسترسی‌ها',
  Supervisor: 'ارزیابی، بازبینی و تأیید پرسشنامه‌ها و اقدامات اصلاحی',
  Evaluator: 'فقط ثبت، تکمیل و ارسال پرسشنامه؛ بدون دسترسی به گزارش‌ها',
  Manager: 'مشاهدهٔ گزارش‌ها و مدیریت اقدامات اصلاحی',
  Owner: 'مشاهدهٔ گزارش‌ها و رفع نقص‌های محول‌شده',
  Verifier: 'مشاهدهٔ گزارش‌ها و راستی‌آزمایی اقدامات',
};

export const ROLES: Role[] = ['Admin', 'Supervisor', 'Evaluator', 'Manager', 'Owner', 'Verifier'];

import { hasPermission } from './permissions';

/**
 * What a person sees in the interface, from their effective permissions.
 * The server enforces the same rules; this only keeps people from being
 * offered things they would be refused.
 */
export function capabilities(user: { role?: string; permissions?: string[] | null } | null | undefined) {
  const has = (p: Parameters<typeof hasPermission>[1]) => hasPermission(user, p);
  return {
    fieldWork: has('visits.fill'),
    review: has('visits.review'),
    reports: has('reports.view'),
    actions: has('actions.view'),
    createActions: has('actions.manage'),
    resolveActions: has('actions.resolve') || has('actions.manage'),
    verifyActions: has('actions.verify'),
    adminTools: has('catalog.manage'),
    manageUsers: has('users.manage'),
  };
}

export type Capabilities = ReturnType<typeof capabilities>;
