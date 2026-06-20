import { useContext } from 'react';
import { NotificationContext } from '@/context/NotificationContext';

export default function useNotificationCount() {
  const ctx = useContext(NotificationContext);
  return ctx?.unreadCount ?? 0;
}
