import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import EmployerSidebar from '@/features/employer/components/EmployerSidebar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { employerAPI } from '@/features/employer/employerAPI';

const NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'new-applicant', label: 'Applicants' },
  { key: 'internship-started', label: 'Started' },
  { key: 'deadline-reminder', label: 'Deadlines' }
];

const EMPLOYER_SEARCH_ACTIONS = [
  { id: 'dashboard', label: 'Dashboard Overview', subtitle: 'Main employer dashboard', path: '/employer/dashboard' },
  { id: 'profile', label: 'Company Profile', subtitle: 'Edit your organization profile and logo', path: '/employer/profile' },
  { id: 'post', label: 'Post Internship', subtitle: 'Create a new internship opening', path: '/employer/post-internship' },
  { id: 'programs', label: 'My Programs', subtitle: 'Manage posted internships', path: '/employer/my-programs' },
  { id: 'applicants', label: 'Applicants', subtitle: 'Review student applications', path: '/employer/applicants' },
  { id: 'active', label: 'Active Interns', subtitle: 'Track current intern progress', path: '/employer/active-interns' },
  { id: 'evaluation', label: 'Evaluation', subtitle: 'Submit student evaluations', path: '/employer/evaluation' },
  { id: 'reports', label: 'Reports', subtitle: 'Performance summaries and outcomes', path: '/employer/reports' },
  { id: 'activity', label: 'Activity', subtitle: 'Recent employer-side events', path: '/employer/activity' },
  { id: 'messages', label: 'Messages', subtitle: 'Open enterprise messaging', path: '/employer/messages' }
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

function resolveEmployerNotificationRoute(notification) {
  const directRoute = String(notification?.targetRoute || '').trim();
  if (directRoute.startsWith('/employer/')) return directRoute;

  const combined = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (combined.includes('applicant') || combined.includes('application')) return '/employer/applicants';
  if (combined.includes('deadline')) return '/employer/my-programs';
  return '/employer/dashboard';
}

function EmployerLayoutActions() {
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const searchResults = useMemo(() => {
    const q = String(searchQuery || '').trim().toLowerCase();
    if (!q) return EMPLOYER_SEARCH_ACTIONS.slice(0, 7);
    return EMPLOYER_SEARCH_ACTIONS.filter((item) => {
      const combined = `${item.label} ${item.subtitle} ${item.path}`.toLowerCase();
      return combined.includes(q);
    }).slice(0, 8);
  }, [searchQuery]);

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const params = {
        limit: 25,
        skip: 0,
        unreadOnly: notificationFilter === 'unread',
        category: ['new-applicant', 'internship-started', 'deadline-reminder'].includes(notificationFilter) ? notificationFilter : undefined
      };
      const { data } = await employerAPI.getNotifications(params);
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const unread = Number.isFinite(Number(data?.unreadCount))
        ? Number(data.unreadCount)
        : items.filter((item) => !item?.isRead).length;
      setNotifications(items);
      setUnreadCount(unread);
    } catch {
      if (!silent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [notificationFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => loadNotifications({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
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

  const markAsRead = async (id) => {
    let changed = false;
    setNotifications((prev) => prev.map((item) => {
      if (item._id !== id || item?.isRead) return item;
      changed = true;
      return { ...item, isRead: true };
    }));
    if (changed) setUnreadCount((prev) => Math.max(prev - 1, 0));
    await employerAPI.markNotificationRead(id).catch(() => {});
    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    await employerAPI.markAllNotificationsRead().catch(() => {});
    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const removeNotification = async (id) => {
    let removedUnread = false;
    setNotifications((prev) => {
      const item = prev.find((entry) => entry._id === id);
      removedUnread = Boolean(item && !item.isRead);
      return prev.filter((entry) => entry._id !== id);
    });
    if (removedUnread) setUnreadCount((prev) => Math.max(prev - 1, 0));
    await employerAPI.deleteNotification(id).catch(() => {});
    loadNotifications({ silent: true });
  };

  const onNotificationClick = async (item) => {
    if (!item?.isRead) await markAsRead(item._id);
    setDropdownOpen(false);
    navigate(resolveEmployerNotificationRoute(item));
  };

  const submitSearch = (value) => {
    const q = String(value || '').trim();
    if (!q) {
      setSearchOpen(false);
      return;
    }

    if (q.startsWith('/employer/')) {
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
      <div className="relative" ref={notificationRef}>
        <button
          type="button"
          onClick={() => {
            setDropdownOpen((value) => !value);
            setSearchOpen(false);
            loadNotifications({ silent: true });
          }}
          aria-label="Alerts"
          title="Alerts"
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-sky-100 bg-white text-slate-600 shadow-sm transition hover:border-sky-200 hover:text-slate-900"
        >
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
            <path d="M12 3a6 6 0 00-6 6v3.5l-1.3 2.6A1 1 0 005.6 17h12.8a1 1 0 00.9-1.4L18 12.5V9a6 6 0 00-6-6z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M9.5 19a2.5 2.5 0 005 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-none text-white shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          ) : null}
        </button>

        {dropdownOpen ? (
          <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] sm:w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={markAllAsRead}
              className="text-xs font-semibold text-sky-600 transition hover:text-sky-700"
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>

          <div className="flex flex-wrap gap-1 border-b border-slate-100 px-3 py-2">
            {NOTIFICATION_FILTERS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setNotificationFilter(tab.key)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${notificationFilter === tab.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {loading ? <p className="px-3 py-6 text-center text-sm text-slate-500">Loading notifications...</p> : null}
            {!loading && notifications.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">No new notifications</p> : null}
            {!loading && notifications.map((item) => (
              <div key={item._id} className={`mb-1.5 flex items-start gap-2 rounded-xl px-2 py-2 transition last:mb-0 ${item?.isRead ? 'bg-white hover:bg-slate-50' : 'bg-sky-50 hover:bg-sky-100'}`}>
                <button type="button" onClick={() => onNotificationClick(item)} className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left">
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item?.title || 'Notification'}</p>
                  <p className="mt-1 line-clamp-1 text-xs text-slate-600">{item?.message || ''}</p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{formatRelativeTime(item?.createdAt)}</span>
                    {!item?.isRead ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeNotification(item._id)}
                  className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-rose-500"
                  aria-label="Remove notification"
                  title="Remove notification"
                >
                  <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                    <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          </div>
        ) : null}
      </div>

      <div className="relative" ref={searchRef}>
        <button
          type="button"
          onClick={() => {
            setSearchOpen((value) => !value);
            setDropdownOpen(false);
          }}
          aria-label="Search employer pages"
          title="Search employer pages"
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
                  placeholder="Search dashboard, applicants, reports..."
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
              )) : <p className="px-3 py-6 text-center text-sm text-slate-500">No matching employer pages</p>}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function EmployerLayout() {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <EmployerSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title="Industry Partner Dashboard" subtitle="Industry Partner workspace" actions={<EmployerLayoutActions />} />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
