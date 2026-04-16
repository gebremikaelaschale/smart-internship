import React from 'react';

export default function DataFreshness({ value }) {
  if (!value) return null;

  return (
    <p className="text-xs text-slate-500">
      Last refreshed: <span className="font-medium text-slate-700">{value}</span>
    </p>
  );
}
