import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Modal from '@/components/common/Modal';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import ExportReasonModal from '../components/ExportReasonModal';
import DataFreshness from '../components/DataFreshness';

function downloadCsvBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function Applications() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportApplications = adminType === 'superadmin' || adminType === 'collegeadmin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [remarksInput, setRemarksInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState({ pending: 0, underReview: 0, interview: 0, accepted: 0, rejected: 0 });

  useEffect(() => {
    if (!downloadNotice) return undefined;
    const timer = window.setTimeout(() => setDownloadNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [downloadNotice]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await adminAPI.getApplications({ page, limit: 10, q: query || undefined, status });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setSummary(data?.stats || { pending: 0, underReview: 0, interview: 0, accepted: 0, rejected: 0 });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load applications.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [page, query, status]);

  const updateStatus = async (id, nextStatus, remarks = '') => {
    try {
      setBusyId(String(id || ''));
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateApplicationStatus(id, { status: nextStatus, remarks });
      const updated = data?.item;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, status: updated.status, remarks: updated.remarks }
            : item
        )));
      }
      setMessage(`Application updated to ${nextStatus}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update application status.');
    } finally {
      setBusyId('');
    }
  };

  const runConfirmedStatusUpdate = async () => {
    if (!confirmAction?.id || !confirmAction?.status) return;
    const { id, status: nextStatus } = confirmAction;
    const remarks = String(remarksInput || '').trim();
    if (nextStatus === 'Rejected' && !remarks) {
      setModalError('Remarks are required when rejecting an application.');
      return;
    }

    setConfirmAction(null);
    setModalError('');
    setRemarksInput('');
    await updateStatus(id, nextStatus, remarks);
  };

  return (
    <Card title="Applications" description="Review and control application workflow.">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search by student or internship"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Under Review">Under Review</option>
          <option value="Interview">Interview</option>
          <option value="Accepted">Accepted</option>
          <option value="Rejected">Rejected</option>
        </select>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportApplications}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <p className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">Pending: {summary.pending}</p>
        <p className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-sm font-semibold text-cyan-700">Under Review: {summary.underReview}</p>
        <p className="rounded-full border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">Interview: {summary.interview}</p>
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Accepted: {summary.accepted}</p>
        <p className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700">Rejected: {summary.rejected}</p>
      </div>

      {!canExportApplications ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Applications export is restricted to SuperAdmin and CollegeAdmin.
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />
      {message ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading applications...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Student</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Match Score</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((application) => (
                <tr key={String(application?._id || '')}>
                  <td className="px-4 py-3">{application?.studentId?.fullName || application?.studentId?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{application?.studentId?.email || 'N/A'}</td>
                  <td className="px-4 py-3">{application?.internshipId?.title || 'N/A'}</td>
                  <td className="px-4 py-3">{application?.matchingScore ?? 0}%</td>
                  <td className="px-4 py-3">{application?.status || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ id: application?._id, status: 'Under Review', label: application?.internshipId?.title || 'this application' })}
                        disabled={busyId === String(application?._id || '')}
                        className="rounded-lg border border-cyan-200 bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700 disabled:opacity-50"
                      >
                        Review
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ id: application?._id, status: 'Accepted', label: application?.internshipId?.title || 'this application' })}
                        disabled={busyId === String(application?._id || '')}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ id: application?._id, status: 'Rejected', label: application?.internshipId?.title || 'this application' })}
                        disabled={busyId === String(application?._id || '')}
                        className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No applications found.</p> : null}

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

      <Modal
        open={Boolean(confirmAction)}
        title="Confirm Application Status Update"
        onClose={() => setConfirmAction(null)}
      >
        <p className="text-sm text-slate-700">
          Update <span className="font-semibold">{confirmAction?.label}</span> to <span className="font-semibold">{confirmAction?.status}</span>?
        </p>
        <div className="mt-3">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="application-status-remarks">
            Remarks (optional)
          </label>
          <textarea
            id="application-status-remarks"
            value={remarksInput}
            onChange={(event) => {
              setRemarksInput(event.target.value);
              if (modalError) setModalError('');
            }}
            rows={3}
            placeholder="Add decision context for audit and timeline..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          />
        </div>
        {modalError ? <p className="mt-2 text-sm text-rose-700">{modalError}</p> : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setConfirmAction(null);
              setRemarksInput('');
              setModalError('');
            }}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={runConfirmedStatusUpdate}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Confirm
          </button>
        </div>
      </Modal>

      <ExportReasonModal
        open={exportModalOpen}
        title="Export Applications CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportApplications({ q: query || undefined, status, reason });
            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            downloadCsvBlob(match?.[1] || `admin-applications-${Date.now()}.csv`, data);
            setDownloadNotice('Applications CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export applications CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />
    </Card>
  );
}
