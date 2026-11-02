import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, role, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Authenticating session...
      </div>
    );
  }

  // Unauthenticated users visiting any internal route are redirected to /login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authenticated USER attempting to access ADMIN portal -> redirect to /user/dashboard
  if (requiredRole === 'ADMIN' && role !== 'ADMIN') {
    return <Navigate to="/user/dashboard" replace />;
  }

  // Authenticated ADMIN attempting to access investor-only dashboard/portfolio/registration -> redirect to /admin/dashboard
  if (role === 'ADMIN' && (!requiredRole || requiredRole === 'USER')) {
    const investorOnlyPaths = ['/user/dashboard', '/portfolio', '/register', '/verification-status'];
    if (investorOnlyPaths.includes(location.pathname)) {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return children;
};

// GuestRoute wraps /login, /user/login, /admin/login, /user/register
// If user is already authenticated, redirects them to their appropriate dashboard
export const GuestRoute = ({ children }) => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    if (role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    }
    return <Navigate to="/user/dashboard" replace />;
  }

  return children;
};

// RootRedirect handles http://localhost:5173/
export const RootRedirect = () => {
  const { isAuthenticated, role, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Navigate to="/user/dashboard" replace />;
};

export default ProtectedRoute;
