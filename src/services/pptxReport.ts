import type { VisitSession } from '../types';
import {
  computeStoreFrictionRate,
  latestVisitPerBranch,
  fullFrictionTopics,
  topFrictionTopicsByCount,
  type FrictionRateRow,
  type StoreFrictionRate,
} from '../engine/frModel';
import { faDigits } from '../utils/format';

/*
 * PowerPoint export of the FR reports, following the report template:
 * purple corner, grey title at the right, purple framed charts, logo strip at the bottom.
 *
 *   Business deck: «ارزیابی فروشگاه‌ها در یک نگاه», «رتبه‌بندی فروشگاه‌ها بر حسب گروه Friction»,
 *                  «مقایسه نمودار اصطکاک» (6 stores per slide), then for every store its
 *                  store page and its top-10 slide.
 *   Store deck:    that store's store page and top-10 slide.
 * Charts are native PowerPoint charts, so they stay editable after download.
 */

const PURPLE = '7B61FF';
const GREY = '7F7F7F';
const INK = '262626';
const BLUE = '0070C0';
const FONT = 'Tahoma';
const ZONES = ['FLOOR', 'SERVICES', 'TEAM', 'PRODUCT', 'CASH'];
const ZONE_FA: Record<string, string> = { FLOOR: 'محوطه فروشگاه', SERVICES: 'کیفیت سرویس', TEAM: 'تیم فروشگاه', PRODUCT: 'محصول', CASH: 'صندوق' };
const ZONE_HEAD: Record<string, string> = { FLOOR: 'محوطه فروش', SERVICES: 'کیفیت سرویس', TEAM: 'پرسنل', PRODUCT: 'محصول', CASH: 'صندوق (پرداخت)' };
const ZONE_EN: Record<string, string> = { FLOOR: 'Floor', SERVICES: 'Services', TEAM: 'Team', PRODUCT: 'Product', CASH: 'Cash' };
const ZONE_COLOR: Record<string, string> = { FLOOR: '3987E5', SERVICES: 'D95926', TEAM: '199E70', PRODUCT: 'C98500', CASH: 'D55181' };

type Slide = any;

const pctNum = (rate: number) => Math.round(rate * 1000) / 10;
const pctEn = (rate: number) => `${Math.round(rate * 100)}%`;
const clip = (t: string, n = 40) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** 1404/09/24 style date (Persian calendar, zero padded, Persian digits). */
function jalali(iso?: string): string {
  if (!iso) return '—';
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return faDigits(`${g('year')}/${g('month')}/${g('day')}`);
}

function frame(pptx: any, title: string, brand: string): Slide {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  // The purple rounded corner at the top left.
  slide.addShape('roundRect', { x: -0.5, y: 0.52, w: 0.95, h: 0.95, rectRadius: 0.12, rotate: 45, fill: { color: PURPLE }, line: { color: PURPLE } });
  slide.addText(title, { x: 0.9, y: 0.35, w: 11.4, h: 1.1, fontFace: FONT, fontSize: 34, bold: true, color: GREY, align: 'right', valign: 'middle', rtlMode: true, fit: 'shrink' });
  // Logo strip: the company mark at the left, the retailer in the middle.
  slide.addShape('rect', { x: 0.1, y: 6.85, w: 0.72, h: 0.55, fill: { color: 'FFFFFF' }, line: { color: INK, width: 1.5 } });
  slide.addText([{ text: 'RETAIL', options: { color: GREY, fontSize: 9, breakLine: true } }, { text: 'Solutions', options: { color: '00B0F0', fontSize: 8 } }], { x: 0.12, y: 6.9, w: 0.68, h: 0.45, fontFace: 'Arial', align: 'center', valign: 'middle', margin: 0 });
  slide.addText(brand, { x: 4.9, y: 6.85, w: 3.5, h: 0.55, fontFace: FONT, fontSize: 20, bold: true, color: GREY, align: 'center', valign: 'middle', rtlMode: true });
  return slide;
}

