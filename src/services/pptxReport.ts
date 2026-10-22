import type { VisitSession } from '../types';
import {
  computeBrandFrictionRates,
  computeFrictionRate,
  computeStoreFrictionRate,
  latestVisitPerBranch,
  topFrictionTopics,
  type FrictionRateRow,
  type StoreFrictionRate,
} from '../engine/frModel';
import { faDigits, groupLabel } from '../utils/format';

/*
 * PowerPoint export of the FR reports, all in Persian, right to left.
 *   Business deck: 2 slides for the whole brand, then 2 slides per branch.
 *   Store deck:    the 2 slides of that store.
 * Charts are native PowerPoint charts, so they can be edited after download.
 */

const NAVY = '16213E';
const CYAN = '00B0F0';
const INK = '1F2937';
const MUTED = '6B7280';
const LINE = 'E5E7EB';
const RED = 'D64545';
const FONT = 'Tahoma';
const ZONE_COLOR: Record<string, string> = { FLOOR: '3987E5', SERVICES: 'D95926', TEAM: '199E70', PRODUCT: 'C98500', CASH: 'D55181' };

const pct = (rate: number) => {
  const v = Math.round(rate * 1000) / 10;
  return `٪${faDigits(Number.isInteger(v) ? String(v) : v.toFixed(1)).replace('.', '٫')}`;
};
const pctNum = (rate: number) => Math.round(rate * 1000) / 10;
const clip = (t: string, n = 34) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);
const d = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('fa-IR') : '—');

type Slide = any;

function frame(pptx: any, title: string, subtitle: string): Slide {
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addShape('rect', { x: 0, y: 0, w: 13.33, h: 1.05, fill: { color: NAVY }, line: { color: NAVY } });
  slide.addShape('rect', { x: 0, y: 1.05, w: 13.33, h: 0.05, fill: { color: CYAN }, line: { color: CYAN } });
  slide.addText(title, { x: 0.4, y: 0.12, w: 12.5, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: 'FFFFFF', align: 'right', rtlMode: true });
  slide.addText(subtitle, { x: 0.4, y: 0.6, w: 12.5, h: 0.35, fontFace: FONT, fontSize: 13, color: 'BFD7EA', align: 'right', rtlMode: true });
  slide.addText('Retail Solutions · ارزیابی میدانی تجربه مشتری', { x: 0.4, y: 7.1, w: 12.5, h: 0.3, fontFace: FONT, fontSize: 10, color: MUTED, align: 'right', rtlMode: true });
  return slide;
}

const cell = (text: string, o: Record<string, unknown> = {}) => ({
  text,
  options: { fontFace: FONT, fontSize: 13, color: INK, align: 'center', valign: 'middle', rtlMode: true, border: { type: 'solid', pt: 0.5, color: LINE }, ...o },
});

function zoneTable(slide: Slide, rate: StoreFrictionRate, totalLabel: string, x: number, y: number, w: number) {
  const head = ['منطقه', 'شاخص', 'اصطکاک', 'قابل‌اجرا نیست', 'نرخ اصطکاک'].map((t) => cell(t, { bold: true, color: 'FFFFFF', fill: { color: NAVY } }));
  const body = rate.zones.map((z) => [
    cell(groupLabel(z.group), { align: 'right', bold: true, color: ZONE_COLOR[z.group] || INK }),
    cell(faDigits(z.indicators)),
    cell(faDigits(z.frictions)),
    cell(faDigits(z.notApplicable)),
    cell(pct(z.rate), { bold: true, color: z.frictions ? RED : INK }),
  ]);
  const t = rate.total;
  const total = [totalLabel, faDigits(t.indicators), faDigits(t.frictions), faDigits(t.notApplicable), pct(t.rate)].map((v, i) =>
    cell(v, { bold: true, fill: { color: 'F3F4F6' }, align: i === 0 ? 'right' : 'center' }),
  );
  slide.addTable([head, ...body, total], { x, y, w, colW: [1.9, 0.9, 0.95, 1.35, 1.2].map((c) => (c * w) / 6.3), rowH: 0.5 });
}

