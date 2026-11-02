import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getApiUrl } from '../lib/api';
import {
  Shield,
  User,
  ArrowRight,
  ShieldCheck,
  FileCheck,
  Layers
} from 'lucide-react';
import { AssetraDoodleBackground } from '../components/common/AssetraDoodleBackground';
import '../styles/login-selection.css';

export const LoginSelection = () => {
  const [envStatus, setEnvStatus] = useState({
    operational: true,
    env: 'Ethereum Sepolia • Active',
    version: 'v2.4'
  });

  useEffect(() => {
    fetch(getApiUrl('/health'))
      .then((res) => {
        if (!res.ok) throw new Error('Unhealthy');
        return res.json();
      })
      .then((data) => {
        if (data.status === 'healthy') {
          setEnvStatus({
            operational: true,
            env: `${data.environment ? data.environment.toUpperCase() : 'SEPOLIA'} • Active`,
            version: 'v2.4'
          });
        }
      })
      .catch(() => {
        setEnvStatus({
          operational: true,
          env: 'Local Node • Standby',
          version: 'v2.4'
        });
      });
  }, []);

  return (
    <div className="login-page-root">
      {/* Subtle, seamless WhatsApp-inspired architectural & asset tokenization doodle wallpaper */}
      <AssetraDoodleBackground theme="light" opacity={0.07} />


      {/* 1. Header */}
      <header className="login-header">
        <Link to="/login" className="login-brand-group" style={{ textDecoration: 'none' }}>
          <div className="login-brand-logo">
            <Shield size={18} strokeWidth={2.2} />
          </div>
          <span className="login-brand-text">Assetra</span>
          <div className="login-brand-divider" />
          <span className="login-brand-sub">Institutional Asset Tokenization</span>
        </Link>

        <div className="login-secure-badge">
          <span className="login-status-pulse" />
          <span>Verified Platform • EVM Ready</span>
        </div>
      </header>

      {/* 2. Main Content Split */}
      <main className="login-main">
        <div className="login-container">
          {/* Left Section: Value Proposition & Trust */}
          <div className="login-left-section">
            <div className="login-eyebrow">Institutional Access</div>
            <h1 className="login-headline">
              Real-world assets.<br />
              <span className="login-headline-accent">Verified and tokenized.</span>
            </h1>
            <p className="login-subtext">
              Institutional infrastructure connecting verified physical custody to immutable on-chain records. Complete legal title validation, dual-tier asset appraisal, and compliant ERC-721 tokenization.
            </p>

            {/* Line-Art Illustration */}
            <div className="login-illustration-box">
              <svg
                viewBox="0 0 540 135"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="login-illustration-svg"
                aria-label="Illustration of verified assets, legal documents, and blockchain records"
              >
                {/* 1. Physical Verified Asset */}
                <g transform="translate(15, 12)">
                  <line x1="0" y1="96" x2="130" y2="96" stroke="#DDD6CB" strokeWidth="1.2" strokeDasharray="3 3" />
                  
                  <rect x="20" y="24" width="56" height="72" rx="2" stroke="#41413B" strokeWidth="1.4" fill="#FFFFFF" />
                  <rect x="76" y="44" width="34" height="52" rx="2" stroke="#41413B" strokeWidth="1.4" fill="#FFFFFF" />
                  
                  <line x1="32" y1="36" x2="42" y2="36" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="54" y1="36" x2="64" y2="36" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="32" y1="50" x2="42" y2="50" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="54" y1="50" x2="64" y2="50" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="32" y1="64" x2="42" y2="64" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="54" y1="64" x2="64" y2="64" stroke="#77766F" strokeWidth="1.3" />
                  
                  <line x1="84" y1="56" x2="98" y2="56" stroke="#77766F" strokeWidth="1.3" />
                  <line x1="84" y1="68" x2="98" y2="68" stroke="#77766F" strokeWidth="1.3" />
                  
                  <rect x="42" y="80" width="14" height="16" stroke="#41413B" strokeWidth="1.2" fill="#F2EEE7" />
                  
                  <line x1="48" y1="12" x2="48" y2="24" stroke="#B8734E" strokeWidth="1.4" />
                  <circle cx="48" cy="12" r="2.5" fill="#B8734E" />
                  
                  <rect x="14" y="2" width="68" height="15" rx="3" stroke="#DDD6CB" strokeWidth="1" fill="#F2EEE7" />
                  <text x="48" y="12.5" fill="#20211F" fontSize="7.5" fontFamily="monospace" fontWeight="600" textAnchor="middle">
                    PHYSICAL ASSET
                  </text>
                </g>

                {/* Connector 1 */}
                <g>
                  <path d="M136 68 L192 68" stroke="#DDD6CB" strokeWidth="1.4" strokeDasharray="3 3" />
                  <circle cx="164" cy="68" r="9" fill="#FFFFFF" stroke="#DDD6CB" strokeWidth="1.2" />
                  <path d="M161 68 L163.5 70.5 L168 65.5" stroke="#B8734E" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {/* 2. Legal Documentation */}
                <g transform="translate(196, 10)">
                  <rect x="6" y="8" width="68" height="88" rx="3" stroke="#DDD6CB" strokeWidth="1" fill="#F2EEE7" />
                  <rect x="0" y="0" width="68" height="88" rx="3" stroke="#20211F" strokeWidth="1.4" fill="#FFFFFF" />
                  
                  <line x1="10" y1="14" x2="34" y2="14" stroke="#20211F" strokeWidth="2" strokeLinecap="round" />
                  <line x1="10" y1="24" x2="56" y2="24" stroke="#DDD6CB" strokeWidth="1.2" />
                  <line x1="10" y1="32" x2="50" y2="32" stroke="#DDD6CB" strokeWidth="1.2" />
                  <line x1="10" y1="40" x2="54" y2="40" stroke="#DDD6CB" strokeWidth="1.2" />
                  <line x1="10" y1="48" x2="42" y2="48" stroke="#DDD6CB" strokeWidth="1.2" />
                  
                  <circle cx="46" cy="68" r="13" stroke="#B8734E" strokeWidth="1.4" strokeDasharray="2 2" fill="#FAF3EA" />
                  <circle cx="46" cy="68" r="9.5" stroke="#B8734E" strokeWidth="1" fill="none" />
                  <path d="M42.5 68 L45 70.5 L50.5 65" stroke="#B8734E" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  
                  <line x1="10" y1="74" x2="28" y2="74" stroke="#77766F" strokeWidth="1" />
                  <text x="34" y="99" fill="#77766F" fontSize="7.5" fontFamily="monospace" textAnchor="middle">
                    LEGAL TITLE
                  </text>
                </g>

                {/* Connector 2 */}
                <g>
                  <path d="M282 68 L338 68" stroke="#DDD6CB" strokeWidth="1.4" strokeDasharray="3 3" />
                  <circle cx="310" cy="68" r="9" fill="#FFFFFF" stroke="#DDD6CB" strokeWidth="1.2" />
                  <path d="M307 68 L309.5 70.5 L314 65.5" stroke="#B8734E" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </g>

                {/* 3. Blockchain Records */}
                <g transform="translate(344, 16)">
                  <rect x="0" y="28" width="54" height="48" rx="4" stroke="#41413B" strokeWidth="1.3" fill="#FFFFFF" />
                  <text x="8" y="42" fill="#77766F" fontSize="7" fontFamily="monospace">BLOCK#</text>
                  <text x="8" y="52" fill="#20211F" fontSize="8.5" fontWeight="600" fontFamily="monospace">198,421</text>
                  <line x1="8" y1="60" x2="46" y2="60" stroke="#DDD6CB" strokeWidth="1" />
                  <text x="8" y="68" fill="#77766F" fontSize="6.5" fontFamily="monospace">0x4a9f...8b</text>

                  <line x1="54" y1="52" x2="70" y2="52" stroke="#B8734E" strokeWidth="1.6" />
                  <circle cx="62" cy="52" r="2.8" fill="#FFFFFF" stroke="#B8734E" strokeWidth="1.4" />

                  <rect x="70" y="20" width="66" height="62" rx="4" stroke="#B8734E" strokeWidth="1.6" fill="#FFFFFF" />
                  <rect x="74" y="24" width="58" height="14" rx="2" fill="#FAF3EA" />
                  <text x="103" y="34.5" fill="#B8734E" fontSize="7.5" fontWeight="600" fontFamily="monospace" textAnchor="middle">
                    ERC-721 TOKEN
                  </text>
                  
                  <text x="78" y="49" fill="#77766F" fontSize="7" fontFamily="monospace">TOKEN_ID</text>
                  <text x="78" y="59" fill="#20211F" fontSize="9" fontWeight="700" fontFamily="monospace">#0091-AST</text>
                  
                  <circle cx="122" cy="67" r="6.5" fill="#B8734E" />
                  <path d="M119.5 67 L121.5 69 L125 65.5" stroke="#FFFFFF" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />

                  <text x="68" y="97" fill="#20211F" fontSize="7.5" fontWeight="600" fontFamily="monospace" textAnchor="middle">
                    IMMUTABLE LEDGER
                  </text>
                </g>
              </svg>
            </div>

            {/* Trust Indicators */}
            <div className="login-trust-row">
              <div className="login-trust-item">
                <ShieldCheck size={16} className="login-trust-icon" strokeWidth={2} />
                <div>
                  <div className="login-trust-title">On-Chain Custody</div>
                  <div className="login-trust-desc">Verifiable legal title proof</div>
                </div>
              </div>

              <div className="login-trust-item">
                <FileCheck size={16} className="login-trust-icon" strokeWidth={2} />
                <div>
                  <div className="login-trust-title">Dual-Tier Verification</div>
                  <div className="login-trust-desc">Admin & legal appraisal audit</div>
                </div>
              </div>

              <div className="login-trust-item">
                <Layers size={16} className="login-trust-icon" strokeWidth={2} />
                <div>
                  <div className="login-trust-title">ERC-721 Contracts</div>
                  <div className="login-trust-desc">Approval-gated minting flow</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Section: Workspace Selection */}
          <div className="login-right-section">
            <div className="login-workspace-panel">
              <div className="login-workspace-header">
                <h2 className="login-workspace-title">Choose your workspace</h2>
                <p className="login-workspace-desc">
                  Select your role to access your dedicated portal.
                </p>
              </div>

              {/* User Portal Card */}
              <div className="login-portal-card user-card">
                <div className="login-portal-card-top">
                  <div className="login-portal-identity">
                    <div className="login-portal-icon-wrap user">
                      <User size={15} strokeWidth={2.2} />
                    </div>
                    <span className="login-portal-name">User Portal</span>
                  </div>
                  <span className="login-user-tag">Asset Issuers & Investors</span>
                </div>

                <p className="login-portal-text">
                  Register real-world assets, upload evidence documents, monitor review status, and manage tokenized holdings.
                </p>

                <div className="login-portal-action-row">
                  <Link to="/user/login" className="btn-portal-primary">
                    <span>Login as User</span>
                    <ArrowRight size={14} />
                  </Link>

                  <Link to="/user/register" className="login-portal-sublink">
                    Create user account →
                  </Link>
                </div>
              </div>

              {/* Admin Portal Card */}
              <div className="login-portal-card admin-card">
                <div className="login-portal-card-top">
                  <div className="login-portal-identity">
                    <div className="login-portal-icon-wrap admin">
                      <Shield size={15} strokeWidth={2.2} />
                    </div>
                    <span className="login-portal-name">Admin Portal</span>
                  </div>
                  <span className="login-admin-notice-badge">Authorized administrators only</span>
                </div>

                <p className="login-portal-text">
                  Audit asset submissions, inspect legal evidence, conduct compliance reviews, and issue on-chain approvals.
                </p>

                <div className="login-portal-action-row">
                  <Link to="/admin/login" className="btn-portal-outline">
                    <span>Login as Admin</span>
                    <ArrowRight size={14} />
                  </Link>

                  <span className="login-admin-subtext">
                    Requires verifier credentials
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 3. Footer */}
      <footer className="login-footer">
        <div className="login-footer-links">
          <Link to="/login" className="login-footer-link">Portal Gateway</Link>
          <span>•</span>
          <Link to="/explore" className="login-footer-link">Marketplace</Link>
          <span>•</span>
          <span>Assetra Protocol Terms</span>
        </div>

        <div className="login-footer-status">
          <span className="login-footer-dot" />
          <span>System: Operational</span>
          <span className="login-footer-divider" />
          <span>{envStatus.env}</span>
          <span className="login-footer-divider" />
          <span>Protocol {envStatus.version}</span>
        </div>
      </footer>
    </div>
  );
};

export default LoginSelection;
