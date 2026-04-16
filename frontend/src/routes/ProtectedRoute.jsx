import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import Loader from '@/components/common/Loader';

export default function ProtectedRoute({ redirectTo = '/login' }) {
  const auth = useAuth();

  if (auth?.loading) {
    return <Loader fullScreen label="Preparing your session" />;
  }

  if (!auth?.isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  return <Outlet />;
}
