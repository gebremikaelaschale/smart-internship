import api from '@/services/api';

export const messagingAPI = {
  // Contacts and rooms
  getContacts: (params = {}) => api.get('/messages/contacts', { params }),
  getOnlineStatus: (ids) => api.get('/messages/online-status', { params: { ids: ids.join(',') } }),
  getRooms: () => api.get('/messages/rooms'),
  createRoom: (payload) => api.post('/messages/rooms', payload),
  addRoomMember: (roomId, memberId) => api.post(`/messages/rooms/${roomId}/members`, { memberId }),
  promoteRoomAdmin: (roomId, memberId) => api.post(`/messages/rooms/${roomId}/admins`, { memberId }),
  demoteRoomAdmin: (roomId, memberId) => api.delete(`/messages/rooms/${roomId}/admins/${memberId}`),
  getDirectHistory: (otherUserId, params = {}) => api.get(`/messages/history/direct/${otherUserId}`, { params }),
  getRoomHistory: (roomId, params = {}) => api.get(`/messages/history/room/${roomId}`, { params }),
  getUnreadCount: () => api.get('/messages/unread-count'),
  
  // Message operations
  sendMessage: (payload) => api.post('/messages', payload),
  editMessage: (id, payload) => api.patch(`/messages/${id}/edit`, payload),
  deleteMessage: (id, forEveryone = true) => api.delete(`/messages/${id}?forEveryone=${forEveryone ? 'true' : 'false'}`),
  bulkDeleteMessages: (messageIds) => api.delete('/messages/bulk', { data: { messageIds } }),
  reactMessage: (id, payload) => api.post(`/messages/${id}/react`, payload),
  removeReaction: (id, emoji) => api.delete(`/messages/${id}/react/${emoji}`),
  forwardMessage: (id, payload) => api.post(`/messages/${id}/forward`, payload),
  
  // Message status and read receipts
  markDirectSeen: (otherUserId) => api.put(`/messages/seen/direct/${otherUserId}`),
  markRoomSeen: (roomId) => api.put(`/messages/seen/room/${roomId}`),
  markConversationAsRead: ({ otherUserId = null, roomId = null }) => api.patch('/messages/mark-as-read', { otherUserId, roomId }),
  markMessageDelivered: (messageId) => api.put(`/messages/status/delivered/${messageId}`),
  markMessageRead: (messageId) => api.put(`/messages/status/read/${messageId}`),
  markMessagesRead: (messageIds, roomId, otherUserId) => api.put('/messages/status/batch-read', { messageIds, roomId, otherUserId }),
  
  // User preferences for chat customization
  getUserPreferences: () => api.get('/user-preferences'),
  updateChatBubble: (payload) => api.put('/user-preferences/chat-bubble', payload),
  updateMessageDisplay: (payload) => api.put('/user-preferences/message-display', payload),
  updateTheme: (payload) => api.put('/user-preferences/theme', payload),
  resetPreferences: () => api.post('/user-preferences/reset'),
  
  // Media upload and processing (placeholder for future implementation)
  uploadMedia: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    
    return api.post('/messages/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      }
    });
  },
  
  // Enhanced message search
  searchMessages: (query, options = {}) => api.get('/messages/search', { 
    params: { q: query, ...options } 
  }),
  
  // Voice calls
  startCallSession: (payload) => api.post('/messages/calls/start', payload),
  updateCallState: (callId, payload) => api.put(`/messages/calls/${callId}/state`, payload),
  getCallHistory: (params = {}) => api.get('/messages/calls/history', { params })
};
