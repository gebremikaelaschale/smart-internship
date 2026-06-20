import React, { useContext, useEffect, useMemo, useState } from 'react';
import { NotificationContext } from '@/context/NotificationContext';
import useAuth from '@/hooks/useAuth';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatExactTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function formatRelativeTime(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateGroup(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart - 86400000);
  const weekStart = new Date(todayStart - 6 * 86400000);
  if (date >= todayStart) return 'Today';
  if (date >= yesterdayStart) return 'Yesterday';
  if (date >= weekStart) return 'Last 7 Days';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'Last 7 Days', 'Earlier'];


// ─── Notification type config ────────────────────────────────────────────────

function getTypeConfig(notification) {
  const raw = String(notification?.category || notification?.type || '').toLowerCase();
  const title = String(notification?.title || '').toLowerCase();
  const msg = String(notification?.message || '').toLowerCase();
  const combined = `${raw} ${title} ${msg}`;

  if (combined.includes('accept') || combined.includes('started') || combined.includes('approved') || combined.includes('success')) {
    return {
      color: 'emerald',
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      badgeBg: 'bg-emerald-50 text-emerald-700',
      label: 'Accepted',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
    };
  }
  if (combined.includes('reject') || combined.includes('denied') || combined.includes('urgent') || combined.includes('action required') || combined.includes('failed')) {
    return {
      color: 'rose',
      iconBg: 'bg-rose-100',
      iconColor: 'text-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700',
      label: 'Action Required',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      ),
    };
  }
  if (combined.includes('deadline') || combined.includes('reminder') || combined.includes('expir') || combined.includes('warning')) {
    return {
      color: 'amber',
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      badgeBg: 'bg-amber-50 text-amber-700',
      label: 'Reminder',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    };
  }
  if (combined.includes('verification') || combined.includes('profile') || combined.includes('pending')) {
    return {
      color: 'violet',
      iconBg: 'bg-violet-100',
      iconColor: 'text-violet-600',
      badgeBg: 'bg-violet-50 text-violet-700',
      label: 'Verification',
      icon: (
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
    };
  }
  // default: blue / general
  return {
    color: 'sky',
    iconBg: 'bg-sky-100',
    iconColor: 'text-sky-600',
    badgeBg: 'bg-sky-50 text-sky-700',
    label: 'General',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
  };
}

function getSenderInfo(notification) {
  // Use real data from API if available
  const name = String(notification?.sender_name || '').trim();
  const avatar = String(notification?.sender_avatar || '').trim();
  const label = String(notification?.sender_label || '').trim();

  if (name && name !== 'System') {
    // Derive initials from the real name
    const initials = name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('');
    return { name, avatar, role: label || 'Sender', initials };
  }

  // Fallback: derive from category/type when no sender stored
  const kind = String(notification?.metadata?.kind || '').toLowerCase();
  const category = String(notification?.category || notification?.type || '').toLowerCase();

  if (kind === 'student-verification' || category.includes('verification')) {
    return { name: 'HOD Office', avatar: '', role: 'Head of Department', initials: 'HO' };
  }
  if (category.includes('application') || category.includes('applicant')) {
    return { name: 'Internship System', avatar: '', role: 'Application Manager', initials: 'IS' };
  }
  if (category.includes('deadline') || category.includes('reminder')) {
    return { name: 'Platform Scheduler', avatar: '', role: 'Automated Reminder', initials: 'PS' };
  }
  if (category.includes('internship') || category.includes('started')) {
    return { name: 'Internship Office', avatar: '', role: 'Program Coordinator', initials: 'IO' };
  }
  return { name: 'System', avatar: '', role: 'Platform Notification', initials: 'SY' };
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 animate-pulse">
      <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded bg-slate-100" />
        <div className="h-3 w-full rounded bg-slate-100" />
        <div className="h-2.5 w-1/3 rounded bg-slate-100" />
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyInbox() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <svg className="h-7 w-7 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-700">All caught up</p>
      <p className="mt-1 text-xs text-slate-400">No notifications yet. Updates will appear here.</p>
    </div>
  );
}

