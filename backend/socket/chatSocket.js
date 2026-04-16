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

        socket.join(`user:${userId}`);
        io.to(`user:${userId}`).emit('presence:update', { userId, online: true });

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

        socket.on('disconnect', () => {
            io.to(`user:${userId}`).emit('presence:update', { userId, online: false });
        });
    });
}

module.exports = { createChatSocket };
