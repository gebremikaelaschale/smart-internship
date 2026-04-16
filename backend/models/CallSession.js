const mongoose = require('mongoose');

const CallSessionSchema = new mongoose.Schema({
    callId: { type: String, required: true, unique: true, index: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatRoom' },
    initiatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mode: { type: String, enum: ['audio', 'video'], required: true },
    state: { type: String, enum: ['ringing', 'active', 'ended', 'missed'], default: 'ringing' },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('CallSession', CallSessionSchema);
