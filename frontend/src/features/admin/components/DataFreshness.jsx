import React from 'react';

function formatSyncedTime(value) {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

export default function DataFreshness({ value }) {
  return (
    <p className="text-xs font-medium text-slate-500">
      Last synced: <span className="font-semibold text-slate-700">{formatSyncedTime(value)}</span>
    </p>
  );
}
