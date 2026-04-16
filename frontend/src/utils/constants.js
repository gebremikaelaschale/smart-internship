export const ROLES = Object.freeze({
  STUDENT: 'student',
  EMPLOYER: 'employer',
  ADMIN: 'admin',
  DEAN: 'dean',
  HOD: 'hod'
});

export const ROUTES = Object.freeze({
  login: '/login',
  studentDashboard: '/student/dashboard',
  employerDashboard: '/employer/dashboard',
  adminDashboard: '/admin/super-admin',
  deanDashboard: '/dean/dashboard',
  hodDashboard: '/hod/dashboard'
});

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
