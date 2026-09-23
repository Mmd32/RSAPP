import React, { useState } from 'react';
import {
  CategoryScore,
  Indicator,
  QuestionResponse,
  RadarSeriesData,
  DimensionExplainabilityDetail,
} from '../types';
import { AlertCircle, AlertTriangle, CheckCircle, Info, ChevronLeft } from 'lucide-react';

interface RadarChartProps {
  categories: CategoryScore[];
  indicators: Indicator[];
  responses: Record<string, QuestionResponse>;
  radarSeries?: RadarSeriesData[];
  dimensionDetails?: DimensionExplainabilityDetail[];
  onSelectDimension?: (dimKey: string) => void;
}

export const RadarChart: React.FC<RadarChartProps> = ({
  categories,
  indicators,
  responses,
  radarSeries: initialRadarSeries,
  dimensionDetails,
  onSelectDimension,
}) => {
  const [selectedDimKey, setSelectedDimKey] = useState<string | null>(null);

  // Manage series visibility state
  const [seriesList, setSeriesList] = useState<RadarSeriesData[]>(() => {
    if (initialRadarSeries && initialRadarSeries.length > 0) {
      return initialRadarSeries;
    }
    // Default single series fallback
    const scores: Record<string, number> = {};
    categories.forEach((c) => {
      scores[c.dimensionKey || c.category] = c.score;
    });
    return [
      {
        id: 'current_visit',
        label: 'ارزیابی فعلی (Current Visit)',
        color: '#00B0F0',
        scores,
        visible: true,
      },
    ];
  });

  // Keep series in sync if initialRadarSeries changes
  React.useEffect(() => {
    if (initialRadarSeries && initialRadarSeries.length > 0) {
      setSeriesList(initialRadarSeries);
    }
  }, [initialRadarSeries]);

  const toggleSeriesVisibility = (seriesId: string) => {
    setSeriesList((prev) =>
      prev.map((s) => (s.id === seriesId ? { ...s, visible: !s.visible } : s))
    );
  };

  if (!categories || categories.length === 0) {
    return null;
  }

  const size = 440;
  const center = size / 2;
  const radius = size * 0.36;
  const numAxes = categories.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Concentric Grid Rings: 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Active detail for drill down
  const activeDetail = dimensionDetails?.find(
    (d) => d.dimensionKey === selectedDimKey || d.dimensionNameFa === selectedDimKey
  );

  const activeCategory = categories.find(
    (c) => c.dimensionKey === selectedDimKey || c.category === selectedDimKey
  );

  return (
    <div className="radar-container media-frame" style={{ padding: 24, margin: '16px 0' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--rs-color-brand-cyan)',
              background: 'rgba(0,176,240,0.15)',
              padding: '2px 8px',
              borderRadius: 'var(--rs-radius-control)',
            }}
          >
            FR™ RADAR ENGINE
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--theme-text-primary)', margin: 0 }}>
            تحلیل چندبعدی رادار تجربه مشتری (Reporting Dimensions)
          </h3>
        </div>

        {/* Series Visibility Toggles (Requirements 7, 8) */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {seriesList.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => toggleSeriesVisibility(s.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: '16px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: s.visible ? `${s.color}22` : 'var(--theme-card-bg)',
                border: `1px solid ${s.visible ? s.color : 'var(--theme-card-border)'}`,
                color: s.visible ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
              }}
            >
              <span
                style={{
                  width: 14,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: s.visible ? s.color : 'gray',
                  display: 'inline-block',
                }}
              />
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--theme-text-muted)', marginBottom: 16 }}>
        روی هر بعد یا نقطه رادار کلیک کنید تا نمره، اصطکاک‌ها، موارد بحرانی و تغییرات نسبت به دوره‌های قبل نمایان شوند.
      </p>

      {/* Main Content: SVG Chart + Drill Down Panel */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'center' }}>
        {/* SVG Radar */}
        <div style={{ position: 'relative', width: '100%', maxWidth: size, display: 'flex', justifyContent: 'center' }}>
          <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: `${size}px`, height: 'auto', display: 'block' }}>
            <defs>
              <radialGradient id="radarGlowPrimary" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00B0F0" stopOpacity="0.55" />
                <stop offset="60%" stopColor="#007DAA" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#007DAA" stopOpacity="0.05" />
              </radialGradient>
              <filter id="subtleGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Concentric Grid Rings */}
            {rings.map((ringScale, rIdx) => {
              const r = radius * ringScale;
              return (
                <g key={rIdx}>
                  <circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={ringScale === 1.0 ? 'rgba(0, 176, 240, 0.4)' : 'var(--theme-card-border)'}
                    strokeWidth={ringScale === 1.0 ? 1.5 : 1}
                    strokeDasharray={ringScale < 1 ? '3 3' : 'none'}
                  />
                  {/* Axis scale label (25, 50, 75, 100) */}
                  <text
                    x={center + 6}
                    y={center - r + 11}
                    fill="rgba(0, 176, 240, 0.6)"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {Math.round(ringScale * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Spokes (Axes) */}
            {categories.map((cat, idx) => {
              const angle = idx * angleStep - Math.PI / 2;
              const x = center + radius * Math.cos(angle);
              const y = center + radius * Math.sin(angle);
              const isSelected = selectedDimKey === (cat.dimensionKey || cat.category);

              return (
                <line
                  key={cat.category}
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke={isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}
                  strokeWidth={isSelected ? 2 : 1}
                  strokeDasharray={isSelected ? 'none' : '2 2'}
                />
              );
            })}

            {/* Render Multiple Series Polygons with Distinct Textures for Accessibility (Audit Priority 10 / C1) */}
            {seriesList
              .filter((s) => s.visible)
              .map((series, sIdx) => {
                const points = categories.map((cat, idx) => {
                  const angle = idx * angleStep - Math.PI / 2;
                  const score = series.scores[cat.dimensionKey || cat.category] ?? cat.score;
                  const r = Math.max(0, Math.min(100, score) / 100) * radius;
                  const x = center + r * Math.cos(angle);
                  const y = center + r * Math.sin(angle);
                  return { x, y, score };
                });

                const polygonPath =
                  points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';

                const isPrimary = series.id === 'current_visit';
                const strokeDash = isPrimary ? 'none' : sIdx === 1 ? '7 4' : '3 3';

                return (
                  <g key={series.id}>
                    <path
                      d={polygonPath}
                      fill={isPrimary ? 'url(#radarGlowPrimary)' : `${series.color}15`}
                      stroke={series.color}
                      strokeWidth={isPrimary ? 2.5 : 1.8}
                      strokeDasharray={strokeDash}
                      filter={isPrimary ? 'url(#subtleGlow)' : 'none'}
                    />
                    {/* Points on polygon vertices with distinct markers for color blindness */}
                    {points.map((p, pIdx) => {
                      const cat = categories[pIdx];
                      const dimId = cat.dimensionKey || cat.category;
                      const isDimSelected = selectedDimKey === dimId;

                      return (
                        <g
                          key={pIdx}
                          onClick={() => {
                            const newKey = isDimSelected ? null : dimId;
                            setSelectedDimKey(newKey);
                            if (onSelectDimension && newKey) onSelectDimension(newKey);
                          }}
                          style={{ cursor: 'pointer' }}
                        >
                          <title>{`${series.label}: ${cat.category} (${p.score}%)`}</title>
                          {isDimSelected && (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={12}
                              fill="none"
                              stroke={series.color}
                              strokeWidth={1.5}
                              opacity={0.6}
                            />
                          )}
                          {isPrimary ? (
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={isDimSelected ? 6.5 : 5}
                              fill={series.color}
                              stroke="var(--theme-bg-main)"
                              strokeWidth={2}
                            />
                          ) : sIdx === 1 ? (
                            <rect
                              x={p.x - (isDimSelected ? 5.5 : 4)}
                              y={p.y - (isDimSelected ? 5.5 : 4)}
                              width={isDimSelected ? 11 : 8}
                              height={isDimSelected ? 11 : 8}
                              transform={`rotate(45 ${p.x} ${p.y})`}
                              fill={series.color}
                              stroke="var(--theme-bg-main)"
                              strokeWidth={2}
                            />
                          ) : (
                            <rect
                              x={p.x - (isDimSelected ? 5.5 : 4)}
                              y={p.y - (isDimSelected ? 5.5 : 4)}
                              width={isDimSelected ? 11 : 8}
                              height={isDimSelected ? 11 : 8}
                              fill={series.color}
                              stroke="var(--theme-bg-main)"
                              strokeWidth={2}
                            />
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}

            {/* Axis Labels as Modern Dynamic Floating Chips (Audit Priority 10 / C2) */}
            {categories.map((cat, idx) => {
              const angle = idx * angleStep - Math.PI / 2;
              const labelRadius = radius + 36;
              const x = center + labelRadius * Math.cos(angle);
              const y = center + labelRadius * Math.sin(angle);
              const dimId = cat.dimensionKey || cat.category;
              const isSelected = selectedDimKey === dimId;

              const textLen = cat.category.length;
              const chipW = Math.max(96, textLen * 9.5 + 40);
              const chipH = 28;

              return (
                <g
                  key={cat.category}
                  onClick={() => {
                    const newKey = isSelected ? null : dimId;
                    setSelectedDimKey(newKey);
                    if (onSelectDimension && newKey) onSelectDimension(newKey);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    x={x - chipW / 2}
                    y={y - chipH / 2}
                    width={chipW}
                    height={chipH}
                    rx={14}
                    fill={isSelected ? 'rgba(0, 176, 240, 0.22)' : 'var(--theme-card-bg)'}
                    stroke={isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}
                    strokeWidth={isSelected ? 1.5 : 1}
                    style={{ transition: 'all 0.2s ease' }}
                  />
                  <text
                    x={x - 14}
                    y={y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-primary)'}
                    fontSize="11"
                    fontWeight={isSelected ? '800' : '600'}
                  >
                    {cat.category}
                  </text>
                  <text
                    x={x + chipW / 2 - 18}
                    y={y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={
                      cat.score >= 80
                        ? 'var(--rs-color-success)'
                        : cat.score >= 50
                        ? 'var(--rs-color-warning)'
                        : 'var(--rs-color-error)'
                    }
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="var(--rs-font-latin)"
                  >
                    {cat.score}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Drill-Down Panel (Requirement 9) */}
        <div
          style={{
            flex: '1 1 320px',
            maxWidth: 380,
            background: 'var(--theme-card-bg)',
            border: `1px solid ${selectedDimKey ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
            borderRadius: 'var(--rs-radius-card)',
            padding: 18,
            boxShadow: selectedDimKey ? '0 4px 20px rgba(0, 176, 240, 0.2)' : 'var(--rs-shadow-card)',
            transition: 'all 0.3s ease',
          }}
        >
          {activeCategory ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)', fontWeight: 700, textTransform: 'uppercase' }}>
                    {activeDetail?.dimensionKey || 'DIMENSION DRILL-DOWN'}
                  </span>
                  <h4 style={{ fontSize: 17, fontWeight: 800, color: 'var(--theme-text-primary)', margin: '2px 0 0' }}>
                    {activeCategory.category}
                  </h4>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 900,
                      color:
                        activeCategory.score >= 80
                          ? 'var(--rs-color-success)'
                          : activeCategory.score >= 50
                          ? 'var(--rs-color-warning)'
                          : 'var(--rs-color-error)',
                    }}
                  >
                    {activeCategory.score}%
                  </span>
                  {activeCategory.changeDelta !== undefined && (
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color:
                          activeCategory.changeDelta >= 0
                            ? 'var(--rs-color-success)'
                            : 'var(--rs-color-error)',
                        direction: 'ltr',
                      }}
                    >
                      {activeCategory.changeDelta >= 0 ? `+${activeCategory.changeDelta}%` : `${activeCategory.changeDelta}%`}
                    </div>
                  )}
                </div>
              </div>

              {/* Metric Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 6, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>شاخص‌ها</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-primary)' }}>{activeCategory.totalQuestions}</span>
                </div>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 6, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>اصطکاک</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: activeCategory.frictionCount > 0 ? 'var(--rs-color-error)' : 'var(--theme-text-primary)' }}>
                    {activeCategory.frictionCount}
                  </span>
                </div>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 6, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>بحرانی</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: (activeCategory.criticalCount || 0) > 0 ? 'var(--rs-color-error)' : 'var(--rs-color-success)' }}>
                    {activeCategory.criticalCount || 0}
                  </span>
                </div>
              </div>

              {/* Underlying Indicators List */}
              <div style={{ maxHeight: 210, overflowY: 'auto', paddingRight: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--rs-color-text-dark-200)', display: 'block', marginBottom: 6 }}>
                  شاخص‌های این بُعد:
                </span>
                {activeDetail?.underlyingIndicators && activeDetail.underlyingIndicators.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeDetail.underlyingIndicators.map((ind, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.06)',
                          borderRadius: 6,
                          padding: '6px 8px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span className="ltr-code" style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)' }}>
                            {ind.code}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--theme-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {ind.subject}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            background:
                              ind.answerState === 'FRICTION'
                                ? ind.severity === 'CRITICAL'
                                  ? 'rgba(217, 74, 86, 0.25)'
                                  : 'rgba(234, 88, 12, 0.25)'
                                : ind.answerState === 'NOT_APPLICABLE'
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(45, 157, 120, 0.2)',
                            color:
                              ind.answerState === 'FRICTION'
                                ? ind.severity === 'CRITICAL'
                                  ? 'var(--rs-color-error)'
                                  : '#EA580C'
                                : ind.answerState === 'NOT_APPLICABLE'
                                ? 'var(--rs-color-text-dark-300)'
                                : 'var(--rs-color-success)',
                          }}
                        >
                          {ind.answerState === 'FRICTION'
                            ? `اصطکاک ${ind.severity || ''}`
                            : ind.answerState === 'NOT_APPLICABLE'
                            ? 'N/A'
                            : 'منطبق'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--rs-color-text-dark-300)' }}>
                    شاخصی در این بازه ثبت نشده است.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDimKey(null)}
                style={{
                  marginTop: 12,
                  width: '100%',
                  padding: '6px 0',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 6,
                  color: 'var(--rs-color-text-dark-200)',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                بستن جزئیات بُعد
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: 'var(--rs-color-text-dark-300)' }}>
              <Info size={32} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <p style={{ fontSize: 13, margin: '0 0 6px', color: 'var(--theme-text-primary)', fontWeight: 600 }}>
                راهنمای تحلیل رادار
              </p>
              <p style={{ fontSize: 11, lineHeight: 1.6, margin: 0 }}>
                روی محورها یا دایره‌های نمودار رادار کلیک نمایید تا ریز محاسبات، نمره و لیست شاخص‌های اصطکاک آن بُعد نمایش داده شود.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
