import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import useMessageUnreadCount from '@/hooks/useMessageUnreadCount';
import useNotificationCount from '@/hooks/useNotificationCount';

function StudioEmblem() {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white shadow-sm transition hover:scale-105 duration-300">
      <img src="/uog-logo.jpg" alt="University Logo" className="h-full w-full object-cover" />
    </div>
  );
}

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

function CompanyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* Ground */}
      <line x1="2" y1="20" x2="22" y2="20" />
      {/* Sawtooth Industry Structure */}
      <path d="M17 20V10l-6 4V10l-6 4v6" />
      {/* Chimney / Smokestack */}
      <path d="M17 14h3a1 1 0 001-1V5a1 1 0 00-1-1h-1a1 1 0 00-1 1v9" />
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

function MessageIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function InstitutionIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 20 17" />
      <polyline points="4 20 20 20" />
      <polygon points="12 4 3 9 21 9" />
      <line x1="6" y1="12" x2="6" y2="17" />
      <line x1="10" y1="12" x2="10" y2="17" />
      <line x1="14" y1="12" x2="14" y2="17" />
      <line x1="18" y1="12" x2="18" y2="17" />
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

function ListIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

function BellIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

const links = [
  { to: '/admin/super-admin', label: 'Dashboard', icon: <DashboardIcon />, accent: 'from-cyan-500 to-blue-600', softClass: 'bg-cyan-50 text-cyan-600 border border-cyan-100/30 dark:bg-cyan-950/40 dark:text-cyan-400 dark:border-cyan-900/30' },
  { to: '/admin/profile', label: 'Profile', icon: <ProfileIcon />, accent: 'from-blue-500 to-indigo-600', softClass: 'bg-blue-50 text-blue-600 border border-blue-100/30 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30' },
  { to: '/admin/users', label: 'Users', icon: <UsersIcon />, accent: 'from-emerald-500 to-teal-600', softClass: 'bg-emerald-50 text-emerald-600 border border-emerald-100/30 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30' },
  { to: '/admin/students', label: 'Students', icon: <StudentIcon />, accent: 'from-blue-500 to-indigo-600', softClass: 'bg-blue-50 text-blue-600 border border-blue-100/30 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30' },
  { to: '/admin/companies', label: 'Industry Partners', icon: <CompanyIcon />, accent: 'from-amber-500 to-orange-600', softClass: 'bg-amber-50 text-amber-600 border border-amber-100/30 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30' },
  { to: '/admin/internships', label: 'Internships', icon: <BriefcaseIcon />, accent: 'from-violet-500 to-fuchsia-600', softClass: 'bg-violet-50 text-violet-600 border border-violet-100/30 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/30' },
  { to: '/admin/applications', label: 'Applications', icon: <ApplicationIcon />, accent: 'from-teal-500 to-emerald-600', softClass: 'bg-teal-50 text-teal-600 border border-teal-100/30 dark:bg-teal-950/40 dark:text-teal-400 dark:border-teal-900/30' },
  { to: '/admin/colleges', label: 'Colleges', icon: <InstitutionIcon />, accent: 'from-rose-500 to-pink-600', softClass: 'bg-rose-50 text-rose-600 border border-rose-100/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30' },
  { to: '/admin/departments', label: 'Departments', icon: <FolderIcon />, accent: 'from-indigo-500 to-blue-600', softClass: 'bg-indigo-50 text-indigo-600 border border-indigo-100/30 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-900/30' },
  { to: '/admin/evaluations', label: 'Evaluations', icon: <ListIcon />, accent: 'from-orange-500 to-red-600', softClass: 'bg-orange-50 text-orange-600 border border-orange-100/30 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-900/30' },
  { to: '/admin/reports', label: 'Reports', icon: <ApplicationIcon />, accent: 'from-sky-500 to-cyan-600', softClass: 'bg-sky-50 text-sky-600 border border-sky-100/30 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-900/30' },
  { to: '/admin/certificates', label: 'Certificates', icon: <AwardIcon />, accent: 'from-fuchsia-500 to-rose-600', softClass: 'bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100/30 dark:bg-fuchsia-950/40 dark:text-fuchsia-400 dark:border-fuchsia-900/30' },
  { to: '/admin/messages', label: 'Messages', icon: <MessageIcon />, accent: 'from-rose-500 to-pink-600', softClass: 'bg-rose-50 text-rose-600 border border-rose-100/30 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/30' },
  { to: '/admin/notifications', label: 'Notifications', icon: <BellIcon />, accent: 'from-violet-500 to-purple-600', softClass: 'bg-violet-50 text-violet-600 border border-violet-100/30 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-900/30' },
  { to: '/admin/settings', label: 'Settings', icon: <SettingsIcon />, accent: 'from-slate-600 to-slate-800', softClass: 'bg-slate-100 text-slate-600 border border-slate-200/50 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/50' }
];

