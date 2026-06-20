import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import useAuth from '@/hooks/useAuth';
import Modal from '@/components/common/Modal';
import { authAPI } from '@/features/auth/authAPI';
import useNotificationCount from '@/hooks/useNotificationCount';

const DEAN_SEARCH_ACTIONS = [
  { id: 'overview', label: 'Overview', subtitle: 'Dean dashboard home', path: '/dean/dashboard' },
  { id: 'profile', label: 'Profile', subtitle: 'Manage your dean profile', path: '/dean/profile' },
  { id: 'departments', label: 'Departments', subtitle: 'View and manage departments', path: '/dean/departments' },
  { id: 'hod', label: 'HOD Management', subtitle: 'Manage heads of department', path: '/dean/hod-management' },
  { id: 'students', label: 'Students', subtitle: 'Browse student records', path: '/dean/students' },
  { id: 'internships', label: 'Internships', subtitle: 'Manage internships', path: '/dean/internships' },
  { id: 'requests', label: 'Requests / Approvals', subtitle: 'Review and approve requests', path: '/dean/requests' },
  { id: 'messages', label: 'Messages', subtitle: 'Internal messaging', path: '/dean/messages' },
  { id: 'settings', label: 'Settings', subtitle: 'Configure dean preferences', path: '/dean/settings' }
];

const HOD_SEARCH_ACTIONS = [
  { id: 'overview', label: 'Overview', subtitle: 'HOD dashboard home', path: '/hod/dashboard' },
  { id: 'profile', label: 'Profile', subtitle: 'Manage your HOD profile', path: '/hod/profile' },
  { id: 'students', label: 'Students', subtitle: 'Browse department students', path: '/hod/students' },
  { id: 'bulk-verify', label: 'Bulk Verify', subtitle: 'Upload student verification CSV', path: '/hod/bulk-verify' },
  { id: 'applications', label: 'Applications', subtitle: 'Review department applications', path: '/hod/applications' },
  { id: 'evaluations', label: 'Completed Evaluations', subtitle: 'View and download official evaluations', path: '/hod/evaluations' },
  { id: 'companies', label: 'Industry Partners', subtitle: 'Browse department industry partners', path: '/hod/companies' },
  { id: 'messages', label: 'Messages', subtitle: 'Internal messaging', path: '/hod/messages' },
  { id: 'internships', label: 'Internships', subtitle: 'Manage department internships', path: '/hod/internships' },
  { id: 'settings', label: 'Settings', subtitle: 'Manage HOD account security', path: '/hod/settings' }
];

// Premium Geometric Visual Anchor Logo
function StudioEmblem() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white shadow-sm transition hover:scale-105 duration-300">
      <img src="/uog-logo.jpg" alt="University Logo" className="h-full w-full object-cover" />
    </div>
  );
}

// Premium High-Fidelity SVG Icons (Standardized across all layouts)
function DashboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function StudentIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  );
}

function ApplicationIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function navIcon(kind) {
  switch (kind) {
    case 'overview':
      return <DashboardIcon />;
    case 'profile':
      return <ProfileIcon />;
    case 'departments':
      return <FolderIcon />;
    case 'hod':
      return <UsersIcon />;
    case 'students':
      return <StudentIcon />;
    case 'analytics':
      return <DashboardIcon />;
    case 'internships':
      return <BriefcaseIcon />;
    case 'requests':
      return <ApplicationIcon />;
    case 'evaluations':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
          <path d="M14 3v6h6" />
          <path d="M9 13h6" />
          <path d="M9 17h6" />
        </svg>
      );
    case 'messages':
      return <MessageIcon />;
    case 'bulk-verify':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
          <path d="M3 9h18" />
          <path d="M7 13h4" />
          <path d="M7 17h4" />
        </svg>
      );
    case 'notifications':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      );
    case 'settings':
      return <SettingsIcon />;
    case 'bulk-verify':
      return (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
          <path d="M3 9h18" />
          <path d="M7 13h4" />
          <path d="M7 17h4" />
        </svg>
      );
    default:
      return <MessageIcon />;
  }
}

