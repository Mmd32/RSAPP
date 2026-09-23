import React from 'react';

interface RetailSolutionsLogoProps {
  variant?: 'light' | 'dark' | 'symbol' | 'symbol-dark';
  colorScheme?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg' | 'custom';
  height?: number;
  width?: number;
  className?: string;
  showSubbrand?: boolean;
  subbrandText?: string;
}

/**
 * Official Retail Solutions Brand Logo & Symbol
 * Extracted directly from official source: https://retail-sloution.vercel.app/
 */
export const RetailSolutionsLogo: React.FC<RetailSolutionsLogoProps> = ({
  variant = 'dark',
  colorScheme,
  size = 'md',
  height,
  width,
  className = '',
  showSubbrand = false,
  subbrandText = 'FR™ Assessment Platform',
}) => {
  const isDark = colorScheme ? colorScheme === 'dark' : (variant === 'dark' || variant === 'symbol-dark');
  // Height mapping based on size
  const defaultHeight = size === 'sm' ? 32 : size === 'md' ? 44 : size === 'lg' ? 56 : height || 44;
  const strokeColor = isDark ? '#FFFFFF' : '#16213E';
  const retailTextColor = isDark ? '#BFC6D8' : '#5C6478';
  const solutionsTextColor = '#00B0F0';

  if (variant === 'symbol' || variant === 'symbol-dark') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} className={className}>
        <svg
          viewBox="90 160 560 700"
          style={{ height: defaultHeight, width: 'auto', display: 'block', direction: 'ltr' }}
          role="img"
          aria-label="Retail Solutions Symbol"
        >
          <g fill="none" stroke={strokeColor} strokeWidth="32" strokeLinecap="butt">
            <path d="M635 190 H115 V830 H635" />
            <path d="M635 190 V320" />
            <path d="M635 830 V700" />
          </g>
        </svg>
        {showSubbrand && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: isDark ? '#fff' : '#16213E', letterSpacing: -0.2 }}>
              FR™
            </span>
            <span style={{ fontSize: 10, color: isDark ? '#BFC6D8' : '#646E8C' }}>
              {subbrandText}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }} className={className}>
      <svg
        viewBox="90 160 855 700"
        style={{ height: defaultHeight, width: 'auto', display: 'block', direction: 'ltr' }}
        role="img"
        aria-label="Retail Solutions"
      >
        <g fill="none" stroke={strokeColor} strokeWidth="30" strokeLinecap="butt">
          <path d="M635 190 H115 V830 H635" />
          <path d="M635 190 V320" />
          <path d="M635 830 V700" />
        </g>
        <text
          x="315"
          y="497"
          fill={retailTextColor}
          fontSize="132"
          fontWeight="400"
          textLength="595"
          lengthAdjust="spacing"
          style={{ fontFamily: 'var(--rs-font-latin), "Inter", Arial, sans-serif' }}
        >
          RETAIL
        </text>
        <text
          x="318"
          y="632"
          fill={solutionsTextColor}
          fontSize="136"
          fontWeight="300"
          textLength="592"
          lengthAdjust="spacing"
          style={{ fontFamily: 'var(--rs-font-latin), "Inter", Arial, sans-serif' }}
        >
          Solutions
        </text>
      </svg>

      {showSubbrand && (
        <div
          style={{
            borderRight: `1.5px solid ${variant === 'dark' ? 'rgba(255,255,255,0.2)' : 'var(--rs-color-border-line)'}`,
            paddingRight: 10,
            marginRight: 4,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: '#00B0F0',
                background: 'rgba(0, 176, 240, 0.12)',
                padding: '1px 6px',
                borderRadius: 'var(--rs-radius-control)',
                letterSpacing: 0.5,
              }}
            >
              FR™
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: variant === 'dark' ? '#fff' : '#16213E' }}>
              ارزیابی میدانی
            </span>
          </div>
          <span style={{ fontSize: 10, color: variant === 'dark' ? '#BFC6D8' : '#646E8C', marginTop: 2 }}>
            {subbrandText}
          </span>
        </div>
      )}
    </div>
  );
};
