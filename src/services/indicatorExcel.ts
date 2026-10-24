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
/** A statement that is only digits is a count from a summary sheet, not an indicator. */
const isCount = (v: string) => /^[\d.,٠-٩۰-۹\s]+$/.test(v);
/** A formula in the KPI column (COUNTIF totals of a summary sheet) is not an indicator. */
const isFormula = (v: any) => !!v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v);
const yes = (v: unknown) => ['بله', 'yes', 'true', '1', '✓'].includes(fold(v));
const no = (v: unknown) => ['', 'خیر', 'no', 'false', '0'].includes(fold(v));

function lookup(value: string, codes: string[]): string | null {
  const f = fold(value);
  return (
    codes.find((c) => [c, c.replace(/_/g, ' '), SECTOR_HEADER[c], profileLabel(c), groupLabel(c)].some((x) => x && fold(x) === f)) || null
  );
}

export type PlanAction = 'create' | 'update' | 'update-file' | 'same' | 'error';

/** One row of the uploaded sheet as the person can still change it before saving. */
export interface Draft {
  key: string;
  line: number;
  sheet?: string;
  /** Unticked rows are not saved. */
  include: boolean;
  /** Set when the sheet carries the indicator's id; cleared when the person changes the code. */
  targetId?: string;
  template: 'STORE' | 'MALL';
  code: string;
  group: string;
  subject: string;
  statement: string;
  note: string;
  scope: string[];
  photo: boolean;
  comment: boolean;
  active: boolean;
  /** Problem found while reading the cell values, shown until the row is edited. */
  readError?: string;
}

export interface PlanRow {
  key: string;
  line: number;
  /** Sheet name, shown when the workbook has several. */
  sheet?: string;
  action: PlanAction;
  code: string;
  statement: string;
  changes: string[];
  error?: string;
  /** Existing indicator for updates. */
  target?: Indicator;
  input?: CustomIndicatorInput;
  fileEdit?: { statement?: string; auditorNote?: string | null; disabled?: boolean };
}

export interface ParsedWorkbook {
  drafts: Draft[];
  notes: string[];
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
    if ('error' in v) return '';
    if ('result' in v) return cellText(v.result);
    if ('text' in v) return String(v.text ?? '');
  }
  return String(v);
}

const HEADER_NAMES: Record<keyof typeof COLUMNS, string[]> = {
  group: ['گروه', 'منطقه / گروه'],
  code: ['کد'],
  subject: ['موضوع'],
  statement: ['kpi', 'شاخص', 'متن شاخص'],
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
    if (!cols.statement) continue; // the code column is optional: a template without one gets automatic codes
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

function dataRows(ws: any, layout: Layout): number {
  let n = 0;
  for (let r = layout.headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const cell = row.getCell(layout.cols.statement!).value;
    const t = norm(cellText(cell));
    if (t && !isCount(t) && !isFormula(cell)) n += 1;
  }
  return n;
}

/** Topic → zone, from the bank and from every sheet that lists group and topic (even hidden ones), for rows whose group cell is broken. */
function topicZones(wb: any, current: Indicator[]): Map<string, string> {
  const map = new Map<string, string>();
  const zoneOf = (text: string) => ZONES.find((c) => fold(text).includes(fold(c)) || fold(text).includes(fold(groupLabel(c))));
  for (const i of current) if (i.template === 'STORE' && !map.has(fold(i.subject))) map.set(fold(i.subject), i.group);
  for (const ws of wb.worksheets as any[]) {
    for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
      let gc = 0, tc = 0;
      ws.getRow(r).eachCell((cell: any, col: number) => {
        const t = fold(cellText(cell.value));
        if (t === 'گروه') gc = col;
        if (t === 'موضوع') tc = col;
      });
      if (!gc || !tc) continue;
      let group = '', topic = '';
      for (let k = r + 1; k <= ws.rowCount; k++) {
        const g = norm(cellText(ws.getRow(k).getCell(gc).value));
        const t = norm(cellText(ws.getRow(k).getCell(tc).value));
        if (g && !g.includes('#REF')) group = g;
        if (t && !t.includes('#REF')) topic = t;
        const z = zoneOf(group);
        if (topic && z && !map.has(fold(topic))) map.set(fold(topic), z);
      }
      break;
    }
  }
  return map;
}

