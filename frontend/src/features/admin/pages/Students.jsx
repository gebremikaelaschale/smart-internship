import React, { useCallback, useEffect, useState } from 'react';
import Select, { components as SelectComponents } from 'react-select';
import { motion, AnimatePresence } from 'framer-motion';
import Modal from '@/components/common/Modal';
import { adminAPI } from '../adminAPI';
import useAuth from '@/hooks/useAuth';
import AdvancedExportModal from '../components/AdvancedExportModal';
import DataFreshness from '../components/DataFreshness';

function getPartnerInitials(companyName = '') {
  const parts = String(companyName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (!parts.length) return 'IP';

  return parts.map((part) => part.charAt(0)).join('').toUpperCase();
}

function normalizePartnerOption(partner = {}) {
  const internshipId = String(partner?.internshipId || partner?.id || partner?._id || '').trim();
  const companyId = String(partner?.companyId || partner?.company_id || partner?.company?._id || '').trim();
  const companyName = String(
    partner?.companyName
    || partner?.company?.companyName
    || partner?.company?.fullName
    || partner?.company?.name
    || 'Verified Partner'
  ).trim();
  const internshipTitle = String(partner?.internshipTitle || partner?.title || 'Internship Program').trim();
  const slotsLeft = Number(partner?.slotsLeft || 0);
  const companyLogoUrl = String(
    partner?.companyLogoUrl
    || partner?.companyLogo
    || partner?.logoUrl
    || partner?.logo
    || ''
  ).trim();
  const location = String(partner?.location || '').trim();
  const programType = String(partner?.programType || partner?.type || '').trim();

  return {
    ...partner,
    value: internshipId,
    label: `${companyName} ${internshipTitle}`.trim(),
    internshipId,
    companyId,
    companyName,
    internshipTitle,
    slotsLeft,
    companyLogoUrl,
    companyLogo: companyLogoUrl,
    location,
    programType
  };
}

function PartnerOption(props) {
  const { companyName, internshipTitle, slotsLeft, companyLogoUrl, location, programType } = props.data;

  return (
    <SelectComponents.Option {...props}>
      <div className="flex w-full items-start gap-3 px-4 py-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs font-black tracking-widest text-slate-500">{getPartnerInitials(companyName)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">{companyName}</p>
              <p className="mt-1 text-sm font-semibold leading-snug text-slate-600">{internshipTitle}</p>
            </div>

            <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
              {slotsLeft} slot{slotsLeft === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
            {location ? <span>{location}</span> : null}
            {programType ? <span>{programType}</span> : null}
          </div>
        </div>
      </div>
    </SelectComponents.Option>
  );
}

function PartnerSingleValue(props) {
  const { companyName, internshipTitle, slotsLeft, companyLogoUrl } = props.data;

  return (
    <SelectComponents.SingleValue {...props}>
      <div className="flex min-w-0 items-center gap-3 py-0.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
          {companyLogoUrl ? (
            <img src={companyLogoUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] font-black tracking-widest text-slate-500">{getPartnerInitials(companyName)}</span>
          )}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">{companyName}</p>
          <p className="truncate text-xs font-semibold text-slate-500">{internshipTitle}</p>
        </div>

        <span className="ml-auto shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
          {slotsLeft} slots
        </span>
      </div>
    </SelectComponents.SingleValue>
  );
}

function getVerificationStatus(student) {
  const verification = String(student?.verificationStatus || '').trim();
  if (verification) return verification;
  const backendStatus = String(student?.status || '').trim();
  if (backendStatus) return backendStatus;
  if (student?.isVerified) return 'Verified';
  return 'Not Submitted';
}

function getVerificationStatusKey(student) {
  return getVerificationStatus(student).toLowerCase();
}

function getStudentDisplayStatus(student, preferVerification = false) {
  const verification = getVerificationStatus(student);
  // If the student has an assigned company or is placed, prefer that status
  const hasAssignment = Boolean(student?.assignedCompanyId || student?.companyId || student?.assigned_company_id || student?.internshipStatus === 'Placed');
  if (hasAssignment) return 'Placed';

  if (preferVerification || verification.toLowerCase() !== 'not submitted') {
    return verification;
  }
  return String(student?.internshipStatus || 'Not Applied').trim();
}

/** Case 3: verified — badge + reset (status string only; avoids stale isVerified flag) */
function isVerifiedVerification(student) {
  return getVerificationStatusKey(student) === 'verified';
}

/** Case 4: rejected — badge + reset */
function isRejectedVerification(student) {
  return getVerificationStatusKey(student) === 'rejected';
}

/** Case 2: not submitted, submitted, or pending — active verify/reject */
function canHodReviewStudent(student, preferVerification = false) {
  const displayStatus = getStudentDisplayStatus(student, preferVerification);
  const key = String(displayStatus || '').toLowerCase();
  return key === 'not submitted' || key === 'pending' || key === 'submitted' || key === '';
}

function getVerificationReason(student) {
  return String(student?.rejectionReason || student?.rejection_reason || student?.verificationNote || '').trim();
}

function isPlacedStatus(student) {
  const displayStatus = getStudentDisplayStatus(student, true);
  const key = String(displayStatus || '').toLowerCase();
  return key === 'placed';
}

function buildStatusPatch(action, updated = {}, note = '') {
  const normalized = String(action || '').toLowerCase();
  if (normalized === 'verify') {
    return {
      verificationStatus: updated.verificationStatus || 'Verified',
      status: updated.status || updated.verificationStatus || 'Verified',
      isVerified: true,
      verificationNote: updated.verificationNote || '',
      rejectionReason: '',
      rejection_reason: ''
    };
  }
  if (normalized === 'reject') {
    return {
      verificationStatus: updated.verificationStatus || 'Rejected',
      status: updated.status || updated.verificationStatus || 'Rejected',
      isVerified: false,
      verificationNote: updated.verificationNote || note || '',
      rejectionReason: updated.rejectionReason || note || '',
      rejection_reason: updated.rejection_reason || updated.rejectionReason || note || ''
    };
  }
  if (normalized === 'reset') {
    return {
      verificationStatus: updated.verificationStatus || 'Pending',
      status: updated.status || updated.verificationStatus || 'Pending',
      isVerified: false,
      verificationNote: '',
      rejectionReason: '',
      rejection_reason: ''
    };
  }
  return {};
}

function buildAssignmentResetPatch(updated = {}) {
  return {
    internshipStatus: updated.internshipStatus || 'Verified',
    status: updated.status || 'VERIFIED',
    verificationStatus: updated.verificationStatus || 'Verified',
    isVerified: true,
    assignedCompanyId: null,
    companyId: null,
    rejectionReason: '',
    rejection_reason: ''
  };
}

function hodVerifyButtonClass(disabled) {
  const base = 'rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest border transition-all';
  if (disabled) {
    return `${base} border-gray-300 bg-[#d1d5db] text-slate-500 opacity-40 cursor-not-allowed pointer-events-none`;
  }
  return `${base} border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300`;
}

function hodRejectButtonClass(disabled) {
  const base = 'rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-widest border transition-all';
  if (disabled) {
    return `${base} border-gray-300 bg-[#d1d5db] text-slate-500 opacity-40 cursor-not-allowed pointer-events-none`;
  }
  return `${base} border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300`;
}

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
  const authLoading = Boolean(auth?.loading);
  const adminType = String(auth?.user?.adminType || '').toLowerCase();
  const canExportStudents = adminType === 'superadmin' || adminType === 'collegeadmin';
  const hodDepartment = String(auth?.user?.department || '').trim();
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
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionBusy, setActionBusy] = useState({ id: '', type: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTarget, setAssignTarget] = useState([]);
  const [availablePartners, setAvailablePartners] = useState([]);
  const [assignTerm, setAssignTerm] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');
  const [selectedPartnerOption, setSelectedPartnerOption] = useState(null);
  const [assignHodNote, setAssignHodNote] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimerRef = React.useRef(null);
  const assignCloseTimerRef = React.useRef(null);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const isHod = String(auth?.user?.role || '').toLowerCase() === 'hod'
    || String(auth?.user?.adminType || '').toLowerCase() === 'deptadmin';

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await adminAPI.getStudents({
        page,
        limit: 10,
        department: departmentFilter,
        internshipStatus: statusFilter
      });
      setItems(Array.isArray(data?.items) ? data.items : []);
      setDepartmentOptions(Array.isArray(data?.filters?.departments) ? data.filters.departments : []);
      setInternshipStatusOptions(Array.isArray(data?.filters?.internshipStatuses) ? data.filters.internshipStatuses : []);
      setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
      setLastRefreshed(new Date().toLocaleString());
    } catch (requestError) {
      const statusCode = Number(requestError?.response?.status || 0);
      if (statusCode === 401) {
        setError('Unauthorized (401). Please sign in again to load the HOD student list.');
      } else if (statusCode === 404) {
        setError('Students API not found (404). Check the backend route configuration.');
      } else {
        setError(requestError?.response?.data?.message || 'Failed to load students.');
      }
    } finally {
      setLoading(false);
    }
  }, [page, departmentFilter, statusFilter]);

  useEffect(() => {
    if (!downloadNotice) return undefined;
    const timer = window.setTimeout(() => setDownloadNotice(''), 2500);
    return () => window.clearTimeout(timer);
  }, [downloadNotice]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!auth?.token) {
      setLoading(false);
      setError('Authentication required. Please sign in again.');
      return undefined;
    }

    if (isHod && !hodDepartment && !auth?.user?.departmentId) {
      return undefined;
    }

    let active = true;
    const run = async () => {
      await loadStudents();
      if (!active) return;
    };
    run();
    return () => {
      active = false;
    };
  }, [authLoading, auth?.token, auth?.user?.departmentId, hodDepartment, isHod, loadStudents]);

  useEffect(() => {
    if (!assignModalOpen) return undefined;

    let active = true;

    const refreshAvailablePartners = async () => {
      try {
        setLoadingPartners(true);
        const { data } = await adminAPI.getAvailablePartners({ department: auth?.user?.department });
        if (!active) return;

        const refreshedPartners = Array.isArray(data?.items)
          ? data.items.map((partner) => normalizePartnerOption(partner))
          : [];

        setAvailablePartners(refreshedPartners);
        setSelectedPartnerOption((current) => {
          const currentId = String(current?.internshipId || '').trim();
          if (!currentId) return null;

          const nextPartner = refreshedPartners.find((partner) => String(partner?.internshipId || partner?.value || '') === currentId);
          if (nextPartner) {
            setSelectedPartnerId(nextPartner.internshipId);
            return nextPartner;
          }

          setSelectedPartnerId('');
          return null;
        });
      } catch (err) {
        if (active) {
          console.error('Failed to load partners', err);
        }
      } finally {
        if (active) {
          setLoadingPartners(false);
        }
      }
    };

    refreshAvailablePartners();
    const refreshInterval = window.setInterval(refreshAvailablePartners, 20000);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
    };
  }, [assignModalOpen, auth?.user?.department]);

  const handleOpenAssign = async (students) => {
    // If it's a single student object, wrap it in array. If it's an array of IDs, store the raw IDs or objects.
    // For simplicity, assignTarget will be array of student objects OR just IDs.
    const targets = Array.isArray(students) ? students : [students];
    setAssignTarget(targets);
    setAssignTerm('');
    setSelectedPartnerId('');
    setSelectedPartnerOption(null);
    setAssignHodNote('');
    setAssignModalOpen(true);
    setAvailablePartners([]);
  };

  const handleConfirmAssign = async () => {
    if (!assignTarget || assignTarget.length === 0 || !selectedPartnerId) return;
    setIsAssigning(true);
    try {
      const studentIds = assignTarget.map((s) => typeof s === 'string' ? s : (s._id || s.id));
      const partner = selectedPartnerOption || availablePartners.find((p) => String(p.internshipId || p.id || p.value) === String(selectedPartnerId));
      const internshipId = String(partner?.internshipId || partner?.id || partner?.value || selectedPartnerId || '').trim();
      const companyId = String(partner?.companyId || '').trim();

      if (!internshipId || !companyId) {
        throw new Error('Missing internshipId or companyId for assignment');
      }

      console.log('Assign student payload:', { studentIds, internshipId, companyId, hodNote: assignHodNote });

      const response = await adminAPI.assignStudent({
        studentIds,
        internshipId,
        companyId,
        hodNote: assignHodNote
      });

      const responseStatus = Number(response?.status || 0);
      const responseData = response?.data || {};
      if (![200, 201].includes(responseStatus) || responseData?.success === false) {
        throw new Error(responseData?.message || 'Assignment failed');
      }

      const updatedStudents = Array.isArray(responseData?.items) ? responseData.items : [];
      const assignedCompanyId = companyId || partner?.companyId || '';
      const assignedPatch = { internshipStatus: 'PLACED', status: 'PLACED', assignedCompanyId };

      if (updatedStudents.length > 0) {
        updatedStudents.forEach((student) => patchStudentInList(student?._id || student?.id, { ...assignedPatch, companyId: assignedCompanyId }));
      } else {
        setItems((prev) => prev.map((student) => (
          student && studentIds.includes(String(student._id || student?.id))
            ? { ...student, ...assignedPatch, companyId: assignedCompanyId }
            : student
        )));
      }

      setToast({ type: 'success', message: 'Placement Confirmed!' });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3500);

      setAssignModalOpen(false);
      setAssignTarget([]);
      setSelectedPartnerId('');
      setSelectedPartnerOption(null);
      setAssignHodNote('');
      setSelectedStudentIds([]);

      setLastRefreshed(new Date().toLocaleString());
    } catch(err) {
      console.error(err);
      console.log('Assign student error response:', err?.response?.data);
      const msg = err?.response?.data?.message || 'Failed to assign student';
      setToast({ type: 'error', message: msg });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSelectStudent = (id) => {
    setSelectedStudentIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = (e, eligible) => {
    if(e.target.checked) {
      setSelectedStudentIds(eligible.map(s => String(s._id || s.id)));
    } else {
      setSelectedStudentIds([]);
    }
  };

  const handleExport = async ({ fileName, format }) => {
    try {
      setExporting(true);
      setError('');

      if (format === 'excel') {
        const { data } = await adminAPI.exportStudents({
           department: departmentFilter !== 'all' ? departmentFilter : undefined,
           internshipStatus: statusFilter !== 'all' ? statusFilter : undefined
        });
        downloadCsvBlob(`${fileName}.csv`, data);
        setDownloadNotice('Students Excel exported successfully.');
      } else {
        const html2pdf = (await import('html2pdf.js')).default;
        const { data: allData } = await adminAPI.getStudents({ 
          limit: 1000, 
          department: departmentFilter !== 'all' ? departmentFilter : undefined,
          internshipStatus: statusFilter !== 'all' ? statusFilter : undefined 
        });
        const studentsToExport = Array.isArray(allData?.items) ? allData.items : [];

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
                <h1 style="margin: 0; font-size: 24px; font-weight: 900; color: #0f172a; text-transform: uppercase;">Student Placement Report</h1>
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
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Full Name</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Department</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Internship Status</th>
                <th style="padding: 12px; text-align: left; border-bottom: 2px solid #e2e8f0; color: #475569; text-transform: uppercase;">Progress %</th>
              </tr>
            </thead>
            <tbody>
              ${studentsToExport.map((s, i) => `
                <tr style="border-bottom: 1px solid #f1f5f9; ${i % 2 === 0 ? '' : 'background: #fcfdfe;'}">
                  <td style="padding: 12px; font-weight: 700; color: #0f172a;">${s.fullName || s.name || '-'}</td>
                  <td style="padding: 12px; color: #475569;">${s.department || '-'}</td>
                  <td style="padding: 12px; font-weight: 800; text-transform: uppercase;">${s.internshipStatus || 'Not Applied'}</td>
                  <td style="padding: 12px; font-weight: 800; color: #0e7490;">${s.progress || 0}%</td>
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
        setDownloadNotice('Student PDF generated successfully.');
      }
      setExportModalOpen(false);
    } catch (requestError) {
      setError('Failed to generate export report.');
    } finally {
      setExporting(false);
    }
  };

  const openProfile = async (student) => {
    setSelectedStudent(student);
    setViewProfileOpen(true);
    try {
      const { data } = await adminAPI.getStudentProfile(student._id);
      setSelectedStudent(data?.item || student);
    } catch {
      // Fallback to existing student data if fetch fails
    }
  };

  const closeProfile = () => {
    setViewProfileOpen(false);
    setSelectedStudent(null);
  };

  const statusBadgeClass = (value) => {
    // Prefer verification status when present, otherwise fall back to internship status
    const raw = String(value || '').toLowerCase();
    if (raw === 'verified' || raw === 'placed') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    if (raw === 'pending' || raw === 'submitted' || raw === 'in progress' || raw === 'not submitted') return 'border-amber-200 bg-amber-50 text-amber-700';
    if (raw === 'rejected' || raw === 'not placed') return 'border-rose-200 bg-rose-50 text-rose-700';
    return 'border-slate-200 bg-slate-100 text-slate-700';
  };

  const patchStudentInList = (studentId, patch = {}) => {
    const matchId = String(studentId);
    setItems((prev) => prev.map((student) => (
      String(student?._id || student?.id) === matchId
        ? { ...student, ...patch }
        : student
    )));
    setSelectedStudent((prev) => {
      if (!prev || String(prev?._id || prev?.id) !== matchId) return prev;
      return { ...prev, ...patch };
    });
  };

  const handleHodAction = async (studentId, action, note) => {
    if (!studentId || !action) return;
    const actionType = String(action).toLowerCase();
    try {
      setActionBusy({ id: String(studentId), type: actionType });
      setError('');
      const payload = { action };
      if (actionType === 'reject') {
        const reason = String(note || rejectionReason || '').trim();
        if (!reason) {
          setToast({ type: 'error', message: 'Rejection reason is required.' });
          if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
          toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
          setActionBusy({ id: '', type: '' });
          return;
        }
        payload.reason = reason;
      }

      const { data } = await adminAPI.patchStudentStatus(studentId, payload);
      const updated = data?.item || {};
      const nextPatch = buildStatusPatch(actionType, updated, payload.reason);

      patchStudentInList(studentId, nextPatch);

      setRejectionModalOpen(false);
      setRejectionTarget(null);
      setRejectionReason('');
      setToast({ type: 'success', message: 'Operation Successful!' });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
      setLastRefreshed(new Date().toLocaleString());
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to update verification.';
      setToast({ type: 'error', message: msg });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4500);
    } finally {
      setActionBusy({ id: '', type: '' });
    }
  };

  const handleOpenReject = (student) => {
    setRejectionTarget(student);
    setRejectionReason('');
    setRejectionModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectionTarget) return;
    await handleHodAction(rejectionTarget._id, 'reject', rejectionReason);
  };

  const handleVerify = async (studentId) => {
    await handleHodAction(studentId, 'verify');
  };

  // Reset assignment (undo placement) — calls HOD reset-assignment endpoint
  const handleAssignmentReset = async (studentId) => {
    setActionBusy({ id: String(studentId), type: 'reset' });
    try {
      const { data } = await adminAPI.resetAssignment(studentId);
      patchStudentInList(studentId, buildAssignmentResetPatch(data?.item));
      setToast({ type: 'success', message: 'Operation Successful!' });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to reset assignment.';
      setToast({ type: 'error', message: msg });
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
    } finally {
      setActionBusy({ id: '', type: '' });
    }
  };

  // Reset verification status to Pending (undo verify/reject)
  const handleVerificationReset = async (studentId) => {
    setActionBusy({ id: String(studentId), type: 'reset' });
    try {
      await handleHodAction(studentId, 'reset');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Failed to reset verification.';
      setToast({ type: 'error', message: msg });
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
    } finally {
      setActionBusy({ id: '', type: '' });
    }
  };

  return (
    <div className="flex w-full flex-col space-y-8 pb-12">
      <AnimatePresence>
        {toast ? (
          <motion.div
            key="students-toast"
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            className={`fixed right-5 top-5 z-[100] w-[min(92vw,420px)] rounded-xl border p-4 shadow-lg backdrop-blur-xl ${toast.type === 'success' ? 'border-emerald-950/30 bg-emerald-700 text-white' : 'border-rose-950/30 bg-rose-700 text-white'}`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/20">
                {toast.type === 'success' ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-6">{toast.message}</p>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
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
            <h1 className="text-5xl font-black tracking-tight leading-none bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-600 bg-clip-text text-transparent pb-1">Students</h1>
            <p className="text-lg text-slate-500 font-medium max-w-2xl leading-relaxed">
              Track academic placement progress and manage institutional internship outcomes for all enrolled students.
            </p>
          </div>
          
          <div className="flex items-center gap-4 bg-slate-50/80 backdrop-blur-sm border border-slate-100 p-2 rounded-[32px] shadow-sm">
             <div className="flex items-center gap-6 rounded-[28px] border border-cyan-100 bg-cyan-50/40 px-8 py-5 shadow-sm mr-2 transition-all hover:shadow-md hover:bg-cyan-50/60">
                <div className="h-14 w-14 rounded-2xl bg-white flex items-center justify-center shadow-sm text-cyan-600 border border-cyan-50">
                  <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.3em] text-cyan-700 leading-none mb-2">Total Students</p>
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
            <select
              value={departmentFilter}
              onChange={(event) => {
                setPage(1);
                setDepartmentFilter(event.target.value);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All Departments</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-black text-slate-700 transition-all focus:border-cyan-500 focus:ring-8 focus:ring-cyan-500/5 outline-none appearance-none cursor-pointer shadow-sm uppercase tracking-widest"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3e%3cpath stroke=\'%2364748b\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3e%3c/svg%3e")', backgroundPosition: 'right 1.25rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em' }}
            >
              <option value="all">All Statuses</option>
              {internshipStatusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={!canExportStudents || exporting}
            className="group flex items-center gap-4 rounded-2xl bg-cyan-700 px-10 py-5 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_15px_30px_rgba(14,116,144,0.25)] transition-all hover:bg-cyan-600 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(14,116,144,0.3)] disabled:opacity-50 disabled:translate-y-0"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {exporting ? 'Generating Report...' : 'Download List'}
          </button>
        </div>

        {selectedStudentIds.length > 0 && isHod && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-[32px] p-6 shadow-sm">
            <span className="font-bold text-blue-800">{selectedStudentIds.length} students selected</span>
            <button onClick={() => handleOpenAssign(selectedStudentIds)} className="rounded-2xl border border-blue-300 bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-blue-700 hover:shadow-sm">
              Assign Selected Interns
            </button>
          </div>
        )}

        {/* Students List Card */}
        <div className="w-full rounded-[40px] border border-cyan-100 bg-white overflow-hidden shadow-[0_25px_60px_rgba(15,23,42,0.06)]">
          <div className="px-10 py-10 border-b border-slate-100 flex justify-between items-center bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
             <div className="flex items-center gap-6">
                {/* Title removed for cleaner UI */}
             </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/60 backdrop-blur-sm border-b border-slate-100">
                  {isHod && (
                    <th className="px-6 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600 w-16">
                      <input 
                        type="checkbox" 
                        onChange={(e) => handleSelectAll(e, items.filter(s => String(s?.internshipStatus || '').toLowerCase() !== 'placed'))} 
                        checked={selectedStudentIds.length > 0 && selectedStudentIds.length === items.filter(s => String(s?.internshipStatus || '').toLowerCase() !== 'placed').length} 
                        className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Full Name</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Department</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Status</th>
                  <th className="px-10 py-7 text-[12px] font-black uppercase tracking-[0.25em] text-slate-600">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-10 py-24 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 text-slate-500">
                        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-200 border-t-cyan-600" />
                        <p className="text-sm font-bold uppercase tracking-widest">Loading students...</p>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan="5" className="px-10 py-24 text-center">
                      <div className="mx-auto max-w-lg rounded-3xl border border-rose-200 bg-rose-50 px-6 py-8 text-rose-900 shadow-sm">
                        <p className="text-sm font-black uppercase tracking-widest text-rose-700">Students fetch failed</p>
                        <p className="mt-3 text-base font-medium leading-7">{error}</p>
                      </div>
                    </td>
                  </tr>
                ) : items.length > 0 ? items.map((student, index) => (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    transition={{ delay: index * 0.04 }}
                    key={String(student?._id || index)} 
                    className="group hover:bg-slate-50/50 transition-all duration-300"
                  >
                    {isHod && (
                      <td className="px-6 py-6" onClick={(e) => e.stopPropagation()}>
                        {String(student?.internshipStatus || '').toLowerCase() !== 'placed' && (
                          <input 
                            type="checkbox" 
                            checked={selectedStudentIds.includes(String(student?._id || student?.id))} 
                            onChange={() => handleSelectStudent(String(student?._id || student?.id))} 
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                          />
                        )}
                      </td>
                    )}
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-5">
                        <div className="h-14 w-14 shrink-0 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-700 font-black text-lg border border-cyan-100 group-hover:scale-105 group-hover:bg-cyan-100 transition-all overflow-hidden shadow-sm relative">
                          {student?.profileDetails?.profilePicUrl || student?.profilePicture || student?.profile_picture || student?.profileImage ? (
                            <img 
                              src={student?.profileDetails?.profilePicUrl || student?.profilePicture || student?.profile_picture || student?.profileImage} 
                              alt="" 
                              className="h-full w-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                            />
                          ) : null}
                          <span className={`${student?.profileDetails?.profilePicUrl || student?.profilePicture || student?.profile_picture || student?.profileImage ? 'hidden' : 'flex'} items-center justify-center`}>
                            {String(student?.fullName || student?.name || 'S').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-lg font-black text-slate-900 group-hover:text-cyan-700 transition-colors leading-tight">{student?.fullName || student?.name || 'N/A'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <span className="text-sm font-bold text-slate-600">{student?.department || '-'}</span>
                    </td>
                    <td className="px-10 py-6">
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl border ${statusBadgeClass(getStudentDisplayStatus(student, isHod))} shadow-sm group-hover:scale-105 transition-transform`}>
                        <div className="h-2 w-2 rounded-full bg-current" />
                        <span className="text-[11px] font-black uppercase tracking-widest">
                          {getStudentDisplayStatus(student, isHod)}
                        </span>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      {(() => {
                        const studentId = String(student?._id || student?.id || '');
                        const rowBusy = actionBusy.id === studentId;
                        const verifyLoading = rowBusy && actionBusy.type === 'verify';
                        const rejectLoading = rowBusy && actionBusy.type === 'reject';
                        const resetLoading = rowBusy && actionBusy.type === 'reset';
                        const displayStatus = getStudentDisplayStatus(student, isHod);
                        const displayStatusKey = String(displayStatus || '').toLowerCase();
                        const verified = displayStatusKey === 'verified';
                        const rejected = displayStatusKey === 'rejected';
                        const pending = ['not submitted', 'pending', 'submitted', ''].includes(displayStatusKey);
                        const placed = displayStatusKey === 'placed';
                        const verifyDisabled = !pending || rowBusy;
                        const rejectDisabled = !pending || rowBusy;
                        const resetDisabled = (!verified && !rejected && !placed) || rowBusy;
                        const canAssign = verified && !placed;
                        const canResetVerification = verified || rejected;
                        const canResetAssignment = placed;
                        const rejectionReason = getVerificationReason(student);

                        return (
                          <div className="flex flex-row flex-nowrap items-center gap-2 overflow-x-auto transition-all duration-200">
                            <button
                              type="button"
                              onClick={() => openProfile(student)}
                              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-all hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm"
                            >
                              View Profile
                            </button>
                            {isHod && canAssign && (
                              <button
                                type="button"
                                onClick={() => handleOpenAssign(student)}
                                disabled={rowBusy}
                                className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-xs font-black uppercase tracking-widest text-blue-700 transition-all hover:bg-blue-100 hover:border-blue-300 hover:shadow-sm disabled:opacity-40"
                              >
                                Assign Internship
                              </button>
                            )}
                            {isHod && canResetAssignment && (
                              <button
                                type="button"
                                onClick={() => handleAssignmentReset(studentId)}
                                disabled={rowBusy}
                                className={`rounded-2xl border px-5 py-3 text-xs font-black uppercase tracking-widest transition-all duration-200 ${rowBusy ? 'border-gray-300 bg-[#d1d5db] text-slate-500 opacity-40 cursor-not-allowed pointer-events-none' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'}`}
                              >
                                {resetLoading ? 'Resetting...' : 'Reset Assignment'}
                              </button>
                            )}
                            {isHod && pending ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleVerify(studentId)}
                                  disabled={verifyDisabled}
                                  className={hodVerifyButtonClass(verifyDisabled)}
                                >
                                  {verifyLoading ? 'Verifying...' : 'Verify Student'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReject(student)}
                                  disabled={rejectDisabled}
                                  className={hodRejectButtonClass(rejectDisabled)}
                                >
                                  {rejectLoading ? 'Rejecting...' : 'Reject Student'}
                                </button>
                              </>
                            ) : null}
                            {isHod && canResetVerification ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleVerificationReset(studentId)}
                                  disabled={resetDisabled}
                                  className={`rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all duration-200 ${
                                    resetDisabled
                                      ? 'border-gray-300 bg-[#d1d5db] text-slate-500 opacity-40 cursor-not-allowed pointer-events-none'
                                      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-400 shadow-sm'
                                  }`}
                                >
                                  {resetLoading ? 'Resetting...' : 'Reset Verification'}
                                </button>
                              </>
                            ) : null}
                            {rejected ? (
                              <div className="flex max-w-[24rem] flex-col gap-1 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                                <span className="text-xs font-black uppercase tracking-widest text-rose-700">
                                  Rejected. Reason:
                                </span>
                                {rejectionReason ? (
                                  <span className="text-xs text-rose-800">{rejectionReason}</span>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })()}
                    </td>
                  </motion.tr>
                )) : (
                   <tr>
                    <td colSpan="5" className="px-10 py-28 text-center">
                      <div className="flex flex-col items-center justify-center gap-6">
                        <div className="h-24 w-24 rounded-[32px] bg-slate-50 flex items-center justify-center text-5xl border border-slate-100 opacity-40 grayscale group-hover:grayscale-0 transition-all">🎓</div>
                        <div className="space-y-1">
                          <p className="text-xl font-black text-slate-400">No students found</p>
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

      <AdvancedExportModal
        open={exportModalOpen}
        title="Export Data"
        loading={exporting}
        onClose={() => setExportModalOpen(false)}
        onConfirm={handleExport}
      />

      <Modal open={rejectionModalOpen} onClose={() => setRejectionModalOpen(false)} title="Reject Student Verification">
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Provide a clear reason for rejecting
            {' '}
            <span className="font-bold text-slate-900">{rejectionTarget?.fullName || rejectionTarget?.name || 'this student'}</span>
            . This will be saved and sent to the student.
          </p>
          <label htmlFor="rejectionReason" className="block text-xs font-black uppercase tracking-widest text-slate-500">
            Reason for Rejection <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="rejectionReason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Explain what the student should update before resubmitting..."
            className="w-full rounded-xl border border-slate-200 p-4 min-h-[120px] text-sm text-slate-700 focus:border-rose-300 focus:ring-4 focus:ring-rose-100 outline-none"
          />
          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => setRejectionModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600">Cancel</button>
            <button
              type="button"
              onClick={handleConfirmReject}
              disabled={!String(rejectionReason || '').trim() || Boolean(actionBusy.id)}
              className="rounded-xl bg-rose-600 px-6 py-3 text-sm font-black text-white transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Confirm Reject
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={assignModalOpen} onClose={() => setAssignModalOpen(false)} title="Assign Student to Partner">
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-2">
          <p className="text-sm text-slate-600">
            Assign <span className="font-bold text-slate-900">{assignTarget.length} student(s)</span> to an available industry partner.
          </p>
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">Select active internship program</p>
                <p className="mt-1 text-sm text-slate-500">Search by company name or internship title. Availability refreshes while this modal is open.</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
                Live availability
              </span>
            </div>
          </div>
          <div className="relative group">
            <Select
              isLoading={loadingPartners}
              value={selectedPartnerOption}
              options={availablePartners.map((partner) => normalizePartnerOption(partner))}
              getOptionValue={(option) => option?.internshipId || option?.value || ''}
              onChange={(option) => {
                const nextOption = option ? normalizePartnerOption(option) : null;
                setSelectedPartnerOption(nextOption);
                setSelectedPartnerId(nextOption?.internshipId || '');
              }}
              filterOption={(candidate, inputValue) => {
                const query = String(inputValue || '').trim().toLowerCase();
                if (!query) return true;

                const haystack = [
                  candidate?.data?.companyName,
                  candidate?.data?.internshipTitle,
                  candidate?.data?.location,
                  candidate?.data?.programType
                ]
                  .filter(Boolean)
                  .join(' ')
                  .toLowerCase();

                return haystack.includes(query);
              }}
              components={{
                Option: PartnerOption,
                SingleValue: PartnerSingleValue,
                IndicatorSeparator: () => null
              }}
              placeholder="Search company or internship title..."
              isClearable
              isSearchable
              noOptionsMessage={() => (
                <div className="py-10 flex flex-col items-center justify-center text-center">
                  <div className="mb-4 h-24 w-24 rounded-full bg-slate-50 flex items-center justify-center text-4xl shadow-inner shadow-slate-200/50">🏢</div>
                  <p className="text-sm font-black text-slate-900">No Verified Partners Found</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-1 max-w-[240px]">There are currently no active programs in your department from verified companies.</p>
                </div>
              )}
              classNamePrefix="enterprise-select"
              menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
              menuPosition="fixed"
              styles={{
                control: (base, state) => ({
                  ...base,
                  minHeight: '72px',
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '24px',
                  backgroundColor: '#ffffff',
                  border: state.isFocused ? '1px solid #3B82F6' : '1px solid #e2e8f0',
                  boxShadow: state.isFocused ? '0 0 0 4px rgba(59, 130, 246, 0.12)' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  '&:hover': {
                    border: '1px solid #3B82F6'
                  },
                  fontSize: '15px',
                  fontWeight: '700',
                  color: '#0f172a',
                  transition: 'all 0.2s ease'
                }),
                menu: (base) => ({
                  ...base,
                  borderRadius: '24px',
                  padding: '12px',
                  marginTop: '12px',
                  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.18)',
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                  zIndex: 9999,
                  width: '100%'
                }),
                menuPortal: (base) => ({
                  ...base,
                  zIndex: 9999
                }),
                option: (base, state) => ({
                  ...base,
                  borderRadius: '18px',
                  padding: '0',
                  marginBottom: '6px',
                  fontSize: '14px',
                  fontWeight: state.isSelected ? '800' : '600',
                  backgroundColor: state.isSelected ? '#eff6ff' : state.isFocused ? '#f8fafc' : 'transparent',
                  color: state.isSelected ? '#1e4ed8' : '#334155',
                  cursor: 'pointer',
                  '&:active': {
                    backgroundColor: '#eff6ff'
                  }
                }),
                placeholder: (base) => ({
                  ...base,
                  color: '#94a3b8',
                  fontWeight: '600'
                }),
                loadingMessage: (base) => ({
                  ...base,
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#64748b',
                  padding: '20px'
                })
              }}
            />
          </div>

          <label htmlFor="hodNote" className="block text-xs font-black uppercase tracking-widest text-slate-500 mt-4">
            Assignment Reason / Note <span className="text-rose-500">*</span>
          </label>
          <textarea
            id="hodNote"
            value={assignHodNote}
            onChange={(e) => setAssignHodNote(e.target.value)}
            placeholder="e.g. Student is highly recommended for his React skills, or Facilitated by University agreement..."
            className="w-full rounded-2xl border border-slate-200 p-4 min-h-[100px] text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-8 focus:ring-blue-500/5"
            required
          />

          <div className="flex items-center justify-end gap-3 mt-6">
            <button type="button" onClick={() => setAssignModalOpen(false)} className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-600">Cancel</button>
            <button
              type="button"
              onClick={handleConfirmAssign}
              disabled={!selectedPartnerOption?.internshipId || isAssigning || !assignHodNote.trim()}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-black text-white transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 flex items-center gap-3"
            >
              {isAssigning ? (
                <>
                  <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" strokeOpacity="0.15" /><path d="M22 12a10 10 0 10-4.9 8.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <span>Assigning...</span>
                </>
              ) : (
                'Confirm Assignment'
              )}
            </button>
          </div>
        </div>
      </Modal>

      <AnimatePresence>
        {viewProfileOpen && (
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
                    <h2 className="text-xl font-black text-slate-900 tracking-tighter">Student Profile</h2>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Student Information</p>
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
                {/* Profile Header Section */}
                <div className="flex items-center gap-8 border-b border-slate-100 pb-10">
                   <div className="h-28 w-28 rounded-[40px] bg-cyan-50 flex items-center justify-center text-4xl font-black text-cyan-700 border border-cyan-100 shadow-sm overflow-hidden relative">
                      {selectedStudent?.profileDetails?.profilePicUrl || selectedStudent?.profilePicture || selectedStudent?.profile_picture || selectedStudent?.profileImage ? (
                        <img 
                          src={selectedStudent?.profileDetails?.profilePicUrl || selectedStudent?.profilePicture || selectedStudent?.profile_picture || selectedStudent?.profileImage} 
                          alt="" 
                          className="h-full w-full object-cover"
                          onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <span className={`${selectedStudent?.profileDetails?.profilePicUrl || selectedStudent?.profilePicture || selectedStudent?.profile_picture || selectedStudent?.profileImage ? 'hidden' : 'flex'} items-center justify-center`}>
                        {String(selectedStudent?.fullName || selectedStudent?.name || 'S').charAt(0).toUpperCase()}
                      </span>
                   </div>
                   <div className="space-y-2">
                      <h4 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{selectedStudent?.fullName || selectedStudent?.name || 'N/A'}</h4>
                      <div className="flex items-center gap-3">
                         <span className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">{selectedStudent?.college || 'University'}</span>
                      </div>
                   </div>
                </div>

                {/* Explicit Data Information List */}
                <div className="space-y-8 bg-slate-50/50 rounded-[32px] p-10 border border-slate-100 shadow-inner">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                      {/* Full Name */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Full Name</p>
                         <p className="text-lg font-black text-slate-900 leading-tight">{selectedStudent?.fullName || selectedStudent?.name || '-'}</p>
                      </div>

                      {/* Email Address */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Email Address</p>
                         <p className="text-lg font-bold text-slate-700 break-all">{selectedStudent?.email || '-'}</p>
                      </div>

                      {/* Phone Number */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Phone Number</p>
                         <p className="text-lg font-bold text-slate-700">{selectedStudent?.profileDetails?.phone || '-'}</p>
                      </div>

                      {/* University / College */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">University / College</p>
                         <p className="text-lg font-bold text-slate-700">{selectedStudent?.college || selectedStudent?.profileDetails?.college || '-'}</p>
                      </div>

                      {/* Department */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Department</p>
                         <p className="text-lg font-bold text-slate-700">{selectedStudent?.department || '-'}</p>
                      </div>

                      {/* Year of Study */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Year of Study</p>
                         <p className="text-lg font-bold text-slate-700">{selectedStudent?.profileDetails?.yearOfStudy ? `${selectedStudent.profileDetails.yearOfStudy} Year Student` : '-'}</p>
                      </div>

                      {/* Internship Status */}
                      <div className="space-y-1.5">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Current Status</p>
                         <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${statusBadgeClass(selectedStudent?.verificationStatus || selectedStudent?.internshipStatus)} mt-1`}>
                           <span className="text-xs font-black uppercase tracking-widest">{selectedStudent?.verificationStatus || selectedStudent?.internshipStatus || 'Not Applied'}</span>
                         </div>
                      </div>

                      {/* Skills */}
                      <div className="space-y-3 col-span-2">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Skills</p>
                         <div className="flex flex-wrap gap-2.5">
                            {selectedStudent?.profileDetails?.skills?.length > 0 ? (
                               selectedStudent.profileDetails.skills.map((skill, i) => (
                                 <span key={i} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 shadow-sm">
                                   {skill}
                                 </span>
                               ))
                            ) : (
                               <p className="text-sm font-medium text-slate-400 italic">No skills listed</p>
                            )}
                         </div>
                      </div>

                      {/* Bio */}
                      <div className="space-y-3 col-span-2">
                         <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">About Student (Bio)</p>
                         <div className="bg-white/80 p-6 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-cyan-600" />
                            <p className="text-base text-slate-600 leading-relaxed italic">
                               {selectedStudent?.profileDetails?.bio || 'No bio information provided by the student.'}
                            </p>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Professional Assets */}
                {selectedStudent?.profileDetails?.resumeUrl && (
                  <div className="pt-6">
                     <a 
                       href={selectedStudent.profileDetails.resumeUrl} 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="group flex items-center justify-between w-full p-8 rounded-[32px] bg-[#0e7490] text-white transition-all hover:bg-[#155e75] shadow-[0_20px_50px_rgba(14,116,144,0.2)] hover:shadow-[0_25px_60px_rgba(14,116,144,0.3)]"
                     >
                       <div className="flex items-center gap-6">
                          <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-inner">📄</div>
                          <div className="text-left">
                             <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Resume File</p>
                             <p className="text-base font-black uppercase tracking-[0.15em]">Open Student Resume</p>
                          </div>
                       </div>
                       <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                          <svg className="h-6 w-6 opacity-80 group-hover:opacity-100 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                             <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                       </div>
                     </a>
                  </div>
                )}

                <div className="pt-10">
                  <button 
                    onClick={closeProfile}
                    className="w-full py-5 rounded-2xl border-2 border-slate-100 text-sm font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 hover:border-slate-200 transition-all"
                  >
                    Close Profile
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
