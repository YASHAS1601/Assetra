import React, { useState } from 'react';
import { useAssets } from '../../context/AssetContext';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { AssetReviewActions } from '../../components/common/AssetReviewActions';
import { getEffectiveAssetStatus, normalizeStatus } from '../../utils/statusHelper';
import { formatCurrency } from '../../constants/currencies';
import { ethers } from 'ethers';
import {
  REGISTRY_CONTRACT_ADDRESS,
  ASSET_REGISTRY_ABI,
  DEPLOYER_ADDRESS
} from '../../constants/contracts';
import {
  Clock,
  Search,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Building2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Lock,
  Download,
  Eye,
  AlertTriangle,
  FileCheck,
  Image as ImageIcon
} from 'lucide-react';

export const AdminPendingReviews = () => {
  const { assets, updateAssetStatus, getDocumentDownloadUrl, getAssetDocuments } = useAssets();
  const { user } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeAsset, setActiveAsset] = useState(null);

  // Live dossier documents state
  const [dossierDocs, setDossierDocs] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [docError, setDocError] = useState('');

  // Document viewer modal state
  const [viewerState, setViewerState] = useState({
    isOpen: false,
    doc: null,
    url: '',
    isLoading: false,
    error: ''
  });

  // Review Modals
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const [requestInfoModalOpen, setRequestInfoModalOpen] = useState(false);
  const [requestInfoNotes, setRequestInfoNotes] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  // Filter strictly to pending, under-review, or info-requested submissions.
  // Approved, rejected, and tokenized assets are excluded from the pending reviews queue.
  const pendingSubmissions = assets.filter((a) => {
    const status = getEffectiveAssetStatus(a);
    return status === 'PENDING_REVIEW' || status === 'UNDER_REVIEW' || status === 'MORE_INFO_REQUESTED';
  });

  const filteredSubmissions = pendingSubmissions.filter((asset) => {
    const status = getEffectiveAssetStatus(asset);
    const matchesStatus =
      statusFilter === 'ALL' ||
      status === statusFilter ||
      (statusFilter === 'PENDING_REVIEW' && status === 'PENDING_REVIEW') ||
      (statusFilter === 'UNDER_REVIEW' && status === 'UNDER_REVIEW');

    const matchesSearch =
      !searchTerm ||
      (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.id && asset.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.location && asset.location.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesStatus && matchesSearch;
  });

  const handleStartReview = async (asset) => {
    setIsProcessing(true);
    setNotification({ type: '', message: '' });
    try {
      await updateAssetStatus(asset.id, 'UNDER_REVIEW', {
        notes: `Review initiated by auditor ${user?.email || 'admin'}.`
      });
      setNotification({
        type: 'success',
        message: `Asset ${asset.id} status updated to UNDER_REVIEW.`
      });
      setTimeout(() => setNotification({ type: '', message: '' }), 3500);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  // Gas-free Database Approval (No MetaMask, No Gas, 100% Off-chain)
  const handleDatabaseApprove = async (asset) => {
    if (!asset) return;
    setIsProcessing(true);
    setNotification({ type: '', message: '' });

    try {
      const auditorId = user?.email || user?.id || 'compliance-officer';
      const reviewTimestamp = new Date().toISOString();

      await updateAssetStatus(asset.id, 'APPROVED', {
        notes: `Compliance approval granted by auditor ${auditorId} at ${reviewTimestamp}. Eligible for owner on-chain tokenization.`
      });

      setNotification({
        type: 'success',
        message: `Asset ${asset.id} approved! Status updated to APPROVED. The asset owner can now tokenize it on Sepolia in a single transaction.`
      });

      setActiveAsset(null);
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    } catch (err) {
      console.error('Database approval failed:', err);
      setNotification({
        type: 'error',
        message: `Database approval failed: ${err.message}`
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Stage B: Gas-free Database Rejection (No MetaMask, No Gas, Off-chain)
  const handleConfirmReject = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim() || !activeAsset) return;

    setIsProcessing(true);
    setNotification({ type: '', message: '' });

    try {
      const auditorId = user?.email || user?.id || 'compliance-officer';
      await updateAssetStatus(activeAsset.id, 'REJECTED', {
        reason: rejectionReason.trim(),
        notes: `Application rejected by compliance auditor ${auditorId}: ${rejectionReason.trim()}`
      });

      setRejectModalOpen(false);
      setActiveAsset(null);
      setRejectionReason('');
      setNotification({
        type: 'success',
        message: `Asset ${activeAsset.id} REJECTED in database (0 gas). Audit log recorded.`
      });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      console.error('Database rejection failed:', err);
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmRequestInfo = async (e) => {
    e.preventDefault();
    if (!requestInfoNotes.trim() || !activeAsset) return;

    setIsProcessing(true);
    setNotification({ type: '', message: '' });
    try {
      await updateAssetStatus(activeAsset.id, 'MORE_INFO_REQUESTED', {
        notes: requestInfoNotes.trim()
      });
      setRequestInfoModalOpen(false);
      setActiveAsset(null);
      setRequestInfoNotes('');
      setNotification({
        type: 'success',
        message: `Information requested for asset ${activeAsset.id}. Applicant notified to resubmit evidence.`
      });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenDossier = async (asset) => {
    setActiveAsset(asset);
    setDossierDocs([]);
    setDocError('');
    setLoadingDocs(true);

    try {
      const docs = await getAssetDocuments(asset.id);
      setDossierDocs(docs || []);
    } catch (err) {
      console.warn('Failed to load asset documents from database:', err.message);
      setDocError(err.message);
    } finally {
      setLoadingDocs(false);
    }
  };

  // View document in modal preview (supports PDF and images)
  const handleViewDocument = async (doc) => {
    if (!doc) return;
    setViewerState({
      isOpen: true,
      doc,
      url: '',
      isLoading: true,
      error: ''
    });

    try {
      const url = await getDocumentDownloadUrl(doc.id || doc.storage_path);
      if (!url) {
        throw new Error('Authorized signed URL could not be generated for this private document.');
      }
      setViewerState(prev => ({
        ...prev,
        url,
        isLoading: false
      }));
    } catch (err) {
      console.error('Failed to view document:', err);
      setViewerState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message || 'Failed to open document preview.'
      }));
    }
  };

  // Download document using 5-minute signed URL
  const handleDownloadDocument = async (doc) => {
    if (!doc) return;
    try {
      const targetIdentifier = doc.id || doc.storage_path || doc;
      const url = await getDocumentDownloadUrl(targetIdentifier);
      if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.download = doc.original_name || doc.filename || 'asset_document';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setNotification({
          type: 'error',
          message: 'Document download link could not be generated from secure vault.'
        });
      }
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Error opening document: ${err.message}`
      });
    }
  };

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
                color: 'var(--color-copper)'
              }}
            >
              Institutional Verification Queue
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
            Pending Asset Reviews & Compliance Audits
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Review submitted asset dossiers, verify custodial title deeds, request information, or approve assets for on-chain tokenization.
          </p>
        </div>
      </div>

      {notification.message && (
        <div
          style={{
            backgroundColor: notification.type === 'error' ? 'var(--color-peach)' : 'var(--color-mint)',
            borderRadius: '16px',
            padding: '14px 20px',
            marginBottom: '20px',
            fontSize: '13px',
            color: notification.type === 'error' ? '#C53030' : '#1B6A4C',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
          }}
        >
          {notification.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span style={{ fontWeight: 500 }}>{notification.message}</span>
        </div>
      )}

      {/* Control Bar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 360px' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '360px' }}>
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
              placeholder="Search by title, ID, or jurisdiction..."
              style={{
                width: '100%',
                paddingLeft: '42px',
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

          <select
            style={{
              width: 'auto',
              height: '42px',
              fontSize: '13px',
              borderRadius: '9999px',
              backgroundColor: '#F8FAFC',
              border: '1px solid rgba(0,0,0,0.04)',
              padding: '0 20px',
              outline: 'none',
              color: 'var(--color-charcoal)',
              cursor: 'pointer'
            }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">All Active Reviews</option>
            <option value="PENDING_REVIEW">Pending Initial Review</option>
            <option value="UNDER_REVIEW">Currently Under Review</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', fontWeight: 500 }}>
          Queue: <strong style={{ color: 'var(--color-charcoal)' }}>{filteredSubmissions.length}</strong> dossiers requiring auditor attention
        </div>
      </div>

      {/* Pending Dossiers Table */}
      {filteredSubmissions.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Verification Queue is Empty"
          description="There are no pending submissions awaiting review at this time. All submitted real-world assets have been processed."
        />
      ) : (
        <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Asset Title & Identifier</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Classification</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Appraisal Value</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Submitted Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Review Status</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', textAlign: 'right' }}>Audit Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.map((asset) => {
                  const effectiveStatus = getEffectiveAssetStatus(asset);

                  return (
                    <tr key={asset.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {asset.id} • {asset.location || 'Location Not Specified'}
                        </div>
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                        {asset.category}
                      </td>

                      <td style={{ padding: '18px 20px', fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-secondary-text)' }}>
                        {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Recent'}
                      </td>

                      <td style={{ padding: '18px 20px' }}>
                        <Badge status={effectiveStatus} size="small" />
                      </td>

                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <AssetReviewActions
                          asset={asset}
                          onStartReview={handleStartReview}
                          onInspect={handleOpenDossier}
                          isProcessing={isProcessing}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comprehensive Asset Dossier Inspection Modal */}
      <Modal
        isOpen={!!activeAsset}
        onClose={() => setActiveAsset(null)}
        title="Auditor Compliance Dossier"
      >
        {activeAsset && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h4 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                {activeAsset.name}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                Asset Dossier ID: {activeAsset.id} • Registered Owner: {activeAsset.ownerAddress || activeAsset.userId}
              </p>
            </div>

            {/* Appraisal Banner */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '20px 24px',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                marginBottom: '20px'
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Audited Valuation
                </div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-charcoal)', marginTop: '2px' }}>
                  {formatCurrency(activeAsset.valuation, activeAsset.currency)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Current Status
                </div>
                <div style={{ marginTop: '6px' }}>
                  <Badge status={activeAsset.status} />
                </div>
              </div>
            </div>

            {/* Details Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px', marginBottom: '20px' }}>
              <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', display: 'block', fontWeight: 500 }}>Category:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px', marginTop: '2px', display: 'block' }}>{activeAsset.category}</span>
              </div>
              <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', display: 'block', fontWeight: 500 }}>Jurisdiction:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px', marginTop: '2px', display: 'block' }}>{activeAsset.location || 'Not Specified'}</span>
              </div>
              <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', display: 'block', fontWeight: 500 }}>Appraisal Firm:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px', marginTop: '2px', display: 'block' }}>{activeAsset.custodian || 'CBRE Global Valuation'}</span>
              </div>
              <div style={{ padding: '14px 18px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', display: 'block', fontWeight: 500 }}>Token Standard:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px', marginTop: '2px', display: 'block' }}>{activeAsset.tokenStandard || 'ERC-721 Non-Fungible'}</span>
              </div>
            </div>

            {/* Document Evidence Section */}
            <div
              style={{
                padding: '20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                marginBottom: '20px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} style={{ color: 'var(--color-copper)' }} />
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                    Title Deeds & Custodial Documents Vault
                  </span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>
                  Private Supabase Storage • 5-min Signed URLs
                </span>
              </div>

              {loadingDocs && (
                <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', padding: '12px 0', textAlign: 'center' }}>
                  Retrieving encrypted document references from database...
                </div>
              )}

              {docError && (
                <div style={{ fontSize: '12px', color: 'var(--color-error)', padding: '8px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertCircle size={14} />
                  <span>{docError}</span>
                </div>
              )}

              {!loadingDocs && dossierDocs.length === 0 && (
                <div
                  style={{
                    padding: '24px 20px',
                    backgroundColor: '#FFFFFF',
                    borderRadius: '16px',
                    textAlign: 'center',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                  }}
                >
                  <FileText size={26} style={{ color: 'var(--color-secondary-text)', opacity: 0.5, margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                    No documents uploaded for this asset
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', marginTop: '4px', maxWidth: '420px', margin: '4px auto 0' }}>
                    The submitter did not attach title deed dossiers or appraisal evidence during registration. You may request information before approving.
                  </p>
                </div>
              )}

              {!loadingDocs && dossierDocs.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {dossierDocs.map((doc) => {
                    const isPdf = doc.mime_type === 'application/pdf';
                    const isImg = doc.mime_type?.startsWith('image/');
                    return (
                      <div
                        key={doc.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          backgroundColor: '#FFFFFF',
                          borderRadius: '16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '240px' }}>
                          <div
                            style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              backgroundColor: isPdf ? 'rgba(220, 38, 38, 0.08)' : (isImg ? 'rgba(185, 101, 58, 0.08)' : '#F1F5F9'),
                              color: isPdf ? '#DC2626' : (isImg ? 'var(--color-copper)' : 'var(--color-navy)'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0
                            }}
                          >
                            {isPdf ? <FileText size={18} /> : (isImg ? <ImageIcon size={18} /> : <FileCheck size={18} />)}
                          </div>
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-charcoal)', wordBreak: 'break-all' }}>
                              {doc.original_name || doc.filename}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                              {(doc.size_bytes / 1024 / 1024).toFixed(2)} MB • {doc.mime_type || 'Document'} • Uploaded {new Date(doc.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-action-primary"
                            onClick={() => handleViewDocument(doc)}
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                          >
                            <Eye size={13} />
                            <span>View Document</span>
                          </button>

                          <button
                            type="button"
                            className="btn-action-secondary"
                            onClick={() => handleDownloadDocument(doc)}
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                          >
                            <Download size={13} />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Decision Actions */}
            {(() => {
              const activeStatus = getEffectiveAssetStatus(activeAsset);
              const isAlreadyApproved = activeStatus === 'APPROVED' || activeStatus === 'TOKENIZED';
              const isAlreadyRejected = activeStatus === 'REJECTED';

              if (isAlreadyApproved) {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(0,0,0,0.05)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        backgroundColor: 'var(--color-mint, #DDF5EE)',
                        color: '#065F46',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <CheckCircle2 size={16} />
                      <span>{activeStatus === 'TOKENIZED' ? 'Asset Tokenized On-Chain (Sepolia)' : 'Compliance Verification Completed & Approved'}</span>
                    </div>

                    <button
                      type="button"
                      className="btn-action-primary"
                      onClick={() => setActiveAsset(null)}
                    >
                      Close Dossier
                    </button>
                  </div>
                );
              }

              if (isAlreadyRejected) {
                return (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingTop: '16px',
                      borderTop: '1px solid rgba(0,0,0,0.05)',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 18px',
                        borderRadius: '9999px',
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        fontSize: '13px',
                        fontWeight: 600
                      }}
                    >
                      <XCircle size={16} />
                      <span>Application Rejected by Compliance Auditor</span>
                    </div>

                    <button
                      type="button"
                      className="btn-action-primary"
                      onClick={() => setActiveAsset(null)}
                    >
                      Close Dossier
                    </button>
                  </div>
                );
              }

              return (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '16px',
                    borderTop: '1px solid rgba(0,0,0,0.05)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setRequestInfoModalOpen(true)}
                      style={{
                        backgroundColor: '#FFF0E6',
                        border: '1px solid rgba(185, 101, 58, 0.3)',
                        borderRadius: '9999px',
                        color: '#9A4F2A',
                        padding: '9px 18px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <HelpCircle size={15} />
                      <span>Request Information</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRejectModalOpen(true)}
                      style={{
                        backgroundColor: '#FEE2E2',
                        border: '1px solid rgba(220, 38, 38, 0.25)',
                        borderRadius: '9999px',
                        color: '#991B1B',
                        padding: '9px 18px',
                        fontSize: '12.5px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <XCircle size={15} />
                      <span>Reject Asset</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveAsset(null)}
                      className="btn-action-secondary"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDatabaseApprove(activeAsset)}
                      style={{
                        backgroundColor: 'var(--color-mint, #DDF5EE)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: '9999px',
                        color: '#065F46',
                        padding: '9px 24px',
                        fontSize: '13px',
                        fontWeight: 600,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        cursor: isProcessing ? 'not-allowed' : 'pointer',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)',
                        opacity: isProcessing ? 0.7 : 1
                      }}
                      title="Approve asset compliance dossier (0 gas)"
                    >
                      <CheckCircle2 size={16} />
                      <span>{isProcessing ? 'Processing Approval...' : 'Approve Application'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>

      {/* Reject Modal */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Reject Asset Dossier — ${activeAsset?.name}`}
      >
        <form onSubmit={handleConfirmReject}>
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#FEE2E2',
              borderRadius: '16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <span>State clear compliance reasons for rejection. This finding is permanently recorded in the immutable audit trail.</span>
          </div>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
              Rejection Finding & Rationale <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Incomplete title deed chain, unverified appraisal source, or failed jurisdiction clearance..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{
                width: '100%',
                fontSize: '13.5px',
                lineHeight: 1.5,
                borderRadius: '16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '14px 18px',
                outline: 'none',
                color: 'var(--color-charcoal)'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              style={{
                backgroundColor: '#F8FAFC',
                border: 'none',
                borderRadius: '9999px',
                color: 'var(--color-charcoal)',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              style={{
                backgroundColor: '#DC2626',
                border: 'none',
                borderRadius: '9999px',
                color: '#FFFFFF',
                padding: '9px 24px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isProcessing ? 'Persisting Rejection...' : 'Confirm Rejection'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Request Information Modal */}
      <Modal
        isOpen={requestInfoModalOpen}
        onClose={() => setRequestInfoModalOpen(false)}
        title={`Request Information — ${activeAsset?.name}`}
      >
        <form onSubmit={handleConfirmRequestInfo}>
          <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '18px', lineHeight: 1.5 }}>
            Specify the missing documentation, updated appraisal requirement, or legal clarification needed from the applicant:
          </p>

          <div className="input-group" style={{ marginBottom: '24px' }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', display: 'block', fontSize: '13px' }}>
              Clarification Request Notes <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <textarea
              rows={4}
              required
              placeholder="e.g. Please provide updated appraisal report from certified valuer CBRE, as the current document is over 12 months old..."
              value={requestInfoNotes}
              onChange={(e) => setRequestInfoNotes(e.target.value)}
              style={{
                width: '100%',
                fontSize: '13.5px',
                lineHeight: 1.5,
                borderRadius: '16px',
                backgroundColor: '#F8FAFC',
                border: '1px solid rgba(0,0,0,0.05)',
                padding: '14px 18px',
                outline: 'none',
                color: 'var(--color-charcoal)'
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button
              type="button"
              onClick={() => setRequestInfoModalOpen(false)}
              style={{
                backgroundColor: '#F8FAFC',
                border: 'none',
                borderRadius: '9999px',
                color: 'var(--color-charcoal)',
                padding: '9px 20px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isProcessing}
              style={{
                backgroundColor: 'var(--color-copper)',
                border: 'none',
                borderRadius: '9999px',
                color: '#FFFFFF',
                padding: '9px 24px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              {isProcessing ? 'Sending Request...' : 'Send Request to Applicant'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Document Viewer Modal */}
      <Modal
        isOpen={viewerState.isOpen}
        onClose={() => setViewerState(prev => ({ ...prev, isOpen: false, url: '' }))}
        title={viewerState.doc?.original_name || viewerState.doc?.filename || 'Document Viewer'}
      >
        <div style={{ padding: '8px 0' }}>
          {viewerState.isLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-secondary-text)', fontSize: '13.5px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  border: '3px solid rgba(0,0,0,0.06)',
                  borderTopColor: 'var(--color-copper)',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }}
              />
              Generating secure signed preview URL...
            </div>
          )}

          {viewerState.error && (
            <div style={{ padding: '20px', backgroundColor: '#FEE2E2', borderRadius: '16px', color: '#DC2626', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>
                <strong>Unable to load document preview</strong>
                <p style={{ marginTop: '4px', opacity: 0.9 }}>{viewerState.error}</p>
              </div>
            </div>
          )}

          {!viewerState.isLoading && !viewerState.error && viewerState.url && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)' }}>
                  {viewerState.doc?.mime_type} • {(viewerState.doc?.size_bytes / 1024 / 1024).toFixed(2)} MB • Authorized Access
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href={viewerState.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-copper)',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      textDecoration: 'none',
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      backgroundColor: '#F8FAFC'
                    }}
                  >
                    <ExternalLink size={12} />
                    <span>Open in Tab</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDownloadDocument(viewerState.doc)}
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-charcoal)',
                      fontWeight: 500,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '6px 12px',
                      borderRadius: '9999px',
                      backgroundColor: '#F8FAFC',
                      border: '1px solid rgba(0,0,0,0.06)',
                      cursor: 'pointer'
                    }}
                  >
                    <Download size={12} />
                    <span>Save</span>
                  </button>
                </div>
              </div>

              {viewerState.doc?.mime_type === 'application/pdf' ? (
                <iframe
                  src={viewerState.url}
                  title={viewerState.doc?.original_name || 'PDF Document'}
                  style={{
                    width: '100%',
                    height: '65vh',
                    borderRadius: '16px',
                    border: '1px solid rgba(0,0,0,0.06)',
                    backgroundColor: '#FFFFFF'
                  }}
                />
              ) : (viewerState.doc?.mime_type?.startsWith('image/') ? (
                <div style={{ textAlign: 'center', padding: '16px', backgroundColor: '#F8FAFC', borderRadius: '16px', maxHeight: '65vh', overflow: 'auto' }}>
                  <img
                    src={viewerState.url}
                    alt={viewerState.doc?.original_name || 'Document Evidence'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '60vh',
                      objectFit: 'contain',
                      borderRadius: '12px',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.06)'
                    }}
                  />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#F8FAFC', borderRadius: '16px' }}>
                  <FileText size={32} style={{ color: 'var(--color-secondary-text)', margin: '0 auto 12px' }} />
                  <p style={{ fontSize: '13.5px', color: 'var(--color-charcoal)', fontWeight: 500 }}>
                    In-browser preview is not supported for this file format ({viewerState.doc?.mime_type}).
                  </p>
                  <a
                    href={viewerState.url}
                    download={viewerState.doc?.original_name || 'document'}
                    className="btn-action-primary"
                    style={{
                      marginTop: '16px',
                      padding: '8px 20px',
                      fontSize: '12.5px'
                    }}
                  >
                    <Download size={13} />
                    <span>Download to View</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default AdminPendingReviews;
