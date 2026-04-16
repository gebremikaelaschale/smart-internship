function normalizeUniversityRole(role, adminType) {
  const roleValue = String(role || '').trim().toLowerCase();
  const adminTypeValue = String(adminType || '').trim().toLowerCase();

  if (['super_admin', 'superadmin', 'super-admin'].includes(roleValue) || adminTypeValue === 'superadmin') {
    return 'super_admin';
  }

  if (['dean', 'collegeadmin', 'college_admin', 'college-admin'].includes(roleValue) || adminTypeValue === 'collegeadmin') {
    return 'dean';
  }

  if (['hod', 'deptadmin', 'dept_admin', 'dept-admin', 'departmentadmin', 'department_admin'].includes(roleValue) || adminTypeValue === 'deptadmin') {
    return 'hod';
  }

  return roleValue;
}

function resolveUniversityRole(user) {
  return normalizeUniversityRole(user?.role, user?.adminType);
}

function toDisplayUniversityRole(user) {
  return resolveUniversityRole(user);
}

function hasUniversityRole(user, allowedRoles = []) {
  const allowed = new Set((Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase()));

  return allowed.has(resolveUniversityRole(user));
}

module.exports = {
  normalizeUniversityRole,
  resolveUniversityRole,
  toDisplayUniversityRole,
  hasUniversityRole
};
