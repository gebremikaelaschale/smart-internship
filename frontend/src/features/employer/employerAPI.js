import api from '@/services/api';

export const employerAPI = {
  getDashboard: (params = {}) => api.get('/dashboard/employer', { params }),
  getProfile: () => api.get('/employer-profile'),
  updateProfile: (payload) => api.post('/employer-profile', payload),
  getReportsSummary: () => api.get('/dashboard/employer/reports'),
  getActivityFeed: (params = {}) => api.get('/dashboard/employer/activity', { params }),
  downloadAnalyticsPdf: (params = {}) => api.get('/dashboard/employer/reports/pdf', { params, responseType: 'blob' }),
  createInternship: (payload) => api.post('/internships', payload),
  getInternship: (id) => api.get(`/internships/${id}`),
  updateInternship: (id, payload) => api.put(`/internships/${id}`, payload),
  getApplicants: (params = {}) => api.get('/application/employer/all', { params }),
  getActiveInterns: () => api.get('/application/employer/active'),
  getEvaluationTargets: () => api.get('/evaluation/targets'),
  submitEvaluation: (payload) => api.post('/evaluation', payload),
  updateApplicationStatus: (id, payload) => api.put(`/application/status/${id}`, payload),
  getMyPrograms: () => api.get('/internships/my-internships'),
  updateProgramStatus: (id, status) => api.put(`/internships/${id}/status`, { status }),
  deleteProgram: (id) => api.delete(`/internships/${id}`),
  getNotifications: (params = {}) => api.get('/notification', { params }),
  markNotificationRead: (id) => api.put(`/notification/read/${id}`),
  markAllNotificationsRead: () => api.put('/notification/read-all'),
  deleteNotification: (id) => api.delete(`/notification/${id}`)
};
