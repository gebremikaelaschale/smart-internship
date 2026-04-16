import React, { useEffect, useMemo, useState } from 'react';
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

export default function Internships() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canManageInternshipStatus = adminType === 'superadmin' || adminType === 'collegeadmin';
  const canExportInternships = adminType === 'superadmin' || adminType === 'collegeadmin';

  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ pending: 0, open: 0, closed: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'Pending', label: 'Pending Review' },
    { key: 'Open', label: 'Approved' },
    { key: 'Closed', label: 'Rejected' }
  ];

  const activePrograms = useMemo(() => Number(summary?.open || 0), [summary]);

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
        const { data } = await adminAPI.getInternships({ page, limit: 10, q: query || undefined, status });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setSummary(data?.stats || { pending: 0, open: 0, closed: 0 });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load internships.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [page, query, status]);

  const updateStatus = async (id, nextStatus) => {
    try {
      setBusyId(String(id || ''));
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateInternshipStatus(id, { status: nextStatus });
      const updated = data?.item;

      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, status: updated.status }
            : item
        )));
      }

      setMessage(`Internship updated to ${nextStatus}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update internship status.');
    } finally {
      setBusyId('');
    }
  };

  const runConfirmedStatusUpdate = async () => {
    if (!confirmAction?.id || !confirmAction?.status) return;
    const { id, status: nextStatus } = confirmAction;
    const actionLabel = String(confirmAction?.actionLabel || 'Update').toLowerCase();
    setConfirmAction(null);
    await updateStatus(id, nextStatus);
    if (actionLabel === 'approve') {
      setSummary((prev) => ({ ...prev, pending: Math.max(Number(prev.pending || 0) - 1, 0), open: Number(prev.open || 0) + 1 }));
    } else if (actionLabel === 'reject') {
      setSummary((prev) => ({ ...prev, pending: Math.max(Number(prev.pending || 0) - 1, 0), closed: Number(prev.closed || 0) + 1 }));
    }
  };

  return (
    <Card title="Internships" description="Oversee internship lifecycle and publication flow.">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search internship"
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
          <option value="Open">Approved</option>
          <option value="Closed">Rejected</option>
        </select>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportInternships}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <p className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
          Active programs: {activePrograms}
        </p>
        <p className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          Pending review: {summary.pending}
        </p>
        <div className="flex flex-wrap gap-2">
          {statusTabs.map((tab) => {
            const isActive = status === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setPage(1);
                  setStatus(tab.key);
                }}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {!canManageInternshipStatus ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Internship status changes are allowed for SuperAdmin and CollegeAdmin only.
        </p>
      ) : null}

      {!canExportInternships ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Internships export is restricted to SuperAdmin and CollegeAdmin.
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />
      {message ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading internships...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Title</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((internship) => {
                const currentStatus = String(internship?.status || '').toLowerCase();
                return (
                  <tr key={String(internship?._id || '')}>
                    <td className="px-4 py-3">{internship?.title || 'N/A'}</td>
                    <td className="px-4 py-3">{internship?.companyId?.fullName || internship?.companyId?.name || internship?.companyId?.email || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${currentStatus === 'open' ? 'bg-emerald-100 text-emerald-700' : currentStatus === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {internship?.status || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: internship?._id, status: 'Open', title: internship?.title || 'this internship', actionLabel: 'Approve' })}
                          disabled={!canManageInternshipStatus || busyId === String(internship?._id || '')}
                          className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmAction({ id: internship?._id, status: 'Closed', title: internship?.title || 'this internship', actionLabel: 'Reject' })}
                          disabled={!canManageInternshipStatus || busyId === String(internship?._id || '')}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No internships found.</p> : null}

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
        title="Confirm Internship Decision"
        onClose={() => setConfirmAction(null)}
      >
        <p className="text-sm text-slate-700">
          {confirmAction?.actionLabel || 'Update'} internship <span className="font-semibold">{confirmAction?.title}</span>?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setConfirmAction(null)}
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
        title="Export Internships CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportInternships({ q: query || undefined, status, reason });
            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            downloadCsvBlob(match?.[1] || `admin-internships-${Date.now()}.csv`, data);
            setDownloadNotice('Internships CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export internships CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />
    </Card>
  );
}
