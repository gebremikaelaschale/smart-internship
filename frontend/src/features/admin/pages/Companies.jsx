import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '@/components/common/Modal';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import AdvancedExportModal from '../components/AdvancedExportModal';
import DataFreshness from '../components/DataFreshness';

const PROFESSIONAL_REJECTION_REASONS = [
  'Invalid Business License - Please upload a clear, current copy.',
  'Incomplete Profile - Please fill in all required contact information.',
  'MOU Document Missing - Please upload the signed partnership agreement.',
  'Company details do not match the submitted registration documents.',
  'Supporting documents are unclear or expired. Please upload updated copies.'
];

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

function CompanyLogo({ logo, name, className }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logo]);

  if (!logo || hasError) {
    return (
      <div className={`flex items-center justify-center bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400 font-black ${className}`}>
        {String(name || 'C').charAt(0).toUpperCase()}
      </div>
    );
  }

  const src = logo.startsWith('data:')
    ? logo
    : logo.startsWith('http')
      ? logo
      : `http://localhost:5000${logo.startsWith('/') ? '' : '/'}${logo}`;

  return (
    <img
      src={src}
      alt="Logo"
      className={`object-cover ${className}`}
      crossOrigin="anonymous"
      onError={() => setHasError(true)}
    />
  );
}

