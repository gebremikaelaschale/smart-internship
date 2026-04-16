import React, { useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import StudentSidebar from '@/features/student/components/StudentSidebar';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { studentAPI } from '@/features/student/studentAPI';

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

function StudentLayoutActions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const searchRef = useRef(null);
  const searchInputRef = useRef(null);

  const loadNotifications = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoadingNotifications(true);
    }

    try {
      const params = {
        limit: 25,
        skip: 0,
        unreadOnly: notificationFilter === 'unread',
        category: ['new-applicant', 'internship-started', 'deadline-reminder'].includes(notificationFilter) ? notificationFilter : undefined
      };
      const { data } = await studentAPI.getNotifications(params);
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const nextUnread = Number.isFinite(Number(data?.unreadCount))
        ? Number(data.unreadCount)
        : items.filter((item) => !item?.isRead).length;

      setNotifications(items);
      setUnreadCount(nextUnread);
    } catch {
      if (!silent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) {
        setLoadingNotifications(false);
      }
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [notificationFilter]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadNotifications({ silent: true });
    }, 30000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (dropdownOpen) {
      loadNotifications({ silent: true });
    }
  }, [dropdownOpen]);

  useEffect(() => {
    const onPointerDown = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }

      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
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

    const loadSearchSuggestions = async () => {
      const q = searchQuery.trim();
      if (!searchOpen || !q) {
        setSearchSuggestions([]);
        return;
      }

      try {
        const { data } = await studentAPI.getInternshipSuggestions(q);
        if (!active) return;
        setSearchSuggestions(Array.isArray(data) ? data : []);
      } catch {
        if (!active) return;
        setSearchSuggestions([]);
      }
    };

    const timer = window.setTimeout(loadSearchSuggestions, 220);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

  const markAsRead = async (id) => {
    let changed = false;
    setNotifications((prev) => prev.map((item) => {
      if (item._id !== id || item?.isRead) return item;
      changed = true;
      return { ...item, isRead: true };
    }));
    if (changed) {
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    }

    try {
      await studentAPI.markNotificationRead(id);
    } catch {
      // Keep the optimistic UI state so users get instant feedback.
    }
    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);
    try {
      await studentAPI.markAllNotificationsRead();
    } catch {
      // Keep the optimistic UI state so users get instant feedback.
    }
    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const removeNotification = async (id) => {
    let removedWasUnread = false;
    setNotifications((prev) => {
      const hit = prev.find((item) => item._id === id);
      if (hit && !hit.isRead) {
        removedWasUnread = true;
      }
      return prev.filter((item) => item._id !== id);
    });
    if (removedWasUnread) {
      setUnreadCount((prev) => Math.max(prev - 1, 0));
    }

    try {
      await studentAPI.deleteNotification(id);
    } catch {
      // Keep UI responsive; the next refresh will reconcile state.
    }
    loadNotifications({ silent: true });
  };

  const handleNotificationClick = async (item) => {
    if (!item?.isRead) {
      await markAsRead(item._id);
    }
    setDropdownOpen(false);
    navigate(resolveNotificationRoute(item));
  };

  const submitSearch = (value) => {
    const nextQuery = String(value || '').trim();
    setSearchOpen(false);
    setSearchSuggestions([]);
    if (!nextQuery) {
      navigate('/student/internships');
      return;
    }

    navigate(`/student/internships?q=${encodeURIComponent(nextQuery)}`);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative" ref={notificationRef}>
        <button
          type="button"
          onClick={() => {
            setDropdownOpen((value) => !value);
            setSearchOpen(false);
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
          <div className="panel-pop absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(20rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] sm:w-80">
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
              {loadingNotifications ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">Loading notifications...</p>
              ) : null}

              {!loadingNotifications && notifications.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-slate-500">No new notifications</p>
              ) : null}

              {!loadingNotifications && notifications.map((item) => (
                <div
                  key={item._id}
                  className={`mb-1.5 flex items-start gap-2 rounded-xl px-2 py-2 transition last:mb-0 ${item?.isRead ? 'bg-white hover:bg-slate-50' : 'bg-sky-50 hover:bg-sky-100'}`}
                >
                  <button
                    type="button"
                    onClick={() => handleNotificationClick(item)}
                    className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left"
                  >
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
                  placeholder="Search internships by title, skill, location..."
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSearchSuggestions([]);
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
              {searchSuggestions.length > 0 ? searchSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => submitSearch(item.title)}
                  className="mb-1 block w-full rounded-xl px-3 py-2 text-left transition last:mb-0 hover:bg-slate-50"
                >
                  <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.subtitle || 'Open internship'}</p>
                </button>
              )) : (
                <p className="px-3 py-4 text-sm text-slate-500">{searchQuery.trim() ? 'No matching suggestions' : 'Type to search internships'}</p>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function StudentLayout() {
  return (
    <div className="student-shell flex min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#f6faff_45%,#f8fafc_100%)]">
      <StudentSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title="Student Dashboard" subtitle="Student workspace" actions={<StudentLayoutActions />} />
        <main className="flex-1 p-6 lg:p-8">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
