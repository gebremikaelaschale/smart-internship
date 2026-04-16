import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import DataFreshness from '../components/DataFreshness';

const STATUS_OPTIONS = [
  'all',
  'Pending Evaluation',
  'Awaiting Admin Verification',
  'Verified - Ready to Issue',
  'Issued',
  'Verification Rejected'
];

function statusPillClass(status) {
  if (status === 'Issued') return 'bg-emerald-100 text-emerald-700';
  if (status === 'Verified - Ready to Issue') return 'bg-sky-100 text-sky-700';
  if (status === 'Awaiting Admin Verification') return 'bg-amber-100 text-amber-700';
  if (status === 'Verification Rejected') return 'bg-rose-100 text-rose-700';
  return 'bg-slate-100 text-slate-700';
}

export default function Certificates() {
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    pendingEvaluation: 0,
    awaitingVerification: 0,
    verifiedReadyToIssue: 0,
    issued: 0,
    verificationRejected: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [workingId, setWorkingId] = useState('');
  const [noteById, setNoteById] = useState({});

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await adminAPI.getCertificates({ page, limit: 10, q: query || undefined, status });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setStats({
        pendingEvaluation: Number(data?.stats?.pendingEvaluation || 0),
        awaitingVerification: Number(data?.stats?.awaitingVerification || 0),
        verifiedReadyToIssue: Number(data?.stats?.verifiedReadyToIssue || 0),
        issued: Number(data?.stats?.issued || 0),
        verificationRejected: Number(data?.stats?.verificationRejected || 0)
      });
      setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      setLastRefreshed(new Date().toLocaleString());
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to load certificates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page, query, status]);

  const verify = async (applicationId, nextStatus) => {
    try {
      setWorkingId(applicationId);
      setError('');
      await adminAPI.verifyCertificate(applicationId, {
        status: nextStatus,
        note: noteById[applicationId] || ''
      });
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to verify certificate.');
    } finally {
      setWorkingId('');
    }
  };

  const issueCertificate = async (applicationId) => {
    try {
      setWorkingId(applicationId);
      setError('');
      await adminAPI.issueCertificate(applicationId);
      await load();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to issue certificate.');
    } finally {
      setWorkingId('');
    }
  };

  return (
    <Card title="Certificates" description="Internship completed -> company evaluates -> admin verifies -> certificate generated.">
      <DataFreshness value={lastRefreshed} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="text-slate-500">Pending Evaluation</p>
          <p className="text-xl font-semibold text-slate-900">{stats.pendingEvaluation}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="text-amber-700">Awaiting Verification</p>
          <p className="text-xl font-semibold text-amber-800">{stats.awaitingVerification}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm">
          <p className="text-sky-700">Ready to Issue</p>
          <p className="text-xl font-semibold text-sky-800">{stats.verifiedReadyToIssue}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm">
          <p className="text-emerald-700">Issued</p>
          <p className="text-xl font-semibold text-emerald-800">{stats.issued}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
          <p className="text-rose-700">Rejected</p>
          <p className="text-xl font-semibold text-rose-800">{stats.verificationRejected}</p>
        </div>
      </div>
      <div className="mb-4">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search student or internship"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm md:w-72"
        />
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className="mt-2 rounded-xl border border-slate-200 px-3 py-2 text-sm md:mt-0 md:ml-3"
        >
          {STATUS_OPTIONS.map((item) => (
            <option key={item} value={item}>{item === 'all' ? 'All statuses' : item}</option>
          ))}
        </select>
      </div>

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading certificates...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Issue Certificate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => {
                const applicationId = String(item?._id || '');
                const certificateStatus = item?.certificateStatus || 'Pending Evaluation';
                const isBusy = workingId === applicationId;
                const readyForVerify = certificateStatus === 'Awaiting Admin Verification';
                const readyForIssue = certificateStatus === 'Verified - Ready to Issue';

                return (
                  <tr key={applicationId}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{item?.studentId?.fullName || item?.studentId?.name || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{item?.studentId?.email || 'N/A'}</p>
                    </td>
                    <td className="px-4 py-3">{item?.internshipId?.title || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass(certificateStatus)}`}>
                        {certificateStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {readyForVerify ? (
                        <div className="space-y-2">
                          <input
                            value={noteById[applicationId] || ''}
                            onChange={(event) => setNoteById((prev) => ({ ...prev, [applicationId]: event.target.value }))}
                            placeholder="Verification note (optional)"
                            className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => verify(applicationId, 'Verified')}
                              disabled={isBusy}
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => verify(applicationId, 'Rejected')}
                              disabled={isBusy}
                              className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {readyForIssue ? (
                        <button
                          type="button"
                          onClick={() => issueCertificate(applicationId)}
                          disabled={isBusy}
                          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 disabled:opacity-50"
                        >
                          {isBusy ? 'Issuing...' : 'Issue Certificate'}
                        </button>
                      ) : null}

                      {certificateStatus === 'Issued' ? (
                        <span className="text-xs text-emerald-700">Certificate generated</span>
                      ) : null}

                      {certificateStatus === 'Pending Evaluation' ? (
                        <span className="text-xs text-slate-500">Waiting for company evaluation</span>
                      ) : null}

                      {certificateStatus === 'Verification Rejected' ? (
                        <span className="text-xs text-rose-700">Admin rejected verification</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No certificate records found.</p> : null}

      {!loading && pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={pagination.page <= 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(prev + 1, pagination.totalPages))}
              disabled={pagination.page >= pagination.totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}
