export function resolveDashboardRoute(role, adminType = '') {
  const safeRole = String(role || '').trim().toLowerCase();
  const safeAdminType = String(adminType || '').trim().toLowerCase();

  if (safeRole === 'student') return '/student/dashboard';
  if (safeRole === 'employer') return '/employer/dashboard';
  if (safeRole === 'dean' || safeAdminType === 'collegeadmin') return '/dean/dashboard';
  if (safeRole === 'hod' || safeAdminType === 'deptadmin') return '/hod/dashboard';
  // Use the Super Admin entry path so admin users land on the Super Admin studio
  if (safeRole === 'admin' || safeRole === 'super_admin' || safeAdminType === 'superadmin') return '/admin/super-admin';

  return '/login';
}