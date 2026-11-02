import React, { useState } from 'react';
import { useAssets } from '../../context/AssetContext';
import { EmptyState } from '../../components/common/EmptyState';
import {
  FileText,
  Search,
  History,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Lock,
  Send
} from 'lucide-react';

export const AdminAuditLogs = () => {
  const { auditLogs } = useAssets();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    return (
      !searchTerm ||
      (log.assetId && log.assetId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.action && log.action.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.adminEmail && log.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const getActionBadge = (action) => {
    if (action === 'TRANSFERRED') {
      return (
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: '#EFF6FF',
            color: '#1D4ED8',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Send size={12} />
          TRANSFERRED
        </span>
      );
    }
    if (action === 'APPROVED') {
      return (
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-mint)',
            color: '#1B6A4C',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <CheckCircle2 size={12} />
          APPROVED
        </span>
      );
    }
    if (action === 'REJECTED') {
      return (
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: '#FEE2E2',
            color: '#DC2626',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <XCircle size={12} />
          REJECTED
        </span>
      );
    }
    if (action === 'MORE_INFO_REQUESTED') {
      return (
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: 'var(--color-peach)',
            color: '#B9653A',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <HelpCircle size={12} />
          INFO REQUESTED
        </span>
      );
    }
    if (action === 'UNDER_REVIEW') {
      return (
        <span
          style={{
            fontSize: '11.5px',
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: '9999px',
            backgroundColor: '#F8FAFC',
            color: 'var(--color-charcoal)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}
        >
          <Clock size={12} />
          UNDER REVIEW
        </span>
      );
    }
    return (
      <span
        style={{
          fontSize: '11.5px',
          fontWeight: 600,
          padding: '4px 12px',
          borderRadius: '9999px',
          backgroundColor: '#F8FAFC',
          color: 'var(--color-charcoal)'
        }}
      >
        {action}
      </span>
    );
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
              Regulatory Transparency
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
            Immutable Compliance Audit Trail
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Cryptographically timestamped supervisory ledger logging administrator review actions, verification decisions, and custody approvals.
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
            placeholder="Search audit trail by asset ID, email, action..."
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
          Showing <strong style={{ color: 'var(--color-charcoal)' }}>{filteredLogs.length}</strong> immutable log entries
        </div>
      </div>

      {/* Table */}
      {filteredLogs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No Audit Records Recorded Yet"
          description="Every review decision (Start Review, Approve, Reject, Request More Info) will be permanently saved to public.audit_logs in Supabase."
        />
      ) : (
        <div style={{ borderRadius: '26px', overflow: 'hidden', backgroundColor: '#FFFFFF', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="fintech-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC' }}>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Timestamp</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Audit Decision</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Asset Identifier</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Auditor Identity</th>
                  <th style={{ padding: '16px 20px', fontSize: '12px', fontWeight: 600, color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>Compliance Findings & Review Record</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                    <td style={{ padding: '18px 20px', fontSize: '12.5px', color: 'var(--color-secondary-text)', whiteSpace: 'nowrap' }}>
                      {new Date(log.timestamp || log.createdAt || Date.now()).toLocaleString()}
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      {getActionBadge(log.action)}
                    </td>

                    <td style={{ padding: '18px 20px' }}>
                      <code
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          color: 'var(--color-charcoal)',
                          backgroundColor: '#F8FAFC',
                          padding: '4px 8px',
                          borderRadius: '8px'
                        }}
                      >
                        {log.assetId}
                      </code>
                    </td>

                    <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-charcoal)', fontWeight: 500 }}>
                      {log.adminEmail || 'admin@assetra.io'}
                    </td>

                    <td style={{ padding: '18px 20px', fontSize: '13px', color: 'var(--color-secondary-text)', lineHeight: 1.5 }}>
                      {log.notes || 'Status changed in compliance queue.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
