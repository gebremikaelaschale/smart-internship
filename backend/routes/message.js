const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const Profile = require('../models/Profile');
const CompanyProfile = require('../models/CompanyProfile');
const ChatRoom = require('../models/ChatRoom');
const CallSession = require('../models/CallSession');
const { normalizeRole } = require('../utils/governanceRoles');

function getRoleVariants(role) {
    const value = String(role || 'all').trim().toLowerCase();
    if (value === 'student') return ['student', 'Student'];
    if (value === 'employer') return ['employer', 'Employer', 'Industry Partner'];
    if (value === 'admin') return ['admin', 'dean', 'hod', 'Admin', 'SuperAdmin', 'CollegeAdmin', 'DeptAdmin'];
    if (value === 'dean') return ['dean', 'collegeadmin', 'CollegeAdmin'];
    if (value === 'hod') return ['hod', 'deptadmin', 'DeptAdmin'];
    return [];
}

function asObjectId(value) {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
    return new mongoose.Types.ObjectId(value);
}

function emitSocket(io, room, event, payload) {
    if (!io || !room || !event) return;
    io.to(room).emit(event, payload);
}

async function populateMessage(messageId) {
    return Message.findById(messageId)
        .populate('senderId', 'name fullName email role')
        .populate('receiverId', 'name fullName email role')
        .populate('replyTo', 'content senderId createdAt messageType attachment')
        .lean();
}

