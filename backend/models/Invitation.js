const mongoose = require('mongoose');

const invitationSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    token: { type: String, required: true, unique: true },
    role: { 
        type: String, 
        enum: ['Admin', 'SuperAdmin', 'CollegeAdmin', 'DeptAdmin'], 
        required: true 
    },
    isUsed: { type: Boolean, default: false },
    expiresAt: { 
        type: Date, 
        default: () => new Date(+new Date() + 7*24*60*60*1000) // 7 days expiration
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Invitation', invitationSchema);
