import React from 'react';

export default function Sidebar({ brand, description, children, footer }) {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-950 text-white lg:flex lg:flex-col">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="text-xs uppercase tracking-[0.3em] text-brand-300">{brand}</div>
        {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
      </div>
      <nav className="flex-1 space-y-1 px-4 py-4">{children}</nav>
      {footer ? <div className="border-t border-white/10 px-6 py-4 text-sm text-slate-400">{footer}</div> : null}
    </aside>
  );
}
