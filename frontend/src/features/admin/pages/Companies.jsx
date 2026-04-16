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

  const updateVerification = async (id, status) => {
    try {
      setBusyId(String(id || ''));
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateCompanyVerification(id, { status });
      const updated = data?.item;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, verification: updated.verification }
            : item
        )));
      }
      setMessage(`Company verification updated to ${status}.`);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update company verification.');
    } finally {
      setBusyId('');
    }
  };

  const runConfirmedVerification = async () => {
    if (!confirmAction?.id || !confirmAction?.status) return;
    const { id, status } = confirmAction;
    setConfirmAction(null);
    await updateVerification(id, status);
  };

  const openProfile = async (company) => {
    const companyId = String(company?._id || '');
    if (!companyId) return;

    setProfileModalOpen(true);
    setProfileLoading(true);
    setProfileError('');
    setSelectedCompany(company);

    try {
      const { data } = await adminAPI.getCompanyProfile(companyId);
      setSelectedCompany(data?.item || company);
    } catch (requestError) {
      setProfileError(requestError?.response?.data?.message || 'Failed to load company profile.');
    } finally {
      setProfileLoading(false);
    }
  };

  const closeProfile = () => {
    setProfileModalOpen(false);
    setSelectedCompany(null);
    setProfileLoading(false);
    setProfileError('');
  };

  return (
    <Card title="Companies" description="Manage partner companies and verification status.">
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => {
            setPage(1);
            setQuery(event.target.value);
          }}
          placeholder="Search company"
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportCompanies}
            className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700"
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
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
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {!canManageVerification ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Verification actions are restricted to SuperAdmin.
        </p>
      ) : null}

      {!canExportCompanies ? (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Companies export is restricted to SuperAdmin.
        </p>
      ) : null}

      {error ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      <DataFreshness value={lastRefreshed} />
      {message ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
      {downloadNotice ? <p className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{downloadNotice}</p> : null}
      {loading ? <p className="text-sm text-slate-500">Loading companies...</p> : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Representative</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Industry</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Location</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Verification</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Fraud Risk</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((company) => (
                <tr key={String(company?._id || '')}>
                  <td className="px-4 py-3">{company?.companyName || 'N/A'}</td>
                  <td className="px-4 py-3">{company?.user?.fullName || company?.user?.name || company?.user?.email || 'N/A'}</td>
                  <td className="px-4 py-3">{company?.industryType || 'N/A'}</td>
                  <td className="px-4 py-3">{company?.hqLocation || 'N/A'}</td>
                  <td className="px-4 py-3">{company?.verification?.status || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${company?.fraud?.riskLevel === 'High' ? 'bg-rose-100 text-rose-700' : company?.fraud?.riskLevel === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {company?.fraud?.riskLevel || 'Low'} ({Number(company?.fraud?.score || 0)})
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openProfile(company)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700"
                      >
                        View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ id: company?._id, status: 'Verified', companyName: company?.companyName || 'this company' })}
                        disabled={!canManageVerification || busyId === String(company?._id || '')}
                        className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
                      >
                        Verify
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({ id: company?._id, status: 'Rejected', companyName: company?.companyName || 'this company' })}
                        disabled={!canManageVerification || busyId === String(company?._id || '')}
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

      {!loading && items.length === 0 ? <p className="text-sm text-slate-500">No companies found.</p> : null}

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
        title="Confirm Company Verification Update"
        onClose={() => setConfirmAction(null)}
      >
        <p className="text-sm text-slate-700">
          Set verification status for <span className="font-semibold">{confirmAction?.companyName}</span> to <span className="font-semibold">{confirmAction?.status}</span>?
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
            onClick={runConfirmedVerification}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
          >
            Confirm
          </button>
        </div>
      </Modal>

      <Modal
        open={profileModalOpen}
        title="Company Profile"
        onClose={closeProfile}
      >
        {profileLoading ? <p className="text-sm text-slate-500">Loading company profile...</p> : null}
        {profileError ? <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileError}</p> : null}

        {!profileLoading && selectedCompany ? (
          <div className="space-y-4 text-sm text-slate-700">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Company</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedCompany?.companyName || 'N/A'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.industryType || 'Industry not set'}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedCompany?.verification?.status || 'Pending'}</p>
                <p className="mt-1 text-slate-600">Profile completeness: {selectedCompany?.profileCompleteness ?? 0}%</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Representative</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedCompany?.representative?.name || selectedCompany?.user?.fullName || selectedCompany?.user?.name || 'N/A'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.representative?.position || 'Representative position not set'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.representative?.email || selectedCompany?.user?.email || 'No representative email'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.representative?.phone || selectedCompany?.phone || 'No representative phone'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Location</p>
                <p className="mt-1 font-semibold text-slate-900">{selectedCompany?.hqLocation || 'HQ not set'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.website || 'Website not provided'}</p>
                <p className="mt-1 text-slate-600">{selectedCompany?.officialEmail || 'Official email not provided'}</p>
              </div>
            </div>

            {selectedCompany?.description ? (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Description</p>
                <p className="mt-1 leading-6 text-slate-700">{selectedCompany.description}</p>
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Verification Documents</p>
                <div className="mt-2 space-y-2 text-sm">
                  <p>
                    License:{' '}
                    {selectedCompany?.verification?.businessLicenseUrl ? (
                      <a className="text-blue-700 underline" href={selectedCompany.verification.businessLicenseUrl} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    ) : 'Not uploaded'}
                  </p>
                  <p>
                    Registration:{' '}
                    {selectedCompany?.verification?.registrationDocUrl ? (
                      <a className="text-blue-700 underline" href={selectedCompany.verification.registrationDocUrl} target="_blank" rel="noreferrer">
                        Open file
                      </a>
                    ) : 'Not uploaded'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Tags and Skills</p>
                <p className="mt-2 text-slate-700">Tags: {Array.isArray(selectedCompany?.tags) && selectedCompany.tags.length > 0 ? selectedCompany.tags.join(', ') : 'None'}</p>
                <p className="mt-1 text-slate-700">Skills: {Array.isArray(selectedCompany?.requiredSkills) && selectedCompany.requiredSkills.length > 0 ? selectedCompany.requiredSkills.join(', ') : 'None'}</p>
                <p className="mt-1 text-slate-700">Tech: {Array.isArray(selectedCompany?.preferredTech) && selectedCompany.preferredTech.length > 0 ? selectedCompany.preferredTech.join(', ') : 'None'}</p>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ExportReasonModal
        open={exportModalOpen}
        title="Export Companies CSV"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={async (reason) => {
          try {
            setExporting(true);
            setError('');
            const { data, headers } = await adminAPI.exportCompanies({ q: query || undefined, verification, reason });
            const disposition = String(headers?.['content-disposition'] || '');
            const match = disposition.match(/filename="?([^";]+)"?/i);
            downloadCsvBlob(match?.[1] || `admin-companies-${Date.now()}.csv`, data);
            setDownloadNotice('Companies CSV exported successfully.');
            setExportModalOpen(false);
          } catch (requestError) {
            setError(requestError?.response?.data?.message || 'Failed to export companies CSV.');
          } finally {
            setExporting(false);
          }
        }}
      />
    </Card>
  );
}
