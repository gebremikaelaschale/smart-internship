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

export default function useCompanyVerificationSync(onUpdate) {
  const auth = useAuth();
  const isEmployer = String(auth?.user?.role || '').toLowerCase() === 'employer';

  useEffect(() => {
    if (!auth?.token || !isEmployer) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleVerified = (payload = {}) => {
      if (onUpdate) onUpdate(payload);
    };

    const handleRejected = (payload = {}) => {
      if (onUpdate) onUpdate(payload);
    };

    const handleReset = (payload = {}) => {
      if (onUpdate) onUpdate(payload);
    };

    socket.on('company:verification-updated', handleVerified);
    socket.on('company:verification-rejected', handleRejected);
    socket.on('company:verification-reset', handleReset);

    return () => {
      socket.off('company:verification-updated', handleVerified);
      socket.off('company:verification-rejected', handleRejected);
      socket.off('company:verification-reset', handleReset);
      socket.disconnect();
    };
  }, [auth?.token, isEmployer, onUpdate]);
}
