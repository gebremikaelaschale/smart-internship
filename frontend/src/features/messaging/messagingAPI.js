import api from '@/services/api';

export const messagingAPI = {
  getContacts: (params = {}) => api.get('/messages/contacts', { params }),
  getRooms: () => api.get('/messages/rooms'),
  createRoom: (payload) => api.post('/messages/rooms', payload),
  addRoomMember: (roomId, payload) => api.post(`/messages/rooms/${roomId}/members`, payload),
  promoteRoomAdmin: (roomId, payload) => api.post(`/messages/rooms/${roomId}/admins`, payload),
  demoteRoomAdmin: (roomId, memberId) => api.delete(`/messages/rooms/${roomId}/admins/${memberId}`),
  getDirectHistory: (otherUserId, params = {}) => api.get(`/messages/history/direct/${otherUserId}`, { params }),
  getRoomHistory: (roomId, params = {}) => api.get(`/messages/history/room/${roomId}`, { params }),
  sendMessage: (payload) => api.post('/messages', payload),
  editMessage: (id, payload) => api.patch(`/messages/${id}/edit`, payload),
  deleteMessage: (id, forEveryone = true) => api.delete(`/messages/${id}?forEveryone=${forEveryone ? 'true' : 'false'}`),
  reactMessage: (id, payload) => api.post(`/messages/${id}/react`, payload),
  forwardMessage: (id, payload) => api.post(`/messages/${id}/forward`, payload),
  markDirectSeen: (otherUserId) => api.put(`/messages/seen/direct/${otherUserId}`),
  markRoomSeen: (roomId) => api.put(`/messages/seen/room/${roomId}`),
  startCallSession: (payload) => api.post('/messages/calls/start', payload),
  updateCallState: (callId, payload) => api.put(`/messages/calls/${callId}/state`, payload),
  getCallHistory: (params = {}) => api.get('/messages/calls/history', { params })
};
