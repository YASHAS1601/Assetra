import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAssets } from '../../context/AssetContext';
import { MetricCard } from '../../components/common/MetricCard';
import { Badge } from '../../components/common/Badge';
import { formatCurrency } from '../../constants/currencies';
import { getEffectiveAssetStatus } from '../../utils/statusHelper';
import {
  TOKEN_CONTRACT_ADDRESS,
  getPublicSepoliaProvider,
  getEtherscanTxUrl,
  getEtherscanAddressUrl
} from '../../constants/contracts';
import {
  Clock,
  FileSearch,
  CheckCircle2,
  XCircle,
  Cpu,
  ArrowRight,
  History,
  Receipt,
  ShieldCheck,
  Building2,
  DollarSign,
  RefreshCw,
  Send,
  ExternalLink,
  ArrowUpRight,
  Copy,
  Check,
  Tag
} from 'lucide-react';

export const AdminOverview = () => {
  const navigate = useNavigate();
  const { assets, auditLogs, transactions, fetchAssets, isLoading } = useAssets();

  const [onChainOwners, setOnChainOwners] = useState({});
  const [isRefreshingChain, setIsRefreshingChain] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState({});

  const copyToClipboard = (addr, id) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddr((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedAddr((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Filter tokenized assets
  const tokenizedAssets = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'TOKENIZED' || a.isTokenized || (a.tokenId && String(a.tokenId) !== '0');
  });

  // Query live on-chain NFT ownership for each token directly from Ethereum Sepolia
  const fetchLiveOwners = useCallback(async () => {
    if (tokenizedAssets.length === 0) return;
    setIsRefreshingChain(true);
    try {
      const provider = getPublicSepoliaProvider();
      const tokenContract = new ethers.Contract(
        TOKEN_CONTRACT_ADDRESS,
        ['function ownerOf(uint256 tokenId) view returns (address)'],
        provider
      );
      const map = {};
      await Promise.all(
        tokenizedAssets.map(async (a) => {
          const tId = a.tokenId || '1';
          try {
            const liveOwner = await tokenContract.ownerOf(tId);
            map[tId] = liveOwner;
          } catch (err) {
            console.warn(`Could not fetch live owner for token #${tId}:`, err.message);
          }
        })
      );
      setOnChainOwners(map);
    } catch (err) {
      console.warn('Admin on-chain owner check notice:', err.message);
    } finally {
      setIsRefreshingChain(false);
    }
  }, [tokenizedAssets]);

  useEffect(() => {
    fetchLiveOwners();
  }, [assets]);

  // Metrics derived strictly from real database records with normalized statuses
  const pendingCount = assets.filter((a) => getEffectiveAssetStatus(a) === 'PENDING_REVIEW').length;
  const underReviewCount = assets.filter((a) => getEffectiveAssetStatus(a) === 'UNDER_REVIEW').length;
  const approvedCount = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'APPROVED' || s === 'TOKENIZED';
  }).length;
  const rejectedCount = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'REJECTED' || s === 'MORE_INFO_REQUESTED';
  }).length;
  const tokenizedCount = tokenizedAssets.length;

  // On-chain transfer transactions count
  const transferCount = transactions.filter((t) => {
    const typeStr = (t.type || t.transaction_type || '').toLowerCase();
    return typeStr.includes('transfer') || typeStr.includes('purchase');
  }).length;

  const totalAppraisedValuation = assets.reduce((sum, a) => sum + (Number(a.valuation) || 0), 0);

  const recentAudit = auditLogs.slice(0, 5);
  const recentTx = transactions.slice(0, 5);

  return (
    <div style={{ paddingBottom: '60px' }}>
      {/* Header with Call to Action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--color-copper, #B9653A)'
              }}
            >
              Institutional Supervisory Suite
            </span>
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 600,
              color: 'var(--color-navy, #13243C)',
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              margin: '0 0 8px 0'
            }}
          >
            Compliance & Protocol Executive Console
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text, #64748B)', margin: 0, lineHeight: 1.5 }}>
            Live asset audit pipeline statistics, verifier queue workloads, and immutable blockchain settlement telemetry.
          </p>
        </div>

        <button
          onClick={() => navigate('/admin/pending')}
          style={{
            backgroundColor: 'var(--color-copper, #B9653A)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '9999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(185, 101, 58, 0.25)',
            transition: 'all 0.2s ease'
          }}
        >
          <span>Review Pending Dossiers</span>
          <ArrowRight size={15} />
        </button>
      </div>

      {/* 5 Admin Summary Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
          marginBottom: '30px'
        }}
      >
        <MetricCard
          title="Pending Submissions"
          value={`${pendingCount}`}
          subtext="Awaiting preliminary review"
          icon={Clock}
          variant="peach"
        />

        <MetricCard
          title="Under Review"
          value={`${underReviewCount}`}
          subtext="Active auditor evaluation"
          icon={FileSearch}
          variant="lavender"
        />

        <MetricCard
          title="Approved Assets"
          value={`${approvedCount}`}
          indicator={{ text: 'Verified', isPositive: true }}
          subtext="Eligible for tokenization"
          icon={CheckCircle2}
          variant="mint"
        />

        <MetricCard
          title="Returned / Rejected"
          value={`${rejectedCount}`}
          subtext="Clarification required"
          icon={XCircle}
          variant="white"
        />

        <MetricCard
          title="Tokenized On-Chain"
          value={`${tokenizedCount}`}
          indicator={{ text: 'Live ERC-721', isPositive: true }}
          subtext="Minted on Sepolia"
          icon={Cpu}
          variant="navy"
        />

        <MetricCard
          title="On-Chain Transfers"
          value={`${transferCount}`}
          indicator={{ text: 'Sepolia EVM', isPositive: true }}
          subtext="Recorded on ledger"
          icon={Send}
          variant="peach"
        />
      </div>

      {/* Institutional Valuation Banner */}
      <div
        style={{
          padding: '24px 28px',
          marginBottom: '32px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '18px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-mint-light, #DDF5EE)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1E6F5C'
            }}
          >
            <DollarSign size={24} />
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text, #64748B)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
              Total Audited Registry Pipeline Valuation
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginTop: '2px' }}>
              {formatCurrency(totalAppraisedValuation, 'USD')}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => navigate('/admin/approved')}
            style={{
              backgroundColor: '#F8FAFC',
              color: 'var(--color-navy, #13243C)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              padding: '10px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Approved Registry
          </button>
          <button
            onClick={() => navigate('/admin/token-owners')}
            style={{
              backgroundColor: '#F8FAFC',
              color: 'var(--color-navy, #13243C)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              padding: '10px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Token Owners
          </button>
          <button
            onClick={() => navigate('/admin/audit-logs')}
            style={{
              backgroundColor: '#F8FAFC',
              color: 'var(--color-navy, #13243C)',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              padding: '10px 20px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            Audit Trail
          </button>
        </div>
      </div>

      {/* Live On-Chain Token Ownership & Transfer Telemetry */}
      <div
        style={{
          padding: '28px',
          marginBottom: '32px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))',
          border: '1px solid rgba(19, 36, 60, 0.05)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-copper, #B9653A)'
              }}
            >
              <Cpu size={20} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                Blockchain Token Ownership & Transfer Telemetry
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--color-secondary-text, #64748B)', margin: '3px 0 0' }}>
                Real-time cryptographic verification from Ethereum Sepolia smart contract ({TOKEN_CONTRACT_ADDRESS.slice(0, 6)}...{TOKEN_CONTRACT_ADDRESS.slice(-4)})
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              onClick={() => {
                fetchAssets();
                fetchLiveOwners();
              }}
              disabled={isRefreshingChain}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '9999px',
                backgroundColor: '#F8FAFC',
                border: '1px solid rgba(19, 36, 60, 0.1)',
                color: 'var(--color-navy, #13243C)',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={isRefreshingChain ? 'spin' : ''} />
              <span>{isRefreshingChain ? 'Syncing...' : 'Sync Blockchain'}</span>
            </button>
            <Link
              to="/admin/token-owners"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-copper, #B9653A)',
                color: '#FFFFFF',
                fontSize: '12px',
                fontWeight: 600,
                textDecoration: 'none'
              }}
            >
              <span>Full Token Ledger</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {tokenizedAssets.length === 0 ? (
          <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: '13.5px' }}>
            No tokens minted on Ethereum Sepolia yet. Once an asset is tokenized or transferred, live cryptographic ownership telemetry will appear here.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', minWidth: '780px' }}>
              <thead>
                <tr>
                  <th style={{ minWidth: '180px', whiteSpace: 'nowrap' }}>Token ID & Asset</th>
                  <th style={{ minWidth: '160px', whiteSpace: 'nowrap' }}>Authoritative On-Chain Owner</th>
                  <th style={{ minWidth: '140px', whiteSpace: 'nowrap' }}>Originating Custodian</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Ownership State</th>
                  <th style={{ minWidth: '120px', whiteSpace: 'nowrap' }}>Valuation</th>
                  <th style={{ textAlign: 'right', minWidth: '140px' }}>Network Telemetry</th>
                </tr>
              </thead>
              <tbody>
                {tokenizedAssets.map((asset) => {
                  const tId = asset.tokenId || '1';
                  const liveOwner = onChainOwners[tId] || asset.currentOwnerAddress || asset.ownerAddress || asset.owner || '0x0000000000000000000000000000000000000000';
                  const origOwner = asset.ownerAddress || asset.originalOwnerAddress || '';
                  const isTransferred = Boolean(origOwner && liveOwner && origOwner.toLowerCase() !== liveOwner.toLowerCase());

                  return (
                    <tr key={asset.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                              color: 'var(--color-copper, #B9653A)',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            #{tId}
                          </span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-navy, #13243C)', fontSize: '13.5px' }}>
                              {asset.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                              {asset.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 600, color: 'var(--color-navy, #13243C)' }}>
                            {liveOwner.slice(0, 6)}...{liveOwner.slice(-4)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(liveOwner, asset.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-secondary-text)' }}
                            title="Copy Owner Address"
                          >
                            {copiedAddr[asset.id] ? <Check size={12} style={{ color: '#166534' }} /> : <Copy size={12} />}
                          </button>
                          <a
                            href={getEtherscanAddressUrl(liveOwner)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center' }}
                            title="View on Sepolia Etherscan"
                          >
                            <ExternalLink size={12} />
                          </a>
                        </div>
                        {onChainOwners[tId] && (
                          <div style={{ fontSize: '10.5px', color: '#166534', fontWeight: 600, marginTop: '2px' }}>
                            ✓ Verified via Sepolia ownerOf()
                          </div>
                        )}
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                        {origOwner ? `${origOwner.slice(0, 6)}...${origOwner.slice(-4)}` : 'Platform Custodian'}
                      </td>

                      <td>
                        {isTransferred ? (
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              backgroundColor: '#EFF6FF',
                              color: '#1D4ED8',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Send size={11} />
                            <span>Transferred to Investor</span>
                          </span>
                        ) : (
                          <span
                            style={{
                              padding: '3px 10px',
                              borderRadius: '9999px',
                              backgroundColor: '#F3F4F6',
                              color: '#4B5563',
                              fontSize: '11px',
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <ShieldCheck size={11} />
                            <span>Originating Custody</span>
                          </span>
                        )}
                      </td>

                      <td style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-navy, #13243C)' }}>
                        {formatCurrency(asset.valuation, asset.currency || 'INR')}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        {asset.transactionHash ? (
                          <a
                            href={getEtherscanTxUrl(asset.transactionHash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              color: 'var(--color-copper, #B9653A)',
                              fontFamily: 'monospace',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}
                          >
                            <span>{asset.transactionHash.slice(0, 8)}...{asset.transactionHash.slice(-6)}</span>
                            <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)' }}>
                            Sepolia Testnet
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Two Column Layout: Recent Review Activity & Recent Ledger Transactions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '26px' }}>
        {/* Recent Audit Activity */}
        <div
          style={{
            padding: '28px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-copper)'
                }}
              >
                <History size={16} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                Recent Review Actions
              </h3>
            </div>
            <Link to="/admin/audit-logs" style={{ fontSize: '12.5px', color: 'var(--color-copper, #B9653A)', fontWeight: 600, textDecoration: 'none' }}>
              Full Audit Trail →
            </Link>
          </div>

          {recentAudit.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: '13px' }}>
              No audit records recorded yet. All compliance actions will be tracked here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentAudit.map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '18px',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          backgroundColor: log.action === 'APPROVED' ? 'var(--color-mint-light, #DDF5EE)' : log.action === 'REJECTED' ? 'rgba(239, 68, 68, 0.1)' : 'var(--color-peach-light, #FFF0E6)',
                          color: log.action === 'APPROVED' ? '#1E6F5C' : log.action === 'REJECTED' ? 'var(--color-error)' : 'var(--color-copper)'
                        }}
                      >
                        {log.action}
                      </span>
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', fontFamily: 'monospace' }}>
                        {log.assetId}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)' }}>
                      {log.notes || 'Compliance status updated by administrator.'}
                    </div>
                  </div>

                  <span style={{ fontSize: '11px', color: 'var(--color-secondary-text)', whiteSpace: 'nowrap', fontWeight: 500 }}>
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Ledger Events */}
        <div
          style={{
            padding: '28px',
            backgroundColor: '#FFFFFF',
            borderRadius: '26px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0,0,0,0.04))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#1E6F5C'
                }}
              >
                <Receipt size={16} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 600, color: 'var(--color-navy, #13243C)', margin: 0 }}>
                Recent Settlement Events
              </h3>
            </div>
            <Link to="/admin/token-owners" style={{ fontSize: '12.5px', color: 'var(--color-copper, #B9653A)', fontWeight: 600, textDecoration: 'none' }}>
              Token Owners Ledger →
            </Link>
          </div>

          {recentTx.length === 0 ? (
            <div style={{ padding: '36px 16px', textAlign: 'center', color: 'var(--color-secondary-text)', fontSize: '13px' }}>
              No settlement transactions recorded in this session.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentTx.map((tx) => (
                <div
                  key={tx.id || tx.hash}
                  style={{
                    padding: '14px 18px',
                    borderRadius: '18px',
                    backgroundColor: '#F8FAFC',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-navy, #13243C)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{tx.type}</span>
                      {tx.tokenId && (
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'var(--color-peach-light, #FFF0E6)', color: 'var(--color-copper, #B9653A)' }}>
                          #{tx.tokenId}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                      {tx.assetName || tx.assetId}
                      {tx.hash && (
                        <>
                          {' • '}
                          <a
                            href={getEtherscanTxUrl(tx.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-copper, #B9653A)', textDecoration: 'none' }}
                          >
                            {tx.hash.slice(0, 10)}...{tx.hash.slice(-6)} ↗
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                      color: '#1E6F5C'
                    }}
                  >
                    {tx.status || 'CONFIRMED'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminOverview;
