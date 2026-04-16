function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (['student', 'employer', 'admin', 'dean', 'hod'].includes(value)) return value;
  if (['superadmin', 'super_admin', 'super-admin'].includes(value)) return 'admin';
  if (['collegeadmin', 'college_admin', 'college-admin'].includes(value)) return 'dean';
  if (['deptadmin', 'dept_admin', 'dept-admin', 'departmentadmin', 'department_admin'].includes(value)) return 'hod';
  if (value === 'industry partner') return 'employer';
  return value;
}

function normalizeAdminType(role) {
  const value = String(role || '').trim().toLowerCase();
  if (!value) return '';
  if (['superadmin', 'super_admin', 'super-admin'].includes(value)) return 'superadmin';
  if (value === 'admin') return 'admin';
  if (['collegeadmin', 'college_admin', 'college-admin', 'dean'].includes(value)) return 'collegeadmin';
  if (['deptadmin', 'dept_admin', 'dept-admin', 'departmentadmin', 'department_admin', 'hod'].includes(value)) {
    return 'deptadmin';
  }
  return value;
}

function hasGovernanceAccess(role) {
  const value = normalizeRole(role);
  return ['admin', 'dean', 'hod'].includes(value) || ['superadmin', 'collegeadmin', 'deptadmin'].includes(normalizeAdminType(role));
}

function isSuperAdmin(role) {
  return normalizeAdminType(role) === 'superadmin';
}

function isCollegeScope(role) {
  const adminType = normalizeAdminType(role);
  return adminType === 'collegeadmin';
}

function isDepartmentScope(role) {
  const adminType = normalizeAdminType(role);
  return adminType === 'deptadmin';
}

module.exports = {
  normalizeRole,
  normalizeAdminType,
  hasGovernanceAccess,
  isSuperAdmin,
  isCollegeScope,
  isDepartmentScope
};