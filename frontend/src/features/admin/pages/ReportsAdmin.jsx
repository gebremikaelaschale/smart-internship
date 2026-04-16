import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import ExportReasonModal from '../components/ExportReasonModal';

function formatDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Unknown time';
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function actionBadgeClass(action) {
  const value = String(action || '').toUpperCase();
  if (value === 'ADMIN_COMPANY_VERIFICATION_UPDATED') return 'bg-indigo-100 text-indigo-700';
  if (value === 'ADMIN_INTERNSHIP_STATUS_UPDATED') return 'bg-cyan-100 text-cyan-700';
  if (value === 'ADMIN_APPLICATION_STATUS_UPDATED') return 'bg-emerald-100 text-emerald-700';
  if (value === 'ADMIN_REPORT_GENERATED') return 'bg-fuchsia-100 text-fuchsia-700';
  if (value.startsWith('ADMIN_EXPORT_')) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

function actionLabel(action) {
  const value = String(action || '').toUpperCase();
  if (value === 'ADMIN_COMPANY_VERIFICATION_UPDATED') return 'Company Verification Updated';
  if (value === 'ADMIN_INTERNSHIP_STATUS_UPDATED') return 'Internship Status Updated';
  if (value === 'ADMIN_APPLICATION_STATUS_UPDATED') return 'Application Status Updated';
  if (value === 'ADMIN_REPORT_GENERATED') return 'Report Generated';
  if (value === 'ADMIN_EXPORT_USERS') return 'Users Exported';
  if (value === 'ADMIN_EXPORT_STUDENTS') return 'Students Exported';
  if (value === 'ADMIN_EXPORT_COMPANIES') return 'Companies Exported';
  if (value === 'ADMIN_EXPORT_INTERNSHIPS') return 'Internships Exported';
  if (value === 'ADMIN_EXPORT_APPLICATIONS') return 'Applications Exported';
  if (value === 'ADMIN_EXPORT_AUDIT_LOGS') return 'Audit Logs Exported';
  return action || 'Unknown';
}

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

export default function ReportsAdmin() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportAuditLogs = adminType === 'superadmin';

  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({
    internships: 0,
    internshipPending: 0,
    internshipOpen: 0,
    internshipClosed: 0,
    applications: 0,
    acceptedApplications: 0,
    acceptanceRate: 0,
    reportsSubmitted: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

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

        const [{ data }, { data: statsData }] = await Promise.all([
          adminAPI.getAuditLogs({
            page,
            limit: 15,
            q: query || undefined,
            action,
            from: fromDate || undefined,
            to: toDate || undefined
          }),
          adminAPI.getInternshipStatistics()
        ]);

        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
        setStats({
          internships: Number(statsData?.summary?.internships || 0),
          internshipPending: Number(statsData?.summary?.internshipPending || 0),
          internshipOpen: Number(statsData?.summary?.internshipOpen || 0),
          internshipClosed: Number(statsData?.summary?.internshipClosed || 0),
          applications: Number(statsData?.summary?.applications || 0),
          acceptedApplications: Number(statsData?.summary?.acceptedApplications || 0),
          acceptanceRate: Number(statsData?.summary?.acceptanceRate || 0),
          reportsSubmitted: Number(statsData?.summary?.reportsSubmitted || 0)
        });
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || requestError?.response?.data?.error || 'Failed to load report center.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [page, query, action, fromDate, toDate]);

  const generateSnapshot = async () => {
    try {
      setGenerating(true);
      setError('');
      const { data } = await adminAPI.generateReport({ name: 'Internship Statistics Snapshot' });
      const metrics = data?.report?.metrics || {};
      setDownloadNotice(`Report generated. Acceptance Rate: ${Number(metrics.acceptanceRate || 0)}%`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to generate report snapshot.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card title="Reports" description="Generate reports and monitor internship statistics with audit traceability.">
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total Internships</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.internships.toLocaleString()}</p>
          <p className="text-xs text-slate-600">Pending {stats.internshipPending} | Open {stats.internshipOpen} | Closed {stats.internshipClosed}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Applications</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.applications.toLocaleString()}</p>
          <p className="text-xs text-slate-600">Accepted {stats.acceptedApplications.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Acceptance Rate</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-700">{stats.acceptanceRate}%</p>
          <p className="text-xs text-slate-600">Based on current application outcomes</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs uppercase tracking-wide text-slate-500">Student Reports</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{stats.reportsSubmitted.toLocaleString()}</p>
          <p className="text-xs text-slate-600">Weekly/final reports submitted</p>
        </div>
      </div>

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search action or details"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={action}
          onChange={(event) => {
            setPage(1);
            setAction(event.target.value);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All actions</option>
          <option value="ADMIN_COMPANY_VERIFICATION_UPDATED">Company Verification Updated</option>
          <option value="ADMIN_INTERNSHIP_STATUS_UPDATED">Internship Status Updated</option>
          <option value="ADMIN_APPLICATION_STATUS_UPDATED">Application Status Updated</option>
          <option value="ADMIN_EXPORT_USERS">Users Exported</option>
          <option value="ADMIN_EXPORT_STUDENTS">Students Exported</option>
          <option value="ADMIN_EXPORT_COMPANIES">Companies Exported</option>
          <option value="ADMIN_EXPORT_INTERNSHIPS">Internships Exported</option>
          <option value="ADMIN_EXPORT_APPLICATIONS">Applications Exported</option>
          <option value="ADMIN_EXPORT_AUDIT_LOGS">Audit Logs Exported</option>
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(event) => {
            setPage(1);
            setFromDate(event.target.value);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={toDate}
          onChange={(event) => {
            setPage(1);
            setToDate(event.target.value);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
      </div>
      <div className="mb-4 flex justify-end">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={generateSnapshot}
            disabled={generating}
            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Report'}
          </button>
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportAuditLogs || items.length === 0}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-700 disabled:opacity-50"
          >
            Export Audit CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setPage(1);
              setQuery('');
              setAction('all');
              setFromDate('');
              setToDate('');
            }}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {!canExportAuditLogs ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Audit export is restricted to SuperAdmin.
        </p>
      ) : null}

      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading audit logs...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Timestamp</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Actor</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((log) => (
                <tr key={String(log?._id || '')}>
                  <td className="px-4 py-3">{formatDateTime(log?.timestamp)}</td>
                  <td className="px-4 py-3">{log?.userId?.fullName || log?.userId?.email || 'System'}</td>
                  <td className="px-4 py-3">{log?.userId?.role || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${actionBadgeClass(log?.action)}`}>
                      {actionLabel(log?.action)}
                    </span>
                  </td>
                  <td className="max-w-[440px] px-4 py-3 text-slate-600">{log?.details || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No audit logs found.</p> : null}

      {!loading && pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between gap-3">
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

      <ExportReasonModal
        open={exportModalOpen}
        title="Export Audit Logs CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportAuditLogs({
              q: query || undefined,
              action,
              from: fromDate || undefined,
              to: toDate || undefined,
              reason
            });

            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            const filename = match?.[1] || `admin-audit-logs-${Date.now()}.csv`;
            downloadCsvBlob(filename, data);
            setDownloadNotice('CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />
    </Card>
  );
}
