const mongoose = require('mongoose');

const loginLogSchema = new mongoose.Schema(
    {
        email: { type: String, default: null },
        oid: { type: String, default: null },
        tid: { type: String, default: null },
        status: { type: String, enum: ['SUCCESS', 'FAILURE'], required: true },
        reason: { type: String, required: true },
        ipAddress: { type: String, default: null },
        userAgent: { type: String, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model('LoginLog', loginLogSchema);
