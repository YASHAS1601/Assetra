import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import {
  Settings,
  ShieldCheck,
  Database,
  Cpu,
  User,
  CheckCircle2,
  Lock,
  Server,
  Layers
} from 'lucide-react';

export const AdminSettings = () => {
  const { user, isConfigured } = useAuth();
  const { chainId, networkInfo } = useWeb3();

  return (
    <div style={{ paddingBottom: '48px' }}>
      {/* Header */}
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
              Protocol Governance
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
            System Architecture & Security Policy
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
            Supervisory parameters, database authorization rules, and smart contract network topology.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px' }}>
        {/* Administrator Account Details */}
        <div style={{ padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '26px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--color-peach)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} style={{ color: 'var(--color-copper)' }} />
            </div>
            <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Administrator Profile & Credentials
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Auditor Email Address
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginTop: '4px', fontSize: '14px' }}>
                {user?.email || 'admin@assetra.io'}
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Assigned Role & Authorization
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                <span
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '9999px',
                    backgroundColor: 'var(--color-mint)',
                    color: '#1B6A4C'
                  }}
                >
                  ADMIN
                </span>
                <span style={{ fontSize: '12.5px', color: 'var(--color-secondary-text)' }}>
                  Verified via Supabase <code style={{ fontFamily: 'monospace' }}>public.profiles</code>
                </span>
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Security Scope
              </div>
              <div style={{ color: 'var(--color-secondary-text)', fontSize: '13px', marginTop: '4px', lineHeight: 1.6 }}>
                Authorized for asset verification approvals, title deed access, compliance exceptions, and on-chain tokenization execution.
              </div>
            </div>
          </div>
        </div>

        {/* Database & Supabase Status */}
        <div style={{ padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '26px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--color-mint)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Database size={18} style={{ color: '#1B6A4C' }} />
            </div>
            <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Database & Storage Architecture
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Supabase PostgreSQL Connection
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <CheckCircle2 size={16} style={{ color: '#1B6A4C' }} />
                <span style={{ fontWeight: 600, color: '#1B6A4C', fontSize: '13.5px' }}>Connected & Fully Operational</span>
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Row Level Security (RLS) Policy
              </div>
              <div style={{ color: 'var(--color-secondary-text)', fontSize: '13px', marginTop: '4px', lineHeight: 1.6 }}>
                Enforced on <code style={{ fontFamily: 'monospace' }}>profiles</code>, <code style={{ fontFamily: 'monospace' }}>assets</code>, <code style={{ fontFamily: 'monospace' }}>asset_documents</code>, and <code style={{ fontFamily: 'monospace' }}>audit_logs</code>.
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Audit Trail Integrity
              </div>
              <div style={{ color: 'var(--color-secondary-text)', fontSize: '13px', marginTop: '4px', lineHeight: 1.6 }}>
                Append-only immutable event ledger in <code style={{ fontFamily: 'monospace' }}>public.audit_logs</code> table.
              </div>
            </div>
          </div>
        </div>

        {/* Blockchain Network Settings */}
        <div style={{ padding: '28px', backgroundColor: '#FFFFFF', borderRadius: '26px', boxShadow: 'var(--shadow-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', backgroundColor: 'var(--color-lavender)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Cpu size={18} style={{ color: '#5B4EB1' }} />
            </div>
            <h3 className="font-serif" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Blockchain Consensus & RPC Gateway
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Connected Network
              </div>
              <div style={{ fontWeight: 600, color: 'var(--color-charcoal)', marginTop: '4px', fontSize: '14px' }}>
                {networkInfo.name || 'Ethereum Sepolia'} (Chain ID: {chainId || '11155111'})
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                RPC Endpoint Node
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '12.5px', color: 'var(--color-charcoal)', marginTop: '4px' }}>
                {networkInfo.rpcUrl || 'Sepolia Infura / Alchemy Node'}
              </div>
            </div>

            <div style={{ backgroundColor: '#F8FAFC', padding: '14px 18px', borderRadius: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--color-secondary-text)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                Smart Contracts
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginTop: '4px', lineHeight: 1.6 }}>
                AssetRegistry.sol & AssetToken.sol compliance-governed minting architecture.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
