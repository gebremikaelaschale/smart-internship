import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AdminSidebar from '@/features/admin/components/AdminSidebar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

const NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'new-applicant', label: 'Applicants' },
  { key: 'internship-started', label: 'Started' },
  { key: 'deadline-reminder', label: 'Deadlines' }
];

const ADMIN_SEARCH_ACTIONS = [
  { id: 'dashboard', label: 'Dashboard', subtitle: 'System control center', path: '/admin/super-admin' },
  { id: 'users', label: 'Users', subtitle: 'Manage user accounts', path: '/admin/users' },
  { id: 'students', label: 'Students', subtitle: 'Manage student records', path: '/admin/students' },
  { id: 'companies', label: 'Companies', subtitle: 'Manage company partners', path: '/admin/companies' },
  { id: 'internships', label: 'Internships', subtitle: 'Manage internship lifecycle', path: '/admin/internships' },
  { id: 'applications', label: 'Applications', subtitle: 'Review and process applications', path: '/admin/applications' },
  { id: 'colleges', label: 'Colleges', subtitle: 'Manage institution entries', path: '/admin/colleges' },
  { id: 'departments', label: 'Departments', subtitle: 'Manage departments', path: '/admin/departments' },
  { id: 'reports', label: 'Reports', subtitle: 'Operational and compliance reports', path: '/admin/reports' },
  { id: 'certificates', label: 'Certificates', subtitle: 'Issue and verify certificates', path: '/admin/certificates' },
  { id: 'analytics', label: 'Analytics', subtitle: 'Enterprise analytics workspace', path: '/admin/analytics' },
  { id: 'settings', label: 'Settings', subtitle: 'Configure platform policies', path: '/admin/settings' }
];

function formatRelativeTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function resolveAdminNotificationRoute(notification) {
  const directRoute = String(notification?.targetRoute || '').trim();
  if (directRoute.startsWith('/admin/')) return directRoute;

  const combined = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (combined.includes('user')) return '/admin/users';
  if (combined.includes('college')) return '/admin/colleges';
  if (combined.includes('department')) return '/admin/departments';
  return '/admin/super-admin';
}

function AdminLayoutActions() {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const searchResults = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return ADMIN_SEARCH_ACTIONS.slice(0, 7);
    return ADMIN_SEARCH_ACTIONS.filter((item) => {
      const combined = `${item.label} ${item.subtitle} ${item.path}`.toLowerCase();
      return combined.includes(q);
    }).slice(0, 8);
  }, [searchQuery]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
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
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

  const submitSearch = (value) => {
    const q = String(value || '').trim();
    if (!q) {
      setSearchOpen(false);
      return;
    }

    if (q.startsWith('/admin/')) {
      setSearchOpen(false);
      navigate(q);
      return;
    }

    const first = searchResults[0];
    if (first?.path) {
      setSearchOpen(false);
      navigate(first.path);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={searchRef}>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((value) => !value);
            setDropdownOpen(false);
          }}
          aria-label="Search admin pages"
          title="Search admin pages"
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
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch(searchQuery);
              }}
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
                  placeholder="Search admin dashboards, users, colleges..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="rounded-full p-1 text-slate-400 transition hover:bg-white hover:text-slate-600"
                    aria-label="Clear search"
                    title="Clear"
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
                  onClick={() => {
                    setSearchOpen(false);
                    navigate(item.path);
                  }}
                  className="mb-1.5 w-full rounded-xl border border-transparent bg-white px-3 py-2 text-left transition hover:border-sky-100 hover:bg-sky-50 last:mb-0"
                >
                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.subtitle}</p>
                </button>
              )) : <p className="px-3 py-6 text-center text-sm text-slate-500">No matching admin pages</p>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      <AdminSidebar className="h-full shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Navbar title="Super Admin Dashboard" subtitle="Administration workspace" actions={<AdminLayoutActions />} />
        <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50">
          <div className="flex min-h-full flex-col">
            <main className="flex-1 min-h-0 p-6 lg:p-8">
              <Outlet />
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
