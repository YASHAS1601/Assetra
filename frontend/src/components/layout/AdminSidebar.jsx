import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AssetraDoodleBackground } from '../common/AssetraDoodleBackground';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Settings,
  ShieldCheck,
  Users,
  LogOut,
  Menu,
  X
} from 'lucide-react';

export const AdminSidebar = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login');
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Admin Overview', icon: LayoutDashboard },
    { path: '/admin/pending', label: 'Pending Reviews', icon: Clock },
    { path: '/admin/approved', label: 'Approved Assets', icon: CheckCircle2 },
    { path: '/admin/token-owners', label: 'Token Owners Ledger', icon: Users },
    { path: '/admin/rejected', label: 'Rejected Dossiers', icon: XCircle },
    { path: '/admin/blockchain-verification', label: 'Contract Verification', icon: ShieldCheck },
    { path: '/admin/audit-logs', label: 'Audit Logs', icon: FileText },
    { path: '/admin/settings', label: 'Protocol Settings', icon: Settings }
  ];

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="mobile-menu-btn"
        aria-label="Toggle admin navigation menu"
        style={{
          display: 'none',
          position: 'fixed',
          top: '16px',
          left: '16px',
          zIndex: 60,
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: '#101B2D',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer'
        }}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(11, 19, 32, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 45
          }}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Administrator navigation">
        {/* Brand Header */}
        <div className="sidebar-header">
          <div className="brand-logo" style={{ background: 'var(--gradient-copper)' }}>
            <ShieldCheck size={20} strokeWidth={2.4} style={{ color: '#FFFFFF' }} />
          </div>
          <div>
            <div className="brand-title">Assetra</div>
            <div style={{ fontSize: '11px', color: 'var(--color-copper, #B9653A)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ADMIN PORTAL
            </div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.9} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Footer Info & Sign Out */}
        <div
          style={{
            padding: '20px 18px',
            marginTop: 'auto',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            backgroundColor: 'rgba(11, 19, 32, 0.4)',
            position: 'relative',
            zIndex: 2
          }}
        >
          <button
            onClick={handleLogout}
            className="btn"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: 'var(--radius-pill)',
              color: '#F8FAFC',
              background: 'rgba(185, 101, 58, 0.16)',
              border: '1px solid rgba(185, 101, 58, 0.3)',
              marginBottom: '14px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(185, 101, 58, 0.28)';
              e.currentTarget.style.borderColor = 'rgba(214, 138, 96, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(185, 101, 58, 0.16)';
              e.currentTarget.style.borderColor = 'rgba(185, 101, 58, 0.3)';
            }}
          >
            <LogOut size={15} style={{ color: 'var(--color-copper-highlight)' }} />
            <span>Exit Admin Portal</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: '#64748B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                  boxShadow: '0 0 8px var(--color-success)'
                }}
              />
              <span style={{ color: '#94A3B8', fontWeight: 500 }}>Verifier Mode Active</span>
            </div>
            <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#64748B' }}>v2.4</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;