// Lightweight online status endpoint - returns isOnline & lastSeen for given user IDs
router.get('/online-status', auth, async (req, res) => {
    try {
        const ids = String(req.query.ids || '').split(',').filter(id => mongoose.Types.ObjectId.isValid(id.trim()));
        if (!ids.length) return res.json({});
        const users = await User.find({ _id: { $in: ids } }, 'isOnline lastSeen').lean();
        const result = {};
        users.forEach(u => {
            result[String(u._id)] = { isOnline: Boolean(u.isOnline), lastSeen: u.lastSeen || null };
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get online statuses.' });
    }
});

router.get('/contacts', auth, async (req, res) => {
    try {
        const role = String(req.query.role || 'all').trim().toLowerCase();
        const search = String(req.query.search || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

        const filter = { _id: { $ne: asObjectId(req.user.id) } };
        const roleVariants = getRoleVariants(role);
        if (role !== 'all' && roleVariants.length > 0) {
            filter.role = { $in: roleVariants };
        }
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            filter.$or = [{ name: regex }, { fullName: regex }, { email: regex }, { department: regex }, { college: regex }];
        }

        const items = await User.aggregate([
            { $match: filter },
            { $sort: { fullName: 1, name: 1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'profileData'
                }
            },
            {
                $lookup: {
                    from: 'companyprofiles',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'companyData'
                }
            },
            {
                $lookup: {
                    from: 'messages',
                    let: { contactId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$conversationType', 'direct'] },
                                        { $not: { $in: [asObjectId(req.user.id), { $ifNull: ['$deletedForUsers', []] }] } },
                                        {
                                            $or: [
                                                { $and: [{ $eq: ['$senderId', '$$contactId'] }, { $eq: ['$receiverId', asObjectId(req.user.id)] }] },
                                                { $and: [{ $eq: ['$senderId', asObjectId(req.user.id)] }, { $eq: ['$receiverId', '$$contactId'] }] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: 'lastMsgData'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    fullName: 1,
                    email: 1,
                    role: 1,
                    department: 1,
                    college: 1,
                    isOnline: 1,
                    lastSeen: 1,
                    avatar: {
                        $cond: [
                            { $gt: [{ $size: '$companyData' }, 0] },
                            { $arrayElemAt: ['$companyData.logo', 0] },
                            {
                                $cond: [
                                    { $gt: [{ $size: '$profileData' }, 0] },
                                    { $arrayElemAt: ['$profileData.profilePicUrl', 0] },
                                    null
                                ]
                            }
                        ]
                    },
                    lastMessage: { $arrayElemAt: ['$lastMsgData', 0] }
                }
            }
        ]);

        const result = items.map(u => ({
            ...u,
            id: String(u._id),
            _id: String(u._id),
            type: 'direct',
            role: normalizeRole(u.role),
            lastMessage: u.lastMessage ? {
                content: u.lastMessage.content,
                createdAt: u.lastMessage.createdAt,
                senderId: String(u.lastMessage.senderId)
            } : null,
            unreadCount: 0 
        }));

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load chat contacts.' });
    }
});

router.get('/rooms', auth, async (req, res) => {
    try {
        const rooms = await ChatRoom.find({ members: req.user.id })
            .select('name type ownerId members admins mutedBy lastMessageAt')
            .sort({ lastMessageAt: -1 })
            .lean();

        const allMemberIds = [...new Set(rooms.flatMap((room) => Array.isArray(room.members) ? room.members.map((item) => String(item)) : []))];
        const memberProfiles = await User.find({ _id: { $in: allMemberIds } })
            .select('name fullName email role department college')
            .lean();
        const profileById = new Map(memberProfiles.map((item) => [String(item._id), item]));

        const roomIds = rooms.map((room) => room._id);
        const recentMessages = await Message.find({ roomId: { $in: roomIds }, conversationType: { $in: ['group', 'channel'] } })
            .sort({ createdAt: -1 })
            .lean();

        const latestByRoom = new Map();
        for (const message of recentMessages) {
            const key = String(message.roomId || '');
            if (key && !latestByRoom.has(key)) {
                latestByRoom.set(key, message);
            }
        }

        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    roomId: { $in: roomIds },
                    senderId: { $ne: asObjectId(req.user.id) },
                    seenBy: { $nin: [asObjectId(req.user.id)] },
                    deletedForEveryone: false,
                    deletedForUsers: { $nin: [asObjectId(req.user.id)] }
                }
            },
            { $group: { _id: '$roomId', count: { $sum: 1 } } }
        ]).catch(() => []);
        const unreadMap = new Map(unreadCounts.map((item) => [String(item._id), item.count]));

        res.json(rooms.map((room) => ({
            id: String(room._id),
            type: room.type,
            name: room.name,
            ownerId: String(room.ownerId),
            members: Array.isArray(room.members) ? room.members.map((item) => String(item)) : [],
            admins: Array.isArray(room.admins) ? room.admins.map((item) => String(item)) : [],
            memberProfiles: Array.isArray(room.members) ? room.members.map((memberId) => {
                const profile = profileById.get(String(memberId));
                return profile ? {
                    id: String(memberId),
                    name: profile.fullName || profile.name || profile.email,
                    role: normalizeRole(profile.role),
                    department: profile.department || '',
                    college: profile.college || ''
                } : { id: String(memberId), name: String(memberId).slice(0, 8), role: 'student' };
            }) : [],
            membersCount: Array.isArray(room.members) ? room.members.length : 0,
            canPost: room.type !== 'channel' || String(room.ownerId) === String(req.user.id) || (Array.isArray(room.admins) && room.admins.some((item) => String(item) === String(req.user.id))),
            isMuted: Array.isArray(room.mutedBy) ? room.mutedBy.some((item) => String(item) === String(req.user.id)) : false,
            unreadCount: unreadMap.get(String(room._id)) || 0,
            lastMessage: latestByRoom.get(String(room._id)) || null
        })));
    } catch (error) {
        res.status(500).json({ message: 'Failed to load rooms.' });
    }
});

router.post('/rooms', auth, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const type = String(req.body.type || 'group').trim().toLowerCase();
        const membersInput = Array.isArray(req.body.members) ? req.body.members : [];
        const members = [...new Set(membersInput.map((item) => String(item)).filter(Boolean))];

        if (!name) {
            return res.status(400).json({ message: 'Room name is required.' });
        }
        if (!['group', 'channel'].includes(type)) {
            return res.status(400).json({ message: 'Room type must be group or channel.' });
        }

        const memberSet = new Set(members);
        memberSet.add(String(req.user.id));

        const room = await ChatRoom.create({
            name,
            type,
            ownerId: req.user.id,
            members: [...memberSet],
            admins: [req.user.id],
            mutedBy: [],
            lastMessageAt: new Date()
        });

        res.status(201).json(room);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create room.' });
    }
});

