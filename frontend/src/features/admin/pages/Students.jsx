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

export default function Students() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportStudents = adminType === 'superadmin' || adminType === 'collegeadmin';
  const [items, setItems] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [internshipStatusOptions, setInternshipStatusOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [downloadNotice, setDownloadNotice] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState('');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewProfileOpen, setViewProfileOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
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
        const { data } = await adminAPI.getStudents({
          page,
          limit: 10,
          department: departmentFilter,
          internshipStatus: statusFilter
        });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setDepartmentOptions(Array.isArray(data?.filters?.departments) ? data.filters.departments : []);
        setInternshipStatusOptions(Array.isArray(data?.filters?.internshipStatuses) ? data.filters.internshipStatuses : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load students.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [page, departmentFilter, statusFilter]);

  const openProfile = (student) => {
    setSelectedStudent(student);
    setViewProfileOpen(true);
  };

  const closeProfile = () => {
    setViewProfileOpen(false);
    setSelectedStudent(null);
  };

  const statusBadgeClass = (value) => {
    const status = String(value || '').toLowerCase();
    if (status === 'placed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (status === 'in progress') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (status === 'not placed') return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-slate-200 bg-slate-100 text-slate-700';
  };

  return (
    <Card title="Students" description="Overview control with limited actions.">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={departmentFilter}
          onChange={(event) => {
            setPage(1);
            setDepartmentFilter(event.target.value);
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm md:w-56"
        >
          <option value="all">All departments</option>
          {departmentOptions.map((department) => (
            <option key={department} value={department}>{department}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => {
            setPage(1);
            setStatusFilter(event.target.value);
          }}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm md:w-56"
        >
          <option value="all">All statuses</option>
          {internshipStatusOptions.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          disabled={!canExportStudents}
          className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
        >
          Export CSV
        </button>
      </div>

      {!canExportStudents ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Students export is restricted to SuperAdmin and CollegeAdmin.
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />
      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading students...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Internship Status</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Progress %</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((student) => (
                <tr key={String(student?._id || '')}>
                  <td className="px-4 py-3 font-medium text-slate-900">{student?.fullName || student?.name || 'N/A'}</td>
                  <td className="px-4 py-3">{student?.department || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(student?.internshipStatus)}`}>
                      {student?.internshipStatus || 'Not Applied'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{Number(student?.progress || 0)}%</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openProfile(student)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No students found.</p> : null}

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
        title="Export Students CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportStudents({
              department: departmentFilter !== 'all' ? departmentFilter : undefined,
              internshipStatus: statusFilter !== 'all' ? statusFilter : undefined,
              reason
            });
            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            downloadCsvBlob(match?.[1] || `admin-students-${Date.now()}.csv`, data);
            setDownloadNotice('Students CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export students CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />

      <Modal open={viewProfileOpen} title="Student Profile" onClose={closeProfile}>
        <div className="space-y-3 text-sm">
          <p><span className="font-semibold text-slate-700">Name:</span> <span className="text-slate-900">{selectedStudent?.fullName || selectedStudent?.name || 'N/A'}</span></p>
          <p><span className="font-semibold text-slate-700">Email:</span> <span className="text-slate-900">{selectedStudent?.email || 'N/A'}</span></p>
          <p><span className="font-semibold text-slate-700">Department:</span> <span className="text-slate-900">{selectedStudent?.department || 'N/A'}</span></p>
          <p><span className="font-semibold text-slate-700">Internship Status:</span> <span className="text-slate-900">{selectedStudent?.internshipStatus || 'Not Applied'}</span></p>
          <p><span className="font-semibold text-slate-700">Progress:</span> <span className="text-slate-900">{Number(selectedStudent?.progress || 0)}%</span></p>
          <div className="flex justify-end">
            <button type="button" onClick={closeProfile} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Close
            </button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
