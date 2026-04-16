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

function GridIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <rect x="13" y="13" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19a6 6 0 0112 0" />
      <circle cx="17" cy="9" r="2" />
      <path d="M21 19a4.5 4.5 0 00-3.6-4.4" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 6h16v10H8l-4 3V6z" />
    </svg>
  );
}

const links = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <DashboardIcon />, accent: 'from-cyan-500 to-blue-600' },
  { to: '/admin/users', label: 'Users', icon: <UsersIcon />, accent: 'from-emerald-500 to-teal-600' },
  { to: '/admin/students', label: 'Students', icon: <UsersIcon />, accent: 'from-blue-500 to-indigo-600' },
  { to: '/admin/companies', label: 'Companies', icon: <GridIcon />, accent: 'from-violet-500 to-fuchsia-600' },
  { to: '/admin/internships', label: 'Internships', icon: <GridIcon />, accent: 'from-amber-500 to-orange-600' },
  { to: '/admin/applications', label: 'Applications', icon: <GridIcon />, accent: 'from-lime-500 to-emerald-600' },
  { to: '/admin/colleges', label: 'Colleges', icon: <GridIcon />, accent: 'from-sky-500 to-cyan-600' },
  { to: '/admin/departments', label: 'Departments', icon: <GridIcon />, accent: 'from-rose-500 to-pink-600' },
  { to: '/admin/reports', label: 'Reports', icon: <MessageIcon />, accent: 'from-teal-500 to-cyan-600' },
  { to: '/admin/certificates', label: 'Certificates', icon: <GridIcon />, accent: 'from-fuchsia-500 to-rose-600' },
  { to: '/admin/analytics', label: 'Analytics', icon: <GridIcon />, accent: 'from-indigo-500 to-blue-600' },
  { to: '/admin/settings', label: 'Settings', icon: <GridIcon />, accent: 'from-slate-500 to-slate-700' }
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

  return (
    <aside className={`relative hidden shrink-0 overflow-hidden border-r text-white transition-all duration-300 lg:flex lg:flex-col ${collapsed ? 'w-24' : 'w-72'} ${activeTheme.borderClass} ${activeTheme.panelClass}`}>
      <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-300 ${isThemeSwitching ? 'opacity-10' : 'opacity-0'}`} />
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className={collapsed ? 'hidden' : 'block'}>
            <p className={`text-xs font-semibold uppercase tracking-[0.32em] ${activeTheme.tagClass}`}>Admin Console</p>
            <h2 className="mt-2 text-[32px] font-semibold leading-[1] tracking-tight text-white">Internship Studio</h2>
            <p className={`mt-3 text-sm leading-6 ${activeTheme.subtitleClass}`}>Centralized governance for colleges, departments, and users.</p>
          </div>

          <button
            type="button"
            onClick={() => setCollapsed((current) => !current)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={`${collapsed ? 'Expand sidebar' : 'Collapse sidebar'} (Alt+A)`}
          >
            <svg className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>

        {collapsed ? (
          <div className="mt-3 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/70">AC</span>
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
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${isActive ? `bg-gradient-to-br ${link.accent} text-white` : 'bg-white/10 text-cyan-100 group-hover:bg-white/20'}`}>
                  {link.icon}
                </span>

                {!collapsed ? <span className="flex-1">{link.label}</span> : null}
                {!collapsed && isActive ? <span className="h-2 w-2 rounded-full bg-cyan-500" /> : null}

                {collapsed ? (
                  <span className="pointer-events-none absolute left-[78px] top-1/2 z-30 -translate-y-1/2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    {link.label}
                  </span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-6 py-5">
        {!collapsed ? (
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm backdrop-blur">
            <p className={`text-xs font-semibold uppercase tracking-[0.2em] ${activeTheme.tagClass}`}>Theme</p>
            <div className="mt-2 flex items-center gap-2">
              {Object.keys(themes).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTheme(key)}
                  disabled={isGlobalDarkMode}
                  className={`h-4 w-4 rounded-full ring-2 transition ${theme === key ? 'ring-white' : 'ring-transparent hover:ring-white/40'} ${key === 'aurora' ? 'bg-cyan-400' : key === 'midnight' ? 'bg-violet-400' : 'bg-emerald-400'} ${isGlobalDarkMode ? 'cursor-not-allowed opacity-45 hover:ring-transparent' : ''}`}
                  aria-label={`Switch to ${themes[key].label} theme`}
                  title={isGlobalDarkMode ? 'Disabled while global dark mode is active' : themes[key].label}
                />
              ))}
              <span className={`ml-1 text-xs ${activeTheme.subtitleClass}`}>{activeTheme.label}</span>
            </div>

            {isGlobalDarkMode ? (
              <p className="mt-2 text-xs text-slate-300/90">Global dark mode is active. Sidebar follows dark palette automatically.</p>
            ) : null}

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-4 w-full rounded-xl bg-white/90 px-3 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>
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
