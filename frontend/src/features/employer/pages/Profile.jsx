import React, { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import Modal from '@/components/common/Modal';
import useAuth from '@/hooks/useAuth';
import { employerAPI } from '../employerAPI';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function EmployerProfile() {
  const auth = useAuth();
  const logoInputRef = useRef(null);
  const coverInputRef = useRef(null);
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
    registrationDocUrl: ''
  });
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [dragTarget, setDragTarget] = useState('');
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
    const payload = {
      companyName: nextForm.companyName,
      logo: nextForm.logo,
      coverImage: nextForm.coverImage,
      officialEmail: nextForm.officialEmail,
      phone: nextForm.phone,
      website: nextForm.website,
      hqLocation: nextForm.hqLocation,
      industryType: nextForm.industryType,
      companySize: nextForm.companySize || undefined,
      foundedYear: nextForm.foundedYear ? Number(nextForm.foundedYear) : undefined,
      description: nextForm.description,
      representative: {
        name: nextForm.representativeName,
        position: nextForm.representativePosition
      },
      verification: {
        registrationDocUrl: nextForm.registrationDocUrl
      }
    };

    const { data } = await employerAPI.updateProfile(payload);
    setProfileCompleteness(Number(data?.profileCompleteness || 0));
    setMessage(successText);
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
          registrationDocUrl: data?.verification?.registrationDocUrl || ''
        });
        setProfileCompleteness(Number(data?.profileCompleteness || 0));
        setIsDirty(false);
      } catch (requestError) {
        if (active) setError(requestError?.response?.data?.message || 'Unable to load company profile.');
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      active = false;
    };
  }, [auth?.user?.email, auth?.user?.fullName, auth?.user?.name]);

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

    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      if (input?.target) input.target.value = '';
      return;
    }

    try {
      setError('');
      setMessage('');

      if (key === 'logo') {
        const src = await readFileAsDataUrl(file);
        setLogoCropSource(src);
        setLogoCropZoom(1.25);
        setLogoCropOffset({ x: 0, y: 0 });
        setLogoCropOpen(true);
        return;
      }

      setSaving(true);
      const optimizedDataUrl = await optimizeImageFile(file);
      const nextForm = { ...form, [key]: optimizedDataUrl };
      setForm(nextForm);
      setMessage(`${label} selected. Click Save Company Profile to apply changes.`);
      setIsDirty(true);
    } catch (readError) {
      setError(readError?.message || 'Unable to load the selected image.');
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

    const confirmed = window.confirm('Confirm save: apply all company profile changes now?');
    if (!confirmed) return;

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
                <input value={form.hqLocation} onChange={(e) => handleChange('hqLocation', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Industry Type</span>
                <input value={form.industryType} onChange={(e) => handleChange('industryType', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
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

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Registration Document URL</span>
              <input value={form.registrationDocUrl} onChange={(e) => handleChange('registrationDocUrl', e.target.value)} placeholder="https://..." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
            </label>

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
