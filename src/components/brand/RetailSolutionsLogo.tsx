import React from 'react';

interface RetailSolutionsLogoProps {
  variant?: 'light' | 'dark' | 'symbol' | 'symbol-dark' | 'compact' | 'badge';
  colorScheme?: 'light' | 'dark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'custom';
  height?: number;
  width?: number;
  className?: string;
  showSubbrand?: boolean;
  subbrandText?: string;
}

/**
 * Official Retail Solutions Brand Logo & Symbol
 * Enhanced with Apple Studio & Linear aesthetics:
 * - Precision vector geometry with gradient accents
 * - Responsive sizing and high-contrast typography
 * - Dedicated compact mode for mobile navbar and collapsed sidebar
 */
export const RetailSolutionsLogo: React.FC<RetailSolutionsLogoProps> = ({
  variant = 'dark',
  colorScheme,
  size = 'md',
  height,
  width,
  className = '',
  showSubbrand = false,
  subbrandText = 'ارزیابی تجربه مشتری',
}) => {
  const isDark = colorScheme
    ? colorScheme === 'dark'
    : variant === 'dark' || variant === 'symbol-dark';

  const defaultHeight =
    size === 'xs'
      ? 26
      : size === 'sm'
      ? 32
      : size === 'md'
      ? 42
      : size === 'lg'
      ? 54
      : height || 42;

  const strokeColor = isDark ? '#FFFFFF' : '#16213E';
  const retailTextColor = isDark ? '#E2E8F0' : '#16213E';
  const solutionsTextColor = '#00B0F0';
  const subtextColor = isDark ? '#94A3B8' : '#64748B';

  // 1. Compact / Badge Mark (Ideal for Mobile Top Bar & Mini Sidebar)
  if (variant === 'compact' || variant === 'badge') {
    return (
      <div
        className={`rs-brand-badge-mark ${className}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          direction: 'ltr',
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: defaultHeight,
            height: defaultHeight,
            borderRadius: defaultHeight >= 40 ? 12 : 9,
            background: 'linear-gradient(135deg, #00B0F0 0%, #007DAA 100%)',
            boxShadow: '0 4px 14px rgba(0, 176, 240, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontWeight: 900,
            fontSize: defaultHeight >= 40 ? 15 : 12,
            fontFamily: 'var(--rs-font-latin), sans-serif',
            letterSpacing: '-0.03em',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Subtle glossy sheen */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '45%',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.22), transparent)',
              pointerEvents: 'none',
            }}
          />
          <span>RS</span>
        </div>

        {showSubbrand && (
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', direction: 'rtl' }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: isDark ? '#F8FAFC' : '#0F172A',
                letterSpacing: '-0.01em',
                lineHeight: 1.2,
              }}
            >
              Retail Solutions
            </span>
            <span style={{ fontSize: 10, color: '#00B0F0', fontWeight: 700, marginTop: 1 }}>
              {subbrandText}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 2. Symbol Only (Geometric Bracket)
  if (variant === 'symbol' || variant === 'symbol-dark') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} className={className}>
        <svg
          viewBox="90 160 560 700"
          style={{ height: defaultHeight, width: 'auto', display: 'block', direction: 'ltr' }}
          role="img"
          aria-label="Retail Solutions Symbol"
        >
          <defs>
            <linearGradient id="rs-brand-bracket-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00B0F0" />
              <stop offset="100%" stopColor="#007DAA" />
            </linearGradient>
          </defs>
          <g fill="none" stroke="url(#rs-brand-bracket-grad)" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round">
            <path d="M635 190 H130 C120 190 115 195 115 205 V815 C115 825 120 830 130 830 H635" />
            <path d="M635 190 V320" />
            <path d="M635 830 V700" />
          </g>
        </svg>
        {showSubbrand && (
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', direction: 'rtl' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#fff' : '#16213E' }}>
              ارزیابی میدانی
            </span>
            <span style={{ fontSize: 10, color: subtextColor }}>
              {subbrandText}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 3. Full Brand Logo with Precision Typography
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} className={className}>
      <svg
        viewBox="90 160 855 700"
        style={{ height: defaultHeight, width: 'auto', display: 'block', direction: 'ltr' }}
        role="img"
        aria-label="Retail Solutions"
      >
        <defs>
          <linearGradient id="rs-logo-grad-sym" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00B0F0" />
            <stop offset="100%" stopColor="#007DAA" />
          </linearGradient>
        </defs>
        <g fill="none" stroke="url(#rs-logo-grad-sym)" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
          <path d="M635 190 H130 C120 190 115 195 115 205 V815 C115 825 120 830 130 830 H635" />
          <path d="M635 190 V320" />
          <path d="M635 830 V700" />
        </g>
        <text
          x="315"
          y="497"
          fill={retailTextColor}
          fontSize="132"
          fontWeight="700"
          textLength="595"
          lengthAdjust="spacing"
          style={{
            fontFamily: 'var(--rs-font-latin), "Plus Jakarta Sans", sans-serif',
            letterSpacing: '0.04em',
          }}
        >
          RETAIL
        </text>
        <text
          x="318"
          y="632"
          fill={solutionsTextColor}
          fontSize="136"
          fontWeight="400"
          textLength="592"
          lengthAdjust="spacing"
          style={{
            fontFamily: 'var(--rs-font-latin), "Plus Jakarta Sans", sans-serif',
            letterSpacing: '0.02em',
          }}
        >
          Solutions
        </text>
      </svg>

      {showSubbrand && (
        <div
          style={{
            borderRight: `1.5px solid ${isDark ? 'rgba(255,255,255,0.15)' : 'var(--theme-card-border)'}`,
            paddingRight: 10,
            marginRight: 4,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: 'right',
            direction: 'rtl',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isDark ? '#fff' : '#16213E' }}>
              ارزیابی میدانی
            </span>
          </div>
          <span style={{ fontSize: 10, color: subtextColor, marginTop: 2 }}>
            {subbrandText}
          </span>
        </div>
      )}
    </div>
  );
};
