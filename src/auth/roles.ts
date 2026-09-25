export type Role = 'Admin' | 'Supervisor' | 'Evaluator' | 'Manager' | 'Owner' | 'Verifier';

export const ROLE_LABEL: Record<Role, string> = {
  Admin: 'مدیر سامانه',
  Supervisor: 'سرپرست ارزیابی',
  Evaluator: 'ارزیاب میدانی',
  Manager: 'مدیر برند / شعبه',
  Owner: 'مسئول رفع نقص',
  Verifier: 'راستی‌آزما',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  Admin: 'همهٔ بخش‌ها و مدیریت کاربران',
  Supervisor: 'ارزیابی، بازبینی و تأیید پرسشنامه‌ها و اقدامات اصلاحی',
  Evaluator: 'تکمیل و ارسال پرسشنامه‌های خود',
  Manager: 'مشاهدهٔ گزارش‌ها و مدیریت اقدامات اصلاحی',
  Owner: 'مشاهدهٔ گزارش‌ها و رفع نقص‌های محول‌شده',
  Verifier: 'مشاهدهٔ گزارش‌ها و راستی‌آزمایی اقدامات',
};

export const ROLES: Role[] = ['Admin', 'Supervisor', 'Evaluator', 'Manager', 'Owner', 'Verifier'];

/**
 * What each role sees in the interface. The server enforces the same rules;
 * this only keeps people from being offered things they would be refused.
 */
export function capabilities(role: string | undefined) {
  const r = (role || '') as Role;
  return {
    fieldWork: r === 'Admin' || r === 'Supervisor' || r === 'Evaluator',
    review: r === 'Admin' || r === 'Supervisor',
    adminTools: r === 'Admin' || r === 'Supervisor',
    manageUsers: r === 'Admin',
    // Mirrors canCreateActions in server/src/types/actions.ts.
    createActions: r === 'Admin' || r === 'Supervisor' || r === 'Manager',
  };
}
