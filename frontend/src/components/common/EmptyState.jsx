import React from 'react';
import { Database } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Database,
  title = 'No records found',
  description = 'There are currently no items matching your criteria.',
  actionLabel,
  onAction
}) => {
  return (
    <div
      style={{
        padding: '64px 32px',
        textAlign: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-card)',
        border: '1px solid rgba(19, 36, 60, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: 'var(--color-pale-peach)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-copper)',
          marginBottom: '20px',
          boxShadow: '0 4px 14px rgba(185, 101, 58, 0.15)'
        }}
      >
        <Icon size={26} strokeWidth={1.8} />
      </div>

      <h4
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: '22px',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: '8px',
          letterSpacing: '-0.015em'
        }}
      >
        {title}
      </h4>

      <p
        style={{
          fontSize: '14px',
          color: 'var(--text-secondary)',
          maxWidth: '460px',
          lineHeight: 1.6,
          marginBottom: actionLabel ? '24px' : '0'
        }}
      >
        {description}
      </p>

      {actionLabel && onAction && (
        <button className="btn btn-primary btn-sm" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
