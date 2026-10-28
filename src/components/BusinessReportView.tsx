import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Download } from 'lucide-react';
import type { VisitSession } from '../types';
import type { Brand } from '../services/brandService';
import { computeBrandFrictionRates, computeFrictionRate, computeStoreFrictionRate, isFinishedVisit, latestVisitPerBranch, nameKey } from '../engine/frModel';
import { BusinessDetail } from './BusinessDetail';
import { BranchSection, TopTopicsByCountSection, TopTopicsSection, ZoneSection, ZONE_ORDER, faRate } from './FrictionRateReport';
import { faDigits, groupLabel } from '../utils/format';

/*
 * Total Business: one brand, all its branches. Each branch contributes its
 * most recent finished visit. Zone and topic rates sum the counts of every
 * branch before dividing, so a denominator is always "all indicators of that
 * slice across the business, minus N/A".
 */

interface BusinessReportViewProps {
  /** Visits with brand and branch names as they are today (renames and merges applied). */
  visits: VisitSession[];
  brands?: Brand[];
  isLoading?: boolean;
  onOpenVisit?: (visit: VisitSession) => void;
  onNewVisit?: (brandName: string, branchName: string) => void;
}

export const BusinessReportView: React.FC<BusinessReportViewProps> = ({ visits, brands: registry = [], isLoading, onOpenVisit, onNewVisit }) => {
  // One entry per brand, however it was spelled: "هوکانی" and "هوکانی " are the same brand.
  const brands = useMemo(() => {
    const groups = new Map<string, { spellings: Map<string, number>; branches: Set<string> }>();
    for (const v of visits.filter(isFinishedVisit)) {
      const key = nameKey(v.brandName);
      if (!groups.has(key)) groups.set(key, { spellings: new Map(), branches: new Set() });
      const g = groups.get(key)!;
      g.spellings.set(v.brandName, (g.spellings.get(v.brandName) || 0) + 1);
      g.branches.add(nameKey(v.branchName));
    }
    return [...groups.entries()]
      .map(([key, g]) => ({
        key,
        name: [...g.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0].trim(),
        branches: g.branches.size,
      }))
      .sort((a, b) => b.branches - a.branches || a.name.localeCompare(b.name, 'fa'));
  }, [visits]);

  const [brandKey, setBrandKey] = useState('');
  // Brands typed differently (or each branch typed as its own brand) can be added to the same business.
  const [merged, setMerged] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  useEffect(() => {
    if (!brands.some((b) => b.key === brandKey)) setBrandKey(brands[0]?.key || '');
  }, [brands, brandKey]);
  useEffect(() => setMerged((m) => m.filter((k) => k !== brandKey && brands.some((b) => b.key === k))), [brands, brandKey]);

  const main = brands.find((b) => b.key === brandKey);
  const brand = main?.name || '';
  const included = useMemo(() => brands.filter((b) => b.key === brandKey || merged.includes(b.key)), [brands, brandKey, merged]);
  const names = useMemo(() => included.map((b) => b.name), [included]);

  const allLatest = useMemo(() => (names.length ? latestVisitPerBranch(names, visits) : []), [names, visits]);
  // Which branches are in the report: all of them unless some are unticked.
  const [skipped, setSkipped] = useState<string[]>([]);
  useEffect(() => setSkipped([]), [brandKey, merged.join('|')]);
  const picked = useMemo(() => new Set(allLatest.map((v) => nameKey(v.branchName)).filter((k) => !skipped.includes(k))), [allLatest, skipped]);
  const latest = useMemo(() => allLatest.filter((v) => picked.has(nameKey(v.branchName))), [allLatest, picked]);
  const pickedVisits = useMemo(() => visits.filter((v) => picked.has(nameKey(v.branchName))), [visits, picked]);
  const business = useMemo(() => computeFrictionRate(latest), [latest]);
  const branches = useMemo(() => (names.length ? computeBrandFrictionRates(names, pickedVisits) : []), [names, pickedVisits]);
  const detail = useMemo(
    () =>
      latest
        .map((v) => ({ visit: v, rate: computeStoreFrictionRate(v.indicators, v.responses) }))
        .sort((a, b) => b.rate.total.rate - a.rate.total.rate),
    [latest],
  );
  const withoutVisits = registry.filter((b) => b.isActive && !brands.some((x) => x.key === nameKey(b.name)));
  const others = brands.filter((b) => b.key !== brandKey);

  return (
    <div className="page business-page">
      <header className="business-header">
        <div>
          <h2 className="section-title">
            <Building2 size={22} /> گزارش کل کسب‌وکار
          </h2>
          <p className="business-sub">
            همه‌ی شعب یک برند در یک گزارش: نرخ اصطکاک پنج منطقه، ۱۰ اصطکاک اصلی (کل و هر منطقه) و مقایسه‌ی شعب. از هر
            شعبه آخرین پرسشنامه‌ی ارسال‌شده یا تأییدشده حساب می‌شود.
          </p>
        </div>
        {brands.length > 0 && (
          <button
            type="button"
            className="btn-primary"
            disabled={exporting || !latest.length}
            onClick={async () => {
              setExporting(true);
              try {
                const { downloadBusinessDeck } = await import('../services/pptxReport');
                await downloadBusinessDeck(names, pickedVisits);
              } catch (err) {
                console.error('PowerPoint export failed:', err);
                alert('ساخت پاورپوینت انجام نشد. دوباره تلاش کنید.');
              } finally {
                setExporting(false);
              }
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} />
            <span>{exporting ? 'در حال ساخت پاورپوینت…' : 'دانلود پاورپوینت'}</span>
          </button>
        )}
        {brands.length > 0 && (
          <label className="business-brand">
            <span>برند</span>
            <select className="select-rs" value={brandKey} onChange={(e) => setBrandKey(e.target.value)}>
              {brands.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.name} — {faDigits(b.branches)} شعبه
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {others.length > 0 && (
        <details className="fr-card business-merge">
          <summary>
            افزودن برندهای دیگر به این گزارش{merged.length ? ` (${faDigits(merged.length)} مورد)` : ''}
          </summary>
          <p className="fr-card__subtitle">
            اگر شعب یک فروشگاه با نام‌های متفاوت ثبت شده‌اند (مثلاً «هوکانی» و «هوکانی ولیعصر»)، همه را اینجا تیک بزنید تا در یک گزارش و در یک مقایسه بیایند.
            هر شعبه فقط یک بار و با آخرین ارزیابی‌اش حساب می‌شود.
          </p>
          <div className="business-merge__list">
            {others.map((b) => (
              <label key={b.key} className="ie-check">
                <input
                  type="checkbox"
                  checked={merged.includes(b.key)}
                  onChange={(e) => setMerged((m) => (e.target.checked ? [...m, b.key] : m.filter((k) => k !== b.key)))}
                />
                <span>{b.name} — {faDigits(b.branches)} شعبه</span>
              </label>
            ))}
          </div>
        </details>
      )}

      {allLatest.length > 1 && (
        <section className="fr-card" aria-labelledby="biz-branches-pick">
          <header className="fr-card__header">
            <div>
              <h3 id="biz-branches-pick" className="fr-card__title">شعب این گزارش</h3>
              <p className="fr-card__subtitle">همهٔ شعب {brand} در گزارش هستند. برای گزارش چند شعبهٔ مشخص، بقیه را از حالت انتخاب دربیاورید.</p>
            </div>
            <div className="ie-actions">
              <button type="button" className="btn-secondary" onClick={() => setSkipped([])} disabled={!skipped.length}>انتخاب همه</button>
            </div>
          </header>
          <div className="business-merge__list">
            {allLatest.map((v) => {
              const key = nameKey(v.branchName);
              return (
                <label key={v.id} className="ie-check">
                  <input
                    type="checkbox"
                    checked={picked.has(key)}
                    onChange={(e) => setSkipped((s) => (e.target.checked ? s.filter((k) => k !== key) : [...s, key]))}
                  />
                  <span>{v.branchName} <small className="ie-hint">· {new Date(v.completedAt || v.startedAt).toLocaleDateString('fa-IR')}</small></span>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {!brands.length ? (
        <div className="fr-card">
          <p className="fr-card__empty">
            {isLoading ? 'در حال بارگذاری…' : 'هنوز هیچ پرسشنامه‌ی ارسال‌شده‌ای نیست. گزارش کل کسب‌وکار پس از ثبت بازدید شعب ساخته می‌شود.'}
          </p>
        </div>
      ) : business.total.indicators ? (
        <>
          <ZoneSection
            rate={business}
            id="biz-zones-title"
            totalLabel="کل کسب‌وکار"
            title={`نرخ اصطکاک مناطق — کل ${brand}`}
            headline={`نرخ اصطکاک کل کسب‌وکار (${faDigits(latest.length)} شعبه)`}
          />
          <BranchSection brandName={brand} branches={branches} id="biz-branches-title" />
          <TopTopicsSection rate={business} id="biz-topics-title" title={`۱۰ موضوع با اصطکاک ۱۰۰٪ — کل ${brand}`} />
          <TopTopicsByCountSection rate={business} id="biz-topics-count-title" title={`۱۰ موضوع با بیشترین تعداد اصطکاک — کل ${brand}`} />

          <BusinessDetail brand={brand} visits={latest} />

          <section className="fr-card" aria-labelledby="biz-detail-title">
            <header className="fr-card__header">
              <div>
                <h3 id="biz-detail-title" className="fr-card__title">جزئیات هر شعبه</h3>
                <p className="fr-card__subtitle">نرخ اصطکاک هر منطقه برای هر شعبه، از آخرین ارزیابی نهایی‌شدهٔ آن؛ مرتب از بیشترین اصطکاک. با «گزارش کامل» به گزارش همان ارزیابی می‌روید.</p>
              </div>
            </header>
            <div className="fr-table-wrap">
              <table className="fr-table">
                <thead>
                  <tr>
                    <th scope="col">شعبه</th>
                    <th scope="col">تاریخ</th>
                    <th scope="col">ارزیاب</th>
                    {ZONE_ORDER.map((z) => <th key={z} scope="col">{groupLabel(z)}</th>)}
                    <th scope="col">کل</th>
                    <th scope="col">اصطکاک / شاخص</th>
                    {(onOpenVisit || onNewVisit) && <th scope="col" />}
                  </tr>
                </thead>
                <tbody>
                  {detail.map(({ visit, rate }) => {
                    const byZone = new Map(rate.zones.map((z) => [z.group, z]));
                    return (
                      <tr key={visit.id}>
                        <th scope="row">{visit.branchName}</th>
                        <td>{new Date(visit.completedAt || visit.startedAt).toLocaleDateString('fa-IR')}</td>
                        <td>{visit.auditorName || '—'}</td>
                        {ZONE_ORDER.map((z) => <td key={z} className="ltr-num">{byZone.get(z) ? faRate(byZone.get(z)!.rate) : '—'}</td>)}
                        <td className="ltr-num fr-table__rate">{faRate(rate.total.rate)}</td>
                        <td className="ltr-num">{faDigits(rate.total.frictions)} / {faDigits(rate.total.indicators - rate.total.notApplicable)}</td>
                        {(onOpenVisit || onNewVisit) && (
                          <td className="xl-actions">
                            {onOpenVisit && <button type="button" className="btn-secondary" style={{ minHeight: 30, padding: '0 10px' }} onClick={() => onOpenVisit(visit)}>گزارش کامل</button>}
                            {onNewVisit && <button type="button" className="btn-secondary" style={{ minHeight: 30, padding: '0 10px' }} onClick={() => onNewVisit(visit.brandName, visit.branchName)}>بازدید جدید</button>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {withoutVisits.length > 0 && (
        <p className="ie-hint">
          برندهای تعریف‌شده‌ای که هنوز ارزیابی نهایی‌شده ندارند: {withoutVisits.map((b) => b.name).join('، ')}
        </p>
      )}
    </div>
  );
};
