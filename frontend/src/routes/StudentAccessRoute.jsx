import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import Loader from '@/components/common/Loader';

const LOCK_MESSAGE = 'Complete your profile for HOD approval first';

function isVerifiedStudent(user) {
  return Boolean(user?.isVerified) && String(user?.verificationStatus || '').toLowerCase() === 'verified';
}

export default function StudentAccessRoute({ children, redirectTo = '/student/profile' }) {
  const auth = useAuth();
  const location = useLocation();

  if (auth?.loading) {
    return <Loader fullScreen label="Checking profile access" />;
  }

  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isVerifiedStudent(auth.user)) {
    return <Navigate to={redirectTo} replace state={{ message: LOCK_MESSAGE, from: location.pathname }} />;
  }

  return children || <Outlet />;
}