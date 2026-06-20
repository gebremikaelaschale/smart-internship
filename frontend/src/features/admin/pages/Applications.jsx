import React, { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Modal from '@/components/common/Modal';
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

export default function Applications() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportApplications = adminType === 'superadmin' || adminType === 'collegeadmin' || adminType === 'deptadmin';
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

  const handleExport = async ({ fileName, format }) => {
    try {
      setExporting(true);
      setError('');

      if (format === 'excel') {
        const { data, headers } = await adminAPI.exportApplications({ q: query || undefined, status, reason: 'Institutional Report Download' });
        const disposition = String(headers?.['content-disposition'] || '');
        const match = disposition.match(/filename="?([^";]+)"?/i);
        downloadCsvBlob(match?.[1] || `${fileName}.csv`, data);
        setDownloadNotice('Applications report downloaded successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
        
        // Fetch all matching applications for high fidelity PDF report
        const response = await adminAPI.getApplications({ q: query || undefined, status, limit: 1000 });
        const appsToExport = Array.isArray(response?.data?.items) ? response.data.items : [];

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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Applications Report</h1>
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
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Student</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Email</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Internship</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Location</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Match Score</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${appsToExport.map((app, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${app.studentId?.fullName || app.studentId?.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${app.studentId?.email || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${app.internshipId?.title || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${app.internshipId?.location || 'Not Specified'}</td>
                  <td style="padding: 12px; font-weight: 700; color: #0e7490;">${app.match_score ?? app.matchingScore ?? app.matchScore ?? 0}%</td>
                  <td style="padding: 12px; font-weight: 800; text-transform: uppercase;">${app.status || '-'}</td>
                </tr>
              `).join('')}
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
        setDownloadNotice('Applications PDF downloaded successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate export report.');
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
    <div className="flex w-full flex-col space-y-8 pb-12">
      {/* Premium Gradient Header */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100 pt-16 pb-12 px-6 lg:px-12 rounded-[40px] mb-6 shadow-sm">
        <div className="absolute top-0 right-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-48 w-48 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_70%)] pointer-events-none" />
        
        <div className="relative w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-1 w-8 bg-cyan-600 rounded-full" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700">System Admin</p>
            </div>
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Applications</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
              Review and control application workflow.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50/80 backdrop-blur-sm border border-slate-100 p-2 rounded-[32px] shadow-sm">
             <div className="flex items-center gap-6 rounded-[28px] border border-cyan-100 bg-cyan-50/40 px-8 py-5 shadow-sm mr-2 transition-all hover:shadow-md hover:bg-cyan-50/60">
                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-cyan-600 border border-cyan-50">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700 leading-none mb-2">Total Applications</p>
                  <p className="text-4xl font-black text-slate-900 leading-none tabular-nums tracking-tighter">{pagination.total}</p>
                </div>
              </div>
            <DataFreshness value={lastRefreshed} />
          </div>
        </div>
      </section>

      <div className="px-2 lg:px-6 space-y-8">
        {/* Filters and Search Bar */}
        <div className="grid gap-6 md:grid-cols-[1fr_1fr_auto] items-center bg-white/60 backdrop-blur-md border border-slate-100 p-6 rounded-[32px] shadow-sm">
          <div className="relative group">
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search by student or internship"
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none shadow-sm placeholder:text-slate-400 placeholder:font-medium tracking-wide"
            />
          </div>

          <div className="relative">
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Interview">Interview</option>
              <option value="Accepted">Accepted / Placed</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportApplications || exporting}
            className="group flex items-center gap-4 rounded-2xl bg-cyan-700 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_15px_30px_rgba(14,116,144,0.25)] transition-all hover:bg-cyan-600 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(14,116,144,0.3)] disabled:opacity-50 disabled:translate-y-0"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Downloading...' : 'Download Report'}
          </button>
        </div>

        {/* Notices */}
        {(error || message || downloadNotice) && (
          <div className="space-y-3">
            {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}
            {downloadNotice && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p>}
          </div>
        )}

        {/* Table Area */}
        <div className="w-full rounded-[40px] border border-cyan-100 bg-white overflow-hidden shadow-[0_25px_60px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 backdrop-blur-sm border-b border-slate-100">
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Student</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Email</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Internship</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Location</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Match Score</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? items.map((application, index) => (
                  <tr 
                    key={String(application?._id || index)} 
                    className="group hover:bg-slate-50/50 transition-all duration-300"
                  >
                    <td className="px-10 py-6">
                      <p className="text-lg font-black text-slate-900 group-hover:text-cyan-700 transition-colors leading-tight">
                        {application?.studentId?.fullName || application?.studentId?.name || 'N/A'}
                      </p>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-bold text-slate-600">{application?.studentId?.email || 'N/A'}</span>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-bold text-slate-600">{application?.internshipId?.title || 'N/A'}</span>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-bold text-slate-600">{application?.internshipId?.location || 'Not Specified'}</span>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-black text-cyan-700">{application?.match_score ?? application?.matchingScore ?? application?.matchScore ?? 0}%</span>
                    </td>
                    <td className="px-10 py-6">
                      <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm transition-transform ${
                        application?.status === 'Accepted' || application?.status === 'Placed' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        application?.status === 'Pending' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                        application?.status === 'Under Review' ? 'border-cyan-200 bg-cyan-50 text-cyan-700' :
                        application?.status === 'Interview' ? 'border-violet-200 bg-violet-50 text-violet-700' :
                        application?.status === 'Rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                        'border-indigo-200 bg-indigo-50 text-indigo-700'
                      }`}>
                        <span className="h-2 w-2 rounded-full bg-current" />
                        <span className="text-[11px] font-black uppercase tracking-widest">{application?.status || 'N/A'}</span>
                      </span>
                    </td>
                  </tr>
                )) : !loading && (
                   <tr>
                    <td colSpan="6" className="px-10 py-28 text-center">
                      <div className="flex flex-col items-center justify-center gap-6">
                        <div className="h-24 w-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-5xl border border-slate-100 opacity-40 grayscale group-hover:grayscale-0 transition-all">📄</div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-400">No applications found</p>
                          <p className="text-sm font-medium text-slate-300 uppercase tracking-widest">Try changing your search or filters</p>
                        </div>
                      </div>
                    </td>
                   </tr>
                )}
                {loading && (
                   <tr>
                    <td colSpan="6" className="px-10 py-28 text-center">
                      <p className="text-sm text-slate-500">Loading applications...</p>
                    </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Strategic Pagination System */}
          {items.length > 0 && (
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

      <AdvancedExportModal
        open={exportModalOpen}
        title="Download Report"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />
    </div>
  );
}
