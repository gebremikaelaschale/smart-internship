import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import useAuth from '@/hooks/useAuth';
import { studentAPI } from '@/features/student/studentAPI';
import { employerAPI } from '@/features/employer/employerAPI';
import { Link, useNavigate } from 'react-router-dom';
import useNotificationCount from '@/hooks/useNotificationCount';
import { NotificationContext } from '@/context/NotificationContext';

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
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePicUrl || user?.profileImage || '');
  const [localAdminName, setLocalAdminName] = useState('');
  const [imageError, setImageError] = useState(false);
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

  const displayName = localAdminName || user?.fullName || user?.name || 'Team Member';
  const roleKey = String(user?.role || '').toLowerCase();
  const displayRole = useMemo(() => {
    if (!user?.role) return 'guest';
    return String(user.role).replace(/_/g, ' ');
  }, [user?.role]);
  const avatarText = getInitials(displayName) || 'U';
  const isGovernanceRole = ['admin', 'dean', 'hod', 'super_admin', 'superadmin'].includes(roleKey);

  const profileRoute = isEmployer
    ? '/employer/profile'
    : isStudent
      ? '/student/profile'
      : roleKey === 'dean'
        ? '/dean/profile'
        : roleKey === 'hod'
          ? '/hod/profile'
          : '/admin/profile';

  const settingsRoute = isEmployer
    ? '/employer/settings'
    : isStudent
      ? '/student/settings'
      : roleKey === 'dean'
        ? '/dean/settings'
        : roleKey === 'hod'
          ? '/hod/settings'
          : '/admin/settings';

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
    setProfilePhoto(user?.profilePicUrl || user?.profileImage || '');
    setImageError(false);
  }, [user?.profilePicUrl, user?.profileImage, user?.fullName, user?.name]);

  // Fetch fresh admin profile on mount so navbar shows latest photo/name from DB
  useEffect(() => {
    if (!isGovernanceRole || !token) return;
    let active = true;
    const hydrateAdminProfile = async () => {
      try {
        const { data } = await import('@/services/api').then(m => m.default.get('/admin/me'));
        if (!active || !data) return;
        const photoUrl = data.profileImage || data.profilePicUrl || '';
        const name = data.fullName || data.name || '';
        if (photoUrl) { setProfilePhoto(photoUrl); setImageError(false); }
        if (name) setLocalAdminName(name);
      } catch { /* silent fallback */ }
    };
    hydrateAdminProfile();

    // Listen for profile save event to update Navbar immediately without refresh
    const onProfileUpdated = (e) => {
      if (e.detail?.fullName) setLocalAdminName(e.detail.fullName);
      if (e.detail?.profileImage) { setProfilePhoto(e.detail.profileImage); setImageError(false); }
    };
    window.addEventListener('admin-profile-updated', onProfileUpdated);
    return () => {
      active = false;
      window.removeEventListener('admin-profile-updated', onProfileUpdated);
    };
  }, [isGovernanceRole, token]);

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


  const avatarSrc = profilePhoto && !imageError ? profilePhoto : '';
  const menuShellClass = isDarkMode
    ? 'absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[30px] border border-slate-800 bg-slate-950 shadow-[0_20px_60px_rgba(0,0,0,0.35)]'
    : isEmployer
      ? 'absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[30px] border border-emerald-200 bg-white shadow-[0_20px_60px_rgba(6,78,59,0.18)]'
      : 'absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(23.5rem,calc(100vw-1.5rem))] overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.18)]';
  const menuHeaderClass = isDarkMode
    ? 'bg-slate-950 px-4 py-5 sm:px-6 sm:py-6'
    : isEmployer
      ? 'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.2),transparent_42%),linear-gradient(180deg,#ecfdf5_0%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-6'
      : 'bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_42%),linear-gradient(180deg,#f4f7fb_0%,#ffffff_100%)] px-4 py-5 sm:px-6 sm:py-6';
  const menuHintClass = isDarkMode
    ? 'mt-3 rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-slate-300'
    : isEmployer
      ? 'mt-3 rounded-xl border border-emerald-100 bg-white/90 px-3 py-2 text-xs text-slate-600'
      : 'mt-3 rounded-xl border border-sky-100 bg-white/80 px-3 py-2 text-xs text-slate-600';
  const menuStatsWrapClass = isDarkMode
    ? 'grid grid-cols-2 gap-2 rounded-2xl border border-slate-700 bg-slate-900/80 p-2'
    : isEmployer
      ? 'grid grid-cols-2 gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-2'
      : 'grid grid-cols-2 gap-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-2';
  const menuLinkClass = isDarkMode
    ? 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-slate-800 hover:text-white'
    : isEmployer
      ? 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-slate-950'
      : 'group flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-sky-50 hover:text-slate-950';
  const badgeClass = isDarkMode
    ? 'inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300 shadow-sm shadow-cyan-500/10'
    : isEmployer
      ? 'inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm'
      : 'inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700 shadow-sm';
  const verifiedClass = isDarkMode
    ? 'inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-slate-300'
    : isEmployer
      ? 'inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-700'
      : 'inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-sky-700';
  const employerActionIconClass = isDarkMode
    ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-sky-300'
    : isEmployer
      ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700'
      : 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700';
  const accountButtonClass = isDarkMode
    ? 'flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900/90 px-3 py-2 text-left shadow-[0_8px_20px_rgba(15,23,42,0.3)] transition hover:bg-slate-800 text-slate-100'
    : isStudent
      ? 'flex items-center gap-3 rounded-full border px-3 py-2 text-left shadow-[0_8px_20px_rgba(225,29,72,0.16)] transition border-rose-200 bg-rose-50 hover:bg-white hover:border-rose-300 hover:shadow-md'
      : isEmployer
        ? 'flex items-center gap-3 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-left shadow-[0_8px_20px_rgba(16,185,129,0.16)] transition hover:border-emerald-300 hover:bg-white hover:shadow-md'
        : 'flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-left transition hover:shadow-md';
  const accountAvatarClass = isStudent
    ? 'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white bg-gradient-to-br from-cyan-500 via-teal-500 to-blue-600 text-white'
    : isEmployer
      ? 'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 text-white'
      : 'flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-brand-600 text-white';
  const headerClass = isDarkMode
    ? 'border-slate-800 bg-[linear-gradient(135deg,rgba(2,6,23,0.98),rgba(15,23,42,0.92))]'
    : isStudent
      ? 'border-rose-200 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,255,255,0.96))]'
      : isEmployer
        ? 'border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.98),rgba(255,255,255,0.92))]'
        : 'border-slate-200 bg-[linear-gradient(135deg,rgba(239,246,255,0.98),rgba(255,255,255,0.96))]';
  const eyebrowClass = isStudent
    ? (isDarkMode ? 'text-rose-300' : 'text-rose-700')
    : isDarkMode
      ? 'text-slate-300'
      : (isEmployer ? 'text-emerald-700' : 'text-blue-700');
  const titleClass = isDarkMode
    ? 'text-slate-100'
    : isStudent
      ? 'text-[#0f172a]'
      : 'bg-gradient-to-r from-slate-900 via-blue-900 to-sky-700 bg-clip-text text-transparent';
  const subtitleClass = isDarkMode
    ? 'text-slate-300'
    : isStudent
      ? 'text-slate-600'
      : 'text-slate-600';
  const unreadCount = useNotificationCount();
  const navigate = useNavigate();
  const notifCtx = useContext(NotificationContext);
  const bellRef = useRef(null);
  const [bellOpen, setBellOpen] = useState(false);

  const notificationsRoute = isStudent
    ? '/student/notifications'
    : isEmployer
      ? '/employer/notifications'
      : roleKey === 'dean'
        ? '/dean/notifications'
        : roleKey === 'hod'
          ? '/hod/notifications'
          : '/admin/notifications';

  // Close bell dropdown on outside click or Escape
  useEffect(() => {
    if (!bellOpen) return undefined;
    const onPointer = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setBellOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [bellOpen]);

  // Navigate to notifications page, mark as read immediately, and pre-select the item
  const handleBellItemClick = async (notifId) => {
    setBellOpen(false);
    // Mark as read immediately — removes it from the unread dropdown and decrements badge
    if (notifCtx?.markNotificationRead) {
      await notifCtx.markNotificationRead(notifId);
    }
    // Pre-select in context so the notifications page opens that item's full detail
    if (notifCtx?.setSelectedNotificationId) {
      notifCtx.setSelectedNotificationId(notifId);
    }
    navigate(notificationsRoute);
  };

  // Quick-view: UNREAD ONLY, sorted most recent first, capped at 8
  const quickViewItems = useMemo(() => {
    const all = Array.isArray(notifCtx?.notifications) ? notifCtx.notifications : [];
    return all.filter((n) => !n.isRead).slice(0, 8);
  }, [notifCtx?.notifications]);

  function formatQuickTime(input) {
    const date = new Date(input);
    if (Number.isNaN(date.getTime())) return '';
    const diffMs = Date.now() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  }

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
    <header className={`sticky top-0 z-50 shrink-0 border-b backdrop-blur ${headerClass}`}>
      <div className="flex items-center justify-between gap-4 px-6 py-4 lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] ${isStudent ? (isDarkMode ? 'border-rose-700 bg-slate-900 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700') : (isEmployer ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-sky-200 bg-sky-50 text-sky-700')}`}>
              {subtitle || 'Internship Management System'}
            </span>
            {!isStudent ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 shadow-[0_0_0_6px_rgba(59,130,246,0.12)]" /> : null}
            {isStudent ? <span className="inline-flex h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_0_6px_rgba(244,63,94,0.12)]" /> : null}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-sm ${isEmployer ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : isStudent ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-sky-100 bg-white text-sky-700'}`} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path d="M12 7v10" />
                <path d="M7.5 9.5L12 12l4.5-2.5" />
              </svg>
            </span>
            <div className="min-w-0">
              <h1 className={`mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-[2rem] ${titleClass}`}>{title || 'Dashboard'}</h1>
            </div>
          </div>

        </div>

        <div className="flex items-center gap-3">
          {/* ── Bell quick-view dropdown ── */}
          <div className="relative" ref={bellRef}>
            <button
              type="button"
              onClick={() => setBellOpen((v) => !v)}
              aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
              title="Notifications"
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border shadow-sm transition ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-500 hover:text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-sky-200 hover:text-slate-900'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {unreadCount > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white shadow">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : null}
            </button>

            {/* Dropdown panel */}
            {bellOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_50px_rgba(15,23,42,0.16)]">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">Notifications</span>
                    {unreadCount > 0 ? (
                      <span className="inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                        {unreadCount} new
                      </span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setBellOpen(false); navigate(notificationsRoute); }}
                    className="text-[11px] font-semibold text-sky-600 transition hover:text-sky-700"
                  >
                    View all
                  </button>
                </div>

                {/* Notification list */}
                <div className="max-h-[22rem] overflow-y-auto [scrollbar-width:thin]">
                  {quickViewItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                        <svg className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                          <path d="M13.73 21a2 2 0 01-3.46 0" />
                        </svg>
                      </div>
                      <p className="text-sm font-semibold text-slate-700">You're all caught up!</p>
                      <p className="mt-1 text-xs text-slate-400">No new notifications right now.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {quickViewItems.map((notif) => {
                        const id = String(notif._id || notif.id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => handleBellItemClick(id)}
                            className="w-full bg-sky-50/50 px-4 py-3 text-left transition hover:bg-sky-100/60"
                          >
                            <div className="flex items-start gap-3">
                              {/* Unread dot — always shown since list is unread-only */}
                              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold leading-snug text-slate-900">
                                  {notif.title || 'Notification'}
                                </p>
                                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                  {notif.message || ''}
                                </p>
                              </div>
                              <span className="shrink-0 text-[10px] font-medium text-slate-400">
                                {formatQuickTime(notif.createdAt || notif.created_at)}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => { setBellOpen(false); navigate(notificationsRoute); }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    Open Notifications
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 10h12M10 4l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

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

                    {/* Profile action button removed as requested */}
                  </div>

                  <p className={menuHintClass}>{menuHintText}</p>
                </div>


                <div className="p-2">
                  <Link to={profileRoute} onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                    <span className="flex items-center gap-2.5">
                      <span className={employerActionIconClass}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><circle cx="10" cy="6" r="3" stroke="currentColor" strokeWidth="1.7" /><path d="M4 16a6 6 0 0112 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
                      </span>
                      Manage profile
                    </span>
                  </Link>
                  <Link to={settingsRoute} onClick={() => setMenuOpen(false)} className={menuLinkClass}>
                    <span className="flex items-center gap-2.5">
                      <span className={employerActionIconClass}>
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4"><path d="M10 4.5v1.5M10 14v1.5M5.5 10h1.5M13 10h1.5M7.05 7.05l1.06 1.06M11.9 11.9l1.06 1.06M7.05 12.95l1.06-1.06M11.9 8.1l1.06-1.06" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </span>
                      Settings
                    </span>
                  </Link>
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