/** Purple framed area for a chart or a table. */
function box(slide: Slide, x: number, y: number, w: number, h: number) {
  slide.addShape('roundRect', { x, y, w, h, rectRadius: 0.12, fill: { color: 'FFFFFF' }, line: { color: PURPLE, width: 1.75 } });
}

/** Small purple tab with a store name, sitting on the frame. */
function tab(slide: Slide, text: string, x: number, y: number, w: number, h = 0.32) {
  slide.addText(text, { x, y, w, h, fontFace: FONT, fontSize: h < 0.3 ? 11 : 13, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', rtlMode: true, shape: 'roundRect', rectRadius: 0.06, fill: { color: PURPLE } });
}

/** Red-to-green arrow: the highest friction is at the top. */
function arrow(slide: Slide, x: number, y: number, w: number, h: number) {
  const head = Math.min(w * 0.55, h * 0.2);
  slide.addShape('triangle', { x, y, w, h: head, fill: { color: 'FF1A00' }, line: { color: 'FF1A00' } });
  const steps = 14;
  const from = [255, 26, 0];
  const to = [16, 176, 80];
  const bodyW = w * 0.5;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const c = from.map((f, k) => Math.round(f + (to[k] - f) * t).toString(16).padStart(2, '0')).join('');
    slide.addShape('rect', { x: x + (w - bodyW) / 2, y: y + head + ((h - head) / steps) * i, w: bodyW, h: (h - head) / steps + 0.01, fill: { color: c }, line: { color: c } });
  }
}

function zoneRateMap(rate: StoreFrictionRate): Record<string, FrictionRateRow | undefined> {
  return Object.fromEntries(rate.zones.map((z) => [z.group, z]));
}

function radar(pptx: any, slide: Slide, rate: StoreFrictionRate, x: number, y: number, w: number, h: number, axisMax: number, fontSize = 11, plot?: { x: number; y: number; w: number; h: number }) {
  const map = zoneRateMap(rate);
  slide.addChart(
    pptx.charts.RADAR,
    // The value is part of the axis label (Persian name, then English name and rate): nothing is drawn on top of the
    // chart, so the texts cannot run into each other.
    [{ name: 'نرخ اصطکاک (٪)', labels: ZONES.map((z) => `${ZONE_FA[z]}\n${z} ${pctNum(map[z]?.rate || 0)}%`), values: ZONES.map((z) => pctNum(map[z]?.rate || 0)) }],
    {
      x, y, w, h, radarStyle: 'standard', chartColors: [PURPLE], lineSize: 2.5, ...(plot ? { layout: plot } : {}),
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: fontSize, catAxisLabelColor: INK,
      valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: axisMax, valGridLine: { color: 'E5E7EB', size: 0.75 },
      showValue: false, showLegend: false,
    },
  );
}

const axisMaxFor = (values: number[]) => Math.max(10, Math.ceil(Math.max(...values, 0) / 10) * 10);

const cell = (text: string, o: Record<string, unknown> = {}) => ({
  text,
  options: { fontFace: 'Arial', fontSize: 14, color: INK, align: 'center', valign: 'middle', border: { type: 'solid', pt: 1, color: '000000' }, ...o },
});

/* --- Slides ---------------------------------------------------------------- */

/** One store: the figures table, the visit details and the radar. */
function storePage(pptx: any, visit: VisitSession) {
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  if (!rate.total.indicators) return;
  const slide = frame(pptx, `فروشگاه (${visit.branchName})`, visit.brandName);
  const map = zoneRateMap(rate);
  const head = ['', 'Indicators', 'FR Recorded', 'N/A', 'Weight'].map((t) => cell(t, { bold: true, border: t ? { type: 'solid', pt: 1, color: '000000' } : { type: 'none' } }));
  const rows = ZONES.map((z) => {
    const r = map[z];
    return [cell(ZONE_EN[z], { bold: true, align: 'left' }), cell(String(r?.indicators ?? 0)), cell(String(r?.frictions ?? 0)), cell(String(r?.notApplicable ?? 0)), cell(pctEn(r?.rate ?? 0))];
  });
  const t = rate.total;
  const total = [cell('Total', { bold: true, color: BLUE, align: 'left' }), ...[String(t.indicators), String(t.frictions), String(t.notApplicable), pctEn(t.rate)].map((v) => cell(v, { bold: true, color: BLUE }))];
  slide.addTable([head, ...rows, total], { x: 0.77, y: 1.98, w: 5.45, colW: [1.15, 1.25, 1.25, 0.8, 1.0], rowH: 0.36 });

  const lines: [string, string][] = [['تاریخ بازدید', jalali(visit.completedAt || visit.startedAt)]];
  if (visit.supervisorName) lines.push(['نام مدیر', visit.supervisorName]);
  lines.push(['نام ارزیاب', visit.auditorName || '—']);
  if (visit.evaluatorCode) lines.push(['کد ارزیاب', faDigits(visit.evaluatorCode)]);
  lines.forEach(([label, value], i) => {
    slide.addText(
      [{ text: `${label}: `, options: { color: INK } }, { text: value, options: { bold: true, color: INK } }],
      { x: 0.6, y: 4.85 + i * 0.52, w: 5.6, h: 0.55, fontFace: FONT, fontSize: 22, align: 'right', valign: 'middle', rtlMode: true },
    );
  });

  box(slide, 6.69, 1.97, 5.53, 4.62);
  radar(pptx, slide, rate, 6.75, 2.05, 5.4, 4.45, axisMaxFor(ZONES.map((z) => pctNum(map[z]?.rate || 0))));
}

/** One store: every topic with 100% friction, however many there are. */
function topTen(pptx: any, visit: VisitSession) {
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  if (!rate.total.indicators) return;
  const slide = frame(pptx, `موضوع‌های با اصطکاک ۱۰۰٪ (${visit.branchName})`, visit.brandName);
  box(slide, 0.78, 1.97, 11.97, 4.62);
  const top = fullFrictionTopics(rate);
  if (!top.length) {
    slide.addText('موضوعی با اصطکاک ۱۰۰٪ وجود ندارد.', { x: 1, y: 3.5, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 20, color: GREY, align: 'center', rtlMode: true });
    return;
  }
  slide.addChart(
    pptx.charts.BAR,
    [{ name: 'اصطکاک کلی فروشگاه', labels: top.map((t) => clip(t.subject, 30)), values: top.map((t) => pctNum(t.rate)) }],
    {
      x: 0.9, y: 2.05, w: 11.75, h: 4.45, barDir: 'col', chartColors: [PURPLE], barGapWidthPct: 60,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: INK,
      valAxisHidden: true, valGridLine: { style: 'none' }, valAxisMinVal: 0,
      showValue: true, dataLabelFormatCode: '0.0"%"', dataLabelFontSize: 13, dataLabelFontFace: 'Arial', dataLabelColor: INK, dataLabelPosition: 'outEnd',
      showValAxisTitle: false, showLegend: false,
    },
  );
}

/** One store: its ten topics with the most frictions, by count (not rate). */
function topTenByCount(pptx: any, visit: VisitSession) {
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  if (!rate.total.indicators) return;
  const slide = frame(pptx, `ده موضوع با بیشترین تعداد Friction (${visit.branchName})`, visit.brandName);
  box(slide, 0.78, 1.97, 11.97, 4.62);
  const top = topFrictionTopicsByCount(rate, 10);
  if (!top.length) {
    slide.addText('اصطکاکی ثبت نشده است.', { x: 1, y: 3.5, w: 11.5, h: 0.6, fontFace: FONT, fontSize: 20, color: GREY, align: 'center', rtlMode: true });
    return;
  }
  slide.addChart(
    pptx.charts.BAR,
    [{ name: 'تعداد اصطکاک', labels: top.map((t) => clip(t.subject, 30)), values: top.map((t) => t.frictions) }],
    {
      x: 0.9, y: 2.05, w: 11.75, h: 4.45, barDir: 'col', chartColors: [PURPLE], barGapWidthPct: 60,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: INK,
      valAxisHidden: true, valGridLine: { style: 'none' }, valAxisMinVal: 0,
      showValue: true, dataLabelFormatCode: '0', dataLabelFontSize: 13, dataLabelFontFace: 'Arial', dataLabelColor: INK, dataLabelPosition: 'outEnd',
      showValAxisTitle: false, showLegend: false,
    },
  );
}

/** Stores side by side, ranked per zone: the worst store is the first row of each column. */
function rankByZone(pptx: any, visits: VisitSession[], brand: string) {
  const slide = frame(pptx, 'رتبه‌بندی فروشگاه‌ها بر حسب گروه Friction', brand);
  const rated = visits.map((v) => ({ name: v.branchName, map: zoneRateMap(computeStoreFrictionRate(v.indicators, v.responses)) }));
  const n = Math.min(rated.length, 8);
  const colW = 1.62;
  const gap = 0.09;
  const right = 11.3; // right edge of the first column
  const headH = 0.7;
  const rowH = Math.min(0.72, 4.5 / Math.max(n, 1));
  ZONES.forEach((z, c) => {
    const x = right - colW - c * (colW + gap);
    slide.addText(ZONE_HEAD[z], { x, y: 1.87, w: colW, h: headH, fontFace: FONT, fontSize: 15, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', rtlMode: true, shape: 'roundRect', rectRadius: 0.1, fill: { color: PURPLE } });
    const sorted = [...rated].sort((a, b) => (b.map[z]?.rate || 0) - (a.map[z]?.rate || 0));
    // Equal rates share one cell: "A/B".
    const cells: string[] = [];
    for (const s of sorted) {
      const r = s.map[z]?.rate || 0;
      const last = cells.length ? sorted.filter((o) => cells[cells.length - 1].split('/').includes(o.name)) : [];
      if (last.length && (last[0].map[z]?.rate || 0) === r) cells[cells.length - 1] += `/${s.name}`;
      else cells.push(s.name);
    }
    for (let i = 0; i < n; i++) {
      slide.addText(cells[i] || '', {
        x, y: 1.87 + headH + 0.08 + i * (rowH + 0.08), w: colW, h: rowH, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: 'center', valign: 'middle', rtlMode: true,
        shape: 'roundRect', rectRadius: 0.1, fill: { color: i % 2 === 0 ? 'E7E6E6' : 'A6A6A6' },
      });
    }
  });
  arrow(slide, 1.98, 2.64, 0.7, 3.7);
}

/** Small radars of up to six stores per slide, on one common scale. */
function radarComparison(pptx: any, visits: VisitSession[], brand: string) {
  const rates = visits.map((v) => ({ v, rate: computeStoreFrictionRate(v.indicators, v.responses) }));
  // Each branch's radar with the branch name above its chart: two on a slide, side by side, so every chart
  // is big and its labels have room (a radar shrinks to what is left of its width after the labels); a brand
  // with more branches goes on to further slides.
  const perSlide = 2;
  const area = { right: 12.05, left: 0.75, top: 1.72, bottom: 6.8 };
  for (let page = 0; page * perSlide < rates.length; page++) {
    const slide = frame(pptx, `مقایسه نمودار اصطکاک فروشگاه‌های ${brand}`, brand);
    const chunk = rates.slice(page * perSlide, (page + 1) * perSlide);
    const n = chunk.length;
    // The scale is shared by the charts on one slide, so they can be compared at a glance.
    const axisMax = axisMaxFor(chunk.flatMap((r) => ZONES.map((z) => pctNum(zoneRateMap(r.rate)[z]?.rate || 0))));
    const cols = n;
    const rows = Math.ceil(n / cols);
    const gap = 0.08;
    const cellW = (area.right - area.left - (cols - 1) * gap) / cols;
    const cellH = (area.bottom - area.top - (rows - 1) * gap) / rows;
    const label = Math.min(0.36, cellH * 0.16);
    const fontSize = 12;
    chunk.forEach((r, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = area.right - cellW - col * (cellW + gap); // right to left, as the deck reads
      const y = area.top + row * (cellH + gap);
      box(slide, x, y, cellW, cellH);
      tab(slide, clip(r.v.branchName, 28), x + 0.1, y + 0.06, cellW - 0.2, label);
      radar(pptx, slide, r.rate, x + 0.02, y + label + 0.08, cellW - 0.04, cellH - label - 0.1, axisMax, fontSize);
    });
  }
}

/** All stores: the ranking bar chart, the table and the zone split of all frictions. */
function atAGlance(pptx: any, visits: VisitSession[], brand: string) {
  const slide = frame(pptx, 'ارزیابی فروشگاه‌ها در یک نگاه', brand);
  const rows = visits
    .map((v) => ({ name: v.branchName, rate: computeStoreFrictionRate(v.indicators, v.responses) }))
    .sort((a, b) => b.rate.total.rate - a.rate.total.rate);

  box(slide, 0.75, 2.0, 5.4, 4.58);
  slide.addChart(
    pptx.charts.BAR,
    [{ name: 'اصطکاک کلی فروشگاه', labels: rows.map((r) => clip(r.name, 16)), values: rows.map((r) => pctNum(r.rate.total.rate)) }],
    {
      x: 0.85, y: 2.1, w: 5.2, h: 4.4, barDir: 'col', chartColors: [PURPLE], barGapWidthPct: 80,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: INK,
      valAxisLabelFontSize: 10, valAxisLabelColor: GREY, valAxisMinVal: 0, valAxisLabelFormatCode: '0"%"', valGridLine: { style: 'none' },
      showValue: true, dataLabelFormatCode: '0"%"', dataLabelFontSize: 12, dataLabelFontFace: 'Arial', dataLabelColor: INK, dataLabelPosition: 'outEnd',
      showValAxisTitle: true, valAxisTitle: 'اصطکاک کلی فروشگاه', valAxisTitleFontFace: FONT, valAxisTitleFontSize: 12, valAxisTitleColor: GREY,
      showLegend: false,
    },
  );

  box(slide, 6.62, 2.0, 5.4, 2.25);
  const hdr = ['فروشگاه', 'تعداد Friction', 'N/A', 'اصطکاک کلی'].map((t) => cell(t, { bold: true, color: 'FFFFFF', fill: { color: PURPLE }, fontFace: FONT, fontSize: 13, border: { type: 'solid', pt: 1, color: 'FFFFFF' } }));
  const shown = rows.slice(0, 8);
  const body = shown.map((r, i) =>
    [r.name, faDigits(r.rate.total.frictions), faDigits(r.rate.total.notApplicable), `٪${faDigits(Math.round(r.rate.total.rate * 100))}`].map((t) =>
      cell(t, { fontFace: FONT, fontSize: 12, bold: true, fill: { color: i % 2 === 0 ? 'D9E1F2' : 'EDF1F9' }, border: { type: 'solid', pt: 1, color: 'FFFFFF' }, rtlMode: true }),
    ),
  );
  const rowH = Math.min(0.34, 1.5 / Math.max(shown.length + 1, 1));
  slide.addTable([hdr, ...body], { x: 6.7, y: 2.08, w: 5.24, colW: [1.5, 1.45, 1.0, 1.29], rowH });
  const totalIndicators = Math.max(...rows.map((r) => r.rate.total.indicators));
  slide.addText(`* کل شاخص‌های مورد بررسی در ارزیابی تجربه مشتری = ${faDigits(totalIndicators)}`, { x: 6.7, y: 3.88, w: 5.24, h: 0.3, fontFace: FONT, fontSize: 10, color: INK, align: 'right', rtlMode: true });
  arrow(slide, 12.1, 2.45, 0.4, 1.55);

  box(slide, 6.62, 4.4, 5.4, 2.18);
  const zoneFr = ZONES.map((z) => rows.reduce((n, r) => n + (zoneRateMap(r.rate)[z]?.frictions || 0), 0));
  if (zoneFr.some((n) => n > 0)) {
    slide.addChart(
      pptx.charts.PIE,
      [{ name: 'سهم اصطکاک هر منطقه', labels: ZONES.map((z) => ZONE_EN[z]), values: zoneFr }],
      {
        x: 6.7, y: 4.45, w: 5.25, h: 2.08, chartColors: ZONES.map((z) => ZONE_COLOR[z]),
        showPercent: true, showValue: false, dataLabelFormatCode: '0%', dataLabelFontSize: 11, dataLabelFontFace: 'Arial', dataLabelColor: INK,
        showLegend: true, legendPos: 'r', legendFontFace: 'Arial', legendFontSize: 11,
      },
    );
  }
}

/* --- Decks ----------------------------------------------------------------- */

async function newDeck(): Promise<any> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = true;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  return pptx;
}

/**
 * Download names are ASCII only: some browsers drop a Persian file name altogether and save the file as
 * "download" with no extension, which PowerPoint cannot open. The Persian title is inside the deck.
 */
const deckFileName = (kind: 'Store' | 'Business') => `RS_${kind}_Report_${new Date().toISOString().slice(0, 10)}.pptx`;

export interface BuiltDeck {
  blob: Blob;
  fileName: string;
}

const toBlob = async (pptx: any): Promise<Blob> => (await pptx.write({ outputType: 'blob', compression: true })) as Blob;

/** Starts the browser download of a built deck. */
export function saveDeck(deck: BuiltDeck) {
  const url = URL.createObjectURL(deck.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = deck.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Keep the address alive: a "download again" link in the page uses the same one.
  return url;
}

/** The deck of one store's visit. */
export async function buildStoreDeck(visit: VisitSession): Promise<BuiltDeck> {
  const pptx = await newDeck();
  pptx.title = `گزارش ${visit.brandName} - ${visit.branchName}`;
  storePage(pptx, visit);
  topTen(pptx, visit);
  topTenByCount(pptx, visit);
  return { blob: await toBlob(pptx), fileName: deckFileName('Store') };
}

export async function downloadStoreDeck(visit: VisitSession) {
  saveDeck(await buildStoreDeck(visit));
}

/** The deck of a whole brand: the business slides, then two slides for every branch's latest visit. */
export async function buildBusinessDeck(brandNames: string | string[], visits: VisitSession[]): Promise<BuiltDeck | null> {
  const brandName = (Array.isArray(brandNames) ? brandNames[0] : brandNames) || '';
  const latest = latestVisitPerBranch(brandNames, visits);
  if (!latest.length) return null;
  const pptx = await newDeck();
  pptx.title = `گزارش کل کسب‌وکار ${brandName}`;
  atAGlance(pptx, latest, brandName);
  rankByZone(pptx, latest, brandName);
  radarComparison(pptx, latest, brandName);
  for (const visit of latest) {
    storePage(pptx, visit);
    topTen(pptx, visit);
    topTenByCount(pptx, visit);
  }
  return { blob: await toBlob(pptx), fileName: deckFileName('Business') };
}

export async function downloadBusinessDeck(brandNames: string | string[], visits: VisitSession[]) {
  const deck = await buildBusinessDeck(brandNames, visits);
  if (deck) saveDeck(deck);
}
