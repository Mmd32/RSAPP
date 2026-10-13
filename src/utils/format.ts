import { MALL_JOURNEY_ORDER, STORE_JOURNEY_ORDER } from '../engine/ruleEngine';
/**
 * Presentation helpers for Persian output.
 *
 * The app showed raw ISO dates (`2026-09-30`) and Latin digits beside Persian
 * ones in the same table, which reads as unfinished to the audience this is
 * sold to. Everything user-facing goes through here so one rule applies
 * everywhere.
 */

const FA_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

/** Rewrites Latin digits as Persian ones, leaving everything else alone. */
export function faDigits(value: string | number): string {
  return String(value).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

/** Thousands-separated Persian number, e.g. 12500 -> ۱۲٬۵۰۰ */
export function faNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('fa-IR').format(value);
}

/** Percentage with no decimals, e.g. 0.5 is passed as 50 -> ٪۵۰ */
export function faPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `٪${faDigits(Math.round(value))}`;
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Jalali date, e.g. ۸ مهر ۱۴۰۵ */
export function faDate(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/** Jalali date with time, e.g. ۸ مهر ۱۴۰۵ ساعت ۱۶:۳۵ */
export function faDateTime(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  const date = faDate(d);
  const time = new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${date} ساعت ${time}`;
}

/** Compact Jalali date for dense tables, e.g. ۱۴۰۵/۰۷/۰۸ */
export function faDateShort(value: string | number | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * How far a due date is from now, in the product's own voice.
 * Deadlines are the thing a supervisor scans for, so "۳ روز گذشته" carries
 * more than a date they have to subtract in their head.
 */
export function faDueLabel(value: string | number | Date | null | undefined): {
  text: string;
  state: 'overdue' | 'today' | 'soon' | 'later' | 'none';
} {
  const d = toDate(value);
  if (!d) return { text: '—', state: 'none' };

  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);

  if (days < 0) return { text: `${faDigits(Math.abs(days))} روز گذشته`, state: 'overdue' };
  if (days === 0) return { text: 'امروز', state: 'today' };
  if (days === 1) return { text: 'فردا', state: 'soon' };
  if (days <= 7) return { text: `${faDigits(days)} روز دیگر`, state: 'soon' };
  return { text: faDateShort(d), state: 'later' };
}

/**
 * Departments, statuses and priorities are stored as English enum values
 * because that is what the API and the database speak. What the auditor reads
 * is a different question, so the display name lives here and the stored value
 * never changes.
 */
export const DEPARTMENT_LABEL: Record<string, string> = {
  'Branch Manager': 'مدیر شعبه',
  Operations: 'عملیات',
  Maintenance: 'تاسیسات و نگهداری',
  Marketing: 'مارکتینگ و ویترین',
  HR: 'منابع انسانی',
  IT: 'فناوری اطلاعات',
  Other: 'سایر',
};

export function departmentLabel(value?: string): string {
  if (!value) return '—';
  return DEPARTMENT_LABEL[value] || value;
}

/** Persian name for a customer-journey stage code (APPROACH, STAFF_INTERACTION…). */
export function stageLabel(stage: string | undefined | null): string {
  if (!stage) return '—';
  return STORE_JOURNEY_ORDER[stage]?.labelFa || MALL_JOURNEY_ORDER[stage]?.labelFa || stage;
}

const STORE_PROFILE_LABEL: Record<string, string> = {
  // Location context
  STREET_STORE: 'فروشگاه واقع در خیابان',
  MALL_STORE: 'فروشگاه داخل مرکز خرید',
  // No longer offered in the wizard; kept so older visits still read well.
  FOOD_COURT: 'غرفه فودکورت',
  STANDALONE: 'فروشگاه مستقل بزرگ',
  // Store format (SHOP_IN_SHOP / KIOSK are shared with location)
  FLAGSHIP: 'شعبه پرچمدار',
  CHAIN: 'شعبه زنجیره‌ای',
  BOUTIQUE: 'بوتیک',
  SHOP_IN_SHOP: 'شاپ این شاپ',
  KIOSK: 'کیوسک / پاپ‌آپ',
  // Business type
  Fashion: 'پوشاک',
  Shoe_Bag: 'کیف و کفش',
  Watch_Jewelry: 'ساعت و طلا',
  FMCG: 'تندمصرف',
  F_B: 'کافه و غذا',
  Hardware: 'ابزار و یراق',
  Homeware: 'لوازم خانگی',
  Beauty_Cosmetics: 'آرایشی و زیبایی',
  Electronics: 'الکترونیک و دیجیتال',
  Entertainment: 'سرگرمی و اسباب‌بازی',
  Sports: 'لوازم ورزشی',
  Specialty: 'کالای تخصصی',
  Services: 'خدمات و پشتیبانی',
  // Mall type
  SM: 'مرکز خرید محلی',
  Neighborhood: 'مرکز تجاری محله‌ای',
  Community: 'مرکز خرید منطقه‌ای',
  Regional: 'مرکز خرید منطقه‌ای بزرگ',
  Super_Regional: 'مرکز خرید فرامنطقه‌ای',
};

/** Persian name for a store/mall profile code (location, format, business or mall type). */
export function profileLabel(code: string | undefined | null): string {
  if (!code) return '—';
  return STORE_PROFILE_LABEL[code] || code;
}

/** Persian names for the indicator groups that the store catalog stores in English. */
const GROUP_LABEL: Record<string, string> = {
  FLOOR: 'محوطه فروشگاه',
  TEAM: 'تیم فروشگاه',
  PRODUCT: 'محصول',
  CASH: 'صندوق',
  SERVICES: 'کیفیت سرویس',
};

export function groupLabel(group: string | undefined | null): string {
  if (!group) return '—';
  return GROUP_LABEL[group] || group;
}
