import React from 'react';

/**
 * MetricCard
 * Premium fintech metric card featuring:
 * - Generously rounded corners (24px radius)
 * - Soft ambient shadow and minimal/no harsh rectangular borders
 * - Subtle hover elevation
 * - Distinct styling variants:
 *    - 'navy': Deep midnight navy gradient (#101B2D -> #182B47) with crisp white typography
 *    - 'mint': Pale mint soft surface (#DDF5EE) with emerald accent
 *    - 'peach': Pale peach soft surface (#FFF0E6) with amber/copper accent
 *    - 'lavender': Pale lavender soft surface (#F0EBFF) with indigo accent
 *    - 'white' (default): Pure white surface with subtle soft shadow
 */
export const MetricCard = ({
  title,
  value,
  subtext,
  indicator,
  icon: Icon,
  accent = false,
  variant = 'white',
  onClick
}) => {
  // Determine variant styling
  const isNavy = variant === 'navy';
  const isMint = variant === 'mint';
  const isPeach = variant === 'peach';
  const isLavender = variant === 'lavender';

  let cardBg = '#FFFFFF';
  let cardBorder = '1px solid rgba(19, 36, 60, 0.04)';
  let titleColor = 'var(--text-secondary)';
  let valueColor = 'var(--text-primary)';
  let subtextColor = 'var(--text-secondary)';
  let iconBg = 'var(--bg-secondary)';
  let iconColor = 'var(--text-primary)';
  let cardShadow = 'var(--shadow-card)';

  if (isNavy) {
    cardBg = 'linear-gradient(135deg, #101B2D 0%, #1A2F4C 100%)';
    cardBorder = '1px solid rgba(255, 255, 255, 0.08)';
    titleColor = '#94A3B8';
    valueColor = '#FFFFFF';
    subtextColor = '#CBD5E1';
    iconBg = 'rgba(214, 138, 96, 0.18)';
    iconColor = 'var(--color-copper-highlight)';
    cardShadow = '0 16px 36px -6px rgba(16, 27, 45, 0.22)';
  } else if (isMint) {
    cardBg = 'linear-gradient(135deg, #FFFFFF 0%, #E9F7F3 100%)';
    cardBorder = '1px solid rgba(16, 185, 129, 0.12)';
    iconBg = 'var(--color-pale-mint)';
    iconColor = '#059669';
  } else if (isPeach) {
    cardBg = 'linear-gradient(135deg, #FFFFFF 0%, #FFF3EC 100%)';
    cardBorder = '1px solid rgba(185, 101, 58, 0.12)';
    iconBg = 'var(--color-pale-peach)';
    iconColor = 'var(--color-copper)';
  } else if (isLavender) {
    cardBg = 'linear-gradient(135deg, #FFFFFF 0%, #F4F0FF 100%)';
    cardBorder = '1px solid rgba(99, 102, 241, 0.12)';
    iconBg = 'var(--color-pale-lavender)';
    iconColor = '#4F46E5';
  }

  if (accent && !isNavy) {
    valueColor = 'var(--color-copper)';
    iconColor = 'var(--color-copper)';
  }

  return (
    <div
      className="metric-card-surface"
      onClick={onClick}
      style={{
        padding: '26px 28px',
        background: cardBg,
        border: cardBorder,
        borderRadius: 'var(--radius-xl)',
        boxShadow: cardShadow,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '160px',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = isNavy
          ? '0 20px 42px -6px rgba(16, 27, 45, 0.28)'
          : 'var(--shadow-card-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = cardShadow;
      }}
    >
      {/* Top Header: Label & Soft Circular Icon */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 700,
            color: titleColor,
            textTransform: 'uppercase',
            letterSpacing: '0.06em'
          }}
        >
          {title}
        </span>
        {Icon && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: iconColor,
              flexShrink: 0
            }}
          >
            <Icon size={19} strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Main Metric Value */}
      <div
        style={{
          fontSize: '30px',
          fontWeight: 700,
          color: valueColor,
          letterSpacing: '-0.025em',
          marginBottom: '8px',
          fontFamily: 'var(--font-sans)',
          lineHeight: 1.15
        }}
      >
        {value}
      </div>

      {/* Bottom Subtext / Status Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', flexWrap: 'wrap' }}>
        {indicator && (
          <span
            style={{
              color: isNavy ? '#34D399' : (indicator.isPositive ? '#065F46' : '#991B1B'),
              backgroundColor: isNavy ? 'rgba(16, 185, 129, 0.18)' : (indicator.isPositive ? 'var(--color-pale-mint)' : 'var(--color-error-bg)'),
              padding: '3px 9px',
              borderRadius: 'var(--radius-pill)',
              fontWeight: 600,
              fontSize: '11px',
              letterSpacing: '0.02em',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: 'currentColor'
              }}
            />
            {indicator.text}
          </span>
        )}
        {subtext && (
          <span style={{ color: subtextColor, fontSize: '12px', fontWeight: 400 }}>
            {subtext}
          </span>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
