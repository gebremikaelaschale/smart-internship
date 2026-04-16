import React, { useEffect, useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import { studentAPI } from '../studentAPI';

function getTracking(status) {
  const normalized = String(status || 'Pending').toLowerCase();
  const seen = normalized !== 'pending';
  const shortlisted = ['interview', 'accepted'].includes(normalized);
  return { seen, shortlisted };
}

export default function Applications() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await studentAPI.getApplications();
        if (active) setApplications(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.message || 'Unable to fetch applications.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, []);

  const quick = useMemo(() => {
    let seen = 0;
    let shortlisted = 0;

    applications.forEach((application) => {
      const state = getTracking(application?.status);
      if (state.seen) seen += 1;
      if (state.shortlisted) shortlisted += 1;
    });

    return { seen, shortlisted };
  }, [applications]);

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-violet-100 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_40%),linear-gradient(180deg,#f5f3ff_0%,#ffffff_60%)] p-6 shadow-[0_20px_60px_rgba(76,29,149,0.12)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-700">Application Hub</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Your Applications</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Monitor every submitted application and track statuses in real time from the backend.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-violet-100 bg-white px-4 py-2 text-sm text-slate-600">
              Total submissions: <span className="font-semibold text-slate-900">{applications.length}</span>
            </span>
            <span className="rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm text-sky-700">
              Seen: <span className="font-semibold">{quick.seen}</span>
            </span>
            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
              Shortlisted: <span className="font-semibold">{quick.shortlisted}</span>
            </span>
          </div>
        </div>
      </section>

      {loading ? <Loader label="Loading applications" /> : null}
      {error ? <ErrorMessage message={error} /> : null}

      {!loading && applications.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-sm text-slate-500">
          You have not submitted any applications yet.
        </p>
      ) : null}

      <div className="space-y-3">
        {applications.map((application) => (
          <Card key={application._id} className="rounded-2xl border-slate-200 bg-white">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-900">{application?.internshipId?.title || 'Internship application'}</p>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">{application.status || 'Pending'}</span>
            </div>
            <p className="mt-1 text-sm text-slate-500">{application?.internshipId?.location || 'Location not specified'}</p>
            <p className="mt-2 text-xs text-slate-500">Applied: {new Date(application.createdAt).toLocaleDateString()}</p>

            {(() => {
              const tracking = getTracking(application?.status);
              return (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tracking.seen ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                    {tracking.seen ? 'Seen' : 'Not seen yet'}
                  </span>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tracking.shortlisted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                    {tracking.shortlisted ? 'Shortlisted' : 'Awaiting shortlist'}
                  </span>
                </div>
              );
            })()}
          </Card>
        ))}
      </div>
    </div>
  );
}
