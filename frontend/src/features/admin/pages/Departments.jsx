import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Modal from '@/components/common/Modal';
import useAuth from '@/hooks/useAuth';
import { adminAPI } from '../adminAPI';
import AdvancedExportModal from '../components/AdvancedExportModal';
import DepartmentFormModal from '../components/DepartmentFormModal';

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

function AnimatedCounter({ value, duration = 800 }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10) || 0;
    if (start === end) {
      setCount(end);
      return;
    }

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsedTime = currentTime - startTime;
      const progress = Math.min(elapsedTime / duration, 1);

      // Smooth ease-out quad
      const easeProgress = progress * (2 - progress);
      const currentVal = Math.round(start + (end - start) * easeProgress);

      setCount(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(end);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{count}</span>;
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
    slate: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm',
    cyan: 'border-transparent bg-cyan-700 text-white shadow-[0_10px_20px_rgba(14,116,144,0.25)] hover:bg-cyan-600 hover:shadow-[0_15px_30px_rgba(14,116,144,0.3)]',
    red: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 shadow-sm'
  };

  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center rounded-2xl border px-5 py-3.5 text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-200 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 ${styles[tone] || styles.slate} ${props.className || ''}`}
    >
      {children}
    </button>
  );
}

export default function Departments() {
  const auth = useAuth();
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canManage = adminType === 'collegeadmin';
  const isDean = String(auth?.user?.role || '').toLowerCase() === 'dean';

  const [items, setItems] = useState([]);
  const [colleges, setColleges] = useState([]);
  const [headCandidates, setHeadCandidates] = useState([]);
  const [totalStudentCount, setTotalStudentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [collegeId, setCollegeId] = useState('');
  const [headId, setHeadId] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [collegeFilter, setCollegeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Confirmation modal states
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState({ type: '', payload: null });

  const headOptions = useMemo(() => headCandidates, [headCandidates]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const loadData = async () => {
    let active = true;
    try {
      setLoading(true);
      setError('');
      const [departmentsResponse, collegesResponse, headsResponse, studentsResponse] = await Promise.all([
        adminAPI.getDepartments(),
        adminAPI.getColleges(),
        adminAPI.getDepartmentHeadCandidates(),
        adminAPI.getStudents({ limit: 1 })
      ]);

      if (!active) return;
      const loadedDepartments = Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : [];
      const loadedColleges = Array.isArray(collegesResponse?.data) ? collegesResponse.data : [];
      const loadedHeads = Array.isArray(headsResponse?.data) ? headsResponse.data : [];

      setItems(loadedDepartments);
      setColleges(loadedColleges);
      setHeadCandidates(loadedHeads);
      setTotalStudentCount(Number(studentsResponse?.data?.pagination?.total || 0));

      if (loadedColleges.length > 0) {
        setCollegeId((current) => String(current || loadedColleges[0]._id || ''));
      }
    } catch (requestError) {
      if (!active) return;
      setError(requestError?.response?.data?.message || 'Failed to load departments.');
    } finally {
      if (active) setLoading(false);
    }
    return () => {
      active = false;
    };
  };

  useEffect(() => {
    loadData();
  }, []);

  const stats = useMemo(() => {
    const totalCount = items.length;
    const activeHods = items.filter(d => d.head?._id || d.head).length;
    const missingHods = totalCount - activeHods;
    const totalMembers = items.reduce((sum, d) => sum + Number(d.memberCount || 0), 0);
    return { totalCount, activeHods, missingHods, totalStudents: totalStudentCount, totalMembers };
  }, [items, totalStudentCount]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    let next = [...items];

    if (query) {
      next = next.filter((dept) => {
        const deptName = String(dept?.name || '').toLowerCase();
        const collegeName = String(dept?.college?.name || '').toLowerCase();
        const hodName = String(dept?.head?.fullName || dept?.head?.name || '').toLowerCase();
        const hodEmail = String(dept?.head?.email || '').toLowerCase();
        const hodPhone = String(dept?.head?.phone || '').toLowerCase();
        return deptName.includes(query) || collegeName.includes(query) || hodName.includes(query) || hodEmail.includes(query) || hodPhone.includes(query);
      });
    }

    if (statusFilter !== 'all') {
      next = next.filter((dept) => {
        const hasHead = Boolean(dept?.head?._id || dept?.head);
        if (statusFilter === 'active') return hasHead;
        if (statusFilter === 'missingHOD') return !hasHead;
        return true;
      });
    }

    if (collegeFilter !== 'all') {
      next = next.filter((dept) => {
        const parentId = String(dept?.college?._id || dept?.college || '');
        return parentId === collegeFilter;
      });
    }

    next.sort((a, b) => {
      if (sortBy === 'studentsCount') return Number(b?.studentCount || 0) - Number(a?.studentCount || 0);
      if (sortBy === 'nameAsc') return String(a?.name || '').localeCompare(String(b?.name || ''));
      if (sortBy === 'nameDesc') return String(b?.name || '').localeCompare(String(a?.name || ''));
      if (sortBy === 'oldest') {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return aTime - bTime;
      }
      // default: newest
      const aTime = new Date(a?.createdAt || 0).getTime();
      const bTime = new Date(b?.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return next;
  }, [items, searchTerm, statusFilter, collegeFilter, sortBy]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, collegeFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const visiblePageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const range = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return Array.from(range)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetCreateForm = () => {
    setCreateOpen(false);
  };

  const openAssignModal = (department) => {
    setSelectedDepartment(department);
    setHeadId(String(department?.head?._id || ''));
    setAssignOpen(true);
  };

  const closeAssignModal = () => {
    setSelectedDepartment(null);
    setHeadId('');
    setAssignOpen(false);
  };

  const openViewModal = (department) => {
    setSelectedDepartment(department);
    setViewOpen(true);
  };

  const closeViewModal = () => {
    setSelectedDepartment(null);
    setViewOpen(false);
  };

  const openEditModal = (department) => {
    setSelectedDepartment(department);
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setSelectedDepartment(null);
    setEditOpen(false);
  };

  const saveDepartment = async (formData) => {
    const name = String(formData?.name || '').trim();
    const collegeToUse = String(formData?.collegeId || collegeId || '').trim();
    const headName = String(formData?.head?.name || '').trim();
    const headEmail = String(formData?.head?.email || '').trim();
    const headPhone = String(formData?.head?.phone || '').trim();

    if (!name || !collegeToUse) {
      setError('Department name and parent college are required.');
      return;
    }

    if (!headName || !headEmail || !headPhone) {
      setError('Please provide the HOD full name, email, and phone number.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = {
        name,
        collegeId: collegeToUse,
        head: { name: headName, email: headEmail, phone: headPhone }
      };

      const { data } = await adminAPI.createDepartment(payload);
      setMessage(data?.message || 'Department created successfully.');
      if (data?.temporaryPassword) {
        setMessage(`${data?.message || 'Department created successfully.'} Temporary password was emailed to the HOD.`);
      }
      resetCreateForm();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to create department.');
    } finally {
      setSaving(false);
    }
  };

  const saveHead = async () => {
    if (!selectedDepartment?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.assignDepartmentHead(selectedDepartment._id, { headId: headId || undefined });
      const updated = data?.department;
      if (updated?._id) {
        setItems((prev) => prev.map((item) => (String(item?._id || '') === String(updated._id)
          ? { ...item, head: updated.head }
          : item)));
      }
      setMessage('Department head assignment updated successfully.');
      closeAssignModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to assign department head.');
    } finally {
      setSaving(false);
    }
  };

  const saveDepartmentEdit = async (formData) => {
    if (!selectedDepartment?._id) return;

    const name = String(formData?.name || '').trim();
    const collegeToUse = String(formData?.collegeId || selectedDepartment?.college?._id || '').trim();
    const headName = String(formData?.head?.name || '').trim();
    const headEmail = String(formData?.head?.email || '').trim();
    const headPhone = String(formData?.head?.phone || '').trim();

    if (!name) {
      setError('Department name is required.');
      return;
    }

    if (!headName || !headEmail || !headPhone) {
      setError('Please provide the HOD full name, email, and phone number.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.updateDepartmentHod(selectedDepartment._id, {
        name,
        collegeId: collegeToUse,
        head: { name: headName, email: headEmail, phone: headPhone }
      });
      const updated = data?.department;

      if (updated?._id) {
        setItems((prev) => prev.map((item) => (
          String(item?._id || '') === String(updated._id)
            ? { ...item, ...updated }
            : item
        )));
      }

      setMessage(data?.message || 'Department updated successfully.');
      closeEditModal();
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to update department.');
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

  const deleteDepartment = async (dept) => {
    if (!dept?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await adminAPI.deleteDepartment(dept._id);
      setMessage('Department deleted successfully.');
      await loadData();
      if (selectedDepartment?._id === dept._id) closeViewModal();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete department.');
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
      await Promise.all(selectedIds.map(id => adminAPI.deleteDepartment(id)));
      setMessage('Selected departments deleted successfully.');
      setSelectedIds([]);
      await loadData();
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to delete selected departments.');
    } finally {
      setSaving(false);
    }
  };

  const resetDepartmentHeadPassword = async (department) => {
    if (!department?._id) return;

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const { data } = await adminAPI.resetDepartmentHeadPassword(department._id);
      setMessage(data?.message || 'Department head password reset successfully.');
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Failed to reset department head password.');
    } finally {
      setSaving(false);
    }
  };

  const executeConfirm = async () => {
    const { type, payload } = confirmAction;
    closeConfirm();

    if (type === 'delete-one') {
      await deleteDepartment(payload);
    } else if (type === 'delete-selected') {
      await deleteSelected();
    } else if (type === 'reset-head-password') {
      await resetDepartmentHeadPassword(payload);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    ));
  };

  const toggleAll = () => {
    const currentIds = filteredItems.map((item) => String(item?._id || ''));
    const allSelected = currentIds.length > 0 && currentIds.every((id) => selectedIds.includes(id));
    setSelectedIds(allSelected ? [] : currentIds);
  };

  const handleExport = async ({ fileName, format }) => {
    try {
      setSaving(true);
      setError('');

      if (format === 'excel') {
        // Client-side CSV generation
        const headers = ['Department Name', 'Parent College', 'Department Head', 'Head Email', 'Head Phone', 'Students count', 'Status'];
        const csvRows = [headers.join(',')];

        filteredItems.forEach((dept) => {
          const row = [
            `"${(dept.name || '').replace(/"/g, '""')}"`,
            `"${(dept.college?.name || '').replace(/"/g, '""')}"`,
            `"${(dept.head?.fullName || dept.head?.name || 'Not assigned').replace(/"/g, '""')}"`,
            `"${(dept.head?.email || '').replace(/"/g, '""')}"`,
            `"${(dept.head?.phone || '').replace(/"/g, '""')}"`,
            dept.studentCount || 0,
            dept.head?._id ? 'Active' : 'Missing HOD'
          ];
          csvRows.push(row.join(','));
        });

        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        downloadBlob(blob, `${fileName}.csv`);
        setMessage('Departments data report downloaded as CSV successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">University Departments Report</h1>
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
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Department Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Parent College</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Department Head</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Head Phone</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Students</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredItems.map((dept, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${dept.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${dept.college?.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${dept.head?.fullName || dept.head?.name || 'Not assigned'}</td>
                  <td style="padding: 12px; color: #475569;">${dept.head?.phone || '-'}</td>
                  <td style="padding: 12px; font-weight: 800; color: #0f172a;">${dept.studentCount || 0}</td>
                  <td style="padding: 12px; font-weight: 700; color: ${dept.head?._id ? '#047857' : '#be123c'};">${dept.head?._id ? 'Active' : 'Missing HOD'}</td>
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
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        await html2pdf().from(element).set(opt).save();
        setMessage('Departments data report downloaded as PDF successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate report export.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Premium Gradient Header */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100 pt-16 pb-12 px-6 lg:px-12 rounded-[40px] mb-6 shadow-sm">
        <div className="absolute top-0 right-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(6,182,212,0.1),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-48 w-48 bg-[radial-gradient(circle_at_bottom_left,rgba(14,165,233,0.05),transparent_70%)] pointer-events-none" />

        <div className="relative w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-1 w-8 bg-cyan-600 rounded-full" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700">University Structure Control Panel</p>
            </div>
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Departments</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
              Create academic programs, assign department heads, and manage campus hierarchy.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <button
                onClick={() => setCreateOpen(true)}
                className="group flex items-center gap-3 rounded-2xl bg-cyan-700 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_15px_30px_rgba(14,116,144,0.25)] transition-all hover:bg-cyan-600 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(14,116,144,0.3)]"
              >
                + Create Department
              </button>
            )}
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={saving}
              className="group flex items-center gap-3 rounded-2xl border border-cyan-100 bg-cyan-50/40 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-cyan-800 shadow-sm transition-all hover:bg-cyan-50 hover:-translate-y-1 hover:shadow-md"
            >
              <svg className="h-4 w-4 text-cyan-600 transition-transform group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
            {canManage && (
              <button
                onClick={() => openConfirm({
                  title: 'Delete selected departments?',
                  message: `This will permanently remove the ${selectedIds.length} selected department(s). Associated student accounts will lose their department context. This action cannot be undone.`,
                  type: 'delete-selected'
                })}
                disabled={selectedIds.length === 0 || saving}
                className="group flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-rose-700 shadow-sm transition-all hover:bg-rose-100 hover:-translate-y-1 disabled:opacity-50"
              >
                Delete Selected
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filters and Search Bar Grid */}
      <div className={`grid gap-6 items-center bg-white/60 backdrop-blur-md border border-slate-100 p-6 rounded-[32px] shadow-sm ${colleges.length > 1 ? 'md:grid-cols-[2fr_1fr_1fr_1fr]' : 'md:grid-cols-[2fr_1fr_1fr]'
        }`}>
        <div className="relative group">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by department, college, HOD email, or phone..."
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none shadow-sm placeholder:text-slate-400 placeholder:font-medium tracking-wide"
          />
        </div>

        {colleges.length > 1 && (
          <div className="relative">
            <select
              value={collegeFilter}
              onChange={(event) => setCollegeFilter(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All Colleges</option>
              {colleges.map((c) => (
                <option key={String(c._id || '')} value={String(c._id || '')}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Has HOD)</option>
            <option value="missingHOD">Missing HOD</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="nameAsc">Name (A to Z)</option>
            <option value="nameDesc">Name (Z to A)</option>
            <option value="studentsCount">Most Students</option>
          </select>
        </div>
      </div>

      {/* Stats Counter tiles */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Total Departments" value={<AnimatedCounter value={stats.totalCount} />} hint="Total registered departments" />
        <StatTile title="Active Department Heads" value={<AnimatedCounter value={stats.activeHods} />} hint="Departments with assigned heads" />
        <StatTile title="Missing Department Heads" value={<AnimatedCounter value={stats.missingHods} />} hint="Departments without connected heads" />
        <StatTile title="Total Students" value={<AnimatedCounter value={stats.totalStudents} />} hint="Fetched from student records" />
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">{message}</p> : null}

      {/* Main Content card */}
      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <header className="mb-6 space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-cyan-800 bg-clip-text text-transparent">Academic Departments</h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Click on a department name to view details. Use the actions on the right to edit details or delete a record.
          </p>
        </header>

        {canManage && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(String(item?._id || '')))}
                  onChange={toggleAll}
                />
                Select all
              </label>
              <span>{filteredItems.length} visible</span>
            </div>

            <div className="flex items-center gap-2">
              <ActionButton onClick={() => setCreateOpen(true)} tone="cyan">+ Create Department</ActionButton>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : null}

        {!loading && filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-2 text-sm">
              <thead>
                <tr className="text-left text-sm font-black uppercase tracking-[0.22em] text-slate-900">
                  {canManage && (
                    <th className="px-3 py-4"> </th>
                  )}
                  <th className="px-3 py-4">Department</th>
                  <th className="px-3 py-4">College</th>
                  <th className="px-3 py-4">Head of Department</th>
                  <th className="px-3 py-4">Phone Number</th>
                  <th className="px-3 py-4">Total Students</th>
                  <th className="px-3 py-4">Status</th>
                  {canManage && (
                    <th className="px-3 py-4 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((department) => {
                  const hasHead = Boolean(department?.head?._id || department?.head);
                  const isSelected = selectedIds.includes(String(department?._id || ''));
                  return (
                    <tr
                      key={String(department?._id || '')}
                      className="group rounded-2xl transition hover:shadow-[0_10px_24px_rgba(15,23,42,0.06)]"
                    >
                      {canManage && (
                        <td className="rounded-l-2xl border border-r-0 border-slate-200 bg-white px-3 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelected(String(department._id))}
                          />
                        </td>
                      )}
                      <td className={`${canManage ? 'border-y' : 'rounded-l-2xl border border-r-0'} border-slate-200 bg-white px-3 py-4 align-top`}>
                        <button
                          type="button"
                          onClick={() => openViewModal(department)}
                          className="text-left"
                        >
                          <p className="font-bold text-slate-950 transition group-hover:text-blue-700">{department?.name || 'Unnamed department'}</p>
                        </button>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <Pill tone="slate">
                          {department?.college?.name || 'No college'}
                        </Pill>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        {hasHead ? (
                          <div>
                            <p className="font-bold text-slate-900">{department.head.fullName || department.head.name}</p>
                            <p className="text-xs text-slate-500">{department.head.email}</p>
                          </div>
                        ) : (
                          <div>
                            <p className="font-semibold text-slate-900">No HOD</p>
                            <p className="text-xs text-slate-400">Leadership record not connected</p>
                          </div>
                        )}
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <p className="text-sm font-medium text-slate-700">{department?.head?.phone || '-'}</p>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <p className="font-extrabold text-slate-800">{department?.studentCount ?? 0}</p>
                      </td>
                      <td className={`${canManage ? 'border-y' : 'rounded-r-2xl border border-l-0'} border-slate-200 bg-white px-3 py-4 align-top`}>
                        <Pill tone={hasHead ? 'green' : 'red'}>{hasHead ? 'Active' : 'Missing HOD'}</Pill>
                      </td>
                      {canManage && (
                        <td className="rounded-r-2xl border border-l-0 border-slate-200 bg-white px-3 py-4 align-top">
                          <div className="flex flex-wrap justify-end gap-2">
                            <ActionButton onClick={() => openViewModal(department)} tone="slate" title="View Details">View Details</ActionButton>
                            <ActionButton onClick={() => openEditModal(department)} tone="cyan" title="Edit">Edit</ActionButton>
                            <ActionButton
                              onClick={() => openConfirm({
                                title: 'Reset HOD password?',
                                message: `A new temporary password will be generated and emailed to ${department?.head?.email || 'the assigned HOD'}.`,
                                type: 'reset-head-password',
                                payload: department
                              })}
                              tone="slate"
                              disabled={!department?.head?.email || saving}
                              title="Reset HOD password"
                            >
                              Reset Password
                            </ActionButton>
                            <ActionButton
                              onClick={() => openConfirm({
                                title: 'Delete Department?',
                                message: `Are you sure you want to permanently delete the department "${department.name}"? This action cannot be undone and will affect associated student records.`,
                                type: 'delete-one',
                                payload: department
                              })}
                              tone="red"
                            >
                              Delete
                            </ActionButton>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredItems.length > itemsPerPage && (
              <div className="mt-4 flex flex-col gap-4 border-t border-slate-200 bg-white px-6 py-5 rounded-b-3xl md:flex-row md:items-center md:justify-between">
                <span className="text-sm text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-bold text-slate-900">{filteredItems.length}</span> departments
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Previous
                  </button>

                  {visiblePageNumbers.map((pageNumber, index) => {
                    const previousPage = visiblePageNumbers[index - 1];
                    const needsGap = previousPage && pageNumber - previousPage > 1;

                    return (
                      <React.Fragment key={pageNumber}>
                        {needsGap ? <span className="px-2 text-slate-400">...</span> : null}
                        <button
                          onClick={() => setCurrentPage(pageNumber)}
                          className={`min-w-10 rounded-[14px] border px-4 py-2.5 text-[13px] font-bold tracking-wider shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${currentPage === pageNumber ? 'border-cyan-700 bg-cyan-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                          aria-current={currentPage === pageNumber ? 'page' : undefined}
                        >
                          {pageNumber}
                        </button>
                      </React.Fragment>
                    );
                  })}

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {!loading && filteredItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
            <p className="text-2xl font-bold text-slate-950">No Departments Found</p>
            <p className="mt-2 text-sm text-slate-500">Start by creating your first department or clear the current filters.</p>
            <div className="mt-6 flex justify-center gap-3">
              {canManage && <ActionButton tone="cyan" onClick={() => setCreateOpen(true)}>+ Create Department</ActionButton>}
              <ActionButton onClick={() => { setSearchTerm(''); setStatusFilter('all'); setCollegeFilter('all'); setSortBy('newest'); }}>Reset Filters</ActionButton>
            </div>
          </div>
        ) : null}
      </Card>

      <DepartmentFormModal
        open={createOpen || editOpen}
        editData={editOpen ? selectedDepartment : null}
        collegeName={editOpen ? selectedDepartment?.college?.name : colleges.find((college) => String(college?._id || '') === String(collegeId || ''))?.name || colleges[0]?.name || ''}
        collegeId={editOpen ? selectedDepartment?.college?._id : collegeId}
        saving={saving}
        error={error}
        onClose={editOpen ? closeEditModal : resetCreateForm}
        onSubmit={editOpen ? saveDepartmentEdit : saveDepartment}
      />

      {/* Assign HOD Modal */}
      <Modal open={assignOpen} title="Assign Department Head" onClose={closeAssignModal}>
        <div className="space-y-5">
          <p className="text-sm text-slate-600 leading-relaxed">
            Select a verified Department Head user account to lead <span className="font-bold text-slate-900">{selectedDepartment?.name || 'this department'}</span>.
          </p>

          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Department Head Candidate</label>
            <select
              value={headId}
              onChange={(event) => setHeadId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-900 transition-all focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="">Remove head assignment</option>
              {headOptions.map((candidate) => (
                <option key={String(candidate?._id || '')} value={candidate?._id || ''}>
                  {(candidate?.fullName || candidate?.name || 'Unnamed user')} — {candidate?.email || 'no email'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={closeAssignModal}
              className="rounded-2xl border border-slate-200 bg-white px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveHead}
              disabled={saving}
              className="rounded-2xl bg-cyan-700 px-6 py-4 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-cyan-600 shadow-xl shadow-cyan-900/10 transition-all disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save assignment'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Premium Department Details Drawer */}
      <AnimatePresence>
        {viewOpen && selectedDepartment && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeViewModal}
              className="absolute inset-0"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative z-10 flex h-full w-full max-w-2xl flex-col overflow-hidden border-l border-slate-100 bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.15)]"
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-8 py-7">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-600">Governance Registry</p>
                  <h2 className="mt-1 text-xl font-black uppercase leading-tight tracking-tight text-slate-900">{selectedDepartment?.name || 'Department Details'}</h2>
                  <p className="mt-1 text-xs font-medium text-slate-500">College, HOD leadership, and department overview</p>
                </div>
                <button
                  type="button"
                  onClick={closeViewModal}
                  className="rounded-full border border-slate-100 bg-white p-2 text-slate-400 shadow-sm transition-all hover:scale-110 hover:text-slate-900"
                  aria-label="Close department details"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 px-8 py-5">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">🎓 Total Department Students:</span>
                    <span className="inline-flex items-center rounded-full border border-cyan-300 bg-cyan-100/90 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-cyan-900 shadow-sm">
                      {selectedDepartment?.studentCount ?? 0}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Status:</span>
                  <Pill tone={selectedDepartment?.head?._id ? 'green' : 'red'}>
                    {selectedDepartment?.head?._id ? 'Active' : 'Missing HOD'}
                  </Pill>
                </div>
              </div>

              <div className="border-b border-slate-100 bg-white p-8">
                <h3 className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">Department Scope</h3>
                <div className="mt-4 rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/40 via-white to-white p-5 shadow-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-cyan-600">Parent College</p>
                  <p className="mt-1 text-sm font-extrabold leading-snug text-slate-900">{selectedDepartment?.college?.name || 'N/A'}</p>
                </div>
              </div>

              <div className="border-b border-slate-100 bg-white p-8 space-y-4">
                <h3 className="ml-1 text-xs font-black uppercase tracking-[0.2em] text-slate-400">HOD Contact Records</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/40 via-white to-white p-5 shadow-sm transition-all hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50 text-cyan-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-600">HOD Full Name</p>
                    <p className="mt-1 truncate text-sm font-extrabold leading-snug text-slate-900">
                      {selectedDepartment?.head?.fullName || selectedDepartment?.head?.name || 'No HOD Assigned'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-5 shadow-sm transition-all hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-indigo-100 bg-indigo-50 text-indigo-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">HOD Email Address</p>
                    <p className="mt-1 truncate text-xs font-extrabold leading-snug text-slate-900" title={selectedDepartment?.head?.email || 'N/A'}>
                      {selectedDepartment?.head?.email || 'N/A'}
                    </p>
                  </div>

                  <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm transition-all hover:shadow-md">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">HOD Phone Number</p>
                    <p className="mt-1 truncate text-xs font-extrabold leading-snug text-slate-900" title={selectedDepartment?.head?.phone || 'N/A'}>
                      {selectedDepartment?.head?.phone || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/20 px-8 py-5">
                  <div className="max-w-md">
                    <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Department Registry Controls</h3>
                    <p className="mt-0.5 text-[11px] font-medium text-slate-500">Update department details or remove this department from the system.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isDean ? (
                      <Link
                        to="/dean/hod-management"
                        state={{ departmentId: String(selectedDepartment?._id || '') }}
                        onClick={() => {
                          closeViewModal();
                          try { localStorage.setItem('governance_sidebar_collapsed', 'false'); } catch {};
                        }}
                        className="rounded-xl bg-cyan-700 px-5 py-3 text-xs font-black tracking-[0.15em] text-white shadow-md shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-0.5 inline-block"
                      >
                        HOD Management
                      </Link>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const department = selectedDepartment;
                            closeViewModal();
                            openEditModal(department);
                          }}
                          className="rounded-xl bg-cyan-700 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-white shadow-md shadow-cyan-900/10 transition-all hover:-translate-y-0.5 hover:bg-cyan-600"
                        >
                          Edit Registry
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const department = selectedDepartment;
                            closeViewModal();
                            openConfirm({
                              title: 'Delete Department?',
                              message: `Are you sure you want to permanently delete the department "${department?.name}"? This action cannot be undone and will affect associated student records.`,
                              type: 'delete-one',
                              payload: department
                            });
                          }}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-rose-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-rose-100"
                        >
                          Delete Record
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto p-8">
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/20 px-6 py-12 text-center">
                  <p className="text-sm font-bold text-slate-800">Department profile is synced from the database.</p>
                  <p className="mt-1 text-xs text-slate-400">Changes made through the registry are fetched again from the backend.</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <Modal open={confirmOpen} title={null} onClose={closeConfirm}>
        <div className="space-y-6 pt-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
            <svg className="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black leading-tight tracking-tight text-slate-900">
              {confirmTitle || 'Are you sure?'}
            </h3>
            <p className="mx-auto max-w-sm text-sm font-medium leading-relaxed text-slate-500">
              {confirmMessage || 'This action cannot be undone. Please confirm to proceed.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={closeConfirm}
              className="w-1/2 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-black uppercase tracking-[0.15em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              Cancel Action
            </button>
            <button
              type="button"
              onClick={executeConfirm}
              disabled={saving}
              className="w-1/2 rounded-2xl bg-cyan-800 py-3.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-md shadow-cyan-950/20 transition-all hover:bg-cyan-700 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Advanced Export Modal */}
      <AdvancedExportModal
        open={exportModalOpen}
        title="Export Departments Report"
        loading={saving}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />
    </div>
  );
}
