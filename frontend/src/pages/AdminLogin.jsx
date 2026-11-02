import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AssetraDoodleBackground } from '../components/common/AssetraDoodleBackground';
import { ShieldCheck, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, ShieldAlert } from 'lucide-react';


export const AdminLogin = () => {
  const navigate = useNavigate();
  const { login, logout, isLoading, error, configError } = useAuth();

  const [email, setEmail] = useState('admin@assetra.io');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email || !password) {
      setLocalError('Please enter administrator credentials.');
      return;
    }

    try {
      const authenticatedUser = await login(email, password);
      
      // Strict role check: Rejects USER role logins on the Admin Login portal
      if (authenticatedUser.role !== 'ADMIN') {
        logout(); // Immediately purge session token & user state
        setLocalError('Access denied. Authorized administrators and compliance officers only.');
        return;
      }

      setSuccessMsg(`Administrator credential verified. Welcome, ${authenticatedUser.fullName || authenticatedUser.email || 'Admin'}...`);
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 700);
    } catch (err) {
      setLocalError(err.message || 'Invalid administrator credentials.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F6F8FC', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '48px 20px', position: 'relative', overflowX: 'hidden' }}>
      <AssetraDoodleBackground theme="light" opacity={0.06} />
      <div style={{ width: '100%', maxWidth: '480px', position: 'relative', zIndex: 2 }}>

        {/* Navigation back */}
        <div style={{ marginBottom: '22px' }}>
          <Link
            to="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              color: 'var(--color-secondary-text, #64748B)',
              fontWeight: 600,
              textDecoration: 'none',
              padding: '8px 16px',
              borderRadius: '9999px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              transition: 'all 0.15s ease'
            }}
          >
            <ArrowLeft size={15} style={{ color: 'var(--color-copper, #B9653A)' }} />
            <span>Return to Portal Gateway</span>
          </Link>
        </div>

        <div
          style={{
            padding: '44px',
            backgroundColor: '#FFFFFF',
            borderRadius: '28px',
            boxShadow: 'var(--shadow-card, 0 10px 30px rgba(0, 0, 0, 0.04))'
          }}
        >
          {/* Admin Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#101B2D',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
                borderRadius: '16px',
                boxShadow: '0 6px 16px rgba(16, 27, 45, 0.25)'
              }}
            >
              <ShieldCheck size={24} style={{ color: 'var(--color-copper, #B9653A)' }} />
            </div>
            <h1
              style={{
                fontFamily: "var(--font-serif, 'Cormorant Garamond', Georgia, serif)",
                fontSize: '32px',
                fontWeight: 600,
                color: 'var(--color-navy, #13243C)',
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}
            >
              Administrator Gateway
            </h1>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-copper, #B9653A)',
                backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                padding: '5px 14px',
                borderRadius: '9999px'
              }}
            >
              <ShieldAlert size={13} />
              <span>Authorized Compliance Personnel Only</span>
            </div>
          </div>

          {/* Supabase Configuration Alert */}
          {configError && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'var(--color-peach-light, #FFF0E6)',
                borderRadius: '18px',
                color: 'var(--color-copper, #B9653A)',
                fontSize: '12.5px',
                marginBottom: '22px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Configuration Note:</strong>
                <div style={{ marginTop: '2px' }}>{configError}</div>
              </div>
            </div>
          )}

          {/* Feedback Banners */}
          {(localError || error) && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
                borderRadius: '18px',
                color: 'var(--color-error, #EF4444)',
                fontSize: '13px',
                marginBottom: '22px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontWeight: 500
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>{localError || error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'var(--color-mint-light, #DDF5EE)',
                borderRadius: '18px',
                color: '#1E6F5C',
                fontSize: '13px',
                marginBottom: '22px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontWeight: 600
              }}
            >
              <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Administrator Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-secondary-text, #64748B)'
                  }}
                />
                <input
                  type="email"
                  required
                  placeholder="admin@assetra.io"
                  style={{
                    width: '100%',
                    padding: '13px 16px 13px 44px',
                    fontSize: '14px',
                    backgroundColor: '#F8FAFC',
                    border: 'none',
                    borderRadius: '16px',
                    color: 'var(--color-navy, #13243C)',
                    outline: 'none'
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginBottom: '28px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-navy, #13243C)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security Credential / Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
                  size={17}
                  style={{
                    position: 'absolute',
                    left: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-secondary-text, #64748B)'
                  }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '13px 44px 13px 44px',
                    fontSize: '14px',
                    backgroundColor: '#F8FAFC',
                    border: 'none',
                    borderRadius: '16px',
                    color: 'var(--color-navy, #13243C)',
                    outline: 'none'
                  }}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '16px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--color-secondary-text, #64748B)',
                    display: 'flex',
                    alignItems: 'center',
                    padding: 0
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              style={{
                width: '100%',
                height: '48px',
                backgroundColor: '#101B2D',
                color: '#FFFFFF',
                borderRadius: '9999px',
                border: 'none',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.01em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 16px rgba(16, 27, 45, 0.25)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Verifying Security Clearance...' : 'Authenticate as Administrator'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Security Notice Footer */}
          <div
            style={{
              borderTop: '1px solid rgba(0, 0, 0, 0.04)',
              marginTop: '30px',
              paddingTop: '22px',
              textAlign: 'center',
              fontSize: '12px',
              color: 'var(--color-secondary-text, #64748B)',
              lineHeight: 1.5
            }}
          >
            All administrative authentications are cryptographically logged to the audit repository. Public registration is not permitted.
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
