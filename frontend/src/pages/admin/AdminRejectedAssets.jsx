import React, { useState } from 'react';
import { useAssets } from '../../context/AssetContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { formatCurrency } from '../../constants/currencies';
import { getEffectiveAssetStatus } from '../../utils/statusHelper';
import {
  XCircle,
  Search,
  HelpCircle,
  FileText,
  AlertCircle,
  AlertTriangle,
  History,
  Eye
} from 'lucide-react';

export const AdminRejectedAssets = () => {
  const { assets } = useAssets();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAsset, setActiveAsset] = useState(null);

  // Filter rejected and more-info-requested records
  const rejectedAssets = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'REJECTED' || s === 'MORE_INFO_REQUESTED';
  });

  const filteredAssets = rejectedAssets.filter((asset) => {
    return (
      !searchTerm ||
      (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.id && asset.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-error)'
              }}
            >
              Compliance Exceptions
            </span>
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: '32px',
              fontWeight: 600,
              color: 'var(--color-charcoal)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Rejected & Returned Applications
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Audit history of rejected applications and dossiers returned to applicants for regulatory clarification or title remediation.
          </p>
        </div>
      </div>

      {/* Filter and Search */}
      <div
        style={{
          padding: '18px 24px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-secondary-text)'
            }}
          />
          <input
            type="text"
            placeholder="Search returned applications by title or ID..."
            style={{
              width: '100%',
              paddingLeft: '44px',
              paddingRight: '16px',
              height: '42px',
              fontSize: '13px',
              borderRadius: '9999px',
              backgroundColor: '#F8FAFC',
              border: '1px solid rgba(0,0,0,0.04)',
              outline: 'none',
              color: 'var(--color-charcoal)'
            }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', fontWeight: 500 }}>
          Showing <strong style={{ color: 'var(--color-charcoal)' }}>{filteredAssets.length}</strong> non-approved records
        </div>
      </div>

      {/* Table */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={XCircle}
          title="No Rejected Submissions"
          description="There are currently no rejected or returned applications in the database. All evaluated assets have satisfied compliance requirements."
        />
      ) : (
        <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Asset Title & Identifier</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Category</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Valuation</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Current Status</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Audit Feedback / Rejection Finding</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Review Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isRejected = asset.status === 'REJECTED';

                  return (
                    <tr key={asset.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {asset.id}
                        </div>
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                        {asset.category}
                      </td>

                      <td style={{ padding: '18px 20px', fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </td>

                      <td style={{ padding: '18px 20px' }}>
                        <Badge status={asset.status} size="small" />
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-secondary-text)', maxWidth: '280px' }}>
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {asset.rejectionReason || asset.reviewNotes || 'Non-compliance with required appraisal documents.'}
                        </div>
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-secondary-text)' }}>
                        {new Date(asset.updatedAt || asset.createdAt || Date.now()).toLocaleDateString()}
                      </td>

                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn-action-view"
                          style={{ padding: '6px 16px', fontSize: '12px' }}
                          onClick={() => setActiveAsset(asset)}
                          aria-label={`View findings for ${asset.name}`}
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejection / Feedback Detail Modal */}
      <Modal
        isOpen={!!activeAsset}
        onClose={() => setActiveAsset(null)}
        title="Compliance Finding & Audit Record"
      >
        {activeAsset && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                {activeAsset.name}
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '4px' }}>
                Identifier: {activeAsset.id}
              </p>
            </div>

            <div
              style={{
                padding: '18px 22px',
                backgroundColor: activeAsset.status === 'REJECTED' ? '#FEE2E2' : 'var(--color-peach)',
                borderRadius: '20px',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <AlertTriangle
                  size={18}
                  style={{ color: activeAsset.status === 'REJECTED' ? '#DC2626' : '#B9653A' }}
                />
                <strong style={{ fontSize: '13.5px', color: activeAsset.status === 'REJECTED' ? '#DC2626' : '#B9653A' }}>
                  {activeAsset.status === 'REJECTED' ? 'Formal Rejection Rationale' : 'Clarification Request Notes'}
                </strong>
              </div>
              <div style={{ fontSize: '13.5px', color: 'var(--color-charcoal)', lineHeight: 1.6 }}>
                {activeAsset.rejectionReason || activeAsset.reviewNotes || 'Non-compliance with required title custody agreements.'}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', marginBottom: '24px', backgroundColor: '#F8FAFC', padding: '18px 22px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Valuation at Review:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{formatCurrency(activeAsset.valuation, activeAsset.currency)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Category:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{activeAsset.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Last Audit Evaluation:</span>
                <span style={{ color: 'var(--color-charcoal)' }}>{new Date(activeAsset.updatedAt || activeAsset.createdAt || Date.now()).toLocaleString()}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setActiveAsset(null)}
                className="btn-action-primary"
                style={{ padding: '9px 24px', fontSize: '13px' }}
              >
                Close Finding
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminRejectedAssets;
