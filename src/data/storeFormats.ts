import type { LocationContextCode } from '../types';

export interface StoreFormatOption {
  code: LocationContextCode;
  label: string;
  desc: string;
}

const STREET: StoreFormatOption = { code: 'STREET_STORE', label: 'فروشگاه واقع در خیابان', desc: 'واحد مستقل با دید مستقیم از پیاده‌رو شهری' };

/** Store formats offered for a sector; each one has its own checklist workbook (the format's X column). */
const FORMATS_BY_SECTOR: Record<string, StoreFormatOption[]> = {
  F_B: [
    { code: 'RESTAURANT', label: 'رستوران', desc: 'رستوران با سالن پذیرایی' },
    { code: 'COFFEE_SHOP', label: 'کافی‌شاپ', desc: 'کافه یا کافی‌شاپ' },
    { ...STREET, label: 'فروشگاه واقع شده در خیابان', desc: 'واحد مستقل با دید مستقیم از پیاده‌رو شهری (Stand alone)' },
    { code: 'FOOD_COURT', label: 'فود کورت', desc: 'غرفه داخل فودکورت' },
    { code: 'TABLE_SERVICE', label: 'پذیرایی سر میز (Table Service)', desc: 'سفارش‌گیری و سرو سر میز' },
    { code: 'COUNTER_SERVICE', label: 'سفارش از پیشخوان (Counter Service)', desc: 'سفارش و تحویل در پیشخوان' },
  ],
};

const DEFAULT_FORMATS: StoreFormatOption[] = [
  STREET,
  { code: 'MALL_STORE', label: 'فروشگاه داخل مرکز خرید', desc: 'واحد تجاری مستقر در راهروها یا طبقات مرکز خرید' },
  { code: 'SHOP_IN_SHOP', label: 'شاپ این شاپ', desc: 'غرفه داخل دیپارتمنت‌استور یا فروشگاه زنجیره‌ای' },
  { code: 'KIOSK', label: 'کیوسک / پاپ‌آپ', desc: 'کیوسک یا غرفهٔ پاپ‌آپ در کریدور یا فضای باز' },
];

export const storeFormatsFor = (sector: string | undefined): StoreFormatOption[] =>
  (sector && FORMATS_BY_SECTOR[sector]) || DEFAULT_FORMATS;
