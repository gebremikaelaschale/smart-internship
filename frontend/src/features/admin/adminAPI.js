import api from '@/services/api';

function buildDepartmentUpdatePayload(payload = {}) {
  const name = String(payload?.name || '').trim();
  const collegeId = String(payload?.collegeId || '').trim();
  const headName = String(payload?.head?.name || payload?.hodName || '').trim();
  const headEmail = String(payload?.head?.email || payload?.hodEmail || '').trim();
  const headPhone = String(payload?.head?.phone || payload?.hodPhone || '').trim();

  return {
    ...(name ? { name } : {}),
    ...(collegeId ? { collegeId } : {}),
    ...(headName ? { hodName: headName } : {}),
    ...(headEmail ? { hodEmail: headEmail } : {}),
    ...(headPhone ? { hodPhone: headPhone } : {})
  };
}

export const adminAPI = {
  getSuperAdminDashboard: () => api.get('/admin/super-admin'),
  getCollegeDashboard: () => api.get('/admin/college'),
  getDeanStats: () => api.get('/dean/stats'),
  getHodDashboardStats: () => api.get('/hod/dashboard-stats'),
  getHodStats: () => api.get('/hod/dashboard-stats'),
  getHodPlacementStats: () => api.get('/hod/placement-stats'),
  getAvailablePartners: (params = {}) => api.get('/hod/partners/filtered', { params }), // Updated to filtered endpoint
  getFilteredPartners: (params = {}) => api.get('/hod/partners/filtered', { params }),
  assignStudent: (payload) => api.post('/hod/manual-assignment', payload),
  getHodRecentActivity: (params = {}) => api.get('/hod/recent-activity', { params }),
  getHodVerificationRequests: () => api.get('/hod/verification-requests'),
  updateHodVerificationRequest: (studentId, payload) => api.put(`/hod/verification-requests/${studentId}`, payload),
  patchStudentStatus: (studentId, payload) => api.patch(`/students/${studentId}/status`, payload),
  resetAssignment: (studentId) => api.patch(`/hod/reset-assignment/${studentId}`),
  getDepartmentDashboard: () => api.get('/admin/department'),
  getAnalyticsDashboard: () => api.get('/admin/analytics'),
  getFraudDetection: () => api.get('/admin/fraud-detection'),
  getCertificates: (params = {}) => api.get('/admin/certificates', { params }),
  verifyCertificate: (applicationId, payload) => api.put(`/admin/certificates/${applicationId}/verify`, payload),
  issueCertificate: (applicationId) => api.put(`/admin/certificates/${applicationId}/issue`),
  getInternshipStatistics: () => api.get('/admin/reports/internship-statistics'),
  generateReport: (payload = {}) => api.post('/admin/reports/generate', payload),
  getEvaluations: (params = {}) => api.get('/evaluation/admin/all', { params }),
  getSettingsOverview: () => api.get('/admin/settings'),
  getSecurityOverview: () => api.get('/admin/security-overview'),
  updateRolePermissions: (payload) => api.put('/admin/settings/permissions', payload),
  updateSystemConfig: (payload) => api.put('/admin/settings/config', payload),
  getUsers: (params = {}) => api.get('/admin/users', { params }),
  getStudents: (params = {}) => api.get('/admin/students', { params }),
  getStudentProfile: (id) => api.get(`/admin/students/${id}`),
  getCompanies: (params = {}) => api.get('/admin/companies', { params }),
  getCompanyProfile: (id) => api.get(`/admin/companies/${id}`),
  getDeanCandidates: () => api.get('/admin/college-deans'),
  getInternships: (params = {}) => api.get('/admin/internships', { params }),
  getApplications: (params = {}) => api.get('/admin/applications', { params }),
  exportUsers: (params = {}) => api.get('/admin/users/export', { params, responseType: 'blob' }),
  exportStudents: (params = {}) => api.get('/admin/students/export', { params, responseType: 'blob' }),
  exportCompanies: (params = {}) => api.get('/admin/companies/export', { params, responseType: 'blob' }),
  exportInternships: (params = {}) => api.get('/admin/internships/export', { params, responseType: 'blob' }),
  exportApplications: (params = {}) => api.get('/admin/applications/export', { params, responseType: 'blob' }),
  updateCompanyVerification: (id, payload) => api.put(`/admin/companies/${id}/verification`, payload),
  resetCompanyVerification: (id) => api.patch(`/companies/${id}/reset`),
  updateInternshipStatus: (id, payload) => api.put(`/admin/internships/${id}/status`, payload),
  updateApplicationStatus: (id, payload) => api.put(`/admin/applications/${id}/status`, payload),
  getAuditLogs: (params = {}) => api.get('/admin/audit-logs', { params }),
  exportAuditLogs: (params = {}) => api.get('/admin/audit-logs/export', { params, responseType: 'blob' }),
  getColleges: () => api.get('/admin/colleges'),
  exportColleges: () => api.get('/admin/colleges/export', { responseType: 'blob' }),
  createCollege: (payload) => api.post('/admin/colleges', payload),
  updateCollege: (id, payload) => api.put(`/admin/colleges/${id}`, payload),
  assignCollegeDean: (id, payload) => api.put(`/admin/colleges/${id}/dean`, payload),
  resetCollegeDeanPassword: (id) => api.post(`/admin/colleges/${id}/dean/reset-password`),
  deleteCollege: (id) => api.delete(`/admin/colleges/${id}`),
  getDepartments: () => api.get('/admin/departments'),
  getDepartmentHeadCandidates: () => api.get('/admin/department-heads'),
  createDepartment: (payload) => api.post('/admin/departments', payload),
  updateDepartment: (id, payload) => api.put(`/admin/departments/${id}`, payload),
  updateDepartmentHod: (id, payload) => api.put(`/admin/departments/${id}`, buildDepartmentUpdatePayload(payload)),
  assignDepartmentHead: (id, payload) => api.put(`/admin/departments/${id}/head`, payload),
  resetDepartmentHeadPassword: (id) => api.post(`/admin/departments/${id}/head/reset-password`),
  deleteDepartment: (id) => api.delete(`/admin/departments/${id}`),
  getAdminNotifications: (params = {}) => api.get('/admin/notifications', { params }),
  sendAnnouncement: (payload) => api.post('/admin/notifications/announce', payload),
  getNotifications: (params = {}) => api.get('/notification', { params }),
  markNotificationRead: (id) => api.put(`/notification/read/${id}`),
  markAllNotificationsRead: () => api.put('/notification/read-all'),
  deleteNotification: (id) => api.delete(`/notification/${id}`),
  getPreferences: () => api.get('/user-preferences'),
  updateNotificationPreferences: (payload) => api.put('/user-preferences/notifications', payload),
  sendTestEmail: () => api.post('/user-preferences/test-email')
};
