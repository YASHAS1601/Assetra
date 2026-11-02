import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AssetraDoodleBackground } from '../components/common/AssetraDoodleBackground';
import { User, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, Shield } from 'lucide-react';


export const UserLogin = () => {
  const navigate = useNavigate();
  const { login, isLoading, error, configError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setSuccessMsg('');

    if (!email || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }

    try {
      const authenticatedUser = await login(email, password);
      const isAdmin = authenticatedUser?.role === 'ADMIN';
      const welcomeRole = isAdmin ? 'Administrator' : 'Investor';
      setSuccessMsg(`Welcome back, ${authenticatedUser.fullName || authenticatedUser.email || welcomeRole}. Accessing your ${isAdmin ? 'supervisory admin' : 'institutional investor'} portal...`);
      setTimeout(() => {
        if (isAdmin) {
          navigate('/admin/dashboard');
        } else {
          navigate('/user/dashboard');
        }
      }, 700);
    } catch (err) {
      setLocalError(err.message || 'Invalid investor credentials.');
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
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #B9653A 0%, #D68A60 100%)',
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '18px',
                borderRadius: '16px',
                boxShadow: '0 6px 16px rgba(185, 101, 58, 0.28)'
              }}
            >
              <Shield size={22} strokeWidth={2.2} />
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
              Investor Sign In
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text, #64748B)', lineHeight: 1.5, margin: 0 }}>
              Authenticate with your institutional account to manage tokenized assets and verification documents.
            </p>
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

          {/* Feedback Alerts */}
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
                alignItems: 'center',
                gap: '10px',
                fontWeight: 500
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
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
                Corporate / Investor Email
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
                  placeholder="investor@institution.com"
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-navy, #13243C)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Password
                </label>
              </div>
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
                backgroundColor: 'var(--color-copper, #B9653A)',
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
                boxShadow: '0 4px 16px rgba(185, 101, 58, 0.25)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Authenticating Credentials...' : 'Access Investor Portal'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Footer Links */}
          <div
            style={{
              borderTop: '1px solid rgba(0, 0, 0, 0.04)',
              marginTop: '30px',
              paddingTop: '22px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--color-secondary-text, #64748B)'
            }}
          >
            New institutional participant?{' '}
            <Link to="/user/register" style={{ color: 'var(--color-copper, #B9653A)', fontWeight: 600, textDecoration: 'none' }}>
              Create Investor Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
