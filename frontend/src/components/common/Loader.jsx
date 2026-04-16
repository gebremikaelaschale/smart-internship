import React from 'react';

export default function Loader({ label = 'Loading...', fullScreen = false }) {
  return (
    <div className={fullScreen ? 'flex min-h-screen items-center justify-center bg-slate-50' : 'flex items-center gap-3'}>
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      <span className="text-sm font-medium text-slate-600">{label}</span>
    </div>
  );
}
