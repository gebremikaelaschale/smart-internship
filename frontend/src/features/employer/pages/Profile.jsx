import React, { useEffect, useRef, useState } from 'react';
import Select from 'react-select';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import Modal from '@/components/common/Modal';
import useAuth from '@/hooks/useAuth';
import { employerAPI } from '../employerAPI';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Resolve backend origin for serving uploaded files.
// Priority: VITE_API_BASE_URL env → window.location-based fallback → relative path (Vite proxy)
const BACKEND_ORIGIN = (() => {
  const raw = import.meta.env.VITE_API_BASE_URL || '';
  if (raw) {
    try {
      const u = new URL(raw);
      return u.origin; // e.g. "http://localhost:5000"
    } catch { /* ignore */ }
  }
  // Fallback: if frontend is on port 5173/3000, backend is on 5000
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:5000`;
  }
  return 'http://localhost:5000';
})();

/** Build a full URL for a server-side file path like /uploads/company_docs/doc-xxx.pdf */
const resolveFileUrl = (serverPath) => {
  if (!serverPath) return '';
  if (serverPath.startsWith('data:')) return serverPath; // DataURL - already complete
  if (serverPath.startsWith('http')) return serverPath;  // Already absolute
  // serverPath is like /uploads/company_docs/doc-xxx.pdf → prepend backend origin
  return `${BACKEND_ORIGIN}${serverPath}`;
};

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

const DEPARTMENT_OPTIONS = [
  {
    label: 'Engineering & Technology',
    options: [
      { value: 'Computer Science', label: 'Computer Science' },
      { value: 'Software Engineering', label: 'Software Engineering' },
      { value: 'Information Systems', label: 'Information Systems' },
      { value: 'Information Technology (IT)', label: 'Information Technology (IT)' },
      { value: 'Civil Engineering', label: 'Civil Engineering' },
      { value: 'Electrical & Computer Engineering', label: 'Electrical & Computer Engineering' },
      { value: 'Mechanical Engineering', label: 'Mechanical Engineering' },
      { value: 'Architecture', label: 'Architecture' },
      { value: 'Hydraulic & Water Resources Engineering', label: 'Hydraulic & Water Resources Engineering' },
      { value: 'Construction Technology & Management', label: 'Construction Technology & Management' },
      { value: 'Chemical Engineering', label: 'Chemical Engineering' }
    ]
  },
  {
    label: 'Business & Economics',
    options: [
      { value: 'Accounting & Finance', label: 'Accounting & Finance' },
      { value: 'Business Management', label: 'Business Management' },
      { value: 'Economics', label: 'Economics' },
      { value: 'Marketing Management', label: 'Marketing Management' },
      { value: 'Public Administration', label: 'Public Administration' },
      { value: 'Logistics & Supply Chain Management', label: 'Logistics & Supply Chain Management' },
      { value: 'Tourism & Hotel Management', label: 'Tourism & Hotel Management' }
    ]
  },
  {
    label: 'Health & Medical Sciences',
    options: [
      { value: 'Medicine (MD)', label: 'Medicine (MD)' },
      { value: 'Public Health (Health Officer)', label: 'Public Health (Health Officer)' },
      { value: 'Nursing', label: 'Nursing' },
      { value: 'Pharmacy', label: 'Pharmacy' },
      { value: 'Midwifery', label: 'Midwifery' },
      { value: 'Medical Laboratory Science', label: 'Medical Laboratory Science' },
      { value: 'Environmental Health', label: 'Environmental Health' },
      { value: 'Anesthesia', label: 'Anesthesia' }
    ]
  },
  {
    label: 'Agriculture & Environmental Sciences',
    options: [
      { value: 'Plant Science', label: 'Plant Science' },
      { value: 'Animal Science', label: 'Animal Science' },
      { value: 'Natural Resource Management', label: 'Natural Resource Management' },
      { value: 'Agri-Business & Value Chain Management', label: 'Agri-Business & Value Chain Management' },
      { value: 'Veterinary Medicine', label: 'Veterinary Medicine' }
    ]
  },
  {
    label: 'Natural & Computational Sciences',
    options: [
      { value: 'Mathematics', label: 'Mathematics' },
      { value: 'Statistics', label: 'Statistics' },
      { value: 'Physics', label: 'Physics' },
      { value: 'Chemistry', label: 'Chemistry' },
      { value: 'Biology', label: 'Biology' },
      { value: 'Geology', label: 'Geology' }
    ]
  },
  {
    label: 'Social Sciences & Humanities',
    options: [
      { value: 'Law (Jurisprudence)', label: 'Law (Jurisprudence)' },
      { value: 'Psychology', label: 'Psychology' },
      { value: 'Sociology', label: 'Sociology' },
      { value: 'English Language & Literature', label: 'English Language & Literature' },
      { value: 'Journalism & Communication', label: 'Journalism & Communication' },
      { value: 'Political Science & International Relations', label: 'Political Science & International Relations' }
    ]
  }
];

const FACILITY_OPTIONS = [
  'Pocket Money / Stipend', 'Transport Service', 'Cafeteria / Lunch', 'Training & Mentorship', 'Certificate of Completion', 'Job Opportunity'
];

const INDUSTRY_OPTIONS = [
  'Finance & Banking', 'IT & Software', 'Manufacturing', 'Health & Medical', 'NGO / Non-Profit',
  'Construction & Real Estate', 'Education', 'Agriculture', 'Telecommunications', 'Logistics & Transport', 'Other'
];

const LOCATION_OPTIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Dire Dawa', 'Gambela', 'Harari',
  'Oromia', 'Sidama', 'Somali', 'South Ethiopia', 'Central Ethiopia', 'South West Ethiopia', 'Tigray'
];

export default function EmployerProfile() {
  const auth = useAuth();
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);
  const docInputRef = useRef(null);
  const licenseInputRef = useRef(null); // Ref for license file input

  const [form, setForm] = useState({
    companyName: '',
    officialEmail: '',
    phone: '',
    website: '',
    hqLocation: '',
    industryType: '',
    companySize: '',
    foundedYear: '',
    description: '',
    representativeName: '',
    representativePosition: '',
    logo: '',
    coverImage: '',
    businessLicenseUrl: '',
    targetDepartments: [],
    internshipFacilities: [],
    branches: [],
    requiredSkills: [],
    businessLicenseFile: null,
    intakeCapacity: '',
    focalName: '',
    focalEmail: '',
    focalPhone: '',
    internshipPeriod: '',
    internshipDuration: '',
    minimumCgpa: '',
    expectedTasks: ''
  });
  const [selectedCollege, setSelectedCollege] = useState(null);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [verification, setVerification] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [dragTarget, setDragTarget] = useState('');
  const [licenseFileName, setLicenseFileName] = useState('');
  const [logoCropOpen, setLogoCropOpen] = useState(false);
  const [logoCropSource, setLogoCropSource] = useState('');
  const [logoCropZoom, setLogoCropZoom] = useState(1.25);
  const [logoCropOffset, setLogoCropOffset] = useState({ x: 0, y: 0 });
  const [logoCropDragging, setLogoCropDragging] = useState(false);
  const [logoCropDragStart, setLogoCropDragStart] = useState({ x: 0, y: 0 });

  const previewLogo = form.logo || '';
  const previewCover = form.coverImage || '';

  const optimizeImageFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 640;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Image processing is not supported in this browser.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });

  const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });

  const createSquareCroppedImage = (source, zoom = 1, offset = { x: 0, y: 0 }, previewSize = 208) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const safeZoom = Math.max(1, Math.min(3, Number(zoom || 1)));
      const minSide = Math.min(img.width, img.height);
      const cropSide = Math.max(1, Math.round(minSide / safeZoom));
      const centerX = Math.floor((img.width - cropSide) / 2);
      const centerY = Math.floor((img.height - cropSide) / 2);

      const safeOffsetX = Number(offset?.x || 0);
      const safeOffsetY = Number(offset?.y || 0);
      const normalizedX = Math.max(-1, Math.min(1, safeOffsetX / Math.max(1, previewSize / 2)));
      const normalizedY = Math.max(-1, Math.min(1, safeOffsetY / Math.max(1, previewSize / 2)));

      const maxPanX = Math.max(0, Math.floor((img.width - cropSide) / 2));
      const maxPanY = Math.max(0, Math.floor((img.height - cropSide) / 2));
      const panX = Math.round(normalizedX * maxPanX);
      const panY = Math.round(normalizedY * maxPanY);

      const sx = Math.max(0, Math.min(img.width - cropSide, centerX + panX));
      const sy = Math.max(0, Math.min(img.height - cropSide, centerY + panY));

      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Image processing is not supported in this browser.'));
        return;
      }

      ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, 512, 512);
      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => reject(new Error('Invalid image file.'));
    img.src = source;
  });

  const validateImageFile = (file) => {
    if (!file) return 'No file selected.';
    if (!String(file.type || '').startsWith('image/')) {
      return 'Please choose an image file.';
    }
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      return 'Use JPG, PNG, or WEBP image formats.';
    }
    if (Number(file.size || 0) > MAX_IMAGE_BYTES) {
      return 'Image must be 4MB or smaller.';
    }
    return '';
  };

  const syncSession = (nextData, nextForm) => {
    if (!(auth?.setSession && auth?.user)) return;
    auth.setSession({
      user: {
        ...auth.user,
        fullName: nextData?.companyName || nextForm.companyName,
        name: nextData?.companyName || nextForm.companyName,
        email: nextData?.officialEmail || nextForm.officialEmail || auth.user?.email,
        profilePicUrl: nextData?.logo || nextForm.logo || ''
      },
      token: auth.token
    });
  };

  const saveProfile = async (nextForm, successText = 'Company profile updated successfully.') => {
    const formData = new FormData();
    
    // Basic fields
    formData.append('companyName', nextForm.companyName);
    formData.append('officialEmail', nextForm.officialEmail);
    formData.append('phone', nextForm.phone);
    formData.append('website', nextForm.website);
    formData.append('hqLocation', nextForm.hqLocation);
    formData.append('industryType', nextForm.industryType);
    formData.append('companySize', nextForm.companySize || '');
    if (nextForm.foundedYear) formData.append('foundedYear', nextForm.foundedYear);
    formData.append('description', nextForm.description);
    
    // Representative fields (sent as separate fields for easy backend parsing)
    formData.append('representativeName', nextForm.representativeName);
    formData.append('representativePosition', nextForm.representativePosition);
    
    // Images (DataURLs)
    formData.append('logo', nextForm.logo);
    formData.append('coverImage', nextForm.coverImage);
    
    // File upload (The "real" connection)
    if (nextForm.businessLicenseFile) {
      formData.append('businessLicense', nextForm.businessLicenseFile);
    } else {
      formData.append('businessLicenseUrl', nextForm.businessLicenseUrl);
    }

    // Arrays (sent as comma-separated strings)
    formData.append('targetDepartments', nextForm.targetDepartments.join(','));
    formData.append('internshipFacilities', nextForm.internshipFacilities.join(','));
    formData.append('branches', nextForm.branches.join(','));
    formData.append('requiredSkills', nextForm.requiredSkills.join(','));

    // AI Matching & Placement Fields
    formData.append('intakeCapacity', nextForm.intakeCapacity || '');
    formData.append('internshipPeriod', nextForm.internshipPeriod || '');
    formData.append('internshipDuration', nextForm.internshipDuration || '');
    formData.append('minimumCgpa', nextForm.minimumCgpa || '');
    formData.append('expectedTasks', nextForm.expectedTasks || '');
    
    // Focal Person
    formData.append('focalName', nextForm.focalName || '');
    formData.append('focalEmail', nextForm.focalEmail || '');
    formData.append('focalPhone', nextForm.focalPhone || '');

    const { data } = await employerAPI.updateProfile(formData);
    
    // 1. Extract the permanent URL from the server response
    const serverUrl = data?.verification?.registrationDocUrl;
    
    // 2. Update form state immediately with server-confirmed data
    // This replaces the temporary DataURL (which triggers #blocked) with a clean server path
    // 3a. Update doc filenames from server paths
    const licenseUrl = data?.verification?.businessLicenseUrl;
    if (licenseUrl) {
      const parts = licenseUrl.split('/');
      setLicenseFileName(parts[parts.length - 1] || '');
    }

    setForm(prev => ({
      ...prev,
      ...nextForm,
      businessLicenseUrl: licenseUrl || prev.businessLicenseUrl,
      businessLicenseFile: null
    }));

    // 3. Update UI indicators
    setProfileCompleteness(Number(data?.profileCompleteness || 0));
    setVerification(data?.verification || null);
    setMessage(successText);
    setIsDirty(false);
    
    // 4. Sync the global session
    syncSession(data, nextForm);
    return data;
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await employerAPI.getProfile();
        if (!active) return;

        console.log('[Profile] companyName =', String(data?.companyName || 'N/A'));
        console.log('[Profile] LicenseStatus =', String(data?.verification?.status || 'N/A'));

        setForm({
          companyName: data?.companyName || auth?.user?.fullName || auth?.user?.name || '',
          officialEmail: data?.officialEmail || auth?.user?.email || '',
          phone: data?.phone || '',
          website: data?.website || '',
          hqLocation: data?.hqLocation || '',
          industryType: data?.industryType || '',
          companySize: data?.companySize || '',
          foundedYear: data?.foundedYear ? String(data.foundedYear) : '',
          description: data?.description || '',
          representativeName: data?.representative?.name || '',
          representativePosition: data?.representative?.position || '',
          logo: data?.logo || '',
          coverImage: data?.coverImage || '',
          businessLicenseUrl: data?.verification?.businessLicenseUrl || '',
          targetDepartments: data?.targetDepartments || [],
          internshipFacilities: data?.internshipFacilities || [],
          branches: data?.branches || [],
          requiredSkills: data?.requiredSkills || [],
          
          // AI Matching Fields
          intakeCapacity: data?.intakeCapacities?.[0]?.capacity || '',
          internshipPeriod: data?.internshipPeriod || '',
          internshipDuration: data?.internshipDuration || '',
          minimumCgpa: data?.minimumCgpa || '',
          expectedTasks: data?.expectedTasks || '',
          
          // Focal Person
          focalName: data?.focalPerson?.name || '',
          focalEmail: data?.focalPerson?.email || '',
          focalPhone: data?.focalPerson?.phone || '',

          businessLicenseFile: null
        });
        
        // Set license file name from existing URL if present
        if (data?.verification?.businessLicenseUrl) {
          const parts = data.verification.businessLicenseUrl.split('/');
          setLicenseFileName(parts[parts.length - 1] || '');
        } else {
          setLicenseFileName('');
        } 
        
        setProfileCompleteness(Number(data?.profileCompleteness || 0));
        setVerification(data?.verification || null);
        setIsDirty(false);
      } catch (requestError) {
        if (active) {
          console.error('Profile Load Error:', requestError);
          setError(requestError?.response?.data?.message || 'Unable to load company profile.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [auth?.user?.id]); // Only reload if the user ID changes (e.g. login/logout)

  const handleChange = (name, value) => {
    setMessage('');
    setForm((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
  };

  const handleImageDrop = async (event, key, label) => {
    event.preventDefault();
    setDragTarget('');
    const file = event.dataTransfer?.files?.[0];
    await handleImageFileChange(file, key, label);
  };

  const handleLogoCropPointerDown = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setLogoCropDragging(true);
    setLogoCropDragStart({
      x: event.clientX - logoCropOffset.x,
      y: event.clientY - logoCropOffset.y
    });
  };

  const handleLogoCropPointerMove = (event) => {
    if (!logoCropDragging) return;
    const nextX = event.clientX - logoCropDragStart.x;
    const nextY = event.clientY - logoCropDragStart.y;
    const limit = 54;
    setLogoCropOffset({
      x: Math.max(-limit, Math.min(limit, nextX)),
      y: Math.max(-limit, Math.min(limit, nextY))
    });
  };

  const handleLogoCropPointerUp = (event) => {
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    setLogoCropDragging(false);
  };

  const handleImageFileChange = async (input, key, label) => {
    const file = input?.target?.files?.[0] || input;
    if (!file) return;

    try {
      setError('');
      setMessage('');
      setSaving(true);

      if (key === 'logo') {
        const validationError = validateImageFile(file);
        if (validationError) {
          setError(validationError);
          setSaving(false);
          return;
        }
        const src = await readFileAsDataUrl(file);
        setLogoCropSource(src);
        setLogoCropZoom(1.25);
        setLogoCropOffset({ x: 0, y: 0 });
        setLogoCropOpen(true);
        setSaving(false);
        return;
      }

      if (key === 'businessLicenseUrl') {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          setError('Please upload a PDF or an Image (JPG/PNG).');
          setSaving(false);
          return;
        }
        
        const MAX_DOC_SIZE = 5 * 1024 * 1024; // 5MB
        if (file.size > MAX_DOC_SIZE) {
          setError('File is too large. Please upload less than 5MB.');
          setSaving(false);
          return;
        }

        const dataUrl = await readFileAsDataUrl(file);
        const rawName = file.name || 'license.pdf';
        setLicenseFileName(rawName);
        setForm((prev) => ({ ...prev, businessLicenseUrl: dataUrl, businessLicenseFile: file }));
        
        setMessage(`"${rawName}" selected. Click Save Company Profile to upload.`);
        setIsDirty(true);
        setSaving(false);
        return;
      }

      // Default Image Handling (Cover Image, etc)
      const validationError = validateImageFile(file);
      if (validationError) {
        setError(validationError);
        setSaving(false);
        if (input?.target) input.target.value = '';
        return;
      }

      const optimizedDataUrl = await optimizeImageFile(file);
      const nextForm = { ...form, [key]: optimizedDataUrl };
      setForm(nextForm);
      setMessage(`${label} selected. Click Save Company Profile to apply changes.`);
      setIsDirty(true);
    } catch (readError) {
      setError(readError?.message || 'Unable to load the selected file.');
    } finally {
      setSaving(false);
      if (input?.target) input.target.value = '';
    }
  };

  const handleConfirmLogoCrop = async () => {
    if (!logoCropSource) {
      setLogoCropOpen(false);
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      const croppedDataUrl = await createSquareCroppedImage(logoCropSource, logoCropZoom, logoCropOffset);
      const nextForm = { ...form, logo: croppedDataUrl };
      setForm(nextForm);
      setMessage('Company logo updated. Click Save Company Profile to apply changes.');
      setIsDirty(true);
      setLogoCropOpen(false);
      setLogoCropSource('');
      setLogoCropOffset({ x: 0, y: 0 });
    } catch (requestError) {
      setError(requestError?.message || 'Unable to crop and save logo.');
    } finally {
      setSaving(false);
    }
  };

  const removeImage = async (key, label) => {
    setError('');
    setMessage(`${label} removed locally. Click Save Company Profile to apply changes.`);
    setForm((prev) => ({ ...prev, [key]: '' }));
    setIsDirty(true);
  };

  const handleToggleArrayItem = (name, value) => {
    setMessage('');
    setForm((prev) => {
      const current = prev[name] || [];
      const next = current.includes(value)
        ? current.filter((i) => i !== value)
        : [...current, value];
      return { ...prev, [name]: next };
    });
    setIsDirty(true);
  };

  const handleAddArrayItem = (name, value) => {
    if (!value?.trim()) return;
    setMessage('');
    setForm((prev) => {
      const current = prev[name] || [];
      if (current.includes(value.trim())) return prev;
      return { ...prev, [name]: [...current, value.trim()] };
    });
    setIsDirty(true);
  };

  const handleRemoveArrayItem = (name, value) => {
    setMessage('');
    setForm((prev) => ({
      ...prev,
      [name]: (prev[name] || []).filter((i) => i !== value)
    }));
    setIsDirty(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!String(form.companyName || '').trim()) {
      setError('Company name is required.');
      return;
    }

    if (!isDirty) {
      setMessage('No changes to save.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      setMessage('');
      await saveProfile(form);
      setIsDirty(false);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to update company profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-emerald-100 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.18),transparent_42%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_58%)] p-6 shadow-[0_20px_60px_rgba(5,150,105,0.12)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Employer Profile Studio</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Company Profile</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">Edit company details, representative info, and logo. Uploaded photo is stored in the backend database and remains after refresh and re-login.</p>
          </div>
          <div className="rounded-full border border-emerald-100 bg-white px-5 py-2 text-sm text-emerald-700">
            Completion: <span className="font-semibold">{profileCompleteness}%</span>
          </div>
        </div>
      </section>

      {loading ? <Loader label="Loading company profile" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading ? (
        <Card className="rounded-3xl border-emerald-100 bg-white" title="Edit Company Details" description="These details are used across employer dashboard experiences.">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#e9eef4_0%,#eff4f9_100%)] p-4 sm:p-5 md:p-8">
              <div
                className={`relative mb-5 overflow-hidden rounded-2xl border bg-slate-100 transition ${dragTarget === 'coverImage' ? 'border-emerald-400 ring-2 ring-emerald-200' : 'border-slate-200'}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget('coverImage');
                }}
                onDragLeave={() => setDragTarget('')}
                onDrop={(event) => handleImageDrop(event, 'coverImage', 'Cover image')}
              >
                {previewCover ? (
                  <img src={previewCover} alt="Company cover preview" className="h-40 w-full object-cover sm:h-48" />
                ) : (
                  <div className="grid h-40 w-full place-items-center bg-[linear-gradient(120deg,#dbeafe_0%,#dcfce7_100%)] text-sm font-medium text-slate-600 sm:h-48">
                    Company cover image
                  </div>
                )}
                <div className="absolute right-3 top-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => coverInputRef.current?.click()}
                    className="rounded-lg bg-white/95 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-white"
                  >
                    Upload cover
                  </button>
                  {previewCover ? (
                    <button
                      type="button"
                      onClick={() => removeImage('coverImage', 'Cover image')}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleImageFileChange(event, 'coverImage', 'Cover image')}
                  className="hidden"
                />
              </div>

              <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <div
                  className="relative"
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragTarget('logo');
                  }}
                  onDragLeave={() => setDragTarget('')}
                  onDrop={(event) => handleImageDrop(event, 'logo', 'Company logo')}
                >
                  <div className={`flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-700 text-3xl font-semibold text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)] transition sm:h-32 sm:w-32 md:h-36 md:w-36 md:text-4xl ${dragTarget === 'logo' ? 'ring-4 ring-emerald-200' : ''}`}>
                    {previewLogo ? (
                      <img src={previewLogo} alt="Company logo preview" className="h-full w-full object-cover" />
                    ) : (
                      <span>{getInitials(form.companyName || 'Company') || 'C'}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:scale-105 md:h-10 md:w-10"
                    aria-label="Upload company logo"
                    title="Upload company logo"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M9 4.5a1.5 1.5 0 0 1 1.4-1h3.2A1.5 1.5 0 0 1 15 4.5l.3 1.2h2.7A3 3 0 0 1 21 8.7v8.8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.7a3 3 0 0 1 3-3h2.7L9 4.5Zm3 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    </svg>
                  </button>
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{form.companyName || 'Company Name'}</h2>
                <p className="mt-1 max-w-full break-all text-lg text-slate-700 sm:text-2xl md:text-3xl md:leading-8">{form.officialEmail || form.email || 'company@example.com'}</p>
                <p className="mt-5 text-sm text-slate-600">Click the camera icon to upload from your device, then click Save Company Profile to apply it permanently.</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">JPG/PNG/WEBP</span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-medium text-slate-600">Max 4MB</span>
                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium text-sky-700">Drag and drop supported</span>
                </div>
                {previewLogo ? (
                  <button
                    type="button"
                    onClick={() => removeImage('logo', 'Logo')}
                    className="mt-3 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    Remove logo
                  </button>
                ) : null}
              </div>

              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => handleImageFileChange(event, 'logo', 'Company logo')}
                className="hidden"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Company Name</span>
                <input value={form.companyName} onChange={(e) => handleChange('companyName', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Official Email</span>
                <input value={form.officialEmail} onChange={(e) => handleChange('officialEmail', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Phone</span>
                <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Website</span>
                <input value={form.website} onChange={(e) => handleChange('website', e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">HQ Location</span>
                <select value={form.hqLocation} onChange={(e) => handleChange('hqLocation', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400">
                  <option value="">Select Region/City</option>
                  {LOCATION_OPTIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Industry Type</span>
                <select value={form.industryType} onChange={(e) => handleChange('industryType', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400">
                  <option value="">Select Industry</option>
                  {INDUSTRY_OPTIONS.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Company Size</span>
                <select value={form.companySize} onChange={(e) => handleChange('companySize', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400">
                  <option value="">Select size</option>
                  <option value="1-10">1-10</option>
                  <option value="10-50">10-50</option>
                  <option value="50+">50+</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Founded Year</span>
                <input value={form.foundedYear} onChange={(e) => handleChange('foundedYear', e.target.value)} type="number" min="1800" max="2100" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Representative Name</span>
                <input value={form.representativeName} onChange={(e) => handleChange('representativeName', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Representative Position</span>
                <input value={form.representativePosition} onChange={(e) => handleChange('representativePosition', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Company Description</span>
              <textarea value={form.description} onChange={(e) => handleChange('description', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
            </label>


            {/* New Section: Internship Placement & Matching */}
            <div className="mt-8 space-y-6 rounded-3xl border border-emerald-100 bg-emerald-50/30 p-6">
              <div>
                <h3 className="text-lg font-semibold text-emerald-900">Internship Placement & Matching</h3>
                <p className="text-sm text-emerald-700/80">These details help our AI match the right students to your organization.</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">1. Select College / Faculty</span>
                    <Select
                      options={DEPARTMENT_OPTIONS.map(group => ({ 
                        value: group.label, 
                        label: group.label,
                        color: '#059669' // Emerald 600
                      }))}
                      value={selectedCollege}
                      onChange={(opt) => setSelectedCollege(opt)}
                      placeholder="e.g. Engineering & Technology"
                      className="text-sm"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          borderRadius: '0.75rem',
                          borderColor: state.isFocused ? '#10b981' : '#cbd5e1',
                          fontWeight: '600',
                          color: '#065f46'
                        }),
                        option: (base, state) => ({
                          ...base,
                          fontWeight: '700',
                          color: state.isSelected ? 'white' : '#065f46',
                          backgroundColor: state.isSelected ? '#10b981' : 'white',
                          '&:hover': { backgroundColor: '#ecfdf5' }
                        })
                      }}
                    />
                  </div>

                  {selectedCollege && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <span className="text-sm font-medium text-emerald-700">2. Select Departments in {selectedCollege.label}</span>
                      <Select
                        isMulti
                        options={DEPARTMENT_OPTIONS.find(g => g.label === selectedCollege.value)?.options || []}
                        value={DEPARTMENT_OPTIONS.flatMap(g => g.options).filter(opt => form.targetDepartments.includes(opt.value))}
                        onChange={(selectedOptions) => {
                          const selectedValues = selectedOptions ? selectedOptions.map(opt => opt.value) : [];
                          // Note: We keep existing departments from other colleges if they were already selected
                          const otherCollegeDepts = form.targetDepartments.filter(dept => {
                            const group = DEPARTMENT_OPTIONS.find(g => g.options.some(o => o.value === dept));
                            return group && group.label !== selectedCollege.value;
                          });
                          handleChange('targetDepartments', [...new Set([...otherCollegeDepts, ...selectedValues])]);
                        }}
                        placeholder="Pick departments..."
                        className="text-sm"
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            borderRadius: '0.75rem',
                            borderColor: state.isFocused ? '#34d399' : '#cbd5e1'
                          })
                        }}
                      />
                    </div>
                  )}

                  {form.targetDepartments.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {form.targetDepartments.map(dept => (
                        <span key={dept} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                          {dept}
                          <button 
                            type="button" 
                            onClick={() => handleChange('targetDepartments', form.targetDepartments.filter(d => d !== dept))}
                            className="hover:text-emerald-900"
                          >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Available Internship Locations (Branches)</span>
                    <div className="flex gap-2">
                      <input
                        placeholder="e.g. Addis Ababa"
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddArrayItem('branches', e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          const input = e.currentTarget.previousElementSibling;
                          handleAddArrayItem('branches', input.value);
                          input.value = '';
                        }}
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.branches.map((branch) => (
                        <span key={branch} className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                          {branch}
                          <button type="button" onClick={() => handleRemoveArrayItem('branches', branch)} className="hover:text-emerald-900">
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-sm font-medium text-slate-700">Internship Facilities & Benefits</span>
                    <div className="flex flex-wrap gap-3">
                      {FACILITY_OPTIONS.map((facility) => (
                        <label key={facility} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.internshipFacilities.includes(facility)}
                            onChange={() => handleToggleArrayItem('internshipFacilities', facility)}
                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-slate-600">{facility}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* NEW AI MATCHING FIELDS */}
              <div className="grid gap-6 md:grid-cols-2 border-t border-emerald-100 pt-6 mt-4">
                <div className="space-y-4">
                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-700">Total Internship Intake Capacity</span>
                    <p className="text-xs text-slate-500">How many students can you accept overall?</p>
                    <input 
                      type="number" 
                      min="1" 
                      placeholder="e.g. 10"
                      value={form.intakeCapacity} 
                      onChange={(e) => handleChange('intakeCapacity', e.target.value)} 
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" 
                    />
                  </label>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <label className="space-y-2 block">
                      <span className="text-sm font-medium text-slate-700">Internship Period</span>
                      <select 
                        value={form.internshipPeriod} 
                        onChange={(e) => handleChange('internshipPeriod', e.target.value)} 
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Select Period</option>
                        <option value="Summer (Kiremt)">Summer (Kiremt)</option>
                        <option value="Semester Break">Semester Break</option>
                        <option value="All-Year Round">All-Year Round</option>
                      </select>
                    </label>

                    <label className="space-y-2 block">
                      <span className="text-sm font-medium text-slate-700">Duration</span>
                      <select 
                        value={form.internshipDuration} 
                        onChange={(e) => handleChange('internshipDuration', e.target.value)} 
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400"
                      >
                        <option value="">Select Duration</option>
                        <option value="1 Month">1 Month</option>
                        <option value="2 Months">2 Months</option>
                        <option value="3 Months">3 Months</option>
                        <option value="4 Months">4 Months</option>
                        <option value="6+ Months">6+ Months</option>
                      </select>
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-700">Minimum CGPA Requirement (Optional)</span>
                    <p className="text-xs text-slate-500">Leave blank if no strict CGPA cutoff</p>
                    <input 
                      type="number" 
                      step="0.01"
                      min="2.00"
                      max="4.00"
                      placeholder="e.g. 3.00"
                      value={form.minimumCgpa} 
                      onChange={(e) => handleChange('minimumCgpa', e.target.value)} 
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" 
                    />
                  </label>
                </div>

                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-800">Internship Focal Person</h4>
                    <p className="text-xs text-slate-500">The direct supervisor or HR person students will report to.</p>
                    
                    <input 
                      placeholder="Full Name"
                      value={form.focalName} 
                      onChange={(e) => handleChange('focalName', e.target.value)} 
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white" 
                    />
                    <input 
                      type="email"
                      placeholder="Email Address"
                      value={form.focalEmail} 
                      onChange={(e) => handleChange('focalEmail', e.target.value)} 
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white" 
                    />
                    <input 
                      placeholder="Phone Number"
                      value={form.focalPhone} 
                      onChange={(e) => handleChange('focalPhone', e.target.value)} 
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-emerald-400 focus:bg-white" 
                    />
                  </div>

                  <label className="space-y-2 block">
                    <span className="text-sm font-medium text-slate-700">Expected Projects / Tasks</span>
                    <p className="text-xs text-slate-500">What will the interns actually be doing?</p>
                    <textarea 
                      rows={3}
                      placeholder="e.g. Network installation, developing a React dashboard..."
                      value={form.expectedTasks} 
                      onChange={(e) => handleChange('expectedTasks', e.target.value)} 
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-emerald-400" 
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-2 border-t border-emerald-100 pt-6 mt-2">
                <span className="text-sm font-medium text-slate-700">Required Skills / Tech Stack</span>
                <p className="text-xs text-slate-500">List skills you expect from interns (e.g. Python, Networking, Peachtree, Excel). Press Enter to add.</p>
                <div className="flex gap-2">
                  <input
                    placeholder="e.g. Python"
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-emerald-400"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddArrayItem('requiredSkills', e.target.value);
                        e.target.value = '';
                      }
                    }}
                  />
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.requiredSkills.map((skill) => (
                    <span key={skill} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                      {skill}
                      <button type="button" onClick={() => handleRemoveArrayItem('requiredSkills', skill)} className="hover:text-slate-900">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Legal & Verification Documents Section */}
            <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">Company Verification</h3>
                  <p className="mt-1 text-sm text-slate-500">Upload your Business License or TIN Certificate (Max 5MB). PDF, JPG, or PNG.</p>
                </div>
                <div className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                  form.businessLicenseUrl ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {form.businessLicenseUrl ? 'Document Provided' : 'Verification Required'}
                </div>
              </div>

              {/* Dynamic Verification Banners */}
              {verification?.status === 'Verified' && (
                <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-emerald-800 uppercase tracking-wider leading-none">Account Verified</h4>
                    <p className="text-sm font-semibold text-emerald-700 leading-relaxed">
                      Congratulations! Your company account is verified. You now have full access to create internships and interact with students.
                    </p>
                  </div>
                </div>
              )}

              {verification?.status === 'Pending' && (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50/50 p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-amber-800 uppercase tracking-wider leading-none">Verification Pending</h4>
                    <p className="text-sm font-semibold text-amber-700 leading-relaxed">
                      Your company documents are submitted and pending review by the system administrator. You will be notified once reviewed.
                    </p>
                  </div>
                </div>
              )}

              {verification?.status === 'Rejected' && (
                <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50/50 p-6 flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-rose-800 uppercase tracking-wider leading-none">Verification Rejected</h4>
                    <p className="text-sm font-semibold text-rose-700 leading-relaxed">
                      Your verification request has been rejected by the administrator due to the following reason:
                    </p>
                    <div className="max-h-[120px] overflow-y-auto pr-1 mt-2 inline-block max-w-xl scrollbar-thin scrollbar-thumb-rose-200">
                      <p className="text-sm font-black text-rose-950 bg-white border border-rose-200 px-4 py-2.5 rounded-xl italic shadow-sm leading-relaxed">
                        "{verification?.reason || 'No specific reason provided.'}"
                      </p>
                    </div>
                    <p className="text-xs text-rose-600 font-bold mt-2">
                      Please review the reason, upload the correct documents below, and save your profile to request verification again.
                    </p>
                  </div>
                </div>
              )}

              <div 
                className={`relative flex min-h-[260px] flex-col items-center justify-center rounded-3xl border-2 border-dashed p-8 transition-all duration-300 ${
                  dragTarget === 'licenseDoc' ? 'border-emerald-400 bg-emerald-50 scale-[1.01]' : 'border-slate-200 hover:border-emerald-300 bg-slate-50/50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragTarget('licenseDoc'); }}
                onDragLeave={() => setDragTarget('')}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragTarget('');
                  const file = e.dataTransfer.files[0];
                  handleImageFileChange(file, 'businessLicenseUrl', 'Business License');
                }}
              >
                <div className="flex flex-col items-center justify-center">
                  <div className={`mb-4 rounded-2xl p-4 shadow-sm transition-colors duration-300 ${form.businessLicenseUrl ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400'}`}>
                    <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h4 className="text-lg font-semibold text-slate-800">Business License / TIN</h4>
                  <p className="mt-2 text-sm text-slate-500 text-center max-w-sm">Drag and drop your document here, or click to browse files from your computer.</p>
                </div>

                {licenseFileName && (
                  <div className="mt-6 flex w-full max-w-lg items-center justify-between rounded-2xl bg-white p-4 shadow-lg border border-emerald-100 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 shadow-inner">
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div className="flex flex-col overflow-hidden">
                        <span className="truncate text-sm font-bold text-slate-800">{licenseFileName}</span>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">Document Ready</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {form.businessLicenseUrl && (
                        <a 
                          href={resolveFileUrl(form.businessLicenseUrl)} 
                          target="_blank" 
                          rel="noreferrer" 
                          onClick={(e) => e.stopPropagation()}
                          className="relative z-10 flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 active:scale-95"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          View
                        </a>
                      )}
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setLicenseFileName('');
                          setForm(prev => ({ ...prev, businessLicenseUrl: '', businessLicenseFile: null }));
                          setIsDirty(true);
                          setMessage('Document removed. Click Save Company Profile to apply changes.');
                        }} 
                        className="relative z-10 flex items-center gap-1.5 rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-100 active:scale-95"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <input 
                  type="file" 
                  className={`absolute inset-0 cursor-pointer opacity-0 ${licenseFileName ? 'pointer-events-none' : ''}`} 
                  onChange={(e) => handleImageFileChange(e.target.files[0], 'businessLicenseUrl', 'Business License')} 
                />
              </div>
            </div>

            <button type="submit" disabled={saving} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Company Profile'}
            </button>
          </form>
        </Card>
      ) : null}

      <Modal
        open={logoCropOpen}
        title="Crop company logo"
        onClose={() => {
          if (saving) return;
          setLogoCropOpen(false);
          setLogoCropSource('');
          setLogoCropOffset({ x: 0, y: 0 });
          setLogoCropDragging(false);
        }}
      >
        <div className="space-y-4">
          <div className="mx-auto grid w-full max-w-xs place-items-center">
            <div
              className={`relative h-52 w-52 touch-none overflow-hidden rounded-full border-4 border-white bg-slate-200 shadow ${logoCropDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
              onPointerDown={handleLogoCropPointerDown}
              onPointerMove={handleLogoCropPointerMove}
              onPointerUp={handleLogoCropPointerUp}
              onPointerCancel={handleLogoCropPointerUp}
              onPointerLeave={handleLogoCropPointerUp}
            >
              {logoCropSource ? (
                <img
                  src={logoCropSource}
                  alt="Logo crop preview"
                  className="h-full w-full object-cover"
                  draggable={false}
                  style={{ transform: `translate(${logoCropOffset.x}px, ${logoCropOffset.y}px) scale(${logoCropZoom})`, transformOrigin: 'center center' }}
                />
              ) : null}
            </div>
            <p className="mt-2 text-xs text-slate-500">Drag to reposition, then zoom.</p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Zoom</span>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={logoCropZoom}
              onChange={(event) => setLogoCropZoom(Number(event.target.value))}
              className="w-full"
            />
          </label>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (saving) return;
                setLogoCropOpen(false);
                setLogoCropSource('');
                setLogoCropOffset({ x: 0, y: 0 });
                setLogoCropDragging(false);
              }}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleConfirmLogoCrop}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Apply and Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
