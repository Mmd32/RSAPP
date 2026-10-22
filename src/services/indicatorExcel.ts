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

/**
 * The layout follows the Nima checklist template: گروه | کد | موضوع | KPI, then one
 * column per retail sector with an X where the KPI applies. A second sheet holds the
 * mall-centre indicators with one column per mall type. The columns after the
 * sector columns are the ones only this app uses.
 */
export const COLUMNS = {
  group: 'گروه',
  code: 'کد',
  subject: 'موضوع',
  statement: 'KPI',
  note: 'نکته برای ارزیاب',
  photo: 'عکس الزامی',
  comment: 'توضیح الزامی',
  status: 'وضعیت',
  id: 'شناسه (تغییر ندهید)',
} as const;

/** Header text of the sector / mall-type columns, as in the template. */
const SECTOR_HEADER: Record<string, string> = {
  Fashion: 'Fashion', Shoe_Bag: 'Shoe & Bag', Watch_Jewelry: 'Watch & Jewelry', FMCG: 'FMCG', F_B: 'F&B',
  Hardware: 'Hardware', Homeware: 'Homeware', Beauty_Cosmetics: 'Beauty/Cosmetics', Electronics: 'Electronics',
  Entertainment: 'Entertainment', Sports: 'Sports', Specialty: 'Specialty', Services: 'Services',
  SM: 'SM', Neighborhood: 'Neighborhood', Community: 'Community', Regional: 'Regional', Super_Regional: 'Super Regional',
};
const STORE_SHEET = 'فروشگاه';
const MALL_SHEET = 'مرکز خرید';

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
  return (
    codes.find((c) => [c, c.replace(/_/g, ' '), SECTOR_HEADER[c], profileLabel(c), groupLabel(c)].some((x) => x && fold(x) === f)) || null
  );
}

export type PlanAction = 'create' | 'update' | 'update-file' | 'same' | 'error';

export interface PlanRow {
  line: number;
  /** Sheet name, shown when the workbook has several. */
  sheet?: string;
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

const zoneCell = (zone: string) => `${groupLabel(zone)}\n\n${zone}`;

function fillSheet(ExcelJS: any, wb: any, name: string, template: 'STORE' | 'MALL', rows: Indicator[], example: boolean) {
  const universe = template === 'STORE' ? SECTORS : MALL_TYPES;
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });
  const fixed = [
    { header: COLUMNS.group, key: 'group', width: 29 },
    { header: COLUMNS.code, key: 'code', width: 10 },
    { header: COLUMNS.subject, key: 'subject', width: 30 },
    { header: COLUMNS.statement, key: 'statement', width: 80 },
  ];
  const marks = universe.map((u) => ({ header: SECTOR_HEADER[u], key: u, width: 13 }));
  const extra = [
    { header: COLUMNS.note, key: 'note', width: 40 },
    { header: COLUMNS.photo, key: 'photo', width: 11 },
    { header: COLUMNS.comment, key: 'comment', width: 12 },
    { header: COLUMNS.status, key: 'status', width: 10 },
    { header: COLUMNS.id, key: 'id', width: 16 },
  ];
  ws.columns = [...fixed, ...marks, ...extra];
  const mark = (list: string[] | undefined, u: string) => (!list?.length || list.includes(u) ? 'X' : '');
  for (const i of rows) {
    ws.addRow({
      group: template === 'STORE' ? zoneCell(i.group) : i.group,
      code: i.code,
      subject: i.subject,
      statement: i.statement,
      note: i.auditorNote || '',
      photo: i.requiresPhoto ? 'بله' : 'خیر',
      comment: i.requiresComment ? 'بله' : 'خیر',
      status: i.disabled ? 'غیرفعال' : 'فعال',
      id: i.id,
      ...Object.fromEntries(universe.map((u) => [u, mark(template === 'STORE' ? i.applicableBusinessTypes : i.applicableMallTypes, u)])),
    });
  }
  if (example) {
    ws.addRow({
      group: template === 'STORE' ? zoneCell('PRODUCT') : 'گروه نمونه', code: '', subject: 'نمونه: موضوع شاخص',
      statement: 'نمونه: متنی که ارزیاب می‌خواند.', note: '', photo: 'خیر', comment: 'خیر', status: 'فعال', id: '',
      ...Object.fromEntries(universe.map((u) => [u, 'X'])),
    });
  }
  const head = ws.getRow(1);
  head.font = { bold: true };
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  ws.getColumn('group').alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn('statement').alignment = { wrapText: true, vertical: 'top' };
  ws.getColumn('note').alignment = { wrapText: true, vertical: 'top' };
  universe.forEach((u) => (ws.getColumn(u).alignment = { horizontal: 'center', vertical: 'top' }));
}

