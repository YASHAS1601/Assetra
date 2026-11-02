import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldCheck,
  LogOut,
  UserCheck
} from 'lucide-react';

const ADMIN_PAGE_TITLES = {
  '/admin/dashboard': 'Administrative Control Center',
  '/admin/pending': 'Asset Verification Queue',
  '/admin/approved': 'Approved Asset Registry',
  '/admin/token-owners': 'Token Ownership & Holder Ledger',
  '/admin/rejected': 'Returned & Non-Compliant Submissions',
  '/admin/blockchain-verification': 'Smart Contract Audit & Verification',
  '/admin/audit-logs': 'Immutable Compliance Audit Logs',
  '/admin/settings': 'Protocol Configuration & Security'
};

export const AdminTopbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const title = ADMIN_PAGE_TITLES[location.pathname] || 'Admin Portal';

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  return (
    <header className="topbar">
      {/* Title & Role Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            letterSpacing: '-0.015em',
            margin: 0
          }}
        >
          {title}
        </h1>
        <span
          className="badge"
          style={{
            backgroundColor: 'rgba(185, 101, 58, 0.12)',
            color: 'var(--color-copper, #B9653A)',
            border: '1px solid rgba(185, 101, 58, 0.25)',
            fontSize: '11px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShieldCheck size={13} />
          Admin Portal
        </span>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Admin Identity Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '6px 14px 6px 8px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: '#FFFFFF',
            border: '1px solid rgba(19, 36, 60, 0.08)',
            boxShadow: 'var(--shadow-subtle)'
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: 'var(--color-midnight)',
              color: 'var(--color-copper-highlight)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11.5px',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(16, 27, 45, 0.2)'
            }}
          >
            <UserCheck size={15} />
          </div>
          <div>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {user?.email || 'admin@assetra.io'}
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Compliance Officer
            </div>
          </div>
        </div>

        {/* Quick Exit Button */}
        <button
          onClick={handleLogout}
          className="btn btn-secondary btn-sm"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            padding: '8px 16px',
            borderRadius: 'var(--radius-pill)',
            color: 'var(--text-secondary)'
          }}
          title="Sign out of Admin Portal"
        >
          <LogOut size={14} />
          <span>Exit</span>
        </button>
      </div>
    </header>
  );
};

export default AdminTopbar;
