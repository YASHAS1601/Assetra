import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AssetraDoodleBackground } from '../components/common/AssetraDoodleBackground';
import { Shield, Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';


export const Login = () => {
  const navigate = useNavigate();
  const { login, isLoading, error } = useAuth();

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
      setLocalError('Please fill in all required credentials.');
      return;
    }

    try {
      const authenticatedUser = await login(email, password);
      setSuccessMsg(`Welcome, ${authenticatedUser.fullName || authenticatedUser.email}! Directing to your portal...`);
      setTimeout(() => {
        if (authenticatedUser.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else {
          navigate('/user/dashboard');
        }
      }, 700);
    } catch (err) {
      setLocalError(err.message || 'Invalid authentication credentials.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-warm-white, #F2EEE7)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 16px', position: 'relative', overflowX: 'hidden' }}>
      <AssetraDoodleBackground theme="light" opacity={0.07} />
      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 2 }}>

        <div
          style={{
            padding: '44px 40px',
            backgroundColor: '#FFFFFF',
            borderRadius: '28px',
            boxShadow: 'var(--shadow-card)'
          }}
        >
          {/* Brand Icon Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                backgroundColor: 'var(--color-navy)',
                color: 'var(--color-copper)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                borderRadius: '50%',
                fontWeight: 700,
                fontSize: '18px',
                boxShadow: '0 4px 14px rgba(16,27,45,0.15)'
              }}
            >
              AS
            </div>
            <h1
              className="font-serif"
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: 'var(--color-charcoal)',
                marginBottom: '6px',
                letterSpacing: '-0.02em'
              }}
            >
              Protocol Authentication
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--color-secondary-text)', lineHeight: 1.5 }}>
              Sign in to access your investment portfolio or verification workspace.
            </p>
          </div>

          {/* Alerts */}
          {(localError || error) && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: '#FEE2E2',
                borderRadius: '16px',
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{localError || error}</span>
            </div>
          )}

          {successMsg && (
            <div
              style={{
                padding: '14px 18px',
                backgroundColor: 'var(--color-mint)',
                borderRadius: '16px',
                color: '#1B6A4C',
                fontSize: '13px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit}>
            <div className="input-group" style={{ marginBottom: '20px' }}>
              <label className="input-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Account Email
              </label>
              <div style={{ position: 'relative' }}>
                <Mail
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
                  type="email"
                  required
                  placeholder="name@company.com"
                  style={{
                    width: '100%',
                    padding: '12px 16px 12px 44px',
                    fontSize: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid rgba(0,0,0,0.04)',
                    borderRadius: '16px',
                    color: 'var(--color-charcoal)',
                    outline: 'none'
                  }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group" style={{ marginBottom: '28px' }}>
              <label className="input-label" style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock
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
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '12px 44px 12px 44px',
                    fontSize: '14px',
                    backgroundColor: '#F8FAFC',
                    border: '1px solid rgba(0,0,0,0.04)',
                    borderRadius: '16px',
                    color: 'var(--color-charcoal)',
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
                    color: 'var(--color-secondary-text)',
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
                height: '46px',
                backgroundColor: 'var(--color-navy)',
                border: 'none',
                color: '#FFFFFF',
                borderRadius: '9999px',
                fontSize: '14px',
                fontWeight: 600,
                letterSpacing: '0.02em',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 16px rgba(16,27,45,0.15)'
              }}
              disabled={isLoading}
            >
              <span>{isLoading ? 'Verifying Credentials...' : 'Sign In'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Footer */}
          <div
            style={{
              borderTop: '1px solid rgba(0,0,0,0.04)',
              marginTop: '32px',
              paddingTop: '20px',
              textAlign: 'center',
              fontSize: '13px',
              color: 'var(--color-secondary-text)'
            }}
          >
            Don't have an account?{' '}
            <Link to="/user/register" style={{ color: 'var(--color-copper)', fontWeight: 600, textDecoration: 'none' }}>
              Create Investor Account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
