import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import StudentSidebar from '@/features/student/components/StudentSidebar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { studentAPI } from '@/features/student/studentAPI';
import useStudentVerificationSync from '@/hooks/useStudentVerificationSync';

const NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'new-applicant', label: 'Applicants' },
  { key: 'internship-started', label: 'Started' },
  { key: 'deadline-reminder', label: 'Deadlines' }
];

function formatRelativeTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString();
}

function resolveNotificationRoute(notification) {
  const directRoute = String(notification?.targetRoute || '').trim();
  if (directRoute.startsWith('/student/')) return directRoute;

  const combined = `${notification?.type || ''} ${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (combined.includes('application') || combined.includes('apply')) return '/student/applications';
  if (combined.includes('internship') || combined.includes('opening') || combined.includes('vacancy')) return '/student/internships';
  if (combined.includes('profile')) return '/student/profile';
  return '/student/dashboard';
}

const STUDENT_GLOBAL_SEARCH_ROUTES = [
  { id: 'dashboard', label: 'Dashboard', subtitle: 'Open your student dashboard', path: '/student/dashboard', keywords: ['dashboard', 'home', 'overview'] },
  { id: 'messages', label: 'Messages', subtitle: 'Open your inbox and messages', path: '/student/messages', keywords: ['messages', 'message', 'chat', 'inbox'] },
  { id: 'settings', label: 'Settings', subtitle: 'Open account settings', path: '/student/settings', keywords: ['settings', 'preferences', 'account'] },
  { id: 'logbook', label: 'Logbook', subtitle: 'Open your internship logbook', path: '/student/logbook', keywords: ['logbook', 'journal', 'report'] },
  { id: 'applications', label: 'Applications', subtitle: 'Review your internship applications', path: '/student/applications', keywords: ['applications', 'apply', 'applied'] },
  { id: 'profile', label: 'Manage Profile', subtitle: 'Open your student profile', path: '/student/profile', keywords: ['profile', 'bio', 'details'] },
  { id: 'notifications', label: 'Notifications', subtitle: 'Open recent alerts and updates', path: '/student/notifications', keywords: ['notifications', 'alerts', 'bell'] }
];

function NotificationDetailModal({ notification, onClose, onEditProfile }) {
  if (!notification) return null;

  const isVerificationNote = String(notification?.metadata?.kind || '') === 'student-verification' || String(notification?.title || '').toLowerCase().includes('verification');
  const rejectionReason = String(notification?.metadata?.rejectionReason || '').trim() || String(notification?.message || '').trim();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-600">Student Verification</p>
            <h3 className="mt-1 text-lg font-semibold text-slate-900">{notification.title || 'Notification details'}</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close notification detail">
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-5 w-5">
              <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {notification.message}
          </div>

          {isVerificationNote ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">HOD Comment</div>
              <p className="mt-1 leading-6">{rejectionReason || 'No specific reason was provided.'}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onClose} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Close</button>
            {isVerificationNote ? (
              <button type="button" onClick={onEditProfile} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800">Edit profile</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentLayoutActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!location.pathname.startsWith('/student/internships')) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const nextQuery = String(params.get('q') || '').trim();
    setSearchQuery((prev) => (prev === nextQuery ? prev : nextQuery));
  }, [location.pathname, location.search]);

  useEffect(() => {
    let active = true;
    const q = String(searchQuery || '').trim();

    if (!searchOpen || !q) {
      setSearchSuggestions(STUDENT_GLOBAL_SEARCH_ROUTES.slice(0, 5));
      return () => {
        active = false;
      };
    }

    const loadSearchSuggestions = async () => {
      setIsLoadingSuggestions(true);
      try {
        const routeMatches = STUDENT_GLOBAL_SEARCH_ROUTES.filter((item) => {
          const normalized = `${item.label} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
          return normalized.includes(q.toLowerCase());
        });

        const { data } = await studentAPI.getInternshipSuggestions(q);
        if (!active) return;

        const internshipMatches = Array.isArray(data) ? data.map((item) => ({
          ...item,
          type: 'internship',
          path: `/student/internships?q=${encodeURIComponent(q)}`
        })) : [];

        const combined = [
          ...routeMatches.slice(0, 4).map((item) => ({ ...item, type: 'route' })),
          ...internshipMatches
        ].slice(0, 10);

        setSearchSuggestions(combined);
      } catch {
        if (!active) return;
        setSearchSuggestions(STUDENT_GLOBAL_SEARCH_ROUTES.slice(0, 5));
      } finally {
        if (active) setIsLoadingSuggestions(false);
      }
    };

    const timer = window.setTimeout(loadSearchSuggestions, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const submitSearch = (value) => {
    const nextQuery = String(value || '').trim();
    setSearchOpen(false);
    setSearchSuggestions([]);

    if (!nextQuery) {
      navigate('/student/internships');
      return;
    }

    const matchedRoute = STUDENT_GLOBAL_SEARCH_ROUTES.find((item) => {
      const normalized = `${item.label} ${item.subtitle} ${item.keywords.join(' ')}`.toLowerCase();
      return normalized === nextQuery.toLowerCase() || item.path.toLowerCase() === nextQuery.toLowerCase();
    });

    if (matchedRoute) {
      navigate(matchedRoute.path);
      return;
    }

    const pageRoute = searchSuggestions.find((item) => item.type === 'route' && `${item.label}`.toLowerCase() === nextQuery.toLowerCase());
    if (pageRoute && pageRoute.path) {
      navigate(pageRoute.path);
      return;
    }

    navigate(`/student/internships?q=${encodeURIComponent(nextQuery)}`);
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
          aria-label="Search internships"
          title="Search internships"
          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-blue-700 text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)] transition hover:brightness-105"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        {searchOpen ? (
          <div className="panel-pop absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(26rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)]">
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
                  placeholder="Search internships, messages, settings, logbook..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchSuggestions(STUDENT_GLOBAL_SEARCH_ROUTES.slice(0, 5));
                    }}
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
              {isLoadingSuggestions ? (
                <p className="px-3 py-4 text-sm text-slate-500">Loading suggestions...</p>
              ) : searchSuggestions.length > 0 ? searchSuggestions.map((item) => (
                <button
                  key={`${item.type || 'route'}-${item.id}`}
                  type="button"
                  onClick={() => submitSearch(item.label || item.title)}
                  className="mb-1 block w-full rounded-xl px-3 py-2 text-left transition last:mb-0 hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.label || item.title}</p>
                      <p className="text-xs text-slate-500">{item.subtitle || 'Search result'}</p>
                    </div>
                    {item.type === 'internship' ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Internship</span>
                    ) : (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600">Route</span>
                    )}
                  </div>
                </button>
              )) : (
                <p className="px-3 py-4 text-sm text-slate-500">{searchQuery.trim() ? 'No matching suggestions' : 'Type to search internships, pages, or settings'}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StudentLayout() {
  useStudentVerificationSync();

  return (
    <div className="student-shell flex h-screen w-screen overflow-hidden bg-[linear-gradient(180deg,#f8fbff_0%,#f6faff_45%,#f8fafc_100%)]">
      <StudentSidebar className="h-full shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        <Navbar title="Student Dashboard" subtitle="Student workspace" actions={<StudentLayoutActions />} />
        <div className="flex-1 min-h-0 overflow-y-auto bg-[linear-gradient(180deg,#f8fbff_0%,#f6faff_45%,#f8fafc_100%)]">
          <div className="flex min-h-full flex-col">
            <main className="flex-1 min-h-0">
              <Outlet />
            </main>
            <Footer />
          </div>
        </div>
      </div>
    </div>
  );
}
