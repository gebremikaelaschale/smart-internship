const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const superAdminOnly = require('../middleware/superAdminMiddleware');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { updateCompanyStatus } = require('../controllers/companyStatusController');

async function createAndEmitNotification(req, payload) {
    const notification = await Notification.create(payload);
    try {
        const io = req.app.get('io');
        if (io && payload?.userId) {
            io.to(`user:${String(payload.userId)}`).emit('notification:new', notification.toObject());
        }
    } catch (error) {
        // notifications must still be written even if the socket layer is unavailable
    }
    return notification;
}

router.patch('/:id/reset', auth, superAdminOnly, async (req, res) => {
    req.body = req.body || {};
    req.body.status = 'Pending';
    return updateCompanyStatus(req, res);
});

module.exports = router;