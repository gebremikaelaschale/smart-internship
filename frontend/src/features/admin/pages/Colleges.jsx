import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '@/components/common/Modal';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';

function formatTime(input) {
  if (!input) return '—';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function StatTile({ title, value, hint }) {
  return (
    <Card className="border-slate-200 bg-white/90 shadow-[0_16px_50px_rgba(15,23,42,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{title}</p>
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">{value}</p>
      {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
    </Card>
  );
}

function Pill({ tone = 'slate', children }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    slate: 'bg-slate-100 text-slate-700 ring-slate-200'
  };

  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ${tones[tone] || tones.slate}`}>{children}</span>;
}

function ActionButton({ children, tone = 'slate', ...props }) {
  const styles = {
    slate: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
    red: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
  };

  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center rounded-xl border px-3 py-2 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60 ${styles[tone] || styles.slate} ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

export default function Colleges() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [deanCandidates, setDeanCandidates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignScope, setAssignScope] = useState('single');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState({ type: '', payload: null });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [collegeName, setCollegeName] = useState('');
  const [editCollegeName, setEditCollegeName] = useState('');
  const [deanId, setDeanId] = useState('');
  const [createDeanId, setCreateDeanId] = useState('');
  const [createDeanName, setCreateDeanName] = useState('');
  const [createDeanEmail, setCreateDeanEmail] = useState('');

  const deanOptions = useMemo(() => deanCandidates, [deanCandidates]);

  const loadData = async () => {
    let active = true;
    try {
      setLoading(true);
      setError('');
      const [collegesResponse, deansResponse, departmentsResponse] = await Promise.all([
        adminAPI.getColleges(),
        adminAPI.getDeanCandidates(),
        adminAPI.getDepartments()
      ]);
      if (!active) return;
      setItems(Array.isArray(collegesResponse?.data) ? collegesResponse.data : []);
      setDeanCandidates(Array.isArray(deansResponse?.data) ? deansResponse.data : []);
      setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
    } catch (requestError) {
      if (!active) return;
      setError(requestError?.response?.data?.message || 'Failed to load colleges.');
    } finally {
      if (active) setLoading(false);
    }

    return () => {
      active = false;
    };
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        setError('');
        const [collegesResponse, deansResponse, departmentsResponse] = await Promise.all([
          adminAPI.getColleges(),
          adminAPI.getDeanCandidates(),
          adminAPI.getDepartments()
        ]);
        if (!active) return;
        setItems(Array.isArray(collegesResponse?.data) ? collegesResponse.data : []);
        setDeanCandidates(Array.isArray(deansResponse?.data) ? deansResponse.data : []);
        setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load colleges.');
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, []);

  const departmentsByCollege = useMemo(() => {
    return departments.reduce((accumulator, department) => {
      const key = String(department?.college?._id || department?.college || '');
      if (!key) return accumulator;
      if (!accumulator[key]) accumulator[key] = [];
      accumulator[key].push(department);
      return accumulator;
    }, {});
  }, [departments]);

  const stats = useMemo(() => {
    const collegesTotal = items.length;
    const deansTotal = items.filter((item) => item?.dean?._id || item?.dean).length;
    const departmentsTotal = items.reduce((total, item) => total + Number(item?.departmentCount || 0), 0);
    const unassignedTotal = items.filter((item) => !(item?.dean?._id || item?.dean)).length;
    return { collegesTotal, deansTotal, departmentsTotal, unassignedTotal };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let next = [...items];

    if (query) {
      next = next.filter((college) => {
        const deanEmail = String(college?.dean?.email || '').toLowerCase();
        const deanName = String(college?.dean?.fullName || college?.dean?.name || '').toLowerCase();
        const collegeNameText = String(college?.name || '').toLowerCase();
        return collegeNameText.includes(query) || deanEmail.includes(query) || deanName.includes(query);
      });
    }

    if (statusFilter !== 'all') {
      next = next.filter((college) => {
        const hasDean = Boolean(college?.dean?._id || college?.dean);
        const deptCount = Number(college?.departmentCount || 0);
        if (statusFilter === 'hasDean') return hasDean;
        if (statusFilter === 'noDean') return !hasDean;
        if (statusFilter === 'active') return hasDean && deptCount > 0;
        if (statusFilter === 'partial') return hasDean && deptCount === 0;
        return true;
      });
    }

    if (departmentFilter !== 'all') {
      next = next.filter((college) => {
        const deptCount = Number(college?.departmentCount || 0);
        if (departmentFilter === 'hasDepartments') return deptCount > 0;
        if (departmentFilter === 'zeroDepartments') return deptCount === 0;
        if (departmentFilter === 'manyDepartments') return deptCount >= 3;
        return true;
      });
    }

    next.sort((a, b) => {
      if (sortBy === 'mostDepartments') return Number(b?.departmentCount || 0) - Number(a?.departmentCount || 0);
      if (sortBy === 'name') return String(a?.name || '').localeCompare(String(b?.name || ''));
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return next;
  }, [items, searchTerm, statusFilter, departmentFilter, sortBy]);

  const resetCreateForm = () => {
    setCollegeName('');
    setCreateDeanId('');
    setCreateDeanName('');
    setCreateDeanEmail('');
    setCreateOpen(false);
  };

  const openDetails = (college) => {
    setSelectedCollege(college);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setDetailOpen(false);
    setSelectedCollege(null);
  };

  const openEditModal = (college) => {
    setSelectedCollege(college);
    setEditCollegeName(String(college?.name || ''));
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setSelectedCollege(null);
    setEditCollegeName('');
    setEditOpen(false);
  };

  const openAssignModal = (college = null, scope = 'single') => {
    setSelectedCollege(college);
    setAssignScope(scope);
    setDeanId(String(college?.dean?._id || ''));
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setSelectedCollege(null);
    setAssignScope('single');
    setDeanId('');
    setAssignOpen(false);
  };

  const saveCollege = async () => {
    const name = String(collegeName || '').trim();
    if (!name) {
      setError('College name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = { name };
      const deanName = String(createDeanName || '').trim();
      const deanEmail = String(createDeanEmail || '').trim();

      if (deanName && deanEmail) {
        payload.dean = { name: deanName, email: deanEmail };
      } else if (createDeanId) {
        payload.deanId = createDeanId;
      }

      const { data } = await adminAPI.createCollege(payload);
      setMessage(data?.message || 'College created successfully.');
      if (data?.temporaryPassword) {
        setMessage(`${data?.message || 'College created successfully.'} Temporary password was emailed to the dean.`);
      }
      resetCreateForm();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to create college.');
    } finally {
      setSaving(false);
    }
  };

  const saveCollegeEdit = async () => {
    const name = String(editCollegeName || '').trim();
    if (!selectedCollege?._id || !name) {
      setError('College name is required.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateCollege(selectedCollege._id, { name });
      setMessage(data?.message || 'College updated successfully.');
      closeEditModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update college.');
    } finally {
      setSaving(false);
    }
  };

  const saveDean = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');

      const targets = assignScope === 'bulk'
        ? selectedIds
        : selectedCollege?._id
          ? [selectedCollege._id]
          : [];

      if (targets.length === 0) {
        setError('Select at least one college first.');
        return;
      }

      await Promise.all(targets.map((collegeId) => adminAPI.assignCollegeDean(collegeId, { deanId: deanId || undefined })));
      setMessage(targets.length > 1 ? 'Dean assigned to selected colleges successfully.' : 'Dean assignment updated successfully.');
      closeAssignModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign dean.');
    } finally {
      setSaving(false);
    }
  };

  const openConfirm = ({ title, message: body, type, payload = null }) => {
    setConfirmTitle(title);
    setConfirmMessage(body);
    setConfirmAction({ type, payload });
    setConfirmOpen(true);
  };

  const closeConfirm = () => {
    setConfirmOpen(false);
    setConfirmTitle('');
    setConfirmMessage('');
    setConfirmAction({ type: '', payload: null });
  };

  const deleteCollege = async (college) => {
    if (!college?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await adminAPI.deleteCollege(college._id);
      setMessage('College deleted successfully.');
      await loadData();
      if (selectedCollege?._id === college._id) closeDetails();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete college.');
    } finally {
      setSaving(false);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.length === 0) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await Promise.all(selectedIds.map((collegeId) => adminAPI.deleteCollege(collegeId)));
      setMessage('Selected colleges deleted successfully.');
      setSelectedIds([]);
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete selected colleges.');
    } finally {
      setSaving(false);
    }
  };

  const resetDeanPassword = async (college) => {
    if (!college?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.resetCollegeDeanPassword(college._id);
      setMessage(data?.message || 'Dean password reset successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to reset dean password.');
    } finally {
      setSaving(false);
    }
  };

  const exportColleges = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const response = await adminAPI.exportColleges();
      const filename = `colleges-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadBlob(response.data, filename);
      setMessage('Colleges exported successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to export colleges.');
    } finally {
      setSaving(false);
    }
  };

  const executeConfirm = async () => {
    const { type, payload } = confirmAction;
    closeConfirm();

    if (type === 'delete-one') {
      await deleteCollege(payload);
      return;
    }

    if (type === 'delete-selected') {
      await deleteSelected();
      return;
    }

    if (type === 'reset-dean') {
      await resetDeanPassword(payload);
    }
  };

  const toggleSelected = (collegeId) => {
    setSelectedIds((current) => (
      current.includes(collegeId)
        ? current.filter((id) => id !== collegeId)
        : [...current, collegeId]
    ));
  };

  const toggleAll = () => {
    const currentIds = filteredItems.map((item) => String(item?._id || ''));
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : currentIds);
  };

  const selectedCollegeDepartments = useMemo(() => {
    if (!selectedCollege?._id) return [];
    const collegeId = String(selectedCollege._id);
    return departmentsByCollege[collegeId] || [];
  }, [departmentsByCollege, selectedCollege]);

  const bulkAssignedDisabled = selectedIds.length === 0 || saving;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.25)] lg:px-8 lg:py-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-blue-100">
              University Structure Control Panel
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight md:text-4xl">Colleges Management</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                Manage colleges, deans, and the academic hierarchy from one enterprise dashboard.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <ActionButton tone="blue" onClick={() => setCreateOpen(true)} className="bg-white/95 text-slate-900 hover:bg-white">
              + Create College
            </ActionButton>
            <ActionButton
              tone="slate"
              onClick={exportColleges}
              disabled={saving}
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
            >
              Export CSV
            </ActionButton>
            <ActionButton
              tone="slate"
              onClick={() => openAssignModal(null, 'bulk')}
              disabled={selectedIds.length === 0}
              className="border-white/15 bg-white/10 text-white hover:bg-white/15"
            >
              Assign Dean ({selectedIds.length})
            </ActionButton>
            <ActionButton
              tone="red"
              onClick={() => openConfirm({
                title: 'Delete selected colleges?',
                message: `This will permanently remove ${selectedIds.length} selected college(s). This action cannot be undone.`,
                type: 'delete-selected'
              })}
              disabled={selectedIds.length === 0 || saving}
              className="border-white/15 bg-white/10 text-rose-100 hover:bg-rose-500/20"
            >
              Delete Selected
            </ActionButton>
          </div>
        </div>

        <div className="mt-6 grid gap-3 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur md:grid-cols-3 xl:grid-cols-5">
          <label className="xl:col-span-2">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Search</span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by college name or dean email"
              className="h-12 w-full rounded-xl border border-white/10 bg-white/95 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-4 focus:ring-blue-200"
            />
          </label>

          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Filter</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/95 px-4 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-blue-200"
            >
              <option value="all">All Colleges</option>
              <option value="active">Active</option>
              <option value="partial">Partial</option>
              <option value="hasDean">Has Dean</option>
              <option value="noDean">No Dean</option>
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Departments</span>
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/95 px-4 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-blue-200"
            >
              <option value="all">Any count</option>
              <option value="hasDepartments">Has departments</option>
              <option value="zeroDepartments">No departments</option>
              <option value="manyDepartments">3+ departments</option>
            </select>
          </label>

          <label>
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="h-12 w-full rounded-xl border border-white/10 bg-white/95 px-4 text-sm text-slate-900 outline-none focus:ring-4 focus:ring-blue-200"
            >
              <option value="newest">Newest</option>
              <option value="mostDepartments">Most Departments</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Colleges" value={stats.collegesTotal} hint="Registered academic colleges" />
        <StatTile title="Deans" value={stats.deansTotal} hint="Colleges with a dean assigned" />
        <StatTile title="Departments" value={stats.departmentsTotal} hint="Total departments across scope" />
        <StatTile title="Unassigned" value={stats.unassignedTotal} hint="Colleges still missing a dean" />
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">{message}</p> : null}

      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)]" title="College Registry" description="Click a college for details. Use the action column to edit, assign, or delete.">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(String(item?._id || '')))} onChange={toggleAll} />
              Select all
            </label>
            <span>{filteredItems.length} visible</span>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton onClick={() => setCreateOpen(true)} tone="blue">+ Create College</ActionButton>
            <ActionButton onClick={() => openAssignModal(null, 'bulk')} disabled={bulkAssignedDisabled}>Assign Dean</ActionButton>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-3 py-2"> </th>
                  <th className="px-3 py-2">College</th>
                  <th className="px-3 py-2">Dean</th>
                  <th className="px-3 py-2">Departments</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Last Updated</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((college) => {
                  const id = String(college?._id || '');
                  const hasDean = Boolean(college?.dean?._id || college?.dean);
                  const departmentCount = Number(college?.departmentCount || 0);
                  const statusTone = hasDean && departmentCount > 0 ? 'green' : hasDean ? 'amber' : 'red';
                  const statusLabel = hasDean && departmentCount > 0 ? 'Active' : hasDean ? 'Partial' : 'Missing';

                  return (
                    <tr
                      key={id}
                      className="group rounded-2xl transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                    >
                      <td className="rounded-l-2xl border border-r-0 border-slate-200 bg-white px-3 py-4 align-top">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(id)}
                          onChange={() => toggleSelected(id)}
                        />
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <button type="button" onClick={() => openDetails(college)} className="text-left">
                          <p className="font-bold text-slate-950 transition group-hover:text-blue-700">{college?.name || 'Unnamed college'}</p>
                          <p className="text-xs text-slate-500">Click to open details</p>
                        </button>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <p className="font-semibold text-slate-900">{college?.dean?.fullName || college?.dean?.name || 'No Dean'}</p>
                        {college?.dean?.email ? <p className="text-xs text-slate-500">{college.dean.email}</p> : <p className="text-xs text-slate-400">Assign a dean to activate governance</p>}
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <button type="button" onClick={() => openDetails(college)} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
                          {departmentCount} departments
                        </button>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <Pill tone={statusTone}>{statusLabel}</Pill>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top text-slate-600">
                        {formatTime(college?.updatedAt || college?.createdAt)}
                      </td>
                      <td className="rounded-r-2xl border border-l-0 border-slate-200 bg-white px-3 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton onClick={() => openDetails(college)} title="View">View</ActionButton>
                          <ActionButton onClick={() => openEditModal(college)} tone="blue" title="Edit">Edit</ActionButton>
                          <ActionButton onClick={() => openAssignModal(college, 'single')} title="Assign dean">Manage</ActionButton>
                          <ActionButton
                            onClick={() => openConfirm({
                              title: `Reset dean password?`,
                              message: `A new temporary password will be generated and emailed to ${college?.dean?.email || 'the assigned dean'}.`,
                              type: 'reset-dean',
                              payload: college
                            })}
                            tone="slate"
                            disabled={!college?.dean?.email || saving}
                            title="Reset dean password"
                          >
                            Reset Password
                          </ActionButton>
                          <ActionButton
                            onClick={() => openConfirm({
                              title: `Delete ${college?.name || 'college'}?`,
                              message: 'This action permanently removes the college record.',
                              type: 'delete-one',
                              payload: college
                            })}
                            tone="red"
                            disabled={saving}
                            title="Delete"
                          >
                            Delete
                          </ActionButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-2xl font-bold text-slate-950">No Colleges Found</p>
            <p className="mt-2 text-sm text-slate-500">Start by creating your first college or clear the current filters.</p>
            <div className="mt-6 flex justify-center gap-3">
              <ActionButton tone="blue" onClick={() => setCreateOpen(true)}>+ Create College</ActionButton>
              <ActionButton onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDepartmentFilter('all'); setSortBy('newest'); }}>Reset Filters</ActionButton>
            </div>
          </div>
        )}
      </Card>

      <Modal open={createOpen} title="Create College" onClose={resetCreateForm}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">College Name</label>
            <input value={collegeName} onChange={(event) => setCollegeName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" placeholder="e.g. College of Computing" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dean Name</label>
              <input value={createDeanName} onChange={(event) => setCreateDeanName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" placeholder="Optional" />
            </div>
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dean Email</label>
              <input value={createDeanEmail} onChange={(event) => setCreateDeanEmail(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" placeholder="Optional" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Or choose existing dean</label>
            <select value={createDeanId} onChange={(event) => setCreateDeanId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100">
              <option value="">No dean assigned yet</option>
              {deanOptions.map((candidate) => (
                <option key={String(candidate?._id || '')} value={candidate?._id || ''}>
                  {(candidate?.fullName || candidate?.name || 'Unnamed user')} - {candidate?.email || 'no email'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton onClick={resetCreateForm}>Cancel</ActionButton>
            <ActionButton tone="blue" onClick={saveCollege} disabled={saving}>{saving ? 'Creating...' : 'Create College'}</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={editOpen} title="Edit College" onClose={closeEditModal}>
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">College Name</label>
            <input value={editCollegeName} onChange={(event) => setEditCollegeName(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100" placeholder="Rename college" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton onClick={closeEditModal}>Cancel</ActionButton>
            <ActionButton tone="blue" onClick={saveCollegeEdit} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={assignOpen} title={assignScope === 'bulk' ? 'Assign Dean to Selected Colleges' : 'Assign Dean'} onClose={closeAssignModal}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {assignScope === 'bulk'
              ? `Assign a dean to ${selectedIds.length} selected college(s).`
              : `Assign a dean for ${selectedCollege?.name || 'this college'}.`}
          </p>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dean</label>
            <select value={deanId} onChange={(event) => setDeanId(event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-blue-100">
              <option value="">Remove dean assignment</option>
              {deanOptions.map((candidate) => (
                <option key={String(candidate?._id || '')} value={candidate?._id || ''}>
                  {(candidate?.fullName || candidate?.name || 'Unnamed user')} - {candidate?.email || 'no email'}
                </option>
              ))}
            </select>
          </div>

          {assignScope === 'single' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Dean Credentials</p>
              <p className="mt-1 text-sm text-slate-600">
                Send a fresh temporary password email to the currently assigned dean.
              </p>
              <div className="mt-3">
                <ActionButton
                  tone="slate"
                  disabled={!selectedCollege?.dean?.email || saving}
                  onClick={() => openConfirm({
                    title: 'Send temporary password again?',
                    message: `A new temporary password will be emailed to ${selectedCollege?.dean?.email || 'the assigned dean'}.`,
                    type: 'reset-dean',
                    payload: selectedCollege
                  })}
                >
                  Send Temporary Password Again
                </ActionButton>
              </div>
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <ActionButton onClick={closeAssignModal}>Cancel</ActionButton>
            <ActionButton tone="blue" onClick={saveDean} disabled={saving}>{saving ? 'Saving...' : 'Save Dean'}</ActionButton>
          </div>
        </div>
      </Modal>

      <Modal open={confirmOpen} title={confirmTitle || 'Confirm action'} onClose={closeConfirm}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{confirmMessage || 'Please confirm this action.'}</p>
          <div className="flex justify-end gap-2 pt-2">
            <ActionButton onClick={closeConfirm}>Cancel</ActionButton>
            <ActionButton tone="red" onClick={executeConfirm} disabled={saving}>{saving ? 'Working...' : 'Confirm'}</ActionButton>
          </div>
        </div>
      </Modal>

      {detailOpen && selectedCollege ? (
        <div className="fixed inset-0 z-50 bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="ml-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_100px_rgba(15,23,42,0.35)]">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">College Details</p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">{selectedCollege?.name || 'College'}</h2>
                <p className="mt-1 text-sm text-slate-500">Dean, departments, and structure overview</p>
              </div>
              <ActionButton onClick={closeDetails}>Close</ActionButton>
            </div>

            <div className="grid gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dean</p>
                <p className="mt-2 font-bold text-slate-950">{selectedCollege?.dean?.fullName || selectedCollege?.dean?.name || 'No Dean'}</p>
                {selectedCollege?.dean?.email ? <p className="text-sm text-slate-500">{selectedCollege.dean.email}</p> : null}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Departments</p>
                <p className="mt-2 text-3xl font-black text-slate-950">{Number(selectedCollege?.departmentCount || 0)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Status</p>
                <div className="mt-2">
                  <Pill tone={selectedCollege?.dean ? 'green' : 'red'}>{selectedCollege?.dean ? 'Active' : 'Missing Dean'}</Pill>
                </div>
              </div>
            </div>

            <div className="border-b border-slate-200 px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Dean Access</p>
                  <p className="text-sm text-slate-600">Need to resend credentials? Send a new temporary password by email.</p>
                </div>
                <ActionButton
                  tone="slate"
                  disabled={!selectedCollege?.dean?.email || saving}
                  onClick={() => openConfirm({
                    title: 'Reset dean password?',
                    message: `A new temporary password will be generated and emailed to ${selectedCollege?.dean?.email || 'the assigned dean'}.`,
                    type: 'reset-dean',
                    payload: selectedCollege
                  })}
                >
                  Send Temporary Password Again
                </ActionButton>
              </div>
            </div>

            <div className="flex-1 overflow-auto px-6 py-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-950">Departments</h3>
                  <p className="text-sm text-slate-500">Departments attached to this college</p>
                </div>
                <ActionButton onClick={() => navigate('/admin/departments')}>Manage Departments</ActionButton>
              </div>

              <div className="mt-4 grid gap-3">
                {selectedCollegeDepartments.length > 0 ? selectedCollegeDepartments.map((department) => (
                  <div key={String(department?._id || department?.name || Math.random())} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-950">{department?.name || 'Unnamed department'}</p>
                        <p className="text-sm text-slate-500">HOD: {department?.head?.fullName || department?.head?.name || 'Not assigned'}</p>
                        {department?.head?.email ? <p className="text-xs text-slate-400">{department.head.email}</p> : null}
                      </div>
                      <Pill tone={department?.head ? 'green' : 'amber'}>{department?.head ? 'Assigned' : 'Pending'}</Pill>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    No departments yet. Use the Departments page to add one.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
