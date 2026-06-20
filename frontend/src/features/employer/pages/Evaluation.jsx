import React, { useEffect, useMemo, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { employerAPI } from '../employerAPI';
import useAuth from '@/hooks/useAuth';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Helper function to convert text to title case
function toTitleCase(text) {
  if (!text) return '';
  return String(text)
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Helper function to format college name
function formatCollegeName(college) {
  if (!college || typeof college !== 'string') return '';
  const trimmed = college.trim();
  if (trimmed.length === 0) return '';
  // If already starts with 'College', return as is with title case
  if (trimmed.toLowerCase().startsWith('college')) {
    return toTitleCase(trimmed);
  }
  // Otherwise prepend 'College of'
  return `College of ${toTitleCase(trimmed)}`;
}

// Helper function to format department name
function formatDepartmentName(department) {
  if (!department || typeof department !== 'string') return '';
  const trimmed = department.trim();
  if (trimmed.length === 0) return '';
  // If already starts with 'Department', return as is with title case
  if (trimmed.toLowerCase().startsWith('department')) {
    return toTitleCase(trimmed);
  }
  // Otherwise prepend 'Department of'
  return `Department of ${toTitleCase(trimmed)}`;
}

function buildAcademicHeader(target) {
  const college = formatCollegeName(target?.studentCollege || target?.college || target?.collegeName || target?.college_name || '');
  const department = formatDepartmentName(target?.studentDepartment || target?.department || target?.departmentName || target?.department_name || '');

  if (college && department) {
    return {
      college,
      department,
      hasAcademicInfo: true,
      fallback: ''
    };
  }

  return {
    college: '',
    department: '',
    hasAcademicInfo: false,
    fallback: 'University of Gondar (College/Department Pending)'
  };
}

function sanitizePdfBaseName(value) {
  const cleaned = String(value || 'Internship_Form')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || 'Internship_Form';
}

function ensurePdfExtension(fileName) {
  const trimmed = String(fileName || '').trim();
  if (!trimmed) return 'Internship_Form.pdf';
  return trimmed.toLowerCase().endsWith('.pdf') ? trimmed : `${trimmed}.pdf`;
}

function normalizeScores(source = {}) {
  const nextScores = { ...INITIAL_SCORES };
  Object.keys(nextScores).forEach((key) => {
    const value = source?.[key];
    nextScores[key] = value === undefined || value === null || value === '' ? '' : String(value);
  });
  return nextScores;
}

function normalizeEvaluationForm(target = null) {
  return {
    companyForm: {
      companyName: target?.evaluationAcceptanceForm?.companyName || '',
      placeTown: target?.evaluationAcceptanceForm?.placeTown || '',
      contactPerson: target?.evaluationAcceptanceForm?.contactPerson || '',
      companyPhone: target?.evaluationAcceptanceForm?.companyPhone || '',
      companyEmail: target?.evaluationAcceptanceForm?.companyEmail || '',
      representativeName: target?.evaluationAcceptanceForm?.representativeName || '',
      representativeSignature: target?.evaluationAcceptanceForm?.representativeSignature || '',
      representativeDate: target?.evaluationAcceptanceForm?.representativeDate || ''
    },
    scores: normalizeScores(target?.evaluationCriteriaScores || {}),
    supervisorName: target?.evaluationSupervisorName || '',
    message: target?.evaluationStatus === 'Submitted' || target?.hasEvaluation
      ? 'Evaluation already submitted. You can view the official document below.'
      : ''
  };
}

const PDF_GHOST_WIDTH = 794;
const PDF_GHOST_HEIGHT = 1123;

function stripUnsupportedColorFunctions(value) {
  return String(value || '')
    .replace(/oklch\([^)]*\)/gi, 'rgb(255, 255, 255)')
    .replace(/oklab\([^)]*\)/gi, 'rgb(255, 255, 255)')
    .replace(/color-mix\([^)]*\)/gi, 'rgb(255, 255, 255)');
}

function createPdfGhostContainer(sourceElement) {
  const ghostContainer = document.createElement('div');
  ghostContainer.setAttribute('data-pdf-ghost', 'true');
  ghostContainer.style.position = 'fixed';
  ghostContainer.style.left = '-10000px';
  ghostContainer.style.top = '0';
  ghostContainer.style.width = `${PDF_GHOST_WIDTH}px`;
  ghostContainer.style.minHeight = `${PDF_GHOST_HEIGHT}px`;
  ghostContainer.style.backgroundColor = 'rgb(255, 255, 255)';
  ghostContainer.style.padding = '20px';
  ghostContainer.style.boxSizing = 'border-box';
  ghostContainer.style.pointerEvents = 'none';
  ghostContainer.style.overflow = 'visible';
  ghostContainer.style.zIndex = '-1';

  const clone = sourceElement.cloneNode(true);
  clone.setAttribute('data-pdf-paper', 'true');
  clone.style.width = `${PDF_GHOST_WIDTH - 40}px`;
  clone.style.minHeight = `${PDF_GHOST_HEIGHT - 40}px`;
  clone.style.margin = '0';
  clone.style.backgroundColor = 'rgb(255, 255, 255)';
  clone.style.color = 'rgb(0, 0, 0)';
  clone.style.boxSizing = 'border-box';
  clone.style.boxShadow = 'none';
  clone.style.borderRadius = '0';
  clone.style.overflow = 'visible';
  clone.style.fontWeight = '700';
  clone.style.lineHeight = '1.5';

  clone.querySelectorAll('*').forEach((element) => {
    if (!element?.style) return;

    const style = element.style;
    const cleanedCssText = stripUnsupportedColorFunctions(style.cssText);
    if (cleanedCssText !== style.cssText) {
      style.cssText = cleanedCssText;
    }

    style.backgroundColor = 'rgb(255, 255, 255)';
    style.color = 'rgb(0, 0, 0)';
    style.borderColor = 'rgb(0, 0, 0)';
    style.textShadow = 'none';
    style.boxShadow = 'none';
    style.borderRadius = '0';
    style.lineHeight = '1.5';
    style.fontWeight = '700';
    if ('fill' in style) style.fill = 'rgb(0, 0, 0)';
    if ('stroke' in style) style.stroke = 'rgb(0, 0, 0)';

    if (/^(H1|H2|H3|H4|H5|H6)$/i.test(element.tagName)) {
      style.textAlign = 'center';
    }

    if (/^(INPUT|TEXTAREA|SELECT)$/i.test(element.tagName)) {
      style.backgroundColor = 'rgb(255, 255, 255)';
      style.color = 'rgb(0, 0, 0)';
      style.border = '1px solid rgb(0, 0, 0)';
      style.outline = 'none';
    }

    Array.from(style).forEach((propertyName) => {
      const currentValue = style.getPropertyValue(propertyName);
      if (/oklch|oklab|color-mix/i.test(currentValue)) {
        const fallbackValue = /background|bg|fill/i.test(propertyName)
          ? 'rgb(255, 255, 255)'
          : 'rgb(0, 0, 0)';
        style.setProperty(propertyName, fallbackValue, 'important');
      }
    });
  });

  ghostContainer.appendChild(clone);
  document.body.appendChild(ghostContainer);
  return { ghostContainer, ghostPaper: clone };
}

