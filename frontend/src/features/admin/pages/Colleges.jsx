import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import Modal from '@/components/common/Modal';
import useAuth from '@/hooks/useAuth';
import Card from '@/components/ui/Card';
import { adminAPI } from '../adminAPI';
import AdvancedExportModal from '../components/AdvancedExportModal';

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
    cyan: 'border-transparent bg-cyan-700 text-white shadow-[0_10px_20px_rgba(14,116,144,0.2)] hover:bg-cyan-600 hover:shadow-[0_15px_30px_rgba(14,116,144,0.3)]',
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

export default function Colleges() {
  const navigate = useNavigate();
  const auth = useAuth();
  const isSuperAdmin = auth?.user && (auth.user.role === 'super_admin' || auth.user.role === 'SuperAdmin');
  const [items, setItems] = useState([]);
  const [deanCandidates, setDeanCandidates] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
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
  const [editDeanName, setEditDeanName] = useState('');
  const [editDeanEmail, setEditDeanEmail] = useState('');
  const [editDeanPhone, setEditDeanPhone] = useState('');
  const [deanId, setDeanId] = useState('');
  const [createDeanId, setCreateDeanId] = useState('');
  const [createDeanName, setCreateDeanName] = useState('');
  const [createDeanEmail, setCreateDeanEmail] = useState('');
  const [createDeanPhone, setCreateDeanPhone] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => {
        setMessage('');
        setError('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const deanOptions = useMemo(() => deanCandidates, [deanCandidates]);

  const loadData = async () => {
    let active = true;
    try {
      setLoading(true);
      setError('');
      const [collegesResponse, deansResponse, departmentsResponse, studentsResponse] = await Promise.all([
        adminAPI.getColleges(),
        adminAPI.getDeanCandidates(),
        adminAPI.getDepartments(),
        adminAPI.getStudents({ limit: 1 })
      ]);
      if (!active) return;
      setItems(Array.isArray(collegesResponse?.data) ? collegesResponse.data : []);
      setDeanCandidates(Array.isArray(deansResponse?.data) ? deansResponse.data : []);
      setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
      if (studentsResponse?.data?.pagination?.total !== undefined) {
        setTotalStudents(studentsResponse.data.pagination.total);
      }
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
        const [collegesResponse, deansResponse, departmentsResponse, studentsResponse] = await Promise.all([
          adminAPI.getColleges(),
          adminAPI.getDeanCandidates(),
          adminAPI.getDepartments(),
          adminAPI.getStudents({ limit: 1 })
        ]);
        if (!active) return;
        setItems(Array.isArray(collegesResponse?.data) ? collegesResponse.data : []);
        setDeanCandidates(Array.isArray(deansResponse?.data) ? deansResponse.data : []);
        setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
        if (studentsResponse?.data?.pagination?.total !== undefined) {
          setTotalStudents(studentsResponse.data.pagination.total);
        }
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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, departmentFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredItems, currentPage]);

  const resetCreateForm = () => {
    setCollegeName('');
    setCreateDeanId('');
    setCreateDeanName('');
    setCreateDeanEmail('');
    setCreateDeanPhone('');
    setCreateOpen(false);
  };

  const openDetails = (college) => {
    setError('');
    setMessage('');
    setSelectedCollege(college);
    setDetailOpen(true);
  };

  const closeDetails = () => {
    setError('');
    setMessage('');
    setDetailOpen(false);
    setSelectedCollege(null);
  };

  const openEditModal = (college) => {
    setSelectedCollege(college);
    setEditCollegeName(String(college?.name || ''));
    setEditDeanName(String(college?.dean?.fullName || college?.dean?.name || ''));
    setEditDeanEmail(String(college?.dean?.email || ''));
    setEditDeanPhone(String(college?.dean?.phone || ''));
    setEditOpen(true);
  };

  const closeEditModal = () => {
    setSelectedCollege(null);
    setEditCollegeName('');
    setEditDeanName('');
    setEditDeanEmail('');
    setEditDeanPhone('');
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
      const deanPhone = String(createDeanPhone || '').trim();

      // Form validation for new dean profile creation
      if (!createDeanId) {
        if (!deanName) {
          setError("Dean Full Name is required to set up college leadership.");
          return;
        }
        if (!deanEmail) {
          setError("Dean Email Address is required to send login credentials.");
          return;
        }

        // Strict real email pattern validation (e.g. Google/Gmail or University domains)
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(deanEmail)) {
          setError("Please enter a valid email address (e.g., dean@gmail.com).");
          return;
        }

        if (!deanPhone) {
          setError("Dean Phone Number is required for contact records.");
          return;
        }
      }

      if (deanName && deanEmail) {
        payload.dean = { name: deanName, email: deanEmail, phone: deanPhone };
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
      const payload = { 
        name,
        dean: {
            name: String(editDeanName || '').trim(),
            email: String(editDeanEmail || '').trim(),
            phone: String(editDeanPhone || '').trim()
        }
      };
      const { data } = await adminAPI.updateCollege(selectedCollege._id, payload);
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

  const handleExport = async ({ fileName, format }) => {
    try {
      setSaving(true);
      setError('');

      if (format === 'excel') {
        const response = await adminAPI.exportColleges();
        downloadBlob(response.data, `${fileName}.csv`);
        setMessage('Colleges Excel exported successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
        const collegesResponse = await adminAPI.getColleges();
        const collegesToExport = Array.isArray(collegesResponse?.data) ? collegesResponse.data : [];

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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">University Colleges Report</h1>
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
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">College Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Dean</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Departments</th>
              </tr>
            </thead>
            <tbody>
              ${collegesToExport.map((c, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${c.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${c.dean?.fullName || c.dean?.name || '-'}</td>
                  <td style="padding: 12px; font-weight: 800; text-transform: uppercase;">${c.departmentCount || 0}</td>
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
        setMessage('Colleges PDF generated successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate export report.');
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

  const totalCollegeStudents = useMemo(() => {
    return selectedCollegeDepartments.reduce((sum, dept) => sum + Number(dept?.studentCount || 0), 0);
  }, [selectedCollegeDepartments]);

  const totalCollegeDepartments = selectedCollegeDepartments.length;

  const bulkAssignedDisabled = selectedIds.length === 0 || saving;

  return (
    <div className="space-y-6">
      {/* Premium Gradient Header */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100 pt-16 pb-12 px-6 lg:px-12 rounded-[40px] mb-6 shadow-sm">
        <div className="absolute top-0 right-0 h-64 w-64 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_70%)] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-48 w-48 bg-[radial-gradient(circle_at_bottom_left,rgba(6,182,212,0.05),transparent_70%)] pointer-events-none" />

        <div className="relative w-full mx-auto flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-2">
              <span className="h-1 w-8 bg-cyan-600 rounded-full" />
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700">University Structure Control Panel</p>
            </div>
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Colleges</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
              Manage colleges, deans, and the academic hierarchy from one enterprise dashboard.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setCreateOpen(true)}
              className="group flex items-center gap-3 rounded-2xl bg-cyan-700 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_15px_30px_rgba(14,116,144,0.25)] transition-all hover:bg-cyan-600 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(14,116,144,0.3)]"
            >
              + Create College
            </button>
            <button
              onClick={() => setExportModalOpen(true)}
              disabled={saving}
              className="group flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:-translate-y-1"
            >
              <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Report
            </button>
            <button
              onClick={() => openConfirm({
                title: 'Delete selected colleges?',
                message: `This will permanently remove ${selectedIds.length} selected college(s). This action cannot be undone.`,
                type: 'delete-selected'
              })}
              disabled={selectedIds.length === 0 || saving}
              className="group flex items-center gap-3 rounded-2xl bg-rose-50 border border-rose-200 px-8 py-5 text-xs font-black uppercase tracking-[0.2em] text-rose-700 shadow-sm transition-all hover:bg-rose-100 hover:-translate-y-1 disabled:opacity-50"
            >
              Delete Selected
            </button>
          </div>
        </div>
      </section>

      {/* Filters and Search Bar */}
      <div className="grid gap-6 md:grid-cols-[2fr_1fr_1fr_1fr] items-center bg-white/60 backdrop-blur-md border border-slate-100 p-6 rounded-[32px] shadow-sm">
        <div className="relative group">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search by college name or dean email"
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none shadow-sm placeholder:text-slate-400 placeholder:font-medium tracking-wide"
          />
        </div>

        <div className="relative">
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="all">All Colleges</option>
            <option value="active">Active</option>
            <option value="partial">Partial</option>
            <option value="hasDean">Has Dean</option>
            <option value="noDean">No Dean</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="all">Any count</option>
            <option value="hasDepartments">Has departments</option>
            <option value="zeroDepartments">No departments</option>
            <option value="manyDepartments">3+ departments</option>
          </select>
        </div>

        <div className="relative">
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
            style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
          >
            <option value="newest">Newest</option>
            <option value="mostDepartments">Most Departments</option>
            <option value="name">Name</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatTile title="Colleges" value={stats.collegesTotal} hint="Registered academic colleges" />
        <StatTile title="Deans" value={stats.deansTotal} hint="Colleges with a dean assigned" />
        <StatTile title="Departments" value={stats.departmentsTotal} hint="Total departments across scope" />
        <StatTile title="Total Students" value={totalStudents} hint="Active student accounts on website" />
      </div>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">{error}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">{message}</p> : null}

      <Card className="overflow-hidden border-slate-200 bg-white/95 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
        <header className="mb-6 space-y-2">
          <h3 className="text-2xl font-black tracking-tight text-slate-900 bg-gradient-to-r from-slate-900 to-cyan-800 bg-clip-text text-transparent">Registered Colleges</h3>
          <p className="text-sm font-medium text-slate-500 leading-relaxed">
            Click on a college name to view details. Use the actions on the right to edit details or delete a record.
          </p>
        </header>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={filteredItems.length > 0 && filteredItems.every((item) => selectedIds.includes(String(item?._id || '')))} onChange={toggleAll} />
              Select all
            </label>
            <span>{filteredItems.length} visible</span>
          </div>

          <div className="flex items-center gap-2">
            <ActionButton onClick={() => setCreateOpen(true)} tone="cyan">+ Create College</ActionButton>
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
                <tr className="text-left text-sm font-black uppercase tracking-[0.22em] text-slate-900">
                  <th className="px-3 py-4"> </th>
                  <th className="px-3 py-4">College</th>
                  <th className="px-3 py-4">Dean</th>
                  <th className="px-3 py-4">Phone Number</th>
                  <th className="px-3 py-4">Departments</th>
                  <th className="px-3 py-4">Status</th>
                  <th className="px-3 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedItems.map((college) => {
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
                        </button>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <p className="font-semibold text-slate-900">{college?.dean?.fullName || college?.dean?.name || 'No Dean'}</p>
                        {college?.dean?.email && <p className="text-xs text-slate-500">{college.dean.email}</p>}
                        {!college?.dean?.email && <p className="text-xs text-slate-400">Assign a dean to activate</p>}
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <p className="text-sm font-medium text-slate-700">{college?.dean?.phone || '—'}</p>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <button type="button" onClick={() => openDetails(college)} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-200">
                          {departmentCount} departments
                        </button>
                      </td>
                      <td className="border-y border-slate-200 bg-white px-3 py-4 align-top">
                        <Pill tone={statusTone}>{statusLabel}</Pill>
                      </td>
                      <td className="rounded-r-2xl border border-l-0 border-slate-200 bg-white px-3 py-4 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <ActionButton onClick={() => openDetails(college)} tone="slate" title="View Details">View Details</ActionButton>
                          <ActionButton onClick={() => openEditModal(college)} tone="cyan" title="Edit">Edit</ActionButton>
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
                              title: `Delete ${college?.name || 'this college'}?`,
                              message: 'This will permanently remove the college, its dean account, and all associated departments. This action cannot be undone.',
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

            {/* Pagination UI */}
            {filteredItems.length > itemsPerPage && (
              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-5 mt-4 rounded-b-3xl">
                <span className="text-sm text-slate-500 font-medium">
                  Showing <span className="font-bold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredItems.length)}</span> of <span className="font-bold text-slate-900">{filteredItems.length}</span> colleges
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="rounded-[14px] border border-slate-200 bg-white px-5 py-2.5 text-[13px] font-bold uppercase tracking-wider text-slate-700 shadow-sm transition hover:bg-slate-50 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
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

      {/* Premium Create College Modal */}
      <AnimatePresence>
        {createOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            {/* Blur Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={resetCreateForm}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            {/* Modal Card Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.25)] flex flex-col max-h-[90vh] overflow-hidden rounded-[40px]"
            >
              {/* Header with Radial Gradient */}
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-10 py-8 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Create New College</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Register a new academic college and assign leadership credentials.</p>
                  </div>
                  <button
                    onClick={resetCreateForm}
                    disabled={saving}
                    className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all hover:scale-110 disabled:opacity-50"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Form Content */}
              <div className="p-10 space-y-8 overflow-y-auto flex-1">
                {/* College Name Input */}
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                    College Name
                  </label>
                  <input
                    type="text"
                    value={collegeName}
                    onChange={(event) => setCollegeName(event.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                    placeholder="e.g. College of Computing and Informatics"
                    disabled={saving}
                  />
                </div>

                {/* Dean Leadership Section */}
                <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 space-y-6">
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Dean Leadership Settings</h3>
                    <p className="mt-1 text-xs text-slate-500 font-medium">Create a new dean account or link an existing platform administrator.</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                        Dean Full Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={createDeanName}
                        onChange={(event) => setCreateDeanName(event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                        placeholder="e.g. Dr. Abraham Melaku"
                        disabled={saving || createDeanId}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                        Dean Email Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={createDeanEmail}
                        onChange={(event) => setCreateDeanEmail(event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                        placeholder="e.g. abraham@gmail.com"
                        disabled={saving || createDeanId}
                      />
                    </div>

                    <div className="space-y-3">
                      <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                        Dean Phone Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={createDeanPhone}
                        onChange={(event) => setCreateDeanPhone(event.target.value)}
                        className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                        placeholder="e.g. +251 912 345 678"
                        disabled={saving || createDeanId}
                      />
                    </div>
                  </div>
                </div>

                {/* Validation Error Banner inside modal */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-xs font-black uppercase tracking-widest text-rose-700 shadow-sm"
                  >
                    ⚠️ {error}
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-slate-50 p-10 flex gap-4">
                <button
                  type="button"
                  onClick={resetCreateForm}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCollege}
                  className="flex-[2] rounded-2xl bg-cyan-700 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-1 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Creating...' : 'Create College'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Premium Edit College Modal */}
      <AnimatePresence>
        {editOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeEditModal}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white shadow-[0_32px_64px_-16px_rgba(15,23,42,0.25)] flex flex-col max-h-[90vh] overflow-hidden rounded-[40px]"
            >
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-10 py-8 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Edit College</h2>
                    <p className="mt-1 text-sm font-medium text-slate-500">Update college registry details and dean information.</p>
                  </div>
                  <button
                    onClick={closeEditModal}
                    disabled={saving}
                    className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all hover:scale-110 disabled:opacity-50"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="p-10 space-y-8 overflow-y-auto flex-1">
                <div className="space-y-3">
                  <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                    College Name
                  </label>
                  <input
                    type="text"
                    value={editCollegeName}
                    onChange={(event) => setEditCollegeName(event.target.value)}
                    className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                    placeholder="Rename college"
                    disabled={saving}
                  />
                </div>

                {selectedCollege?.dean && (
                  <div className="rounded-3xl border border-slate-100 bg-slate-50/50 p-8 space-y-6">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Dean Information</h3>
                      <p className="mt-1 text-xs text-slate-500 font-medium">Update the assigned dean's contact details.</p>
                    </div>

                    <div className="space-y-6">
                      <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editDeanName}
                          onChange={(e) => setEditDeanName(e.target.value)}
                          className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                          placeholder="e.g. Dr. Abraham Melaku"
                          disabled={saving}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={editDeanEmail}
                          onChange={(e) => setEditDeanEmail(e.target.value)}
                          className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                          placeholder="dean@example.com"
                          disabled={saving}
                        />
                      </div>

                      <div className="space-y-3">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-700 ml-1">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editDeanPhone}
                          onChange={(e) => setEditDeanPhone(e.target.value)}
                          className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold text-slate-900 focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none placeholder:text-slate-400 placeholder:font-medium shadow-sm transition-all"
                          placeholder="+251 912 345 678"
                          disabled={saving}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-10 flex gap-4">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white py-5 text-sm font-black uppercase tracking-[0.2em] text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveCollegeEdit}
                  className="flex-[2] rounded-2xl bg-cyan-700 py-5 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-1 disabled:opacity-50"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      <Modal open={confirmOpen} title={null} onClose={closeConfirm}>
        <div className="space-y-6 pt-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-sm">
            <svg className="h-7 w-7 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
              {confirmTitle || 'Are you sure?'}
            </h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm mx-auto">
              {confirmMessage || 'This action cannot be undone. Please confirm to proceed.'}
            </p>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={closeConfirm}
              className="w-1/2 rounded-2xl border border-slate-200 bg-white py-3.5 text-xs font-black uppercase tracking-[0.15em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95"
            >
              Cancel Action
            </button>
            <button
              onClick={executeConfirm}
              disabled={saving}
              className="w-1/2 rounded-2xl bg-cyan-800 py-3.5 text-xs font-black uppercase tracking-[0.15em] text-white shadow-md shadow-cyan-950/20 transition-all hover:bg-cyan-700 active:scale-95 disabled:opacity-50"
            >
              {saving ? 'Processing...' : 'Confirm Action'}
            </button>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {detailOpen && selectedCollege && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-950/40 backdrop-blur-sm">
            {/* Backdrop click to close */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDetails}
              className="absolute inset-0"
            />

            {/* Sliding Drawer Card */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative h-full w-full max-w-2xl bg-white shadow-[-20px_0_60px_rgba(15,23,42,0.15)] flex flex-col z-10 border-l border-slate-100 overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_50%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-8 py-7 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan-600">Governance Registry</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900 tracking-tight uppercase leading-tight">{selectedCollege?.name || 'College Details'}</h2>
                  <p className="mt-1 text-xs text-slate-500 font-medium">Departments, leadership, and operational overview</p>
                </div>
                <button
                  onClick={closeDetails}
                  className="rounded-full bg-white p-2 text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all hover:scale-110"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Scope & Status Bar */}
              <div className="bg-slate-50/50 px-8 py-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Departments:</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-100/90 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-cyan-900 border border-cyan-300 shadow-sm">
                      🏛️ <AnimatedCounter value={totalCollegeDepartments} />
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Total Students:</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100/90 px-4 py-1.5 text-sm font-black uppercase tracking-wider text-indigo-900 border border-indigo-300 shadow-sm">
                      🎓 <AnimatedCounter value={totalCollegeStudents} />
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Status:</span>
                  <Pill tone={selectedCollege?.dean ? 'green' : 'red'}>
                    {selectedCollege?.dean ? 'Active' : 'Missing Dean'}
                  </Pill>
                </div>
              </div>

              {/* Success / Error Alerts inside Drawer */}
              {(error || message) && (
                <div className="px-8 pt-6">
                  {error && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm font-extrabold text-rose-700 shadow-sm flex items-center gap-2">
                      <span>⚠️</span> <span>{error}</span>
                    </div>
                  )}
                  {message && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-extrabold text-emerald-700 shadow-sm flex items-center gap-2">
                      <span>✅</span> <span>{message}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Dean Leadership Profile Grid (3 beautiful color-accented cards) */}
              <div className="p-8 border-b border-slate-100 bg-white space-y-4">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Dean Contact Records</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* Full Name Card */}
                  <div className="rounded-3xl border border-cyan-100 bg-gradient-to-br from-cyan-50/40 via-white to-white p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 border border-cyan-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-cyan-600">Dean Full Name</p>
                    <p className="mt-1 text-sm font-extrabold text-slate-900 truncate leading-snug">
                      {selectedCollege?.dean?.fullName || selectedCollege?.dean?.name || 'No Dean Assigned'}
                    </p>
                  </div>

                  {/* Email Address Card */}
                  <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-white p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-indigo-600">Dean Email Address</p>
                    <p className="mt-1 text-xs font-extrabold text-slate-900 truncate leading-snug select-all animate-pulse" title={selectedCollege?.dean?.email || 'N/A'}>
                      {selectedCollege?.dean?.email || 'N/A'}
                    </p>
                  </div>

                  {/* Phone Number Card */}
                  <div className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50/40 via-white to-white p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <p className="mt-4 text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600">Dean Phone Number</p>
                    <p className="mt-1 text-xs font-extrabold text-slate-900 truncate leading-snug select-all" title={selectedCollege?.dean?.phone || 'N/A'}>
                      {selectedCollege?.dean?.phone || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Credentials Management */}
              <div className="bg-slate-50/20 px-8 py-5 border-b border-slate-100 flex items-center justify-between gap-4 flex-wrap">
                <div className="max-w-md">
                  <h3 className="text-xs font-black uppercase tracking-[0.18em] text-slate-600">Dean Portal Access</h3>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">This will reset the dean password in the database and email the new login details directly to the dean's inbox.</p>
                </div>
                <button
                  disabled={!selectedCollege?.dean?.email || saving}
                  onClick={() => openConfirm({
                    title: 'Reset dean password?',
                    message: `A new temporary password will be generated and emailed to ${selectedCollege?.dean?.email || 'the assigned dean'}.`,
                    type: 'reset-dean',
                    payload: selectedCollege
                  })}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  Reset Dean Password
                </button>
              </div>

              {/* Department Listing */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Academic Departments</h3>
                    <p className="text-xs text-slate-500 font-medium">Departments currently affiliated with this college</p>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {!isSuperAdmin && (
                      <Link
                        to="/dean/hod-management"
                        onClick={() => {
                          closeDetails();
                          try { localStorage.setItem('governance_sidebar_collapsed', 'false'); } catch {};
                        }}
                        className="rounded-xl bg-cyan-700 px-5 py-3 text-xs font-black tracking-[0.15em] text-white shadow-md shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-0.5 inline-block"
                      >
                        HOD Management
                      </Link>
                    )}
                    <button
                      onClick={() => {
                        closeDetails();
                        navigate('/admin/departments');
                      }}
                      className="rounded-xl bg-cyan-700 px-5 py-3 text-xs font-black uppercase tracking-[0.15em] text-white shadow-md shadow-cyan-900/10 transition-all hover:bg-cyan-600 hover:-translate-y-0.5"
                    >
                      Manage Registry
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  {selectedCollegeDepartments.length > 0 ? (
                    selectedCollegeDepartments.map((department) => (
                      <div
                        key={String(department?._id || Math.random())}
                        className="group rounded-2xl border border-slate-100 bg-slate-50/50 p-5 transition-all hover:bg-white hover:shadow-md hover:ring-2 hover:ring-cyan-500/10"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-extrabold text-slate-900 text-base leading-snug">{department?.name}</p>
                            <div className="mt-3 flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-cyan-50 border border-cyan-100 flex items-center justify-center text-xs font-black uppercase text-cyan-700">
                                {(department?.head?.fullName || department?.head?.name || 'H').substring(0, 2)}
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-800">
                                  HOD: {department?.head?.fullName || department?.head?.name || 'Not assigned'}
                                </p>
                                {department?.head?.email && (
                                  <p className="text-[10px] text-slate-400 font-medium">{department.head.email}</p>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <Pill tone={department?.head ? 'green' : 'amber'}>
                              {department?.head ? 'Active' : 'No HOD'}
                            </Pill>
                            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50/50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-cyan-700 border border-cyan-100">
                              🎓 {department?.studentCount || 0} Students
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 border border-dashed border-slate-200 rounded-3xl bg-slate-50/20">
                      <p className="text-sm font-bold text-slate-800">No departments attached yet.</p>
                      <p className="text-xs text-slate-400 mt-1">Departments can be linked using HOD and Department Portal.</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AdvancedExportModal
        open={exportModalOpen}
        title="Export Data"
        loading={saving}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />
    </div>
  );
}
