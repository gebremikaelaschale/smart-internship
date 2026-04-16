import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown time';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function typeBadge(type) {
  const value = String(type || '').toLowerCase();
  if (value === 'application') return 'bg-cyan-100 text-cyan-700';
  if (value === 'internship-started') return 'bg-amber-100 text-amber-700';
  if (value === 'evaluation') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-700';
}

export default function Activity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  useEffect(() => {
    setPage(1);
  }, [typeFilter, fromDate, toDate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await employerAPI.getActivityFeed({
          page,
          limit: 10,
          type: typeFilter,
          from: fromDate || undefined,
          to: toDate || undefined
        });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load activity feed.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [page, typeFilter, fromDate, toDate]);

  return (
    <Card title="Recent Activity" description="Full activity feed connected to database events.">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="all">All Types</option>
          <option value="application">New student applied</option>
          <option value="internship-started">Internship started</option>
          <option value="evaluation">Evaluation submitted</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(event) => setFromDate(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => setToDate(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setTypeFilter('all');
            setFromDate('');
            setToDate('');
          }}
        >
          Reset Filters
        </Button>
      </div>

      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading activity...</p> : null}

      {!loading && items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No activity found.</p>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <article key={item.id || `${item.type}-${item.timestamp}`} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title || 'Activity'}</p>
                <p className="mt-1 text-sm text-slate-600">{item.description || 'No details available.'}</p>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeBadge(item.type)}`}>
                {String(item.type || 'activity').replace('-', ' ')}
              </span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{formatDateTime(item.timestamp)}</p>
          </article>
        ))}
      </div>

      {!loading && pagination.totalPages > 1 ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>Previous</Button>
            <Button type="button" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((prev) => Math.min(pagination.totalPages, prev + 1))}>Next</Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