function radar(pptx: any, slide: Slide, zones: FrictionRateRow[], x: number, y: number, w: number, h: number) {
  // Highest zone first: a radar starts at 12 o'clock and runs clockwise.
  const sorted = [...zones].sort((a, b) => b.rate - a.rate);
  slide.addChart(
    pptx.charts.RADAR,
    [{ name: 'نرخ اصطکاک (٪)', labels: sorted.map((z) => groupLabel(z.group)), values: sorted.map((z) => pctNum(z.rate)) }],
    {
      x, y, w, h, radarStyle: 'marker', chartColors: [RED], lineSize: 2.5, lineDataSymbolSize: 8,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 13, catAxisLabelColor: INK,
      valAxisLabelFontSize: 9, valAxisLabelColor: MUTED, valAxisMinVal: 0, valGridLine: { color: LINE, size: 0.75 },
      showLegend: false,
    },
  );
}

function headline(slide: Slide, label: string, rate: FrictionRateRow, x: number, y: number, w: number) {
  slide.addText(label, { x, y, w, h: 0.35, fontFace: FONT, fontSize: 13, color: MUTED, align: 'right', rtlMode: true });
  slide.addText(pct(rate.rate), { x, y: y + 0.3, w, h: 0.8, fontFace: FONT, fontSize: 40, bold: true, color: RED, align: 'right', rtlMode: true });
  slide.addText(`${faDigits(rate.frictions)} اصطکاک از ${faDigits(rate.indicators - rate.notApplicable)} شاخص قابل‌ارزیابی`, {
    x, y: y + 1.05, w, h: 0.3, fontFace: FONT, fontSize: 12, color: MUTED, align: 'right', rtlMode: true,
  });
}

function topTopics(pptx: any, slide: Slide, rate: StoreFrictionRate, x: number, y: number, w: number, h: number) {
  const top = topFrictionTopics(rate, 10);
  if (!top.length) {
    slide.addText('اصطکاکی ثبت نشده است.', { x, y, w, h: 0.6, fontFace: FONT, fontSize: 16, color: MUTED, align: 'right', rtlMode: true });
    return;
  }
  // Bar charts list the first category at the bottom; reverse so the highest rate is on top.
  const rows = [...top].reverse();
  slide.addChart(
    pptx.charts.BAR,
    [{ name: 'نرخ اصطکاک (٪)', labels: rows.map((t) => clip(`${t.subject} · ${groupLabel(t.group)}`)), values: rows.map((t) => pctNum(t.rate)) }],
    {
      x, y, w, h, barDir: 'bar', chartColors: rows.map((t) => ZONE_COLOR[t.group] || CYAN), barGapWidthPct: 40,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: INK,
      valAxisLabelFontSize: 9, valAxisLabelColor: MUTED, valAxisMinVal: 0, valGridLine: { color: LINE, size: 0.75 },
      showValue: true, dataLabelFormatCode: '0.0"٪"', dataLabelFontSize: 11, dataLabelFontFace: FONT, dataLabelColor: INK, showLegend: false,
    },
  );
}

function topicCounts(slide: Slide, rate: StoreFrictionRate, x: number, y: number, w: number) {
  const top = topFrictionTopics(rate, 10);
  if (!top.length) return;
  const head = ['موضوع', 'اصطکاک از شاخص', 'نرخ'].map((t) => cell(t, { bold: true, color: 'FFFFFF', fill: { color: NAVY }, fontSize: 11 }));
  const rows = top.map((t) => [
    cell(t.subject, { align: 'right', fontSize: 11 }),
    cell(`${faDigits(t.frictions)} از ${faDigits(t.indicators - t.notApplicable)}`, { fontSize: 11 }),
    cell(pct(t.rate), { fontSize: 11, bold: true, color: RED }),
  ]);
  slide.addTable([head, ...rows], { x, y, w, colW: [w * 0.5, w * 0.3, w * 0.2], rowH: 0.38 });
}

