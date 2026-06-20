import api from '@/services/api';

export const authAPI = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  changePassword: (payload, token) => api.post('/auth/change-password', payload, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined),
  logout: () => api.post('/auth/logout')
};
