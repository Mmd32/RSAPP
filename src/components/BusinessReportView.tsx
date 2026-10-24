import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Download } from 'lucide-react';
import type { VisitSession } from '../types';
import { computeBrandFrictionRates, computeFrictionRate, isFinishedVisit, latestVisitPerBranch, nameKey } from '../engine/frModel';
import { BranchSection, TopTopicsSection, ZoneSection } from './FrictionRateReport';
import { faDigits } from '../utils/format';

/*
 * Total Business: one brand, all its branches. Each branch contributes its
 * most recent finished visit. Zone and topic rates sum the counts of every
 * branch before dividing, so a denominator is always "all indicators of that
 * slice across the business, minus N/A".
 */

interface BusinessReportViewProps {
  visits: VisitSession[];
  isLoading?: boolean;
}

export const BusinessReportView: React.FC<BusinessReportViewProps> = ({ visits, isLoading }) => {
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

  const latest = useMemo(() => (names.length ? latestVisitPerBranch(names, visits) : []), [names, visits]);
  const business = useMemo(() => computeFrictionRate(latest), [latest]);
  const branches = useMemo(() => (names.length ? computeBrandFrictionRates(names, visits) : []), [names, visits]);
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
            disabled={exporting || !names.length}
            onClick={async () => {
              setExporting(true);
              try {
                const { downloadBusinessDeck } = await import('../services/pptxReport');
                await downloadBusinessDeck(names, visits);
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
          <TopTopicsSection rate={business} id="biz-topics-title" title={`۱۰ اصطکاک اصلی — کل ${brand}`} />
        </>
      ) : null}
    </div>
  );
};
