import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import useAuth from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { studentAPI } from '../studentAPI';
import { notifyStudentProfileUpdated } from '@/utils/profileSync';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function resolveMediaUrl(value) {
  const path = String(value || '').trim();
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:') || path.startsWith('data:')) return path;
  return `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${path}`;
}

export default function Profile() {
  const auth = useAuth();
  const location = useLocation();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    profilePicUrl: '',
    phone: '',
    college: '',
    collegeId: '',
    department: '',
    departmentId: '',
    yearOfStudy: '',
    bio: '',
    skills_description: '',
    resumeUrl: '',
    studentIdNumber: '',
    signatureUrl: '',
  });
  const signatureCanvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef({ x: 0, y: 0 });
  const [isSignatureConfirmed, setIsSignatureConfirmed] = useState(false);
  const [profileStrength, setProfileStrength] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('Not Submitted');
  const [verificationNote, setVerificationNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [toast, setToast] = useState(null);
  const [academicSuggestions, setAcademicSuggestions] = useState({ college: [], department: [] });
  const saveTimerRef = useRef(null);
  const toastTimerRef = useRef(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const redirectMessage = String(location.state?.message || '').trim();

  const verificationStatusLabel = String(verificationStatus || auth?.user?.verificationStatus || '').trim() || (auth?.user?.isVerified ? 'Verified' : 'Not Submitted');
  const isVerified = Boolean(auth?.user?.isVerified) && verificationStatusLabel.toLowerCase() === 'verified';
  const isPendingVerification = ['pending', 'submitted'].includes(verificationStatusLabel.toLowerCase());
  const isRejected = verificationStatusLabel.toLowerCase() === 'rejected';

  const previewPhoto = form.profilePicUrl || '';

  const applyAcademicSuggestion = (field, suggestion) => {
    if (!suggestion) return;
    setForm((prev) => ({ ...prev, [field]: suggestion }));
    setAcademicSuggestions((prev) => ({ ...prev, [field]: [] }));
  };

  const optimizeImageFile = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 512;
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
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });

  const dataUrlToFile = (dataUrl, filename) => {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
    const binary = atob(base64 || '');
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      array[i] = binary.charCodeAt(i);
    }
    return new File([array], filename, { type: mimeType });
  };

  const syncSessionPhoto = (data, nextForm) => {
    if (!(auth?.setSession && auth?.user)) return;
    auth.setSession({
      user: {
        ...auth.user,
        fullName: data?.profile?.fullName || nextForm.fullName,
        name: data?.profile?.name || nextForm.fullName,
        email: data?.profile?.email || nextForm.email,
        phone: data?.profile?.phone || nextForm.phone || auth.user.phone || '',
        profilePicUrl: data?.profile?.profilePicUrl || nextForm.profilePicUrl,
        college: data?.profile?.college || nextForm.college,
        department: data?.profile?.department || nextForm.department,
        isVerified: Boolean(data?.profile?.isVerified),
        verificationStatus: data?.profile?.verificationStatus || (data?.profile?.isVerified ? 'Verified' : 'Not Submitted')
      },
      token: auth.token
    });
  };

  const saveProfile = async (nextForm, successText = 'Profile Permanently Updated!') => {
    const formData = new FormData();

    formData.append('fullName', nextForm.fullName);
    formData.append('profilePicUrl', nextForm.profilePicUrl);
    formData.append('phone', nextForm.phone);
    formData.append('college', String(nextForm.college || '').trim());
    formData.append('department', String(nextForm.department || '').trim());
    formData.append('yearOfStudy', nextForm.yearOfStudy);
    formData.append('bio', nextForm.bio);
    formData.append('skills_description', String(nextForm.skills_description || '').trim());
    formData.append('resumeUrl', nextForm.resumeUrl);
    formData.append('idNumber', String(nextForm.studentIdNumber || '').trim());
    formData.append('studentIdNumber', String(nextForm.studentIdNumber || '').trim());

    if (nextForm.signatureUrl) {
      if (nextForm.signatureUrl.startsWith('data:')) {
        formData.append('signatureDataUrl', nextForm.signatureUrl);
      } else {
        formData.append('signatureUrl', nextForm.signatureUrl);
      }
    }

    const { data } = await studentAPI.updateProfile(formData);
    setProfileStrength(Number(data?.profile?.profileStrength || 0));
    const submittedForReview = ['Pending', 'Submitted'].includes(String(data?.profile?.verificationStatus || ''));
    setMessage(`${successText}${submittedForReview ? ' Verification request sent to your HOD.' : ''}`);
    syncSessionPhoto(data, nextForm);
    notifyStudentProfileUpdated({ skillsDescription: data?.profile?.skills_description || '', profileId: data?.profile?._id || null });
    if (data?.profile?.studentSignatureUrl) {
      setForm((prev) => ({ ...prev, signatureUrl: data.profile.studentSignatureUrl }));
    }
    return data;
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const fallbackProfile = {
          fullName: auth?.user?.fullName || auth?.user?.name || '',
          name: auth?.user?.name || auth?.user?.fullName || '',
          email: auth?.user?.email || '',
          phone: auth?.user?.phone || '',
          college: auth?.user?.college || '',
          collegeId: auth?.user?.collegeId || '',
          department: auth?.user?.department || '',
          departmentId: auth?.user?.departmentId || '',
          verificationStatus: auth?.user?.verificationStatus || (auth?.user?.isVerified ? 'Verified' : 'Not Submitted'),
          isVerified: Boolean(auth?.user?.isVerified)
        };

        let profile = fallbackProfile;
        try {
          const profileResponse = await studentAPI.getProfile();
          profile = { ...fallbackProfile, ...(profileResponse?.data?.profile || {}) };
        } catch {
          profile = fallbackProfile;
        }

        if (!active) return;

        setForm({
          fullName: profile.fullName || profile.name || '',
          email: profile.email || '',
          profilePicUrl: profile.profilePicUrl || '',
          phone: profile.phone || '',
          college: profile.college || '',
          collegeId: '',
          department: profile.department || '',
          departmentId: '',
          yearOfStudy: profile.yearOfStudy || '',
          bio: profile.bio || '',
          skills_description: profile.skills_description || profile.skillsDescription || '',
          resumeUrl: profile.resumeUrl || '',
          studentIdNumber: profile.idNumber || profile.studentIdNumber || '',
          signatureUrl: profile.studentSignatureUrl || profile.studentSignature || profile.student_signature || profile.signatureData || profile.signature_data || '',
        });
        setProfileStrength(Number(profile.profileStrength || 0));
        setVerificationStatus(String(profile.verificationStatus || '').trim() || (profile.isVerified ? 'Verified' : 'Not Submitted'));
        setVerificationNote(String(profile.verificationNote || '').trim());
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.message || 'Unable to load profile data.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const ratio = window.devicePixelRatio || 1;
      const width = Math.floor(rect.width * ratio);
      const height = Math.floor(rect.height * ratio);
      if (canvas.width === width && canvas.height === height) return;

      const ctx = canvas.getContext('2d');
      canvas.width = width;
      canvas.height = height;
      if (ctx) {
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      }
    };

    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    window.addEventListener('resize', resizeCanvas);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  useEffect(() => {
    const query = String(form.college || '').trim();
    if (!query) {
      setAcademicSuggestions((prev) => ({ ...prev, college: [] }));
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const { data } = await studentAPI.getAcademicSuggestions({ field: 'college', q: query });
        setAcademicSuggestions((prev) => ({ ...prev, college: Array.isArray(data?.suggestions) ? data.suggestions : [] }));
      } catch {
        setAcademicSuggestions((prev) => ({ ...prev, college: [] }));
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [form.college]);

  useEffect(() => {
    const query = String(form.department || '').trim();
    if (!query) {
      setAcademicSuggestions((prev) => ({ ...prev, department: [] }));
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        const { data } = await studentAPI.getAcademicSuggestions({ field: 'department', q: query });
        setAcademicSuggestions((prev) => ({ ...prev, department: Array.isArray(data?.suggestions) ? data.suggestions : [] }));
      } catch {
        setAcademicSuggestions((prev) => ({ ...prev, department: [] }));
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [form.department]);

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      event.target.value = '';
      return;
    }

    try {
      setError('');
      setMessage('');
      const optimizedDataUrl = await optimizeImageFile(file);
      setForm(prev => ({ ...prev, profilePicUrl: optimizedDataUrl }));
    } catch (readError) {
      setError(readError?.message || 'Unable to load the selected image.');
    }
  };

  const startSignatureDraw = (event) => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const ctx = canvas.getContext('2d');

    drawingRef.current = true;
    lastPointRef.current = { x: offsetX, y: offsetY };
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(offsetX, offsetY);
    setError('');
    setMessage('');
  };

  const moveSignatureDraw = (event) => {
    if (!drawingRef.current) return;
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const lastPoint = lastPointRef.current;
    const midX = (lastPoint.x + offsetX) / 2;
    const midY = (lastPoint.y + offsetY) / 2;
    ctx.quadraticCurveTo(lastPoint.x, lastPoint.y, midX, midY);
    ctx.stroke();
    lastPointRef.current = { x: offsetX, y: offsetY };
  };

  const endSignatureDraw = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawingRef.current = false;
    ctx.closePath();
  };

  const clearSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setForm((prev) => ({ ...prev, signatureUrl: '' }));
    setIsSignatureConfirmed(false);
    setError('');
    setMessage('');
  };

  const confirmSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL('image/png');
    if (!dataUrl || dataUrl === 'data:,') {
      setError('Please draw your signature before confirming.');
      return;
    }

    setForm((prev) => ({ ...prev, signatureUrl: dataUrl }));
    setIsSignatureConfirmed(true);
    setMessage('Signature captured. Remember to save your profile to persist it.');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      setSaving(true);
      setIsSaving(true);
      setSaveSuccess(false);
      setToast(null);
      await saveProfile(form);

      setSaveSuccess(true);
      setToast({ type: 'success', message: 'Success! Your profile has been updated permanently.' });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        setSaveSuccess(false);
        setIsSaving(false);
      }, 3000);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to update profile.');
      setToast({ type: 'error', message: 'Error: Could not save profile. Please try again.' });
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
      setIsSaving(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-emerald-100 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_40%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_60%)] p-6 shadow-[0_20px_60px_rgba(5,150,105,0.12)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">Student Profile Studio</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">Profile</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Update your personal and academic details. All changes are saved directly to the backend database.</p>
          </div>
          <div className="rounded-full border border-emerald-100 bg-white px-5 py-2 text-sm text-emerald-700">
            Completion: <span className="font-semibold">{profileStrength}%</span>
          </div>
        </div>
      </section>

      {loading ? <Loader label="Loading profile" /> : null}
      {error ? <ErrorMessage message={error} /> : null}
      {redirectMessage ? <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{redirectMessage}</p> : null}
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}
              <AnimatePresence>
                {toast ? (
                  <motion.div
                    key="profile-toast"
                    initial={{ opacity: 0, y: -12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                    className={`fixed right-5 top-5 z-[100] w-[min(92vw,400px)] rounded-xl border p-4 shadow-lg backdrop-blur-xl ${toast.type === 'success' ? 'border-emerald-950/30 bg-emerald-700 text-white' : 'border-rose-950/30 bg-rose-700 text-white'}`}
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
      {!loading ? (
        <Card className="rounded-3xl border-emerald-100 bg-white" title="Edit Details" description="Keep your profile current for better internship matching.">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className={`rounded-3xl border px-4 py-3 text-sm ${isVerified ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : isPendingVerification ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em]">Verification Status</div>
              <div className="mt-1">
                {isVerified
                  ? 'Verified by your HOD. Internship access is active.'
                  : isPendingVerification
                    ? 'Your profile was sent to your HOD and is waiting for approval.'
                    : isRejected
                      ? 'Your HOD rejected the profile. Review the comment below, correct the profile, and resubmit.'
                      : 'Select your college and department to send a verification request to your HOD.'}
              </div>
            </div>

            {isRejected && verificationNote ? (
              <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-800">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">HOD Rejection Reason</div>
                <p className="mt-1 leading-6">{verificationNote}</p>
              </div>
            ) : null}

            <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#e9eef4_0%,#eff4f9_100%)] p-4 sm:p-5 md:p-8">
              <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
                <div className="relative">
                  <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-700 text-3xl font-semibold text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)] sm:h-32 sm:w-32 md:h-36 md:w-36 md:text-4xl">
                    {previewPhoto ? (
                      <img src={previewPhoto} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <span>{getInitials(form.fullName || 'User') || 'U'}</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:scale-105 md:h-10 md:w-10"
                    aria-label="Upload profile photo"
                    title="Upload profile photo"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                      <path d="M9 4.5a1.5 1.5 0 0 1 1.4-1h3.2A1.5 1.5 0 0 1 15 4.5l.3 1.2h2.7A3 3 0 0 1 21 8.7v8.8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.7a3 3 0 0 1 3-3h2.7L9 4.5Zm3 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    </svg>
                  </button>
                </div>

                <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{form.fullName || 'Your Name'}</h2>
                <p className="mt-1 max-w-full break-all text-lg text-slate-700 sm:text-2xl md:text-3xl md:leading-8">{form.email || 'you@example.com'}</p>

                <p className="mt-5 text-sm text-slate-600">Click the camera icon to update your photo. It stays saved after refresh and re-login.</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="hidden"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Full Name</span>
                <input value={form.fullName} onChange={(e) => handleChange('fullName', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Email</span>
                <input value={form.email} disabled className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Phone</span>
                <input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Student ID Number</span>
                <input value={form.studentIdNumber} onChange={(e) => handleChange('studentIdNumber', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" placeholder="University ID or registration number" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">College</span>
                <input value={form.college} onChange={(e) => handleChange('college', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" placeholder="Type your college name" />
                {academicSuggestions.college.length > 0 && String(academicSuggestions.college[0]?.name || '').toLowerCase() !== String(form.college || '').trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => applyAcademicSuggestion('college', academicSuggestions.college[0].name)}
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                  >
                    Did you mean <span className="font-black">{academicSuggestions.college[0].name}</span>?
                  </button>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Department</span>
                <input value={form.department} onChange={(e) => handleChange('department', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" placeholder="Type your department name" />
                {academicSuggestions.department.length > 0 && String(academicSuggestions.department[0]?.name || '').toLowerCase() !== String(form.department || '').trim().toLowerCase() ? (
                  <button
                    type="button"
                    onClick={() => applyAcademicSuggestion('department', academicSuggestions.department[0].name)}
                    className="rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-left text-xs font-semibold text-cyan-800 transition hover:bg-cyan-100"
                  >
                    Did you mean <span className="font-black">{academicSuggestions.department[0].name}</span>?
                  </button>
                ) : null}
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Year of Study</span>
                <input value={form.yearOfStudy} onChange={(e) => handleChange('yearOfStudy', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-600">Bio (Optional)</span>
                <textarea
                  value={form.bio}
                  onChange={(e) => handleChange('bio', e.target.value)}
                  placeholder="Tell us about your professional interests and goals..."
                  rows={4}
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-emerald-400"
                />
              </label>
            </div>

            <div className="space-y-3 rounded-3xl border border-emerald-100 bg-emerald-50/50 p-5 md:col-span-2">
              <div>
                <p className="text-sm font-semibold text-emerald-900">Professional Skills & Technical Expertise</p>
                <p className="mt-1 text-xs leading-6 text-emerald-800/80">
                  List your technical and soft skills in detail. Describe how you have used them in projects. The more detail you provide, the better our AI can match you with the right internship.
                </p>
              </div>

              <textarea
                value={form.skills_description}
                onChange={(e) => handleChange('skills_description', e.target.value)}
                rows={8}
                required
                className="min-h-[220px] w-full rounded-3xl border border-emerald-200 bg-white px-5 py-4 text-sm leading-7 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                placeholder="Example: I am proficient in React and Node.js. I have built 3 full-stack projects including an e-commerce site. I also have experience in SQL database management and UI design using Figma..."
              />
            </div>

            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Resume / CV (PDF Only)</span>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".pdf"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.type !== 'application/pdf') {
                      setError('Only PDF files are allowed.');
                      return;
                    }
                    try {
                      setSaving(true);
                      const formData = new FormData();
                      
                      // Append text fields FIRST so multer can access them in req.body
                      formData.append('fullName', form.fullName);
                      formData.append('phone', form.phone);
                      formData.append('college', form.college);
                      formData.append('department', form.department);
                      formData.append('yearOfStudy', form.yearOfStudy);
                      formData.append('bio', form.bio);
                      formData.append('studentIdNumber', form.studentIdNumber);
                      if (form.signatureUrl && !form.signatureUrl.startsWith('blob:')) {
                        formData.append('signatureDataUrl', form.signatureUrl);
                      }
                      formData.append('skills_description', String(form.skills_description || '').trim());

                      // Append the file LAST
                      formData.append('resumeFile', file);

                      const { data } = await studentAPI.updateProfile(formData);
                      notifyStudentProfileUpdated({ skillsDescription: data?.profile?.skills_description || '', profileId: data?.profile?._id || null });
                      setForm(prev => ({
                        ...prev,
                        resumeUrl: data.profile.resumeUrl,
                        signatureUrl: data.profile.studentSignatureUrl || prev.signatureUrl
                      }));
                      setMessage('Resume uploaded successfully.');
                    } catch (err) {
                      setError(err.response?.data?.message || 'Failed to upload resume.');
                    } finally {
                      setSaving(false);
                    }
                  }}
                  className="hidden"
                  id="resume-upload"
                />
                <label
                  htmlFor="resume-upload"
                  className="flex flex-1 cursor-pointer items-center justify-between gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm transition-all hover:border-emerald-400 hover:bg-emerald-50"
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="shrink-0 text-lg">{form.resumeUrl ? '📂' : '📤'}</span>
                    <span className="truncate font-medium text-slate-700">
                      {form.resumeUrl ? form.resumeUrl.split('/').pop() : 'Upload PDF Resume'}
                    </span>
                  </div>
                  <span className="shrink-0 font-bold text-emerald-600 hover:text-emerald-700">
                    {form.resumeUrl ? 'Change' : 'Browse'}
                  </span>
                </label>
                {form.resumeUrl && (
                  <a
                    href={form.resumeUrl.startsWith('http') ? form.resumeUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}${form.resumeUrl}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-emerald-600 hover:bg-emerald-50"
                  >
                    View
                  </a>
                )}
              </div>
              <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Only PDF files up to 50MB</p>
            </div>

<div className="space-y-4">
                <div className="rounded-3xl border border-slate-300 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-600">Digital Signature</p>
                      <p className="mt-1 text-xs text-slate-500">Draw your signature on the pad below and confirm it to save permanently.</p>
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Official Form Ready</div>
                  </div>

                  <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-2">
                    <canvas
                      ref={signatureCanvasRef}
                      width={680}
                      height={180}
                      className="h-44 w-full cursor-crosshair rounded-3xl bg-white shadow-sm"
                      style={{ width: '100%', height: '180px' }}
                      onPointerDown={startSignatureDraw}
                      onPointerMove={moveSignatureDraw}
                      onPointerUp={endSignatureDraw}
                      onPointerLeave={endSignatureDraw}
                    />
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={confirmSignature}
                      className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      Confirm Signature
                    </button>
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                    >
                      Clear
                    </button>
                  </div>

                  {isSignatureConfirmed ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      Signature captured! Click Save Profile to persist it permanently.
                    </div>
                  ) : null}

                  {form.signatureUrl ? (
                    <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-medium text-slate-600">Saved Signature Preview</p>
                      <img
                        src={resolveMediaUrl(form.signatureUrl)}
                        alt="Signature preview"
                        className="mt-3 h-28 rounded-2xl border border-slate-200 object-contain"
                      />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-slate-500">Draw on the pad above and click Confirm Signature to save it.</p>
                  )}

                  {(!form.bio || !form.signatureUrl) ? (
                    <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {!form.signatureUrl ? 'Note: An official signature is required before you can generate the Acceptance Form.' : ''}
                      {!form.bio ? (form.signatureUrl ? 'Bio is optional, but it helps complete your profile.' : ' Bio is optional, but it helps complete your profile.') : ''}
                    </div>
                  ) : null}
                </div>
              </div>

            <button
              type="submit"
              disabled={isSaving}
              className={`rounded-2xl px-6 py-2.5 text-sm font-semibold text-white transition ${saveSuccess ? 'bg-emerald-500 hover:brightness-110' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-105'} ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              <span className="inline-flex items-center gap-2">
                {isSaving ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                    <path d="M22 12a10 10 0 0 1-10 10" strokeLinecap="round" />
                  </svg>
                ) : saveSuccess ? (
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
                {isSaving ? 'Saving...' : saveSuccess ? 'Profile Saved!' : 'Save Profile'}
              </span>
            </button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
