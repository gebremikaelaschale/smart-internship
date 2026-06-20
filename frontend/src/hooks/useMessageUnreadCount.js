import { useEffect, useState } from 'react';
import { messagingAPI } from '@/features/messaging/messagingAPI';

export default function useMessageUnreadCount(pollInterval = 12000) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let active = true;
    let interval = null;

    const fetchUnreadCount = async () => {
      try {
        const { data } = await messagingAPI.getUnreadCount();
        if (!active) return;
        setUnreadCount(Number(data?.unreadCount ?? 0));
      } catch {
        // ignore network or auth failures silently
      }
    };

    fetchUnreadCount();
    interval = setInterval(fetchUnreadCount, pollInterval);

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [pollInterval]);

  return unreadCount;
}
