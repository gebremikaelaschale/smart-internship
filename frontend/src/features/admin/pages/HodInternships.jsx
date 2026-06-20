import React, { useEffect, useState } from 'react';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';

export default function HodInternships() {
  const auth = useAuth();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ pending: 0, open: 0, closed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getInternships({ page: pagination.page, limit: pagination.limit, q: query || undefined, status });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || pagination);
        setSummary(data?.stats || { pending: 0, open: 0, closed: 0 });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'Failed to load internships.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [pagination.page, pagination.limit, query, status]);

  return (
    <div className="flex w-full flex-col space-y-8 pb-12">
      <section className="relative overflow-hidden bg-white border-b border-slate-100 pt-12 pb-8 px-6 lg:px-12 rounded-[20px]">
        <div className="relative w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-slate-900">Department Internships</h1>
            <p className="text-sm text-slate-500">Showing internships for <strong>{auth?.user?.department || auth?.user?.college || 'your department'}</strong></p>
          </div>
        </div>
      </section>

      <div className="w-full mx-auto px-1 space-y-6">
        <section className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50 p-4 rounded-[16px] border border-slate-100">
          <div className="relative w-full md:w-2/3">
            <input
              value={query}
              onChange={(e) => { setPagination((p) => ({ ...p, page: 1 })); setQuery(e.target.value); }}
              placeholder="Search internships by title or location..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 py-3 text-sm outline-none"
            />
            <svg className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            {[
              { key: 'all', label: `All (${Number(summary.pending || 0) + Number(summary.open || 0) + Number(summary.closed || 0)})` },
              { key: 'Pending', label: `Pending (${summary.pending || 0})` },
              { key: 'Open', label: `Open (${summary.open || 0})` },
              { key: 'Closed', label: `Closed (${summary.closed || 0})` }
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => { setPagination((p) => ({ ...p, page: 1 })); setStatus(tab.key); }}
                className={`rounded-xl px-4 py-2 text-sm font-black uppercase ${status === tab.key ? 'bg-white shadow-sm' : 'text-slate-600'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</p> : null}

        <div className="w-full rounded-[20px] border border-slate-100 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-6 py-4 text-sm font-black text-slate-600">Internship</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-600">Company</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-600">Location</th>
                  <th className="px-6 py-4 text-sm font-black text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan="4" className="px-6 py-12 text-center text-sm text-slate-400">No internships found for this department.</td>
                  </tr>
                )}
                {items.map((internship) => (
                  <tr key={internship._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">{internship.title || 'N/A'}</div>
                      <div className="text-xs text-slate-500">{new Date(internship.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{internship.companyId?.fullName || internship.companyId?.name || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{internship.location || 'Not specified'}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${String(internship.status || '').toLowerCase() === 'open' ? 'bg-emerald-50 text-emerald-700' : String(internship.status || '').toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        {internship.status || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.total > 0 && (
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white">
              <div className="text-xs font-black uppercase text-slate-500">Page {pagination.page} of {pagination.totalPages}</div>
              <div className="flex items-center gap-3">
                <button onClick={() => setPagination((p) => ({ ...p, page: Math.max(p.page - 1, 1) }))} disabled={pagination.page <= 1} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black">Prev</button>
                <button onClick={() => setPagination((p) => ({ ...p, page: Math.min(p.page + 1, pagination.totalPages) }))} disabled={pagination.page >= pagination.totalPages} className="rounded-xl bg-slate-900 text-white px-4 py-2 text-xs font-black">Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
