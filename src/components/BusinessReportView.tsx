import React, { useEffect, useMemo, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { VisitSession } from '../types';
import { computeBrandFrictionRates, computeFrictionRate, isFinishedVisit, latestVisitPerBranch } from '../engine/frModel';
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
  const brands = useMemo(() => {
    const counts = new Map<string, Set<string>>();
    for (const v of visits.filter(isFinishedVisit)) {
      if (!counts.has(v.brandName)) counts.set(v.brandName, new Set());
      counts.get(v.brandName)!.add(v.branchName);
    }
    return [...counts.entries()]
      .map(([name, branches]) => ({ name, branches: branches.size }))
      .sort((a, b) => b.branches - a.branches || a.name.localeCompare(b.name, 'fa'));
  }, [visits]);

  const [brand, setBrand] = useState('');
  useEffect(() => {
    if (!brands.some((b) => b.name === brand)) setBrand(brands[0]?.name || '');
  }, [brands, brand]);

  const latest = useMemo(() => (brand ? latestVisitPerBranch(brand, visits) : []), [brand, visits]);
  const business = useMemo(() => computeFrictionRate(latest), [latest]);
  const branches = useMemo(() => (brand ? computeBrandFrictionRates(brand, visits) : []), [brand, visits]);

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
          <label className="business-brand">
            <span>برند</span>
            <select className="select-rs" value={brand} onChange={(e) => setBrand(e.target.value)}>
              {brands.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name} — {faDigits(b.branches)} شعبه
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

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
