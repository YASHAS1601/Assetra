import React from 'react';

export const Badge = ({ status = 'Registered', children, size = 'normal', variant }) => {
  const getVariantClass = (st) => {
    if (variant) return `badge-${variant}`;
    const s = String(st).toLowerCase();
    if (s === 'approved' || s === 'tokenized' || s === 'fractionalized' || s === 'confirmed' || s === 'verified') {
      return 'badge-green';
    }
    if (s === 'rejected' || s === 'failed' || s === 'error') {
      return 'badge-red';
    }
    if (s === 'more_info_requested' || s === 'draft' || s === 'warning' || s === 'unverified') {
      return 'badge-amber';
    }
    if (s === 'pending_review' || s === 'pending' || s === 'under_review' || s === 'registered') {
      return 'badge-graphite';
    }
    if (s === 'copper' || s === 'featured' || s === 'institutional') {
      return 'badge-copper';
    }
    return 'badge-gray';
  };

  const formatStatusLabel = (st) => {
    if (!st) return 'Pending';
    const s = String(st).toUpperCase();
    if (s === 'PENDING_REVIEW') return 'Pending Review';
    if (s === 'UNDER_REVIEW') return 'Under Review';
    if (s === 'MORE_INFO_REQUESTED') return 'Action Required';
    if (s === 'APPROVED') return 'Approved';
    if (s === 'REJECTED') return 'Rejected';
    if (s === 'TOKENIZED') return 'Tokenized';
    if (s === 'NOT_TOKENIZED') return 'Not Tokenized';
    return String(st);
  };

  const isSmall = size === 'small';

  return (
    <span
      className={`badge ${getVariantClass(status)}`}
      style={{
        padding: isSmall ? '3px 10px' : '5px 14px',
        fontSize: isSmall ? '11px' : '12px',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        width: 'max-content',
        maxWidth: 'none',
        lineHeight: 1.2,
        boxSizing: 'border-box'
      }}
    >
      <span
        style={{
          width: '5.5px',
          height: '5.5px',
          borderRadius: '50%',
          backgroundColor: 'currentColor'
        }}
      />
      {children || formatStatusLabel(status)}
    </span>
  );
};

export default Badge;
