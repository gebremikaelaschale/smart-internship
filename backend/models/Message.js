const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
    conversationType: { type: String, enum: ['direct', 'group', 'channel'], default: 'direct' },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' }, // Optional context of the chat
    content: { type: String, required: true },
    messageType: { type: String, enum: ['text', 'signal', 'system'], default: 'text' },
    callId: { type: String, default: '' },
    callMedia: { type: String, enum: ['', 'audio', 'video', 'screen'], default: '' },
    signalType: { type: String, enum: ['', 'offer', 'answer', 'candidate', 'hangup', 'start'], default: '' },
    signalData: { type: mongoose.Schema.Types.Mixed },
    attachment: {
        name: { type: String, default: '' },
        type: { type: String, default: '' },
        mimeType: { type: String, default: '' }, // MIME type for smart media handling
        size: { type: Number, default: 0 },
        url: { type: String, default: '' },
        thumbnailUrl: { type: String, default: '' }, // For image previews
        dimensions: { // For images/videos
            width: { type: Number, default: 0 },
            height: { type: Number, default: 0 }
        },
        duration: { type: Number, default: 0 } // For videos/audio in seconds
    },
    replyTo: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Message',
        default: null
    },
    replyPreview: { // Cached reply preview for performance
        content: { type: String, default: '' },
        senderName: { type: String, default: '' },
        attachmentType: { type: String, default: '' }
    },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    editedAt: { type: Date, default: null },
    isEdited: { type: Boolean, default: false }, // Track if message was edited
    originalContent: { type: String, default: '' }, // Store original content for edit history
    deletedForEveryone: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deletedForUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
    }],
    isRead: { type: Boolean, default: false },
    status: { 
        type: String, 
        enum: ['sent', 'delivered', 'read'], 
        default: 'sent' 
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