router.post('/rooms/:roomId/members', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.body.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isAdmin = String(room.ownerId) === String(req.user.id) || room.admins.some((item) => String(item) === String(req.user.id));
        if (!isAdmin) return res.status(403).json({ message: 'Only room admins can add members.' });

        if (!memberId) return res.status(400).json({ message: 'memberId is required.' });
        if (!room.members.some((item) => String(item) === memberId)) {
            room.members.push(memberId);
            await room.save();
        }

        res.json({ message: 'Member added.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add member.' });
    }
});

router.post('/rooms/:roomId/admins', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.body.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isOwner = String(room.ownerId) === String(req.user.id);
        if (!isOwner) return res.status(403).json({ message: 'Only room owner can promote admins.' });

        if (!memberId) return res.status(400).json({ message: 'memberId is required.' });
        const isMember = room.members.some((item) => String(item) === memberId);
        if (!isMember) return res.status(400).json({ message: 'User must be a room member.' });

        if (!room.admins.some((item) => String(item) === memberId)) {
            room.admins.push(memberId);
            await room.save();
        }

        res.json({ message: 'Admin promoted.', admins: room.admins.map((item) => String(item)) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to promote admin.' });
    }
});

router.delete('/rooms/:roomId/admins/:memberId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.params.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isOwner = String(room.ownerId) === String(req.user.id);
        if (!isOwner) return res.status(403).json({ message: 'Only room owner can demote admins.' });
        if (String(room.ownerId) === memberId) return res.status(400).json({ message: 'Owner cannot be demoted.' });

        room.admins = room.admins.filter((item) => String(item) !== memberId);
        await room.save();

        res.json({ message: 'Admin demoted.', admins: room.admins.map((item) => String(item)) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to demote admin.' });
    }
});