// ─── Empty detail pane ────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-10 py-16 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
        <svg className="h-7 w-7 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 9h6M9 13h4" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-700">Select a notification</p>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-400">
        Click any item on the left to read the full message and take action.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const auth = useAuth();
  const role = String(auth?.user?.role || '').toLowerCase();
  const {
    notifications, unreadCount, loading,
    selectedNotificationId, setSelectedNotificationId,
    markNotificationRead, markAllNotificationsRead, deleteNotification,
  } = useContext(NotificationContext);

  const [fadeKey, setFadeKey] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // ID pending confirmation
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', message: string }

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // When the page loads with a pre-selected notification (set by the bell dropdown),
  // mark it as read immediately so the badge decrements.
  // If nothing is pre-selected, auto-select the first unread (but do NOT mark it read
  // until the user explicitly clicks it or it's already selected).
  useEffect(() => {
    if (loading || notifications.length === 0) return;

    if (selectedNotificationId) {
      // A specific notification was pre-selected (e.g. from the bell dropdown).
      // Trigger the fade animation and mark it read.
      setFadeKey(selectedNotificationId);
      const target = notifications.find(
        (n) => String(n._id || n.id) === String(selectedNotificationId)
      );
      if (target && !target.isRead) {
        markNotificationRead(selectedNotificationId);
      }
      return;
    }

    // Nothing pre-selected: auto-select the first unread (or first overall),
    // but only set the ID — do NOT mark as read yet (user must click to read).
    const firstUnread = notifications.find((n) => !n.isRead);
    const target = firstUnread || notifications[0];
    if (target) {
      const id = target._id || target.id || '';
      if (id) {
        setSelectedNotificationId(id);
        setFadeKey(id);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, notifications.length, selectedNotificationId]);

  const selectedNotification = useMemo(() => {
    const fallbackId = notifications[0]?._id || notifications[0]?.id || '';
    return notifications.find(
      (item) => String(item._id || item.id) === String(selectedNotificationId || fallbackId)
    ) || null;
  }, [notifications, selectedNotificationId]);

  const grouped = useMemo(() => {
    const map = {};
    for (const n of notifications) {
      const g = getDateGroup(n.createdAt || n.created_at);
      if (!map[g]) map[g] = [];
      map[g].push(n);
    }
    return GROUP_ORDER.filter((g) => map[g]?.length > 0).map((g) => ({ label: g, items: map[g] }));
  }, [notifications]);

  const onSelect = async (notification) => {
    const id = notification._id || notification.id || '';
    setSelectedNotificationId(id);
    setFadeKey(id);
    if (!notification.isRead) {
      await markNotificationRead(id);
    }
  };

  const onDelete = async () => {
    if (!selectedNotification) return;
    const id = selectedNotification._id || selectedNotification.id;
    // Show confirmation dialog instead of deleting immediately
    setConfirmDeleteId(id);
  };

  const onConfirmDelete = async () => {
    if (!confirmDeleteId) return;
    setDeleting(true);
    // Compute next item before removing from list
    const remaining = notifications.filter((n) => String(n._id || n.id) !== String(confirmDeleteId));
    const nextId = remaining[0]?._id || remaining[0]?.id || '';
    const result = await deleteNotification(confirmDeleteId);
    setDeleting(false);
    setConfirmDeleteId(null);
    if (result?.success !== false) {
      setSelectedNotificationId(nextId);
      if (nextId) setFadeKey(nextId);
      setToast({ type: 'success', message: 'Notification deleted successfully.' });
    } else {
      setToast({ type: 'error', message: 'Failed to delete. Please try again.' });
    }
  };

  const typeConfig = selectedNotification ? getTypeConfig(selectedNotification) : null;
  const senderInfo = selectedNotification ? getSenderInfo(selectedNotification) : null;

  return (
    <div className="flex h-full flex-col bg-[#f8fafc]">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-slate-200/80 bg-white px-6 py-5 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-sky-600">Inbox</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-900">Notifications</h1>
          </div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 border border-sky-100">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500 animate-pulse" />
                {unreadCount} unread
              </span>
            )}
            <button
              type="button"
              onClick={markAllNotificationsRead}
              disabled={unreadCount === 0}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
        </div>
      </div>

      {/* ── Master / Detail grid ── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">

        {/* ── LEFT: Notification list ── */}
        <div className="flex w-full shrink-0 flex-col border-r border-slate-200/80 bg-white lg:w-[360px] xl:w-[400px]">
          <div className="flex-1 overflow-y-auto [scrollbar-width:thin]">
            {loading ? (
              <div className="divide-y divide-slate-100">
                {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
              </div>
            ) : notifications.length === 0 ? (
              <EmptyInbox />
            ) : (
              grouped.map(({ label, items }) => (
                <div key={label}>
                  {/* Date group header */}
                  <div className="sticky top-0 z-10 bg-slate-50/90 px-4 py-2 backdrop-blur-sm">
                    <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{label}</span>
                  </div>

                  <div className="divide-y divide-slate-100/80">
                    {items.map((notification) => {
                      const id = String(notification._id || notification.id);
                      const isActive = String(selectedNotificationId || notifications[0]?._id || '') === id;
                      const cfg = getTypeConfig(notification);

                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => onSelect(notification)}
                          className={`group relative w-full px-4 py-3.5 text-left transition-colors duration-150 ${
                            isActive
                              ? 'bg-sky-50/80'
                              : 'bg-white hover:bg-slate-50/70'
                          }`}
                        >
                          {/* Active indicator bar */}
                          {isActive && (
                            <span className="absolute inset-y-0 left-0 w-0.5 rounded-r bg-sky-500" />
                          )}

                          <div className="flex items-start gap-3">
                            {/* Icon circle */}
                            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${cfg.iconBg} ${cfg.iconColor}`}>
                              {cfg.icon}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`truncate text-sm font-semibold leading-snug ${isActive ? 'text-sky-900' : 'text-slate-800'}`}>
                                  {notification.title || 'Notification'}
                                </p>
                                <span className="shrink-0 text-[10px] font-medium text-slate-400 mt-0.5">
                                  {formatRelativeTime(notification.createdAt || notification.created_at)}
                                </span>
                              </div>
                              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                                {notification.message || 'No details provided.'}
                              </p>
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.badgeBg}`}>
                                  {cfg.label}
                                </span>
                                {!notification.isRead && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── RIGHT: Detail pane ── */}
        <div className="hidden min-w-0 flex-1 flex-col bg-[#f8fafc] lg:flex">
          {selectedNotification && typeConfig && senderInfo ? (
            <div
              key={fadeKey}
              className="flex h-full flex-col"
              style={{ animation: 'notif-fade-in 0.22s ease-out both' }}
            >
              {/* Detail header */}
              <div className="shrink-0 border-b border-slate-200/80 bg-white px-7 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    {/* Sender avatar — real photo or initials fallback */}
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl ${typeConfig.iconBg} ${typeConfig.iconColor} text-sm font-bold`}>
                      {senderInfo.avatar ? (
                        <img
                          src={senderInfo.avatar}
                          alt={senderInfo.name}
                          className="h-full w-full object-cover"
                          onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'flex'; }}
                        />
                      ) : null}
                      <span
                        className="flex h-full w-full items-center justify-center text-sm font-bold"
                        style={{ display: senderInfo.avatar ? 'none' : 'flex' }}
                      >
                        {senderInfo.initials}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{senderInfo.name}</p>
                      <p className="text-xs text-slate-500">{senderInfo.role}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {formatExactTime(selectedNotification.createdAt || selectedNotification.created_at)}
                      </p>
                    </div>
                  </div>

                  {/* Secondary actions — top right */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!selectedNotification.isRead && (
                      <button
                        type="button"
                        onClick={() => markNotificationRead(selectedNotification._id || selectedNotification.id)}
                        title="Mark as read"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onDelete}
                      title="Delete notification"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Detail body */}
              <div className="flex-1 overflow-y-auto px-7 py-6 [scrollbar-width:thin]">
                {/* Title + badge */}
                <div className="flex flex-wrap items-start gap-3">
                  <h2 className="flex-1 text-xl font-bold leading-snug tracking-tight text-slate-900">
                    {selectedNotification.title || 'Notification'}
                  </h2>
                  <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${typeConfig.badgeBg}`}>
                    {typeConfig.label}
                  </span>
                </div>

                {/* Status pill */}
                <div className="mt-3 flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedNotification.isRead ? 'bg-slate-100 text-slate-500' : 'bg-sky-50 text-sky-700'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${selectedNotification.isRead ? 'bg-slate-400' : 'bg-sky-500'}`} />
                    {selectedNotification.isRead ? 'Read' : 'Unread'}
                  </span>
                </div>

                {/* Message body */}
                <div className="mt-6 pb-6">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Message</p>
                  <p className="mt-2 text-sm leading-7 text-slate-700">
                    {selectedNotification.message || 'No additional details were provided.'}
                  </p>
                </div>

                {/* Rejection reason / additional note */}
                {selectedNotification?.metadata?.rejectionReason ? (
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-600">HOD Note</p>
                    <p className="mt-2 text-sm leading-7 text-amber-900">
                      {selectedNotification.metadata.rejectionReason}
                    </p>
                  </div>
                ) : null}
              </div>

            </div>
          ) : (
            <EmptyDetail />
          )}
        </div>
      </div>

      {/* Fade-in keyframe injected once */}
      <style>{`
        @keyframes notif-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Confirmation dialog ── */}
      {confirmDeleteId ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/40 px-4 backdrop-blur-sm">
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)]"
            style={{ animation: 'notif-fade-in 0.18s ease-out both' }}
          >
            <div className="px-6 py-5">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-100">
                <svg className="h-5 w-5 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                  <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">Delete notification?</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-500">
                This will permanently remove the notification from your inbox. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center gap-2 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deleting}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onConfirmDelete}
                disabled={deleting}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Toast notification ── */}
      {toast ? (
        <div
          className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
          style={{ animation: 'notif-fade-in 0.2s ease-out both' }}
        >
          {toast.type === 'success' ? (
            <svg className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0 text-rose-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          <span className="text-sm font-semibold">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-1 rounded-lg p-1 opacity-60 transition hover:opacity-100"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l8 8M14 6l-8 8" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  );
}
