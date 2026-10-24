import type { VisitSession } from '../types';
import { computeStoreFrictionRate } from '../engine/frModel';
import { groupLabel, profileLabel } from '../utils/format';

/** Header text of the sector column, as in the checklist workbook. */
const SECTOR_HEADER: Record<string, string> = {
  Fashion: 'Fashion', Shoe_Bag: 'Shoe & Bag', Watch_Jewelry: 'Watch & Jewelry', FMCG: 'FMCG', F_B: 'F&B',
  Hardware: 'Hardware', Homeware: 'Homeware', Beauty_Cosmetics: 'Beauty/Cosmetics', Electronics: 'Electronics',
  Entertainment: 'Entertainment', Sports: 'Sports', Specialty: 'Specialty', Services: 'Services',
  SM: 'SM', Neighborhood: 'Neighborhood', Community: 'Community', Regional: 'Regional', Super_Regional: 'Super Regional',
};
const ZONE_EN: Record<string, string> = { FLOOR: 'Floor', SERVICES: 'Services', TEAM: 'Team', PRODUCT: 'Product', CASH: 'Cash' };

const jalali = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '';
const clock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }) : '');

/**
 * A filled questionnaire as a workbook in the checklist's own layout: the same
 * header block, the same columns (گروه، کد، موضوع، KPI، the sector column,
 * Friction, توضیحات، شماره عکس) and the same row order, so it can be filed next to
 * the template it came from. A second sheet carries the friction-rate table.
 */
export async function downloadVisitWorkbook(visit: VisitSession) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sectorCode = visit.assessmentType === 'STORE' ? visit.businessType || 'Fashion' : visit.mallType || 'Regional';
  const sectorHeader = SECTOR_HEADER[sectorCode] || profileLabel(sectorCode);

  const ws = wb.addWorksheet('Check List', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 8 }] });
  ws.columns = [
    { width: 29 }, { width: 10 }, { width: 30 }, { width: 80 }, { width: 14 }, { width: 10 }, { width: 60 }, { width: 18 },
  ];
  ws.getCell('A2').value = `برند:  ${visit.brandName}`;
  ws.getCell('A3').value = 'شهر:  ';
  ws.getCell('A4').value = `شعبه:  ${visit.branchName}`;
  ws.getCell('A5').value = `نام مدیر (سرپرست) فروشگاه:  ${visit.supervisorName || ''}`;
  ws.getCell('D3').value = `تاریخ بازدید:  ${jalali(visit.completedAt || visit.startedAt)}`;
  ws.getCell('D4').value = `زمان بازدید:  ${clock(visit.startedAt)}`;
  ws.getCell('D5').value = `نام ارزیاب:  ${visit.auditorName || ''}${visit.evaluatorCode ? ` (${visit.evaluatorCode})` : ''}`;
  const head = ws.getRow(8);
  head.values = ['گروه ', 'کد', 'موضوع', 'KPI', sectorHeader, 'Friction', 'توضیحات (فقط در موارد اصطکاک تکمیل شود)', 'شماره عکس'];
  head.font = { bold: true };
  head.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

  const photos: { n: number; code: string; caption: string; url: string }[] = [];
  let rowNo = 9;
  let lastZone = '';
  for (const ind of visit.indicators) {
    const resp = visit.responses?.[ind.id];
    if (ind.group !== lastZone) {
      // A label row opens every zone, like the template.
      const label = ws.getRow(rowNo++);
      label.getCell(1).value = visit.assessmentType === 'STORE' ? `${groupLabel(ind.group)}  ${ind.group}` : ind.group;
      label.font = { bold: true };
      lastZone = ind.group;
    }
    const numbers: number[] = [];
    for (const p of resp?.photos || []) {
      const n = photos.length + 1;
      photos.push({ n, code: ind.code, caption: p.caption || '', url: p.url });
      numbers.push(n);
    }
    const notes = [resp?.comment, resp?.recommendation ? `پیشنهاد: ${resp.recommendation}` : ''].filter(Boolean).join(' — ');
    const row = ws.getRow(rowNo++);
    row.values = [
      visit.assessmentType === 'STORE' ? `${groupLabel(ind.group)}\n\n${ind.group}` : ind.group,
      ind.code,
      ind.subject,
      ind.statement,
      'X',
      resp?.answerState === 'FRICTION' ? 'X' : resp?.answerState === 'NOT_APPLICABLE' ? 'NA' : '',
      resp?.answerState === 'FRICTION' ? notes : '',
      numbers.join('، '),
    ];
    row.alignment = { vertical: 'top', wrapText: true };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'top' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'top' };
    if (resp?.answerState === 'FRICTION') row.getCell(6).font = { bold: true, color: { argb: 'FFD64545' } };
  }

  // Friction-rate table: F% = FR / (Indicators − N/A), per zone and in total.
  const sum = wb.addWorksheet('Summary', { views: [{ rightToLeft: true }] });
  sum.columns = [{ width: 24 }, { width: 14 }, { width: 14 }, { width: 10 }, { width: 12 }];
  sum.addRow(['', 'Indicators', 'FR Recorded', 'N/A', 'Weight']).font = { bold: true };
  const rate = computeStoreFrictionRate(visit.indicators, visit.responses);
  const pct = (r: number) => `${Math.round(r * 100)}%`;
  for (const z of rate.zones) sum.addRow([ZONE_EN[z.group] || z.group, z.indicators, z.frictions, z.notApplicable, pct(z.rate)]);
  const t = sum.addRow(['Total', rate.total.indicators, rate.total.frictions, rate.total.notApplicable, pct(rate.total.rate)]);
  t.font = { bold: true, color: { argb: 'FF0070C0' } };
  sum.addRow([]);
  sum.addRow(['موضوع', 'منطقه', 'شاخص', 'FR', 'نرخ اصطکاک']).font = { bold: true };
  for (const topic of rate.topics) sum.addRow([topic.subject, groupLabel(topic.group), topic.indicators, topic.frictions, pct(topic.rate)]);

  if (photos.length) {
    const ps = wb.addWorksheet('عکس‌ها', { views: [{ rightToLeft: true }] });
    ps.columns = [{ width: 12 }, { width: 12 }, { width: 40 }, { width: 80 }];
    ps.addRow(['شماره عکس', 'کد شاخص', 'توضیح', 'نشانی تصویر']).font = { bold: true };
    photos.forEach((p) => ps.addRow([p.n, p.code, p.caption, p.url.startsWith('data:') ? '(ذخیره‌شده روی دستگاه)' : p.url]));
  }

  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `پرسشنامه ${visit.brandName} - ${visit.branchName}.xlsx`.replace(/[\\/:*?"<>|]+/g, '-');
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
