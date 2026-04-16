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
        size: { type: Number, default: 0 },
        url: { type: String, default: '' }
    },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
    editedAt: { type: Date, default: null },
    deletedForEveryone: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    reactions: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        emoji: { type: String, required: true }
    }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    seenBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
