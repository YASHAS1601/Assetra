import React from 'react';
import { useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { AssetraDoodleBackground } from '../common/AssetraDoodleBackground';

export const Layout = ({ children }) => {
  const location = useLocation();
  const isAuthPage = ['/login', '/user/login', '/admin/login', '/user/register'].includes(location.pathname);

  if (location.pathname === '/login') {
    return <>{children}</>;
  }

  if (isAuthPage) {
    return (
      <div
        style={{
          minHeight: '100vh',
          backgroundColor: 'var(--bg-app)',
          background: 'var(--bg-app-tint)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '24px 16px',
          position: 'relative',
          overflowX: 'hidden'
        }}
      >
        <AssetraDoodleBackground theme="light" opacity={0.07} />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', justifyContent: 'center' }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-viewport">
        <Topbar />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;

