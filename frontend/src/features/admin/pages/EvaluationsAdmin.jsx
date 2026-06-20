import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';

export default function EvaluationsAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const loadEvaluations = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await adminAPI.getEvaluations({ page, limit: 10 });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      setError('Failed to load evaluations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvaluations();
  }, [page]);

  return (
    <Card title="Student Evaluations" description="View performance reviews and grades submitted by employer supervisors.">
      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Loading evaluations...</p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              No evaluations found.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">College / Dept</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 text-center">Rating</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 text-center">Score</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Supervisor Feedback</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((ev) => (
                    <tr key={ev._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">{ev.studentId?.fullName || ev.studentId?.name || 'Unknown'}</div>
                        <div className="text-xs text-slate-500">{ev.studentId?.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700">{ev.studentId?.college || '-'}</div>
                        <div className="text-xs text-slate-500">{ev.studentId?.department || '-'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 font-medium">{ev.internshipId?.title || 'Internship'}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center text-amber-500">
                          {'★'.repeat(ev.performanceRating)}{'☆'.repeat(5 - ev.performanceRating)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${ev.score >= 80 ? 'bg-green-100 text-green-700' : ev.score >= 50 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                          {ev.score}%
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-slate-600 max-w-xs" title={ev.comments}>{ev.comments}</p>
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(ev.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                            type="button"
                            onClick={() => window.open(`http://localhost:5000/api/evaluation/admin/${ev._id}/download-pdf`, '_blank')}
                            className="inline-flex items-center justify-center rounded-lg bg-brand-50 text-brand-700 px-3 py-1.5 text-xs font-bold transition-all hover:bg-brand-600 hover:text-white"
                        >
                            Download PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Strategic Pagination System */}
          {pagination.total > 0 && (
            <div className="mt-8 px-8 py-8 border-t border-slate-100 flex items-center justify-between bg-white -mx-6 -mb-6 rounded-b-2xl">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                  Page <span className="text-slate-900">{pagination.page}</span> of <span className="text-slate-900">{pagination.totalPages}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={pagination.page <= 1 || loading}
                  className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-900 disabled:opacity-20 disabled:cursor-not-allowed shadow-sm"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="rounded-xl border border-slate-900 bg-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-slate-800 disabled:opacity-20 disabled:cursor-not-allowed shadow-lg"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