/** Text of the Excel note (the red triangle) on a cell, without the author's name Excel puts in front. */
function noteText(cell: any): string {
  const n = cell?.note;
  if (!n) return '';
  if (typeof n === 'string') return n.replace(/^[^\n:]{1,40}:\s*\n/, '').replace(/\s+/g, ' ').trim();
  const runs: { text?: string; font?: { bold?: boolean } }[] = Array.isArray(n.texts) ? n.texts : [];
  // Excel writes the author as a bold first run ("Name:"); the note itself follows.
  const body = runs.length > 1 && runs[0].font?.bold ? runs.slice(1) : runs;
  return body.map((r) => r.text || '').join('').replace(/\s+/g, ' ').trim();
}

/** What the file offers, so the person can be asked which sector it is for before it is read. */
export interface WorkbookInfo {
  /** Sector columns found in the store sheets (e.g. only "F&B", or all thirteen). */
  sectors: string[];
  mallTypes: string[];
  hasStore: boolean;
  hasMall: boolean;
  /** Indicators with an Excel note on the KPI cell. */
  notes: number;
}

export interface ImportOptions {
  /** 'chosen': every row applies to the sectors the person picked. 'columns': the X marks of the file decide. */
  mode: 'chosen' | 'columns';
  sectors: string[];
  mallTypes: string[];
}

export async function inspectWorkbook(file: File): Promise<WorkbookInfo> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('فایل خوانده نشد. آن را در Excel باز و با «Save As» به‌صورت .xlsx ذخیره کنید و دوباره بارگذاری کنید.');
  }
  const info: WorkbookInfo = { sectors: [], mallTypes: [], hasStore: false, hasMall: false, notes: 0 };
  for (const ws of wb.worksheets as any[]) {
    if (ws.state !== 'visible') continue;
    const layout = findLayout(ws, ws.name);
    if (!layout || dataRows(ws, layout) === 0) continue;
    if (layout.template === 'STORE') {
      info.hasStore = true;
      layout.scope.forEach((c) => !info.sectors.includes(c.code) && info.sectors.push(c.code));
    } else {
      info.hasMall = true;
      layout.scope.forEach((c) => !info.mallTypes.includes(c.code) && info.mallTypes.push(c.code));
    }
    for (let r = layout.headerRow + 1; r <= ws.rowCount; r++) if (noteText(ws.getRow(r).getCell(layout.cols.statement!))) info.notes += 1;
  }
  return info;
}

