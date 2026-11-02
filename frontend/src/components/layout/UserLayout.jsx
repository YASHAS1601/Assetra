import React from 'react';
import { UserSidebar } from './UserSidebar';
import { UserTopbar } from './UserTopbar';

export const UserLayout = ({ children }) => {
  return (
    <div className="app-layout">
      <UserSidebar />
      <div className="main-viewport">
        <UserTopbar />
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default UserLayout;

