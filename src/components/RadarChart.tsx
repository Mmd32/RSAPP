import React, { useMemo, useState } from 'react';
import {
  CategoryScore,
  Indicator,
  QuestionResponse,
  RadarSeriesData,
  DimensionExplainabilityDetail,
} from '../types';
import { AlertTriangle, ArrowDown, ArrowUp, X } from 'lucide-react';
import { faDigits } from '../utils/format';

/*
 * Customer-journey radar.
 *
 * The data has one subject -- this visit -- and up to four points of
 * reference. That is the emphasis form: the current visit carries the only
 * colour, everything else is recessive context. The previous chart gave every
 * series its own saturated hue plus a gradient and a glow, so five lines
 * competed equally and the one that mattered did not stand out.
 *
 * Context series are told apart by dash pattern as well as by the legend, so
 * identity never rests on colour alone. Colour roles live in CSS
 * (--chart-*), validated for both themes; series.color from the engine is
 * deliberately ignored.
 *
 * A radar is good at shape and poor at precise values, so it is paired with a
 * ranked list of the same eight dimensions. That list is also the chart's
 * table view.
 */

interface RadarChartProps {
  categories: CategoryScore[];
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
  radarSeries?: RadarSeriesData[];
  dimensionDetails?: DimensionExplainabilityDetail[];
  onSelectDimension?: (dimKey: string) => void;
}

const PRIMARY_ID = 'current_visit';
const PREVIOUS_ID = 'previous_visit';

/** Dash patterns for the context series, keyed by series id. */
const CONTEXT_DASH: Record<string, string> = {
  previous_visit: '6 4',
  brand_average: '1.5 4',
  branch_average: '10 3 2 3',
  comparison_visit: '3 3',
};

/** Below this a dimension is flagged for attention in the ranked list. */
const ATTENTION_THRESHOLD = 60;

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'کم',
  MEDIUM: 'متوسط',
  HIGH: 'زیاد',
  CRITICAL: 'بحرانی',
};

const dimKeyOf = (c: CategoryScore) => c.dimensionKey || c.category;