export default function Companies() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canManageVerification = adminType === 'superadmin';
  const canExportCompanies = adminType === 'superadmin';
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
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [query, setQuery] = useState('');
  const [verification, setVerification] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [rejectionReason, setRejectionReason] = useState('');
  const [editingDrawerReason, setEditingDrawerReason] = useState(false);
  const [drawerRejectionReason, setDrawerRejectionReason] = useState('');
  const [drawerEditModalOpen, setDrawerEditModalOpen] = useState(false);
  const [selectedRejectionReason, setSelectedRejectionReason] = useState('');

  // Auto-reset rejection reason when confirmAction changes
  useEffect(() => {
    setRejectionReason('');
    setSelectedRejectionReason('');
  }, [confirmAction]);

  const verificationTabs = [
    { key: 'all', label: 'All' },
    { key: 'Pending', label: 'Pending' },
    { key: 'Verified', label: 'Verified' },
    { key: 'Rejected', label: 'Rejected' }
  ];

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
        const { data } = await adminAPI.getCompanies({ page, limit: 10, q: query || undefined, verification });
        if (!active) return;
        setItems(Array.isArray(data?.items) ? data.items : []);
        setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        setLastRefreshed(new Date().toLocaleString());
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load companies.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [page, query, verification]);

  const handleExport = async ({ fileName, format }) => {
    try {
      setExporting(true);
      setError('');

      if (format === 'excel') {
        const { data } = await adminAPI.exportCompanies({ q: query || undefined, verification });
        downloadCsvBlob(`${fileName}.csv`, data);
        setDownloadNotice('Companies Excel exported successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
        const { data: allData } = await adminAPI.getCompanies({ limit: 500, q: query || undefined, verification });
        const companiesToExport = Array.isArray(allData?.items) ? allData.items : [];

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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Partner Companies Report</h1>
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
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Company Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Representative</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Industry</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Location</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Verification</th>
              </tr>
            </thead>
            <tbody>
              ${companiesToExport.map((c, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${c.companyName || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${c.representative?.name || c.user?.fullName || c.user?.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${c.industryType || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${c.hqLocation || '-'}</td>
                  <td style="padding: 12px; font-weight: 800; text-transform: uppercase;">${c.verification?.status || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top: 40px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            <p style="font-size: 10px; color: #94a3b8; margin: 0;">&copy; University of Gondar • Institutional Document</p>
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
        setDownloadNotice('Companies PDF generated successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate export report.');
    } finally {
      setExporting(false);
    }
  };

  const updateVerification = async (id, status, reason) => {
    try {
      setBusyId(String(id || ''));
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateCompanyVerification(id, { status, reason });
      const updated = data?.item;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, verification: updated.verification }
            : item
        )));
        setSelectedCompany((prev) => (
          prev && String(prev?._id || '') === String(updated._id)
            ? { ...prev, verification: updated.verification }
            : prev
        ));
      }
      setMessage(`Company verification updated to ${status}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update company verification.');
    } finally {
      setBusyId('');
    }
  };

  const resetVerification = async (id) => {
    try {
      setBusyId(String(id || ''));
      setError('');
      setMessage('');
      const { data } = await adminAPI.resetCompanyVerification(id);
      const updated = data?.item;
      if (updated?._id) {
        const nextVerification = { ...(updated.verification || {}), status: 'Pending', reason: '' };
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, verification: nextVerification }
            : item
        )));
        setSelectedCompany((prev) => (
          prev && String(prev?._id || '') === String(updated._id)
            ? { ...prev, verification: nextVerification }
            : prev
        ));
      }
      setMessage('Company verification reset to pending.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to reset company verification.');
    } finally {
      setBusyId('');
    }
  };

  const runConfirmedVerification = async () => {
    if (!confirmAction?.id || !confirmAction?.status) return;
    const { id, status } = confirmAction;
    const reason = status === 'Rejected' ? rejectionReason : undefined;
    setConfirmAction(null);
    await updateVerification(id, status, reason);
  };

  const getVerificationKey = (company) => String(company?.verification?.status || 'Pending').trim().toLowerCase();

  const updateDrawerRejectionReason = async () => {
    if (!selectedCompany?._id) return;
    try {
      setBusyId(String(selectedCompany._id));
      const { data } = await adminAPI.updateCompanyVerification(selectedCompany._id, {
        status: 'Rejected',
        reason: drawerRejectionReason
      });
      const updated = data?.item;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, verification: updated.verification }
            : item
        )));
        setSelectedCompany(updated);
      }
      setEditingDrawerReason(false);
      setDrawerEditModalOpen(false);
      setMessage('Company rejection reason updated successfully.');
    } catch (requestError) {
      setProfileError(requestError?.response?.data?.message || 'Failed to update rejection reason.');
    } finally {
      setBusyId('');
    }
  };

  const openProfile = async (company) => {
    const companyId = String(company?._id || '');
    if (!companyId) return;

    setProfileModalOpen(true);
    setProfileLoading(true);
    setProfileError('');
    setSelectedCompany(company);
    setEditingDrawerReason(false);
    setDrawerEditModalOpen(false);
    setDrawerRejectionReason(company?.verification?.reason || '');

    try {
      const { data } = await adminAPI.getCompanyProfile(companyId);
      const activeItem = data?.item || company;
      setSelectedCompany(activeItem);
      setDrawerRejectionReason(activeItem?.verification?.reason || '');
    } catch (requestError) {
      setProfileError(requestError?.response?.data?.message || 'Failed to load company profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setProfileModalOpen(false);
    setSelectedCompany(null);
    setDrawerEditModalOpen(false);
    setProfileLoading(false);
    setProfileError('');
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
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Companies</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
              Manage partner companies, monitor their verification status, and oversee employer accounts.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-slate-50/80 backdrop-blur-sm border border-slate-100 p-2 rounded-[32px] shadow-sm">
            <div className="flex items-center gap-6 rounded-[28px] border border-cyan-100 bg-cyan-50/40 px-8 py-5 shadow-sm mr-2 transition-all hover:shadow-md hover:bg-cyan-50/60">
              <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-cyan-600 border border-cyan-50">
                <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700 leading-none mb-2">Total Companies</p>
                <p className="text-4xl font-black text-slate-900 leading-none tabular-nums tracking-tighter">{pagination.total}</p>
              </div>
            </div>
            <DataFreshness value={lastRefreshed} />
          </div>
        </div>
      </section>

      <div className="px-2 lg:px-6 space-y-8">
        {/* Filters and Search Bar */}
        <div className="grid gap-6 md:grid-cols-[1fr_auto_auto] items-center bg-white/60 backdrop-blur-md border border-slate-100 p-6 rounded-[32px] shadow-sm">
          <div className="relative group">
            <input
              value={query}
              onChange={(event) => {
                setPage(1);
                setQuery(event.target.value);
              }}
              placeholder="Search company by name..."
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none pl-12"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-cyan-600 transition-colors">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1.5 rounded-2xl overflow-x-auto">
            {verificationTabs.map((tab) => {
              const active = verification === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setPage(1);
                    setVerification(tab.key);
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

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportCompanies || exporting}
            className="group flex items-center gap-4 rounded-2xl bg-cyan-700 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_15px_30px_rgba(14,116,144,0.25)] transition-all hover:bg-cyan-600 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(14,116,144,0.3)] disabled:opacity-50 disabled:translate-y-0 whitespace-nowrap"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Downloading...' : 'Download List'}
          </button>
        </div>

        {!canManageVerification ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-800">
            Verification actions are restricted to SuperAdmin.
          </p>
        ) : null}

        {!canExportCompanies ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm font-semibold text-amber-800">
            Companies export is restricted to SuperAdmin.
          </p>
        ) : null}

        {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-semibold text-rose-700">{error}</p> : null}
        {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700">{message}</p> : null}
        {downloadNotice ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-semibold text-emerald-700">{downloadNotice}</p> : null}

        {/* Companies List Card */}
        <div className="w-full rounded-[40px] border border-cyan-100 bg-white overflow-hidden shadow-[0_25px_60px_rgba(15,23,42,0.06)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 backdrop-blur-sm border-b border-slate-100">
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Company Name (Industry Partner Name)</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Representative</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Industry & Location</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Verification</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.length > 0 ? items.map((company, index) => (
                  <motion.tr
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    key={String(company?._id || index)}
                    className="group hover:bg-slate-50/50 transition-all duration-300"
                  >
                    <td className="px-10 py-6">
                      <div
                        onClick={() => openProfile(company)}
                        className="flex items-center gap-4 cursor-pointer group/name"
                        title="Click to view profile"
                      >
                        <div className="h-12 w-12 rounded-2xl border border-cyan-100/50 dark:border-cyan-900/30 overflow-hidden relative shrink-0 group-hover/name:scale-105 transition-transform duration-300">
                          <CompanyLogo
                            logo={company?.logo}
                            name={company?.companyName}
                            className="w-full h-full text-lg"
                          />
                        </div>
                        <div>
                          <p className="text-lg font-black text-slate-900 group-hover:text-cyan-700 transition-colors leading-tight">{company?.companyName || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-bold text-slate-600">{company?.representative?.name || company?.user?.fullName || company?.user?.name || company?.user?.email || 'N/A'}</span>
                    </td>
                    <td className="px-10 py-6">
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-600">{company?.industryType || 'N/A'}</p>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{company?.hqLocation || 'N/A'}</p>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border shadow-sm group-hover:scale-105 transition-transform ${company?.verification?.status === 'Verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                        company?.verification?.status === 'Rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                          'border-amber-200 bg-amber-50 text-amber-700'
                        }`}>
                        <div className="h-2 w-2 rounded-full bg-current" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {company?.verification?.status || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => openProfile(company)}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                        >
                          Profile
                        </button>
                        {getVerificationKey(company) === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ id: company?._id, status: 'Verified', companyName: company?.companyName || 'this company' })}
                              disabled={!canManageVerification || busyId === String(company?._id || '')}
                              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-700 transition-all hover:bg-emerald-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Verify
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmAction({ id: company?._id, status: 'Rejected', companyName: company?.companyName || 'this company' })}
                              disabled={!canManageVerification || busyId === String(company?._id || '')}
                              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 transition-all hover:bg-rose-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </>
                        ) : getVerificationKey(company) === 'verified' || getVerificationKey(company) === 'rejected' ? (
                          <button
                            type="button"
                            onClick={() => resetVerification(company?._id)}
                            disabled={!canManageVerification || busyId === String(company?._id || '')}
                            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-amber-700 transition-all hover:bg-amber-100 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reset
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </motion.tr>
                )) : !loading && (
                  <tr>
                    <td colSpan="5" className="px-10 py-28 text-center">
                      <div className="flex flex-col items-center justify-center gap-6">
                        <div className="h-24 w-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-5xl border border-slate-100 opacity-40 grayscale group-hover:grayscale-0 transition-all">🏢</div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-400">No companies found</p>
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
                className={`relative w-full max-w-4xl overflow-hidden rounded-[40px] bg-white p-10 md:p-12 shadow-[0_30px_70px_rgba(15,23,42,0.15)] border ${confirmAction.status === 'Verified' ? 'border-emerald-100' : 'border-rose-100'
                  }`}
              >
                {/* Decorative Premium Gradients */}
                <div className={`absolute top-0 right-0 h-80 w-80 pointer-events-none rounded-full blur-[80px] opacity-20 ${confirmAction.status === 'Verified'
                  ? 'bg-gradient-to-br from-emerald-400 to-cyan-500'
                  : 'bg-gradient-to-br from-rose-400 to-amber-500'
                  }`} />
                <div className={`absolute bottom-0 left-0 h-60 w-60 pointer-events-none rounded-full blur-[60px] opacity-10 ${confirmAction.status === 'Verified'
                  ? 'bg-gradient-to-br from-cyan-400 to-blue-500'
                  : 'bg-gradient-to-br from-orange-400 to-rose-500'
                  }`} />

                {/* Main Content Layout */}
                <div className="relative flex flex-col items-center text-center space-y-8">
                  {/* Status Indicator Icon */}
                  {confirmAction.status === 'Verified' ? (
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
                    <h3 className={`text-4xl lg:text-5xl font-black tracking-tight leading-none bg-gradient-to-r bg-clip-text text-transparent pb-1 ${confirmAction.status === 'Verified'
                      ? 'from-slate-900 via-emerald-800 to-emerald-600'
                      : 'from-slate-900 via-rose-800 to-rose-600'
                      }`}>
                      {confirmAction.status === 'Verified' ? 'Verify Partner Company' : 'Reject Partner Company'}
                    </h3>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                      Super Admin Security Confirmation
                    </p>
                  </div>

                  {/* Description Box */}
                  <div className="w-full bg-slate-50/80 backdrop-blur-sm rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-inner max-w-3xl">
                    <p className="text-xl md:text-2xl text-slate-700 leading-relaxed font-semibold">
                      Are you sure you want to update the verification status of{' '}
                      <span className={`font-black px-4 py-1.5 rounded-2xl bg-white border shadow-sm inline-block my-1 ${confirmAction.status === 'Verified' ? 'text-emerald-700 border-emerald-200' : 'text-rose-700 border-rose-200'
                        }`}>
                        {confirmAction?.companyName}
                      </span>{' '}
                      to{' '}
                      <span className={`font-black px-4 py-1.5 rounded-2xl border shadow-sm inline-block my-1 text-white uppercase tracking-widest ${confirmAction.status === 'Verified'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-500 border-emerald-500'
                        : 'bg-gradient-to-r from-rose-600 to-pink-500 border-rose-500'
                        }`}>
                        {confirmAction?.status}
                      </span>
                      ?
                    </p>
                    <p className="text-sm md:text-base text-slate-400 font-bold uppercase tracking-wider mt-4">
                      {confirmAction.status === 'Verified'
                        ? 'This company will gain access to post internships, manage programs, and interact with students.'
                        : 'This company will be restricted and notified. They can review their business documents and request verification again.'}
                    </p>

                    {/* Textarea for Rejection Reason */}
                    {confirmAction.status === 'Rejected' && (
                      <div className="mt-6 text-left space-y-4">
                        <label htmlFor="rejectionReason" className="block text-sm font-black uppercase tracking-widest text-slate-500">
                          Please provide a reason for rejection <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedRejectionReason}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSelectedRejectionReason(value);
                            if (value && value !== '__custom__') {
                              setRejectionReason(value);
                            } else if (value === '__custom__') {
                              setRejectionReason('');
                            }
                          }}
                          className="w-full rounded-2xl border border-amber-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/5 transition-all shadow-inner"
                        >
                          <option value="">Choose a professional reason</option>
                          {PROFESSIONAL_REJECTION_REASONS.map((reason) => (
                            <option key={reason} value={reason}>{reason}</option>
                          ))}
                          <option value="__custom__">Custom reason</option>
                        </select>
                        <textarea
                          id="rejectionReason"
                          rows={4}
                          value={rejectionReason}
                          onChange={(e) => {
                            setRejectionReason(e.target.value);
                            if (selectedRejectionReason && selectedRejectionReason !== '__custom__') {
                              setSelectedRejectionReason('__custom__');
                            }
                          }}
                          placeholder="If needed, type a professional custom reason here."
                          className="w-full rounded-2xl border border-rose-200 bg-white p-4 text-sm font-semibold text-slate-800 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 transition-all shadow-inner"
                        />
                      </div>
                    )}
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
                      onClick={runConfirmedVerification}
                      disabled={confirmAction.status === 'Rejected' && !String(rejectionReason || '').trim()}
                      className={`flex-1 rounded-2xl px-8 py-5 text-base font-black uppercase tracking-widest text-white shadow-lg transition-all active:scale-98 ${confirmAction.status === 'Verified'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/20'
                        : 'bg-gradient-to-r from-rose-600 to-pink-600 shadow-rose-500/20'
                        } ${confirmAction.status === 'Rejected' && !String(rejectionReason || '').trim() ? 'cursor-not-allowed opacity-50' : ''}`}
                    >
                      Yes, Confirm Action
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {profileModalOpen && (
          <>
            {/* Backdrop Blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeProfile}
              className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px]"
            />

            {/* Strategic Profile Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 right-0 z-[70] w-full max-w-2xl bg-white shadow-[-20px_0_60px_-15px_rgba(15,23,42,0.1)] overflow-y-auto"
            >
              {/* Drawer Header */}
              <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-xl border-b border-slate-100 p-8 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tighter">Company Profile</h2>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Business Information</p>
                </div>
                <button
                  onClick={closeProfile}
                  className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-all group"
                >
                  <svg className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-10 space-y-10">
                {profileLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <p className="text-sm font-bold text-slate-400">Loading company profile...</p>
                  </div>
                ) : null}

                {profileError ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-bold text-red-700">{profileError}</p>
                ) : null}

                {!profileLoading && selectedCompany ? (
                  <>
                    {/* Profile Header Section */}
                    <div className="flex items-center gap-8 border-b border-slate-200 pb-10">
                      <div className="h-32 w-32 rounded-3xl border border-cyan-100 shadow-md overflow-hidden relative shrink-0">
                        <CompanyLogo
                          logo={selectedCompany?.logo}
                          name={selectedCompany?.companyName}
                          className="w-full h-full text-5xl"
                        />
                      </div>
                      <div className="space-y-3 flex-1">
                        <h4 className="text-4xl font-black text-slate-900 tracking-tight leading-none">{selectedCompany?.companyName || 'Company Name Not Provided'}</h4>
                        <div className="flex items-center gap-4 flex-wrap mt-2">
                          <span className="text-sm font-bold uppercase tracking-wider text-slate-500">{selectedCompany?.industryType || 'Industry not set'}</span>
                          {selectedCompany?.companySize && <span className="text-sm font-bold uppercase tracking-wider text-cyan-700 bg-cyan-50 px-3 py-1.5 rounded-lg border border-cyan-100">{selectedCompany.companySize} Employees</span>}
                          {selectedCompany?.foundedYear && <span className="text-sm font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">Founded in {selectedCompany.foundedYear}</span>}
                        </div>
                      </div>
                    </div>

                    {/* Explicit Data Information List */}
                    <div className="space-y-8 bg-slate-50/50 rounded-[32px] p-10 border border-slate-100 shadow-inner">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        {/* Industry */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Industry</p>
                          <p className="text-2xl font-black text-slate-900 leading-tight">{selectedCompany?.industryType || 'N/A'}</p>
                        </div>

                        {/* Verification */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Verification Status</p>
                          <div className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border mt-1 ${selectedCompany?.verification?.status === 'Verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
                            selectedCompany?.verification?.status === 'Rejected' ? 'border-rose-200 bg-rose-50 text-rose-700' :
                              'border-amber-200 bg-amber-50 text-amber-700'
                            }`}>
                            <div className="h-2.5 w-2.5 rounded-full bg-current" />
                            <span className="text-sm font-black uppercase tracking-widest">{selectedCompany?.verification?.status || 'Pending'}</span>
                          </div>
                          {selectedCompany?.verification?.status === 'Rejected' && (
                            <div className="mt-3 space-y-2 animate-in fade-in duration-300">
                              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-xs font-semibold text-rose-800 max-w-sm relative group shadow-sm transition hover:shadow-md">
                                <span className="font-black uppercase tracking-widest text-[9px] block text-rose-500 mb-1">Rejection Reason:</span>
                                <div className="max-h-[100px] overflow-y-auto pr-1 text-xs font-black text-rose-950 leading-relaxed italic scrollbar-thin scrollbar-thumb-rose-200">
                                  "{selectedCompany?.verification?.reason || 'No reason specified.'}"
                                </div>
                                {canManageVerification && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrawerRejectionReason(selectedCompany?.verification?.reason || '');
                                      setDrawerEditModalOpen(true);
                                    }}
                                    className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-rose-700 shadow-sm transition hover:bg-rose-50 active:scale-95"
                                  >
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    Edit Reason
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                          {selectedCompany?.profileCompleteness !== undefined && (
                            <p className="text-sm text-slate-600 mt-2 font-semibold">Completeness: <span className="font-bold">{selectedCompany.profileCompleteness}%</span></p>
                          )}
                        </div>

                        {/* Representative */}
                        {(selectedCompany?.representative?.name || selectedCompany?.representative?.phone) && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Company Representative</p>
                            <p className="text-xl font-bold text-slate-900">Name: {selectedCompany.representative?.name || selectedCompany.user?.fullName || selectedCompany.user?.name}</p>
                            {selectedCompany.representative?.position && <p className="text-lg font-medium text-slate-600 mt-1">Position: {selectedCompany.representative.position}</p>}
                          </div>
                        )}

                        {/* Contact */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Contact</p>
                          <p className="text-xl font-bold text-slate-900 break-all">Email: {selectedCompany?.representative?.email || selectedCompany?.user?.email || selectedCompany?.officialEmail || 'No email'}</p>
                          {(selectedCompany?.representative?.phone || selectedCompany?.phone) && <p className="text-xl font-bold text-slate-900">Phone: {selectedCompany.representative?.phone || selectedCompany.phone}</p>}
                        </div>

                        {/* Location */}
                        {selectedCompany?.hqLocation && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Location</p>
                            <p className="text-xl font-bold text-slate-900">{selectedCompany.hqLocation}</p>
                          </div>
                        )}

                        {/* Website */}
                        {selectedCompany?.website && (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Website</p>
                            <p className="text-xl font-bold text-slate-900">{selectedCompany.website}</p>
                          </div>
                        )}

                        {/* Official Email */}
                        {selectedCompany?.officialEmail && (
                          <div className="space-y-2 col-span-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Official Email</p>
                            <p className="text-xl font-bold text-slate-900">{selectedCompany.officialEmail}</p>
                          </div>
                        )}

                        {/* Branches */}
                        {selectedCompany?.branches?.length > 0 && (
                          <div className="space-y-2 col-span-2">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Branches</p>
                            <p className="text-xl font-bold text-slate-900">{selectedCompany.branches.join(', ')}</p>
                          </div>
                        )}

                        {/* Focal Person */}
                        {(selectedCompany?.focalPerson?.name || selectedCompany?.focalPerson?.phone) && (
                          <div className="space-y-2 col-span-2 border-t border-slate-200 pt-8 mt-4">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Internship Focal Person</p>
                            {selectedCompany.focalPerson?.name && <p className="text-xl font-bold text-slate-900">Name: {selectedCompany.focalPerson.name}</p>}
                            {selectedCompany.focalPerson?.email && <p className="text-lg font-medium text-slate-600 mt-1">Email: {selectedCompany.focalPerson.email}</p>}
                            {selectedCompany.focalPerson?.phone && <p className="text-lg font-medium text-slate-600">Phone: {selectedCompany.focalPerson.phone}</p>}
                          </div>
                        )}

                        {/* Skills & Tech */}
                        {(selectedCompany?.requiredSkills?.length > 0 || selectedCompany?.preferredTech?.length > 0) && (
                          <div className="space-y-4 col-span-2 border-t border-slate-200 pt-8 mt-4">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Preferred Tech & Skills</p>
                            <div className="flex flex-wrap gap-3">
                              {[...(selectedCompany?.requiredSkills || []), ...(selectedCompany?.preferredTech || [])].map((item, i) => (
                                <span key={i} className="px-5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-700 shadow-sm">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Internship Details */}
                        {(selectedCompany?.internshipPeriod || selectedCompany?.internshipDuration || selectedCompany?.minimumCgpa || selectedCompany?.targetDepartments?.length > 0 || selectedCompany?.internshipFacilities?.length > 0 || selectedCompany?.expectedTasks || selectedCompany?.intakeCapacities?.length > 0) && (
                          <div className="space-y-4 col-span-2 border-t border-slate-200 pt-8 mt-4">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Internship Program Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                              {selectedCompany?.internshipPeriod && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Period</p>
                                  <p className="text-lg font-bold text-slate-900">{selectedCompany.internshipPeriod}</p>
                                </div>
                              )}
                              {selectedCompany?.internshipDuration && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Duration</p>
                                  <p className="text-lg font-bold text-slate-900">{selectedCompany.internshipDuration}</p>
                                </div>
                              )}
                              {selectedCompany?.minimumCgpa && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Minimum CGPA</p>
                                  <p className="text-lg font-bold text-slate-900">{selectedCompany.minimumCgpa}</p>
                                </div>
                              )}
                              {selectedCompany?.targetDepartments?.length > 0 && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-3">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Target Departments</p>
                                  <p className="text-lg font-bold text-slate-900 leading-relaxed">{selectedCompany.targetDepartments.join(', ')}</p>
                                </div>
                              )}
                              {selectedCompany?.internshipFacilities?.length > 0 && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-3">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Facilities</p>
                                  <p className="text-lg font-bold text-slate-900 leading-relaxed">{selectedCompany.internshipFacilities.join(', ')}</p>
                                </div>
                              )}
                              {selectedCompany?.expectedTasks && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-3">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tasks / Responsibilities</p>
                                  <p className="text-lg font-medium text-slate-700 leading-relaxed">{selectedCompany.expectedTasks}</p>
                                </div>
                              )}
                              {selectedCompany?.intakeCapacities?.length > 0 && (
                                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-3">
                                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Intake Capacities</p>
                                  <div className="flex flex-wrap gap-3">
                                    {selectedCompany.intakeCapacities.map((cap, i) => (
                                      <span key={i} className="px-4 py-2 bg-slate-50 border border-slate-200 text-slate-800 text-sm font-bold rounded-xl">
                                        {cap.department}: <span className="text-cyan-700">{cap.capacity} students</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        {selectedCompany?.tags?.length > 0 && (
                          <div className="space-y-4 col-span-2 border-t border-slate-200 pt-8 mt-4">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Tags</p>
                            <div className="flex flex-wrap gap-3">
                              {selectedCompany.tags.map((tag, i) => (
                                <span key={i} className="px-5 py-2.5 bg-cyan-50 border border-cyan-200 rounded-xl text-sm font-bold uppercase tracking-wider text-cyan-800 shadow-sm">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Description */}
                        {selectedCompany?.description && (
                          <div className="space-y-4 col-span-2 border-t border-slate-200 pt-8 mt-4">
                            <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">Description</p>
                            <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                              <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-600" />
                              <p className="text-lg text-slate-700 leading-relaxed font-medium">
                                {selectedCompany.description}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Verification Documents */}
                    {selectedCompany?.verification?.businessLicenseUrl && (
                      <div className="pt-8 space-y-4 col-span-1 md:col-span-2 border-t border-slate-200 mt-2">
                        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Verification Document</p>
                        <a
                          href={selectedCompany.verification.businessLicenseUrl.startsWith('http') ? selectedCompany.verification.businessLicenseUrl : `http://localhost:5000${selectedCompany.verification.businessLicenseUrl.startsWith('/') ? '' : '/'}${selectedCompany.verification.businessLicenseUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between w-full p-8 rounded-3xl bg-slate-900 text-white transition-all hover:bg-slate-800 shadow-xl border border-slate-700"
                        >
                          <div className="flex items-center gap-6">
                            <div className="h-16 w-16 rounded-2xl bg-white/10 flex items-center justify-center text-3xl group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">📄</div>
                            <div className="text-left">
                              <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Business License</p>
                              <p className="text-xl font-black uppercase tracking-widest mt-1 text-white group-hover:text-cyan-400 transition-colors">Click to Open Document</p>
                            </div>
                          </div>
                          <div className="h-12 w-12 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                            <svg className="w-6 h-6 text-white group-hover:text-cyan-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        </a>
                      </div>
                    )}

                    {/* Verification Actions */}
                    {canManageVerification && (
                      <div className="pt-8 border-t border-slate-200 mt-4">
                        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">Verification Actions</p>
                        <div className="flex gap-4">
                          <button
                            onClick={async () => {
                              const id = String(selectedCompany?._id || '');
                              if (!id) return;
                              await updateVerification(id, 'Verified');
                              setSelectedCompany(prev => prev ? { ...prev, verification: { ...prev.verification, status: 'Verified' } } : prev);
                            }}
                            disabled={selectedCompany?.verification?.status === 'Verified' || busyId === String(selectedCompany?._id || '')}
                            className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${selectedCompany?.verification?.status === 'Verified'
                              ? 'bg-emerald-100 text-emerald-400 border-2 border-emerald-200 cursor-not-allowed opacity-60'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg hover:shadow-xl border-2 border-emerald-600'
                              }`}
                          >
                            {selectedCompany?.verification?.status === 'Verified' ? '✓ Already Verified' : '✓ Verify Company'}
                          </button>
                          <button
                            onClick={async () => {
                              const id = String(selectedCompany?._id || '');
                              if (!id) return;
                              await updateVerification(id, 'Rejected');
                              setSelectedCompany(prev => prev ? { ...prev, verification: { ...prev.verification, status: 'Rejected' } } : prev);
                            }}
                            disabled={selectedCompany?.verification?.status === 'Rejected' || busyId === String(selectedCompany?._id || '')}
                            className={`flex-1 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${selectedCompany?.verification?.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-400 border-2 border-rose-200 cursor-not-allowed opacity-60'
                              : 'bg-rose-600 text-white hover:bg-rose-700 shadow-lg hover:shadow-xl border-2 border-rose-600'
                              }`}
                          >
                            {selectedCompany?.verification?.status === 'Rejected' ? '✕ Already Rejected' : '✕ Reject Company'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-6">
                      <button
                        onClick={closeProfile}
                        className="w-full py-5 rounded-2xl border-2 border-slate-100 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:border-slate-200 transition-all"
                      >
                        Close Profile
                      </button>
                    </div>
                  </>
                ) : null}
              </div>
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

      {/* High-Fidelity Dedicated Rejection Reason Editing Modal */}
      <AnimatePresence>
        {drawerEditModalOpen && (
          <>
            {/* Backdrop with premium glassmorphism */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[90] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-6"
            >
              {/* Modal Container */}
              <motion.div
                initial={{ scale: 0.95, y: 20, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.95, y: 20, opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 250 }}
                onClick={(e) => e.stopPropagation()}
                className="relative w-full max-w-3xl overflow-hidden rounded-[40px] bg-white p-10 md:p-12 shadow-[0_30px_70px_rgba(15,23,42,0.15)] border border-rose-100"
              >
                {/* Decorative Premium Gradients */}
                <div className="absolute top-0 right-0 h-80 w-80 pointer-events-none rounded-full blur-[80px] opacity-20 bg-gradient-to-br from-rose-400 to-amber-500" />
                <div className="absolute bottom-0 left-0 h-60 w-60 pointer-events-none rounded-full blur-[60px] opacity-10 bg-gradient-to-br from-orange-400 to-rose-500" />

                {/* Main Content Layout */}
                <div className="relative flex flex-col items-center text-center space-y-8">
                  {/* Status Indicator Icon */}
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-rose-100 animate-ping opacity-40 h-24 w-24" />
                    <div className="h-24 w-24 rounded-[32px] bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-md relative z-10">
                      <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </div>
                  </div>

                  {/* Header Title */}
                  <div className="space-y-3">
                    <h3 className="text-4xl lg:text-5xl font-black tracking-tight leading-none bg-gradient-to-r bg-clip-text text-transparent pb-1 from-slate-900 via-rose-800 to-rose-600">
                      Edit Rejection Reason
                    </h3>
                    <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">
                      {selectedCompany?.companyName || 'Partner Company'} • Verification
                    </p>
                  </div>

                  {/* Rejection Reason Form */}
                  <div className="w-full bg-slate-50/80 backdrop-blur-sm rounded-[32px] p-8 md:p-10 border border-slate-100 shadow-inner max-w-3xl text-left space-y-4">
                    <label htmlFor="modalRejectionReason" className="block text-sm font-black uppercase tracking-widest text-slate-500">
                      Specify Rejection Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      id="modalRejectionReason"
                      rows={5}
                      value={drawerRejectionReason}
                      onChange={(e) => setDrawerRejectionReason(e.target.value)}
                      placeholder="State clearly why this company profile is rejected (e.g. illegible documents, missing details...)"
                      className="w-full rounded-2xl border border-rose-200 bg-white p-5 text-base font-medium text-slate-800 outline-none focus:border-rose-500 focus:ring-4 focus:ring-rose-500/5 transition-all shadow-sm"
                    />
                  </div>

                  {/* Large & Wide Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-5 w-full max-w-2xl pt-4">
                    <button
                      type="button"
                      onClick={() => setDrawerEditModalOpen(false)}
                      className="flex-1 rounded-2xl border-2 border-slate-200 bg-white px-8 py-5 text-base font-black uppercase tracking-wider text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-md active:scale-98"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!drawerRejectionReason.trim() || busyId === String(selectedCompany?._id)}
                      onClick={updateDrawerRejectionReason}
                      className="flex-1 rounded-2xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30 px-8 py-5 text-base font-black uppercase tracking-widest text-white transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
