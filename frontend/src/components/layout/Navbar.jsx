import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import { studentAPI } from '@/features/student/studentAPI';
import { employerAPI } from '@/features/employer/employerAPI';

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function getProfileCompletionHint(profile = {}) {
  if (!profile?.resumeUrl) return 'Upload your CV to reach 100%.';
  if (!Array.isArray(profile?.skills) || profile.skills.length === 0) return 'Add your skills to improve matching.';
  if (!profile?.bio) return 'Add a short bio to complete your profile.';
  if (!profile?.phone) return 'Add your phone number for recruiter contact.';
  if (!profile?.department) return 'Set your department for better internship filters.';
  return 'Excellent profile. Keep it updated for better recommendations.';
}

function ProfileStrengthRing({ value }) {
  const clamped = Math.max(0, Math.min(100, Number(value || 0)));
  const style = { background: `conic-gradient(#0284c7 ${clamped * 3.6}deg, #dbeafe 0deg)` };

  return (
    <div className="relative grid h-16 w-16 place-items-center rounded-full" style={style}>
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-900">
        <span className="h-2.5 w-2.5 rounded-full bg-sky-600" />
      </div>
    </div>
  );
}

export default function Navbar({ title, subtitle, actions }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('themeMode');
    if (saved === 'dark') return true;
    if (saved === 'light') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const auth = useAuth();
  const user = auth?.user;
  const token = auth?.token;
  const setSession = auth?.setSession;
  const isStudent = String(user?.role || '').toLowerCase() === 'student';
  const isEmployer = String(user?.role || '').toLowerCase() === 'employer';
  const menuRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePicUrl || '');
  const [imageError, setImageError] = useState(false);
  const [downloadingStudentPaper, setDownloadingStudentPaper] = useState(false);
  const [studentPaperNotice, setStudentPaperNotice] = useState({ type: '', message: '' });
  const [studentSummary, setStudentSummary] = useState({
    profileStrength: 0,
    profileHint: 'Complete your profile for better matching.',
    applicationsCount: 0,
    internshipsCount: 0
  });
  const [employerSummary, setEmployerSummary] = useState({
    dashboardHint: 'Post internship opportunities to start receiving applicants.',
    activePrograms: 0,
    applicantsCount: 0,
    ongoingInterns: 0
  });

  const displayName = user?.fullName || user?.name || 'Team Member';
  const roleKey = String(user?.role || '').toLowerCase();
  const displayRole = useMemo(() => {
    if (!user?.role) return 'guest';
    return String(user.role).replace(/_/g, ' ');
  }, [user?.role]);
  const avatarText = getInitials(displayName) || 'U';
  const isGovernanceRole = ['admin', 'dean', 'hod'].includes(roleKey);

  const profileRoute = isEmployer
    ? '/employer/profile'
    : isStudent
      ? '/student/profile'
      : roleKey === 'dean'
        ? '/dean/settings'
        : roleKey === 'hod'
          ? '/hod/dashboard'
          : '/admin/settings';

  const primaryWorkRoute = isEmployer
    ? '/employer/applicants'
    : isStudent
      ? '/student/applications'
      : roleKey === 'dean'
        ? '/dean/requests'
        : roleKey === 'hod'
          ? '/hod/students'
          : '/admin/applications';

  const secondaryWorkRoute = isEmployer
    ? '/employer/my-programs'
    : isStudent
      ? '/student/internships'
      : roleKey === 'dean'
        ? '/dean/departments'
        : roleKey === 'hod'
          ? '/hod/students'
          : '/admin/internships';

  const menuHintText = isEmployer
    ? employerSummary.dashboardHint
    : isStudent
      ? studentSummary.profileHint
      : roleKey === 'dean'
        ? 'Use your dean workspace to manage departments, requests, and security settings.'
        : roleKey === 'hod'
          ? 'Use your HOD workspace to monitor students and department activity.'
          : 'Use your admin workspace to manage governance and platform operations.';

  useEffect(() => {
    setProfilePhoto(user?.profilePicUrl || '');
    setImageError(false);
  }, [user?.profilePicUrl, user?.fullName, user?.name]);

  useEffect(() => {
    if (!isStudent || profilePhoto || !token) return;

    let active = true;

    const hydrateStudentPhoto = async () => {
      try {
        const { data } = await studentAPI.getProfile();
        const nextPhoto = data?.profile?.profilePicUrl || '';
        if (!active || !nextPhoto) return;
        setProfilePhoto(nextPhoto);
        setImageError(false);

        if (setSession && user && user.profilePicUrl !== nextPhoto) {
          setSession({
            user: { ...user, profilePicUrl: nextPhoto },
            token
          });
        }
      } catch {
        // Keep the initials fallback if the profile endpoint is unavailable.
      }
    };

    hydrateStudentPhoto();
    return () => {
      active = false;
    };
  }, [isStudent, profilePhoto, token, setSession, user]);

  useEffect(() => {
    if (!isEmployer || profilePhoto || !token) return;

    let active = true;

    const hydrateEmployerPhoto = async () => {
      try {
        const { data } = await employerAPI.getProfile();
        const nextPhoto = data?.logo || '';
        if (!active || !nextPhoto) return;

        setProfilePhoto(nextPhoto);
        setImageError(false);

        if (setSession && user && user.profilePicUrl !== nextPhoto) {
          setSession({
            user: { ...user, profilePicUrl: nextPhoto },
            token
          });
        }
      } catch {
        // Keep initials fallback when employer profile image is unavailable.
      }
    };

    hydrateEmployerPhoto();
    return () => {
      active = false;
    };
  }, [isEmployer, profilePhoto, token, setSession, user]);

  useEffect(() => {
    if (!isStudent || !token) return;
    if (!menuOpen && studentSummary.profileStrength > 0) return;

    let active = true;

    const hydrateStudentSummary = async () => {
      try {
        const [profileRes, applicationsRes, internshipsRes] = await Promise.all([
          studentAPI.getProfile(),
          studentAPI.getApplications(),
          studentAPI.getInternships({ status: 'Open', limit: 200 })
        ]);

        if (!active) return;

        const profile = profileRes?.data?.profile || {};
        const applications = Array.isArray(applicationsRes?.data) ? applicationsRes.data : [];
        const internships = Array.isArray(internshipsRes?.data) ? internshipsRes.data : [];

        setStudentSummary({
          profileStrength: Number(profile.profileStrength || 0),
          profileHint: getProfileCompletionHint(profile),
          applicationsCount: applications.length,
          internshipsCount: internships.length
        });
      } catch {
        if (!active) return;
        // Keep existing fallback summary if student summary fails to load.
      }
    };

    hydrateStudentSummary();
    return () => {
      active = false;
    };
  }, [isStudent, token, menuOpen, studentSummary.profileStrength]);

  useEffect(() => {
    if (!isEmployer || !token) return;
    if (!menuOpen && (employerSummary.activePrograms > 0 || employerSummary.applicantsCount > 0 || employerSummary.ongoingInterns > 0)) return;

    let active = true;

    const hydrateEmployerSummary = async () => {
      try {
        const { data } = await employerAPI.getDashboard();
        if (!active) return;

        const stats = data?.stats || {};
        const performance = Array.isArray(data?.performance) ? data.performance : [];
        const applicantsCount = performance.reduce((sum, item) => sum + Number(item?.applicants || 0), 0);
        const activePrograms = Number(stats?.activePrograms || 0);
        const ongoingInterns = Number(stats?.ongoing || 0);

        let dashboardHint = 'Post internship opportunities to start receiving applicants.';
        if (activePrograms > 0 && applicantsCount === 0) {
          dashboardHint = 'Your programs are live. Share them widely to attract more applicants.';
        } else if (applicantsCount > 0) {
          dashboardHint = 'You have new candidates. Review applicants and move top matches forward.';
        }

        setEmployerSummary({
          dashboardHint,
          activePrograms,
          applicantsCount,
          ongoingInterns
        });
      } catch {
        if (!active) return;
        // Keep fallback summary values if employer summary fails to load.
      }
    };

    hydrateEmployerSummary();
    return () => {
      active = false;
    };
  }, [isEmployer, token, menuOpen, employerSummary.activePrograms, employerSummary.applicantsCount, employerSummary.ongoingInterns]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!studentPaperNotice.message) return undefined;
    const timer = window.setTimeout(() => {
      setStudentPaperNotice({ type: '', message: '' });
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [studentPaperNotice]);

  const handleDownloadStudentEvaluationPaper = async () => {
    try {
      setDownloadingStudentPaper(true);
      setStudentPaperNotice({ type: '', message: '' });
      const response = await studentAPI.downloadEvaluationPaper();
      const payloadBlob = response?.data instanceof Blob
        ? response.data
        : new Blob([response?.data], { type: 'application/pdf' });

      const headerBuffer = await payloadBlob.slice(0, 5).arrayBuffer();
      const headerBytes = Array.from(new Uint8Array(headerBuffer));
      const isPdfSignature = headerBytes.length >= 4
        && headerBytes[0] === 0x25
        && headerBytes[1] === 0x50
        && headerBytes[2] === 0x44
        && headerBytes[3] === 0x46;
      const contentType = String(response?.headers?.['content-type'] || '');
      const isPdfByContentType = contentType.toLowerCase().includes('application/pdf');

      if (!isPdfSignature && !isPdfByContentType) {
        throw new Error('Server returned non-PDF content.');
      }

      const blob = new Blob([payloadBlob], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `student-evaluation-paper-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStudentPaperNotice({ type: 'success', message: 'Evaluation paper downloaded successfully.' });
      setMenuOpen(false);
    } catch (error) {
      setStudentPaperNotice({ type: 'error', message: error?.message || 'Unable to download evaluation paper.' });
    } finally {
      setDownloadingStudentPaper(false);
    }
  };

  const avatarSrc = profilePhoto && !imageError ? profilePhoto : '';
  const menuShellClass = isEmployer
    ? 'absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-[0_20px_60px_rgba(6,78,59,0.18)]'
    : 'absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]';
  const menuHeaderClass = isEmployer
    ? 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_42%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-6'
    : 'bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_42%),linear-gradient(180deg,#f4f7fb_0%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-6';
  const menuHintClass = isEmployer
    ? 'mt-3 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 text-xs text-slate-600'
    : 'mt-3 rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-xs text-slate-600';
  const menuStatsWrapClass = isEmployer
    ? 'grid grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-2'
    : 'grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2';
  const menuLinkClass = isEmployer
    ? 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-slate-950'
    : 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-slate-950';
  const badgeClass = isEmployer
    ? 'inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm'
    : 'inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-sm';
  const verifiedClass = isEmployer
    ? 'inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700'
    : 'inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-700';
  const employerActionIconClass = isEmployer
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
    : 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700';
  const accountButtonClass = isStudent
    ? `flex items-center gap-3 rounded-[999px] border pl-2.5 pr-3 py-1.5 text-left shadow-[0_2px_10px_rgba(15,23,42,0.08)] transition ${isDarkMode ? 'border-slate-700 bg-slate-900/90 hover:bg-slate-800 text-slate-100' : 'border-slate-200 bg-slate-50/95 hover:bg-white'}`
    : isEmployer
      ? 'flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-left shadow-[0_8px_20px_rgba(16,185,129,0.16)] transition hover:border-emerald-300 hover:bg-white hover:shadow-md'
      : 'flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:shadow-md';
  const accountAvatarClass = isStudent
    ? 'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 text-white'
    : isEmployer
      ? 'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white'
      : 'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-brand-600 text-white';
  const headerClass = isStudent
    ? (isDarkMode
      ? 'border-slate-800 bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.92))]'
      : 'border-sky-100 bg-[linear-gradient(180deg,rgba(248,251,255,0.96),rgba(255,255,255,0.92))]')
    : (isEmployer
      ? 'border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.92))]'
      : 'border-slate-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))]');
  const eyebrowClass = isStudent
    ? (isDarkMode ? 'text-sky-300' : 'text-sky-700')
    : (isEmployer ? 'text-emerald-700' : 'text-blue-700');
  const titleClass = isStudent
    ? (isDarkMode ? 'text-slate-100' : 'text-slate-900')
    : 'bg-gradient-to-r from-slate-900 via-blue-900 to-sky-700 bg-clip-text text-transparent';
  const subtitleClass = isStudent
    ? (isDarkMode ? 'text-slate-300' : 'text-slate-600')
    : 'text-slate-600';

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
      localStorage.setItem('themeMode', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('themeMode', 'light');
    }
  }, [isDarkMode]);

  return (
    <header className={`border-b backdrop-blur ${headerClass}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${isStudent ? (isDarkMode ? 'border-sky-700 bg-slate-900 text-sky-300' : 'border-sky-200 bg-sky-50 text-sky-700') : (isEmployer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700')}`}>
              {subtitle || 'Internship Management System'}
            </span>
            {!isStudent ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" /> : null}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-sm ${isEmployer ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : isStudent ? 'border-sky-100 bg-white text-sky-700' : 'border-sky-100 bg-white text-sky-700'}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path d="M12 7v10" />
                <path d="M7.5 9.5L12 12l4.5-2.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 ${isStudent && isDarkMode ? 'text-slate-400' : ''}`}>Governance workspace</p>
              <h1 className={`mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-[2rem] ${titleClass}`}>{title || 'Dashboard'}</h1>
            </div>
          </div>
          <p className={`mt-2 max-w-2xl text-sm leading-6 ${subtitleClass}`}>{isEmployer ? 'Manage partner operations, internships, and approvals from a single command center.' : isStudent ? 'Track your internships and profile updates from a single dashboard.' : 'Monitor departments, students, approvals, and institutional activity from a single command center.'}</p>
        </div>

        <div className="flex items-center gap-3">
          {actions}
          <button
            type="button"
            onClick={() => setIsDarkMode((value) => !value)}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDarkMode ? 'Light mode' : 'Dark mode'}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-slate-900'}`}
          >
            {isDarkMode ? (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <path d="M20 14.5A8.5 8.5 0 119.5 4 6.8 6.8 0 0020 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className={accountButtonClass}
            >
              <div className={accountAvatarClass}>
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    className="h-full w-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <span className="text-sm font-semibold tracking-wide">{avatarText}</span>
                )}
              </div>
              <div className="hidden text-left sm:block">
                <div className={`font-semibold text-slate-900 ${isStudent ? 'text-[1.03rem] leading-5' : 'text-sm'}`}>{displayName}</div>
                <div className={`capitalize text-slate-500 ${isStudent ? 'text-sm' : 'text-xs'}`}>{displayRole}</div>
              </div>
              <svg className={`hidden h-4 w-4 text-slate-400 transition sm:block ${menuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
              </svg>
            </button>

            {menuOpen ? (
              <div className={menuShellClass}>
                <div className={menuHeaderClass}>
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 text-white shadow-lg">
                        {avatarSrc ? (
                          <img
                            src={avatarSrc}
                            alt={displayName}
                            className="h-full w-full object-cover"
                            onError={() => setImageError(true)}
                          />
                        ) : (
                          <span className="text-lg font-semibold">{avatarText}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-900 sm:text-lg">{displayName}</p>
                        <p className="truncate text-sm text-slate-600 sm:text-base">{user?.email || 'No email available'}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={badgeClass}>
                            {displayRole}
                          </span>
                          <span className={verifiedClass}>
                            <span className="grid h-4 w-4 place-items-center overflow-hidden rounded-full bg-white">
                              <img src="/uog-logo.jpg" alt="University of Gondar logo" className="h-full w-full object-cover" />
                            </span>
                            {isEmployer ? 'Partner verified' : 'Official'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        window.location.href = profileRoute;
                      }}
                      title={menuHintText}
                      className={`group rounded-2xl border bg-white/90 p-2.5 text-left shadow-sm transition hover:bg-white ${isEmployer ? 'border-emerald-100 hover:border-emerald-200' : 'border-sky-100 hover:border-sky-200'}`}
                    >
                      {isEmployer ? (
                        <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-50 text-sky-700">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-7 w-7">
                            <path d="M3 10.5L12 4l9 6.5V20a1 1 0 01-1 1h-6v-6h-4v6H4a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      ) : isStudent ? (
                        <ProfileStrengthRing value={studentSummary.profileStrength} />
                      ) : (
                        <div className="grid h-16 w-16 place-items-center rounded-full bg-sky-50 text-sky-700">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-7 w-7">
                            <path d="M12 3l8 4.5v6c0 4.2-3.1 7.7-8 8.5-4.9-.8-8-4.3-8-8.5v-6L12 3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                      )}
                      <p className="mt-1 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{isEmployer ? 'Profile' : isStudent ? 'Strength' : 'Portal'}</p>
                    </button>
                  </div>

                  <p className={menuHintClass}>{menuHintText}</p>
                </div>

                {isStudent || isEmployer ? (
                  <div className="px-2 pt-2">
                  <div className={menuStatsWrapClass}>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{isEmployer ? 'Applicants' : 'Applications'}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{isEmployer ? employerSummary.applicantsCount : studentSummary.applicationsCount}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{isEmployer ? 'Active programs' : 'Open roles'}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{isEmployer ? employerSummary.activePrograms : `${studentSummary.internshipsCount} new`}</p>
                    </div>
                  </div>
                  </div>
                ) : null}

                <div className="p-2">
                  <Link to={profileRoute} onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                    <span className="flex items-center gap-2.5">
                      <span className={employerActionIconClass}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M4 16a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      </span>
                      Manage profile
                    </span>
                  </Link>
                  <Link to={primaryWorkRoute} onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                    <span className="flex items-center gap-2.5">
                      <span className={employerActionIconClass}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><path d="M5 3.5h7l3 3V16a1 1 0 01-1 1H5a1 1 0 01-1-1v-11a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.7" /><path d="M12 3.5V7h3" stroke="currentColor" strokeWidth="1.7" /></svg>
                      </span>
                      {isEmployer ? 'Review applicants' : isStudent ? 'View applications' : roleKey === 'dean' ? 'Review requests' : roleKey === 'hod' ? 'View students' : 'Review applications'}
                    </span>
                    {isStudent || isEmployer ? <span className="text-xs text-slate-500">({isEmployer ? employerSummary.applicantsCount : studentSummary.applicationsCount})</span> : null}
                  </Link>
                  <Link to={secondaryWorkRoute} onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                    <span className="flex items-center gap-2.5">
                      <span className={employerActionIconClass}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="9" cy="9" r="5" stroke="currentColor" strokeWidth="1.7" /><path d="M13 13l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      </span>
                      {isEmployer ? 'Manage programs' : isStudent ? 'Browse internships' : roleKey === 'dean' ? 'Manage departments' : roleKey === 'hod' ? 'Open students' : 'Manage internships'}
                    </span>
                    {isStudent || isEmployer ? <span className="text-xs text-slate-500">{isEmployer ? `(${employerSummary.ongoingInterns} ongoing)` : `(${studentSummary.internshipsCount} new)`}</span> : null}
                  </Link>
                  {isStudent ? (
                    <button
                      type="button"
                      onClick={handleDownloadStudentEvaluationPaper}
                      disabled={downloadingStudentPaper}
                      className="group flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="flex items-center gap-2.5">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700">
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><path d="M10 3v8m0 0l-2.5-2.5M10 11l2.5-2.5M4 13.5v1A1.5 1.5 0 005.5 16h9a1.5 1.5 0 001.5-1.5v-1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        </span>
                        {downloadingStudentPaper ? 'Preparing evaluation paper...' : 'Download evaluation paper'}
                      </span>
                    </button>
                  ) : null}
                  {isStudent && studentPaperNotice.message ? (
                    <div className={`mt-1 rounded-xl border px-3 py-2 text-xs ${studentPaperNotice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
                      {studentPaperNotice.message}
                    </div>
                  ) : null}
                  <div className="my-2 h-px bg-slate-100" />
                  <button
                    type="button"
                    onClick={async () => {
                      setMenuOpen(false);
                      if (auth?.logout) {
                        await auth.logout();
                        window.location.href = '/login';
                      }
                    }}
                    className="group flex w-full items-center rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><path d="M8 4h5a1 1 0 011 1v10a1 1 0 01-1 1H8" stroke="currentColor" strokeWidth="1.7" /><path d="M10 10H3m0 0l2.2-2.2M3 10l2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      Sign out
                    </span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
