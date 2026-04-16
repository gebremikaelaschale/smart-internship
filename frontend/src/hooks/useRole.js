import useAuth from './useAuth';

export default function useRole() {
  const auth = useAuth();
  const role = auth?.user?.role || 'guest';
  const normalizedRole = role === 'super_admin' ? 'admin' : role;

  return {
    role,
    isStudent: role === 'student',
    isEmployer: role === 'employer',
    isAdmin: normalizedRole === 'admin' || role === 'dean' || role === 'hod',
    isDean: role === 'dean',
    isHod: role === 'hod',
    hasRole: (allowedRoles = []) => allowedRoles.includes(role) || (role === 'super_admin' && allowedRoles.includes('admin'))
  };
}