function removePdfGhostContainer(ghostContainer) {
  if (ghostContainer?.parentNode) {
    ghostContainer.parentNode.removeChild(ghostContainer);
  }
}

const PDF_PRINT_STYLES = `
  @media print {
    [data-pdf-paper="true"] {
      box-shadow: none !important;
      border-radius: 0 !important;
      background: #fff !important;
      color: #000 !important;
    }

    [data-pdf-paper="true"] * {
      line-height: 1.5 !important;
    }

    [data-pdf-paper="true"] table,
    [data-pdf-paper="true"] th,
    [data-pdf-paper="true"] td {
      border: 1px solid #000 !important;
    }
  }
`;

async function waitForNextPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function buildPdfDocument(sourceElement) {
  const { ghostContainer, ghostPaper } = createPdfGhostContainer(sourceElement);

  try {
    await waitForNextPaint();

    const canvas = await html2canvas(ghostPaper, {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff',
      windowWidth: PDF_GHOST_WIDTH,
      windowHeight: PDF_GHOST_HEIGHT,
      scrollX: 0,
      scrollY: 0,
      onclone: (clonedDocument) => {
        clonedDocument.documentElement.style.backgroundColor = 'rgb(255, 255, 255)';
        clonedDocument.body.style.backgroundColor = 'rgb(255, 255, 255)';
        clonedDocument.body.style.color = 'rgb(0, 0, 0)';

        clonedDocument.querySelectorAll('[data-pdf-paper="true"], [data-pdf-paper="true"] *').forEach((element) => {
          if (!element?.style) return;
          const style = element.style;
          const cleanedCssText = stripUnsupportedColorFunctions(style.cssText);
          if (cleanedCssText !== style.cssText) {
            style.cssText = cleanedCssText;
          }
          style.backgroundColor = 'rgb(255, 255, 255)';
          style.color = 'rgb(0, 0, 0)';
          style.borderColor = 'rgb(0, 0, 0)';
          style.boxShadow = 'none';
          style.textShadow = 'none';
          style.borderRadius = '0';
          style.lineHeight = '1.5';
          if (/^(H1|H2|H3|H4|H5|H6)$/i.test(element.tagName)) {
            style.textAlign = 'center';
          }
          if (/^(INPUT|TEXTAREA|SELECT)$/i.test(element.tagName)) {
            style.backgroundColor = 'rgb(255, 255, 255)';
            style.color = 'rgb(0, 0, 0)';
            style.border = '1px solid rgb(0, 0, 0)';
          }
        });

        const printStyle = clonedDocument.createElement('style');
        printStyle.textContent = `
          @media print {
            [data-pdf-paper="true"] {
              box-shadow: none !important;
              border-radius: 0 !important;
            }

            [data-pdf-paper="true"] * {
              line-height: 1.5 !important;
            }

            [data-pdf-paper="true"] table,
            [data-pdf-paper="true"] th,
            [data-pdf-paper="true"] td {
              border: 1px solid #000 !important;
            }
          }
        `;
        clonedDocument.head.appendChild(printStyle);
      }
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imageData = canvas.toDataURL('image/png', 1.0);
    const imageHeight = (canvas.height * pageWidth) / canvas.width;
    const totalPages = Math.max(Math.ceil(imageHeight / pageHeight), 1);

    let remainingHeight = imageHeight;
    let positionY = 0;

    pdf.addImage(imageData, 'PNG', 0, positionY, pageWidth, imageHeight, undefined, 'FAST');
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      positionY = remainingHeight - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', 0, positionY, pageWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= pageHeight;
    }

    return { pdf, totalPages };
  } finally {
    removePdfGhostContainer(ghostContainer);
  }
}

const CRITERIA = {
  group1: [
    { id: 'g1_1', label: 'Attendance punctuality and regularity', max: 6 },
    { id: 'g1_2', label: 'Follow-through on instruction', max: 6 },
    { id: 'g1_3', label: 'Ability to perform under pressure', max: 6 },
    { id: 'g1_4', label: 'Ability to communicate ideas clearly and effectively to others', max: 6 },
    { id: 'g1_5', label: 'Demonstrates a self-motivated approach to work', max: 6 },
    { id: 'g1_6', label: 'Ability to establish appropriate priorities and goals', max: 6 },
    { id: 'g1_7', label: 'Professional interest (Exhibits professional behavior/ attitude)', max: 6 }
  ],
  group2: [
    { id: 'g2_1', label: 'Understanding task at hand', max: 7 },
    { id: 'g2_2', label: 'On-time completion of assigned task', max: 7 },
    { id: 'g2_3', label: 'Pay close attention to details', max: 7 },
    { id: 'g2_4', label: 'Quality of work', max: 7 }
  ],
  group3: [
    { id: 'g3_1', label: 'Ability to accept constructive criticism', max: 6 },
    { id: 'g3_2', label: 'Open-mindedness (willingness to listen and learn)', max: 6 },
    { id: 'g3_3', label: 'Interpersonal relationships with coworkers and supervisors', max: 6 },
    { id: 'g3_4', label: 'Contributes to a team atmosphere', max: 6 },
    { id: 'g3_5', label: 'Demonstrates appropriate behavior', max: 6 }
  ]
};

const INITIAL_SCORES = {};
[...CRITERIA.group1, ...CRITERIA.group2, ...CRITERIA.group3].forEach((criterion) => {
  INITIAL_SCORES[criterion.id] = '';
});

const EMPTY_COMPANY_FORM = {
  companyName: '',
  placeTown: '',
  contactPerson: '',
  companyPhone: '',
  companyEmail: '',
  representativeName: '',
  representativeSignature: '',
  representativeDate: ''
};

function resolveMediaUrl(value) {
  if (!value) return '';
  const stringValue = String(value || '').trim();
  if (/^(https?:\/\/|blob:|data:)/i.test(stringValue)) return stringValue;
  if (stringValue.startsWith('/')) return `http://localhost:5000${stringValue}`;
  return stringValue;
}

function StudentCard({ intern, selected, onSelect, cardRef }) {
  const initials = String(intern?.studentName || 'S')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <button
      ref={cardRef}
      type="button"
      onClick={() => onSelect(intern?.applicationId, intern?.studentId)}
      className={`relative w-full rounded-2xl p-3 text-left transition-all duration-300 ${selected ? 'border-2 border-blue-600 bg-blue-50 shadow-lg' : 'border border-slate-200 bg-white shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:shadow-md'}`}
    >
      {intern?.hasEvaluation && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M8 13h8" />
            <path d="M8 17h8" />
          </svg>
          GRADED
        </span>
      )}
      {selected && (
        <span className="absolute right-3 top-3 rounded-full bg-blue-600 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">Now Editing</span>
      )}
      <div className="flex items-center gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border ${selected ? 'border-slate-900 bg-slate-100 text-slate-800' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
          {intern?.studentPhoto ? (
            <img
              src={resolveMediaUrl(intern.studentPhoto)}
              alt={intern?.studentName || 'Student'}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xs font-black">{initials || 'IN'}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-black">{intern?.studentName || 'Unnamed Student'}</p>
            <p className="truncate text-xs text-black/70">{intern?.studentDepartment || intern?.studentCollege || 'Department not available'}</p>
          </div>
          <p className="mt-1 truncate text-[11px] text-black/60">{intern?.internshipTitle || 'Accepted internship'}</p>
        </div>
      </div>
    </button>
  );
}

async function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function Evaluation() {
  const auth = useAuth();
  const formRef = useRef(null);
  const actionAreaRef = useRef(null);
  const activeCardRef = useRef(null);

  const [acceptedInterns, setAcceptedInterns] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [loadingTargets, setLoadingTargets] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [supervisorName, setSupervisorName] = useState('');
  const [scores, setScores] = useState(INITIAL_SCORES);
  const [companyForm, setCompanyForm] = useState(EMPTY_COMPANY_FORM);
  const [companyIdentity, setCompanyIdentity] = useState({ logoUrl: '', signatureUrl: '', hasLogo: false, hasSignature: false });
  const [studentForm, setStudentForm] = useState({
    studentName: '',
    studentIdNumber: '',
    studentSignature: '',
    studentDepartment: '',
    studentYear: '',
    studentPhone: '',
    studentEmail: ''
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('');

  useEffect(() => {
    let active = true;

    const loadTargets = async () => {
      try {
        setLoadingTargets(true);
        setError('');
        const { data } = await employerAPI.getEvaluationTargets();
        if (!active) return;

        const safeTargets = Array.isArray(data) ? data : [];
        try { console.log('Evaluation Data:', safeTargets); } catch (e) { /* ignore */ }

        const normalized = safeTargets.map((t) => ({
          applicationId: t.applicationId,
          studentId: t.studentId || t.id,
          internshipId: t.internshipId,
          studentName: t.studentName || t.full_name,
          studentPhoto: t.studentPhoto || t.photo,
          studentDepartment: t.studentDepartment || t.department,
          studentCollege: t.studentCollege || t.college,
          studentIdNumber: t.studentIdNumber || t.id_number,
          studentSignature: t.studentSignature || t.studentSignatureUrl || t.student_signature || t.student_signature_url || '',
          studentSignatureUrl: t.studentSignatureUrl || t.student_signature_url || '',
          studentEmail: t.studentEmail || '',
          studentPhone: t.studentPhone || '',
          studentYear: t.studentYear || '',
          internshipTitle: t.internshipTitle || '',
          departmentHeadName: t.departmentHeadName || '',
          departmentHeadEmail: t.departmentHeadEmail || '',
          hodFullName: t.hod_full_name || t.hodFullName || t.departmentHeadName || '',
          hodTitle: t.hod_title || t.hodTitle || '',
          universityName: t.university_name || t.universityName || 'University of Gondar',
          hasEvaluation: Boolean(t.hasEvaluation),
          evaluationId: t.evaluationId || '',
          evaluationStatus: t.evaluationStatus || 'Pending',
          evaluationScore: t.evaluationScore ?? '',
          evaluationRating: t.evaluationRating ?? '',
          evaluationComments: t.evaluationComments || '',
          evaluationCriteriaScores: t.evaluationCriteriaScores || {},
          evaluationAcceptanceForm: t.evaluationAcceptanceForm || {},
          evaluationSupervisorName: t.evaluationSupervisorName || '',
          officialPdfFileName: t.officialPdfFileName || ''
        }));

        const uniqueByStudent = Array.from(
          normalized.reduce((map, item) => {
            const studentKey = String(item.studentId || '').trim();
            if (!studentKey) {
              const fallbackKey = String(item.studentEmail || item.applicationId || '').trim();
              if (!map.has(fallbackKey)) map.set(fallbackKey, item);
            } else if (!map.has(studentKey)) {
              map.set(studentKey, item);
            }
            return map;
          }, new Map())
          .values()
        );

        setAcceptedInterns(uniqueByStudent);
        if (normalized.length > 0) {
          setSelectedId(String(normalized[0].applicationId || ''));
          setSelectedStudentId(String(normalized[0].studentId || ''));
        }
      } catch (requestError) {
        if (!active) return;
        setError(requestError?.response?.data?.message || 'Failed to load students.');
      } finally {
        if (active) setLoadingTargets(false);
      }
    };

    loadTargets();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const loadIdentity = async () => {
      try {
        const { data } = await employerAPI.getCompanyIdentity();
        setCompanyIdentity({
          logoUrl: data?.logoUrl || '',
          signatureUrl: data?.signatureUrl || '',
          hasLogo: Boolean(data?.hasLogo),
          hasSignature: Boolean(data?.hasSignature)
        });
        return;
      } catch {
        // fall through to the full profile endpoint
      }

      try {
        const { data } = await employerAPI.getProfile();
        setCompanyIdentity({
          logoUrl: data?.logoUrl || data?.logo || data?.profileImage || '',
          signatureUrl: data?.signatureUrl || '',
          hasLogo: Boolean(data?.logoUrl || data?.logo || data?.profileImage),
          hasSignature: Boolean(data?.signatureUrl)
        });
      } catch {
        setCompanyIdentity({ logoUrl: '', signatureUrl: '', hasLogo: false, hasSignature: false });
      }
    };
    loadIdentity();
  }, []);

  const departments = useMemo(() => {
    const unique = new Set();
    acceptedInterns.forEach((intern) => {
      if (intern?.studentDepartment) unique.add(intern.studentDepartment);
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [acceptedInterns]);

  const filteredInterns = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    return acceptedInterns.filter((intern) => {
      const nameMatch = String(intern?.studentName || '').toLowerCase().includes(query);
      const deptMatch = selectedDepartment ? String(intern?.studentDepartment || '') === String(selectedDepartment) : true;
      return nameMatch && deptMatch;
    });
  }, [acceptedInterns, searchQuery, selectedDepartment]);

  const selectedTarget = useMemo(
    () => acceptedInterns.find((item) => String(item?.applicationId || '') === String(selectedId)) || null,
    [acceptedInterns, selectedId]
  );

  const academicHeader = useMemo(() => buildAcademicHeader(selectedTarget), [selectedTarget]);
  const defaultDownloadFileName = useMemo(() => {
    const studentName = sanitizePdfBaseName(selectedTarget?.studentName || 'Student');
    return `${studentName}_Internship_Form.pdf`;
  }, [selectedTarget]);

  useEffect(() => {
    if (!selectedTarget) return;
    setSelectedStudentId(String(selectedTarget.studentId || ''));
    setIsSubmitted(Boolean(selectedTarget.hasEvaluation));
    setIsEditingExisting(Boolean(selectedTarget.hasEvaluation));
    setDownloadFileName(defaultDownloadFileName);

    const nextForm = normalizeEvaluationForm(selectedTarget);
    setCompanyForm(nextForm.companyForm);
    setScores(nextForm.scores);
    setSupervisorName(nextForm.supervisorName);
    setMessage('');
    setError('');

    setStudentForm({
      studentName: selectedTarget.studentName || selectedTarget.full_name || '',
      studentIdNumber: selectedTarget.id_number || selectedTarget.studentIdNumber || selectedTarget.idNumber || '',
      studentSignature: selectedTarget.student_signature || selectedTarget.studentSignature || selectedTarget.studentSignatureUrl || selectedTarget.student_signature_url || '',
      studentDepartment: selectedTarget.studentDepartment || selectedTarget.department || '',
      studentYear: selectedTarget.studentYear || '',
      studentPhone: selectedTarget.studentPhone || '',
      studentEmail: selectedTarget.studentEmail || ''
    });
  }, [selectedTarget]);

  const deptName = selectedTarget?.studentDepartment || '';

  useEffect(() => {
    if (!activeCardRef.current) return;
    activeCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [selectedStudentId, filteredInterns]);

  const deptData = useMemo(() => {
    const name = selectedTarget?.hodFullName || selectedTarget?.departmentHeadName || '[Name of HOD]';
    const title = selectedTarget?.hodTitle || `Head, Department of ${selectedTarget?.studentDepartment || deptName || '[Department Name]'}`;
    const universityName = selectedTarget?.universityName || 'University of Gondar';
    return { name, title, universityName };
  }, [selectedTarget, deptName]);

  const totalScore = useMemo(() => {
    return Object.values(scores).reduce((accumulator, value) => accumulator + (parseInt(value, 10) || 0), 0);
  }, [scores]);

  const handleSelectTarget = (applicationId, studentId) => {
    setSelectedId(String(applicationId || ''));
    setSelectedStudentId(String(studentId || ''));
    const found = acceptedInterns.find((it) => String(it.applicationId) === String(applicationId));
    if (found && !studentId) setSelectedStudentId(String(found.studentId || ''));
  };

  const hydrateExistingEvaluation = () => {
    if (!selectedTarget) return;
    const nextForm = normalizeEvaluationForm(selectedTarget);
    setCompanyForm(nextForm.companyForm);
    setScores(nextForm.scores);
    setSupervisorName(nextForm.supervisorName);
    setIsSubmitted(false);
    setIsEditingExisting(Boolean(selectedTarget.hasEvaluation));
    setMessage('');
    setError('');
  };

  const handleEditEvaluation = () => {
    hydrateExistingEvaluation();
  };

  const handleScoreChange = (id, value, max) => {
    let next = parseInt(value, 10);
    if (Number.isNaN(next)) next = '';
    if (next !== '' && next > max) next = max;
    if (next !== '' && next < 0) next = 0;
    setScores((previous) => ({ ...previous, [id]: next }));
  };

  const updateCompanyField = (field, value) => {
    setCompanyForm((prev) => ({ ...prev, [field]: value }));
  };

  const formatFileName = (name) => {
    const safeName = String(name || 'student').replace(/[^a-zA-Z0-9-_ ]+/g, '').replace(/\s+/g, '_');
    const dateSuffix = new Date().toISOString().slice(0, 10);
    return `${safeName}_Evaluation_${dateSuffix}.pdf`;
  };

  const generatePdfBlob = async () => {
    if (!formRef.current) return null;
    const { pdf } = await buildPdfDocument(formRef.current);
    return pdf.output('blob');
  };

  const handleLocalDownload = () => {
    setDownloadFileName((previous) => previous || defaultDownloadFileName);
    setShowDownloadModal(true);
    setError('');
  };

  const handleConfirmLocalDownload = async () => {
    setIsProcessing(true);
    setError('');
    try {
      if (!formRef.current) {
        throw new Error('Form not found.');
      }

      const fileName = ensurePdfExtension(sanitizePdfBaseName(downloadFileName || defaultDownloadFileName));

      const { pdf } = await buildPdfDocument(formRef.current);
      pdf.save(fileName);

      setMessage('PDF downloaded successfully for local record keeping.');
      setShowDownloadModal(false);
    } catch (err) {
      const errorText = String(err?.message || '').toLowerCase();
      if (errorText.includes('oklch') || errorText.includes('oklab') || errorText.includes('styling') || errorText.includes('unsupported color')) {
        setError('PDF generation failed due to a styling error. Please try again after the fallback styles are applied.');
      } else {
        setError(err.message || 'Failed to download PDF. Please try again.');
      }
      console.error('Download error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const syncOfficialPdfAfterSubmission = async ({ evaluationId, fileName }) => {
    if (!evaluationId || !formRef.current) return;

    try {
      const { pdf } = await buildPdfDocument(formRef.current);
      const pdfBlob = pdf.output('blob');
      if (!pdfBlob) {
        throw new Error('PDF generation failed.');
      }

      const officialPdfBase64 = await blobToDataUrl(pdfBlob);
      await employerAPI.updateEvaluationOfficialPdf(evaluationId, {
        officialPdfBase64,
        officialPdfFileName: fileName
      });
    } catch (pdfError) {
      setIsProcessing(false);
      const messageText = String(pdfError?.message || '').toLowerCase();
      if (messageText.includes('oklch') || messageText.includes('oklab') || messageText.includes('styling') || messageText.includes('unsupported color')) {
        setMessage('PDF generation failed due to a styling error, but your data has been submitted successfully.');
      } else {
        setMessage('Your data has been submitted successfully, but the PDF could not be prepared automatically.');
      }
      console.error('Official PDF sync error:', pdfError);
    }
  };

  const handleSubmitToHOD = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    setShowSuccessModal(false);

    if (!selectedTarget) {
      setError('Please choose a student to continue.');
      setSubmitting(false);
      return;
    }

    try {
      const buttonContainer = document.querySelector('[data-pdf-exclude="true"]');
      if (buttonContainer) buttonContainer.style.display = 'none';

      let latestIdentity = null;
      try {
        const { data } = await employerAPI.getCompanyIdentity();
        latestIdentity = data;
      } catch {
        const { data } = await employerAPI.getProfile();
        latestIdentity = {
          logoUrl: data?.logoUrl || data?.logo || data?.profileImage || '',
          signatureUrl: data?.signatureUrl || '',
          hasLogo: Boolean(data?.logoUrl || data?.logo || data?.profileImage),
          hasSignature: Boolean(data?.signatureUrl)
        };
      }

      const resolvedIdentity = {
        logoUrl: latestIdentity?.logoUrl || latestIdentity?.logo || latestIdentity?.profileImage || '',
        signatureUrl: latestIdentity?.signatureUrl || '',
        hasLogo: Boolean(latestIdentity?.hasLogo),
        hasSignature: Boolean(latestIdentity?.hasSignature)
      };

      setCompanyIdentity(resolvedIdentity);

      if (!resolvedIdentity.logoUrl || !resolvedIdentity.signatureUrl) {
        throw new Error('Company logo and digital signature are missing in the database. Please save them in Settings first.');
      }

      const submitResponse = await employerAPI.submitEvaluation({
        applicationId: selectedTarget.applicationId,
        studentId: selectedStudentId || selectedTarget.studentId,
        internshipId: selectedTarget.internshipId,
        performanceRating: Math.max(1, Math.round(totalScore / 20)),
        comments: `Official Internship documents submitted. Total evaluation score: ${totalScore}/100`,
        score: totalScore,
        supervisorName,
        criteriaScores: scores,
        acceptanceForm: companyForm
      });

      const responseData = submitResponse?.data || {};
      const responseStatus = Number(submitResponse?.status || 0);
      if (![200, 201].includes(responseStatus) || responseData?.success === false) {
        throw new Error(responseData?.message || 'Failed to submit documents.');
      }

      const savedEvaluationId = responseData?.evaluation?._id || responseData?.evaluation?.id || '';
      const responseMessage = responseData?.message || 'Evaluation Submitted Successfully! HOD has been notified.';

      const officialPdfFileName = `uog-internship-doc-${selectedTarget?.studentName || 'student'}-${Date.now()}.pdf`;

      setAcceptedInterns((prev) =>
        prev.map((intern) =>
          String(intern.studentId) === String(selectedStudentId || selectedTarget.studentId)
            ? {
                ...intern,
                hasEvaluation: true,
                isSubmitted: true,
                evaluationStatus: 'GRADED',
                evaluationId: savedEvaluationId || intern.evaluationId || '',
                evaluationScore: totalScore,
                evaluationRating: Math.max(1, Math.round(totalScore / 20)),
                evaluationComments: `Official Internship documents submitted. Total evaluation score: ${totalScore}/100`
              }
            : intern
        )
      );

      setSelectedId(String(selectedTarget.applicationId || ''));
      setSelectedStudentId(String(selectedTarget.studentId || selectedStudentId || ''));

      setIsEditingExisting(false);
      if (buttonContainer) buttonContainer.style.display = 'flex';
      setIsSubmitted(true);
      setShowSuccessModal(true);
      setMessage(`Success! Evaluation for ${selectedTarget?.studentName || 'the student'} has been officially submitted to the HOD.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.requestAnimationFrame(() => {
        actionAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });

      window.setTimeout(() => {
        void syncOfficialPdfAfterSubmission({
          evaluationId: savedEvaluationId,
          fileName: officialPdfFileName
        });
      }, 0);
    } catch (requestError) {
      if (document.querySelector('[data-pdf-exclude="true"]')) {
        document.querySelector('[data-pdf-exclude="true"]').style.display = 'flex';
      }
      setMessage('');
      setError(requestError?.response?.data?.message || requestError.message || 'Failed to submit documents.');
      console.error('Submit error:', requestError);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 lg:px-6 lg:h-[calc(100vh-7rem)] lg:overflow-hidden text-black" style={{ fontFamily: 'Times New Roman, serif' }}>
      <style>{PDF_PRINT_STYLES}</style>

      {showDownloadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.35)]">
            <h3 className="text-2xl font-black text-black">Download PDF</h3>
            <p className="mt-2 text-sm font-semibold text-slate-600">
              Do you want to download this document? You can choose a filename below.
            </p>

            <label className="mt-5 block text-sm font-black uppercase tracking-[0.15em] text-slate-700">
              Filename
              <input
                type="text"
                value={downloadFileName}
                onChange={(event) => setDownloadFileName(event.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm font-semibold text-black outline-none transition focus:border-slate-500 focus:bg-white"
                placeholder={defaultDownloadFileName}
              />
            </label>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDownloadModal(false)}
                className="rounded-xl border border-slate-300 px-5 py-3 font-black text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirmLocalDownload}
                disabled={isProcessing}
                className="rounded-xl bg-slate-900 px-5 py-3 font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? 'Downloading...' : 'Confirm Download'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showSuccessModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-lg rounded-[28px] border border-emerald-200 bg-white p-8 text-center shadow-[0_30px_80px_rgba(15,23,42,0.25)]">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h3 className="mt-5 text-2xl font-black text-black">Successfully Sent!</h3>
            <p className="mt-3 text-sm font-bold leading-6 text-black">
              Success! Evaluation for {selectedTarget?.studentName || 'the student'} has been officially submitted to the HOD.
            </p>
            <button
              type="button"
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 rounded-xl bg-emerald-600 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white hover:bg-emerald-700"
            >
              Close
            </button>
          </div>
        </div>
      ) : null}

      {error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

      {loadingTargets && <p className="text-sm text-black">Loading accepted interns...</p>}
      {!loadingTargets && acceptedInterns.length === 0 && (
        <p className="rounded-xl border border-dashed border-black bg-white px-4 py-6 text-sm text-black">
          No active interns found. Once you accept a student and their status becomes PLACED, they will appear here.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:h-full lg:grid-cols-[360px_minmax(0,1fr)]">
        {!loadingTargets && acceptedInterns.length > 0 && (
          <aside className="print:hidden lg:self-start lg:h-full lg:overflow-hidden" style={{ position: 'sticky', top: '20px' }}>
            <div className="flex h-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
                      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <h2 className="text-[13px] font-black uppercase tracking-[0.2em] text-slate-800">
                    Accepted Interns ({filteredInterns.length} of {acceptedInterns.length})
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-black/70">Search or filter to find a student quickly.</p>
                </div>
                <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
                  <div className="relative">
                    <svg className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="7" />
                      <path d="M21 21l-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by student name..."
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                    />
                  </div>
                  <div className="mt-4 relative">
                    <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6h16" />
                        <path d="M4 12h12" />
                        <path d="M4 18h8" />
                      </svg>
                    </div>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => setSelectedDepartment(e.target.value)}
                      aria-label="Filter by Department"
                      className="w-full rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none ring-0 transition focus:border-slate-400 focus:bg-white"
                    >
                      <option value="">All Departments</option>
                      {departments.map((department) => (
                        <option key={department} value={department}>{department}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                  {filteredInterns.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                      No matching interns found.
                    </div>
                  ) : (
                    filteredInterns.map((intern) => (
                      <StudentCard
                        key={intern.studentId || intern.applicationId}
                        intern={intern}
                        selected={Boolean(intern.studentId) && String(intern.studentId) === String(selectedStudentId)}
                        onSelect={handleSelectTarget}
                        cardRef={Boolean(intern.studentId) && String(intern.studentId) === String(selectedStudentId) ? activeCardRef : undefined}
                      />
                    ))
                  )}
                </div>
            </div>
          </aside>
        )}

        {selectedTarget && (
          <form onSubmit={handleSubmitToHOD} className="min-w-0 lg:h-full lg:overflow-y-auto">
            <div ref={formRef} data-pdf-paper="true" className="space-y-10 rounded-[32px] bg-white p-4 pb-32 shadow-[0_20px_70px_rgba(0,0,0,0.08)] lg:p-8 lg:pb-32">
              {isSubmitted ? (
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800">
                  Evaluation already submitted. You can view the official document below.
                </div>
              ) : null}

              <Card className="border-2 border-black bg-white p-10 font-serif text-black shadow-xl print:shadow-none print:border-none">
                <div className="mb-8 flex items-start gap-4">
                  <img src="/uog-logo.jpg" alt="University of Gondar Logo" className="h-16 w-16 object-contain" />
                  <div className="flex-1 text-center">
                    <h1 className="text-3xl font-black">University of Gondar</h1>
                    {academicHeader.hasAcademicInfo ? (
                      <>
                        <h2 className="mt-1 text-2xl font-black">{academicHeader.college}</h2>
                        <h3 className="mt-1 text-2xl font-black">{academicHeader.department}</h3>
                      </>
                    ) : (
                      <h2 className="mt-1 text-2xl font-black">{academicHeader.fallback}</h2>
                    )}
                    <h4 className="mt-2 text-2xl font-black underline">Internship Acceptance Form</h4>
                  </div>
                  <div className="w-16" />
                </div>

                <div className="space-y-8 text-[18px]">
                  <section>
                    <p className="text-xl font-black underline">To be filled by the student</p>
                    <div className="mt-4 grid grid-cols-[1fr_140px] gap-6">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-black">Name of student:</span>
                          <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                            <span className="font-semibold leading-none">{studentForm.studentName || '____________________'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-black">ID.No:</span>
                          <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                            <span className="font-semibold select-none leading-none">{studentForm.studentIdNumber || '____________________'}</span>
                          </div>
                        </div>
                        <div><span className="font-black">Department/ program:</span> <span className="font-black underline select-none">{studentForm.studentDepartment || '____________________'}</span></div>
                        <div><span className="font-black">Year/ Semester:</span> <span className="font-black underline select-none">{studentForm.studentYear || '____________________'}</span></div>
                        <div className="flex flex-col gap-1">
                          <span className="font-black">Phone Number:</span>
                          <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                            <span className="font-semibold select-none leading-none">{studentForm.studentPhone || '____________________'}</span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="font-black">Email:</span>
                          <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                            <span className="font-semibold select-none leading-none">{studentForm.studentEmail || '____________________'}</span>
                          </div>
                        </div>
                        <div className="col-span-2 border-b border-black pb-1">
                          <span className="font-black">Signature:</span>{' '}
                          {studentForm.studentSignature ? (
                            <img
                              src={resolveMediaUrl(studentForm.studentSignature)}
                              alt="Student Signature"
                              className="mt-1 h-12 max-h-12 w-full max-w-[18rem] object-contain object-left pointer-events-none"
                              style={{ backgroundColor: 'transparent' }}
                            />
                          ) : (
                            <span className="italic text-slate-600">(Waiting for student signature)</span>
                          )}
                        </div>
                      </div>
                      <div className="h-36 w-full overflow-hidden rounded-lg border border-black bg-white">
                        {selectedTarget.studentPhoto ? (
                          <img src={resolveMediaUrl(selectedTarget.studentPhoto)} alt="Student" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-black text-black/60">Student Photo</div>
                        )}
                      </div>
                    </div>
                  </section>

                  <section>
                    <p className="text-xl font-black underline">To be filled by the company</p>
                    <div className="mt-4 space-y-4">
                      <div className="border-b border-black pb-1"><span className="font-black">Company name:</span> <input readOnly={isSubmitted} value={companyForm.companyName} onChange={(e) => updateCompanyField('companyName', e.target.value)} className="w-[70%] bg-transparent px-1 font-semibold outline-none" /></div>
                      <div className="flex flex-col gap-1">
                        <span className="font-black">Place/town:</span>
                        <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                          <input readOnly={isSubmitted} value={companyForm.placeTown} onChange={(e) => updateCompanyField('placeTown', e.target.value)} className="w-full bg-transparent px-1 pb-1 pt-1 font-semibold outline-none" />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="font-black">Contact person:</span>
                        <div className="min-h-[2.5rem] border-b-2 border-black pb-1">
                          <input readOnly={isSubmitted} value={companyForm.contactPerson} onChange={(e) => updateCompanyField('contactPerson', e.target.value)} className="w-full bg-transparent px-1 pb-1 pt-1 font-semibold outline-none" />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-8">
                        <div className="border-b border-black pb-1"><span className="font-black">Phone Number:</span> <input readOnly={isSubmitted} value={companyForm.companyPhone} onChange={(e) => updateCompanyField('companyPhone', e.target.value)} className="w-[58%] bg-transparent px-1 font-semibold outline-none" /></div>
                        <div className="border-b border-black pb-1"><span className="font-black">Email:</span> <input readOnly={isSubmitted} value={companyForm.companyEmail} onChange={(e) => updateCompanyField('companyEmail', e.target.value)} className="w-[74%] bg-transparent px-1 font-semibold outline-none" /></div>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4 leading-relaxed">
                    <p>
                      I, on behalf of {companyForm.companyName || '___________________'} (Company Name), confirm the Acceptance of the aforementioned student as an intern for the designated amount of time (i.e. for at least 200 hours for Two- months).
                    </p>
                    <p>
                      {selectedTarget?.departmentHeadEmail ? (
                        <>After completing this form, please email it to <span className="font-bold underline">{selectedTarget.departmentHeadEmail}</span> or hand it over to the student.</>
                      ) : loadingTargets ? (
                        <span className="inline-flex items-center gap-2 text-slate-600 font-semibold">
                          <span>Fetching HOD Email</span>
                          <span className="inline-block w-1.5 h-1.5 bg-slate-400 rounded-full animate-pulse"></span>
                        </span>
                      ) : (
                        <>After completing this form, please contact the University Internship Coordinator for the official HOD email or hand it over to the student.</>
                      )}
                    </p>
                  </section>

                  <section className="grid grid-cols-3 gap-8">
                    <div>
                      <p className="font-black">Name:</p>
                      <div className="mt-2 border-b border-black pb-1">
                        <input readOnly={isSubmitted} value={companyForm.representativeName} onChange={(e) => updateCompanyField('representativeName', e.target.value)} className="w-full bg-transparent font-semibold outline-none" />
                      </div>
                    </div>
                    <div>
                      <p className="font-black">Signature:</p>
                      <div className="mt-2 border-b border-black pb-1">
                        {companyIdentity?.signatureUrl ? (
                          <img src={companyIdentity.signatureUrl} alt="Digital Signature" className="h-12 w-full object-contain object-left" style={{ backgroundColor: 'transparent' }} />
                        ) : (
                          <span className="font-semibold">____________________</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-black">Date:</p>
                      <div className="mt-2 border-b border-black pb-1">
                        <input readOnly={isSubmitted} value={companyForm.representativeDate} onChange={(e) => updateCompanyField('representativeDate', e.target.value)} className="w-full bg-transparent font-semibold outline-none" placeholder={new Date().toLocaleDateString()} />
                      </div>
                    </div>
                  </section>
                </div>
              </Card>

              <div className="pdf-page-break-before" style={{ breakBefore: 'page', pageBreakBefore: 'always' }} />

              <Card className="border-2 border-black bg-white p-10 font-serif text-black shadow-xl print:shadow-none print:border-none">
                <div className="text-center mb-10 border-b-2 border-black pb-6">
                  <h1 className="text-2xl font-black uppercase tracking-wider">UNIVERSITY OF GONDAR</h1>
                  {academicHeader.hasAcademicInfo ? (
                    <h2 className="mt-2 text-xl font-black">{academicHeader.college}, {academicHeader.department}</h2>
                  ) : (
                    <h2 className="mt-2 text-xl font-black">{academicHeader.fallback}</h2>
                  )}
                  <h3 className="mt-4 text-lg font-black uppercase underline">OFFICIAL INTERNSHIP EVALUATION FORM</h3>
                </div>

                <div className="mb-8 font-sans text-black">
                  <h4 className="mb-4 text-sm font-black uppercase underline">Student Information</h4>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm font-semibold">
                    <div className="border-b border-black pb-1"><span className="font-black">Name:</span> {selectedTarget.studentName || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">ID.No:</span> {selectedTarget.studentIdNumber || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Department:</span> {selectedTarget.studentDepartment || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Phone:</span> {selectedTarget.studentPhone || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Email:</span> {selectedTarget.studentEmail || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Year/Semester:</span> {selectedTarget.studentYear || '________'}</div>
                  </div>
                </div>

                <div className="mb-8 font-sans text-black">
                  <div className="mb-4 flex items-start justify-between">
                    <h4 className="mt-2 text-sm font-black uppercase underline">To be filled by the company</h4>
                    <div className="h-24 w-24 overflow-hidden rounded-lg border border-black bg-white text-xs font-bold text-black flex items-center justify-center">
                      {companyIdentity?.logoUrl ? (
                        <img
                          src={companyIdentity.logoUrl}
                          alt="Company Logo"
                          className="h-full w-full object-contain"
                          onError={(e) => { e.target.onerror = null; }}
                        />
                      ) : 'Company Logo'}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm font-semibold">
                    <div className="border-b border-black pb-1"><span className="font-black">Supervisor Name:</span> <input readOnly={isSubmitted} value={supervisorName} onChange={(e) => setSupervisorName(e.target.value)} className="w-[60%] bg-transparent font-semibold outline-none" placeholder="Enter your full name" /></div>
                    <div className="border-b border-black pb-1"><span className="font-black">Date:</span> {new Date().toLocaleDateString()}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Company Name:</span> {companyForm.companyName || '________'}</div>
                    <div className="border-b border-black pb-1"><span className="font-black">Contact Person:</span> {companyForm.contactPerson || '________'}</div>
                  </div>
                </div>

                <div className="mb-8 border border-black font-sans text-sm text-black">
                  <div className="flex border-b border-black bg-white font-black">
                    <div className="w-3/4 border-r border-black p-2">Criterion</div>
                    <div className="w-1/4 p-2 text-center">Max points</div>
                  </div>

                  <div className="border-b border-black bg-white p-2 font-black italic">Group 1: Professional Qualifications (42%)</div>
                  {CRITERIA.group1.map((criterion) => (
                    <div key={criterion.id} className="flex border-b border-black">
                      <div className="w-3/4 border-r border-black p-2 pl-4 font-semibold">{criterion.label}</div>
                      <div className="w-1/4 p-1 flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max={criterion.max}
                          value={scores[criterion.id]}
                          onChange={(e) => handleScoreChange(criterion.id, e.target.value, criterion.max)}
                          readOnly={isSubmitted}
                          className="w-12 border-b border-black bg-transparent text-center font-black text-black outline-none"
                          required
                        />
                        <span className="ml-1 font-semibold">/{criterion.max}</span>
                      </div>
                    </div>
                  ))}

                  <div className="border-b border-black border-t-2 border-t-black bg-white p-2 font-black italic">Group 2: Technical Skills (28%)</div>
                  {CRITERIA.group2.map((criterion) => (
                    <div key={criterion.id} className="flex border-b border-black">
                      <div className="w-3/4 border-r border-black p-2 pl-4 font-semibold">{criterion.label}</div>
                      <div className="w-1/4 p-1 flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max={criterion.max}
                          value={scores[criterion.id]}
                          onChange={(e) => handleScoreChange(criterion.id, e.target.value, criterion.max)}
                          readOnly={isSubmitted}
                          className="w-12 border-b border-black bg-transparent text-center font-black text-black outline-none"
                          required
                        />
                        <span className="ml-1 font-semibold">/{criterion.max}</span>
                      </div>
                    </div>
                  ))}

                  <div className="border-b border-black border-t-2 border-t-black bg-white p-2 font-black italic">Group 3: Interpersonal and Teamwork Skills (30%)</div>
                  {CRITERIA.group3.map((criterion) => (
                    <div key={criterion.id} className="flex border-b border-black">
                      <div className="w-3/4 border-r border-black p-2 pl-4 font-semibold">{criterion.label}</div>
                      <div className="w-1/4 p-1 flex items-center justify-center">
                        <input
                          type="number"
                          min="0"
                          max={criterion.max}
                          value={scores[criterion.id]}
                          onChange={(e) => handleScoreChange(criterion.id, e.target.value, criterion.max)}
                          readOnly={isSubmitted}
                          className="w-12 border-b border-black bg-transparent text-center font-black text-black outline-none"
                          required
                        />
                        <span className="ml-1 font-semibold">/{criterion.max}</span>
                      </div>
                    </div>
                  ))}

                  <div className="flex border-t-2 border-black bg-white font-black">
                    <div className="w-3/4 border-r border-black p-2 text-right uppercase tracking-wider">Total Result (100%)</div>
                    <div className="w-1/4 p-2 text-center text-3xl">{totalScore}</div>
                  </div>
                </div>

                <div className="space-y-8 font-sans text-sm text-black">
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="mb-6 font-black">Supervisor Name and Signature</p>
                      <div className="w-64 border-b border-black pb-1">
                        {companyIdentity?.signatureUrl ? (
                          <img src={companyIdentity.signatureUrl} alt="Digital Signature" className="h-12 w-full object-contain object-left" style={{ backgroundColor: 'transparent' }} />
                        ) : (
                          <div className="text-center italic">__________________</div>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="mb-6 font-black">Date of evaluation</p>
                      <div className="w-48 border-b border-black pb-1 text-center font-black">{new Date().toLocaleDateString()}</div>
                    </div>
                  </div>

                  <div className="pt-8 text-center">
                    <p className="text-lg font-black">Thank You</p>
                    <p className="mt-4 text-2xl font-black">{deptData.name}</p>
                    <p className="text-xl font-bold">{deptData.title}</p>
                    <p className="text-xl font-bold">{deptData.universityName}</p>
                  </div>
                </div>
              </Card>

              <div
                ref={actionAreaRef}
                data-pdf-exclude="true"
                className="relative z-10 mt-12 flex min-h-[96px] flex-shrink-0 flex-col gap-4 border-t-2 border-black pt-8 print:hidden lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-h-[48px] max-w-md">
                  {isSubmitted ? (
                    <div className="inline-flex min-h-[48px] items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-emerald-700">
                      Successfully Submitted
                    </div>
                  ) : (
                    <p className="max-w-md text-sm font-semibold italic text-black">
                      By submitting this document, you confirm that the evaluation data is correct and ready for official record keeping.
                    </p>
                  )}
                </div>
                <div className="flex min-h-[56px] shrink-0 items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleLocalDownload}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-100 px-6 py-3 font-black text-black shadow-sm transition hover:border-yellow-400 hover:bg-yellow-200 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProcessing ? (
                      <>
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        <span className="font-black text-black">Processing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3v12" />
                          <path d="M7 10l5 5 5-5" />
                          <path d="M5 21h14" />
                        </svg>
                        <span className="font-black text-black">Download PDF</span>
                      </>
                    )}
                  </Button>
                  {isSubmitted ? (
                    <>
                      <Button
                        type="button"
                        disabled
                        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 font-black text-white shadow-sm opacity-90"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4L19 7" />
                        </svg>
                        <span>Submitted ✅</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={handleEditEvaluation}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-8 py-3 font-black text-white shadow-sm transition hover:bg-slate-800 hover:shadow-md"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                        <span>Edit Evaluation</span>
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-8 py-3 font-black text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {submitting ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span>{isEditingExisting ? 'Updating...' : 'Processing...'}</span>
                        </>
                      ) : (
                        <>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 2L11 13" />
                            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
                          </svg>
                          <span>{isEditingExisting ? 'Update & Resubmit' : 'Submit to HOD'}</span>
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
