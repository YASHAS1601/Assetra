import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Web3Provider } from './context/Web3Context';
import { AssetProvider } from './context/AssetContext';

// Layouts
import { UserLayout } from './components/layout/UserLayout';
import { AdminLayout } from './components/layout/AdminLayout';

// Public & Auth Pages
import { LoginSelection } from './pages/LoginSelection';
import { UserLogin } from './pages/UserLogin';
import { UserRegister } from './pages/UserRegister';
import { AdminLogin } from './pages/AdminLogin';
import { ProtectedRoute, GuestRoute, RootRedirect } from './components/auth/ProtectedRoute';

// User Portal Pages
import { Overview } from './pages/Overview';
import { Portfolio } from './pages/Portfolio';
import { ExploreAssets } from './pages/ExploreAssets';
import { RegisterAsset } from './pages/RegisterAsset';
import { AssetDetails } from './pages/AssetDetails';
import { Transactions } from './pages/Transactions';
import { Settings } from './pages/Settings';
import { VerificationStatus } from './pages/VerificationStatus';
import { BlockchainVerification } from './pages/BlockchainVerification';

// Dedicated Admin Portal Pages
import { AdminOverview } from './pages/admin/AdminOverview';
import { AdminPendingReviews } from './pages/admin/AdminPendingReviews';
import { AdminApprovedAssets } from './pages/admin/AdminApprovedAssets';
import { AdminTokenOwners } from './pages/admin/AdminTokenOwners';
import { AdminRejectedAssets } from './pages/admin/AdminRejectedAssets';
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs';
import { AdminSettings } from './pages/admin/AdminSettings';

import './styles/theme.css';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Assetra GlobalErrorBoundary caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px 24px', maxWidth: '780px', margin: '40px auto', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)', boxShadow: '0 10px 30px rgba(0,0,0,0.06)', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#991B1B', margin: '0 0 12px', fontSize: '20px' }}>Dashboard Display Notice</h2>
          <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '16px', lineHeight: 1.5 }}>
            A rendering issue was intercepted: <strong>{this.state.error?.message || String(this.state.error)}</strong>
          </p>
          <pre style={{ backgroundColor: '#F8FAFC', padding: '14px', borderRadius: '8px', fontSize: '12px', color: '#B91C1C', overflowX: 'auto', marginBottom: '20px', whiteSpace: 'pre-wrap' }}>
            {this.state.error?.stack || String(this.state.error)}
          </pre>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              window.location.reload();
            }}
            style={{ padding: '10px 22px', backgroundColor: '#B9653A', color: '#FFFFFF', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
          >
            Reload Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  return (
    <GlobalErrorBoundary>
      <AuthProvider>
        <Web3Provider>
          <AssetProvider>
            <BrowserRouter>
              <GlobalErrorBoundary>
                <Routes>
              {/* Direct root redirect to Portal Selection / Login */}
              <Route path="/" element={<Navigate to="/login" replace />} />
              <Route path="/home" element={<Navigate to="/login" replace />} />

              {/* Public Auth Routes */}
              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <LoginSelection />
                  </GuestRoute>
                }
              />
              <Route
                path="/user/login"
                element={
                  <GuestRoute>
                    <UserLogin />
                  </GuestRoute>
                }
              />
              <Route
                path="/user/register"
                element={
                  <GuestRoute>
                    <UserRegister />
                  </GuestRoute>
                }
              />
              <Route
                path="/admin/login"
                element={
                  <GuestRoute>
                    <AdminLogin />
                  </GuestRoute>
                }
              />

              {/* User Application Routes (wrapped in UserLayout) */}
              <Route
                path="/preview-dashboard"
                element={
                  <UserLayout>
                    <Overview />
                  </UserLayout>
                }
              />
              <Route
                path="/user/dashboard"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <Overview />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/portfolio"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <Portfolio />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/explore"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <ExploreAssets />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <RegisterAsset />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verification-status"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <VerificationStatus />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/blockchain-verification"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <BlockchainVerification />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/asset/:id"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <AssetDetails />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/transactions"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <Transactions />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <UserLayout>
                      <Settings />
                    </UserLayout>
                  </ProtectedRoute>
                }
              />
              <Route path="/verify" element={<Navigate to="/portfolio" replace />} />

              {/* Administrator Portal Routes (wrapped in AdminLayout, strictly guarded by ADMIN role) */}
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminOverview />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/pending"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminPendingReviews />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/approved"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminApprovedAssets />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/token-owners"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminTokenOwners />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/rejected"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminRejectedAssets />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/blockchain"
                element={<Navigate to="/admin/pending" replace />}
              />
              <Route
                path="/admin/audit-logs"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminAuditLogs />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <AdminSettings />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/blockchain-verification"
                element={
                  <ProtectedRoute requiredRole="ADMIN">
                    <AdminLayout>
                      <BlockchainVerification />
                    </AdminLayout>
                  </ProtectedRoute>
                }
              />

              {/* Aliases */}
              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/dashboard" element={<RootRedirect />} />
              <Route path="/register-user" element={<Navigate to="/user/register" replace />} />

              {/* Catch-all unauthenticated redirect to /login */}
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </GlobalErrorBoundary>
        </BrowserRouter>
        </AssetProvider>
      </Web3Provider>
    </AuthProvider>
  </GlobalErrorBoundary>
  );
}

export default App;