const themes = {
  aurora: {
    label: 'Ocean Aurora',
    panelClass: 'bg-[radial-gradient(140%_140%_at_0%_0%,#153f87_0%,#102d63_35%,#0d234d_100%)]',
    borderClass: 'border-cyan-200/40',
    tagClass: 'text-cyan-200',
    subtitleClass: 'text-cyan-100/90',
    navHintClass: 'text-cyan-200/90',
    inactiveTextClass: 'text-cyan-100',
    hoverBgClass: 'hover:bg-white/10'
  },
  midnight: {
    label: 'Midnight Neon',
    panelClass: 'bg-[radial-gradient(140%_140%_at_0%_0%,#2a175b_0%,#1a1044_40%,#100a2d_100%)]',
    borderClass: 'border-violet-200/30',
    tagClass: 'text-violet-200',
    subtitleClass: 'text-violet-100/90',
    navHintClass: 'text-violet-200/90',
    inactiveTextClass: 'text-violet-100',
    hoverBgClass: 'hover:bg-white/10'
  },
  forest: {
    label: 'Emerald Forest',
    panelClass: 'bg-[radial-gradient(140%_140%_at_0%_0%,#0f5132_0%,#0e3c2b_40%,#0b2c21_100%)]',
    borderClass: 'border-emerald-200/30',
    tagClass: 'text-emerald-200',
    subtitleClass: 'text-emerald-100/90',
    navHintClass: 'text-emerald-200/90',
    inactiveTextClass: 'text-emerald-100',
    hoverBgClass: 'hover:bg-white/10'
  }
};

