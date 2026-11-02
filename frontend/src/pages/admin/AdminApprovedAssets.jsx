import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssets } from '../../context/AssetContext';
import { Badge } from '../../components/common/Badge';
import { Modal } from '../../components/common/Modal';
import { EmptyState } from '../../components/common/EmptyState';
import { formatCurrency } from '../../constants/currencies';
import { getEffectiveAssetStatus } from '../../utils/statusHelper';
import { ethers } from 'ethers';
import {
  REGISTRY_CONTRACT_ADDRESS,
  ASSET_REGISTRY_ABI
} from '../../constants/contracts';
import {
  CheckCircle2,
  Search,
  ExternalLink,
  FileText,
  ShieldCheck,
  Building2,
  ArrowRight,
  Layers,
  Clock,
  Eye
} from 'lucide-react';

export const AdminApprovedAssets = () => {
  const navigate = useNavigate();
  const { assets } = useAssets();

  const [searchTerm, setSearchTerm] = useState('');
  const [activeAsset, setActiveAsset] = useState(null);

  // Filter only assets that have been verified and approved in Supabase
  const approvedAssets = assets.filter((a) => {
    const status = getEffectiveAssetStatus(a);
    return status === 'APPROVED' || status === 'TOKENIZED';
  });

  const filteredAssets = approvedAssets.filter((asset) => {
    return (
      !searchTerm ||
      (asset.name && asset.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.id && asset.id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.category && asset.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (asset.location && asset.location.toLowerCase().includes(searchTerm.toLowerCase()))
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
                color: 'var(--color-copper)'
              }}
            >
              Verified Registry
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
            Approved Real-World Asset Registry
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Institutional real-world assets with confirmed compliance verification, audited appraisal certificates, and tokenization eligibility.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/admin/pending')}
          className="btn-action-primary"
          style={{ padding: '10px 22px', fontSize: '13px' }}
        >
          <Clock size={15} />
          <span>Pending Review Queue</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
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
            placeholder="Search approved assets by name, ID, location..."
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
          Showing <strong style={{ color: 'var(--color-charcoal)' }}>{filteredAssets.length}</strong> verified registry records
        </div>
      </div>

      {/* Table View */}
      {filteredAssets.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No Approved Assets in Registry"
          description="When you approve submissions in Pending Asset Reviews, they will appear here and become eligible for Explore Assets and tokenization."
        />
      ) : (
        <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Asset Title & Identifier</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Category</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Audited Valuation</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Approval Date</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Reviewing Auditor</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', minWidth: '160px', whiteSpace: 'nowrap' }}>Tokenization Status</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Current Token Owner</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map((asset) => {
                  const isTokenized = asset.tokenStatus === 'TOKENIZED' || asset.status === 'TOKENIZED';

                  return (
                    <tr key={asset.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                      <td style={{ padding: '18px 20px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                          {asset.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '2px' }}>
                          {asset.id} • {asset.location || 'Global Custody'}
                        </div>
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)' }}>
                        {asset.category}
                      </td>

                      <td style={{ padding: '18px 20px', fontWeight: 600, color: 'var(--color-charcoal)', fontSize: '14px' }}>
                        {formatCurrency(asset.valuation, asset.currency)}
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-secondary-text)' }}>
                        {asset.approvedAt ? new Date(asset.approvedAt).toLocaleDateString() : 'Verified'}
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '12px', color: 'var(--color-secondary-text)', fontFamily: 'monospace' }}>
                        {asset.verifierAddress ? `${asset.verifierAddress.slice(0, 6)}...${asset.verifierAddress.slice(-4)}` : 'Admin Office'}
                      </td>

                      <td style={{ padding: '18px 20px', minWidth: '160px', whiteSpace: 'nowrap' }}>
                        {isTokenized ? (
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '5px 12px',
                              borderRadius: '9999px',
                              backgroundColor: 'var(--color-mint)',
                              color: '#1B6A4C',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              gap: '5px'
                            }}
                          >
                            <CheckCircle2 size={13} />
                            ERC-721 MINTED
                          </span>
                        ) : (
                          <span
                            style={{
                              fontSize: '11.5px',
                              fontWeight: 600,
                              padding: '5px 12px',
                              borderRadius: '9999px',
                              backgroundColor: 'var(--color-peach)',
                              color: '#B9653A',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              gap: '5px'
                            }}
                          >
                            <ShieldCheck size={13} />
                            ELIGIBLE TO MINT
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '18px 20px', fontSize: '12.5px' }}>
                        {isTokenized ? (
                          <div>
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                              {(asset.currentOwnerAddress || asset.ownerAddress || '0x0000...0000').slice(0, 6)}...{(asset.currentOwnerAddress || asset.ownerAddress || '0x0000...0000').slice(-4)}
                            </span>
                            <div style={{ fontSize: '11px', color: 'var(--color-copper)', fontWeight: 600 }}>
                              Token #{asset.tokenId || '1'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--color-secondary-text)', fontSize: '12px' }}>Unminted</span>
                        )}
                      </td>

                      <td style={{ padding: '18px 20px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '8px' }}>
                          <button
                            type="button"
                            className="btn-action-secondary"
                            style={{ padding: '6px 14px', fontSize: '12px' }}
                            onClick={() => setActiveAsset(asset)}
                          >
                            <span>Dossier</span>
                          </button>

                          <button
                            type="button"
                            className="btn-action-primary"
                            style={{ padding: '6px 16px', fontSize: '12px' }}
                            onClick={() => setActiveAsset(asset)}
                          >
                            <Eye size={13} />
                            <span>View Details</span>
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

      {/* Asset Dossier Modal */}
      <Modal
        isOpen={!!activeAsset}
        onClose={() => setActiveAsset(null)}
        title="Approved Asset Dossier"
      >
        {activeAsset && (
          <div>
            <div style={{ marginBottom: '20px' }}>
              <h4 className="font-serif" style={{ fontSize: '24px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
                {activeAsset.name}
              </h4>
              <p style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', fontFamily: 'monospace', marginTop: '4px' }}>
                Registry Record: {activeAsset.id}
              </p>
            </div>

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
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-charcoal)', marginTop: '2px' }}>
                  {formatCurrency(activeAsset.valuation, activeAsset.currency)}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Compliance Status
                </div>
                <div style={{ marginTop: '6px' }}>
                  <Badge status="APPROVED" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13.5px', marginBottom: '24px', backgroundColor: '#F8FAFC', padding: '18px 22px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Category & Classification:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{activeAsset.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Custodial Jurisdiction:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{activeAsset.location || 'Global Custody'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Custodial / Valuation Firm:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>{activeAsset.custodian || 'Accredited Appraiser'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Public Metadata URI:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-copper)', fontWeight: 500 }}>
                  {activeAsset.ipfsHash && activeAsset.ipfsHash.startsWith('http')
                    ? activeAsset.ipfsHash
                    : `https://assetra.io/api/metadata/${activeAsset.id}`}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setActiveAsset(null)}
                className="btn-action-primary"
                style={{ padding: '9px 24px', fontSize: '13px' }}
              >
                Close Dossier
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminApprovedAssets;
