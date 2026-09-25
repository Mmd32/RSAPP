import React, { useState } from 'react';
import {
  CategoryScore,
  Indicator,
  QuestionResponse,
  RadarSeriesData,
  DimensionExplainabilityDetail,
} from '../types';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  ChevronLeft,
  MapPin,
  Compass,
  Store,
  ShoppingBag,
  Users,
  Headphones,
  CreditCard,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

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
    const scores: Record<string, number> = {};
    categories.forEach((c) => {
      scores[c.dimensionKey || c.category] = c.score;
    });
    return [
      {
        id: 'current_visit',
        label: 'ارزیابی فعلی',
        color: '#00B0F0',
        scores,
        visible: true,
      },
    ];
  });

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

  // Generous SVG Canvas Dimensions to completely eliminate clipping & overlap
  const svgSize = 560;
  const center = svgSize / 2; // 280
  const radius = 160;
  const numAxes = categories.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Concentric Rings: 25%, 50%, 75%, 100%
  const rings = [0.25, 0.5, 0.75, 1.0];

  const activeDetail = dimensionDetails?.find(
    (d) => d.dimensionKey === selectedDimKey || d.dimensionNameFa === selectedDimKey
  );

  const activeCategory = categories.find(
    (c) => c.dimensionKey === selectedDimKey || c.category === selectedDimKey
  );

  // Dimension Icon Mapping
  const getDimensionIcon = (dimKey?: string) => {
    switch (dimKey) {
      case 'ACCESS':
        return <MapPin size={16} />;
      case 'NAVIGATION':
        return <Compass size={16} />;
      case 'ENVIRONMENT':
        return <Store size={16} />;
      case 'PRODUCT':
        return <ShoppingBag size={16} />;
      case 'PEOPLE':
        return <Users size={16} />;
      case 'SERVICE':
        return <Headphones size={16} />;
      case 'CHECKOUT':
        return <CreditCard size={16} />;
      case 'AFTER_SALES':
        return <RefreshCw size={16} />;
      default:
        return <Sparkles size={16} />;
    }
  };

  return (
    <div className="radar-container media-frame" style={{ padding: 24, margin: '16px 0' }}>
      {/* 1. Header & Series Toggles */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              color: 'var(--rs-color-brand-cyan)',
              background: 'rgba(0,176,240,0.12)',
              padding: '2px 8px',
              borderRadius: 'var(--rs-radius-control)',
              letterSpacing: '0.04em',
            }}
          >
            FR™ RADAR ENGINE
          </span>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)', margin: 0 }}>
            تحلیل چندبعدی رادار تجربه مشتری
          </h3>
        </div>

        {/* Series Toggles */}
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
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s',
                background: s.visible ? `${s.color}18` : 'var(--theme-card-bg)',
                border: `1.5px solid ${s.visible ? s.color : 'var(--theme-card-border)'}`,
                color: s.visible ? 'var(--theme-text-primary)' : 'var(--theme-text-muted)',
              }}
            >
              <span
                style={{
                  width: 12,
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

      <p style={{ fontSize: 12, color: 'var(--theme-text-muted)', marginBottom: 20 }}>
        برای مشاهده ریز محاسبات، وضعیت اصطکاک‌ها و موارد بحرانی هر بعد، روی محورهای رادار یا کارت‌های زیر کلیک کنید.
      </p>

      {/* 2. Visual Canvas & Drill-Down Layout */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start', justifyContent: 'center' }}>
        {/* SVG Spider Chart */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 540, display: 'flex', justifyContent: 'center' }}>
          <svg
            viewBox={`0 0 ${svgSize} ${svgSize}`}
            style={{
              width: '100%',
              maxWidth: `${svgSize}px`,
              height: 'auto',
              display: 'block',
              overflow: 'visible',
            }}
          >
            <defs>
              <radialGradient id="radarMeshGradient" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00B0F0" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#007DAA" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#007DAA" stopOpacity="0.04" />
              </radialGradient>
              <filter id="radarNeonGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Concentric Guide Circles & Percentage Rings */}
            {rings.map((ringScale, rIdx) => {
              const r = radius * ringScale;
              return (
                <g key={rIdx}>
                  <circle
                    cx={center}
                    cy={center}
                    r={r}
                    fill="none"
                    stroke={ringScale === 1.0 ? 'rgba(0, 176, 240, 0.45)' : 'var(--theme-card-border)'}
                    strokeWidth={ringScale === 1.0 ? 1.5 : 1}
                    strokeDasharray={ringScale < 1 ? '3 3' : 'none'}
                    opacity={ringScale === 1.0 ? 0.9 : 0.6}
                  />
                  {/* Subtle scale percentage along top axis */}
                  <text
                    x={center}
                    y={center - r - 3}
                    textAnchor="middle"
                    fill="var(--theme-text-muted)"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="var(--rs-font-latin), monospace"
                    opacity={0.8}
                  >
                    {Math.round(ringScale * 100)}%
                  </text>
                </g>
              );
            })}

            {/* Spokes (Radial Axes) */}
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
                  opacity={isSelected ? 1 : 0.65}
                />
              );
            })}

            {/* Render Multiple Series Polygons */}
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
                const strokeDash = isPrimary ? 'none' : sIdx === 1 ? '6 4' : '3 3';

                return (
                  <g key={series.id}>
                    <path
                      d={polygonPath}
                      fill={isPrimary ? 'url(#radarMeshGradient)' : `${series.color}15`}
                      stroke={series.color}
                      strokeWidth={isPrimary ? 2.5 : 1.8}
                      strokeDasharray={strokeDash}
                      filter={isPrimary ? 'url(#radarNeonGlow)' : 'none'}
                    />
                    {/* Vertices Markers */}
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
                              r={14}
                              fill="none"
                              stroke={series.color}
                              strokeWidth={1.5}
                              opacity={0.6}
                            />
                          )}
                          <circle
                            cx={p.x}
                            cy={p.y}
                            r={isDimSelected ? 6 : 4.5}
                            fill={series.color}
                            stroke="var(--theme-card-bg)"
                            strokeWidth={2}
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

            {/* Smart Non-Overlapping Radial Dimension Labels */}
            {categories.map((cat, idx) => {
              const angle = idx * angleStep - Math.PI / 2;
              const labelDist = radius + 32;
              const x = center + labelDist * Math.cos(angle);
              const y = center + labelDist * Math.sin(angle);
              const dimId = cat.dimensionKey || cat.category;
              const isSelected = selectedDimKey === dimId;

              const cos = Math.cos(angle);
              const sin = Math.sin(angle);

              // Smart textAnchor to avoid boundary collisions
              let textAnchor: 'start' | 'end' | 'middle' = 'middle';
              let xOffset = 0;
              let yOffset = 0;

              if (cos > 0.3) {
                textAnchor = 'start';
                xOffset = 10;
              } else if (cos < -0.3) {
                textAnchor = 'end';
                xOffset = -10;
              }

              if (sin > 0.6) {
                yOffset = 8;
              } else if (sin < -0.6) {
                yOffset = -8;
              }

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
                  {/* Dimension Name */}
                  <text
                    x={x + xOffset}
                    y={y + yOffset}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fill={isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-primary)'}
                    fontSize="11.5"
                    fontWeight={isSelected ? '800' : '700'}
                    fontFamily="var(--rs-font-fa)"
                  >
                    {cat.category}
                  </text>

                  {/* Score Pill right next to or below label */}
                  <text
                    x={x + xOffset}
                    y={y + yOffset + 14}
                    textAnchor={textAnchor}
                    dominantBaseline="central"
                    fill={
                      cat.score >= 80
                        ? 'var(--rs-color-success)'
                        : cat.score >= 60
                        ? 'var(--rs-color-warning)'
                        : 'var(--rs-color-error)'
                    }
                    fontSize="11"
                    fontWeight="800"
                    fontFamily="var(--rs-font-latin), monospace"
                  >
                    {cat.score}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Drill-Down Inspector Panel */}
        <div
          style={{
            flex: '1 1 300px',
            maxWidth: 380,
            background: 'var(--theme-card-bg)',
            border: `1.5px solid ${selectedDimKey ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
            borderRadius: '16px',
            padding: 20,
            boxShadow: selectedDimKey ? '0 8px 28px rgba(0, 176, 240, 0.18)' : 'var(--rs-shadow-card)',
            transition: 'all 0.25s ease',
          }}
        >
          {activeCategory ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)', fontWeight: 800, textTransform: 'uppercase' }}>
                    {activeDetail?.dimensionKey || 'DIMENSION DETAILS'}
                  </span>
                  <h4 style={{ fontSize: 16, fontWeight: 800, color: 'var(--theme-text-primary)', margin: '2px 0 0' }}>
                    {activeCategory.category}
                  </h4>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 900,
                      fontFamily: 'var(--rs-font-latin), monospace',
                      color:
                        activeCategory.score >= 80
                          ? 'var(--rs-color-success)'
                          : activeCategory.score >= 60
                          ? 'var(--rs-color-warning)'
                          : 'var(--rs-color-error)',
                    }}
                  >
                    {activeCategory.score}%
                  </span>
                </div>
              </div>

              {/* Metric Highlights */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>کل شاخص‌ها</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-text-primary)' }}>{activeCategory.totalQuestions}</span>
                </div>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>اصطکاک</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: activeCategory.frictionCount > 0 ? 'var(--rs-color-error)' : 'var(--theme-text-primary)' }}>
                    {activeCategory.frictionCount}
                  </span>
                </div>
                <div style={{ background: 'var(--theme-card-inner)', padding: '8px 10px', borderRadius: 8, textAlign: 'center' }}>
                  <span style={{ fontSize: 10, color: 'var(--theme-text-muted)', display: 'block' }}>بحرانی</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: (activeCategory.criticalCount || 0) > 0 ? 'var(--rs-color-error)' : 'var(--rs-color-success)' }}>
                    {activeCategory.criticalCount || 0}
                  </span>
                </div>
              </div>

              {/* Underlying Indicators List */}
              <div style={{ maxHeight: 220, overflowY: 'auto', paddingLeft: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--theme-text-muted)', display: 'block', marginBottom: 6 }}>
                  شاخص‌های ثبت‌شده در این بُعد:
                </span>
                {activeDetail?.underlyingIndicators && activeDetail.underlyingIndicators.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {activeDetail.underlyingIndicators.map((ind, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--theme-card-inner)',
                          border: '1px solid var(--theme-card-border)',
                          borderRadius: 8,
                          padding: '7px 10px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                          <span className="ltr-code" style={{ fontSize: 10, color: 'var(--rs-color-brand-cyan)', fontWeight: 700 }}>
                            {ind.code}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--theme-text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                            {ind.subject}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 7px',
                            borderRadius: 6,
                            fontWeight: 700,
                            whiteSpace: 'nowrap',
                            background:
                              ind.answerState === 'FRICTION'
                                ? ind.severity === 'CRITICAL'
                                  ? 'rgba(217, 74, 86, 0.2)'
                                  : 'rgba(234, 88, 12, 0.2)'
                                : ind.answerState === 'NOT_APPLICABLE'
                                ? 'var(--theme-badge-bg)'
                                : 'rgba(45, 157, 120, 0.18)',
                            color:
                              ind.answerState === 'FRICTION'
                                ? ind.severity === 'CRITICAL'
                                  ? 'var(--rs-color-error)'
                                  : '#EA580C'
                                : ind.answerState === 'NOT_APPLICABLE'
                                ? 'var(--theme-text-muted)'
                                : 'var(--rs-color-success)',
                          }}
                        >
                          {ind.answerState === 'FRICTION'
                            ? `اصطکاک ${ind.severity === 'CRITICAL' ? 'بحرانی' : ind.severity === 'HIGH' ? 'زیاد' : 'متوسط'}`
                            : ind.answerState === 'NOT_APPLICABLE'
                            ? 'N/A'
                            : 'منطبق'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--theme-text-muted)' }}>
                    نقص یا اصطکاکی در این بعد یافت نشد.
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSelectedDimKey(null)}
                className="btn-secondary"
                style={{
                  marginTop: 14,
                  width: '100%',
                  fontSize: 12,
                  minHeight: 34,
                }}
              >
                بستن جزئیات بُعد
              </button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '36px 12px', color: 'var(--theme-text-muted)' }}>
              <Info size={30} color="var(--rs-color-brand-cyan)" style={{ margin: '0 auto 10px', opacity: 0.7 }} />
              <strong style={{ fontSize: 13, display: 'block', color: 'var(--theme-text-primary)', marginBottom: 4 }}>
                راهنمای هوش تجاری رادار
              </strong>
              <p style={{ fontSize: 11, lineHeight: 1.6, margin: 0 }}>
                روی هر یک از ۸ بعد رادار کلیک کنید تا نمره تفکیکی، مغایرت‌های مستند و شاخص‌های آن بعد را به تفکیک مشاهده نمایید.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Executive 8-Dimension Matrix Grid Below the Radar (Zero Collision) */}
      <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid var(--theme-card-border)' }}>
        <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--theme-text-primary)', marginBottom: 12 }}>
          جدول عملکرد ابعاد ۸گانه تجربه مشتری:
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          {categories.map((cat) => {
            const dimId = cat.dimensionKey || cat.category;
            const isSelected = selectedDimKey === dimId;
            const isGood = cat.score >= 80;
            const isWarning = cat.score >= 60 && cat.score < 80;

            return (
              <div
                key={dimId}
                onClick={() => {
                  const newKey = isSelected ? null : dimId;
                  setSelectedDimKey(newKey);
                  if (onSelectDimension && newKey) onSelectDimension(newKey);
                }}
                style={{
                  background: isSelected ? 'rgba(0, 176, 240, 0.08)' : 'var(--theme-card-bg)',
                  border: `1.5px solid ${isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-card-border)'}`,
                  borderRadius: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isSelected ? '0 4px 14px rgba(0, 176, 240, 0.15)' : 'none',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        color: isSelected ? 'var(--rs-color-brand-cyan)' : 'var(--theme-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {getDimensionIcon(cat.dimensionKey)}
                    </div>
                    <strong style={{ fontSize: 12.5, color: 'var(--theme-text-primary)' }}>
                      {cat.category}
                    </strong>
                  </div>

                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: 'var(--rs-font-latin), monospace',
                      color: isGood ? 'var(--rs-color-success)' : isWarning ? 'var(--rs-color-warning)' : 'var(--rs-color-error)',
                    }}
                  >
                    {cat.score}%
                  </span>
                </div>

                {/* Progress Mini Bar */}
                <div style={{ height: 4, background: 'var(--theme-card-inner)', borderRadius: 2, overflow: 'hidden', marginBottom: 6 }}>
                  <div
                    style={{
                      width: `${cat.score}%`,
                      height: '100%',
                      background: isGood ? 'var(--rs-color-success)' : isWarning ? 'var(--rs-color-warning)' : 'var(--rs-color-error)',
                      borderRadius: 2,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--theme-text-muted)' }}>
                  <span>{cat.totalQuestions} شاخص</span>
                  <span style={{ color: cat.frictionCount > 0 ? 'var(--rs-color-error)' : 'inherit', fontWeight: cat.frictionCount > 0 ? 700 : 400 }}>
                    {cat.frictionCount > 0 ? `${cat.frictionCount} اصطکاک` : 'بدون اصطکاک'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
