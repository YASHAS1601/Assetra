import React, { useState } from 'react';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { MetricCard } from '../components/common/MetricCard';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { AssetReviewActions } from '../components/common/AssetReviewActions';
import { getEffectiveAssetStatus, normalizeStatus } from '../utils/statusHelper';
import { formatCurrency } from '../constants/currencies';
import {
  Shield,
  FileSearch,
  CheckCircle2,
  XCircle,
  Clock,
  HelpCircle,
  FileText,
  Search,
  Play
} from 'lucide-react';

export const AdminDashboard = () => {
  const { assets, updateAssetStatus, error: assetsError } = useAssets();
  const { user, isAdmin } = useAuth();

  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeAsset, setActiveAsset] = useState(null);

  // Action modals
  const [rejectReasonModal, setRejectReasonModal] = useState(false);
  const [rejectionReasonText, setRejectionReasonText] = useState('');

  const [requestInfoModal, setRequestInfoModal] = useState(false);
  const [requestInfoText, setRequestInfoText] = useState('');

  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [actionErrorMsg, setActionErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate metrics using normalized effective statuses
  const pendingCount = assets.filter((a) => getEffectiveAssetStatus(a) === 'PENDING_REVIEW').length;
  const underReviewCount = assets.filter((a) => getEffectiveAssetStatus(a) === 'UNDER_REVIEW').length;
  const approvedCount = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'APPROVED' || s === 'TOKENIZED';
  }).length;
  const rejectedCount = assets.filter((a) => getEffectiveAssetStatus(a) === 'REJECTED').length;

  const filteredAssets = assets.filter((a) => {
    const effStatus = getEffectiveAssetStatus(a);
    const matchesStatus = selectedStatus === 'ALL' || effStatus === selectedStatus;
    const matchesSearch =
      !searchTerm ||
      (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.id && a.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.category && a.category.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const handleStartReview = async (asset) => {
    setIsProcessing(true);
    setActionErrorMsg('');
    try {
      await updateAssetStatus(asset.id, 'UNDER_REVIEW', { notes: 'Review process started.' });
      setActionSuccessMsg(`Application ${asset.id} marked UNDER_REVIEW.`);
      setTimeout(() => setActionSuccessMsg(''), 2500);
    } catch (err) {
      setActionErrorMsg(`Failed to start review: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApprove = async (asset) => {
    setIsProcessing(true);
    setActionErrorMsg('');
    try {
      await updateAssetStatus(asset.id, 'APPROVED', {
        verifierAddress: user?.walletAddress || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
        notes: 'Compliance and valuation documentation verified.'
      });
      setActionSuccessMsg(`Application ${asset.id} APPROVED! Status saved to Supabase.`);
      setActiveAsset(null);
      setTimeout(() => setActionSuccessMsg(''), 2500);
    } catch (err) {
      setActionErrorMsg(`Failed to approve asset: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReasonText.trim() || !activeAsset) return;

    setIsProcessing(true);
    setActionErrorMsg('');
    try {
      await updateAssetStatus(activeAsset.id, 'REJECTED', {
        reason: rejectionReasonText.trim(),
        notes: `Application REJECTED: ${rejectionReasonText.trim()}`
      });
      setRejectReasonModal(false);
      setActiveAsset(null);
      setRejectionReasonText('');
      setActionSuccessMsg(`Application REJECTED with recorded audit trail in Supabase.`);
      setTimeout(() => setActionSuccessMsg(''), 2500);
    } catch (err) {
      setActionErrorMsg(`Failed to reject application: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRequestInfo = async (e) => {
    e.preventDefault();
    if (!requestInfoText.trim() || !activeAsset) return;

    setIsProcessing(true);
    setActionErrorMsg('');
    try {
      await updateAssetStatus(activeAsset.id, 'MORE_INFO_REQUESTED', {
        notes: requestInfoText.trim()
      });
      setRequestInfoModal(false);
      setActiveAsset(null);
      setRequestInfoText('');
      setActionSuccessMsg(`Returned application to applicant with requested information notes.`);
      setTimeout(() => setActionSuccessMsg(''), 2500);
    } catch (err) {
      setActionErrorMsg(`Failed to request more info: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isAdmin) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <Shield size={48} style={{ color: 'var(--state-error)', marginBottom: '16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
          Access Denied — Admin Authorization Required
        </h3>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
          You must be logged in as an authenticated <strong>ADMIN</strong> verifier to access this portal.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span className="badge badge-green" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
              Admin Verification Portal
            </span>
          </div>
          <h2 className="page-title">Asset Verification & Audit Queue</h2>
          <p className="page-description">
            Review ownership evidence documents, verify valuations, and manage on-chain approval gating.
          </p>
        </div>
      </div>

      {actionSuccessMsg && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--state-success-bg)',
            border: '1px solid var(--state-success-border)',
            borderRadius: '8px',
            color: 'var(--state-success)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <CheckCircle2 size={18} />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {(actionErrorMsg || assetsError) && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--state-error-bg)',
            border: '1px solid var(--state-error-border)',
            borderRadius: '8px',
            color: 'var(--state-error)',
            fontSize: '13px',
            fontWeight: 600,
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <XCircle size={18} />
          <span>{actionErrorMsg || assetsError}</span>
        </div>
      )}

      {/* 4 Admin Summary Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        <MetricCard
          title="Pending Submissions"
          value={`${pendingCount} Files`}
          subtext="Awaiting initial audit"
          icon={Clock}
        />

        <MetricCard
          title="Under Active Review"
          value={`${underReviewCount} Files`}
          subtext="Auditor inspecting deed"
          icon={FileSearch}
        />

        <MetricCard
          title="Approved On-Chain"
          value={`${approvedCount} Assets`}
          indicator={{ text: 'Verified', isPositive: true }}
          subtext="Tokenization eligible"
          icon={CheckCircle2}
        />

        <MetricCard
          title="Rejected / Info Needed"
          value={`${rejectedCount} Assets`}
          subtext="Returned applications"
          icon={XCircle}
        />
      </div>

      {/* Filters and Queue Table */}
      <div
        className="fintech-card"
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 300px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)'
              }}
            />
            <input
              type="text"
              className="input-field"
              placeholder="Search queue by asset or ID..."
              style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 'auto', height: '36px', fontSize: '13px' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="MORE_INFO_REQUESTED">More Info Requested</option>
          </select>
        </div>

        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          Showing {filteredAssets.length} Submissions
        </div>
      </div>

      {/* Queue Table */}
      <div className="fintech-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="fintech-table">
            <thead>
              <tr>
                <th>Asset Title & ID</th>
                <th>Category</th>
                <th>Valuation</th>
                <th>Applicant Wallet</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssets.map((asset) => (
                <tr key={asset.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                      {asset.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {asset.id} • {asset.location}
                    </div>
                  </td>

                  <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {asset.category}
                  </td>

                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px' }}>
                    {formatCurrency(asset.valuation, asset.currency)}
                  </td>

                  <td style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {asset.ownerAddress ? `${asset.ownerAddress.slice(0, 6)}...${asset.ownerAddress.slice(-4)}` : 'Unassigned'}
                  </td>

                  <td>
                    <Badge status={getEffectiveAssetStatus(asset)} size="small" />
                  </td>

                  <td>
                    <AssetReviewActions
                      asset={asset}
                      onStartReview={handleStartReview}
                      onInspect={(item) => setActiveAsset(item)}
                      isProcessing={isProcessing}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset Review Modal */}
      <Modal
        isOpen={!!activeAsset}
        onClose={() => setActiveAsset(null)}
        title={`Audit Asset File — ${activeAsset?.name}`}
        maxWidth="680px"
      >
        {activeAsset && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Asset Identifier</div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: 'monospace' }}>{activeAsset.id}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Appraisal Value</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formatCurrency(activeAsset.valuation, activeAsset.currency)}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', marginBottom: '20px' }}>
              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Asset Category</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeAsset.category}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Physical Custody Location</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeAsset.location}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Custodial Appraiser</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{activeAsset.custodian}</div>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Applicant Wallet Address</div>
                <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '12px' }}>{activeAsset.ownerAddress}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Asset Description & Notes</div>
              <div style={{ padding: '12px', backgroundColor: '#FAFBFD', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '13px', lineHeight: '1.5' }}>
                {activeAsset.description || 'No detailed notes.'}
              </div>
            </div>

            {/* Ownership Evidence Documents */}
            <div style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Supporting Documents & Custodial Vault</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#FFFFFF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileText size={18} style={{ color: 'var(--action-primary)' }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '13px' }}>Private Document Vault</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {activeAsset.ipfsHash && activeAsset.ipfsHash.startsWith('http') ? activeAsset.ipfsHash : `https://assetra.io/api/metadata/${activeAsset.id}`}
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => alert('Accessing secure private documents in Supabase Storage vault...')}>
                  View Vault
                </button>
              </div>
            </div>

            {/* Admin Verification Actions */}
            {(() => {
              const activeStatus = getEffectiveAssetStatus(activeAsset);
              const isAlreadyApproved = activeStatus === 'APPROVED' || activeStatus === 'TOKENIZED';
              const isAlreadyRejected = activeStatus === 'REJECTED';

              if (isAlreadyApproved) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--state-success)', fontWeight: 600, fontSize: '13px' }}>
                      <CheckCircle2 size={16} />
                      <span>{activeStatus === 'TOKENIZED' ? 'Asset Tokenized On-Chain' : 'Asset Compliance Approved'}</span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setActiveAsset(null)}>
                      Close
                    </button>
                  </div>
                );
              }

              if (isAlreadyRejected) {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--state-error)', fontWeight: 600, fontSize: '13px' }}>
                      <XCircle size={16} />
                      <span>Asset Submission Rejected</span>
                    </div>
                    <button className="btn btn-secondary" onClick={() => setActiveAsset(null)}>
                      Close
                    </button>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--state-error)', borderColor: 'var(--state-error-border)' }}
                      onClick={() => setRejectReasonModal(true)}
                    >
                      <XCircle size={14} />
                      Reject
                    </button>

                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ color: 'var(--state-warning)', borderColor: 'var(--state-warning-border)' }}
                      onClick={() => setRequestInfoModal(true)}
                    >
                      <HelpCircle size={14} />
                      Request More Info
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => setActiveAsset(null)}>
                      Close
                    </button>
                    <button className="btn btn-primary" disabled={isProcessing} onClick={() => handleApprove(activeAsset)}>
                      <CheckCircle2 size={15} />
                      <span>{isProcessing ? 'Approving...' : 'Approve Dossier (Database - 0 Gas)'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={rejectReasonModal}
        onClose={() => setRejectReasonModal(false)}
        title="Specify Reason for Rejection"
      >
        <form onSubmit={handleConfirmReject}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Enter a clear reason for rejecting this asset submission. The applicant will be notified:
          </p>

          <div className="input-group">
            <label className="input-label">Rejection Reason <span style={{ color: 'var(--state-error)' }}>*</span></label>
            <textarea
              rows={3}
              required
              className="input-field"
              placeholder="e.g. Unverifiable appraisal source or incomplete legal deed hash..."
              value={rejectionReasonText}
              onChange={(e) => setRejectionReasonText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setRejectReasonModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--state-error)' }}>
              Confirm Rejection
            </button>
          </div>
        </form>
      </Modal>

      {/* Request Info Modal */}
      <Modal
        isOpen={requestInfoModal}
        onClose={() => setRequestInfoModal(false)}
        title="Request Additional Information"
      >
        <form onSubmit={handleConfirmRequestInfo}>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Describe the additional evidence or corrections requested from the applicant:
          </p>

          <div className="input-group">
            <label className="input-label">Feedback & Instructions <span style={{ color: 'var(--state-error)' }}>*</span></label>
            <textarea
              rows={3}
              required
              className="input-field"
              placeholder="e.g. Please upload updated 2026 property tax statement and custodial survey."
              value={requestInfoText}
              onChange={(e) => setRequestInfoText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setRequestInfoModal(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Send Instructions
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
