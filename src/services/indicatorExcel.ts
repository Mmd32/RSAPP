import type { Indicator } from '../types';
import type { CustomIndicatorInput } from './indicatorService';
import { groupLabel, profileLabel } from '../utils/format';

/**
 * Excel in and out of the question bank. One row per indicator; the sheet that
 * is downloaded can be edited and uploaded again. Rows are matched by code:
 *  - a code of the checklist file: wording, note and on/off can change;
 *  - a code of an indicator added by hand: every column can change;
 *  - a new or empty code: a new indicator is added.
 */

export const COLUMNS = {
  code: 'کد',
  template: 'نوع ارزیابی',
  group: 'منطقه / گروه',
  subject: 'موضوع',
  statement: 'متن شاخص',
  note: 'نکته برای ارزیاب',
  scope: 'سکتورها / انواع مرکز خرید',
  photo: 'عکس الزامی',
  comment: 'توضیح الزامی',
  status: 'وضعیت',
  source: 'منبع',
  id: 'شناسه (تغییر ندهید)',
} as const;

const ZONES = ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'];
const SECTORS = [
  'Fashion', 'Shoe_Bag', 'Watch_Jewelry', 'FMCG', 'F_B', 'Hardware', 'Homeware',
  'Beauty_Cosmetics', 'Electronics', 'Entertainment', 'Sports', 'Specialty', 'Services',
];
const MALL_TYPES = ['SM', 'Neighborhood', 'Community', 'Regional', 'Super_Regional'];
const CODE_PATTERN = /^[A-Za-z0-9_-]{2,20}$/;

const norm = (v: unknown) => String(v ?? '').replace(/[‌\s]+/g, ' ').trim();
const fold = (v: unknown) => norm(v).replace(/ي/g, 'ی').replace(/ك/g, 'ک').toLowerCase();
const yes = (v: unknown) => ['بله', 'yes', 'true', '1', '✓'].includes(fold(v));
const no = (v: unknown) => ['', 'خیر', 'no', 'false', '0'].includes(fold(v));

function lookup(value: string, codes: string[]): string | null {
  const f = fold(value);
  return codes.find((c) => fold(c) === f || fold(profileLabel(c)) === f || fold(groupLabel(c)) === f) || null;
}

export type PlanAction = 'create' | 'update' | 'update-file' | 'same' | 'error';

export interface PlanRow {
  line: number;
  action: PlanAction;
  code: string;
  statement: string;
  /** Fixed list of what changes, for the preview. */
  changes: string[];
  error?: string;
  /** Existing indicator for updates. */
  target?: Indicator;
  input?: CustomIndicatorInput;
  fileEdit?: { statement?: string; auditorNote?: string | null; disabled?: boolean };
}

export interface Plan {
  rows: PlanRow[];
  count: Record<PlanAction, number>;
}

