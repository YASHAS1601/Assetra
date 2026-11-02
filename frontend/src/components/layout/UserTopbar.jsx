import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import {
  Wallet,
  LogOut,
  User,
  ShieldCheck,
  ChevronDown,
  ExternalLink
} from 'lucide-react';
import { getEtherscanAddressUrl } from '../../constants/contracts';

const PAGE_TITLES = {
  '/user/dashboard': 'Portfolio Overview',
  '/portfolio': 'Asset Holdings & Certificates',
  '/explore': 'Verified Marketplace',
  '/register': 'Register Real-World Asset',
  '/verification-status': 'Asset Verification Tracking',
  '/blockchain-verification': 'Blockchain Verification & Audit',
  '/verify': 'Blockchain Verification & Audit',
  '/transactions': 'On-Chain Transaction Ledger',
  '/settings': 'Account & Security Settings'
};

export const UserTopbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    account,
    isConnected,
    isConnecting,
    networkInfo,
    balance,
    connectWallet,
    disconnectWallet,
    isSepolia,
    switchToSepolia
  } = useWeb3();

  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [walletError, setWalletError] = useState('');

  const title = PAGE_TITLES[location.pathname] || (location.pathname.startsWith('/asset/') ? 'Asset Appraisal & Dossier' : 'Assetra Portal');

  const handleWalletClick = async () => {
    setWalletError('');
    try {
      if (isConnected) {
        setShowAccountMenu(!showAccountMenu);
      } else {
        await connectWallet();
      }
    } catch (err) {
      setWalletError(err.message || 'Failed to connect MetaMask');
      setTimeout(() => setWalletError(''), 4000);
    }
  };

  return (
    <header className="topbar">
      {/* Title & Portal Badge */}
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
            backgroundColor: 'var(--color-pale-mint)',
            color: 'var(--color-success-text)',
            fontSize: '11.5px',
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <ShieldCheck size={13} style={{ color: 'var(--color-success)' }} />
          <span>Investor Portal</span>
        </span>
      </div>

      {/* Right Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {user?.role === 'ADMIN' && (
          <button
            onClick={() => navigate('/admin/dashboard')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '9999px',
              backgroundColor: 'var(--color-copper, #B9653A)',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '11.5px',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(185, 101, 58, 0.25)'
            }}
          >
            <ShieldCheck size={13} />
            <span>Admin Console</span>
          </button>
        )}

        {walletError && (
          <span style={{ fontSize: '12px', color: 'var(--color-error)', fontWeight: 500 }}>
            {walletError}
          </span>
        )}

        {/* Web3 Wallet Connect Button */}
        <div style={{ position: 'relative' }}>
          {isConnected ? (
            <button
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(19, 36, 60, 0.08)',
                boxShadow: 'var(--shadow-subtle)'
              }}
              onClick={handleWalletClick}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-success)',
                  boxShadow: '0 0 8px var(--color-success)'
                }}
              />
              <span style={{ fontFamily: 'monospace', fontSize: '12.5px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {typeof account === 'string' ? `${account.slice(0, 6)}...${account.slice(-4)}` : 'Connected'}
              </span>
              <ChevronDown size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: 'var(--radius-pill)'
              }}
              onClick={handleWalletClick}
              disabled={isConnecting}
            >
              <Wallet size={15} />
              <span>{isConnecting ? 'Connecting...' : 'Connect Wallet'}</span>
            </button>
          )}

          {/* Account Dropdown Menu */}
          {showAccountMenu && isConnected && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '310px',
                backgroundColor: '#FFFFFF',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-dropdown)',
                padding: '20px',
                zIndex: 100,
                border: '1px solid rgba(19, 36, 60, 0.06)'
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: '6px' }}>
                Connected Wallet
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 600, fontFamily: 'monospace', wordBreak: 'break-all', marginBottom: '14px', color: 'var(--text-primary)', backgroundColor: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                {account}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(19, 36, 60, 0.05)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Network</span>
                <span style={{ fontWeight: 600, color: isSepolia ? 'var(--color-success)' : 'var(--color-error)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isSepolia ? 'var(--color-success)' : 'var(--color-error)' }} />
                  {networkInfo?.name || (isSepolia ? 'Ethereum Sepolia' : 'Other Network')}
                </span>
              </div>

              {!isSepolia && (
                <button
                  onClick={async () => {
                    try {
                      await switchToSepolia();
                    } catch (e) {
                      setWalletError(e.message || 'Failed to switch network');
                    }
                  }}
                  className="btn btn-outline-copper btn-sm"
                  style={{ width: '100%', margin: '6px 0 10px', fontSize: '12px', padding: '7px 12px', borderRadius: 'var(--radius-pill)' }}
                >
                  Switch to Ethereum Sepolia
                </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderTop: '1px solid rgba(19, 36, 60, 0.05)', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Wallet Balance</span>
                <span style={{ fontWeight: 700, color: 'var(--color-copper)' }}>{balance} ETH</span>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                {account && (
                  <a
                    href={getEtherscanAddressUrl(account)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1, fontSize: '11.5px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}
                  >
                    <span>Etherscan</span>
                    <ExternalLink size={12} />
                  </a>
                )}
                <button
                  onClick={() => {
                    disconnectWallet();
                    setShowAccountMenu(false);
                  }}
                  className="btn btn-sm"
                  style={{
                    flex: 1,
                    fontSize: '11.5px',
                    padding: '7px 10px',
                    color: 'var(--color-error)',
                    backgroundColor: 'var(--color-error-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.2)'
                  }}
                >
                  <LogOut size={12} />
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Pill */}
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
              background: 'var(--gradient-copper)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
              boxShadow: '0 2px 6px rgba(185, 101, 58, 0.3)'
            }}
          >
            {user?.email && typeof user.email === 'string' ? user.email.charAt(0).toUpperCase() : <User size={14} />}
          </div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {user?.email && typeof user.email === 'string' ? user.email.split('@')[0] : (user?.fullName || 'Investor')}
          </span>
        </div>
      </div>
    </header>
  );
};

export default UserTopbar;
