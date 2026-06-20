import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuth from '@/hooks/useAuth';

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

export default function useHodDashboardSync(onRefresh) {
  const auth = useAuth();
  const role = String(auth?.user?.role || auth?.user?.adminType || '').toLowerCase();
  const isHod = role === 'hod' || role === 'deptadmin';

  useEffect(() => {
    if (!auth?.token || !isHod || !onRefresh) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleRefresh = () => {
      onRefresh();
    };

    socket.on('hod:dashboard-updated', handleRefresh);

    return () => {
      socket.off('hod:dashboard-updated', handleRefresh);
      socket.disconnect();
    };
  }, [auth?.token, isHod, onRefresh]);
}