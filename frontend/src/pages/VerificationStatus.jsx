import React, { useState, useEffect, useMemo } from 'react';
import { useAssets } from '../context/AssetContext';
import { useAuth } from '../context/AuthContext';
import { useWeb3 } from '../context/Web3Context';
import { getEffectiveAssetStatus } from '../utils/statusHelper';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { TokenizeModal } from '../components/blockchain/TokenizeModal';
import { formatCurrency } from '../constants/currencies';
import { getEtherscanTxUrl } from '../constants/contracts';
import {
  FileCheck,
  ShieldCheck,
  Zap,
  AlertTriangle,
  Send,
  MessageSquare,
  AlertCircle,
  Edit3,
  ExternalLink,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  Lock,
  RefreshCw
} from 'lucide-react';

export const VerificationStatus = () => {
  const { assets, tokenizeAsset, updateAssetStatus, fetchAssets, isLoading } = useAssets();
  const { user } = useAuth();
  const { account } = useWeb3();

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [tokenizeModalAsset, setTokenizeModalAsset] = useState(null);
  const [resubmitModalAsset, setResubmitModalAsset] = useState(null);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [updatedValuation, setUpdatedValuation] = useState('');
  const [resubmitSuccess, setResubmitSuccess] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Active sync on mount: ensure the latest submissions are loaded from vault
  useEffect(() => {
    if (fetchAssets) {
      fetchAssets();
    }
  }, [fetchAssets]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (fetchAssets) await fetchAssets();
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  // Filter applications owned, registered or scoped to the current user
  const mySubmissions = useMemo(() => {
    if (!assets || assets.length === 0) return [];

    const connectedWallet = (account || '').toLowerCase();
    const userWallet = (user?.walletAddress || '').toLowerCase();
    const userId = user?.id ? String(user.id).toLowerCase() : '';

    let localSubmittedIds = [];
    try {
      const raw = localStorage.getItem('assetra_submitted_asset_ids');
      if (raw) localSubmittedIds = JSON.parse(raw);
    } catch {}
    const localIdSet = new Set(localSubmittedIds);

    const filtered = assets.filter((a) => {
      if (!a) return false;

      // 1. Assets submitted on this browser/client are always included
      if (a.id && localIdSet.has(a.id)) {
        return true;
      }

      // 2. Direct user ID match (UUID from Supabase public.assets.user_id)
      const assetUserId = a.userId ? String(a.userId).toLowerCase() : '';
      if (userId && assetUserId && assetUserId === userId) {
        return true;
      }

      // 3. Connected Web3 wallet match (case-insensitive across all registered address fields)
      const aOwner = (a.owner || '').toLowerCase();
      const aOwnerAddr = (a.ownerAddress || '').toLowerCase();
      const aCurrentOwner = (a.currentOwnerAddress || '').toLowerCase();
      const aOrigOwner = (a.originalOwnerAddress || '').toLowerCase();

      if (connectedWallet && connectedWallet !== '0x0000000000000000000000000000000000000000') {
        if (
          (aOwner && aOwner === connectedWallet) ||
          (aOwnerAddr && aOwnerAddr === connectedWallet) ||
          (aCurrentOwner && aCurrentOwner === connectedWallet) ||
          (aOrigOwner && aOrigOwner === connectedWallet)
        ) {
          return true;
        }
      }

      // 4. User profile wallet match (case-insensitive)
      if (userWallet && userWallet !== '0x0000000000000000000000000000000000000000') {
        if (
          (aOwner && aOwner === userWallet) ||
          (aOwnerAddr && aOwnerAddr === userWallet) ||
          (aCurrentOwner && aCurrentOwner === userWallet) ||
          (aOrigOwner && aOrigOwner === userWallet)
        ) {
          return true;
        }
      }

      // 5. Admin role has full visibility over all platform submissions
      if (user?.role === 'ADMIN') {
        return true;
      }

      // 6. If not logged in and no wallet connected, show all assets in preview/demo mode
      if (!user && !connectedWallet) {
        return true;
      }

      return false;
    });

    // Ensure newest submissions appear first
    return filtered.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [assets, user, account]);

  // Compute live pipeline statistics based on user's registered submissions
  const pipelineStats = useMemo(() => {
    let pendingCount = 0;
    let auditCount = 0;
    let approvedCount = 0;
    let tokenizedCount = 0;
    let listedCount = 0;

    mySubmissions.forEach((a) => {
      const eff = getEffectiveAssetStatus(a);
      if (eff === 'TOKENIZED') {
        tokenizedCount++;
        if (a.listingStatus === 'LISTED') listedCount++;
      } else if (eff === 'APPROVED') {
        approvedCount++;
      } else if (eff === 'UNDER_REVIEW' || eff === 'MORE_INFO_REQUESTED') {
        auditCount++;
      } else {
        pendingCount++;
      }
    });

    return [
      {
        phase: 'Phase 1',
        title: 'Asset Registration',
        desc: 'Dossier & Title upload',
        count: pendingCount,
        statusText: pendingCount > 0 ? `${pendingCount} In Queue` : 'Complete on submit'
      },
      {
        phase: 'Phase 2',
        title: 'Compliance Audit',
        desc: 'Administrative review',
        count: auditCount,
        statusText: auditCount > 0 ? `${auditCount} In Audit` : 'Verification in progress'
      },
      {
        phase: 'Phase 3',
        title: 'Platform Approval',
        desc: 'Title deed confirmed',
        count: approvedCount,
        statusText: approvedCount > 0 ? `${approvedCount} Ready to Mint` : 'Unlocks minting'
      },
      {
        phase: 'Phase 4',
        title: 'On-Chain Minting',
        desc: 'ERC-721 token deployed',
        count: tokenizedCount,
        statusText: tokenizedCount > 0 ? `${tokenizedCount} Tokenized` : 'Token ID generated'
      },
      {
        phase: 'Phase 5',
        title: 'Marketplace Listing',
        desc: 'Secondary liquidity',
        count: listedCount,
        statusText: listedCount > 0 ? `${listedCount} Active Listings` : 'Purchasable on-chain'
      }
    ];
  }, [mySubmissions]);

  const handleResubmitSubmit = async (e) => {
    e.preventDefault();
    if (!resubmitModalAsset) return;

    setActionError('');
    setIsProcessing(true);
    try {
      await updateAssetStatus(resubmitModalAsset.id, 'PENDING_REVIEW', {
        notes: resubmitNotes,
        ...(updatedValuation ? { valuation: parseFloat(updatedValuation) } : {})
      });
      setResubmitSuccess(true);
      if (fetchAssets) await fetchAssets();
      setTimeout(() => {
        setResubmitSuccess(false);
        setResubmitModalAsset(null);
        setResubmitNotes('');
        setUpdatedValuation('');
      }, 1800);
    } catch (err) {
      setActionError(`Resubmission failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMintToken = async (asset) => {
    setActionError('');
    setIsProcessing(true);
    try {
      await tokenizeAsset(asset.id, {
        tokenStandard: asset.tokenStandard || 'ERC-721',
        tokenSymbol: asset.tokenSymbol || 'AST-TOK'
      });
      if (fetchAssets) await fetchAssets();
      setSelectedAsset(null);
    } catch (err) {
      setActionError(`Tokenization failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-peach)',
                color: 'var(--color-copper)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Audited Asset Lifecycle
            </span>
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: '34px',
              fontWeight: 600,
              color: 'var(--color-midnight-navy)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Verification & Lifecycle Tracker
          </h2>
          <p style={{ fontSize: '14.5px', color: 'var(--color-secondary-text)', marginTop: '6px' }}>
            Track your asset dossiers through registration, administrative review, compliance approval, and smart contract minting.
          </p>
        </div>

        {/* Header Action: Sync Vault Status Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: '9999px',
              padding: '9px 18px',
              fontSize: '12.5px',
              fontWeight: 600,
              backgroundColor: '#FFFFFF',
              boxShadow: 'var(--shadow-sm)'
            }}
            title="Fetch latest verified status from Supabase database vault"
          >
            <RefreshCw
              size={13}
              style={{
                animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
                color: 'var(--color-copper)'
              }}
            />
            <span>{isRefreshing ? 'Synchronizing...' : 'Sync Vault Status'}</span>
          </button>
        </div>
      </div>

      {/* 5-Phase Distinct Lifecycle Blueprint (Dynamic user progression tracking) */}
      <div
        style={{
          padding: '24px 28px',
          marginBottom: '26px',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-secondary-text)', marginBottom: '16px' }}>
          Assetra On-Chain Institutional Pipeline
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '18px',
            position: 'relative'
          }}
        >
          {pipelineStats.map((item, idx) => (
            <div
              key={idx}
              style={{
                backgroundColor: item.count > 0 ? '#F0FDF4' : '#F8FAFC',
                border: item.count > 0 ? '1px solid rgba(22, 101, 52, 0.15)' : '1px solid transparent',
                borderRadius: '16px',
                padding: '14px 16px',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: 'var(--color-copper)', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', backgroundColor: 'var(--color-peach)' }}>
                  {item.phase}
                </span>
                {item.count > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', backgroundColor: '#DCFCE7', padding: '1px 7px', borderRadius: '9999px' }}>
                    {item.count}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginTop: '2px' }}>
                {item.title}
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                {item.desc}
              </div>
              <div style={{ fontSize: '11px', color: item.count > 0 ? '#166534' : 'var(--color-secondary-text)', marginTop: '6px', fontWeight: 600 }}>
                {item.statusText}
              </div>
            </div>
          ))}
        </div>
      </div>

      {actionError && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: '16px',
            padding: '14px 18px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}
        >
          <AlertCircle size={18} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && mySubmissions.length === 0 ? (
        <div
          style={{
            padding: '50px 24px',
            textAlign: 'center',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <RefreshCw
            size={28}
            style={{
              animation: 'spin 1s linear infinite',
              color: 'var(--color-copper)',
              margin: '0 auto 16px'
            }}
          />
          <h4 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-midnight-navy)', margin: '0 0 6px' }}>
            Synchronizing Asset Dossiers...
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)', margin: 0 }}>
            Querying database vault for submitted asset applications.
          </p>
        </div>
      ) : mySubmissions.length === 0 ? (
        <EmptyState
          icon={FileCheck}
          title="No Submitted Applications Found"
          description="You have not yet submitted any real-world assets for institutional audit and verification."
          actionLabel="Register an Asset"
          actionPath="/register"
        />
      ) : (
        <div style={{ padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: 'var(--shadow-card)' }}>
          <div
            style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#FFFFFF'
            }}
          >
            <div>
              <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                Registered Asset Portfolio Files
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                Showing {mySubmissions.length} recorded {mySubmissions.length === 1 ? 'submission' : 'submissions'} scoped to your profile
              </p>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', minWidth: '760px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>Asset Dossier & ID</th>
                  <th style={{ minWidth: '130px', whiteSpace: 'nowrap' }}>Appraisal Value</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Submitted Date</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Compliance Status</th>
                  <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Blockchain State</th>
                  <th style={{ textAlign: 'right', minWidth: '160px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mySubmissions.map((asset) => {
                  const effectiveStatus = getEffectiveAssetStatus(asset);
                  const isTokenized = effectiveStatus === 'TOKENIZED';
                  const isApproved = effectiveStatus === 'APPROVED';
                  const isRejected = effectiveStatus === 'REJECTED';
                  const isInfoReq = effectiveStatus === 'MORE_INFO_REQUESTED';
                  const isUnderReview = effectiveStatus === 'UNDER_REVIEW';
                  const isPending = effectiveStatus === 'PENDING_REVIEW';

                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-midnight-navy)', fontSize: '13.5px' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {asset.id} • {asset.category}
                        </div>
                      </td>

                      <td style={{ fontWeight: 600, color: 'var(--color-midnight-navy)', fontSize: '13.5px', whiteSpace: 'nowrap' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </td>

                      <td style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', whiteSpace: 'nowrap' }}>
                        {asset.createdAt ? new Date(asset.createdAt).toLocaleDateString() : 'Recent'}
                      </td>

                      <td style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>
                        <Badge status={effectiveStatus} size="small" />
                      </td>

                      <td style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>
                        {isTokenized ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                              <CheckCircle2 size={13} /> Tokenized ERC-721
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                              Token ID #{asset.tokenId || '1'}
                            </span>
                          </div>
                        ) : isApproved ? (
                          <span style={{ fontSize: '12px', color: 'var(--color-copper)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <ShieldCheck size={14} /> Ready to Mint
                          </span>
                        ) : isUnderReview ? (
                          <span style={{ fontSize: '12px', color: '#0369A1', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <Clock size={13} /> Audit In Progress
                          </span>
                        ) : isInfoReq ? (
                          <span style={{ fontSize: '12px', color: '#B45309', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <AlertTriangle size={13} /> Action Required
                          </span>
                        ) : isRejected ? (
                          <span style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <AlertCircle size={13} /> Review Rejected
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)', display: 'inline-flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
                            <Clock size={13} /> Awaiting Compliance Review
                          </span>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '6px 14px',
                              fontSize: '12px',
                              borderRadius: '9999px',
                              whiteSpace: 'nowrap'
                            }}
                            onClick={() => setSelectedAsset(asset)}
                          >
                            Inspect Dossier
                          </button>

                          {isTokenized ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#DCFCE7',
                                  color: '#166534',
                                  fontSize: '11.5px',
                                  fontWeight: 600,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  border: '1px solid rgba(22, 101, 52, 0.2)',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0
                                }}
                              >
                                <CheckCircle2 size={12} />
                                <span>Tokenized #{asset.tokenId || '1'}</span>
                              </span>
                              {asset.transactionHash && (
                                <a
                                  href={getEtherscanTxUrl(asset.transactionHash)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="btn btn-secondary btn-sm"
                                  style={{
                                    padding: '5px 10px',
                                    fontSize: '11px',
                                    borderRadius: '9999px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    color: 'var(--color-secondary-text)'
                                  }}
                                  title="View on Sepolia Etherscan"
                                >
                                  <ExternalLink size={11} />
                                  <span>Etherscan</span>
                                </a>
                              )}
                            </div>
                          ) : isApproved ? (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '6px 16px',
                                fontSize: '12px',
                                borderRadius: '9999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => setTokenizeModalAsset(asset)}
                            >
                              <Zap size={13} />
                              <span>Tokenize Asset</span>
                            </button>
                          ) : isInfoReq ? (
                            <button
                              className="btn btn-primary btn-sm"
                              style={{
                                padding: '6px 16px',
                                fontSize: '12px',
                                borderRadius: '9999px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              onClick={() => setResubmitModalAsset(asset)}
                            >
                              <Edit3 size={13} />
                              <span>Resubmit Info</span>
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Verification Details Modal */}
      <Modal
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
        title={`Asset Dossier & Audit History`}
      >
        {selectedAsset && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                {selectedAsset.name}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                Asset Identifier: {selectedAsset.id}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                padding: '18px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '18px'
              }}
            >
              <div>
                <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Compliance Verification Status
                </div>
                <div style={{ marginTop: '6px' }}>
                  <Badge status={selectedAsset.status} />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  Audited Valuation
                </div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-midnight-navy)', marginTop: '4px' }}>
                  {formatCurrency(selectedAsset.valuation, selectedAsset.currency)}
                </div>
              </div>
            </div>

            {/* Verifier Feedback Note */}
            {selectedAsset.reviewNotes && (
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-peach)',
                  borderRadius: '16px',
                  marginBottom: '18px',
                  fontSize: '13px'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-copper)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <MessageSquare size={16} /> Compliance Auditor Review Note
                </div>
                <div style={{ color: 'var(--color-midnight-navy)', lineHeight: 1.6 }}>{selectedAsset.reviewNotes}</div>
              </div>
            )}

            {/* Rejection Reason */}
            {selectedAsset.rejectionReason && (
              <div
                style={{
                  padding: '16px 20px',
                  backgroundColor: 'var(--color-error-bg)',
                  border: '1px solid var(--color-error-border)',
                  borderRadius: '16px',
                  marginBottom: '18px',
                  fontSize: '13px'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                  <AlertTriangle size={16} /> Rejection Finding
                </div>
                <div style={{ color: 'var(--color-error)', lineHeight: 1.6 }}>{selectedAsset.rejectionReason}</div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginBottom: '24px', backgroundColor: '#F8FAFC', padding: '18px 20px', borderRadius: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Category & Jurisdiction:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{selectedAsset.category} • {selectedAsset.location || 'Unspecified'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Custodial / Valuation Firm:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{selectedAsset.custodian || 'Accredited Appraiser'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Public Metadata URI:</span>
                <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-secondary-text)' }}>
                  {selectedAsset.ipfsHash && selectedAsset.ipfsHash.startsWith('http')
                    ? selectedAsset.ipfsHash
                    : `https://assetra.io/api/metadata/${selectedAsset.id}`}
                </span>
              </div>
              {selectedAsset.contractAddress && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-secondary-text)' }}>Smart Contract Registry:</span>
                  <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-copper)' }}>
                    {selectedAsset.contractAddress}
                  </span>
                </div>
              )}
              {selectedAsset.txHash && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-secondary-text)' }}>On-Chain Transaction Hash:</span>
                  <span style={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '11px', color: 'var(--color-secondary-text)' }}>
                    {selectedAsset.txHash.slice(0, 16)}...{selectedAsset.txHash.slice(-8)}
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '18px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedAsset(null)}
                style={{
                  borderRadius: '9999px',
                  padding: '9px 20px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Close
              </button>

              {Boolean(
                selectedAsset.isTokenized ||
                selectedAsset.status === 'TOKENIZED' ||
                selectedAsset.tokenStatus === 'TOKENIZED' ||
                (selectedAsset.tokenId && String(selectedAsset.tokenId) !== '0')
              ) ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      fontSize: '12px',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      border: '1px solid rgba(22, 101, 52, 0.2)'
                    }}
                  >
                    <CheckCircle2 size={14} />
                    <span>Tokenized on Sepolia (ERC-721 #{selectedAsset.tokenId || '1'})</span>
                  </span>
                  {selectedAsset.transactionHash && (
                    <a
                      href={getEtherscanTxUrl(selectedAsset.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '7px 14px',
                        fontSize: '12px',
                        borderRadius: '9999px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px'
                      }}
                    >
                      <ExternalLink size={12} />
                      <span>View on Etherscan</span>
                    </a>
                  )}
                </div>
              ) : (selectedAsset.status === 'APPROVED' || selectedAsset.verificationStatus === 'APPROVED') ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const toTokenize = selectedAsset;
                    setSelectedAsset(null);
                    setTokenizeModalAsset(toTokenize);
                  }}
                  style={{
                    borderRadius: '9999px',
                    padding: '9px 22px',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Zap size={14} />
                  <span>Tokenize Asset on Sepolia</span>
                </button>
              ) : null}
            </div>
          </div>
        )}
      </Modal>

      {/* Resubmit Application Modal */}
      <Modal
        isOpen={!!resubmitModalAsset}
        onClose={() => setResubmitModalAsset(null)}
        title={`Resubmit Application — ${resubmitModalAsset?.name}`}
      >
        {resubmitSuccess ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <ShieldCheck size={40} style={{ color: 'var(--color-copper)', margin: '0 auto 14px' }} />
            <h4 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginBottom: '6px' }}>
              Application Successfully Resubmitted
            </h4>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)' }}>
              Your updated dossier has been returned to the compliance auditor review queue.
            </p>
          </div>
        ) : (
          <form onSubmit={handleResubmitSubmit}>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', marginBottom: '18px', lineHeight: 1.6 }}>
              Address the auditor feedback notes below to clarify property title or adjust custodial appraisal figures:
            </p>

            <div className="input-group" style={{ marginBottom: '18px' }}>
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Updated Appraisal Valuation ($ USD)
              </label>
              <input
                type="number"
                className="input-field"
                placeholder={resubmitModalAsset?.valuation}
                value={updatedValuation}
                onChange={(e) => setUpdatedValuation(e.target.value)}
                style={{ height: '42px', fontSize: '13.5px', borderRadius: '14px' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: '22px' }}>
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Clarification Notes & Evidence Explanations <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <textarea
                rows={4}
                required
                className="input-field"
                placeholder="Explain the supplemental evidence provided or how previous auditor comments have been resolved..."
                value={resubmitNotes}
                onChange={(e) => setResubmitNotes(e.target.value)}
                style={{ fontSize: '13.5px', lineHeight: 1.5, borderRadius: '16px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResubmitModalAsset(null)}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isProcessing}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Send size={14} />
                <span>{isProcessing ? 'Submitting...' : 'Submit Updated Dossier'}</span>
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Tokenize Modal */}
      {tokenizeModalAsset && (
        <TokenizeModal
          isOpen={!!tokenizeModalAsset}
          onClose={() => setTokenizeModalAsset(null)}
          asset={tokenizeModalAsset}
        />
      )}
    </div>
  );
};

export default VerificationStatus;
