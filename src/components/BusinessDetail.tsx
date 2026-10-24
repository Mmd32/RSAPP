import React, { useMemo, useState } from 'react';
import type { VisitSession } from '../types';
import { computeFrictionRate, computeStoreFrictionRate, topFrictionTopics } from '../engine/frModel';
import { ZONE_ORDER, faRate } from './FrictionRateReport';
import { faDigits, groupLabel } from '../utils/format';

interface Props {
  brand: string;
  /** One finished visit per branch (the latest). */
  visits: VisitSession[];
}

const frictions = (v: VisitSession) => v.indicators.filter((i) => v.responses?.[i.id]?.answerState === 'FRICTION');

/**
 * The detail of a brand's report: every topic of every zone, what each branch
 * got wrong, and which indicators fail in how many branches.
 */
export const BusinessDetail: React.FC<Props> = ({ brand, visits }) => {
  const business = useMemo(() => computeFrictionRate(visits), [visits]);
  const perBranch = useMemo(
    () =>
      visits
        .map((visit) => ({ visit, rate: computeStoreFrictionRate(visit.indicators, visit.responses), list: frictions(visit) }))
        .sort((a, b) => b.rate.total.rate - a.rate.total.rate),
    [visits],
  );

  // Indicators that failed somewhere, with the branches they failed in.
  const [query, setQuery] = useState('');
  const [shown, setShown] = useState(40);
  const indicatorRows = useMemo(() => {
    const map = new Map<string, { id: string; code: string; group: string; subject: string; statement: string; branches: string[]; assessed: number }>();
    for (const v of visits) {
      for (const ind of v.indicators) {
        const answer = v.responses?.[ind.id]?.answerState;
        if (answer === 'NOT_APPLICABLE') continue;
        const row = map.get(ind.id) || { id: ind.id, code: ind.code, group: ind.group, subject: ind.subject, statement: ind.statement, branches: [], assessed: 0 };
        row.assessed += 1;
        if (answer === 'FRICTION') row.branches.push(v.branchName);
        map.set(ind.id, row);
      }
    }
    return [...map.values()].filter((r) => r.branches.length).sort((a, b) => b.branches.length - a.branches.length || a.code.localeCompare(b.code));
  }, [visits]);
  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? indicatorRows.filter((r) => `${r.code} ${r.subject} ${r.statement} ${r.branches.join(' ')}`.toLowerCase().includes(q)) : indicatorRows;
  }, [indicatorRows, query]);

  if (!visits.length) return null;

  return (
    <>
      <section className="fr-card" aria-labelledby="bd-topics-title">
        <header className="fr-card__header">
          <div>
            <h3 id="bd-topics-title" className="fr-card__title">زیرمجموعه‌ها: موضوع‌های هر منطقه — کل {brand}</h3>
            <p className="fr-card__subtitle">نرخ اصطکاک هر موضوع از جمع همهٔ شعب: اصطکاک‌های آن موضوع ÷ (شاخص‌های همان موضوع − غیرقابل ارزیابی). روی هر منطقه بزنید.</p>
          </div>
        </header>
        {ZONE_ORDER.map((zone) => {
          const zoneRow = business.zones.find((z) => z.group === zone);
          const topics = business.topics.filter((t) => t.group === zone);
          if (!zoneRow) return null;
          return (
            <details key={zone} className="bd-zone">
              <summary>
                <span className="fr-swatch" style={{ background: `var(--zone-${zone})` }} aria-hidden="true" />
                <strong>{groupLabel(zone)}</strong>
                <span className="ltr-num fr-table__rate">{faRate(zoneRow.rate)}</span>
                <span className="ie-hint">{faDigits(topics.length)} موضوع · {faDigits(zoneRow.frictions)} اصطکاک</span>
              </summary>
              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead><tr><th scope="col">موضوع</th><th scope="col">شاخص‌ها</th><th scope="col">اصطکاک</th><th scope="col">N/A</th><th scope="col">نرخ اصطکاک</th></tr></thead>
                  <tbody>
                    {topics.map((t) => (
                      <tr key={t.key}>
                        <th scope="row">{t.subject}</th>
                        <td className="ltr-num">{faDigits(t.indicators)}</td>
                        <td className="ltr-num">{faDigits(t.frictions)}</td>
                        <td className="ltr-num">{faDigits(t.notApplicable)}</td>
                        <td className="ltr-num fr-table__rate">{faRate(t.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>

      <section className="fr-card" aria-labelledby="bd-branches-title">
        <header className="fr-card__header">
          <div>
            <h3 id="bd-branches-title" className="fr-card__title">اصطکاک‌های هر شعبه</h3>
            <p className="fr-card__subtitle">برای هر شعبه: نرخ هر منطقه، ۱۰ موضوع پراصطکاک و فهرست کامل شاخص‌هایی که اصطکاک داشته‌اند.</p>
          </div>
        </header>
        {perBranch.map(({ visit, rate, list }) => {
          const byZone = new Map(rate.zones.map((z) => [z.group, z]));
          const top = topFrictionTopics(rate, 10);
          return (
            <details key={visit.id} className="bd-zone" data-branch={visit.branchName}>
              <summary>
                <strong>{visit.branchName}</strong>
                <span className="ltr-num fr-table__rate">{faRate(rate.total.rate)}</span>
                <span className="ie-hint">{faDigits(list.length)} اصطکاک از {faDigits(rate.total.indicators - rate.total.notApplicable)} شاخص · {new Date(visit.completedAt || visit.startedAt).toLocaleDateString('fa-IR')}</span>
              </summary>
              <div className="bd-chips">
                {ZONE_ORDER.map((z) => (
                  <span key={z} className="ie-chip">
                    <span className="fr-swatch" style={{ background: `var(--zone-${z})` }} aria-hidden="true" /> {groupLabel(z)}: {byZone.get(z) ? faRate(byZone.get(z)!.rate) : '—'}
                  </span>
                ))}
              </div>
              {top.length > 0 && (
                <div className="fr-table-wrap">
                  <table className="fr-table">
                    <caption className="ie-hint">۱۰ موضوع پراصطکاک</caption>
                    <thead><tr><th scope="col">موضوع</th><th scope="col">منطقه</th><th scope="col">اصطکاک از شاخص</th><th scope="col">نرخ</th></tr></thead>
                    <tbody>
                      {top.map((t) => (
                        <tr key={t.key}>
                          <th scope="row">{t.subject}</th>
                          <td>{groupLabel(t.group)}</td>
                          <td className="ltr-num">{faDigits(t.frictions)} از {faDigits(t.indicators - t.notApplicable)}</td>
                          <td className="ltr-num fr-table__rate">{faRate(t.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="fr-table-wrap">
                <table className="fr-table">
                  <caption className="ie-hint">شاخص‌های دارای اصطکاک ({faDigits(list.length)})</caption>
                  <thead><tr><th scope="col">کد</th><th scope="col">منطقه · موضوع</th><th scope="col">شاخص</th><th scope="col">توضیح ارزیاب</th></tr></thead>
                  <tbody>
                    {list.map((ind) => (
                      <tr key={ind.id}>
                        <td dir="ltr">{ind.code}</td>
                        <td>{groupLabel(ind.group)} · {ind.subject}</td>
                        <td>{ind.statement}</td>
                        <td>{visit.responses?.[ind.id]?.comment || '—'}</td>
                      </tr>
                    ))}
                    {!list.length && <tr><td colSpan={4} className="ie-hint">در این ارزیابی اصطکاکی ثبت نشده است.</td></tr>}
                  </tbody>
                </table>
              </div>
            </details>
          );
        })}
      </section>

      <section className="fr-card" aria-labelledby="bd-kpi-title">
        <header className="fr-card__header">
          <div>
            <h3 id="bd-kpi-title" className="fr-card__title">شاخص‌های دارای اصطکاک در کل {brand}</h3>
            <p className="fr-card__subtitle">هر شاخص و شعبه‌هایی که در آن اصطکاک داشته‌اند، مرتب از بیشترین تعداد شعبه.</p>
          </div>
          <input className="ie-input" style={{ maxWidth: 240 }} placeholder="جستجوی کد، موضوع یا شعبه…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="جستجو" />
        </header>
        <div className="fr-table-wrap">
          <table className="fr-table">
            <thead><tr><th scope="col">کد</th><th scope="col">منطقه · موضوع</th><th scope="col">شاخص</th><th scope="col">شعب</th><th scope="col">شعبه‌ها</th></tr></thead>
            <tbody>
              {filteredRows.slice(0, shown).map((r) => (
                <tr key={r.id}>
                  <td dir="ltr">{r.code}</td>
                  <td>{groupLabel(r.group)} · {r.subject}</td>
                  <td>{r.statement}</td>
                  <td className="ltr-num fr-table__rate">{faDigits(r.branches.length)} از {faDigits(r.assessed)}</td>
                  <td>{r.branches.join('، ')}</td>
                </tr>
              ))}
              {!filteredRows.length && <tr><td colSpan={5} className="ie-hint">موردی پیدا نشد.</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredRows.length > shown && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-3)' }}>
            <button type="button" className="btn-secondary" onClick={() => setShown((n) => n + 40)}>نمایش {faDigits(Math.min(40, filteredRows.length - shown))} مورد دیگر ({faDigits(filteredRows.length - shown)} باقی‌مانده)</button>
          </div>
        )}
      </section>
    </>
  );
};
