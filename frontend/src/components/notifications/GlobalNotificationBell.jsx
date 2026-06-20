import React, { useEffect, useMemo, useRef, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import useAuth from '@/hooks/useAuth';
import Modal from '@/components/common/Modal';
import { NotificationContext } from '@/context/NotificationContext';

export const DEFAULT_NOTIFICATION_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'new-applicant', label: 'Applicants', category: 'new-applicant' },
  { key: 'internship-started', label: 'Started', category: 'internship-started' },
  { key: 'deadline-reminder', label: 'Deadlines', category: 'deadline-reminder' }
];

function getSocketUrl() {
  const explicitUrl = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE_URL || '';
  if (explicitUrl && explicitUrl.startsWith('http')) {
    return new URL(explicitUrl).origin;
  }

  if (typeof window !== 'undefined') {
    const { origin } = window.location;
    if (/localhost:517\d$/.test(origin) || /127\.0\.0\.1:517\d$/.test(origin)) {
      return origin.replace(/:517\d$/, ':5000');
    }
    return origin;
  }

  return 'http://127.0.0.1:5000';
}

function formatRelativeTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}

function getNotificationKey(notification) {
  return String(notification?._id || notification?.id || notification?.sourceKey || '');
}

function mergeNotifications(previousNotifications, incomingNotification) {
  const incomingKey = getNotificationKey(incomingNotification);
  const index = previousNotifications.findIndex((item) => getNotificationKey(item) === incomingKey);
  if (index === -1) {
    return [incomingNotification, ...previousNotifications].slice(0, 25);
  }

  const next = previousNotifications.slice();
  next[index] = { ...next[index], ...incomingNotification };
  next.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  return next.slice(0, 25);
}

function defaultResolveRoute(notification, fallbackRoute) {
  const directRoute = String(notification?.targetRoute || '').trim();
  if (directRoute.startsWith('/')) return directRoute;

  const combined = `${notification?.title || ''} ${notification?.message || ''}`.toLowerCase();
  if (combined.includes('verification') || combined.includes('rejected') || combined.includes('company')) {
    const receiverRole = String(notification?.receiverRole || '').toLowerCase();
    return ['employer', 'industry'].includes(receiverRole) ? '/employer/profile' : fallbackRoute;
  }
  if (combined.includes('profile')) return '/student/profile';
  if (combined.includes('application') || combined.includes('applicant')) return '/student/applications';
  if (combined.includes('internship') || combined.includes('deadline')) return '/student/internships';
  return fallbackRoute;
}

function defaultResolveDetailAction(notification, resolvedRoute) {
  if (!resolvedRoute) return null;

  const route = String(resolvedRoute || '').trim();
  if (!route) return null;

  const label = route.includes('/profile')
    ? 'Go to Profile'
    : route.includes('/applications')
      ? 'Open Applications'
      : route.includes('/internships')
        ? 'Open Internships'
        : route.includes('/dashboard')
          ? 'Open Dashboard'
          : 'Open Related Page';

  return { label, route };
}