export async function downloadWorkbook(indicators: Indicator[], mode: 'all' | 'template') {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const list = indicators.filter((i) => i.status !== 'ARCHIVED' || i.disabled);
  const stores = mode === 'template' ? [] : list.filter((i) => i.template === 'STORE');
  const malls = mode === 'template' ? [] : list.filter((i) => i.template === 'MALL');
  fillSheet(ExcelJS, wb, STORE_SHEET, 'STORE', stores, mode === 'template');
  fillSheet(ExcelJS, wb, MALL_SHEET, 'MALL', malls, mode === 'template');

  if (mode === 'template') {
    const help = wb.addWorksheet('راهنما', { views: [{ rightToLeft: true }] });
    help.columns = [{ width: 28 }, { width: 100 }];
    [
      ['ستون', 'توضیح'],
      ['برگه‌ها', 'برگهٔ «فروشگاه» برای شاخص‌های فروشگاه و برگهٔ «مرکز خرید» برای شاخص‌های مرکز خرید. هر ردیف یک شاخص است.'],
      [COLUMNS.group, 'فروشگاه: یکی از ' + ZONES.map(groupLabel).join('، ') + ' (یا کد انگلیسی FLOOR، SERVICES، TEAM، PRODUCT، CASH). اگر خالی باشد، گروه ردیف بالا برداشته می‌شود. مرکز خرید: نام گروه.'],
      [COLUMNS.code, 'خالی بگذارید تا کد خودکار (U001، U002 …) داده شود. کد شاخص موجود = ویرایش همان شاخص.'],
      [COLUMNS.subject, 'شاخص کنار شاخص‌های همین موضوع قرار می‌گیرد.'],
      [COLUMNS.statement, 'متنی که ارزیاب در پرسشنامه می‌بیند.'],
      ['ستون‌های سکتور / نوع مرکز', 'هر جا شاخص مشمول است X بگذارید و در غیر این صورت خالی بگذارید (مثل قالب نیما).'],
      [COLUMNS.note, 'اختیاری؛ زیر شاخص به ارزیاب نشان داده می‌شود.'],
      [COLUMNS.photo + ' / ' + COLUMNS.comment, 'بله یا خیر.'],
      [COLUMNS.status, 'فعال یا غیرفعال.'],
      [COLUMNS.id, 'برای شاخص‌های موجود پر است؛ تغییرش ندهید. برای شاخص تازه خالی بماند.'],
      ['شاخص‌های فایل چک‌لیست', 'فقط «KPI»، «نکته» و «وضعیت» آن‌ها با اکسل تغییر می‌کند؛ دامنهٔ سکتورها و گروه ثابت است.'],
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

const HEADER_NAMES: Record<keyof typeof COLUMNS, string[]> = {
  group: ['گروه', 'منطقه / گروه'],
  code: ['کد'],
  subject: ['موضوع'],
  statement: ['kpi', 'متن شاخص'],
  note: ['نکته برای ارزیاب'],
  photo: ['عکس الزامی'],
  comment: ['توضیح الزامی'],
  status: ['وضعیت'],
  id: ['شناسه (تغییر ندهید)', 'شناسه'],
};

interface Layout {
  headerRow: number;
  template: 'STORE' | 'MALL';
  cols: Partial<Record<keyof typeof COLUMNS, number>>;
  scope: { code: string; col: number }[];
}

function findLayout(ws: any, sheetName: string): Layout | null {
  for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
    const names = new Map<string, number>();
    ws.getRow(r).eachCell((cell: any, col: number) => names.set(fold(cellText(cell.value)), col));
    const cols: Layout['cols'] = {};
    (Object.keys(HEADER_NAMES) as (keyof typeof COLUMNS)[]).forEach((k) => {
      const hit = HEADER_NAMES[k].map((n) => names.get(fold(n))).find((c) => c);
      if (hit) cols[k] = hit;
    });
    if (!cols.statement || !cols.code) continue;
    const match = (universe: string[]) =>
      universe.flatMap((u) => {
        const col = names.get(fold(SECTOR_HEADER[u])) ?? names.get(fold(u)) ?? names.get(fold(profileLabel(u)));
        return col ? [{ code: u, col }] : [];
      });
    const storeScope = match(SECTORS);
    const mallScope = match(MALL_TYPES);
    const mallSheet = fold(sheetName).includes('مرکز') || fold(sheetName).includes('mall');
    const isMall = mallSheet ? true : storeScope.length ? false : mallScope.length > 0;
    return { headerRow: r, template: isMall ? 'MALL' : 'STORE', cols, scope: isMall ? mallScope : storeScope };
  }
  return null;
}

export async function planImport(file: File, current: Indicator[]): Promise<Plan> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const sheets = wb.worksheets
    .map((ws: any) => ({ ws, layout: findLayout(ws, ws.name) }))
    .filter((x: any) => x.layout && x.ws.state !== 'hidden');
  if (!sheets.length) throw new Error('ستون‌های «کد» و «KPI» در هیچ برگه‌ای پیدا نشد. از «دانلود قالب» استفاده کنید.');

  const byId = new Map(current.map((i) => [i.id, i]));
  const codeCount = new Map<string, number>();
  current.forEach((i) => codeCount.set(i.code.toLowerCase(), (codeCount.get(i.code.toLowerCase()) || 0) + 1));
  const byCode = new Map(current.map((i) => [i.code.toLowerCase(), i]));
  const seen = new Set<string>();
  const rows: PlanRow[] = [];

  for (const { ws, layout } of sheets as { ws: any; layout: Layout }[]) {
    const { cols } = layout;
    const multiSheet = sheets.length > 1;
    let lastGroup = '';
    for (let r = layout.headerRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const get = (k: keyof typeof COLUMNS) => (cols[k] ? norm(cellText(row.getCell(cols[k]!).value)) : '');
      const raw = (k: keyof typeof COLUMNS) => (cols[k] ? cellText(row.getCell(cols[k]!).value).replace(/\s+/g, ' ').trim() : '');
      let groupText = get('group');
      // The template's group column is a "same as above" formula; broken cells fall back to the row above.
      if (!groupText || groupText.includes('#REF')) groupText = lastGroup;
      else lastGroup = groupText;
      const code = get('code');
      const statement = raw('statement');
      if (!code && !statement) continue; // section labels and blank rows
      const base: PlanRow = { line: r, sheet: multiSheet ? ws.name : undefined, action: 'same', code, statement, changes: [] };
      const fail = (error: string) => rows.push({ ...base, action: 'error', error });

      const idText = get('id');
      const byIdTarget = idText ? byId.get(idText) : undefined;
      if (idText && !byIdTarget) { fail('شناسه در بانک شاخص‌ها پیدا نشد؛ ستون شناسه را تغییر ندهید.'); continue; }
      if (!byIdTarget && code) {
        if (!CODE_PATTERN.test(code)) { fail('کد فقط حروف انگلیسی، عدد، خط تیره یا زیرخط و بین ۲ تا ۲۰ نویسه است.'); continue; }
        if (seen.has(code.toLowerCase())) { fail('این کد در فایل تکراری است.'); continue; }
        seen.add(code.toLowerCase());
        if ((codeCount.get(code.toLowerCase()) || 0) > 1) { fail('این کد برای چند شاخص تکراری است؛ ستون «شناسه» را پر کنید.'); continue; }
      }
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
        if (cols.note && note !== (target.auditorNote || '')) {
          if (note.length > 1200) { fail('نکتهٔ ارزیاب حداکثر ۱۲۰۰ نویسه است.'); continue; }
          edit.auditorNote = note || null; changes.push('نکته');
        }
        if (cols.status && get('status') && disabled !== !!target.disabled) { edit.disabled = disabled; changes.push(disabled ? 'غیرفعال‌سازی' : 'فعال‌سازی'); }
        rows.push({ ...base, action: changes.length ? 'update-file' : 'same', target, fileEdit: edit, changes });
        continue;
      }

      // Added-by-hand row (existing) or a new one: all columns.
      const template = target ? target.template : layout.template;
      const subject = get('subject') || target?.subject || '';
      if (!subject) { fail('موضوع خالی است.'); continue; }
      let group = groupText || target?.group || '';
      if (template === 'STORE') {
        const z = ZONES.find((c) => fold(group).includes(fold(c)) || fold(group).includes(fold(groupLabel(c))));
        if (!z) { fail(`گروه «${group.replace(/\s+/g, ' ')}» شناخته نشد. یکی از ${ZONES.map(groupLabel).join('، ')} را بنویسید.`); continue; }
        group = z;
      } else if (!group) { fail('گروه خالی است.'); continue; }
      const text = statement || target?.statement || '';
      if (text.length < 3 || text.length > 600) { fail('متن شاخص باید بین ۳ و ۶۰۰ نویسه باشد.'); continue; }

      const universe = template === 'STORE' ? SECTORS : MALL_TYPES;
      let scope: string[];
      if (layout.scope.length && layout.template === template) {
        scope = layout.scope.filter((s) => norm(cellText(row.getCell(s.col).value))).map((s) => s.code);
        if (!scope.length) { fail(template === 'STORE' ? 'هیچ سکتوری با X مشخص نشده است.' : 'هیچ نوع مرکز خریدی با X مشخص نشده است.'); continue; }
      } else scope = (template === 'STORE' ? target?.applicableBusinessTypes : target?.applicableMallTypes) || universe;

      const flag = (k: 'photo' | 'comment', old: boolean) => {
        const v = get(k);
        if (!cols[k] || (v === '' && target)) return old;
        return yes(v) ? true : no(v) ? false : null;
      };
      const photo = flag('photo', !!target?.requiresPhoto);
      const comment = flag('comment', !!target?.requiresComment);
      if (photo === null || comment === null) { fail('عکس/توضیح الزامی باید «بله» یا «خیر» باشد.'); continue; }
      const note = cols.note ? raw('note') : target?.auditorNote || '';
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
  }

  const count = { create: 0, update: 0, 'update-file': 0, same: 0, error: 0 } as Record<PlanAction, number>;
  rows.forEach((r) => (count[r.action] += 1));
  return { rows, count };
}
