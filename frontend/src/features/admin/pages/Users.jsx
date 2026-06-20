import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import AdvancedExportModal from '../components/AdvancedExportModal';
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

  const handleExport = async ({ fileName, format }) => {
    try {
      setExporting(true);
      setError('');

      if (format === 'excel') {
        // Use existing CSV export for Excel
        const { data } = await adminAPI.exportUsers({ q: query || undefined, role });
        downloadCsvBlob(`${fileName}.csv`, data);
        setDownloadNotice('Excel/CSV exported successfully.');
      } else {
        // PDF Export using html2pdf.js
        const html2pdf = (await import('html2pdf.js')).default;

        // Fetch more data for export (up to 500 records for the report)
        const { data: allData } = await adminAPI.getUsers({ limit: 500, q: query || undefined, role });
        const usersToExport = Array.isArray(allData?.items) ? allData.items : [];

        // Create a hidden element for printing
        const element = document.createElement('div');
        element.style.padding = '40px';
        element.style.fontFamily = 'Inter, system-ui, sans-serif';
        element.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 4px solid #0e7490; padding-bottom: 20px; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <div style="width: 60px; height: 60px; border-radius: 12px; overflow: hidden;">
                <img src="/uog-logo.jpg" style="width: 100%; height: 100%; object-fit: cover;" />
              </div>
              <div>
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: -0.02em;">Institutional User Report</h1>
                <p style="margin: 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.1em;">Smart Internship Placement System</p>
              </div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 10px; font-weight: 800; color: #0e7490; text-transform: uppercase;">Generated On</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</p>
            </div>
          </div>

          <div style="margin-bottom: 20px; display: grid; grid-template-cols: repeat(3, 1fr); gap: 20px;">
             <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Total Records</p>
                <p style="margin: 0; font-size: 18px; font-weight: 900; color: #0f172a;">${usersToExport.length}</p>
             </div>
             <div style="background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px solid #e2e8f0;">
                <p style="margin: 0; font-size: 9px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Filter Applied</p>
                <p style="margin: 0; font-size: 18px; font-weight: 900; color: #0e7490; text-transform: capitalize;">${role || 'All Roles'}</p>
             </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">Full Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">Email Address</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">Role</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">College</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">Department</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase; font-weight: 800;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${usersToExport.map((u, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${u.fullName || u.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${u.email || '-'}</td>
                  <td style="padding: 12px;"><span style="background: #f1f5f9; padding: 2px 8px; border-radius: 99px; font-size: 9px; font-weight: 800; text-transform: uppercase;">${u.role || '-'}</span></td>
                  <td style="padding: 12px; color: #64748b;">${u.college || '-'}</td>
                  <td style="padding: 12px; color: #64748b;">${u.department || '-'}</td>
                  <td style="padding: 12px; font-weight: 800; text-transform: uppercase; color: ${(u.accountStatus || u.status) === 'active' ? '#10b981' : '#94a3b8'};">${u.accountStatus || u.status || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <p style="font-size: 10px; color: #94a3b8; margin: 0;">This is an officially generated institutional document. &copy; University of Gondar</p>
          </div>
        `;

        const opt = {
          margin: 0,
          filename: `${fileName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };

        await html2pdf().from(element).set(opt).save();
        setDownloadNotice('PDF Report generated successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to export data report.');
      console.error(requestError);
    } finally {
      setExporting(false);
    }
  };

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
    <div className="flex w-full flex-col space-y-6 pb-12">
      {/* Simplified Header */}
      <section className="bg-white border-b border-slate-100 pt-10 pb-8 px-6 lg:px-10 rounded-[32px] mb-4">
        <div className="w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-3">
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Registered Users</h1>
            <p className="text-lg text-slate-500 font-medium max-w-xl leading-relaxed">View and manage everyone registered in the system's unified ecosystem.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-6 rounded-[32px] border border-cyan-100 bg-cyan-50/40 px-8 py-5 shadow-sm mr-2 transition-all hover:shadow-md hover:bg-cyan-50/60">
              <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-cyan-600 border border-cyan-50">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700 leading-none mb-2">Total Registered</p>
                <p className="text-4xl font-black text-slate-900 leading-none tabular-nums tracking-tighter">{pagination.total}</p>
              </div>
            </div>
            <DataFreshness value={lastRefreshed} />
          </div>
        </div>
      </section>

      <div className="px-1 lg:px-4 space-y-6">
        {/* Filters Bar with Simple Labels */}
        <div className="grid gap-4 md:grid-cols-[1fr_200px_auto] items-center">
          <div className="relative group">
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Find someone by name..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none pl-12"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <select
            value={role}
            onChange={(event) => {
              setPage(1);
              setRole(event.target.value);
            }}
            className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-700 transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="all">Everyone</option>
            <option value="student">Students</option>
            <option value="employer">Companies (Industry)</option>
            <option value="dean">College Deans</option>
            <option value="hod">Department Heads (HOD)</option>
          </select>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportUsers || exporting}
            className="flex items-center gap-2 rounded-2xl bg-cyan-700 px-6 py-4 text-xs font-black uppercase tracking-widest text-white shadow-lg transition-all hover:bg-cyan-600 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Downloading...' : 'Download List'}
          </button>
        </div>

        {/* User List Card */}
        <div className="w-full rounded-[32px] border border-cyan-100 bg-white overflow-hidden shadow-[0_15px_40px_rgba(15,23,42,0.04)]">
          <div className="p-8 border-b border-slate-100 flex justify-between items-center">
            <div>
              {/* Title removed for cleaner UI */}
            </div>
            {loading && (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-600" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-600 [animation-delay:-0.15s]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-cyan-600 [animation-delay:-0.3s]" />
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Full Name</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Email Address</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">User Role</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">College</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Department</th>
                  <th className="px-8 py-5 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600">Active Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? items.map((user, index) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    key={String(user?._id || index)}
                    className="group hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-cyan-50 flex items-center justify-center text-cyan-700 font-black text-xs border border-cyan-100 group-hover:bg-cyan-100 transition-all overflow-hidden shadow-sm">
                          {user?.profileImage ? (
                            <img src={user.profileImage} alt={user.fullName || 'User'} className="h-full w-full object-cover" />
                          ) : (
                            String(user?.fullName || user?.name || 'U').charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">{user?.fullName || user?.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className="text-sm font-medium text-slate-600">{user?.email || 'N/A'}</span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                        {user?.role || '-'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500">
                      {user?.college || '-'}
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-slate-500">
                      {user?.department || '-'}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${(user?.accountStatus || user?.status) === 'active' || (user?.accountStatus || user?.status) === 'Active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                        <span className="text-xs font-black uppercase tracking-tighter text-slate-700">
                          {user?.accountStatus || user?.status || 'N/A'}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                )) : !loading && (
                  <tr>
                    <td colSpan="6" className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center justify-center gap-4">
                        <div className="h-16 w-16 rounded-full bg-slate-50 flex items-center justify-center text-3xl opacity-50 grayscale">🔍</div>
                        <p className="text-sm font-bold text-slate-400">No users found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Strategic Pagination System */}
          {pagination.total > 0 && (
            <div className="px-10 py-8 border-t border-slate-100 flex items-center justify-between bg-white">
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
        </div>
      </div>

      <AdvancedExportModal
        open={exportModalOpen}
        title="Institutional Data Export"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />
    </div>
  );
}
