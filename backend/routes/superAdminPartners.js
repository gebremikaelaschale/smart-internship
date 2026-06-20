const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const superAdminOnly = require('../middleware/superAdminMiddleware');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { updateCompanyStatus } = require('../controllers/companyStatusController');

async function createAndEmitNotification(req, payload) {
    const notification = await Notification.create(payload);
    try {
        const io = req.app.get('io');
        if (io && payload?.userId) {
            io.to(`user:${String(payload.userId)}`).emit('notification:new', notification.toObject());
        }
    } catch (e) {
        // notification writes must not fail because of socket errors
    }
    return notification;
}

// GET pending / unverified partners
router.get('/partners/pending', auth, superAdminOnly, async (req, res) => {
    try {
        const companies = await CompanyProfile.find({ 'verification.status': { $ne: 'Verified' } }).populate('user', 'fullName email isVerified').lean();
        res.json(companies);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch partners.' });
    }
});

// Verify a partner
router.put('/partners/:id/verify', auth, superAdminOnly, async (req, res) => {
    // delegate to centralized status updater
    req.body = req.body || {};
    req.body.status = 'Verified';
    return updateCompanyStatus(req, res);
});

// Reject a partner with reason
router.put('/partners/:id/reject', auth, superAdminOnly, async (req, res) => {
    req.body = req.body || {};
    req.body.status = 'Rejected';
    return updateCompanyStatus(req, res);
});

module.exports = router;
