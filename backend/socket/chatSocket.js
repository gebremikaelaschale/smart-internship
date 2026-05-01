const jwt = require('jsonwebtoken');
const { normalizeRole } = require('../utils/governanceRoles');

function createChatSocket(io) {
    io.use((socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
            if (!token) {
                return next(new Error('No token'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = {
                id: decoded.userId || decoded.id || decoded._id,
                role: normalizeRole(decoded.role),
                email: decoded.email || ''
            };
            return next();
        } catch (error) {
            return next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = String(socket.user?.id || '');
        if (!userId) {
            socket.disconnect();
            return;
        }

        const User = require('../models/User');

        socket.join(`user:${userId}`);
        
        // Update user status to online
        User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() }).catch(err => console.error(err));
        
        // Broadcast presence update to everyone who might be listening
        io.emit('presence:update', { userId, online: true, lastSeen: new Date() });

        socket.on('chat:joinRoom', ({ roomId }) => {
            if (!roomId) return;
            socket.join(`room:${roomId}`);
        });

        socket.on('chat:leaveRoom', ({ roomId }) => {
            if (!roomId) return;
            socket.leave(`room:${roomId}`);
        });

        socket.on('chat:typing', ({ roomId, toUserId, isTyping = true }) => {
            const payload = { fromUserId: userId, isTyping: Boolean(isTyping), roomId: roomId || null };
            if (roomId) {
                socket.to(`room:${roomId}`).emit('chat:typing', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('chat:typing', payload);
            }
        });

        socket.on('chat:seen', ({ roomId, toUserId, messageIds = [] }) => {
            const payload = { byUserId: userId, roomId: roomId || null, toUserId: toUserId || null, messageIds };
            if (roomId) {
                socket.to(`room:${roomId}`).emit('chat:seen', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('chat:seen', payload);
            }
        });

        // Enhanced read receipt socket events
        socket.on('message:mark-delivered', ({ messageId, toUserId }) => {
            const payload = { messageId, deliveredBy: userId, deliveredAt: new Date() };
            if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:delivered', payload);
            }
        });

        socket.on('message:mark-read', ({ messageId, toUserId, roomId }) => {
            const payload = { messageId, readBy: userId, readAt: new Date(), roomId };
            if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:read', payload);
            } else if (roomId) {
                socket.to(`room:${roomId}`).emit('message:read', payload);
            }
        });

        socket.on('message:batch-read', ({ messageIds, toUserId, roomId }) => {
            const payload = { messageIds, readBy: userId, readAt: new Date(), roomId };
            if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:batch-read', payload);
            } else if (roomId) {
                socket.to(`room:${roomId}`).emit('message:batch-read', payload);
            }
        });

        // Message action events
        socket.on('message:edit', ({ messageId, content, roomId, toUserId }) => {
            const payload = { 
                messageId, 
                content, 
                editedBy: userId, 
                editedAt: new Date(),
                roomId,
                toUserId
            };
            
            if (roomId) {
                socket.to(`room:${roomId}`).emit('message:edited', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:edited', payload);
            }
        });

        socket.on('message:delete', ({ messageId, roomId, toUserId, forEveryone = true }) => {
            const payload = { 
                messageId, 
                deletedBy: userId, 
                deletedAt: new Date(),
                forEveryone,
                roomId,
                toUserId
            };
            
            if (roomId) {
                socket.to(`room:${roomId}`).emit('message:deleted', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:deleted', payload);
            }
        });

        socket.on('message:hard-delete', ({ messageId, roomId, toUserId }) => {
            const payload = { 
                messageId, 
                deletedBy: userId, 
                deletedAt: new Date(),
                hardDelete: true,
                roomId,
                toUserId
            };
            
            if (roomId) {
                socket.to(`room:${roomId}`).emit('message:hard-deleted', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:hard-deleted', payload);
            }
        });

        socket.on('message:reply', ({ messageId, replyTo, roomId, toUserId }) => {
            const payload = { 
                messageId, 
                replyTo, 
                repliedBy: userId, 
                repliedAt: new Date(),
                roomId,
                toUserId
            };
            
            if (roomId) {
                socket.to(`room:${roomId}`).emit('message:replied', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('message:replied', payload);
            }
        });

        // Typing indicators
        socket.on('typing:start', ({ roomId, toUserId }) => {
            const payload = { userId, typing: true };
            if (roomId) {
                socket.to(`room:${roomId}`).emit('typing:status', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('typing:status', payload);
            }
        });

        socket.on('typing:stop', ({ roomId, toUserId }) => {
            const payload = { userId, typing: false };
            if (roomId) {
                socket.to(`room:${roomId}`).emit('typing:status', payload);
            } else if (toUserId) {
                socket.to(`user:${toUserId}`).emit('typing:status', payload);
            }
        });

        // Auto-deliver messages when user comes online
        socket.on('message:delivered-auto', ({ messageIds }) => {
            // This event is triggered when a user comes online and messages are auto-delivered
            // The backend will handle the database updates and emit proper events
        });

        socket.on('call:join', ({ callId }) => {
            if (!callId) return;
            socket.join(`call:${callId}`);
            socket.to(`call:${callId}`).emit('call:participant-joined', { callId, userId });
        });

        socket.on('call:leave', ({ callId }) => {
            if (!callId) return;
            socket.leave(`call:${callId}`);
            socket.to(`call:${callId}`).emit('call:participant-left', { callId, userId });
        });

        socket.on('call:signal', ({ callId, toUserId, signalType, signalData, mode }) => {
            const payload = {
                callId,
                fromUserId: userId,
                toUserId: toUserId || null,
                signalType,
                signalData,
                mode: mode || 'video'
            };
            if (toUserId) {
                socket.to(`user:${toUserId}`).emit('call:signal', payload);
            } else if (callId) {
                socket.to(`call:${callId}`).emit('call:signal', payload);
            }
        });

        socket.on('disconnect', async () => {
            const User = require('../models/User');
            const now = new Date();
            await User.findByIdAndUpdate(userId, { isOnline: false, lastSeen: now }).catch(err => console.error(err));
            io.emit('presence:update', { userId, online: false, lastSeen: now });
        });
    });
}

module.exports = { createChatSocket };