export const RadarChart: React.FC<RadarChartProps> = ({
  categories,
  radarSeries,
  dimensionDetails,
  onSelectDimension,
}) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [compact, setCompact] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 600px)').matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const onChange = () => setCompact(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const [series, setSeries] = useState<RadarSeriesData[]>(() => {
    if (radarSeries && radarSeries.length > 0) return radarSeries;
    const scores: Record<string, number> = {};
    categories.forEach((c) => (scores[dimKeyOf(c)] = c.score));
    return [{ id: PRIMARY_ID, label: 'ارزیابی فعلی', color: '', scores, visible: true }];
  });

  React.useEffect(() => {
    if (radarSeries && radarSeries.length > 0) setSeries(radarSeries);
  }, [radarSeries]);

  const previous = series.find((s) => s.id === PREVIOUS_ID);

  const ranked = useMemo(
    () => [...categories].sort((a, b) => a.score - b.score),
    [categories]
  );

  if (!categories || categories.length === 0) return null;

  const select = (key: string) => {
    const next = selectedKey === key ? null : key;
    setSelectedKey(next);
    if (next && onSelectDimension) onSelectDimension(next);
  };

  const toggleSeries = (id: string) => {
    // The current visit is the subject of the chart and cannot be hidden.
    if (id === PRIMARY_ID) return;
    setSeries((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  };

  // --- Geometry ------------------------------------------------------------
  const W = 440;
  const H = 400;
  const cx = W / 2;
  const cy = H / 2 + 4;
  // On narrow screens the SVG is scaled down and labels are set larger, so
  // shrink the plot to leave the long Persian axis names room at the edges.
  const R = compact ? 100 : 128;
  const n = categories.length;
  const step = (Math.PI * 2) / n;
  const angleAt = (i: number) => i * step - Math.PI / 2;
  const pointAt = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * R;
    return [cx + r * Math.cos(angleAt(i)), cy + r * Math.sin(angleAt(i))] as const;
  };
  // Rings share the data's shape: an octagon of data inside circular rings
  // reads as two different geometries laid over each other.
  const ringPath = (fraction: number) =>
    categories
      .map((_, i) => pointAt(i, fraction * 100))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ') + 'Z';

  const seriesPath = (s: RadarSeriesData) =>
    categories
      .map((c, i) => pointAt(i, s.scores[dimKeyOf(c)] ?? c.score))
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ') + 'Z';

  const visibleContext = series.filter((s) => s.id !== PRIMARY_ID && s.visible);
  const primary = series.find((s) => s.id === PRIMARY_ID) || series[0];

  const wedgePath = (i: number) => {
    const a0 = angleAt(i) - step / 2;
    const a1 = angleAt(i) + step / 2;
    const reach = R + 56;
    return `M${cx},${cy} L${cx + reach * Math.cos(a0)},${cy + reach * Math.sin(a0)} A${reach},${reach} 0 0 1 ${
      cx + reach * Math.cos(a1)
    },${cy + reach * Math.sin(a1)} Z`;
  };

  const hovered = hoverIndex !== null ? categories[hoverIndex] : null;
  const selectedCategory = categories.find((c) => dimKeyOf(c) === selectedKey);
  const selectedDetail = dimensionDetails?.find(
    (d) => d.dimensionKey === selectedKey || d.dimensionNameFa === selectedKey
  );

  return (
    <section className="radar" aria-labelledby="radar-title">
      <header className="radar__header">
        <div>
          <h3 id="radar-title" className="radar__title">
            رادار تجربهٔ مشتری
          </h3>
          <p className="radar__subtitle">
            {series.length > 1
              ? 'امتیاز این بازدید در ابعاد سفر مشتری، در کنار نقاط مرجع. برای دیدن شاخص‌های هر بُعد، روی آن کلیک کنید.'
              : 'امتیاز این بازدید در ابعاد سفر مشتری. مقایسه با بازدید پیشین از دومین بازدید همین شعبه نمایش داده می‌شود.'}
          </p>
        </div>

        {series.length > 1 && (
          <div className="radar__legend" role="group" aria-label="سری‌های نمودار">
            {series.map((s) => {
              const isPrimary = s.id === PRIMARY_ID;
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`radar__legend-item${s.visible ? '' : ' is-off'}`}
                  aria-pressed={s.visible}
                  disabled={isPrimary}
                  onClick={() => toggleSeries(s.id)}
                >
                  <svg width="22" height="8" aria-hidden="true">
                    <line
                      x1="1"
                      y1="4"
                      x2="21"
                      y2="4"
                      className={isPrimary ? 'radar__swatch-primary' : 'radar__swatch-context'}
                      strokeDasharray={isPrimary ? undefined : CONTEXT_DASH[s.id] || '4 3'}
                    />
                  </svg>
                  {s.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <div className="radar__body">
        {/* --- The chart ---------------------------------------------------- */}
        <div className="radar__plot">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="radar__svg"
            role="img"
            aria-label={`نمودار رادار: ${categories
              .map((c) => `${c.category} ${faDigits(c.score)} درصد`)
              .join('، ')}`}
            onMouseLeave={() => setHoverIndex(null)}
          >
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <path key={f} d={ringPath(f)} className={f === 1 ? 'radar__ring radar__ring--outer' : 'radar__ring'} />
            ))}

            {categories.map((c, i) => {
              const [x, y] = pointAt(i, 100);
              const active = hoverIndex === i || selectedKey === dimKeyOf(c);
              return (
                <line
                  key={dimKeyOf(c)}
                  x1={cx}
                  y1={cy}
                  x2={x}
                  y2={y}
                  className={active ? 'radar__spoke is-active' : 'radar__spoke'}
                />
              );
            })}

            {/* Scale, once, along the top spoke. */}
            {[50, 100].map((v) => {
              const [, y] = pointAt(0, v);
              return (
                <text key={v} x={cx + 4} y={y + 10} className="radar__scale">
                  {faDigits(v)}
                </text>
              );
            })}

            {visibleContext.map((s) => (
              <path
                key={s.id}
                d={seriesPath(s)}
                className="radar__context"
                strokeDasharray={CONTEXT_DASH[s.id] || '4 3'}
              />
            ))}

            <path d={seriesPath(primary)} className="radar__primary" />

            {categories.map((c, i) => {
              const [x, y] = pointAt(i, primary.scores[dimKeyOf(c)] ?? c.score);
              const active = hoverIndex === i || selectedKey === dimKeyOf(c);
              return <circle key={dimKeyOf(c)} cx={x} cy={y} r={active ? 5.5 : 4} className="radar__dot" />;
            })}

            {categories.map((c, i) => {
              const a = angleAt(i);
              const lx = cx + (R + 22) * Math.cos(a);
              const ly = cy + (R + 22) * Math.sin(a);
              const cos = Math.cos(a);
              const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end';
              const sin = Math.sin(a);
              const dy = sin < -0.5 ? -8 : sin > 0.5 ? 12 : 2;
              const active = hoverIndex === i || selectedKey === dimKeyOf(c);
              return (
                <text
                  key={dimKeyOf(c)}
                  x={lx}
                  y={ly + dy}
                  textAnchor={anchor}
                  className={active ? 'radar__label is-active' : 'radar__label'}
                >
                  <tspan x={lx} className="radar__label-name">
                    {c.category}
                  </tspan>
                  <tspan x={lx} dy="15" className="radar__label-value">
                    {faDigits(c.score)}٪
                  </tspan>
                </text>
              );
            })}

            {/* Hit areas are whole wedges, far larger than the marks. */}
            {categories.map((c, i) => (
              <path
                key={dimKeyOf(c)}
                d={wedgePath(i)}
                className="radar__hit"
                onMouseEnter={() => setHoverIndex(i)}
                onFocus={() => setHoverIndex(i)}
                onBlur={() => setHoverIndex(null)}
                onClick={() => select(dimKeyOf(c))}
                tabIndex={0}
                role="button"
                aria-label={`${c.category}: ${faDigits(c.score)} درصد`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(dimKeyOf(c));
                  }
                }}
              />
            ))}
          </svg>

          {hovered && (
            <div className="radar__tooltip" role="status">
              <strong>{hovered.category}</strong>
              {series
                .filter((s) => s.visible)
                .map((s) => (
                  <span key={s.id} className="radar__tooltip-row">
                    <span>{s.label}</span>
                    <b>{faDigits(Math.round(s.scores[dimKeyOf(hovered)] ?? hovered.score))}٪</b>
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* --- Ranked list: the precise view, and the chart's table ---------- */}
        <div className="radar__ranking">
          <div className="radar__ranking-head">
            <span>بُعد، از ضعیف‌ترین</span>
            <span>امتیاز</span>
          </div>
          <ol className="radar__rows">
            {ranked.map((c) => {
              const key = dimKeyOf(c);
              const prev = previous?.visible ? previous.scores[key] : undefined;
              const delta = prev !== undefined ? Math.round(c.score - prev) : null;
              const needsAttention = c.score < ATTENTION_THRESHOLD;
              return (
                <li key={key}>
                  <button
                    type="button"
                    className={`radar__row${selectedKey === key ? ' is-selected' : ''}`}
                    onClick={() => select(key)}
                    onMouseEnter={() => setHoverIndex(categories.indexOf(c))}
                    onMouseLeave={() => setHoverIndex(null)}
                    aria-expanded={selectedKey === key}
                  >
                    <span className="radar__row-name">
                      {c.category}
                      {needsAttention && (
                        <span className="radar__attention">
                          <AlertTriangle size={11} aria-hidden="true" />
                          نیازمند توجه
                        </span>
                      )}
                    </span>
                    <span className="radar__row-score">{faDigits(c.score)}</span>
                    <span className="radar__row-bar" aria-hidden="true">
                      <span className="radar__row-fill" style={{ inlineSize: `${c.score}%` }} />
                      {prev !== undefined && (
                        <span className="radar__row-ref" style={{ insetInlineStart: `${prev}%` }} />
                      )}
                    </span>
                    <span className="radar__row-meta">
                      {faDigits(c.totalQuestions)} شاخص ·{' '}
                      {c.frictionCount > 0 ? `${faDigits(c.frictionCount)} اصطکاک` : 'بدون اصطکاک'}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? 'radar__delta is-up' : 'radar__delta is-down'}>
                          {delta > 0 ? <ArrowUp size={11} aria-hidden="true" /> : <ArrowDown size={11} aria-hidden="true" />}
                          {faDigits(Math.abs(delta))} نسبت به بازدید پیشین
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {previous?.visible && (
            <p className="radar__ranking-note">
              <span className="radar__row-ref radar__row-ref--legend" aria-hidden="true" /> خط عمودی: امتیاز بازدید پیشین
            </p>
          )}
        </div>
      </div>

      {/* --- Drill-down --------------------------------------------------- */}
      {selectedCategory && (
        <div className="radar__detail" aria-live="polite">
          <div className="radar__detail-head">
            <div>
              <h4>{selectedCategory.category}</h4>
              <span>
                امتیاز {faDigits(selectedCategory.score)} از {faDigits(100)}
              </span>
            </div>
            <button type="button" className="radar__close" onClick={() => setSelectedKey(null)} aria-label="بستن جزئیات">
              <X size={16} />
            </button>
          </div>

          <dl className="radar__detail-stats">
            <div>
              <dt>کل شاخص‌ها</dt>
              <dd>{faDigits(selectedCategory.totalQuestions)}</dd>
            </div>
            <div>
              <dt>اصطکاک</dt>
              <dd>{faDigits(selectedCategory.frictionCount)}</dd>
            </div>
            <div>
              <dt>بحرانی</dt>
              <dd>{faDigits(selectedCategory.criticalCount || 0)}</dd>
            </div>
          </dl>

          {selectedDetail?.underlyingIndicators && selectedDetail.underlyingIndicators.length > 0 ? (
            <ul className="radar__indicators">
              {selectedDetail.underlyingIndicators.map((ind, i) => (
                <li key={`${ind.code}-${i}`}>
                  <code className="ltr-code">{ind.code}</code>
                  <span className="radar__indicator-subject">{ind.subject}</span>
                  {ind.answerState === 'FRICTION' ? (
                    <span className={`sev-chip sev-${(ind.severity || 'MEDIUM').toLowerCase()}`}>
                      اصطکاک {SEVERITY_LABEL[ind.severity || 'MEDIUM']}
                    </span>
                  ) : ind.answerState === 'NOT_APPLICABLE' ? (
                    <span className="sev-chip radar__chip-na">N/A</span>
                  ) : (
                    <span className="sev-chip sev-clean">منطبق</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="radar__empty">در این بُعد اصطکاکی ثبت نشده است.</p>
          )}
        </div>
      )}
    </section>
  );
};
