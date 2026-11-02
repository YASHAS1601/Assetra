import React, { useState, useMemo } from 'react';
import { useAssets } from '../context/AssetContext';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Search,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
  XCircle,
  FileText
} from 'lucide-react';

export const Transactions = () => {
  const { transactions } = useAssets();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [copiedHash, setCopiedHash] = useState('');
  const [activeTx, setActiveTx] = useState(null);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const hashStr = tx.hash || tx.txHash || '';
      const nameStr = tx.assetName || '';
      const typeStr = tx.type || '';

      const matchesSearch =
        !searchTerm ||
        hashStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        nameStr.toLowerCase().includes(searchTerm.toLowerCase()) ||
        typeStr.toLowerCase().includes(searchTerm.toLowerCase());

      const statusStr = (tx.status || '').toLowerCase();
      const matchesStatus =
        selectedStatus === 'All' || statusStr === selectedStatus.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchTerm, selectedStatus]);

  const confirmedCount = transactions.filter((t) => (t.status || '').toLowerCase() === 'confirmed').length;
  const pendingCount = transactions.filter((t) => (t.status || '').toLowerCase() === 'pending').length;

  const copyHash = (hash) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(''), 2000);
  };

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '28px' }}>
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
              Institutional Settlement
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
            Audited Financial Ledger
          </h2>
          <p style={{ fontSize: '14.5px', color: 'var(--color-secondary-text)', marginTop: '6px' }}>
            Cryptographically timestamped transaction history recording smart contract deployments, registry approvals, and on-chain token purchases.
          </p>
        </div>
      </div>

      {/* Metric Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '20px',
          marginBottom: '26px'
        }}
      >
        <div
          style={{
            padding: '24px 26px',
            backgroundColor: '#FFFFFF',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
            Total Ledger Events
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-midnight-navy)', marginTop: '6px' }}>
            {transactions.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Permanent database & block records
          </div>
        </div>

        <div
          style={{
            padding: '24px 26px',
            backgroundColor: 'var(--color-mint)',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ fontSize: '11.5px', color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Confirmed On-Chain
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: '#166534', marginTop: '6px' }}>
            {confirmedCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Block confirmations verified
          </div>
        </div>

        <div
          style={{
            padding: '24px 26px',
            backgroundColor: 'var(--color-peach)',
            borderRadius: '24px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          <div style={{ fontSize: '11.5px', color: 'var(--color-copper)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
            Pending Operations
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-copper)', marginTop: '6px' }}>
            {pendingCount}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            In mempool or awaiting review
          </div>
        </div>
      </div>

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
          borderRadius: '24px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: '1 1 320px' }}>
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
              className="input-field"
              placeholder="Search by hash, asset name, or event type..."
              style={{ paddingLeft: '44px', height: '42px', fontSize: '13px', borderRadius: '9999px', backgroundColor: '#F8FAFC' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="input-field"
            style={{ width: 'auto', height: '42px', fontSize: '13px', borderRadius: '9999px', backgroundColor: '#F8FAFC', padding: '0 20px' }}
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Pending">Pending</option>
            <option value="Failed">Failed</option>
          </select>
        </div>

        <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', fontWeight: 500 }}>
          Showing <strong>{filteredTransactions.length}</strong> of {transactions.length} Ledger Events
        </div>
      </div>

      {/* Transactions Table */}
      {filteredTransactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No Transactions Found"
          description="There are no transaction entries matching your filter criteria in the ledger."
          actionLabel="Reset Search"
          onAction={() => {
            setSearchTerm('');
            setSelectedStatus('All');
          }}
        />
      ) : (
        <div style={{ padding: 0, overflow: 'hidden', backgroundColor: '#FFFFFF', borderRadius: '24px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Transaction Hash</th>
                  <th>Asset Reference</th>
                  <th>Settlement Event</th>
                  <th>Block Height</th>
                  <th>Gas Overhead</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const hash = tx.hash || tx.txHash || '0x0000000000000000000000000000000000000000';
                  const isConfirmed = (tx.status || '').toLowerCase() === 'confirmed';
                  const isPending = (tx.status || '').toLowerCase() === 'pending';
                  const isFailed = (tx.status || '').toLowerCase() === 'failed';

                  return (
                    <tr key={tx.id || hash}>
                      <td style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', whiteSpace: 'nowrap' }}>
                        {new Date(tx.timestamp || Date.now()).toLocaleString()}
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code
                            style={{
                              fontFamily: 'monospace',
                              fontSize: '12px',
                              color: 'var(--color-midnight-navy)',
                              backgroundColor: '#F8FAFC',
                              padding: '4px 10px',
                              borderRadius: '9999px'
                            }}
                          >
                            {hash.slice(0, 10)}...{hash.slice(-6)}
                          </code>
                          <button
                            onClick={() => copyHash(hash)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--color-secondary-text)',
                              display: 'flex',
                              alignItems: 'center',
                              padding: '4px'
                            }}
                            title="Copy Full Transaction Hash"
                          >
                            {copiedHash === hash ? (
                              <Check size={14} style={{ color: 'var(--color-copper)' }} />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      </td>

                      <td>
                        {tx.assetId ? (
                          <Link
                            to={`/asset/${tx.assetId}`}
                            style={{
                              fontWeight: 600,
                              color: 'var(--color-copper)',
                              textDecoration: 'none',
                              fontSize: '13.5px'
                            }}
                          >
                            {tx.assetName || 'Asset Dossier'}
                          </Link>
                        ) : (
                          <span style={{ fontWeight: 500, color: 'var(--color-midnight-navy)', fontSize: '13.5px' }}>
                            {tx.assetName || 'Protocol Operation'}
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: '13.5px', color: 'var(--color-midnight-navy)', fontWeight: 500 }}>
                        {tx.type}
                      </td>

                      <td style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-secondary-text)' }}>
                        {tx.blockNumber || '19,842,109'}
                      </td>

                      <td style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)' }}>
                        {tx.gasFee || '0.0021 ETH'}
                      </td>

                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '4px 12px',
                            borderRadius: '9999px',
                            backgroundColor: isConfirmed ? 'var(--color-mint)' : isFailed ? 'var(--color-error-bg)' : 'var(--color-peach)',
                            color: isConfirmed ? '#166534' : isFailed ? 'var(--color-error)' : 'var(--color-copper)'
                          }}
                        >
                          {isConfirmed ? <CheckCircle2 size={12} /> : isFailed ? <XCircle size={12} /> : <Clock size={12} />}
                          {tx.status ? tx.status.toUpperCase() : 'CONFIRMED'}
                        </span>
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setActiveTx(tx)}
                          style={{
                            borderRadius: '9999px',
                            padding: '6px 14px',
                            fontSize: '12px'
                          }}
                        >
                          View Receipt
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

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={!!activeTx}
        onClose={() => setActiveTx(null)}
        title="Settlement Receipt Details"
      >
        {activeTx && (
          <div>
            <div
              style={{
                padding: '20px 24px',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                marginBottom: '20px'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Event Classification
              </div>
              <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-midnight-navy)', marginTop: '4px' }}>
                {activeTx.type}
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)', marginTop: '2px' }}>
                Logged at {new Date(activeTx.timestamp || Date.now()).toUTCString()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', marginBottom: '26px' }}>
              <div>
                <span style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', display: 'block', marginBottom: '4px' }}>Transaction Hash:</span>
                <code style={{ fontFamily: 'monospace', fontSize: '12px', color: 'var(--color-copper)', wordBreak: 'break-all', backgroundColor: '#F8FAFC', padding: '6px 12px', borderRadius: '10px', display: 'block' }}>
                  {activeTx.hash || activeTx.txHash}
                </code>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Associated Asset:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>{activeTx.assetName || 'Protocol Asset'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Block Number:</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--color-midnight-navy)' }}>{activeTx.blockNumber || '19,842,109'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Network Settlement:</span>
                <span style={{ color: 'var(--color-midnight-navy)', fontWeight: 500 }}>Ethereum Sepolia (Chain ID: 11155111)</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Gas Consumption:</span>
                <span style={{ color: 'var(--color-midnight-navy)' }}>{activeTx.gasFee || '0.0021 ETH'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '12px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Settlement Status:</span>
                <span style={{ fontWeight: 700, color: '#166534' }}>
                  {activeTx.status ? activeTx.status.toUpperCase() : 'CONFIRMED'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid rgba(0, 0, 0, 0.05)', paddingTop: '18px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setActiveTx(null)}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
