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

export default function useStudentVerificationSync() {
  const auth = useAuth();
  const isStudent = String(auth?.user?.role || '').toLowerCase() === 'student';

  useEffect(() => {
    if (!auth?.token || !isStudent || !auth?.updateUser) return undefined;

    const socket = io(getSocketUrl(), {
      transports: ['websocket'],
      auth: { token: auth.token }
    });

    const handleVerificationUpdate = (payload = {}) => {
      const verificationStatus = String(payload.verificationStatus || '').trim();
      if (!verificationStatus) return;

      auth.updateUser({
        isVerified: Boolean(payload.isVerified),
        verificationStatus,
        rejectionReason: String(payload.rejectionReason || payload.rejection_reason || '').trim(),
        verificationNote: String(payload.verificationNote || '').trim()
      });
    };

    socket.on('student:verification-updated', handleVerificationUpdate);

    return () => {
      socket.off('student:verification-updated', handleVerificationUpdate);
      socket.disconnect();
    };
  }, [auth?.token, auth?.updateUser, isStudent]);
}
