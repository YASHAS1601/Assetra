import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { downloadReceiptPdf, openReceiptPdfInNewTab } from '../../utils/receiptPdfGenerator';
import { getEtherscanTxUrl, getEtherscanAddressUrl } from '../../constants/contracts';
import {
  FileText,
  Download,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  Printer,
  Share2
} from 'lucide-react';

export const ReceiptModal = ({ isOpen, onClose, receipt, asset }) => {
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedReceiptNo, setCopiedReceiptNo] = useState(false);

  if (!receipt) return null;

  const receiptData = {
    receiptNumber: receipt.receipt_number || receipt.receiptNumber,
    assetId: receipt.asset_id || receipt.assetId || asset?.id,
    assetName: receipt.asset_name || receipt.assetName || asset?.name || 'Tokenized Asset',
    category: asset?.category || 'Commercial Real Estate',
    location: asset?.location || 'Registered Jurisdiction',
    valuation: asset?.valuation ? `${asset.valuation} ${asset.currency || 'USD'}` : 'Appraised Asset',
    custodian: asset?.custodian || 'Delaware Statutory Trust',
    tokenId: receipt.token_id || receipt.tokenId || asset?.tokenId || '1',
    tokenContract: receipt.token_contract || receipt.tokenContract || asset?.contractAddress,
    marketplaceContract: receipt.marketplace_contract || receipt.marketplaceContract || asset?.marketplaceContractAddress,
    buyerWallet: receipt.buyer_wallet || receipt.buyerWallet,
    sellerWallet: receipt.seller_wallet || receipt.sellerWallet || asset?.currentOwnerAddress || '0x...',
    priceEth: String(receipt.price_eth || receipt.priceEth || asset?.listingPriceEth || '1.0'),
    currency: receipt.currency || 'ETH',
    transactionHash: receipt.transaction_hash || receipt.txHash || receipt.hash,
    blockNumber: receipt.block_number || receipt.blockNumber || 0,
    chainId: receipt.chain_id || receipt.chainId || '11155111',
    networkName: 'Ethereum Sepolia Testnet',
    gasFee: receipt.gas_fee || receipt.gasFee || '0.0050 ETH',
    timestamp: receipt.created_at || receipt.timestamp || new Date().toISOString()
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === 'hash') {
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    } else {
      setCopiedReceiptNo(true);
      setTimeout(() => setCopiedReceiptNo(false), 2000);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Settlement Proof — ${receiptData.receiptNumber}`}
      maxWidth="720px"
    >
      <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px' }}>
        {/* Certificate Banner */}
        <div
          style={{
            padding: '24px',
            background: 'linear-gradient(135deg, #101B2D 0%, #1A2F4C 100%)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
            boxShadow: 'var(--shadow-md)',
            color: '#FFFFFF'
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94A3B8', fontWeight: 600 }}>
                Official Settlement Proof
              </span>
              <span
                className="badge"
                style={{
                  fontSize: '11px',
                  backgroundColor: 'rgba(16, 185, 129, 0.2)',
                  color: '#34D399',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 10px',
                  borderRadius: 'var(--radius-pill)'
                }}
              >
                <CheckCircle2 size={12} />
                <span>Sepolia Consensus Confirmed</span>
              </span>
            </div>
            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: '26px', fontWeight: 600, color: '#FFFFFF', margin: 0 }}>
              {receiptData.receiptNumber}
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => copyToClipboard(receiptData.receiptNumber, 'number')}
              style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.2)', fontSize: '12px' }}
              title="Copy Receipt Number"
            >
              {copiedReceiptNo ? <Check size={13} style={{ color: '#34D399' }} /> : <Copy size={13} />}
              <span>{copiedReceiptNo ? 'Copied' : 'Copy ID'}</span>
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => downloadReceiptPdf(receiptData)}
              style={{ fontSize: '12px' }}
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
          </div>
        </div>

        {/* Section 1: Asset Details */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '10px' }}>
            1. Asset Dossier Specifications
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', fontSize: '13px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Asset Name</div>
              <strong style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{receiptData.assetName}</strong>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Registry ID</div>
              <code style={{ color: 'var(--color-copper)', fontWeight: 700, fontSize: '13px' }}>{receiptData.assetId}</code>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Category & Jurisdiction</div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{receiptData.category} — {receiptData.location}</span>
            </div>
          </div>
        </div>

        {/* Section 2: Financial Settlement & Token */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '10px' }}>
            2. Token Deed & Settlement Considerations
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', fontSize: '13px' }}>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-pale-peach)', border: '1px solid rgba(185, 101, 58, 0.15)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Purchase Price</div>
              <strong style={{ fontSize: '18px', color: 'var(--color-copper)', fontWeight: 700 }}>{receiptData.priceEth} {receiptData.currency}</strong>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-pale-mint)', border: '1px solid rgba(16, 185, 129, 0.15)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Deed Token ID</div>
              <strong style={{ fontSize: '15px', color: 'var(--color-success-text)', fontWeight: 700 }}>ERC-721 #{receiptData.tokenId}</strong>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Network & Block</div>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Block #{receiptData.blockNumber || 'Pending'}</span>
            </div>
            <div style={{ padding: '16px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Gas Fee Paid</div>
              <span style={{ color: 'var(--text-primary)' }}>{receiptData.gasFee}</span>
            </div>
          </div>
        </div>

        {/* Section 3: Participants */}
        <div style={{ marginBottom: '22px' }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '10px' }}>
            3. Transaction Participants
          </div>
          <div style={{ padding: '18px 20px', borderRadius: 'var(--radius-md)', backgroundColor: '#F8FAFC', border: '1px solid rgba(19, 36, 60, 0.04)', display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Buyer (New Title Holder):</span>
              <code style={{ fontWeight: 600, color: 'var(--color-copper)', wordBreak: 'break-all' }}>{receiptData.buyerWallet}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Seller (Prior Owner):</span>
              <code style={{ fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>{receiptData.sellerWallet}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Timestamp (UTC):</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{new Date(receiptData.timestamp).toUTCString()}</span>
            </div>
          </div>
        </div>

        {/* Section 4: Cryptographic Settlement Hash */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: '10px' }}>
            4. Cryptographic Proof & Ledger Audit
          </div>
          <div
            style={{
              padding: '16px 20px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--color-pale-lavender)',
              border: '1px solid rgba(99, 102, 241, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div>
              <div style={{ fontSize: '11px', color: '#4338CA', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Transaction Hash
              </div>
              <code style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                {receiptData.transactionHash || 'On-Chain Receipt Registered'}
              </code>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {receiptData.transactionHash && (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => copyToClipboard(receiptData.transactionHash, 'hash')}
                    style={{ backgroundColor: '#FFFFFF', padding: '6px 12px' }}
                  >
                    {copiedHash ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                    <span>{copiedHash ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={getEtherscanTxUrl(receiptData.transactionHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ backgroundColor: '#FFFFFF', padding: '6px 12px' }}
                  >
                    <span>Sepolia Explorer</span>
                    <ExternalLink size={12} />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReceiptModal;
