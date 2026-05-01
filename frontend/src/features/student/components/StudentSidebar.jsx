import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </svg>
  );
}

function InternshipIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" />
      <path d="M3 12h18" />
    </svg>
  );
}

function ApplicationsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3h8l5 5v11a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2z" />
      <path d="M16 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0116 0" />
    </svg>
  );
}

function LogbookIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

const links = [
  { to: '/student/dashboard', label: 'Dashboard', icon: <DashboardIcon />, accent: 'from-cyan-500 to-blue-600' },
  { to: '/student/internships', label: 'Internships', icon: <InternshipIcon />, accent: 'from-sky-500 to-cyan-600' },
  { to: '/student/applications', label: 'Applications', icon: <ApplicationsIcon />, accent: 'from-cyan-400 to-sky-500' },
  { to: '/student/logbook', label: 'Logbook', icon: <LogbookIcon />, accent: 'from-blue-500 to-cyan-500' },
  { to: '/student/messages', label: 'Messages', icon: <ApplicationsIcon />, accent: 'from-amber-500 to-orange-600' },
  { to: '/student/settings', label: 'Settings', icon: <ProfileIcon />, accent: 'from-indigo-500 to-violet-600' },
  { to: '/student/profile', label: 'Profile', icon: <ProfileIcon />, accent: 'from-emerald-500 to-teal-600' }
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

export default function StudentSidebar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isGlobalDarkMode, setIsGlobalDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('student_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('student_sidebar_theme');
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
        borderClass: 'border-slate-700/70',
        tagClass: 'text-slate-300',
        subtitleClass: 'text-slate-300/90',
        navHintClass: 'text-slate-300/90',
        inactiveTextClass: 'text-slate-200',
        hoverBgClass: 'hover:bg-slate-800/80'
      };
    }

    return themes[theme] || themes.aurora;
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
      localStorage.setItem('student_sidebar_collapsed', String(collapsed));
    } catch {
      // ignore persistence errors in restricted browser modes
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem('student_sidebar_theme', theme);
    } catch {
      // ignore persistence errors in restricted browser modes
    }
  }, [theme]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.altKey && String(event.key).toLowerCase() === 's') {
        event.preventDefault();
        setCollapsed((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const switchTheme = (nextTheme) => {
    if (!themes[nextTheme] || nextTheme === theme) return;
    setIsThemeSwitching(true);
    setTheme(nextTheme);
    window.setTimeout(() => {
      setIsThemeSwitching(false);
    }, 260);
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

  return (
    <aside className={`relative hidden shrink-0 overflow-hidden border-r text-white transition-all duration-300 lg:flex lg:flex-col ${collapsed ? 'w-24' : 'w-72'} ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
      <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${isThemeSwitching ? 'opacity-10' : 'opacity-0'}`} />
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className={collapsed ? 'hidden' : 'block'}>
            <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${activeTheme.tagClass}`}>Student Portal</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-[1] tracking-tight text-white">Internship Studio</h2>
            <p className={`mt-3 text-sm leading-6 ${activeTheme.subtitleClass}`}>Track progress, applications, and opportunities in one place.</p>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={`${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (Alt+S)`}
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        {collapsed ? (
          <div className="mt-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">SP</span>
          </div>
        ) : null}
      </div>

      <nav className="flex-1 space-y-2 px-4 py-5">
        {!collapsed ? <p className={`px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${activeTheme.navHintClass}`}>Navigation</p> : null}
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${isActive ? 'bg-white text-slate-900 shadow-[0_10px_30px_rgba(7,12,27,0.28)]' : `${activeTheme.inactiveTextClass} ${activeTheme.hoverBgClass} hover:text-white`}`
            }
            title={collapsed ? link.label : undefined}
          >
            {({ isActive }) => (
              <>
                <span className={`grid h-8 w-8 place-items-center rounded-xl shrink-0 ${isActive ? `bg-gradient-to-br ${link.accent} text-white` : 'bg-white/10 text-cyan-100 group-hover:bg-white/20'}`}>
                  {link.icon}
                </span>

                {!collapsed && (
                  <span className="flex-1 font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                    {link.label}
                  </span>
                )}

                {!collapsed && isActive && (
                  <span className="h-2 w-2 rounded-full bg-cyan-500 shrink-0" />
                )}

                {collapsed && (
                  <span className="pointer-events-none absolute left-[78px] top-1/2 z-30 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    {link.label}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        {!collapsed ? (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="mt-4 w-full rounded-xl bg-white/90 px-3 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {signingOut ? 'Signing out...' : 'Sign out'}
          </button>
        ) : (
          <div className="grid place-items-center">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-70"
              title="Sign out"
              aria-label="Sign out"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