router.get('/history/direct/:otherUserId', auth, async (req, res) => {
    try {
        const otherUserId = String(req.params.otherUserId || '').trim();
        if (!otherUserId) {
            return res.status(400).json({ message: 'otherUserId is required.' });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
        const before = req.query.before ? new Date(req.query.before) : null;
        const query = {
            conversationType: 'direct',
            deletedForUsers: { $nin: [asObjectId(req.user.id)] },
            $or: [
                { senderId: asObjectId(req.user.id), receiverId: asObjectId(otherUserId) },
                { senderId: asObjectId(otherUserId), receiverId: asObjectId(req.user.id) }
            ]
        };

        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('senderId', 'name fullName email role')
            .populate('receiverId', 'name fullName email role')
            .populate('replyTo', 'content senderId createdAt messageType attachment')
            .lean();

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load direct chat history.' });
    }
});

router.get('/history/room/:roomId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const room = await ChatRoom.findById(roomId).select('members').lean();
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isMember = Array.isArray(room.members) && room.members.some((item) => String(item) === String(req.user.id));
        if (!isMember) return res.status(403).json({ message: 'Not a room member.' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
        const before = req.query.before ? new Date(req.query.before) : null;
        const query = {
            roomId,
            conversationType: { $in: ['group', 'channel'] },
            deletedForUsers: { $nin: [asObjectId(req.user.id)] }
        };

        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('senderId', 'name fullName email role')
            .populate('receiverId', 'name fullName email role')
            .populate('replyTo', 'content senderId createdAt messageType attachment')
            .lean();

        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load room history.' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const receiverId = String(req.body.receiverId || '').trim();
        const roomId = String(req.body.roomId || '').trim();
        const content = String(req.body.content || '').trim();
        const internshipId = String(req.body.internshipId || '').trim();
        const messageType = String(req.body.messageType || 'text').trim().toLowerCase();
        const callId = String(req.body.callId || '').trim();
        const callMedia = String(req.body.callMedia || '').trim().toLowerCase();
        const signalType = String(req.body.signalType || '').trim().toLowerCase();
        const signalData = req.body.signalData;
        const replyTo = String(req.body.replyTo || '').trim();
        const forwardedFrom = String(req.body.forwardedFrom || '').trim();
        const conversationType = roomId ? (String(req.body.conversationType || 'group').trim().toLowerCase()) : 'direct';
        const attachmentInput = req.body.attachment && typeof req.body.attachment === 'object' ? req.body.attachment : null;
        const attachment = attachmentInput ? {
            name: String(attachmentInput.name || '').trim(),
            type: String(attachmentInput.type || '').trim(),
            size: Number(attachmentInput.size || 0),
            url: String(attachmentInput.url || '').trim()
        } : undefined;

        if (!['text', 'signal', 'system'].includes(messageType)) {
            return res.status(400).json({ message: 'Invalid messageType.' });
        }
        if (!content && !attachment && messageType === 'text') {
            return res.status(400).json({ message: 'content is required.' });
        }

        if (!roomId && !receiverId) {
            return res.status(400).json({ message: 'receiverId or roomId is required.' });
        }

        let room = null;
        if (roomId) {
            room = await ChatRoom.findById(roomId).select('members type ownerId admins').lean();
            if (!room) return res.status(404).json({ message: 'Room not found.' });
            const isMember = Array.isArray(room.members) && room.members.some((item) => String(item) === String(req.user.id));
            if (!isMember) return res.status(403).json({ message: 'Not a room member.' });
            const isChannel = String(room.type) === 'channel';
            const isAdmin = String(room.ownerId) === String(req.user.id) || (Array.isArray(room.admins) && room.admins.some((item) => String(item) === String(req.user.id)));
            if (isChannel && !isAdmin) {
                return res.status(403).json({ message: 'Only channel admins can post messages.' });
            }
        }

        // Handle reply preview creation
        let replyPreview = null;
        if (replyTo) {
            const originalMessage = await Message.findById(replyTo).populate('senderId', 'fullName name');
            if (originalMessage) {
                replyPreview = {
                    content: originalMessage.content.substring(0, 100) + (originalMessage.content.length > 100 ? '...' : ''),
                    senderName: originalMessage.senderId?.fullName || originalMessage.senderId?.name || 'Unknown',
                    attachmentType: originalMessage.attachment?.mimeType || ''
                };
            }
        }

        // Enhanced attachment handling
        let processedAttachment = attachment;
        if (attachment && typeof attachment === 'object') {
            processedAttachment = {
                name: String(attachment.name || '').trim(),
                type: String(attachment.type || '').trim(),
                mimeType: String(attachment.mimeType || '').trim(),
                size: Number(attachment.size || 0),
                url: String(attachment.url || '').trim(),
                thumbnailUrl: String(attachment.thumbnailUrl || '').trim(),
                dimensions: {
                    width: Number(attachment.dimensions?.width || 0),
                    height: Number(attachment.dimensions?.height || 0)
                },
                duration: Number(attachment.duration || 0)
            };
        }

        const payload = {
            senderId: req.user.id,
            receiverId: receiverId || req.user.id,
            roomId: roomId || undefined,
            conversationType: roomId ? room.type : 'direct',
            internshipId: internshipId || undefined,
            content: content || (attachment ? '[attachment]' : '[signal]'),
            messageType,
            callId,
            callMedia,
            signalType,
            signalData,
            attachment: processedAttachment,
            replyTo: replyTo || undefined,
            replyPreview,
            forwardedFrom: forwardedFrom || undefined,
            deliveredTo: [req.user.id],
            seenBy: [req.user.id],
            isRead: false
        };

        const message = await Message.create(payload);

        if (roomId) {
            await ChatRoom.updateOne({ _id: roomId }, { $set: { lastMessageAt: new Date() } }).catch(() => {});
        }

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');

        if (roomId) {
            emitSocket(io, `room:${roomId}`, 'message:new', populated);
        } else {
            emitSocket(io, `user:${receiverId}`, 'message:new', populated);
            emitSocket(io, `user:${req.user.id}`, 'message:new', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to send message.' });
    }
});

router.patch('/:id/edit', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const content = String(req.body.content || '').trim();
        if (!content) return res.status(400).json({ message: 'content is required.' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });
        if (String(message.senderId) !== String(req.user.id)) return res.status(403).json({ message: 'Only sender can edit message.' });
        if (message.deletedForEveryone) return res.status(400).json({ message: 'Cannot edit deleted message.' });

        // Store original content if not already stored
        if (!message.originalContent) {
            message.originalContent = message.content;
        }
        
        message.content = content;
        message.editedAt = new Date();
        message.isEdited = true; // Add isEdited flag
        await message.save();

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');
        
        // Emit enhanced edit event with full edit information
        const editPayload = {
            ...populated,
            isEdited: true,
            editEvent: {
                editedAt: message.editedAt,
                originalContent: message.originalContent,
                newContent: content,
                editedBy: String(req.user.id),
                messageId: String(message._id)
            }
        };
        
        // Broadcast to all relevant participants
        if (message.roomId) {
            emitSocket(io, `room:${message.roomId}`, 'message:edited', editPayload);
        } else {
            emitSocket(io, `user:${message.receiverId}`, 'message:edited', editPayload);
            emitSocket(io, `user:${message.senderId}`, 'message:edited', editPayload);
        }

        res.json({
            ...populated,
            isEdited: true,
            editEvent: editPayload.editEvent
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to edit message.' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const hardDelete = Boolean(req.query.hardDelete === 'true');

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const isSender = String(message.senderId) === String(req.user.id);
        const isReceiver = String(message.receiverId) === String(req.user.id);
        
        if (!isSender && !isReceiver) {
            return res.status(403).json({ message: 'You can only delete messages in your own conversations.' });
        }

        // COMPLETELY ERASE and REMOVE logic
        const deleteForEveryone = req.query.forEveryone === 'true';
        const io = req.app.get('io');
        const payload = { id: id, messageId: id, deleteForEveryone };

        if (deleteForEveryone) {
            // HARD DELETE for everyone
            await Message.findByIdAndDelete(id);
            
            if (message.roomId) {
                emitSocket(io, `room:${message.roomId}`, 'message:deleted', payload);
            } else {
                emitSocket(io, `user:${message.receiverId}`, 'message:deleted', payload);
                emitSocket(io, `user:${message.senderId}`, 'message:deleted', payload);
            }
            return res.json({ message: 'Message erased for everyone.', data: payload });
        } else {
            // DELETE FOR ME: Add user to deletedForUsers list
            if (!message.deletedForUsers.includes(req.user.id)) {
                message.deletedForUsers.push(req.user.id);
                await message.save();
            }
            
            // Only emit to the person who deleted it
            emitSocket(io, `user:${req.user.id}`, 'message:deleted', payload);
            
            return res.json({ message: 'Message erased for you.', data: payload });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete message.' });
    }
});

router.post('/:id/react', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const emoji = String(req.body.emoji || '').trim();
        if (!emoji) return res.status(400).json({ message: 'emoji is required.' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const existingIndex = message.reactions.findIndex((item) => String(item.userId) === String(req.user.id));
        if (existingIndex >= 0) {
            const existing = message.reactions[existingIndex];
            if (String(existing.emoji) === emoji) {
                message.reactions.splice(existingIndex, 1);
            } else {
                existing.emoji = emoji;
            }
        } else {
            message.reactions.push({ userId: req.user.id, emoji });
        }
        await message.save();

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');
        if (message.roomId) {
            emitSocket(io, `room:${message.roomId}`, 'message:updated', populated);
        } else {
            emitSocket(io, `user:${message.receiverId}`, 'message:updated', populated);
            emitSocket(io, `user:${message.senderId}`, 'message:updated', populated);
        }

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to react to message.' });
    }
});

router.post('/:id/forward', auth, async (req, res) => {
    try {
        const sourceId = String(req.params.id || '').trim();
        const receiverId = String(req.body.receiverId || '').trim();
        const roomId = String(req.body.roomId || '').trim();

        const sourceMessage = await Message.findById(sourceId).lean();
        if (!sourceMessage) return res.status(404).json({ message: 'Source message not found.' });

        if (!receiverId && !roomId) {
            return res.status(400).json({ message: 'receiverId or roomId is required for forward.' });
        }

        let targetRoom = null;
        if (roomId) {
            targetRoom = await ChatRoom.findById(roomId).select('members type ownerId admins').lean();
            if (!targetRoom) return res.status(404).json({ message: 'Room not found.' });
            const isMember = Array.isArray(targetRoom.members) && targetRoom.members.some((item) => String(item) === String(req.user.id));
            if (!isMember) return res.status(403).json({ message: 'Not a room member.' });
            const isChannel = String(targetRoom.type) === 'channel';
            const isAdmin = String(targetRoom.ownerId) === String(req.user.id) || (Array.isArray(targetRoom.admins) && targetRoom.admins.some((item) => String(item) === String(req.user.id)));
            if (isChannel && !isAdmin) {
                return res.status(403).json({ message: 'Only channel admins can forward messages to this channel.' });
            }
        }

        const forwarded = await Message.create({
            senderId: req.user.id,
            receiverId: receiverId || req.user.id,
            roomId: roomId || undefined,
            conversationType: roomId ? String(targetRoom?.type || 'group') : 'direct',
            content: sourceMessage.content,
            messageType: sourceMessage.messageType === 'signal' ? 'text' : sourceMessage.messageType,
            attachment: sourceMessage.attachment,
            forwardedFrom: sourceMessage._id,
            deliveredTo: [req.user.id],
            seenBy: [req.user.id],
            isRead: false
        });

        const populated = await populateMessage(forwarded._id);
        const io = req.app.get('io');
        if (roomId) {
            emitSocket(io, `room:${roomId}`, 'message:new', populated);
        } else {
            emitSocket(io, `user:${receiverId}`, 'message:new', populated);
            emitSocket(io, `user:${req.user.id}`, 'message:new', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to forward message.' });
    }
});

router.put('/seen/direct/:otherUserId', auth, async (req, res) => {
    try {
        const otherUserId = String(req.params.otherUserId || '').trim();
        if (!otherUserId) return res.status(400).json({ message: 'otherUserId is required.' });

        await Message.updateMany(
            { conversationType: 'direct', senderId: asObjectId(otherUserId), receiverId: asObjectId(req.user.id), seenBy: { $nin: [asObjectId(req.user.id)] } },
            { $addToSet: { seenBy: asObjectId(req.user.id), deliveredTo: asObjectId(req.user.id) }, $set: { isRead: true } }
        );

        const io = req.app.get('io');
        emitSocket(io, `user:${otherUserId}`, 'message:seen', { byUserId: String(req.user.id), conversationType: 'direct' });
        res.json({ message: 'Direct conversation marked seen.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark seen.' });
    }
});

router.put('/seen/room/:roomId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        if (!roomId) return res.status(400).json({ message: 'roomId is required.' });

        const updatedMessages = await Message.updateMany(
            { roomId, conversationType: { $in: ['group', 'channel'] }, seenBy: { $nin: [req.user.id] }, senderId: { $ne: req.user.id } },
            { 
                $addToSet: { seenBy: req.user.id, deliveredTo: req.user.id },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            }
        );

        const io = req.app.get('io');
        emitSocket(io, `room:${roomId}`, 'message:seen', { byUserId: String(req.user.id), roomId, conversationType: 'group' });
        res.json({ message: 'Room conversation marked seen.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark seen.' });
    }
});

// Enhanced status update endpoints for proper read receipts
router.put('/status/delivered/:messageId', auth, async (req, res) => {
    try {
        const messageId = String(req.params.messageId || '').trim();
        if (!messageId) return res.status(400).json({ message: 'messageId is required.' });

        const message = await Message.findByIdAndUpdate(
            messageId,
            { 
                $addToSet: { deliveredTo: req.user.id },
                $set: { status: 'delivered', deliveredAt: new Date() }
            },
            { new: true }
        ).populate('senderId', 'name fullName email role');

        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const io = req.app.get('io');
        emitSocket(io, `user:${message.senderId._id}`, 'message:delivered', {
            messageId: String(message._id),
            status: 'delivered',
            deliveredAt: message.deliveredAt,
            deliveredBy: String(req.user.id)
        });

        res.json({ message: 'Message marked as delivered.', status: 'delivered' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark as delivered.' });
    }
});

router.put('/status/read/:messageId', auth, async (req, res) => {
    try {
        const messageId = String(req.params.messageId || '').trim();
        if (!messageId) return res.status(400).json({ message: 'messageId is required.' });

        const message = await Message.findByIdAndUpdate(
            messageId,
            { 
                $addToSet: { seenBy: req.user.id, deliveredTo: req.user.id },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            },
            { new: true }
        ).populate('senderId', 'name fullName email role');

        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const io = req.app.get('io');
        emitSocket(io, `user:${message.senderId._id}`, 'message:read', {
            messageId: String(message._id),
            status: 'read',
            readAt: message.readAt,
            readBy: String(req.user.id)
        });

        res.json({ message: 'Message marked as read.', status: 'read' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark as read.' });
    }
});

router.put('/status/batch-read', auth, async (req, res) => {
    try {
        const { messageIds = [], roomId = null, otherUserId = null } = req.body;
        
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: 'messageIds array is required.' });
        }

        const updateQuery = {
            _id: { $in: messageIds.map(id => asObjectId(id)) },
            senderId: { $ne: asObjectId(req.user.id) },
            seenBy: { $nin: [asObjectId(req.user.id)] }
        };

        if (roomId) {
            updateQuery.roomId = asObjectId(roomId);
        } else if (otherUserId) {
            updateQuery.conversationType = 'direct';
            updateQuery.receiverId = asObjectId(req.user.id);
            updateQuery.senderId = asObjectId(otherUserId);
        }

        const updatedMessages = await Message.updateMany(
            updateQuery,
            { 
                $addToSet: { seenBy: asObjectId(req.user.id), deliveredTo: asObjectId(req.user.id) },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            }
        );

        // Get the updated messages to emit proper socket events
        const messages = await Message.find({ _id: { $in: messageIds.map(id => asObjectId(id)) } })
            .populate('senderId', 'name fullName email role')
            .lean();

        const io = req.app.get('io');
        const senderIds = [...new Set(messages.map(msg => String(msg.senderId._id)))];
        
        senderIds.forEach(senderId => {
            const senderMessages = messages.filter(msg => String(msg.senderId._id) === senderId);
            emitSocket(io, `user:${senderId}`, 'message:batch-read', {
                messageIds: senderMessages.map(msg => String(msg._id)),
                readBy: String(req.user.id),
                readAt: new Date(),
                roomId,
                otherUserId
            });
        });

        res.json({ 
            message: 'Messages marked as read.', 
            updatedCount: updatedMessages.modifiedCount,
            status: 'read'
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark messages as read.' });
    }
});

router.get('/calls/history', auth, async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const sessions = await CallSession.find({ participants: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('initiatorId', 'name fullName email role')
            .populate('participants', 'name fullName email role')
            .lean();

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load call history.' });
    }
});

router.post('/calls/start', auth, async (req, res) => {
    try {
        const callId = String(req.body.callId || '').trim();
        const mode = String(req.body.mode || 'audio').trim().toLowerCase();
        const roomId = String(req.body.roomId || '').trim();
        const participantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds.map((item) => String(item)).filter(Boolean) : [];

        if (!callId) return res.status(400).json({ message: 'callId is required.' });
        if (!['audio', 'video'].includes(mode)) return res.status(400).json({ message: 'mode must be audio or video.' });

        const uniqueParticipants = [...new Set([String(req.user.id), ...participantIds])];

        const session = await CallSession.findOneAndUpdate(
            { callId },
            {
                callId,
                roomId: roomId || undefined,
                initiatorId: req.user.id,
                participants: uniqueParticipants,
                mode,
                state: 'ringing',
                startedAt: new Date(),
                endedAt: null,
                durationSeconds: 0
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const io = req.app.get('io');
        uniqueParticipants.forEach((participantId) => {
            if (String(participantId) !== String(req.user.id)) {
                emitSocket(io, `user:${participantId}`, 'call:ringing', {
                    callId,
                    initiatorId: String(req.user.id),
                    participantIds: uniqueParticipants,
                    mode,
                    roomId: roomId || null
                });
            }
        });

        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Failed to start call session.' });
    }
});

router.put('/calls/:callId/state', auth, async (req, res) => {
    try {
        const callId = String(req.params.callId || '').trim();
        const state = String(req.body.state || '').trim().toLowerCase();
        if (!['ringing', 'active', 'ended', 'missed'].includes(state)) {
            return res.status(400).json({ message: 'Invalid call state.' });
        }

        const session = await CallSession.findOne({ callId });
        if (!session) return res.status(404).json({ message: 'Call session not found.' });

        session.state = state;
        if (state === 'ended' || state === 'missed') {
            session.endedAt = new Date();
            if (session.startedAt) {
                session.durationSeconds = Math.max(0, Math.round((session.endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000));
            }
        }
        await session.save();

        const io = req.app.get('io');
        session.participants.forEach((participantId) => {
            emitSocket(io, `user:${participantId}`, 'call:state', {
                callId,
                state,
                updatedBy: String(req.user.id),
                durationSeconds: session.durationSeconds
            });
        });

        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update call state.' });
    }
});

module.exports = router;