export default function GlobalNotificationBell({
  api,
  title = 'Notifications',
  emptyMessage = 'No notifications found',
  loadingMessage = 'Loading notifications...',
  filters = DEFAULT_NOTIFICATION_FILTERS,
  fallbackRoute = '/dashboard',
  resolveRoute = defaultResolveRoute,
  resolveDetailAction = defaultResolveDetailAction
}) {
  const auth = useAuth();
  const navigate = useNavigate();
  const notificationRef = useRef(null);
  const ctx = useContext(NotificationContext);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notificationFilter, setNotificationFilter] = useState('all');
  const [localNotifications, setLocalNotifications] = useState([]);
  const [localUnreadCount, setLocalUnreadCount] = useState(0);
  const [detailNotification, setDetailNotification] = useState(null);

  // Use shared context state when available so sidebar badge and navbar bell stay in sync
  const notifications = ctx ? ctx.notifications : localNotifications;
  const unreadCount = ctx ? ctx.unreadCount : localUnreadCount;

  const activeFilter = useMemo(() => filters.find((item) => item.key === notificationFilter) || filters[0], [filters, notificationFilter]);
  const activeCategory = activeFilter?.category;

  const filteredNotifications = useMemo(() => {
    if (notificationFilter === 'all') return notifications;
    if (notificationFilter === 'unread') return notifications.filter((item) => !item?.isRead);
    return notifications.filter((item) => item?.category === activeCategory || item?.type === activeCategory);
  }, [notifications, notificationFilter, activeCategory]);

  const loadNotifications = async ({ silent = false } = {}) => {
    if (ctx) {
      await ctx.refreshNotifications({ silent });
      return;
    }
    if (!api?.getNotifications) return;

    if (!silent) setLoading(true);
    try {
      const params = {
        limit: 25,
        skip: 0,
        unreadOnly: notificationFilter === 'unread',
        category: activeCategory
      };
      const { data } = await api.getNotifications(params);
      const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
      const unread = Number.isFinite(Number(data?.unreadCount)) ? Number(data.unreadCount) : items.filter((item) => !item?.isRead).length;
      setLocalNotifications(items);
      setLocalUnreadCount(unread);
    } catch {
      if (!silent) {
        setLocalNotifications([]);
        setLocalUnreadCount(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Sync loading state from context
  useEffect(() => {
    if (ctx) setLoading(ctx.loading);
  }, [ctx?.loading]);

  useEffect(() => {
    loadNotifications();
  }, [notificationFilter, activeCategory]);

  useEffect(() => {
    if (ctx) return undefined; // context handles socket
    if (!auth?.token) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleIncomingNotification = (notification) => {
      if (!notification) return;
      setLocalNotifications((previousNotifications) => mergeNotifications(previousNotifications, notification));
      if (!notification?.isRead) {
        setLocalUnreadCount((previousCount) => previousCount + 1);
      }
    };

    socket.on('notification:new', handleIncomingNotification);

    return () => {
      socket.off('notification:new', handleIncomingNotification);
      socket.disconnect();
    };
  }, [auth?.token, ctx]);

  useEffect(() => {
    if (ctx) return undefined; // context handles polling
    const timer = window.setInterval(() => loadNotifications({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [notificationFilter, activeCategory, ctx]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setDropdownOpen(false);
        setDetailNotification(null);
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
    if (dropdownOpen) {
      loadNotifications({ silent: true });
    }
  }, [dropdownOpen]);

  const markAsRead = async (notificationId) => {
    if (ctx) {
      await ctx.markNotificationRead(notificationId);
      return;
    }
    let changed = false;
    setLocalNotifications((previousNotifications) => previousNotifications.map((item) => {
      if (getNotificationKey(item) !== String(notificationId) || item?.isRead) return item;
      changed = true;
      return { ...item, isRead: true, is_read: true };
    }));

    if (changed) {
      setLocalUnreadCount((previousCount) => Math.max(previousCount - 1, 0));
    }

    await api?.markNotificationRead?.(notificationId).catch(() => {});

    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const markAllAsRead = async () => {
    if (ctx) {
      await ctx.markAllNotificationsRead();
      return;
    }
    setLocalNotifications((previousNotifications) => previousNotifications.map((item) => ({ ...item, isRead: true, is_read: true })));
    setLocalUnreadCount(0);
    await api?.markAllNotificationsRead?.().catch(() => {});
    if (notificationFilter === 'unread') {
      loadNotifications({ silent: true });
    }
  };

  const removeNotification = async (notificationId) => {
    if (ctx) {
      await ctx.deleteNotification(notificationId);
      return;
    }
    let removedUnread = false;
    setLocalNotifications((previousNotifications) => {
      const target = previousNotifications.find((item) => getNotificationKey(item) === String(notificationId));
      removedUnread = Boolean(target && !target.isRead);
      return previousNotifications.filter((item) => getNotificationKey(item) !== String(notificationId));
    });

    if (removedUnread) {
      setLocalUnreadCount((previousCount) => Math.max(previousCount - 1, 0));
    }

    await api?.deleteNotification?.(notificationId).catch(() => {});
    loadNotifications({ silent: true });
  };

  const openDetail = async (notification) => {
    if (!notification) return;
    if (!notification?.isRead) {
      await markAsRead(getNotificationKey(notification));
    }
    setDropdownOpen(false);
    setDetailNotification(notification);
  };

  const resolvedDetailAction = detailNotification
    ? resolveDetailAction(
      detailNotification,
      resolveRoute(detailNotification, fallbackRoute, auth?.user)
    )
    : null;

  const goToDetailAction = () => {
    if (!resolvedDetailAction?.route) return;
    setDetailNotification(null);
    navigate(resolvedDetailAction.route);
  };

  return (
    <>
      <Modal
        open={Boolean(detailNotification)}
        title={detailNotification?.title || title}
        onClose={() => setDetailNotification(null)}
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Date</p>
            <p className="mt-1 text-sm text-slate-700">{new Date(detailNotification?.createdAt || Date.now()).toLocaleString()}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">From</p>
            <p className="mt-1 text-sm text-slate-700">{detailNotification?.sender_name || (detailNotification?.senderRole === 'super_admin' ? 'Dr. Solomon Bekele' : detailNotification?.senderRole || 'System')}</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-700">
            {detailNotification?.message || 'No message content available.'}
          </div>

          {['student-verification', 'company-verification'].includes(String(detailNotification?.metadata?.kind || '')) && String(detailNotification?.metadata?.verificationStatus || '').toLowerCase() === 'rejected' ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Rejection Reason</p>
              <p className="mt-2 leading-7">{String(detailNotification?.metadata?.rejectionReason || detailNotification?.message || 'No rejection reason provided.').trim()}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setDetailNotification(null)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Close
            </button>

            {resolvedDetailAction?.route ? (
              <button
                type="button"
                onClick={goToDetailAction}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                {resolvedDetailAction.label}
              </button>
            ) : null}
          </div>
        </div>
      </Modal>

      <div className="relative" ref={notificationRef}>
        <button
          type="button"
          onClick={() => {
            setDropdownOpen((value) => !value);
          }}
          aria-label="Notifications"
          title="Notifications"
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
              <p className="text-sm font-semibold text-slate-900">{title}</p>
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
              {filters.map((tab) => (
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
              {loading ? <p className="px-3 py-6 text-center text-sm text-slate-500">{loadingMessage}</p> : null}
              {!loading && filteredNotifications.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">{emptyMessage}</p> : null}
              {!loading && filteredNotifications.map((item) => {
                const isUnread = !item?.isRead;
                const isVerificationRejection = ['student-verification', 'company-verification'].includes(String(item?.metadata?.kind || '')) && String(item?.metadata?.verificationStatus || '').toLowerCase() === 'rejected';

                return (
                  <div key={getNotificationKey(item) || item?.title} className={`mb-1.5 flex items-start gap-2 rounded-xl px-2 py-2 transition last:mb-0 ${isUnread ? 'bg-sky-50 hover:bg-sky-100' : 'bg-white hover:bg-slate-50'}`}>
                    <button type="button" onClick={() => openDetail(item)} className="min-w-0 flex-1 rounded-lg px-1 py-0.5 text-left">
                      <p className="line-clamp-1 text-sm font-semibold text-slate-900">{item?.title || 'Notification'}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item?.message || ''}</p>
                      {isVerificationRejection ? (
                        <p className="mt-1 text-[11px] font-semibold text-amber-700">Click to read the full rejection reason.</p>
                      ) : null}
                      <div className="mt-1.5 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">{formatRelativeTime(item?.createdAt)}</span>
                        {isUnread ? <span className="h-2 w-2 rounded-full bg-sky-500" /> : null}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => removeNotification(getNotificationKey(item))}
                      className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-white hover:text-rose-500"
                      aria-label="Remove notification"
                      title="Remove notification"
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" className="h-4 w-4">
                        <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}