export default function AdminSidebar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isGlobalDarkMode, setIsGlobalDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const notificationCount = useNotificationCount();
  const messageUnreadCount = useMessageUnreadCount();
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('admin_sidebar_theme');
      return saved && themes[saved] ? saved : 'aurora';
    } catch {
      return 'aurora';
    }
  });
  const [isThemeSwitching, setIsThemeSwitching] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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
        iconBgClass: 'bg-slate-800 text-slate-300 group-hover:bg-slate-700',
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
      iconBgClass: 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100/70',
      btnClass: 'border-indigo-100 bg-white text-slate-600 hover:bg-indigo-50'
    };
  }, [theme, isGlobalDarkMode]);

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
      localStorage.setItem('admin_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore persistence errors
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('admin_sidebar_theme', theme);
    } catch {
      // ignore persistence errors
    }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey && String(event.key).toLowerCase() === 'a') {
        event.preventDefault();
        setCollapsed((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const switchTheme = (nextTheme) => {
    if (!themes[nextTheme] || nextTheme === theme) return;
    setIsThemeSwitching(true);
    setTheme(nextTheme);
    window.setTimeout(() => setIsThemeSwitching(false), 260);
  };

  const handleSignOut = async () => {
    try {
      setSigningOut(true);
      await auth?.logout?.();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  const visibleLinks = useMemo(() => {
    const adminType = String(auth?.user?.adminType || '').toLowerCase();
    if (adminType === 'superadmin') {
      return links.filter(link => link.to !== '/admin/evaluations' && link.to !== '/admin/certificates' && link.to !== '/admin/reports');
    }
    return links;
  }, [auth?.user?.adminType]);

  return (
    <aside className={`relative hidden shrink-0 overflow-hidden border-r transition-all duration-300 lg:flex lg:flex-col ${collapsed ? 'w-24' : 'w-72'} ${activeTheme.textClass} ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
      <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${isThemeSwitching ? 'opacity-10' : 'opacity-0'}`} />
      <div className={`border-b px-6 py-6 ${isGlobalDarkMode ? 'border-white/10' : 'border-indigo-100/70'}`}>
        <div className="flex items-start justify-between gap-2">
          <div className={collapsed ? 'hidden' : 'block'}>
            <div className="flex items-center gap-4">
              <StudioEmblem />
              <div>
                <h2 className={`text-xl font-bold leading-tight tracking-tight ${activeTheme.titleClass}`}>Internship</h2>
                <h2 className="text-[10px] font-bold tracking-[0.24em] text-cyan-600 dark:text-cyan-400 uppercase">Studio</h2>
              </div>
            </div>

            <div className="mt-4 flex">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1 text-[10px] font-bold tracking-wider text-cyan-700 dark:text-cyan-400 border border-cyan-100/50 dark:border-cyan-900/30 uppercase shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
                Super Admin
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition ${activeTheme.btnClass}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={`${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (Alt+A)`}
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        {collapsed ? (
          <div className="mt-1 flex justify-center">
            <StudioEmblem />
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 px-4 py-5 overflow-y-auto min-h-0 [scrollbar-width:thin]">
        {visibleLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? activeTheme.activeLinkClass : `${activeTheme.inactiveTextClass} ${activeTheme.hoverBgClass} hover:text-slate-900 dark:hover:text-white`}`
            }
            title={collapsed ? link.label : undefined}
          >
            {({ isActive }) => (
              <>
                <span className={`grid h-8 w-8 place-items-center rounded-xl transition-all duration-300 ${isActive ? `bg-gradient-to-br ${link.accent} text-white shadow-[0_4px_12px_rgba(0,0,0,0.08)] scale-110` : `${link.softClass} group-hover:scale-105`}`}>
                  {link.icon}
                </span>

                {!collapsed ? <span className="flex-1">{link.label}</span> : null}
                {!collapsed && link.to === '/admin/messages' && messageUnreadCount > 0 ? (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 border border-white px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                    {messageUnreadCount > 99 ? '99+' : messageUnreadCount}
                  </span>
                ) : null}
                {!collapsed && link.to === '/admin/notifications' && notificationCount > 0 ? (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                ) : null}
                {!collapsed && isActive && link.to !== '/notifications' ? <span className="h-2 w-2 rounded-full bg-cyan-500" /> : null}

                {collapsed ? (
                  <>
                    <span className="pointer-events-none absolute left-[78px] top-1/2 z-30 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {link.label}
                    </span>
                    {link.to === '/admin/messages' && messageUnreadCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 border border-white text-[9px] font-bold leading-none text-white shadow-sm">
                        {messageUnreadCount > 9 ? '9+' : messageUnreadCount}
                      </span>
                    ) : null}
                    {link.to === '/admin/notifications' && notificationCount > 0 ? (
                      <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold leading-none text-white shadow-sm">
                        {notificationCount > 99 ? '99+' : notificationCount}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t px-6 py-5 ${isGlobalDarkMode ? 'border-white/10' : 'border-indigo-100/70'}`}>
        {!collapsed ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="group mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition-all hover:bg-slate-100 hover:border-slate-300 hover:text-slate-800 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-400 dark:hover:bg-slate-800/80 dark:hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            <svg className="h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>{signingOut ? 'Signing out...' : 'Sign out'}</span>
          </button>
        ) : (
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
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
    </aside>
  );
}

