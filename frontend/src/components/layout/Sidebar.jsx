import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { AssetraDoodleBackground } from '../common/AssetraDoodleBackground';
import {
  LayoutDashboard,
  Briefcase,
  Search,
  PlusCircle,
  Receipt,
  Settings,
  Shield,
  FileCheck,
  ShieldAlert
} from 'lucide-react';

export const Sidebar = () => {
  const { isAdmin } = useAuth();

  const navItems = [
    { path: '/user/dashboard', label: 'User Dashboard', icon: LayoutDashboard },
    { path: '/portfolio', label: 'My Portfolio', icon: Briefcase },
    { path: '/explore', label: 'Explore Assets', icon: Search },
    { path: '/register', label: 'Register Asset', icon: PlusCircle },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/settings', label: 'Settings', icon: Settings }
  ];

  if (isAdmin) {
    navItems.splice(1, 0, { path: '/admin/dashboard', label: 'Admin Portal', icon: ShieldAlert });
  }

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-header">

        <div className="brand-logo">
          <Shield size={18} strokeWidth={2.2} />
        </div>
        <div>
          <div className="brand-title">Assetra</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Asset Tokenization
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
              end={item.path === '/'}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#166534' }}></span>
          <span>Assetra Protocol v2.4</span>
        </div>
      </div>
    </aside>
  );
};
