import React, { useMemo, useState } from 'react';
import type { VisitSession } from '../types';
import {
  computeBrandFrictionRates,
  computeStoreFrictionRate,
  topFrictionTopics,
  type FrictionRateRow,
} from '../engine/frModel';
import { faDate, faDigits, groupLabel } from '../utils/format';

/*
 * Friction Rate (FR) report: F% = FR / (Indicators − N/A), per zone, per
 * topic and per branch. One measure, one hue (the friction colour); higher is
 * worse everywhere. Every chart is paired with a table or direct labels so no
 * value is read off the geometry alone.
 */

/** Friction rate as a Persian percentage with at most one decimal (0.4930 → ٪۴۹٫۳). */
export function faRate(rate: number): string {
  const pct = Math.round(rate * 1000) / 10;
  const text = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
  return `٪${faDigits(text).replace('.', '٫')}`;
}

const assessable = (r: FrictionRateRow) => r.indicators - r.notApplicable;

/* --- Zone table ------------------------------------------------------------ */

const ZoneTable: React.FC<{ zones: FrictionRateRow[]; total: FrictionRateRow }> = ({ zones, total }) => (
  <div className="fr-table-wrap">
    <table className="fr-table">
      <thead>
        <tr>
          <th scope="col">منطقه</th>
          <th scope="col">شاخص‌ها</th>
          <th scope="col" title="تعداد اصطکاک">FR</th>
          <th scope="col" title="غیرقابل ارزیابی">N/A</th>
          <th scope="col" title="نرخ اصطکاک = FR ÷ (شاخص‌ها − N/A)"><bdi dir="ltr">F%</bdi></th>
        </tr>
      </thead>
      <tbody>
        {zones.map((z) => (
          <tr key={z.key}>
            <th scope="row">{groupLabel(z.group)}</th>
            <td className="ltr-num">{faDigits(z.indicators)}</td>
            <td className="ltr-num">{faDigits(z.frictions)}</td>
            <td className="ltr-num">{faDigits(z.notApplicable)}</td>
            <td className="ltr-num fr-table__rate">{faRate(z.rate)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <th scope="row">کل فروشگاه</th>
          <td className="ltr-num">{faDigits(total.indicators)}</td>
          <td className="ltr-num">{faDigits(total.frictions)}</td>
          <td className="ltr-num">{faDigits(total.notApplicable)}</td>
          <td className="ltr-num fr-table__rate">{faRate(total.rate)}</td>
        </tr>
      </tfoot>
    </table>
  </div>
);

/* --- Zone radar ------------------------------------------------------------ */

/**
 * The highest-friction zone sits at 12 o'clock and the rest follow clockwise
 * from highest to lowest, so the shape always "leans" from the top.
 */
const ZoneRadar: React.FC<{ zones: FrictionRateRow[] }> = ({ zones }) => {
  const [active, setActive] = useState<string | null>(null);
  const width = 480;
  const height = 380;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 108;
  const n = zones.length;
  const maxRate = Math.max(0, ...zones.map((z) => z.rate));
  // Scale to the next 10% above the worst zone so differences stay readable.
  const scaleMax = Math.min(1, Math.max(0.1, Math.ceil(maxRate * 10 - 1e-9) / 10));
  const rings = [0.25, 0.5, 0.75, 1];

  const angle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / n;
  const point = (i: number, value: number) => {
    const r = (Math.min(value, scaleMax) / scaleMax) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))] as const;
  };
  const polygon = zones.map((z, i) => point(i, z.rate).join(',')).join(' ');

  return (
    <svg
      className="fr-radar"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`نمودار راداری نرخ اصطکاک مناطق؛ ${zones.map((z) => `${groupLabel(z.group)} ${faRate(z.rate)}`).join('، ')}`}
    >
      {rings.map((t) => (
        <polygon
          key={t}
          className={t === 1 ? 'fr-radar__ring fr-radar__ring--outer' : 'fr-radar__ring'}
          points={zones
            .map((_, i) => [cx + radius * t * Math.cos(angle(i)), cy + radius * t * Math.sin(angle(i))].join(','))
            .join(' ')}
        />
      ))}
      {/* Scale labels run between the first two spokes, clear of the data. */}
      {rings.map((t) => {
        const a = angle(0.5);
        return (
          <text
            key={`s${t}`}
            className="fr-radar__scale"
            x={cx + radius * t * Math.cos(a)}
            y={cy + radius * t * Math.sin(a)}
            textAnchor="middle"
          >
            {faRate(scaleMax * t)}
          </text>
        );
      })}
      {zones.map((z, i) => {
        const [x, y] = [cx + radius * Math.cos(angle(i)), cy + radius * Math.sin(angle(i))];
        return <line key={z.key} className="fr-radar__spoke" x1={cx} y1={cy} x2={x} y2={y} />;
      })}
      <polygon className="fr-radar__shape" points={polygon} />
      {zones.map((z, i) => {
        const [x, y] = point(i, z.rate);
        const lx = cx + (radius + 22) * Math.cos(angle(i));
        const ly = cy + (radius + 22) * Math.sin(angle(i));
        const cos = Math.cos(angle(i));
        const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
        const isActive = active === z.key;
        return (
          <g
            key={z.key}
            className={isActive ? 'fr-radar__point is-active' : 'fr-radar__point'}
            onMouseEnter={() => setActive(z.key)}
            onMouseLeave={() => setActive(null)}
          >
            <title>{`${groupLabel(z.group)}: ${faRate(z.rate)} (${faDigits(z.frictions)} از ${faDigits(assessable(z))})`}</title>
            <circle className="fr-radar__hit" cx={x} cy={y} r={14} />
            <circle className="fr-radar__dot" cx={x} cy={y} r={isActive ? 6 : 4.5} />
            <text className="fr-radar__label" x={lx} y={ly - 6} textAnchor={anchor}>
              <tspan className="fr-radar__label-name">{groupLabel(z.group)}</tspan>
            </text>
            <text className="fr-radar__label fr-radar__label-value" x={lx} y={ly + 11} textAnchor={anchor}>
              {faRate(z.rate)}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* --- Horizontal bar chart -------------------------------------------------- */

interface BarItem {
  key: string;
  label: string;
  sublabel?: string;
  rate: number;
  frictions: number;
  assessable: number;
  highlight?: boolean;
}

const RateBars: React.FC<{ items: BarItem[]; ariaLabel: string }> = ({ items, ariaLabel }) => (
  <div className="fr-bars" role="list" aria-label={ariaLabel}>
    <div className="fr-bars__axis" aria-hidden="true">
      {[0, 25, 50, 75, 100].map((t) => (
        <span key={t} style={{ insetInlineStart: `${t}%` }}>
          {faRate(t / 100)}
        </span>
      ))}
    </div>
    {items.map((item, i) => (
      <div
        key={item.key}
        role="listitem"
        className={item.highlight ? 'fr-bars__row is-highlight' : 'fr-bars__row'}
        title={`${item.label}: ${faRate(item.rate)} — ${faDigits(item.frictions)} اصطکاک از ${faDigits(item.assessable)} شاخص قابل ارزیابی`}
      >
        <div className="fr-bars__label">
          <span className="fr-bars__rank ltr-num">{faDigits(i + 1)}</span>
          <span className="fr-bars__name">
            {item.label}
            {item.sublabel && <small>{item.sublabel}</small>}
          </span>
        </div>
        <div className="fr-bars__track">
          <span className="fr-bars__grid" aria-hidden="true" />
          <span className="fr-bars__bar" style={{ width: `${Math.max(item.rate * 100, item.rate > 0 ? 1 : 0)}%` }} />
        </div>
        <div className="fr-bars__value">
          <b className="ltr-num">{faRate(item.rate)}</b>
          <small>
            {faDigits(item.frictions)} از {faDigits(item.assessable)}
          </small>
        </div>
      </div>
    ))}
  </div>
);

/* --- Report ---------------------------------------------------------------- */

interface FrictionRateReportProps {
  visit: VisitSession;
  /** Other visits, for the brand-wide branch comparison. */
  historyVisits?: VisitSession[];
  /** On the built-in sample there is no real brand to compare against. */
  isSample?: boolean;
}

export const FrictionRateReport: React.FC<FrictionRateReportProps> = ({ visit, historyVisits = [], isSample }) => {
  const store = useMemo(() => computeStoreFrictionRate(visit.indicators, visit.responses), [visit.indicators, visit.responses]);
  const topTopics = useMemo(() => topFrictionTopics(store, 10), [store]);
  const branches = useMemo(
    () => (isSample ? [] : computeBrandFrictionRates(visit.brandName, historyVisits, visit)),
    [isSample, visit, historyVisits],
  );

  if (!store.total.indicators) return null;

  return (
    <>
      <section className="fr-card" aria-labelledby="fr-zones-title">
        <header className="fr-card__header">
          <div>
            <h3 id="fr-zones-title" className="fr-card__title">نرخ اصطکاک به تفکیک منطقه</h3>
            <p className="fr-card__subtitle">
              نرخ اصطکاک (<bdi dir="ltr">F%</bdi>) = تعداد اصطکاک (FR) ÷ (تعداد شاخص‌ها − غیرقابل ارزیابی (N/A)). در نمودار، منطقه با بیشترین اصطکاک در بالا
              قرار دارد و بقیه در جهت عقربه‌های ساعت از بیشترین به کمترین می‌آیند.
            </p>
          </div>
          <div className="fr-card__headline">
            <span>نرخ اصطکاک کل فروشگاه</span>
            <b className="ltr-num">{faRate(store.total.rate)}</b>
            <small>
              {faDigits(store.total.frictions)} از {faDigits(assessable(store.total))} شاخص قابل ارزیابی
            </small>
          </div>
        </header>
        <div className="fr-card__body">
          {store.zones.length >= 3 ? (
            <div className="fr-card__plot">
              <ZoneRadar zones={store.zones} />
            </div>
          ) : null}
          <ZoneTable zones={store.zones} total={store.total} />
        </div>
        {store.total.unanswered > 0 && (
          <p className="fr-card__note">
            {faDigits(store.total.unanswered)} شاخص بی‌پاسخ مانده و طبق فرمول در مخرج باقی است.
          </p>
        )}
      </section>

      <section className="fr-card" aria-labelledby="fr-topics-title">
        <header className="fr-card__header">
          <div>
            <h3 id="fr-topics-title" className="fr-card__title">۱۰ موضوع پراصطکاک فروشگاه</h3>
            <p className="fr-card__subtitle">
              نرخ هر موضوع فقط با شاخص‌های همان موضوع محاسبه می‌شود: اصطکاک‌های موضوع ÷ (شاخص‌های همان موضوع − غیرقابل ارزیابی
              همان موضوع).
            </p>
          </div>
        </header>
        {topTopics.length ? (
          <RateBars
            ariaLabel="موضوعات با بیشترین نرخ اصطکاک"
            items={topTopics.map((t) => ({
              key: t.key,
              label: t.subject,
              sublabel: groupLabel(t.group),
              rate: t.rate,
              frictions: t.frictions,
              assessable: assessable(t),
            }))}
          />
        ) : (
          <p className="fr-card__empty">در این بازدید هیچ اصطکاکی ثبت نشده است.</p>
        )}
      </section>

      {!isSample && (
        <section className="fr-card" aria-labelledby="fr-branches-title">
          <header className="fr-card__header">
            <div>
              <h3 id="fr-branches-title" className="fr-card__title">مقایسه شعب برند {visit.brandName}</h3>
              <p className="fr-card__subtitle">
                آخرین بازدید ثبت‌شده‌ی هر شعبه. مخرج برای هر شعبه همه‌ی شاخص‌های بررسی‌شده در آن فروشگاه در تمام مناطق منهای
                غیرقابل ارزیابی است. مرتب از بیشترین به کمترین.
              </p>
            </div>
          </header>
          {branches.length >= 2 ? (
            <div className="fr-card__stack">
              <div className="fr-table-wrap">
                <table className="fr-table">
                  <thead>
                    <tr>
                      <th scope="col">شعبه</th>
                      <th scope="col">شاخص‌ها</th>
                      <th scope="col" title="تعداد اصطکاک">FR</th>
                      <th scope="col" title="غیرقابل ارزیابی">N/A</th>
                      <th scope="col" title="نرخ اصطکاک = FR ÷ (شاخص‌ها − N/A)"><bdi dir="ltr">F%</bdi></th>
                    </tr>
                  </thead>
                  <tbody>
                    {branches.map((b) => (
                      <tr key={b.key} className={b.visitId === visit.id ? 'is-current' : undefined}>
                        <th scope="row">
                          {b.branchName}
                          <small>{b.visitId === visit.id ? 'همین بازدید' : faDate(b.visitDate)}</small>
                        </th>
                        <td className="ltr-num">{faDigits(b.indicators)}</td>
                        <td className="ltr-num">{faDigits(b.frictions)}</td>
                        <td className="ltr-num">{faDigits(b.notApplicable)}</td>
                        <td className="ltr-num fr-table__rate">{faRate(b.rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <RateBars
                ariaLabel="نرخ اصطکاک شعب"
                items={branches.map((b) => ({
                  key: b.key,
                  label: b.branchName,
                  sublabel: b.visitId === visit.id ? 'همین بازدید' : undefined,
                  rate: b.rate,
                  frictions: b.frictions,
                  assessable: assessable(b),
                  highlight: b.visitId === visit.id,
                }))}
              />
            </div>
          ) : (
            <p className="fr-card__empty">
              برای مقایسه، دست‌کم دو شعبه از برند {visit.brandName} باید بازدید ثبت‌شده داشته باشند.
            </p>
          )}
        </section>
      )}
    </>
  );
};
