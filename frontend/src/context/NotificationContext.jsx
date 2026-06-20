import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import api from '@/services/api';

export const NotificationContext = createContext(null);

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

function normalizeNotification(notification) {
  if (!notification) return null;
  return {
    ...notification,
    _id: String(notification._id || notification.id || ''),
    id: String(notification.id || notification._id || ''),
    isRead: Boolean(notification.isRead ?? notification.is_read),
    is_read: Boolean(notification.isRead ?? notification.is_read),
    createdAt: notification.createdAt || notification.created_at || new Date().toISOString(),
    created_at: notification.created_at || notification.createdAt || new Date().toISOString()
  };
}

function mergeNotificationList(previousNotifications, incomingNotification) {
  const nextNotification = normalizeNotification(incomingNotification);
  if (!nextNotification) return previousNotifications;

  const incomingKey = String(nextNotification._id || nextNotification.sourceKey || nextNotification.id);
  const index = previousNotifications.findIndex((item) => String(item._id || item.sourceKey || item.id) === incomingKey);
  if (index === -1) {
    return [nextNotification, ...previousNotifications].slice(0, 100);
  }

  const next = previousNotifications.slice();
  next[index] = { ...next[index], ...nextNotification };
  next.sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0));
  return next.slice(0, 100);
}

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedNotificationId, setSelectedNotificationId] = useState('');

  // Hard-reset all notification state when the logged-in user or role changes.
  // This prevents cross-role data leakage in the frontend cache.
  const userKey = `${auth?.user?.id || ''}:${auth?.user?.role || ''}`;
  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setSelectedNotificationId('');
    setLoading(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userKey]);

  const refreshNotifications = useCallback(async ({ silent = false } = {}) => {
    if (!auth?.token) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const { data } = await api.get('/notification', { params: { limit: 100, skip: 0 } });
      const items = Array.isArray(data?.items) ? data.items : [];
      const normalizedItems = items.map(normalizeNotification).filter(Boolean);
      const unread = Number.isFinite(Number(data?.unreadCount))
        ? Number(data.unreadCount)
        : normalizedItems.filter((item) => !item?.isRead).length;

      setNotifications(normalizedItems);
      setUnreadCount(unread);
      if (!selectedNotificationId && normalizedItems[0]?._id) {
        setSelectedNotificationId(normalizedItems[0]._id);
      }
    } catch {
      if (!silent) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auth?.token, selectedNotificationId]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!auth?.token) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleNotification = (notification) => {
      if (!notification) return;
      const normalized = normalizeNotification(notification);
      setNotifications((previousNotifications) => mergeNotificationList(previousNotifications, normalized));
      if (!normalized?.isRead) {
        setUnreadCount((previousCount) => previousCount + 1);
      }

      if (
        String(auth?.user?.role || '').toLowerCase() === 'student'
        && String(normalized?.metadata?.kind || '') === 'student-verification'
        && auth?.updateUser
      ) {
        const verificationStatus = String(normalized?.metadata?.verificationStatus || '').trim();
        if (verificationStatus) {
          auth.updateUser({
            verificationStatus,
            isVerified: verificationStatus.toLowerCase() === 'verified',
            rejectionReason: String(normalized?.metadata?.rejectionReason || normalized?.metadata?.rejection_reason || '').trim(),
            verificationNote: String(normalized?.metadata?.verificationNote || '').trim()
          });
        }
      }
    };

    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.disconnect();
    };
  }, [auth?.token, auth?.user?.role, auth?.updateUser]);

  useEffect(() => {
    const timer = window.setInterval(() => refreshNotifications({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [refreshNotifications]);

  useEffect(() => {
    if (!auth?.token) return;
    const isNotifPage = location.pathname.endsWith('/notifications');
    if (!isNotifPage) return;

    if (!selectedNotificationId) {
      // Prefer the first unread, fall back to the most recent overall
      const firstUnread = notifications.find((n) => !n.isRead);
      const target = firstUnread || notifications[0];
      if (target?._id) setSelectedNotificationId(target._id);
    }
  }, [auth?.token, location.pathname, notifications, selectedNotificationId]);

  const markNotificationRead = useCallback(async (notificationId) => {
    const id = String(notificationId || '');
    if (!id) return null;

    let changed = false;
    setNotifications((previousNotifications) => previousNotifications.map((item) => {
      if (String(item._id || item.id) !== id || item?.isRead) return item;
      changed = true;
      return { ...item, isRead: true, is_read: true };
    }));

    if (changed) {
      setUnreadCount((previousCount) => Math.max(previousCount - 1, 0));
    }

    await api.put(`/notification/read/${id}`).catch(() => {});
    return id;
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((previousNotifications) => previousNotifications.map((item) => ({ ...item, isRead: true, is_read: true })));
    setUnreadCount(0);
    await api.put('/notification/read-all').catch(() => {});
  }, []);

  const deleteNotification = useCallback(async (notificationId) => {
    const id = String(notificationId || '');
    if (!id) return { success: false };

    let removedUnread = false;
    setNotifications((previousNotifications) => {
      const target = previousNotifications.find((item) => String(item._id || item.id) === id);
      removedUnread = Boolean(target && !target.isRead);
      return previousNotifications.filter((item) => String(item._id || item.id) !== id);
    });

    if (removedUnread) {
      setUnreadCount((previousCount) => Math.max(previousCount - 1, 0));
    }

    try {
      await api.delete(`/notification/${id}`);
      return { success: true };
    } catch {
      return { success: false };
    }
  }, []);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    selectedNotificationId,
    setSelectedNotificationId,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    deleteNotification,
    setNotifications,
    setUnreadCount
  }), [notifications, unreadCount, loading, selectedNotificationId, refreshNotifications, markNotificationRead, markAllNotificationsRead, deleteNotification]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
