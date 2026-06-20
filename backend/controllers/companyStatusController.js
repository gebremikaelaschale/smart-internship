const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const { emitHodDashboardRefresh } = require('../utils/hodDashboardSync');

async function createNotification(req, payload) {
    // ensure sender_name for Super Admin notifications
    if (payload && payload.senderRole === 'super_admin') {
        payload.sender_name = payload.sender_name || 'Dr. Solomon Bekele';
    }
    // Ensure category is valid for Notification schema
    payload.category = payload.category || 'general';

    // Ensure a non-null, mostly-unique sourceKey so the unique sparse index won't clash.
    // If a caller provided a meaningful sourceKey (for idempotency), keep it.
    if (!payload.sourceKey) {
        const userPart = payload.userId ? String(payload.userId) : 'unknown';
        payload.sourceKey = `company-verification:${userPart}:${Date.now()}`;
    }

    // Try to create the notification; if we hit a duplicate-key, regenerate a sourceKey and retry once.
    let notification;
    try {
        notification = await Notification.create(payload);
    } catch (err) {
        if (err && err.code === 11000) {
            // fallback: append a random suffix and retry
            payload.sourceKey = `${payload.sourceKey}:${Math.random().toString(36).slice(2,8)}`;
            notification = await Notification.create(payload);
        } else {
            throw err;
        }
    }

    try {
        const io = req.app.get('io');
        if (io && payload?.userId) {
            io.to(`user:${String(payload.userId)}`).emit('notification:new', notification.toObject());
        }
    } catch (err) {
        // ignore socket errors
    }
    return notification;
}

async function updateCompanyStatus(req, res) {
    try {
        const companyId = req.params.id;
        const rawStatus = String((req.body.status || '').trim());
        const reason = String(req.body.reason || '').trim();

        const allowed = ['Verified', 'Rejected', 'Pending'];
        if (!allowed.includes(rawStatus)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        let update = { 'verification.status': rawStatus };
        if (rawStatus === 'Rejected') update['verification.reason'] = reason || '';
        if (rawStatus === 'Verified') update['verification.reason'] = '';

        // Try updating by profile _id first; if not found, try updating by user id (some callers pass user id)
        let profile = await CompanyProfile.findByIdAndUpdate(companyId, update, { returnDocument: 'after' });
        if (!profile) {
            profile = await CompanyProfile.findOneAndUpdate({ user: companyId }, update, { returnDocument: 'after' });
        }
        if (!profile) return res.status(404).json({ message: 'Company profile not found.' });

        // keep user.isVerified in sync
        // profile.user may be an ObjectId or a populated object
        const userId = profile.user?._id || profile.user || null;
        if (userId) {
            await User.findByIdAndUpdate(userId, { isVerified: rawStatus === 'Verified' });
        }

        // Activity log
        const actionMap = {
            Verified: 'SUPERADMIN_VERIFY_COMPANY',
            Rejected: 'SUPERADMIN_REJECT_COMPANY',
            Pending: 'SUPERADMIN_RESET_COMPANY'
        };
        await ActivityLog.create({ userId: req.user?.id || null, action: actionMap[rawStatus] || 'SUPERADMIN_COMPANY_STATUS', details: `Company=${profile.companyName} Status=${rawStatus}` }).catch(() => {});

        // Build notification payloads per-case
        let title = 'Account Update';
        let message = `Company verification status changed to ${rawStatus}.`;
        let type = 'info';
        const metadata = { kind: 'company-verification', verificationStatus: rawStatus };
        let receiverRole = 'employer';

        switch (rawStatus) {
            case 'Verified':
                title = "🎉 Organization Verified Successfully";
                message = "Congratulations! Your organization has been verified by the Super Admin. You are now authorized to post internship opportunities for students.";
                type = 'success';
                metadata.verificationStatus = 'Verified';
                receiverRole = 'employer';
                break;
            case 'Rejected':
                title = "⚠️ Action Required: Verification Rejected";
                message = `Your organization verification was rejected. Reason: ${reason}. Please update the required information and resubmit for approval.`;
                type = 'warning';
                metadata.verificationStatus = 'Rejected';
                metadata.rejectionReason = reason;
                receiverRole = 'employer';
                break;
            case 'Pending':
                title = "🔄 Account Status: Re-evaluation Started";
                message = "Your account status has been reset to pending. The Super Admin is currently re-evaluating your partnership details. Please wait for further updates.";
                type = 'info';
                metadata.verificationStatus = 'Pending';
                receiverRole = 'industry';
                break;
        }

        const notificationPayload = {
            userId: userId,
            receiverRole,
            senderId: req.user?.id || null,
            senderRole: 'super_admin',
            sender_name: 'Dr. Solomon Bekele',
            title,
            message,
            type,
            targetRoute: '/employer/profile',
            category: 'general',
            metadata
        };

        const notification = await createNotification(req, notificationPayload);

        // Emit verification socket events
        try {
            const io = req.app.get('io');
            if (io && userId) {
                if (rawStatus === 'Verified') {
                    io.to(`user:${String(userId)}`).emit('company:verification-updated', { status: 'Verified', isVerified: true });
                } else if (rawStatus === 'Rejected') {
                    io.to(`user:${String(userId)}`).emit('company:verification-rejected', { status: 'Rejected', reason });
                } else if (rawStatus === 'Pending') {
                    io.to(`user:${String(userId)}`).emit('company:verification-reset', { status: 'Pending', isVerified: false });
                }
                io.emit('company:status-changed', { companyId: String(userId), status: rawStatus, reason: reason || undefined });
            }
        } catch (err) {
            // ignore socket layer errors
        }

        emitHodDashboardRefresh(req, {
            reason: 'company-status-updated',
            companyId: String(userId || companyId),
            status: rawStatus
        });

        return res.json({ message: `Company status updated to ${rawStatus}.`, item: profile, notification: notification.toObject() });
    } catch (err) {
        console.error('updateCompanyStatus error:', err);
        return res.status(500).json({ message: 'Failed to update company status.' });
    }
}

module.exports = { updateCompanyStatus, createNotification };
