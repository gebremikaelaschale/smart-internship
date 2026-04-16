import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '@/hooks/useAuth';
import useRole from '@/hooks/useRole';
import Loader from '@/components/common/Loader';
import { resolveDashboardRoute } from '@/utils/roleRedirect';

export default function RoleRoute({ allowedRoles = [], children }) {
  const auth = useAuth();
  const { role } = useRole();
  const normalizedRole = role === 'super_admin' ? 'admin' : role;
  const normalizedAllowedRoles = allowedRoles.map((value) => (value === 'super_admin' ? 'admin' : value));

  if (auth?.loading) {
    return <Loader fullScreen label="Loading role permissions" />;
  }

  if (!auth?.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (normalizedAllowedRoles.length > 0 && !normalizedAllowedRoles.includes(normalizedRole)) {
    const fallback = resolveDashboardRoute(role, auth?.user?.adminType);
    return <Navigate to={fallback} replace />;
  }

  return children || <Outlet />;
}
