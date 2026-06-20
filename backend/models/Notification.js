const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiverRole: {
        type: String,
        enum: ['student', 'employer', 'industry', 'hod', 'dean', 'admin', 'super_admin'],
        required: true
    },
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    senderRole: { type: String, enum: ['hod', 'employer', 'admin', 'dean', 'super_admin', 'system'], default: 'system' },
    title: { type: String, required: true },
    message: { type: String, required: true },
    targetRoute: { type: String, default: '' },
    category: {
        type: String,
        enum: ['new-applicant', 'internship-started', 'deadline-reminder', 'general'],
        default: 'general'
    },
    sourceKey: { type: String, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    type: { 
        type: String, 
        enum: ['info', 'success', 'warning', 'error'], 
        default: 'info' 
    },
    isRead: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

notificationSchema.index({ userId: 1, sourceKey: 1 }, { unique: true, sparse: true });
notificationSchema.index({ userId: 1, receiverRole: 1, createdAt: -1 });

notificationSchema.statics.upsertBySourceKey = async function upsertBySourceKey(payload = {}) {
    const sourceKey = String(payload.sourceKey || '').trim();
    if (!sourceKey) return null;

    const now = new Date();
    const update = {
        $set: {
            receiverRole: payload.receiverRole,
            senderId: payload.senderId || null,
            senderRole: payload.senderRole || 'system',
            title: payload.title,
            message: payload.message,
            targetRoute: payload.targetRoute || '',
            category: payload.category || 'general',
            type: payload.type || 'info',
            isRead: false,
            metadata: payload.metadata || {},
            sourceKey,
            createdAt: now
        },
        $setOnInsert: {
            userId: payload.userId,
        }
    };

    return this.findOneAndUpdate(
        { userId: payload.userId, sourceKey },
        update,
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
};

notificationSchema.set('toJSON', {
    virtuals: true,
    transform(doc, ret) {
        ret.id = String(ret._id);
        ret.user_id = ret.userId;
        ret.is_read = Boolean(ret.isRead);
        ret.created_at = ret.createdAt;
        ret.sender_id = ret.senderId || null;
        ret.sender_role = ret.senderRole || 'system';
        ret.receiver_role = ret.receiverRole || '';
        return ret;
    }
});

notificationSchema.set('toObject', {
    virtuals: true,
    transform(doc, ret) {
        ret.id = String(ret._id);
        ret.user_id = ret.userId;
        ret.is_read = Boolean(ret.isRead);
        ret.created_at = ret.createdAt;
        ret.sender_id = ret.senderId || null;
        ret.sender_role = ret.senderRole || 'system';
        ret.receiver_role = ret.receiverRole || '';
        return ret;
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
