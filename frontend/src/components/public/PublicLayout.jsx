import React from 'react';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';

export default function PublicLayout({ children }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <PublicNavbar />
      <div className="h-16 lg:h-20" aria-hidden="true" />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}