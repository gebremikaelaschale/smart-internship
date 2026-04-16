import React from 'react';

export default function Input({ label, error, className = '', ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-slate-700">{label}</span> : null}
      <input
        className={`w-full rounded-xl border bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-2 ${
          error 
            ? 'border-red-500 focus:border-red-500 focus:ring-red-100' 
            : 'border-slate-200 focus:border-brand-500 focus:ring-brand-100'
        } ${className}`}
        {...props}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