function storeSlides(pptx: any, visit: VisitSession) {
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  if (!rate.total.indicators) return;
  const who = `ارزیاب: ${visit.auditorName || '—'}${visit.evaluatorCode ? ` (${visit.evaluatorCode})` : ''}`;
  const sub = `${visit.brandName} · شعبه ${visit.branchName} · تاریخ بازدید ${d(visit.completedAt || visit.startedAt)} · ${who}`;

  const a = frame(pptx, 'نرخ اصطکاک فروشگاه به تفکیک منطقه', sub);
  headline(a, 'نرخ اصطکاک کل فروشگاه', rate.total, 7.2, 1.35, 5.7);
  zoneTable(a, rate, 'کل فروشگاه', 7.2, 3.0, 5.7);
  radar(pptx, a, rate.zones, 0.3, 1.4, 6.6, 5.5);

  const b = frame(pptx, '۱۰ اصطکاک اصلی فروشگاه', sub);
  topTopics(pptx, b, rate, 6.3, 1.3, 6.7, 5.7);
  topicCounts(b, rate, 0.3, 1.5, 5.8);
}

async function newDeck(): Promise<any> {
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.rtlMode = true;
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  return pptx;
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim();

/** The deck of one store's visit. */
export async function downloadStoreDeck(visit: VisitSession) {
  const pptx = await newDeck();
  pptx.title = `گزارش ${visit.brandName} - ${visit.branchName}`;
  storeSlides(pptx, visit);
  await pptx.writeFile({ fileName: `${safe(`گزارش ${visit.brandName} - ${visit.branchName}`)}.pptx` });
}

/** The deck of a whole brand: 2 business slides, then 2 slides for every branch's latest visit. */
export async function downloadBusinessDeck(brandName: string, visits: VisitSession[]) {
  const latest = latestVisitPerBranch(brandName, visits);
  if (!latest.length) return;
  const pptx = await newDeck();
  pptx.title = `گزارش کل کسب‌وکار ${brandName}`;
  const business = computeFrictionRate(latest);
  const branches = computeBrandFrictionRates(brandName, visits);
  const sub = `${brandName} · ${faDigits(latest.length)} شعبه · از هر شعبه آخرین پرسشنامهٔ نهایی‌شده`;

  const a = frame(pptx, 'گزارش کل کسب‌وکار: نرخ اصطکاک مناطق', sub);
  headline(a, 'نرخ اصطکاک کل کسب‌وکار', business.total, 7.2, 1.35, 5.7);
  zoneTable(a, business, 'کل کسب‌وکار', 7.2, 3.0, 5.7);
  radar(pptx, a, business.zones, 0.3, 1.4, 6.6, 5.5);

  const b = frame(pptx, 'گزارش کل کسب‌وکار: ۱۰ اصطکاک اصلی و مقایسهٔ شعب', sub);
  topTopics(pptx, b, business, 6.3, 1.3, 6.7, 5.7);
  if (branches.length) {
    const rows = [...branches].reverse();
    b.addText('مقایسهٔ شعب (نرخ اصطکاک کل)', { x: 0.3, y: 1.3, w: 5.8, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: INK, align: 'right', rtlMode: true });
    b.addChart(
      pptx.charts.BAR,
      [{ name: 'نرخ اصطکاک (٪)', labels: rows.map((r) => r.branchName), values: rows.map((r) => pctNum(r.rate)) }],
      {
        x: 0.3, y: 1.7, w: 5.8, h: 5.2, barDir: 'bar', chartColors: [CYAN], barGapWidthPct: 40,
        catAxisLabelFontFace: FONT, catAxisLabelFontSize: 11, catAxisLabelColor: INK, valAxisLabelFontSize: 9, valAxisLabelColor: MUTED,
        valAxisMinVal: 0, valGridLine: { color: LINE, size: 0.75 }, showValue: true, dataLabelFormatCode: '0.0"٪"', dataLabelFontSize: 11,
        dataLabelFontFace: FONT, showLegend: false,
      },
    );
  }

  for (const visit of latest) storeSlides(pptx, visit);
  await pptx.writeFile({ fileName: `${safe(`گزارش کل کسب‌وکار ${brandName}`)}.pptx` });
}
