import { useEffect } from 'react';
import { io } from 'socket.io-client';
import useAuth from './useAuth';

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

export default function useCompanyStatusSync(onChange) {
  const auth = useAuth();
  const isStudent = String(auth?.user?.role || '').toLowerCase() === 'student';

  useEffect(() => {
    if (!auth?.token || !isStudent) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleStatus = (payload = {}) => {
      if (onChange) onChange(payload);
    };

    socket.on('company:status-changed', handleStatus);
    socket.on('company:verification-rejected', handleStatus);
    socket.on('company:verification-updated', handleStatus);

    return () => {
      socket.off('company:status-changed', handleStatus);
      socket.off('company:verification-rejected', handleStatus);
      socket.off('company:verification-updated', handleStatus);
      socket.disconnect();
    };
  }, [auth?.token, isStudent, onChange]);
}
