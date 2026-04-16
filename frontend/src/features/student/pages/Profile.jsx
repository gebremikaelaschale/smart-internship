import React, { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Loader from '@/components/common/Loader';
import ErrorMessage from '@/components/common/ErrorMessage';
import useAuth from '@/hooks/useAuth';
import { studentAPI } from '../studentAPI';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export default function Profile() {
  const auth = useAuth();
  const fileInputRef = useRef(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    profilePicUrl: '',
    phone: '',
    college: '',
    department: '',
    yearOfStudy: '',
    bio: '',
    resumeUrl: '',
    skillsText: ''
  });
  const [profileStrength, setProfileStrength] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const previewPhoto = form.profilePicUrl || '';

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

  const syncSessionPhoto = (data, nextForm) => {
    if (!(auth?.setSession && auth?.user)) return;
    auth.setSession({
      user: {
        ...auth.user,
        fullName: data?.profile?.fullName || nextForm.fullName,
        name: data?.profile?.name || nextForm.fullName,
        email: data?.profile?.email || nextForm.email,
        profilePicUrl: data?.profile?.profilePicUrl || nextForm.profilePicUrl
      },
      token: auth.token
    });
  };

  const saveProfile = async (nextForm, successText = 'Profile updated successfully.') => {
    const payload = {
      fullName: nextForm.fullName,
      profilePicUrl: nextForm.profilePicUrl,
      phone: nextForm.phone,
      college: nextForm.college,
      department: nextForm.department,
      yearOfStudy: nextForm.yearOfStudy,
      bio: nextForm.bio,
      resumeUrl: nextForm.resumeUrl,
      skills: nextForm.skillsText
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    };

    const { data } = await studentAPI.updateProfile(payload);
    setProfileStrength(Number(data?.profile?.profileStrength || 0));
    setMessage(successText);
    syncSessionPhoto(data, nextForm);
    return data;
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      try {
        setLoading(true);
        setError('');
        const { data } = await studentAPI.getProfile();
        const profile = data?.profile || {};

        if (!active) return;

        setForm({
          fullName: profile.fullName || profile.name || '',
          email: profile.email || '',
          profilePicUrl: profile.profilePicUrl || '',
          phone: profile.phone || '',
          college: profile.college || '',
          department: profile.department || '',
          yearOfStudy: profile.yearOfStudy || '',
          bio: profile.bio || '',
          resumeUrl: profile.resumeUrl || '',
          skillsText: Array.isArray(profile.skills) ? profile.skills.join(', ') : ''
        });
        setProfileStrength(Number(profile.profileStrength || 0));
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
      setSaving(true);
      setError('');
      setMessage('');
      const optimizedDataUrl = await optimizeImageFile(file);
      const nextForm = { ...form, profilePicUrl: optimizedDataUrl };
      setForm(nextForm);
      await saveProfile(nextForm, 'Profile photo saved successfully.');
    } catch (readError) {
      setError(readError?.message || 'Unable to load the selected image.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');

      await saveProfile(form);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'Unable to update profile.');
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
      {message ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p> : null}

      {!loading ? (
        <Card className="rounded-3xl border-emerald-100 bg-white" title="Edit Details" description="Keep your profile current for better internship matching.">
          <form onSubmit={handleSubmit} className="space-y-5">
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
                <span className="text-sm font-medium text-slate-600">College</span>
                <input value={form.college} onChange={(e) => handleChange('college', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Department</span>
                <input value={form.department} onChange={(e) => handleChange('department', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-600">Year of Study</span>
                <input value={form.yearOfStudy} onChange={(e) => handleChange('yearOfStudy', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Resume URL</span>
              <input value={form.resumeUrl} onChange={(e) => handleChange('resumeUrl', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" placeholder="https://..." />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Skills (comma separated)</span>
              <input value={form.skillsText} onChange={(e) => handleChange('skillsText', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" placeholder="React, Node.js, MongoDB" />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Bio</span>
              <textarea value={form.bio} onChange={(e) => handleChange('bio', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-emerald-400" />
            </label>

            <button type="submit" disabled={saving} className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </Card>
      ) : null}
    </div>
  );
}