export async function downloadWorkbook(indicators: Indicator[], mode: 'all' | 'template') {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('شاخص‌ها', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  const keys = Object.keys(COLUMNS) as (keyof typeof COLUMNS)[];
  ws.columns = keys.map((k) => ({
    header: COLUMNS[k],
    key: k,
    width: { code: 10, template: 12, group: 18, subject: 22, statement: 60, note: 40, scope: 34, photo: 11, comment: 12, status: 10, source: 12, id: 16 }[k],
  }));
  const rows =
    mode === 'template'
      ? [{ code: '', template: 'فروشگاه', group: 'محصول', subject: 'نمونه: موضوع شاخص', statement: 'نمونه: متن شاخص که ارزیاب می‌خواند.', note: '', scope: 'همه', photo: 'خیر', comment: 'خیر', status: 'فعال', source: '', id: '' }]
      : indicators
          .filter((i) => i.status !== 'ARCHIVED' || i.disabled)
          .map((i) => ({
            code: i.code,
            template: i.template === 'STORE' ? 'فروشگاه' : 'مرکز خرید',
            group: i.template === 'STORE' ? groupLabel(i.group) : i.group,
            subject: i.subject,
            statement: i.statement,
            note: i.auditorNote || '',
            scope:
              i.template === 'STORE'
                ? (i.applicableBusinessTypes?.length === SECTORS.length || !i.applicableBusinessTypes?.length ? 'همه' : i.applicableBusinessTypes.map(profileLabel).join('، '))
                : (i.applicableMallTypes?.length === MALL_TYPES.length || !i.applicableMallTypes?.length ? 'همه' : i.applicableMallTypes.map(profileLabel).join('، ')),
            photo: i.requiresPhoto ? 'بله' : 'خیر',
            comment: i.requiresComment ? 'بله' : 'خیر',
            status: i.disabled ? 'غیرفعال' : 'فعال',
            source: i.custom ? 'افزوده‌شده' : 'فایل چک‌لیست',
            id: i.id,
          }));
  rows.forEach((r) => ws.addRow(r));
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getColumn('statement').alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn('note').alignment = { wrapText: true, vertical: 'top' };

  if (mode === 'template') {
    const help = wb.addWorksheet('راهنما', { views: [{ rightToLeft: true }] });
    help.columns = [{ width: 28 }, { width: 90 }];
    [
      ['ستون', 'توضیح'],
      [COLUMNS.code, 'خالی بگذارید تا کد خودکار (U001، U002 …) داده شود. اگر کد یک شاخص موجود را بنویسید، همان شاخص ویرایش می‌شود.'],
      [COLUMNS.template, 'فروشگاه یا مرکز خرید.'],
      [COLUMNS.group, 'برای فروشگاه یکی از: ' + ZONES.map(groupLabel).join('، ') + '. برای مرکز خرید نام گروه.'],
      [COLUMNS.subject, 'موضوع شاخص؛ شاخص کنار شاخص‌های همین موضوع قرار می‌گیرد.'],
      [COLUMNS.statement, 'متنی که ارزیاب در پرسشنامه می‌بیند.'],
      [COLUMNS.note, 'اختیاری؛ زیر شاخص به ارزیاب نشان داده می‌شود.'],
      [COLUMNS.scope, '«همه» یا فهرست جداشده با ویرگول. فروشگاه: ' + SECTORS.map(profileLabel).join('، ') + '. مرکز خرید: ' + MALL_TYPES.map(profileLabel).join('، ')],
      [COLUMNS.photo + ' / ' + COLUMNS.comment, 'بله یا خیر.'],
      [COLUMNS.status, 'فعال یا غیرفعال. شاخص‌های فایل چک‌لیست فقط متن، نکته و وضعیتشان قابل تغییر است.'],
    ].forEach((r) => help.addRow(r));
    help.getRow(1).font = { bold: true };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = mode === 'template' ? 'قالب-افزودن-شاخص.xlsx' : 'شاخص‌ها.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function cellText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map((t: any) => t.text).join('');
    if ('result' in v) return String(v.result ?? '');
    if ('text' in v) return String(v.text ?? '');
  }
  return String(v);
}

export async function planImport(file: File, current: Indicator[]): Promise<Plan> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('فایل اکسل خالی است.');

  const headerIndex = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => headerIndex.set(fold(cellText(cell.value)), col));
  const col = (k: keyof typeof COLUMNS) => headerIndex.get(fold(COLUMNS[k]));
  const missing = (['statement'] as const).filter((k) => !col(k));
  if (missing.length) throw new Error(`ستون «${COLUMNS.statement}» در ردیف اول فایل پیدا نشد. از «دانلود قالب» استفاده کنید.`);

  const byId = new Map(current.map((i) => [i.id, i]));
  const codeCount = new Map<string, number>();
  current.forEach((i) => codeCount.set(i.code.toLowerCase(), (codeCount.get(i.code.toLowerCase()) || 0) + 1));
  const byCode = new Map(current.map((i) => [i.code.toLowerCase(), i]));
  const seen = new Set<string>();
  const rows: PlanRow[] = [];

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k: keyof typeof COLUMNS) => (col(k) ? norm(cellText(row.getCell(col(k)!).value)) : '');
    const raw = (k: keyof typeof COLUMNS) => (col(k) ? cellText(row.getCell(col(k)!).value).replace(/\s+/g, ' ').trim() : '');
    const code = get('code');
    const statement = raw('statement');
    if (!code && !statement && !get('subject')) continue;
    const base: PlanRow = { line: r, action: 'same', code, statement, changes: [] };
    const fail = (error: string) => rows.push({ ...base, action: 'error', error });

    const idText = get('id');
    const byIdTarget = idText ? byId.get(idText) : undefined;
    if (idText && !byIdTarget) { fail('شناسه در بانک شاخص‌ها پیدا نشد؛ ستون شناسه را تغییر ندهید.'); continue; }
    if (!byIdTarget && code) {
      if (!CODE_PATTERN.test(code)) { fail('کد فقط حروف انگلیسی، عدد، خط تیره یا زیرخط و بین ۲ تا ۲۰ نویسه است.'); continue; }
      if (seen.has(code.toLowerCase())) { fail('این کد در فایل تکراری است.'); continue; }
      seen.add(code.toLowerCase());
    }
    if (!byIdTarget && code && (codeCount.get(code.toLowerCase()) || 0) > 1) { fail('این کد برای چند شاخص تکراری است؛ ستون «شناسه» را پر کنید.'); continue; }
    const target = byIdTarget || (code ? byCode.get(code.toLowerCase()) : undefined);
    const statusText = fold(get('status'));
    const disabled = statusText === 'غیرفعال' || statusText === 'disabled';
    if (get('status') && !['فعال', 'غیرفعال', 'active', 'disabled'].includes(statusText)) { fail('وضعیت باید «فعال» یا «غیرفعال» باشد.'); continue; }

    if (target && !target.custom) {
      // Checklist-file row: wording, note, on/off.
      const edit: NonNullable<PlanRow['fileEdit']> = {};
      const changes: string[] = [];
      if (statement && statement !== target.statement) {
        if (statement.length < 3 || statement.length > 600) { fail('متن شاخص باید بین ۳ و ۶۰۰ نویسه باشد.'); continue; }
        edit.statement = statement; changes.push('متن');
      }
      const note = raw('note');
      if (col('note') && note !== (target.auditorNote || '')) {
        if (note.length > 1200) { fail('نکتهٔ ارزیاب حداکثر ۱۲۰۰ نویسه است.'); continue; }
        edit.auditorNote = note || null; changes.push('نکته');
      }
      if (col('status') && get('status') && disabled !== !!target.disabled) { edit.disabled = disabled; changes.push(disabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'); }
      rows.push({ ...base, action: changes.length ? 'update-file' : 'same', target, fileEdit: edit, changes });
      continue;
    }

    // Added-by-hand row (existing) or a new one: all columns.
    const templateText = fold(get('template'));
    const template: 'STORE' | 'MALL' | null = target
      ? target.template
      : ['فروشگاه', 'store'].includes(templateText) ? 'STORE'
      : ['مرکز خرید', 'mall'].includes(templateText) ? 'MALL' : null;
    if (!template) { fail('نوع ارزیابی باید «فروشگاه» یا «مرکز خرید» باشد.'); continue; }
    const subject = get('subject') || target?.subject || '';
    if (!subject) { fail('موضوع خالی است.'); continue; }
    let group = get('group') || target?.group || '';
    if (template === 'STORE') {
      const z = lookup(group, ZONES);
      if (!z) { fail(`منطقه «${group}» شناخته نشد. یکی از ${ZONES.map(groupLabel).join('، ')} را بنویسید.`); continue; }
      group = z;
    } else if (!group) { fail('گروه خالی است.'); continue; }
    const text = statement || target?.statement || '';
    if (text.length < 3 || text.length > 600) { fail('متن شاخص باید بین ۳ و ۶۰۰ نویسه باشد.'); continue; }

    const universe = template === 'STORE' ? SECTORS : MALL_TYPES;
    let scope: string[];
    const scopeText = get('scope');
    if (!scopeText && target) scope = (template === 'STORE' ? target.applicableBusinessTypes : target.applicableMallTypes) || universe;
    else if (!scopeText || fold(scopeText) === 'همه') scope = universe;
    else {
      const parts = scopeText.split(/[,،;؛\n]+/).map((p) => p.trim()).filter(Boolean);
      const found = parts.map((p) => lookup(p, universe));
      const bad = parts.filter((_, i) => !found[i]);
      if (bad.length) { fail(`این موارد شناخته نشد: ${bad.join('، ')}`); continue; }
      scope = [...new Set(found as string[])];
    }
    const flag = (k: 'photo' | 'comment', old: boolean) => {
      const v = get(k);
      if (!col(k) || (v === '' && target)) return old;
      return yes(v) ? true : no(v) ? false : null;
    };
    const photo = flag('photo', !!target?.requiresPhoto);
    const comment = flag('comment', !!target?.requiresComment);
    if (photo === null || comment === null) { fail('عکس/توضیح الزامی باید «بله» یا «خیر» باشد.'); continue; }
    const note = col('note') ? raw('note') : target?.auditorNote || '';
    if (note.length > 1200) { fail('نکتهٔ ارزیاب حداکثر ۱۲۰۰ نویسه است.'); continue; }

    const input: CustomIndicatorInput = {
      template, group, subject, statement: text, auditorNote: note || null,
      applicableBusinessTypes: template === 'STORE' ? scope : [],
      applicableMallTypes: template === 'MALL' ? scope : [],
      requiresPhoto: photo, requiresComment: comment,
      status: disabled ? 'ARCHIVED' : 'ACTIVE',
    };
    if (!target) {
      if (code) input.code = code;
      rows.push({ ...base, action: 'create', input, changes: ['شاخص جدید'] });
      continue;
    }
    const changes: string[] = [];
    if (group !== target.group) changes.push('گروه');
    if (subject !== target.subject) changes.push('موضوع');
    if (text !== target.statement) changes.push('متن');
    if (note !== (target.auditorNote || '')) changes.push('نکته');
    if ([...scope].sort().join() !== [...((template === 'STORE' ? target.applicableBusinessTypes : target.applicableMallTypes) || [])].sort().join()) changes.push('دامنه');
    if (photo !== !!target.requiresPhoto || comment !== !!target.requiresComment) changes.push('عکس/توضیح');
    if ((input.status === 'ARCHIVED') !== !!target.disabled) changes.push(disabled ? 'غیرفعال‌سازی' : 'فعال‌سازی');
    rows.push({ ...base, action: changes.length ? 'update' : 'same', target, input, changes });
  }

  const count = { create: 0, update: 0, 'update-file': 0, same: 0, error: 0 } as Record<PlanAction, number>;
  rows.forEach((r) => (count[r.action] += 1));
  return { rows, count };
}