export async function parseWorkbook(file: File, current: Indicator[], options?: ImportOptions): Promise<ParsedWorkbook> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new Error('فایل خوانده نشد. آن را در Excel باز و با «Save As» به‌صورت .xlsx ذخیره کنید و دوباره بارگذاری کنید.');
  }
  const sheets = wb.worksheets
    .map((ws: any) => ({ ws, layout: findLayout(ws, ws.name) }))
    // Hidden sheets are never read: in the Nima template the hidden one is a shortened copy kept for the form, not the person's rows.
    .filter((x: any) => x.layout && x.ws.state === 'visible')
    .map((x: any) => ({ ...x, rows: dataRows(x.ws, x.layout) }));
  if (!sheets.length) throw new Error('ستون «KPI» (یا «شاخص») در ردیف‌های اول هیچ برگه‌ای پیدا نشد. از «دانلود قالب» استفاده کنید.');
  const used = sheets.filter((x: any) => x.rows > 0);
  if (!used.length) throw new Error('برگهٔ «' + sheets.map((x: any) => x.ws.name).join('، ') + '» هیچ ردیف شاخصی ندارد. هر شاخص را زیر سرتیتر در یک ردیف بنویسید (کد، موضوع، KPI و X در ستون سکتور) و دوباره بارگذاری کنید.');

  const zoneByTopic = topicZones(wb, current);
  const byId = new Map(current.map((i) => [i.id, i]));
  const drafts: Draft[] = [];

  for (const { ws, layout } of used as { ws: any; layout: Layout }[]) {
    const { cols } = layout;
    let lastGroup = '';
    let lastSubject = '';
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
      if (isCount(statement) || isFormula(cols.statement ? row.getCell(cols.statement).value : null)) continue; // totals of a summary sheet
      if (!statement && !code) continue; // blank rows and section labels
      let subject = get('subject');
      if (!subject || subject.includes('#REF')) subject = lastSubject;
      else lastSubject = subject;

      const idText = get('id');
      const target = idText ? byId.get(idText) : undefined;
      const template = target ? target.template : layout.template;
      let readError: string | undefined;
      if (idText && !target) readError = 'شناسه در بانک شاخص‌ها پیدا نشد؛ ستون شناسه را تغییر ندهید.';

      let group = groupText.includes('#REF') ? '' : groupText;
      if (!group && !target && template === 'STORE') group = zoneByTopic.get(fold(subject)) || '';
      if (template === 'STORE') group = ZONES.find((c) => fold(group).includes(fold(c)) || fold(group).includes(fold(groupLabel(c)))) || group.replace(/\s+/g, ' ');

      const universe = template === 'STORE' ? SECTORS : MALL_TYPES;
      let scope: string[];
      if (options?.mode === 'chosen') {
        scope = template === 'STORE' ? options.sectors : options.mallTypes;
      } else if (layout.scope.length && layout.template === template) {
        scope = layout.scope.filter((s) => norm(cellText(row.getCell(s.col).value))).map((s) => s.code);
      } else scope = (template === 'STORE' ? target?.applicableBusinessTypes : target?.applicableMallTypes) || universe;

      const statusText = fold(get('status'));
      if (get('status') && !['فعال', 'غیرفعال', 'active', 'disabled'].includes(statusText)) readError ||= 'وضعیت باید «فعال» یا «غیرفعال» باشد.';
      const flag = (k: 'photo' | 'comment', old: boolean) => {
        const v = get(k);
        if (!cols[k] || (v === '' && target)) return old;
        if (yes(v)) return true;
        if (no(v)) return false;
        readError ||= 'عکس/توضیح الزامی باید «بله» یا «خیر» باشد.';
        return old;
      };

      drafts.push({
        key: `${ws.name}:${r}`,
        line: r,
        sheet: used.length > 1 ? ws.name : undefined,
        include: true,
        targetId: target?.id,
        template,
        code,
        group,
        subject,
        statement,
        // The note column wins; otherwise the Excel note on the KPI cell; otherwise what the indicator already has.
        note: (cols.note ? raw('note') : '') || noteText(cols.statement ? row.getCell(cols.statement) : null) || (cols.note ? '' : target?.auditorNote || ''),
        scope,
        photo: flag('photo', !!target?.requiresPhoto),
        comment: flag('comment', !!target?.requiresComment),
        active: get('status') ? statusText !== 'غیرفعال' && statusText !== 'disabled' : target ? !target.disabled : true,
        readError,
      });
    }
  }
  if (!drafts.length) throw new Error('هیچ ردیف شاخصی (با ستون «KPI» پر) در فایل پیدا نشد.');
  return { drafts, notes: [] };
}

