import api from '@/services/api';

export const studentAPI = {
  getDashboard: () => api.get('/dashboard/student'),
  getProfile: () => api.get('/student/profile'),
  updateProfile: (payload) => api.put('/student/profile', payload),
  getApplications: () => api.get('/application/my'),
  getInternships: (params = {}) => api.get('/internships', { params }),
  getFilters: () => api.get('/internships/filters'),
  downloadEvaluationPaper: () => api.get('/evaluation/student/paper', { responseType: 'blob' }),
  getInternshipSuggestions: (q) => api.get('/internships/suggestions', { params: { q } }),
  applyForInternship: (payload) => api.post('/application/apply', payload),
  getNotifications: (params = {}) => api.get('/notification', { params }),
  markNotificationRead: (id) => api.put(`/notification/read/${id}`),
  markAllNotificationsRead: () => api.put('/notification/read-all'),
  deleteNotification: (id) => api.delete(`/notification/${id}`),
  toggleSavedInternship: (internshipId) => api.post('/student/saved-internships', { internshipId }),
  getSavedInternships: () => api.get('/student/saved-internships'),
  withdrawApplication: (id) => api.put(`/application/withdraw/${id}`),
  respondToOffer: (id, status) => api.put(`/application/respond/${id}`, { status }),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  getPreferences: () => api.get('/user-preferences'),
  updateNotifications: (payload) => api.put('/user-preferences/notifications', payload),
  sendTestEmail: () => api.post('/user-preferences/test-email')
};
