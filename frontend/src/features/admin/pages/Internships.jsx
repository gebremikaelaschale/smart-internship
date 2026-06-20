import React, { useEffect, useMemo, useState } from 'react';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import AdvancedExportModal from '../components/AdvancedExportModal';
import DataFreshness from '../components/DataFreshness';
import { AnimatePresence, motion } from 'framer-motion';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'Pending', label: 'Pending Review' },
    { key: 'Open', label: 'Open' },
    { key: 'Closed', label: 'Closed' }
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
  }, [page, query, status, refreshTrigger]);

  const handleExport = async ({ fileName, format }) => {
    try {
      setExporting(true);
      setError('');

      if (format === 'excel') {
        const { data } = await adminAPI.exportInternships({ q: query || undefined, status });
        downloadCsvBlob(`${fileName}.csv`, data);
        setDownloadNotice('Internships Excel exported successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
        const { data: allData } = await adminAPI.getInternships({ limit: 500, q: query || undefined, status });
        const internshipsToExport = Array.isArray(allData?.items) ? allData.items : [];

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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Internship Programs Report</h1>
                <p style="margin: 0; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase;">Smart Internship Placement System</p>
              </div>
            </div>
            <div style="text-align: right;">
              <p style="margin: 0; font-size: 10px; font-weight: 800; color: #0e7490; text-transform: uppercase;">Generated On</p>
              <p style="margin: 0; font-size: 14px; font-weight: 700; color: #1e293b;">${new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Title</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Company (Industry Partner)</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Location</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Status</th>
              </tr>
            </thead>
              ${internshipsToExport.map((int, i) => {
          const pdfLocation = int.location || 'Not specified';
          return `
                  <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                    <td style="padding: 12px; font-weight: 700; color: #0f172a;">${int.title || '-'}</td>
                    <td style="padding: 12px; color: #475569;">${int.companyId?.fullName || int.companyId?.name || int.companyId?.email || '-'}</td>
                    <td style="padding: 12px; color: #475569;">${pdfLocation}</td>
                    <td style="padding: 12px; font-weight: 800; text-transform: uppercase;">${int.status || '-'}</td>
                  </tr>
                `;
        }).join('')}
            </tbody>
          </table>
        `;

        const opt = {
          margin: 0,
          filename: `${fileName}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
        };

        await html2pdf().from(element).set(opt).save();
        setDownloadNotice('Internships PDF generated successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate export report.');
    } finally {
      setExporting(false);
    }
  };

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
      setRefreshTrigger((prev) => prev + 1);
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
    <div className="flex w-full flex-col space-y-8 pb-12">
      {/* Premium Gradient Header */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100 pt-16 pb-12 px-6 lg:px-12 rounded-[40px] mb-6 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="absolute top-0 right-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-48 w-48 bg-[radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.05),transparent_70%)] pointer-events-none" />

        <div className="relative w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-3">
            <h1 className="text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-none">
              Internships
            </h1>
            <p className="text-base text-slate-500 font-bold max-w-xl">
              Manage, approve, and review internship placements.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={!canExportInternships}
              className="group inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-700 hover:to-blue-800 text-white shadow-[0_10px_25px_rgba(6,182,212,0.25)] px-6 py-4 text-xs font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
          </div>
        </div>
      </section>

      <div className="w-full mx-auto px-1 space-y-8">
        {/* Premium Real-Time Analytics Dashboard */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Total Internships */}
          <div className="relative overflow-hidden rounded-[32px] border border-cyan-100 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.06),transparent_70%)] pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Total Internships</p>
                <h4 className="text-4xl font-black text-slate-900 tracking-tight">{pagination.total}</h4>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center text-xl font-bold shadow-sm">💼</div>
            </div>
          </div>

          {/* Open Programs */}
          <div className="relative overflow-hidden rounded-[32px] border border-emerald-100 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.06),transparent_70%)] pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Open Internships</p>
                <h4 className="text-4xl font-black text-slate-900 tracking-tight">{summary.open}</h4>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-bold shadow-sm">✓</div>
            </div>
          </div>

          {/* Closed Programs */}
          <div className="relative overflow-hidden rounded-[32px] border border-rose-100 bg-white p-8 shadow-sm transition hover:shadow-md">
            <div className="absolute top-0 right-0 h-32 w-32 bg-[radial-gradient(circle_at_top_right,rgba(244,63,94,0.06),transparent_70%)] pointer-events-none" />
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Closed Internships</p>
                <h4 className="text-4xl font-black text-slate-900 tracking-tight">{summary.closed}</h4>
              </div>
              <div className="h-14 w-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center text-xl font-bold shadow-sm">✕</div>
            </div>
          </div>
        </section>

        {/* Filters & Direct Search Bar */}
        <section className="flex flex-col md:flex-row justify-between items-center gap-6 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 shadow-sm">
          {/* Left Side: Extremely Large Search Input - Dynamically stretched to fill space */}
          <div className="relative w-full flex-1">
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search by title, skills or keyword..."
              className="w-full rounded-2xl border border-slate-200 bg-white pl-16 pr-6 py-6 text-lg font-black text-slate-800 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 transition-all shadow-sm"
            />
            <svg className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Right Side: Premium Segment Tabs */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto shrink-0 w-full md:w-auto">
            {[
              { key: 'all', label: `All: ${Number(summary.pending || 0) + Number(summary.open || 0) + Number(summary.closed || 0)}` },
              { key: 'Pending', label: `Pending: ${summary.pending || 0}` },
              { key: 'Open', label: `Open: ${summary.open || 0}` },
              { key: 'Closed', label: `Closed: ${summary.closed || 0}` }
            ].map((tab) => {
              const active = status === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setStatus(tab.key);
                  }}
                  className={`rounded-xl px-5 py-3 text-sm font-black uppercase tracking-widest transition-all whitespace-nowrap ${active
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Notices and Warning Panels */}
        {!canManageInternshipStatus ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-800 shadow-sm">
            🔒 Internship status changes are allowed for SuperAdmin and CollegeAdmin only.
          </p>
        ) : null}

        {!canExportInternships ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-800 shadow-sm">
            🔒 Internships export is restricted to SuperAdmin and CollegeAdmin.
          </p>
        ) : null}

        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-700 shadow-sm">{error}</p> : null}
        {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700 shadow-sm">{message}</p> : null}
        {downloadNotice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700 shadow-sm">{downloadNotice}</p> : null}

        {/* Premium Table Card */}
        <div className="w-full rounded-[40px] border border-cyan-100 bg-white overflow-hidden shadow-[0_25px_60px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 backdrop-blur-sm border-b border-slate-100">
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Internship</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Company (Industry Partner)</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Location</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? items.map((internship, index) => {
                  const currentStatus = String(internship?.status || '').toLowerCase();
                  const displayLocation = internship?.location || 'Not specified';
                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      key={String(internship?._id || index)}
                      className="group hover:bg-slate-50/50 transition-all duration-300"
                    >
                      <td className="px-10 py-6">
                        <p className="text-lg font-black text-slate-900 group-hover:text-cyan-700 transition-colors leading-tight">{internship?.title || 'N/A'}</p>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-sm font-bold text-slate-600">{internship?.companyId?.fullName || internship?.companyId?.name || internship?.companyId?.email || 'N/A'}</span>
                      </td>
                      <td className="px-10 py-6">
                        <span className="text-sm font-bold text-slate-600">{displayLocation}</span>
                      </td>
                      <td className="px-10 py-6">
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm group-hover:scale-105 transition-transform ${currentStatus === 'open' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                            currentStatus === 'pending' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                              'border-rose-200 bg-rose-50 text-rose-700'
                          }`}>
                          <div className="h-2 w-2 rounded-full bg-current" />
                          <span className="text-[11px] font-black uppercase tracking-widest">
                            {internship?.status || 'N/A'}
                          </span>
                        </div>
                      </td>
                    </motion.tr>
                  );
                }) : !loading && (
                  <tr>
                    <td colSpan="4" className="px-10 py-28 text-center">
                      <div className="flex flex-col items-center justify-center gap-6">
                        <div className="h-24 w-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-5xl border border-slate-100 opacity-40 grayscale transition-all">💼</div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-400">No internships found</p>
                          <p className="text-sm font-medium text-slate-300 uppercase tracking-widest">Try changing your search or filters</p>
                        </div>
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

      {/* High-Fidelity Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmAction && (
          <>
            {/* Backdrop with premium glassmorphism */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-6"
            >
              {/* Modal Container */}
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                onClick={(e) => e.stopPropagation()}
                className={`relative w-full max-w-3xl overflow-hidden rounded-[40px] bg-white p-10 md:p-12 shadow-[0_30px_70px_rgba(15,23,42,0.15)] border ${confirmAction.status === 'Open' ? 'border-emerald-100' : 'border-rose-100'
                  }`}
              >
                {/* Decorative Premium Gradients */}
                <div className={`absolute top-0 right-0 h-80 w-80 pointer-events-none rounded-full blur-[80px] opacity-20 ${confirmAction.status === 'Open'
                    ? 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                    : 'bg-gradient-to-br from-rose-400 to-amber-500'
                  }`} />
                <div className={`absolute bottom-0 left-0 h-60 w-60 pointer-events-none rounded-full blur-[60px] opacity-10 ${confirmAction.status === 'Open'
                    ? 'bg-gradient-to-br from-cyan-400 to-blue-500'
                    : 'bg-gradient-to-br from-orange-400 to-rose-500'
                  }`} />

                {/* Main Content Layout */}
                <div className="relative flex flex-col items-center text-center space-y-8">
                  {/* Status Indicator Icon */}
                  {confirmAction.status === 'Open' ? (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-40 h-24 w-24" />
                      <div className="h-24 w-24 rounded-[32px] bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-md relative z-10">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <div className="relative flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full bg-rose-100 animate-ping opacity-40 h-24 w-24" />
                      <div className="h-24 w-24 rounded-[32px] bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-md relative z-10">
                        <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Header Title */}
                  <div className="space-y-3">
                    <h3 className={`text-4xl lg:text-5xl font-black tracking-tight leading-none bg-gradient-to-r bg-clip-text text-transparent pb-1 ${confirmAction.status === 'Open'
                        ? 'from-slate-900 via-emerald-800 to-emerald-600'
                        : 'from-slate-900 via-rose-800 to-rose-600'
                      }`}>
                      {confirmAction.status === 'Open' ? 'Approve Publication' : 'Reject Publication'}
                    </h3>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                      Super Admin Security Confirmation
                    </p>
                  </div>

                  {/* Description Box */}
                  <div className="w-full bg-slate-50/80 backdrop-blur-sm rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-inner max-w-3xl">
                    <p className="text-xl md:text-2xl text-slate-700 leading-relaxed font-semibold">
                      Are you sure you want to {confirmAction.status === 'Open' ? 'Approve' : 'Reject'} the publication of{' '}
                      <span className={`font-black px-4 py-1.5 rounded-2xl bg-white border shadow-sm inline-block my-1 ${confirmAction.status === 'Open' ? 'text-emerald-700 border-emerald-200' : 'text-rose-700 border-rose-200'
                        }`}>
                        {confirmAction?.title}
                      </span>
                      ?
                    </p>
                    <p className="text-sm md:text-base text-slate-400 font-bold uppercase tracking-wider mt-4">
                      {confirmAction.status === 'Open'
                        ? 'This internship program will be visible to all matching students across the placement portal.'
                        : 'This publication request will be archived and hidden from student directories.'}
                    </p>
                  </div>

                  {/* Large & Wide Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl pt-4">
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-8 py-5 text-base font-black uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-98"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={runConfirmedStatusUpdate}
                      className={`flex-1 rounded-2xl shadow-lg px-8 py-5 text-base font-black uppercase tracking-widest text-white transition-all active:scale-98 ${confirmAction.status === 'Open'
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-emerald-500/20 hover:shadow-emerald-500/30'
                          : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-rose-500/20 hover:shadow-rose-500/30'
                        }`}
                    >
                      Confirm Action
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AdvancedExportModal
        open={exportModalOpen}
        title="Export Data"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />
    </div>
  );
}
