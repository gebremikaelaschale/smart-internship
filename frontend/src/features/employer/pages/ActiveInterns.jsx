import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';

function progressColor(progress) {
  if (progress >= 80) return 'bg-emerald-500';
  if (progress >= 40) return 'bg-cyan-500';
  return 'bg-amber-500';
}

function statusPill(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'active') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-200 text-slate-700';
}

export default function ActiveInterns() {
  const [interns, setInterns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadInterns = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await employerAPI.getActiveInterns();
        if (!active) return;
        setInterns(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (!active) return;
        const responseData = requestError?.response?.data;
        setError(
          requestError?.response?.data?.message
            || (typeof responseData === 'string' ? responseData : '')
            || 'Failed to load active interns.'
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInterns();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <ProgramSubNav />

      <Card title="Active Interns" description="Accepted interns and their live progress from tasks.">
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading active interns...</p> : null}

      {!loading && interns.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No active interns found.</p>
      ) : null}

      {!loading && interns.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Progress</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {interns.map((item) => {
                const progress = Number(item?.progress || 0);
                return (
                  <tr key={String(item?.applicationId || `${item?.student?.id}-${item?.internship?.id}`)}>
                    <td className="px-4 py-3 text-slate-800">{item?.student?.name || 'Unnamed Student'}</td>
                    <td className="px-4 py-3 text-slate-700">{item?.internship?.title || 'Unknown Internship'}</td>
                    <td className="px-4 py-3">
                      <div className="w-40">
                        <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                          <span>{progress}%</span>
                          <span>{item?.tasks?.completed || 0}/{item?.tasks?.total || 0}</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full ${progressColor(progress)}`}
                            style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(item?.status)}`}>
                        {item?.status || 'Active'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
    </div>
  );
}
