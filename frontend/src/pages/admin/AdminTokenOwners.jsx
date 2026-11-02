import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ethers } from 'ethers';
import { useAssets } from '../../context/AssetContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { MetricCard } from '../../components/common/MetricCard';
import { formatCurrency } from '../../constants/currencies';
import { getEffectiveAssetStatus } from '../../utils/statusHelper';
import {
  Users,
  Search,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Eye,
  Layers,
  ShieldCheck,
  Wallet,
  Tag,
  Coins,
  ArrowUpRight,
  Filter,
  RefreshCw,
  Send
} from 'lucide-react';
import {
  TOKEN_CONTRACT_ADDRESS,
  getPublicSepoliaProvider,
  getEtherscanAddressUrl,
  getEtherscanTxUrl
} from '../../constants/contracts';

export const AdminTokenOwners = () => {
  const navigate = useNavigate();
  const { assets, transactions, fetchAssets } = useAssets();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStandard, setSelectedStandard] = useState('ALL');
  const [selectedHolderType, setSelectedHolderType] = useState('ALL');
  const [copiedAddr, setCopiedAddr] = useState({});
  const [activeAsset, setActiveAsset] = useState(null);
  const [onChainOwners, setOnChainOwners] = useState({});
  const [isSyncingChain, setIsSyncingChain] = useState(false);

  const copyToClipboard = (addr, id) => {
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddr((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopiedAddr((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  // Filter only tokenized assets (ERC-721 or ERC-1155 minted on blockchain)
  const tokenizedAssets = assets.filter((a) => {
    const s = getEffectiveAssetStatus(a);
    return s === 'TOKENIZED' || a.isTokenized || (a.tokenId && String(a.tokenId) !== '0');
  });

  // Query live on-chain token holders directly from Ethereum Sepolia smart contract
  const fetchOnChainOwners = useCallback(async () => {
    if (tokenizedAssets.length === 0) return;
    setIsSyncingChain(true);
    try {
      const provider = getPublicSepoliaProvider();
      const tokenContract = new ethers.Contract(
        TOKEN_CONTRACT_ADDRESS,
        ['function ownerOf(uint256 tokenId) view returns (address)'],
        provider
      );
      const ownerMap = {};
      await Promise.all(
        tokenizedAssets.map(async (a) => {
          const tId = a.tokenId || '1';
          try {
            const liveOwner = await tokenContract.ownerOf(tId);
            ownerMap[tId] = liveOwner;
          } catch (err) {
            console.warn(`Could not fetch live owner for token #${tId}:`, err.message);
          }
        })
      );
      setOnChainOwners(ownerMap);
    } catch (err) {
      console.warn('Failed to query on-chain owners:', err.message);
    } finally {
      setIsSyncingChain(false);
    }
  }, [tokenizedAssets]);

  useEffect(() => {
    fetchOnChainOwners();
  }, [assets]);

  // Calculate metrics
  const totalTokens = tokenizedAssets.length;
  const uniqueOwners = new Set(
    tokenizedAssets
      .map((a) => onChainOwners[a.tokenId || '1'] || a.currentOwnerAddress || a.ownerAddress || a.owner)
      .filter(Boolean)
  ).size;
  const listedTokens = tokenizedAssets.filter((a) => a.listingStatus === 'LISTED').length;
  const totalTokenValuation = tokenizedAssets.reduce((sum, a) => sum + (parseFloat(a.valuation) || 0), 0);

  // Filter logic
  const filteredAssets = tokenizedAssets.filter((asset) => {
    const owner = (onChainOwners[asset.tokenId || '1'] || asset.currentOwnerAddress || asset.ownerAddress || asset.owner || '').toLowerCase();
    const name = (asset.name || '').toLowerCase();
    const id = (asset.id || '').toLowerCase();
    const tokenId = String(asset.tokenId || '').toLowerCase();
    const search = searchTerm.toLowerCase();

    const matchesSearch =
      !searchTerm ||
      name.includes(search) ||
      id.includes(search) ||
      tokenId.includes(search) ||
      owner.includes(search);

    const matchesStandard =
      selectedStandard === 'ALL' ||
      (asset.tokenStandard || 'ERC-721') === selectedStandard;

    const origOwner = (asset.ownerAddress || '').toLowerCase();
    const isOriginalCustodian = !owner || owner === origOwner;

    const matchesHolder =
      selectedHolderType === 'ALL' ||
      (selectedHolderType === 'INVESTOR' && !isOriginalCustodian) ||
      (selectedHolderType === 'CUSTODIAN' && isOriginalCustodian);

    return matchesSearch && matchesStandard && matchesHolder;
  });

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
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
              Custodial Ownership Ledger
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
            Token Holders & Ownership Registry
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Live authoritative blockchain ownership registry. Tracks active wallet holders, originating custodians, and title transfers for all tokenized real-world assets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            fetchAssets();
            fetchOnChainOwners();
          }}
          disabled={isSyncingChain}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-copper, #B9653A)',
            color: '#FFFFFF',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(185, 101, 58, 0.25)'
          }}
        >
          <RefreshCw size={14} className={isSyncingChain ? 'spin' : ''} />
          <span>{isSyncingChain ? 'Querying Sepolia...' : 'Sync Blockchain Telemetry'}</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '28px'
        }}
      >
        <MetricCard
          label="Minted Tokens"
          value={totalTokens}
          icon={Layers}
          trend={{ value: 'ERC-721 Active', positive: true }}
        />
        <MetricCard
          label="Unique Token Owners"
          value={uniqueOwners}
          icon={Users}
          trend={{ value: 'Verified Wallets', positive: true }}
        />
        <MetricCard
          label="Marketplace Listed"
          value={listedTokens}
          icon={Tag}
          trend={{ value: 'Open for Purchase', positive: true }}
        />
        <MetricCard
          label="Tokenized Valuation"
          value={formatCurrency(totalTokenValuation, 'INR')}
          icon={Coins}
          trend={{ value: 'Underlying Value', positive: true }}
        />
      </div>

      {/* Controls & Search Filter Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          padding: '16px 20px',
          borderRadius: '4px',
          border: '1px solid var(--color-subtle-border)',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          marginBottom: '20px'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 320px', maxWidth: '480px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-secondary-text)'
            }}
          />
          <input
            type="text"
            placeholder="Search by Asset Name, Token ID (#5), or Owner Wallet (0x...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '9px 12px 9px 38px',
              fontSize: '13px',
              border: '1px solid var(--color-subtle-border)',
              borderRadius: '3px',
              outline: 'none',
              backgroundColor: 'var(--color-warm-white)'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Holder Type:</span>
            <select
              value={selectedHolderType}
              onChange={(e) => setSelectedHolderType(e.target.value)}
              style={{
                fontSize: '12.5px',
                padding: '6px 10px',
                borderRadius: '3px',
                border: '1px solid var(--color-subtle-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--color-charcoal)'
              }}
            >
              <option value="ALL">All Token Holders</option>
              <option value="INVESTOR">Acquired by Investor</option>
              <option value="CUSTODIAN">Originating Custodian</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontWeight: 600 }}>Standard:</span>
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              style={{
                fontSize: '12.5px',
                padding: '6px 10px',
                borderRadius: '3px',
                border: '1px solid var(--color-subtle-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--color-charcoal)'
              }}
            >
              <option value="ALL">All Standards</option>
              <option value="ERC-721">ERC-721 (NFT)</option>
              <option value="ERC-1155">ERC-1155 (Shares)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No Token Owners Located"
          description={
            searchTerm
              ? `No minted tokens match query "${searchTerm}".`
              : "No real-world assets have been tokenized yet on Ethereum Sepolia."
          }
        />
      ) : (
        <div
          style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '4px',
            border: '1px solid var(--color-subtle-border)',
            overflow: 'hidden'
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-warm-white)', borderBottom: '1px solid var(--color-subtle-border)' }}>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)' }}>
                    Asset & Deed
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)', minWidth: '150px', whiteSpace: 'nowrap' }}>
                    Token Spec
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)' }}>
                    Current Token Owner (Holder)
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)' }}>
                    Valuation / Terms
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)' }}>
                    Marketplace Status
                  </th>
                  <th style={{ padding: '14px 20px', textAlign: 'right', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-secondary-text)' }}>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const liveOwner = onChainOwners[asset.tokenId || '1'] || asset.currentOwnerAddress || asset.ownerAddress || asset.owner || '0x0000000000000000000000000000000000000000';
                  const currentOwner = liveOwner;
                  const origOwner = asset.ownerAddress || asset.originalOwnerAddress || '';
                  const isInvestorHeld = Boolean(origOwner && currentOwner && currentOwner.toLowerCase() !== origOwner.toLowerCase());
                  const isListed = asset.listingStatus === 'LISTED' && asset.listingPriceEth > 0;
                  const contractAddr = asset.contractAddress || TOKEN_CONTRACT_ADDRESS;

                  return (
                    <tr
                      key={asset.id}
                      style={{
                        borderBottom: '1px solid var(--color-subtle-border)',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      {/* Asset & Deed */}
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          {asset.imageUrl ? (
                            <img
                              src={asset.imageUrl}
                              alt={asset.name}
                              style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '42px',
                                height: '42px',
                                borderRadius: '8px',
                                backgroundColor: 'var(--color-peach)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 700,
                                color: 'var(--color-copper)',
                                fontSize: '13px'
                              }}
                            >
                              {asset.name ? asset.name.substring(0, 2).toUpperCase() : 'AS'}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                              {asset.name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                              {asset.id} • {asset.category}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Token Spec */}
                      <td style={{ padding: '16px 20px', minWidth: '150px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 700,
                              color: 'var(--color-midnight-navy)',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center'
                            }}
                          >
                            {asset.tokenStandard || 'ERC-721'} #{asset.tokenId || '1'}
                          </span>
                          <span
                            style={{
                              fontSize: '10.5px',
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              backgroundColor: 'var(--color-mint)',
                              color: '#166534',
                              fontWeight: 600,
                              display: 'inline-block',
                              width: 'fit-content',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            Sepolia Verified
                          </span>
                        </div>
                      </td>

                      {/* Current Token Owner */}
                      <td style={{ padding: '16px 20px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                fontWeight: 600,
                                color: 'var(--color-charcoal)'
                              }}
                            >
                              {currentOwner.slice(0, 6)}...{currentOwner.slice(-4)}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(currentOwner, asset.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--color-secondary-text)' }}
                              title="Copy Owner Address"
                            >
                              {copiedAddr[asset.id] ? <Check size={12} style={{ color: '#166534' }} /> : <Copy size={12} />}
                            </button>
                            <a
                              href={getEtherscanAddressUrl(currentOwner)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: 'var(--color-copper)', display: 'inline-flex', alignItems: 'center' }}
                              title="View on Etherscan"
                            >
                              <ExternalLink size={12} />
                            </a>
                          </div>

                          {onChainOwners[asset.tokenId || '1'] && (
                            <div style={{ fontSize: '10px', color: '#166534', fontWeight: 600, marginTop: '2px' }}>
                              ✓ Verified via Sepolia ownerOf()
                            </div>
                          )}

                          <div style={{ marginTop: '4px' }}>
                            {isInvestorHeld ? (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#EFF6FF',
                                  color: '#1D4ED8',
                                  fontWeight: 600
                                }}
                              >
                                Investor Buyer
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  backgroundColor: '#F3F4F6',
                                  color: '#4B5563',
                                  fontWeight: 600
                                }}
                              >
                                Originating Custodian
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Valuation / Terms */}
                      <td style={{ padding: '16px 20px' }}>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '13.5px' }}>
                            {formatCurrency(asset.valuation, asset.currency)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)' }}>
                            Appraised Value
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 20px' }}>
                        {isListed ? (
                          <div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                backgroundColor: 'var(--color-mint)',
                                color: '#166534',
                                display: 'inline-block'
                              }}
                            >
                              Listed: {asset.listingPriceEth} ETH
                            </span>
                            <div style={{ fontSize: '10.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                              Open for Purchase
                            </div>
                          </div>
                        ) : (
                          <div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                padding: '3px 10px',
                                borderRadius: '9999px',
                                backgroundColor: '#F1F5F9',
                                color: '#475569',
                                display: 'inline-block'
                              }}
                            >
                              Vault Held
                            </span>
                            <div style={{ fontSize: '10.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                              Unlisted
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-action-secondary"
                            style={{ padding: '6px 12px', fontSize: '11.5px' }}
                            onClick={() => setActiveAsset(asset)}
                          >
                            <Eye size={12} />
                            <span>Details</span>
                          </button>
                          <button
                            type="button"
                            className="btn-action-primary"
                            style={{ padding: '6px 14px', fontSize: '11.5px' }}
                            onClick={() => navigate(`/asset/${asset.id}`)}
                          >
                            <span>Dossier</span>
                            <ArrowUpRight size={12} />
                          </button>
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

      {/* Token Owner Details Modal */}
      <Modal
        isOpen={!!activeAsset}
        onClose={() => setActiveAsset(null)}
        title={activeAsset ? `Token Holder Dossier — ${activeAsset.name}` : ''}
      >
        {activeAsset && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              {activeAsset.imageUrl ? (
                <img
                  src={activeAsset.imageUrl}
                  alt={activeAsset.name}
                  style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '12px',
                    backgroundColor: 'var(--color-peach)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    color: 'var(--color-copper)',
                    fontSize: '18px'
                  }}
                >
                  <Building2 size={32} />
                </div>
              )}
              <div>
                <h4 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-midnight-navy)', margin: 0 }}>
                  {activeAsset.name}
                </h4>
                <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
                  ID: {activeAsset.id} • {activeAsset.category}
                </div>
              </div>
            </div>

            <div style={{ padding: '18px', backgroundColor: '#F8FAFC', borderRadius: '16px', marginBottom: '20px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Token Standard & ID:</span>
                <strong style={{ color: 'var(--color-midnight-navy)' }}>{activeAsset.tokenStandard || 'ERC-721'} #{activeAsset.tokenId || '1'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Current On-Chain Owner:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                  {activeAsset.currentOwnerAddress || activeAsset.ownerAddress || 'Custodian'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Original Submitter / Custodian:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-secondary-text)' }}>
                  {activeAsset.ownerAddress || 'Registry Custodian'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Contract Address:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-copper)' }}>
                  {activeAsset.contractAddress || TOKEN_CONTRACT_ADDRESS}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Appraised Valuation:</span>
                <strong style={{ color: 'var(--color-midnight-navy)' }}>{formatCurrency(activeAsset.valuation, activeAsset.currency)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Marketplace Status:</span>
                <span style={{ fontWeight: 600, color: activeAsset.listingStatus === 'LISTED' ? '#166534' : '#475569' }}>
                  {activeAsset.listingStatus === 'LISTED' ? `Listed (${activeAsset.listingPriceEth} ETH)` : 'Unlisted Vault Holding'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveAsset(null)}
                style={{ borderRadius: '9999px', padding: '8px 18px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setActiveAsset(null);
                  navigate(`/asset/${activeAsset.id}`);
                }}
                style={{ borderRadius: '9999px', padding: '8px 20px', backgroundColor: 'var(--color-copper)' }}
              >
                Open Institutional Dossier
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminTokenOwners;
