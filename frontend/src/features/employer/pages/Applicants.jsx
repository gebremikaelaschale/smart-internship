import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { employerAPI } from '../employerAPI';
import ProgramSubNav from '../components/ProgramSubNav';

function statusPill(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'placed' || value === 'accepted') return 'bg-emerald-100 text-emerald-700';
  if (value === 'rejected') return 'bg-rose-100 text-rose-700';
  if (value === 'shortlisted') return 'bg-violet-100 text-violet-700';
  if (value === 'interview') return 'bg-indigo-100 text-indigo-700';
  if (value === 'under review') return 'bg-cyan-100 text-cyan-700';
  return 'bg-amber-100 text-amber-700';
}

export default function Applicants() {
  const [searchParams] = useSearchParams();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const programId = String(searchParams.get('programId') || '').trim();

  useEffect(() => {
    let active = true;

    const loadApplicants = async () => {
      try {
        setLoading(true);
        setError('');
        setMessage('');
        const { data } = await employerAPI.getApplicants();
        if (!active) return;
        setApplications(Array.isArray(data) ? data : []);
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load applicants.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadApplicants();
    return () => {
      active = false;
    };
  }, []);

  const filteredApplications = useMemo(() => {
    if (!programId) {
      return applications;
    }

    return applications.filter(
      (application) => String(application?.internshipId?._id || '') === programId
    );
  }, [applications, programId]);

  const updateStatus = async (applicationId, status) => {
    try {
      setBusyId(String(applicationId || ''));
      setError('');
      setMessage('');
      const { data } = await employerAPI.updateApplicationStatus(applicationId, { status, remarks: '' });
      const finalStatus = data?.status || status; // Backend might map Accepted -> Placed
      setApplications((prev) => prev.map((item) => (
        String(item?._id || '') === String(applicationId || '')
          ? { ...item, status: finalStatus }
          : item
      )));
      setMessage(`Application updated to ${finalStatus}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update application status.');
    } finally {
      setBusyId('');
    }
  };

  return (
    <div className="space-y-6">
      <ProgramSubNav />

      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-slate-900">Applicants</h2>
        <button 
          onClick={() => window.history.back()}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-100 transition hover:bg-emerald-700 active:scale-95"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to List
        </button>
      </div>

      <Card title="Program Applications" description="Review and manage student applications for your internship programs.">
      {programId ? <p className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Currently viewing applications for a specific program.</p> : null}
      {error ? <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {loading ? <p className="text-sm text-slate-500">Loading applicants...</p> : null}

      {!loading && filteredApplications.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">No applicants found.</p>
      ) : null}

      {!loading && filteredApplications.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Skills</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">CV</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredApplications.map((application) => {
                const appId = String(application?._id || '');
                const name = application?.studentId?.fullName || 'Unnamed Student';
                const department = application?.studentProfile?.department || 'N/A';
                const skills = Array.isArray(application?.studentProfile?.skills)
                  ? application.studentProfile.skills.filter(Boolean)
                  : [];
                const cvUrl = application?.studentProfile?.resumeUrl || application?.resumeUrl || '';
                const status = application?.status || 'Pending';
                const busy = busyId === appId;

                return (
                  <tr key={appId}>
                    <td className="px-4 py-3 text-slate-800">{name}</td>
                    <td className="px-4 py-3 text-slate-700">{department}</td>
                    <td className="px-4 py-3 text-slate-700">{skills.length > 0 ? skills.slice(0, 3).join(', ') : 'N/A'}</td>
                    <td className="px-4 py-3">
                      {cvUrl ? (
                        <a
                          href={cvUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <span aria-hidden="true">📄</span>
                          Open
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">No CV</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPill(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {status !== 'Placed' && status !== 'Rejected' && (
                          <>
                            {status === 'Shortlisted' && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => updateStatus(application?._id, 'Interview')}
                                className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 disabled:opacity-60"
                              >
                                Set Interview
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateStatus(application?._id, 'Accepted')}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => updateStatus(application?._id, 'Rejected')}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {(status === 'Placed' || status === 'Rejected') && (
                          <span className="text-[10px] font-bold uppercase text-slate-400">Finalized</span>
                        )}
                      </div>
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
