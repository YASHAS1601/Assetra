import React from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminTopbar } from './AdminTopbar';

export const AdminLayout = ({ children }) => {
  return (
    <div className="app-layout">
      <AdminSidebar />
      <div className="main-viewport">
        <AdminTopbar />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;

