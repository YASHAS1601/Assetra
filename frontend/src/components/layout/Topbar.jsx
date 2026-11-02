import React, { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useWeb3, NETWORKS } from '../../context/Web3Context';
import { useAuth } from '../../context/AuthContext';
import { Search, Wallet, ChevronDown, LogOut, Globe, AlertCircle, ShieldCheck, User, LogIn } from 'lucide-react';

const PAGE_TITLES = {
  '/': 'Overview',
  '/user/dashboard': 'User Dashboard',
  '/admin/dashboard': 'Admin Verification Portal',
  '/portfolio': 'My Portfolio',
  '/explore': 'Explore Assets',
  '/register': 'Register Asset',
  '/verification-status': 'Verification Status',
  '/transactions': 'Transactions Ledger',
  '/settings': 'System Settings',
  '/login': 'Portal Selection',
  '/user/login': 'User Sign In',
  '/admin/login': 'Administrator Sign In',
  '/user/register': 'User Registration'
};

export const Topbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    account,
    chainId,
    networkInfo,
    balance,
    isConnected,
    isConnecting,
    isDemoMode,
    connectWallet,
    disconnectWallet,
    switchNetwork,
    toggleDemoMode
  } = useWeb3();

  const { user, isAuthenticated, role, logout } = useAuth();

  const [showNetworkMenu, setShowNetworkMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const title = PAGE_TITLES[location.pathname] || 'Asset Details';

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/explore?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const truncateAddress = (addr) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="topbar">
      {/* Title / Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {title}
        </h1>

        {isDemoMode ? (
          <span
            className="badge badge-amber"
            style={{ cursor: 'pointer' }}
            title="Click to toggle Web3 wallet mode"
            onClick={toggleDemoMode}
          >
            <AlertCircle size={12} />
            Demo Mode
          </span>
        ) : (
          <span className="badge badge-green">
            <ShieldCheck size={12} />
            Web3 Live
          </span>
        )}
      </div>

      {/* Global Search */}
      <form onSubmit={handleSearchSubmit} style={{ flex: '0 1 340px', position: 'relative' }}>
        <Search
          size={16}
          style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--text-secondary)'
          }}
        />
        <input
          type="text"
          placeholder="Search assets, contract addresses, token symbols..."
          className="input-field"
          style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </form>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Network Indicator Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-secondary btn-sm"
            style={{ height: '36px', fontSize: '13px' }}
            onClick={() => setShowNetworkMenu(!showNetworkMenu)}
          >
            <Globe size={14} style={{ color: 'var(--action-primary)' }} />
            <span>{networkInfo.name}</span>
            <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
          </button>

          {showNetworkMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '42px',
                width: '200px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                zIndex: 40,
                padding: '4px'
              }}
            >
              <div style={{ padding: '6px 10px', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                Select Network
              </div>
              {Object.entries(NETWORKS).map(([id, net]) => (
                <button
                  key={id}
                  onClick={() => {
                    switchNetwork(id);
                    setShowNetworkMenu(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    fontSize: '13px',
                    border: 'none',
                    backgroundColor: chainId === id ? 'var(--bg-subtle-green)' : 'transparent',
                    color: chainId === id ? 'var(--action-primary)' : 'var(--text-primary)',
                    fontWeight: chainId === id ? 600 : 400,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <span>{net.name}</span>
                  {chainId === id && <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--action-primary)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Account Login / Profile State */}
        {isAuthenticated ? (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ height: '36px', gap: '8px' }}
              onClick={() => setShowUserMenu(!showUserMenu)}
            >
              <User size={15} style={{ color: 'var(--action-primary)' }} />
              <span style={{ fontWeight: 600 }}>{user?.fullName || user?.email}</span>
              <span
                className={`badge ${role === 'ADMIN' ? 'badge-amber' : 'badge-blue'}`}
                style={{ padding: '2px 6px', fontSize: '10px' }}
              >
                {role}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>

            {showUserMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '42px',
                  width: '220px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  zIndex: 40,
                  padding: '10px'
                }}
              >
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
                  Authenticated Account
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', wordBreak: 'break-all' }}>
                  {user?.email}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <button
                    onClick={() => {
                      logout();
                      setShowUserMenu(false);
                      navigate('/login');
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'var(--state-error)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 500
                    }}
                  >
                    <LogOut size={13} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-secondary btn-sm" style={{ height: '36px' }}>
            <LogIn size={14} />
            <span>Sign In</span>
          </Link>
        )}

        {/* Wallet Connection Button */}
        {!isConnected ? (
          <button
            className="btn btn-primary btn-sm"
            style={{ height: '36px' }}
            onClick={connectWallet}
            disabled={isConnecting}
          >
            <Wallet size={15} />
            <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
          </button>
        ) : (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{ height: '36px', gap: '8px' }}
              onClick={() => setShowAccountMenu(!showAccountMenu)}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#166534' }}></span>
              <span style={{ fontWeight: 600 }}>{truncateAddress(account)}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', borderLeft: '1px solid var(--border-color)', paddingLeft: '8px' }}>
                {balance} ETH
              </span>
              <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>

            {showAccountMenu && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '42px',
                  width: '240px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  zIndex: 40,
                  padding: '12px'
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Connected Wallet Address
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-all', marginBottom: '8px' }}>
                  {account}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: '1px solid var(--border-color)', fontSize: '13px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Wallet Balance</span>
                  <span style={{ fontWeight: 600 }}>{balance} ETH</span>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '8px', marginTop: '4px' }}>
                  <button
                    onClick={toggleDemoMode}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      marginBottom: '4px'
                    }}
                  >
                    Switch to {isDemoMode ? 'Real Wallet Provider' : 'Demo Mode'}
                  </button>

                  <button
                    onClick={() => {
                      disconnectWallet();
                      setShowAccountMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      fontSize: '12px',
                      background: 'none',
                      border: 'none',
                      textAlign: 'left',
                      color: 'var(--state-error)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 500
                    }}
                  >
                    <LogOut size={13} />
                    <span>Disconnect Wallet</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
