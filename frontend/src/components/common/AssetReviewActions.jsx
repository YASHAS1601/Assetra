import React from 'react';
import { getEffectiveAssetStatus } from '../../utils/statusHelper';
import {
  Play,
  FileSearch,
  CheckCircle2,
  XCircle,
  Eye,
  Cpu,
  HelpCircle
} from 'lucide-react';

/**
 * High-contrast, status-driven action buttons for admin asset review queues.
 * Guarantees that actions strictly reflect the asset's real database lifecycle status.
 */
export const AssetReviewActions = ({
  asset,
  onStartReview,
  onInspect,
  isProcessing = false
}) => {
  if (!asset) return null;

  const status = getEffectiveAssetStatus(asset);

  switch (status) {
    case 'APPROVED':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-mint, #DDF5EE)',
              color: '#065F46',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              letterSpacing: '0.01em'
            }}
          >
            <CheckCircle2 size={13} />
            <span>Approved</span>
          </span>
          <button
            type="button"
            className="btn-action-view"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Inspect approved asset dossier"
            aria-label={`View details for ${asset.name}`}
          >
            <Eye size={13} strokeWidth={2} />
            <span>View Details</span>
          </button>
        </div>
      );

    case 'TOKENIZED':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: '#E8F1FC',
              color: '#1E40AF',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(59, 130, 246, 0.25)',
              letterSpacing: '0.01em'
            }}
          >
            <Cpu size={13} />
            <span>Tokenized</span>
          </span>
          <button
            type="button"
            className="btn-action-view"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Inspect tokenized asset record"
            aria-label={`View details for tokenized asset ${asset.name}`}
          >
            <Eye size={13} strokeWidth={2} />
            <span>View Details</span>
          </button>
        </div>
      );

    case 'REJECTED':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: '#FEE2E2',
              color: '#991B1B',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              letterSpacing: '0.01em'
            }}
          >
            <XCircle size={13} />
            <span>Rejected</span>
          </span>
          <button
            type="button"
            className="btn-action-view"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Inspect rejection findings and feedback"
            aria-label={`View rejection findings for ${asset.name}`}
          >
            <Eye size={13} strokeWidth={2} />
            <span>View Details</span>
          </button>
        </div>
      );

    case 'UNDER_REVIEW':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn-action-primary"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Continue active compliance evaluation"
            aria-label={`Continue review for ${asset.name}`}
          >
            <FileSearch size={13} strokeWidth={2.2} />
            <span>Continue Review</span>
          </button>
        </div>
      );

    case 'MORE_INFO_REQUESTED':
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span
            style={{
              fontSize: '11.5px',
              fontWeight: 600,
              padding: '5px 12px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-peach, #FFF0E6)',
              color: '#9A4F2A',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              border: '1px solid rgba(185, 101, 58, 0.25)',
              letterSpacing: '0.01em'
            }}
          >
            <HelpCircle size={13} />
            <span>Info Requested</span>
          </span>
          <button
            type="button"
            className="btn-action-primary"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Inspect submitted dossier"
            aria-label={`Inspect application for ${asset.name}`}
          >
            <FileSearch size={13} strokeWidth={2.2} />
            <span>Inspect & Decide</span>
          </button>
        </div>
      );

    case 'PENDING_REVIEW':
    default:
      return (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {onStartReview && (
            <button
              type="button"
              className="btn-action-secondary"
              disabled={isProcessing}
              onClick={() => onStartReview(asset)}
              title="Mark asset as Under Review"
              aria-label={`Start review for ${asset.name}`}
            >
              <Play size={12} strokeWidth={2.4} />
              <span>Start Review</span>
            </button>
          )}

          <button
            type="button"
            className="btn-action-primary"
            disabled={isProcessing}
            onClick={() => onInspect?.(asset)}
            title="Open compliance dossier for review and decision"
            aria-label={`Inspect and decide for ${asset.name}`}
          >
            <FileSearch size={13} strokeWidth={2.2} />
            <span>Inspect & Decide</span>
          </button>
        </div>
      );
  }
};

export default AssetReviewActions;
