import React, { useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import useAuth from '@/hooks/useAuth';
import api from '@/services/api';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'DS';
}

export default function ProfileAdmin() {
  const { user, token, setSession } = useAuth();
  const fileInputRef = useRef(null);
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin' || user?.role === 'SuperAdmin';
  const isDean = user?.role === 'dean';
  const isHod = user?.role === 'hod';

  const studioLabel = isSuperAdmin 
    ? 'Super Admin Studio' 
    : isDean 
      ? 'Dean Studio' 
      : isHod 
        ? 'HOD Studio' 
        : 'Administration Studio';
        
  const profileTitle = isSuperAdmin 
    ? 'Super Admin Profile' 
    : isDean 
      ? 'Dean Profile' 
      : isHod 
        ? 'HOD Profile' 
        : 'User Profile';

  const [form, setForm] = useState({
    fullName: user?.fullName || user?.name || '',
    email: user?.email || '',
    profilePicUrl: user?.profilePicUrl || user?.profileImage || '',
    officePhone: user?.phone?.split(' / ')[0] || '',
    mobilePhone: user?.phone?.split(' / ')[1] || user?.phone || '',
    jobTitle: user?.jobTitle || (
      isSuperAdmin 
        ? 'Director of Academic Affairs / ICT Head' 
        : isDean 
          ? 'Dean of College' 
          : isHod 
            ? 'Head of Department' 
            : 'Administrator'
    ),
    department: user?.department || user?.college || (
      isSuperAdmin 
        ? "President's Office" 
        : isDean 
          ? "Dean's Office" 
          : "Department Office"
    )
  });

  // ✅ Re-sync form whenever user loads from localStorage (fixes init-before-load bug)
  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        fullName: user.fullName || user.name || prev.fullName,
        email: user.email || prev.email,
        profilePicUrl: user.profilePicUrl || user.profileImage || prev.profilePicUrl,
        officePhone: user.phone?.split(' / ')[0] || prev.officePhone,
        mobilePhone: user.phone?.split(' / ')[1] || user.phone || prev.mobilePhone,
        jobTitle: user.jobTitle || prev.jobTitle,
        department: user.department || user.college || prev.department,
      }));
    }
  }, [user?._id]); // only re-run when user identity changes, not every render

  // ✅ Fetch fresh data from backend on mount — this is the source of truth
  useEffect(() => {
    const fetchFreshProfile = async () => {
      try {
        const { data } = await api.get('/admin/me');
        if (data) {
          setForm(prev => ({
            ...prev,
            fullName: data.fullName || data.name || prev.fullName,
            email: data.email || prev.email,
            profilePicUrl: data.profileImage || prev.profilePicUrl,
            officePhone: data.phone?.split(' / ')[0] || prev.officePhone,
            mobilePhone: data.phone?.split(' / ')[1] || data.phone || prev.mobilePhone,
            jobTitle: data.jobTitle || prev.jobTitle,
            department: data.department || data.college || prev.department,
          }));
        }
      } catch (_) {
        // fallback silently — form already has user data from localStorage
      }
    };
    fetchFreshProfile();
  }, []);

  const previewPhoto = form.profilePicUrl || '';

  const handleChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    // Show preview immediately using FileReader
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, profilePicUrl: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setMessage('');
      
      let finalPhotoUrl = form.profilePicUrl;

      // 1. If a new photo was chosen, upload it now
      if (selectedFile) {
        const formData = new FormData();
        formData.append('photo', selectedFile);
        const { data } = await api.post('/profile/upload-photo', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        if (data?.url) {
          finalPhotoUrl = data.url;
        } else {
          throw new Error('Photo upload failed. Please try again.');
        }
      }

      // 2. Submit all changes to the profile update route
      const payload = {
        fullName: form.fullName,
        phone: `${form.officePhone} / ${form.mobilePhone}`,
        jobTitle: form.jobTitle,
        department: form.department,
        profileImage: finalPhotoUrl,
      };

      const { data: savedUser } = await api.put('/profile/update-user', payload);
      
      // Check if we got a valid response back
      if (!savedUser || (!savedUser._id && !savedUser.email)) {
        throw new Error('Server returned an empty response. Please try again.');
      }

      // Visual delay for professional UX
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // ✅ Update form state immediately from server response
      setForm(prev => ({
        ...prev,
        fullName: savedUser.fullName || savedUser.name || prev.fullName,
        officePhone: savedUser.phone?.split(' / ')[0] || prev.officePhone,
        mobilePhone: savedUser.phone?.split(' / ')[1] || prev.mobilePhone,
        jobTitle: savedUser.jobTitle || prev.jobTitle,
        department: savedUser.department || savedUser.college || prev.department,
        profilePicUrl: savedUser.profileImage || prev.profilePicUrl,
      }));

      setSelectedFile(null);

      // ✅ Update localStorage with confirmed server data
      try {
        const existingUser = JSON.parse(localStorage.getItem('user') || '{}');
        const mergedUser = {
          ...existingUser,
          fullName: savedUser.fullName || existingUser.fullName,
          name: savedUser.fullName || savedUser.name || existingUser.name,
          phone: savedUser.phone || existingUser.phone,
          jobTitle: savedUser.jobTitle || existingUser.jobTitle,
          department: savedUser.department || existingUser.department,
          profileImage: savedUser.profileImage || existingUser.profileImage,
        };
        localStorage.setItem('user', JSON.stringify(mergedUser));
        if (setSession && token) {
          setSession({ user: mergedUser, token });
        }
      } catch (_) {}

      setMessage(`✓ Profile saved — "${savedUser.fullName || 'Profile'}" updated in database.`);
      setTimeout(() => setMessage(''), 4000);

      // 🔔 Dispatch event so Navbar updates immediately without refresh
      window.dispatchEvent(new CustomEvent('admin-profile-updated', {
        detail: {
          fullName: savedUser.fullName || savedUser.name,
          profileImage: savedUser.profileImage,
        }
      }));
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Save failed.';
      setError(`✗ ${msg} (Status: ${err.response?.status || 'network error'})`);
      setTimeout(() => setError(''), 6000);
    } finally {
      setSaving(false);
    }
  };


  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      
      {/* Ocean Aurora Style Header (Optional, matches student style) */}
      <section className="rounded-[32px] border border-blue-100 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_40%),linear-gradient(180deg,#eff6ff_0%,#ffffff_60%)] p-6 shadow-[0_20px_60px_rgba(37,99,235,0.12)] lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-blue-700">{studioLabel}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">{profileTitle}</h1>
            <p className="mt-2 max-w-xl text-sm leading-7 text-slate-600">Update your official university credentials and contact information. All changes are saved directly to the backend database.</p>
          </div>
          <div className="rounded-full border border-blue-100 bg-white px-5 py-2 text-sm text-blue-700 flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
             Account Status: <span className="font-semibold">Active</span>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 mb-4 max-w-5xl mx-auto">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mb-4 max-w-5xl mx-auto">
          {message}
        </div>
      )}

      <Card className="rounded-3xl border-blue-100 bg-white" title="Edit Details" description="Keep your profile current for better administration and security verification.">
        <form className="space-y-5" onSubmit={handleSubmit}>
          
          {/* Top Banner section matching exactly the provided screenshot */}
          <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#e9eef4_0%,#eff4f9_100%)] p-4 sm:p-5 md:p-8">
            <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-3xl font-semibold text-white shadow-[0_14px_40px_rgba(15,23,42,0.18)] sm:h-32 sm:w-32 md:h-36 md:w-36 md:text-4xl">
                  {previewPhoto ? (
                    <img src={previewPhoto} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <span>{getInitials(form.fullName || (isDean ? 'Dean' : isHod ? 'HOD' : 'Admin'))}</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handlePhotoClick}
                  className="absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-md transition hover:scale-105 md:h-10 md:w-10"
                  aria-label="Upload profile photo"
                  title="Upload profile photo"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <path d="M9 4.5a1.5 1.5 0 0 1 1.4-1h3.2A1.5 1.5 0 0 1 15 4.5l.3 1.2h2.7A3 3 0 0 1 21 8.7v8.8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8.7a3 3 0 0 1 3-3h2.7L9 4.5Zm3 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                  </svg>
                </button>
              </div>

              <h2 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">{form.fullName}</h2>
              <p className="mt-1 max-w-full break-all text-lg text-slate-700 sm:text-2xl md:text-3xl md:leading-8">{form.email}</p>

              <p className="mt-5 text-sm text-slate-600">Click the camera icon to update your photo. It stays saved after refresh and re-login.</p>
            </div>
            
            {/* Hidden file input for future real implementation */}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Form Fields corresponding to the Admin user requirements */}
          <div className="grid gap-4 md:grid-cols-2 mt-8">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Full Name</span>
              <input 
                value={form.fullName} 
                onChange={(e) => handleChange('fullName', e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400" 
                placeholder="e.g. Dr. Solomon Bekele"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Official Email</span>
              <input 
                value={form.email} 
                disabled 
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-slate-500" 
                placeholder="s.bekele@university.edu.et"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Position</span>
              <input 
                value={form.jobTitle} 
                onChange={(e) => handleChange('jobTitle', e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400" 
                placeholder="e.g. Director of Academic Affairs or ICT Head"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Office</span>
              <input 
                value={form.department} 
                onChange={(e) => handleChange('department', e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400" 
                placeholder="e.g. President's Office"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Office Phone</span>
              <input 
                value={form.officePhone} 
                onChange={(e) => handleChange('officePhone', e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400" 
                placeholder="+251 11 123 4567"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-600">Mobile Phone</span>
              <input 
                value={form.mobilePhone} 
                onChange={(e) => handleChange('mobilePhone', e.target.value)} 
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-blue-400" 
                placeholder="+251 91 123 4567"
              />
            </label>
          </div>

          <div className="flex justify-end pt-8">
            <button
              type="submit"
              disabled={saving}
              className="group relative flex items-center justify-center gap-3 rounded-2xl bg-cyan-700 px-12 py-4 text-xs font-black uppercase tracking-[0.25em] text-white transition-all hover:bg-cyan-600 hover:shadow-2xl hover:scale-[1.02] disabled:opacity-50 disabled:pointer-events-none"
            >
              {saving ? (
                <>
                  <svg className="h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <span>Save Profile Changes</span>
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