/** What saving each draft would do, with the problems that keep a row from being saved. Recomputed whenever a draft is edited. */
export function evaluateDrafts(drafts: Draft[], current: Indicator[]): PlanRow[] {
  const byId = new Map(current.map((i) => [i.id, i]));
  const byCode = new Map(current.map((i) => [i.code.toLowerCase(), i]));
  const codeCount = new Map<string, number>();
  current.forEach((i) => codeCount.set(i.code.toLowerCase(), (codeCount.get(i.code.toLowerCase()) || 0) + 1));
  const seen = new Set<string>();

  return drafts.map((d): PlanRow => {
    const base = { key: d.key, line: d.line, sheet: d.sheet, code: d.code, statement: d.statement, changes: [] as string[] };
    const fail = (error: string): PlanRow => ({ ...base, action: 'error', error });
    if (d.readError) return fail(d.readError);

    const code = d.code.trim();
    if (!d.targetId && code) {
      if (!CODE_PATTERN.test(code)) return fail('کد فقط حروف انگلیسی، عدد، خط تیره یا زیرخط و بین ۲ تا ۲۰ نویسه است.');
      if (d.include) {
        if (seen.has(code.toLowerCase())) return fail('این کد در فایل تکراری است.');
        seen.add(code.toLowerCase());
      }
      if ((codeCount.get(code.toLowerCase()) || 0) > 1) return fail('این کد برای چند شاخص موجود است؛ کد را خالی کنید تا شاخص جدید شود یا کد دیگری بدهید.');
    }
    // A row without a code that repeats an indicator added earlier (same topic and wording) updates it instead of adding a copy.
    const sameText = (i: Indicator) => i.custom && i.template === d.template && fold(i.subject) === fold(d.subject) && fold(i.statement) === fold(d.statement);
    const target = (d.targetId ? byId.get(d.targetId) : undefined) || (code ? byCode.get(code.toLowerCase()) : current.find(sameText));

    const statement = (d.statement || target?.statement || '').replace(/\s+/g, ' ').trim();
    const note = d.note.replace(/\s+/g, ' ').trim();
    if (statement.length < 3 || statement.length > 600) return fail('متن شاخص باید بین ۳ و ۶۰۰ نویسه باشد.');
    if (note.length > 1200) return fail('نکتهٔ ارزیاب حداکثر ۱۲۰۰ نویسه است.');

    if (target && !target.custom) {
      // Checklist-file row: wording, note, on/off.
      const edit: NonNullable<PlanRow['fileEdit']> = {};
      const changes: string[] = [];
      if (statement !== target.statement) { edit.statement = statement; changes.push('متن'); }
      if (note !== (target.auditorNote || '')) { edit.auditorNote = note || null; changes.push('نکته'); }
      if (d.active === !!target.disabled) { edit.disabled = !d.active; changes.push(d.active ? 'فعال‌سازی' : 'غیرفعال‌سازی'); }
      return { ...base, action: changes.length ? 'update-file' : 'same', target, fileEdit: edit, changes };
    }

    const template = target ? target.template : d.template;
    const subject = (d.subject || target?.subject || '').trim();
    if (!subject) return fail('موضوع خالی است.');
    const group = (d.group || target?.group || '').trim();
    if (template === 'STORE') {
      if (!ZONES.includes(group)) return fail(group ? `گروه «${group}» شناخته نشد. یکی از ${ZONES.map(groupLabel).join('، ')} را انتخاب کنید.` : 'گروه (منطقه) را انتخاب کنید.');
    } else if (!group) return fail('گروه خالی است.');
    const universe = template === 'STORE' ? SECTORS : MALL_TYPES;
    const scope = d.scope.filter((s) => universe.includes(s));
    if (!scope.length) return fail(template === 'STORE' ? 'دست‌کم یک سکتور را انتخاب کنید.' : 'دست‌کم یک نوع مرکز خرید را انتخاب کنید.');

    const input: CustomIndicatorInput = {
      template, group, subject, statement, auditorNote: note || null,
      applicableBusinessTypes: template === 'STORE' ? scope : [],
      applicableMallTypes: template === 'MALL' ? scope : [],
      requiresPhoto: d.photo, requiresComment: d.comment,
      status: d.active ? 'ACTIVE' : 'ARCHIVED',
    };
    if (!target) {
      if (code) input.code = code;
      return { ...base, action: 'create', input, changes: ['شاخص جدید'] };
    }
    const changes: string[] = [];
    if (group !== target.group) changes.push('گروه');
    if (subject !== target.subject) changes.push('موضوع');
    if (statement !== target.statement) changes.push('متن');
    if (note !== (target.auditorNote || '')) changes.push('نکته');
    if ([...scope].sort().join() !== [...((template === 'STORE' ? target.applicableBusinessTypes : target.applicableMallTypes) || [])].sort().join()) changes.push('دامنه');
    if (d.photo !== !!target.requiresPhoto || d.comment !== !!target.requiresComment) changes.push('عکس/توضیح');
    if (d.active === !!target.disabled) changes.push(d.active ? 'فعال‌سازی' : 'غیرفعال‌سازی');
    return { ...base, action: changes.length ? 'update' : 'same', target, input, changes };
  });
}