function getSoftThemeForIcon(kind) {
  switch (kind) {
    case 'overview':
      return { accent: 'from-cyan-500 to-blue-600', softClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100/30 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/30' };
    case 'profile':
      return { accent: 'from-blue-500 to-indigo-600', softClass: 'bg-blue-50 text-blue-600 border border-blue-100/30 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30' };
    case 'departments':
      return { accent: 'from-indigo-500 to-blue-600', softClass: 'bg-indigo-50 text-indigo-600 border border-indigo-100/30 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30' };
    case 'hod':
      return { accent: 'from-emerald-500 to-teal-600', softClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100/30 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' };
    case 'students':
      return { accent: 'from-blue-500 to-indigo-600', softClass: 'bg-blue-50 text-blue-600 border border-blue-100/30 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30' };
    case 'analytics':
      return { accent: 'from-cyan-500 to-blue-600', softClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100/30 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/30' };
    case 'requests':
      return { accent: 'from-teal-500 to-emerald-600', softClass: 'bg-teal-50 text-teal-600 border border-teal-100/30 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/30' };
    case 'evaluations':
      return { accent: 'from-emerald-500 to-teal-600', softClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100/30 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' };
    case 'messages':
      return { accent: 'from-rose-500 to-pink-600', softClass: 'bg-rose-50 text-rose-600 border border-rose-100/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30' };
    case 'notifications':
      return { accent: 'from-violet-500 to-purple-600', softClass: 'bg-violet-50 text-violet-600 border border-violet-100/30 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/30' };
    case 'settings':
      return { accent: 'from-slate-600 to-slate-800', softClass: 'bg-slate-100 text-slate-600 border border-slate-200/50 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50' };
    case 'bulk-verify':
      return { accent: 'from-indigo-500 to-violet-600', softClass: 'bg-indigo-50 text-indigo-700 border border-indigo-100/40 dark:bg-violet-950/40 dark:text-violet-300 dark:border-violet-900/30' };
    default:
      return { accent: 'from-cyan-500 to-blue-600', softClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100/30 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/30' };
  }
}

function navItemsForRole(role) {
  if (role === 'dean') {
    return [
      { type: 'route', to: '/dean/dashboard', label: 'Overview', icon: 'overview' },
      { type: 'route', to: '/dean/profile', label: 'Profile', icon: 'profile' },
      { type: 'route', to: '/dean/departments', label: 'Departments', icon: 'departments' },
      { type: 'route', to: '/dean/hod-management', label: 'HOD Management', icon: 'hod' },
      { type: 'route', to: '/dean/students', label: 'Students', icon: 'students' },
      { type: 'route', to: '/dean/internships', label: 'Internships', icon: 'internships' },
      { type: 'route', to: '/dean/requests', label: 'Requests / Approvals', icon: 'requests' },
      { type: 'route', to: '/dean/messages', label: 'Messages', icon: 'messages' },
      { type: 'route', to: '/dean/notifications', label: 'Notifications', icon: 'notifications' },
      { type: 'route', to: '/dean/settings', label: 'Settings', icon: 'settings' }
    ];
  }

  return [
    { type: 'route', to: '/hod/dashboard', label: 'Overview', icon: 'overview' },
    { type: 'route', to: '/hod/profile', label: 'Profile', icon: 'profile' },
    { type: 'route', to: '/hod/students', label: 'Students', icon: 'students' },
    { type: 'route', to: '/hod/bulk-verify', label: 'Bulk Verify', icon: 'bulk-verify' },
    { type: 'route', to: '/hod/applications', label: 'Applications', icon: 'requests' },
    { type: 'route', to: '/hod/evaluations', label: 'Completed Evaluations', icon: 'evaluations' },
    { type: 'route', to: '/hod/companies', label: 'Industry Partners', icon: 'hod' },
    { type: 'route', to: '/hod/internships', label: 'Internships', icon: 'internships' },
    { type: 'route', to: '/hod/messages', label: 'Messages', icon: 'messages' },
    { type: 'route', to: '/hod/notifications', label: 'Notifications', icon: 'notifications' },
    { type: 'route', to: '/hod/settings', label: 'Settings', icon: 'settings' }
  ];
}

function GovernanceSidebar({ mobile = false }) {
  const auth = useAuth();
  const role = String(auth?.user?.role || '').toLowerCase();
  const userName = auth?.user?.fullName || auth?.user?.name || 'User';
  const navigate = useNavigate();
  const notificationCount = useNotificationCount();
  const [isGlobalDarkMode, setIsGlobalDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('governance_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const items = useMemo(() => navItemsForRole(role), [role]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsGlobalDarkMode(root.classList.contains('dark'));
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('governance_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore persistence errors
    }
  }, [collapsed]);

  const activeTheme = useMemo(() => {
    if (isGlobalDarkMode) {
      return {
        label: 'Dark Workspace',
        panelClass: 'bg-[radial-gradient(140%_140%_at_0%_0%,#111827_0%,#0f172a_45%,#020617_100%)]',
        borderClass: 'border-slate-800',
        tagClass: 'text-slate-400',
        subtitleClass: 'text-slate-400',
        navHintClass: 'text-slate-400',
        inactiveTextClass: 'text-slate-300',
        hoverBgClass: 'hover:bg-slate-800/80',
        textClass: 'text-slate-200',
        titleClass: 'text-white',
        activeLinkClass: 'bg-slate-800 text-white shadow-md border border-slate-700/60',
        btnClass: 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
      };
    }
    return {
      label: 'Ocean Aurora White',
      panelClass: 'bg-[linear-gradient(160deg,#eef3ff_0%,#f5f7ff_50%,#f0f4ff_100%)]',
      borderClass: 'border-indigo-100/70',
      tagClass: 'text-indigo-600',
      subtitleClass: 'text-slate-500',
      navHintClass: 'text-slate-400',
      inactiveTextClass: 'text-slate-600',
      hoverBgClass: 'hover:bg-indigo-50/60',
      textClass: 'text-slate-700',
      titleClass: 'text-slate-900',
      activeLinkClass: 'bg-white text-indigo-700 shadow-sm border border-indigo-100/80 font-semibold',
      btnClass: 'border-indigo-100 bg-white text-slate-600 hover:bg-indigo-50'
    };
  }, [isGlobalDarkMode]);

  const handleSignOut = async () => {
    await auth?.logout?.();
    navigate('/login', { replace: true });
  };

  const sidebarContent = (
    <>
      <div className={`border-b px-6 py-6 ${isGlobalDarkMode ? 'border-slate-800' : 'border-indigo-100/70'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className={collapsed && !mobile ? 'hidden' : 'block'}>
            <div className="flex items-center gap-4">
              <StudioEmblem />
              <div>
                <h2 className={`text-xl font-bold leading-tight tracking-tight ${activeTheme.titleClass}`}>Internship</h2>
                <h2 className="text-[10px] font-bold tracking-[0.24em] text-indigo-600 dark:text-indigo-400 uppercase">Studio</h2>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-1.5">
              <div className="flex">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 text-[10px] font-bold tracking-wider text-indigo-700 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30 uppercase shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
                  {role === 'dean' ? 'Dean’s Oversight Dashboard' : 'HOD Dashboard'}
                </span>
              </div>
            </div>
          </div>

          {!mobile ? (
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border transition ${activeTheme.btnClass}`}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={`${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (Alt+A)`}
            >
              <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </button>
          ) : null}
        </div>

        {!mobile && collapsed ? (
          <div className="mt-1 flex justify-center">
            <StudioEmblem />
          </div>
        ) : null}
      </div>

      <nav className={`flex-1 space-y-2 px-4 py-5 overflow-y-auto min-h-0 [scrollbar-width:thin] ${collapsed && !mobile ? 'overflow-visible' : ''}`}>
        {items.map((item) => {
          const cfg = getSoftThemeForIcon(item.icon);

          if (item.type === 'route') {
            return (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.to === '/dean/dashboard' || item.to === '/hod/dashboard'}
                title={!mobile && collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? activeTheme.activeLinkClass : `${activeTheme.inactiveTextClass} ${activeTheme.hoverBgClass} hover:${activeTheme.textClass}`}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`grid h-8 w-8 place-items-center rounded-xl transition-all duration-300 ${isActive ? `bg-gradient-to-br ${cfg.accent} text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] scale-110` : `${cfg.softClass} group-hover:scale-105`}`} aria-hidden>
                      {navIcon(item.icon)}
                    </span>
                    {!collapsed || mobile ? <span className="flex-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis">{item.label}</span> : null}
                    {!collapsed || mobile ? (
                      item.to === '/dean/notifications' || item.to === '/hod/notifications' ? (
                        notificationCount > 0 ? (
                        <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                          {notificationCount > 99 ? '99+' : notificationCount}
                        </span>
                        ) : null
                      ) : (isActive && item.to !== '/dean/notifications' && item.to !== '/hod/notifications' ? <span className="h-2 w-2 rounded-full bg-cyan-500" /> : null)
                    ) : null}
                    {collapsed && !mobile ? (
                      <>
                        <span className="pointer-events-none absolute left-[78px] top-1/2 z-30 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                          {item.label}
                        </span>
                        {(item.to === '/dean/notifications' || item.to === '/hod/notifications') && notificationCount > 0 ? (
                          <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold leading-none text-white shadow-sm">
                            {notificationCount > 99 ? '99+' : notificationCount}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )}
              </NavLink>
            );
          }
          return null;
        })}
      </nav>

      <div className={`border-t px-5 py-5 ${isGlobalDarkMode ? 'border-slate-800' : 'border-indigo-100/70'}`}>
        {/* Security card removed per user request */}

        {!collapsed || mobile ? (
          <button
            type="button"
            onClick={handleSignOut}
            className="group mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300 hover:text-slate-800 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign out</span>
          </button>
        ) : (
          <div className="grid place-items-center mt-4">
            <button
              type="button"
              onClick={handleSignOut}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition-all hover:bg-slate-100/70 hover:border-slate-300 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg className="h-4 w-4 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );

  const shellClass = mobile
    ? `mb-6 overflow-hidden rounded-3xl border transition shadow-sm ${activeTheme.borderClass} ${activeTheme.panelClass} ${activeTheme.textClass}`
    : `relative hidden shrink-0 overflow-hidden border-r transition-all duration-300 lg:flex lg:flex-col ${collapsed ? 'w-24' : 'w-72'} ${activeTheme.borderClass} ${activeTheme.panelClass} ${activeTheme.textClass}`;

  return <aside className={shellClass}>{sidebarContent}</aside>;
}

function GovernanceLayoutActions() {
  const auth = useAuth();
  const navigate = useNavigate();
  const role = String(auth?.user?.role || '').toLowerCase();
  const searchActions = role === 'dean' ? DEAN_SEARCH_ACTIONS : HOD_SEARCH_ACTIONS;

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const searchResults = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return searchActions.slice(0, 6);
    return searchActions.filter((item) => {
      const combined = `${item.label} ${item.subtitle} ${item.path}`.toLowerCase();
      return combined.includes(q);
    }).slice(0, 8);
  }, [searchQuery, searchActions]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

  const submitSearch = (value) => {
    const q = String(value || '').trim();
    if (!q) { setSearchOpen(false); return; }
    const first = searchResults[0];
    if (first?.path) { setSearchOpen(false); navigate(first.path); }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={searchRef}>
        <button
          type="button"
          onClick={() => setSearchOpen((v) => !v)}
          aria-label="Search pages"
          title="Search pages"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-700 text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition hover:brightness-105"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {searchOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
            <form
              onSubmit={(event) => { event.preventDefault(); submitSearch(searchQuery); }}
              className="border-b border-slate-100 p-2"
            >
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 text-slate-500">
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={role === 'dean' ? 'Search dean pages, departments, requests...' : 'Search HOD pages, students...'}
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                    aria-label="Clear search"
                  >
                    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                      <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                ) : null}
              </div>
            </form>

            <div className="max-h-72 overflow-y-auto p-2">
              {searchResults.length > 0 ? searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setSearchOpen(false); navigate(item.path); }}
                  className="mb-1.5 w-full rounded-xl border border-transparent bg-white px-3 py-2 text-left transition hover:border-indigo-100 hover:bg-indigo-50 last:mb-0"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                </button>
              )) : <p className="px-3 py-6 text-center text-sm text-slate-500">No matching pages</p>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-6 10-6c2.4 0 4.4.8 6 1.9" />
      <path d="M22 12s-3.5 6-10 6c-2.4 0-4.4-.8-6-1.9" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export default function GovernanceLayout({ title, subtitle, children }) {
  const auth = useAuth();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isHodLayout = String(auth?.user?.role || '').toLowerCase() === 'hod';

  const closePasswordModal = () => {
    setPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordMessage('');
    setPasswordError('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  useEffect(() => {
    const openPasswordModal = () => setPasswordModalOpen(true);
    window.addEventListener('governance-change-password', openPasswordModal);
    return () => window.removeEventListener('governance-change-password', openPasswordModal);
  }, []);

  useEffect(() => {
    if (!passwordMessage && !passwordError) return undefined;
    const timer = setTimeout(() => {
      setPasswordMessage('');
      setPasswordError('');
    }, 4000);
    return () => clearTimeout(timer);
  }, [passwordMessage, passwordError]);

  const submitPasswordChange = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All password fields are required.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    try {
      setSavingPassword(true);
      const token = auth?.token || localStorage.getItem('token') || '';
      const { data } = await authAPI.changePassword({ currentPassword, newPassword }, token);
      setPasswordMessage(data?.message || 'Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setPasswordError(requestError?.response?.data?.message || 'Unable to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="governance-shell flex h-screen w-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_20%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.08),transparent_24%),#f8fafc] text-slate-900">
      <GovernanceSidebar />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Navbar title={title} subtitle={subtitle} actions={<GovernanceLayoutActions />} />
        <div className="flex-1 min-h-0 overflow-y-auto bg-[#f8fafc]">
          <div className="flex min-h-full flex-col">
            <main className={isHodLayout ? 'flex-1 min-h-0 p-0' : 'flex-1 min-h-0 p-4 md:p-6 lg:p-8'}>
              <div className="lg:hidden">
                <GovernanceSidebar mobile />
              </div>
              {children || <Outlet />}
            </main>
            <Footer />
          </div>
        </div>
      </div>

      <Modal open={passwordModalOpen} title="Change Password" onClose={closePasswordModal}>
        <form className="space-y-4" onSubmit={submitPasswordChange}>
          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Password</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 bg-white">
              <input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="w-full px-4 py-3 text-sm outline-none"
                placeholder="Enter current password"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="px-3 py-2 text-slate-400 hover:text-slate-600 transition"
              >
                {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">New Password</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 bg-white">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full px-4 py-3 text-sm outline-none"
                placeholder="Enter new password"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="px-3 py-2 text-slate-400 hover:text-slate-600 transition"
              >
                {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirm New Password</label>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 bg-white">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-4 py-3 text-sm outline-none"
                placeholder="Confirm new password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="px-3 py-2 text-slate-400 hover:text-slate-600 transition"
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          <p className="text-sm text-slate-600">This updates the real account password used for login. Temporary passwords are only for first-time access or admin resets.</p>

          {passwordError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{passwordError}</p> : null}
          {passwordMessage ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{passwordMessage}</p> : null}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={closePasswordModal} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              Cancel
            </button>
            <button type="submit" disabled={savingPassword} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
