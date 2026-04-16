import React from 'react';

export default function Card({ title, description, children, className = '' }) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-soft ${className}`}>
      {(title || description) && (
        <header className="mb-4 space-y-1">
          {title ? <h3 className="text-lg font-semibold text-slate-900">{title}</h3> : null}
          {description ? <p className="text-sm text-slate-500">{description}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}
