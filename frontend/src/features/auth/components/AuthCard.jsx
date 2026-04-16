import React from 'react';
import Card from '@/components/ui/Card';

export default function AuthCard({ title, subtitle, children }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Authentication</p>
        <h2 className="text-3xl font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}
