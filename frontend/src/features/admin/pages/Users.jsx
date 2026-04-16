import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
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

export default function Users() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportUsers = adminType === 'superadmin';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

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
        const { data } = await adminAPI.getUsers({ page, limit: 10, q: query || undefined, role });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load users.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [page, query, role]);

  return (
    <Card title="Users" description="Enterprise user management across all roles.">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search by name, email, department"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          value={role}
          onChange={(event) => {
            setPage(1);
            setRole(event.target.value);
          }}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="all">All roles</option>
          <option value="student">Student</option>
          <option value="employer">Employer</option>
          <option value="admin">Admin</option>
          <option value="SuperAdmin">SuperAdmin</option>
          <option value="CollegeAdmin">CollegeAdmin</option>
          <option value="DeptAdmin">DeptAdmin</option>
        </select>
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportUsers}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      {!canExportUsers ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Users export is restricted to SuperAdmin.
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />
      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading users...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((user) => (
                <tr key={String(user?._id || '')}>
                  <td className="px-4 py-3">{user?.fullName || user?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{user?.email || 'N/A'}</td>
                  <td className="px-4 py-3">{user?.role || 'N/A'}</td>
                  <td className="px-4 py-3">{user?.department || 'N/A'}</td>
                  <td className="px-4 py-3">{user?.accountStatus || user?.status || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No users found.</p> : null}

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

      <ExportReasonModal
        open={exportModalOpen}
        title="Export Users CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportUsers({ q: query || undefined, role, reason });
            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            downloadCsvBlob(match?.[1] || `admin-users-${Date.now()}.csv`, data);
            setDownloadNotice('Users CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export users CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />
    </Card>
  );
}
