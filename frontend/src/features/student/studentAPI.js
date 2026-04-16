import api from '@/services/api';

export const studentAPI = {
  getDashboard: () => api.get('/dashboard/student'),
  getProfile: () => api.get('/student/profile'),
  updateProfile: (payload) => api.put('/student/profile', payload),
  getApplications: () => api.get('/application/my'),
  getInternships: (params = {}) => api.get('/internships', { params }),
  downloadEvaluationPaper: () => api.get('/evaluation/student/paper', { responseType: 'blob' }),
  getInternshipSuggestions: (q) => api.get('/internships/suggestions', { params: { q } }),
  applyInternship: (payload) => api.post('/application/apply', payload),
  getNotifications: (params = {}) => api.get('/notification', { params }),
  markNotificationRead: (id) => api.put(`/notification/read/${id}`),
  markAllNotificationsRead: () => api.put('/notification/read-all'),
  deleteNotification: (id) => api.delete(`/notification/${id}`)
};
