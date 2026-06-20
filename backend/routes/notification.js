const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const Notification = require('../models/Notification');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');

// ─── Role normalizer ──────────────────────────────────────────────────────────
// Maps any role variant from the JWT to the canonical receiverRole enum value.
function normalizeReceiverRole(role) {
    const r = String(role || '').toLowerCase().trim();
    if (r === 'student') return 'student';
    if (r === 'employer' || r === 'industry partner' || r === 'industry') return 'employer';
    if (r === 'hod' || r === 'deptadmin') return 'hod';
    if (r === 'dean' || r === 'collegeadmin') return 'dean';
    if (r === 'super_admin' || r === 'superadmin') return 'super_admin';
    if (r === 'admin') return 'admin';
    return 'student'; // safe fallback
}

function getAllowedReceiverRoles(role) {
    const normalized = normalizeReceiverRole(role);
    if (normalized === 'employer') return ['employer', 'industry'];
    return [normalized];
}

// ─── Populate + serialize with real sender identity ───────────────────────────
// Single Mongoose populate() JOIN on senderId → User, then one batch query
// for CompanyProfile for employer senders. No N+1 queries.
async function populateAndSerialize(query) {
    const items = await query
        .populate({
            path: 'senderId',
            select: 'fullName name profileImage jobTitle department role',
            model: 'User'
        })
        .lean();

    // Batch-fetch company profiles for all employer senders
    const employerIds = items
        .filter((item) => String(item.senderRole || 'system').toLowerCase() === 'employer' && item.senderId?._id)
        .map((item) => String(item.senderId._id));

    const companyMap = {};
    if (employerIds.length > 0) {
        const companies = await CompanyProfile
            .find({ user: { $in: employerIds } })
            .select('user companyName logo')
            .lean();
        for (const c of companies) companyMap[String(c.user)] = c;
    }

    return items.map((item) => {
        const senderRole = String(item.senderRole || 'system').toLowerCase();
        const senderUser = item.senderId;

        let sender_name = 'System';
        let sender_avatar = '';
        let sender_label = 'Platform Notification';
        let sender_initials = 'SY';

        if (senderUser && senderRole !== 'system') {
            if (senderRole === 'employer') {
                const company = companyMap[String(senderUser._id)];
                sender_name = company?.companyName || senderUser.fullName || senderUser.name || 'Industry Partner';
                sender_avatar = company?.logo || senderUser.profileImage || '';
                sender_label = 'Industry Partner';
            } else if (senderRole === 'hod') {
                sender_name = senderUser.fullName || senderUser.name || 'HOD';
                sender_avatar = senderUser.profileImage || '';
                sender_label = `HOD${senderUser.department ? ` of ${senderUser.department}` : ''}`;
            } else if (senderRole === 'dean') {
                sender_name = senderUser.fullName || senderUser.name || 'Dean';
                sender_avatar = senderUser.profileImage || '';
                sender_label = 'Dean';
            } else if (senderRole === 'super_admin' || senderRole === 'admin') {
                sender_name = senderUser.fullName || senderUser.name || 'Super Admin';
                sender_avatar = senderUser.profileImage || '';
                sender_label = 'System Administrator';
            }

            sender_initials = sender_name
                .split(' ').filter(Boolean).slice(0, 2)
                .map((p) => p[0].toUpperCase()).join('') || 'SY';
        }

        return {
            _id: item._id,
            id: String(item._id),
            userId: item.userId,
            receiverRole: item.receiverRole || '',
            title: item.title,
            message: item.message,
            category: item.category,
            type: item.type,
            targetRoute: item.targetRoute || '',
            sourceKey: item.sourceKey || '',
            metadata: item.metadata || {},
            isRead: Boolean(item.isRead),
            is_read: Boolean(item.isRead),
            createdAt: item.createdAt,
            created_at: item.createdAt,
            senderRole: item.senderRole || 'system',
            sender_role: item.senderRole || 'system',
            sender_name,
            sender_avatar,
            sender_label,
            sender_initials,
        };
    });
}

// ─── Upsert helper ────────────────────────────────────────────────────────────
// Always stores receiverRole so every notification is strictly isolated.
async function upsertNotification(payload) {
    const safeSourceKey = String(payload.sourceKey || '').trim();
    if (!safeSourceKey) return;

    await Notification.findOneAndUpdate(
        { userId: payload.userId, sourceKey: safeSourceKey },
        {
            $setOnInsert: {
                userId: payload.userId,
                receiverRole: payload.receiverRole,
                senderId: payload.senderId || null,
                senderRole: payload.senderRole || 'system',
                title: payload.title,
                message: payload.message,
                type: payload.type || 'info',
                targetRoute: payload.targetRoute || '',
                category: payload.category || 'general',
                sourceKey: safeSourceKey,
                isRead: false,
                createdAt: new Date()
            }
        },
        { upsert: true, returnDocument: 'before' }
    );
}

// ─── Sync helpers ─────────────────────────────────────────────────────────────

async function syncEmployerNotifications(userId) {
    const myPrograms = await Internship.find({ companyId: userId }).select('_id title').lean();
    if (!myPrograms.length) return;

    const titleByInternship = new Map(myPrograms.map((item) => [String(item._id), item.title]));
    const programIds = myPrograms.map((item) => item._id);

    const applications = await Application.find({ internshipId: { $in: programIds } })
        .select('_id internshipId studentId createdAt')
        .populate('studentId', 'fullName name email')
        .sort({ createdAt: -1 })
        .limit(120)
        .lean();

    for (const app of applications) {
        const applicantName = app?.studentId?.fullName || app?.studentId?.name || app?.studentId?.email || 'A student';
        const internshipTitle = titleByInternship.get(String(app.internshipId)) || 'your internship';
        await upsertNotification({
            userId,
            receiverRole: 'employer',   // ← only the employer sees this
            senderId: app?.studentId?._id || null,
            senderRole: 'student',
            title: 'New applicant',
            message: `${applicantName} applied for ${internshipTitle}.`,
            type: 'info',
            targetRoute: '/employer/applicants',
            category: 'new-applicant',
            sourceKey: `new-applicant:${app._id}`
        });
    }
}

async function syncStudentNotifications(userId) {
    const now = new Date();
    const reminderWindowEnd = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000));

    const acceptedApps = await Application.find({ studentId: userId, status: 'Accepted' })
        .select('_id internshipId')
        .populate({
            path: 'internshipId',
            select: 'title startDate deadline status companyId',
            populate: { path: 'companyId', select: '_id' }
        })
        .lean();

    for (const app of acceptedApps) {
        const internship = app?.internshipId;
        if (!internship) continue;

        const title = internship?.title || 'Your internship';
        const startDate = internship?.startDate ? new Date(internship.startDate) : null;
        const employerUserId = internship?.companyId?._id || internship?.companyId || null;

        if (startDate && !Number.isNaN(startDate.getTime()) && startDate <= now) {
            await upsertNotification({
                userId,
                receiverRole: 'student',   // ← only the student sees this
                senderId: employerUserId || null,
                senderRole: employerUserId ? 'employer' : 'system',
                title: 'Internship started',
                message: `${title} has started. Stay active and complete your tasks on time.`,
                type: 'success',
                targetRoute: '/student/applications',
                category: 'internship-started',
                sourceKey: `internship-started:${app._id}`
            });
        }
    }

    const activeApps = await Application.find({
        studentId: userId,
        status: { $in: ['Pending', 'Under Review', 'Interview'] }
    })
        .select('_id internshipId')
        .populate('internshipId', 'title deadline status')
        .lean();

    for (const app of activeApps) {
        const internship = app?.internshipId;
        if (!internship) continue;
        const deadline = internship?.deadline ? new Date(internship.deadline) : null;
        if (!deadline || Number.isNaN(deadline.getTime())) continue;
        if (deadline < now || deadline > reminderWindowEnd) continue;

        await upsertNotification({
            userId,
            receiverRole: 'student',
            title: 'Deadline reminder',
            message: `${internship?.title || 'An internship'} application deadline is approaching soon.`,
            type: 'warning',
            targetRoute: '/student/internships',
            category: 'deadline-reminder',
            sourceKey: `deadline-reminder:${app._id}`
        });
    }
}

async function syncBaselineNotifications(userId, role) {
    if (!userId) return;

    if (role === 'student') {
        await upsertNotification({
            userId,
            receiverRole: 'student',
            title: 'Welcome to Student Dashboard',
            message: 'Notifications are active. You will receive updates about applications and deadlines here.',
            type: 'info',
            targetRoute: '/student/dashboard',
            category: 'general',
            sourceKey: 'baseline:student:welcome'
        });
        return;
    }

    if (role === 'employer') {
        await upsertNotification({
            userId,
            receiverRole: 'employer',
            title: 'Welcome to Employer Dashboard',
            message: 'Notifications are active. New applicants and program alerts will appear here.',
            type: 'info',
            targetRoute: '/employer/dashboard',
            category: 'general',
            sourceKey: 'baseline:employer:welcome'
        });
    }
}

async function syncSystemNotifications(req) {
    const role = String(req.user?.role || '').toLowerCase();
    const userId = req.user?.id;
    if (!userId) return;

    if (role === 'employer') await syncEmployerNotifications(userId);
    if (role === 'student') await syncStudentNotifications(userId);
    await syncBaselineNotifications(userId, role);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /notification — Super Admin or employer creates a targeted notification
router.post('/', auth, roleMiddleware(['admin', 'employer', 'super_admin']), async (req, res) => {
    try {
        const { userId, title, message, type, targetRoute, receiverRole } = req.body || {};

        if (!userId || !title || !message) {
            return res.status(400).json({ message: 'userId, title and message are required.' });
        }
        if (!receiverRole) {
            return res.status(400).json({ message: 'receiverRole is required.' });
        }

        const safeTargetRoute = String(targetRoute || '').trim();
        const notification = await Notification.create({
            userId,
            receiverRole: normalizeReceiverRole(receiverRole),
            senderId: req.user.id,
            senderRole: normalizeReceiverRole(req.user.role) === 'super_admin' ? 'super_admin' : 'admin',
            title,
            message,
            type: type || 'info',
            targetRoute: safeTargetRoute
        });

        // Emit real-time
        const io = req.app.get('io');
        if (io) io.to(`user:${userId}`).emit('notification:new', notification.toObject());

        return res.status(201).json(notification);
    } catch (err) {
        return res.status(500).json({ message: 'Create error.' });
    }
});

// GET /notification — strictly isolated by userId AND receiverRole from JWT
router.get('/', auth, async (req, res) => {
    try {
        await syncSystemNotifications(req);

        const receiverRole = normalizeReceiverRole(req.user.role);
        const receiverRoles = getAllowedReceiverRoles(req.user.role);
        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = Math.max(Number(req.query.skip) || 0, 0);
        const category = String(req.query.category || '').trim().toLowerCase();
        const unreadOnly = String(req.query.unreadOnly || '').trim().toLowerCase() === 'true';

        // STRICT ISOLATION: filter by BOTH userId AND receiverRole
        const query = { userId: req.user.id, receiverRole: { $in: receiverRoles } };
        if (unreadOnly) query.isRead = false;
        if (['new-applicant', 'internship-started', 'deadline-reminder', 'general'].includes(category)) {
            query.category = category;
        }

        const [enrichedItems, total, unreadCount] = await Promise.all([
            populateAndSerialize(
                Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
            ),
            Notification.countDocuments(query),
            // Unread count also filtered by receiverRole — badge is role-specific
            Notification.countDocuments({ userId: req.user.id, receiverRole: { $in: receiverRoles }, isRead: false })
        ]);

        return res.json({ items: enrichedItems, total, unreadCount, limit, skip });
    } catch (err) {
        return res.status(500).json({ message: 'Database sync error.' });
    }
});

// PUT /notification/read/:id — mark one as read (checks userId AND receiverRole)
router.put('/read/:id', auth, async (req, res) => {
    try {
        const receiverRole = normalizeReceiverRole(req.user.role);
        const receiverRoles = getAllowedReceiverRoles(req.user.role);
        const updated = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id, receiverRole: { $in: receiverRoles } },
            { isRead: true },
            { returnDocument: 'after' }
        );
        if (!updated) return res.status(404).json({ message: 'Notification not found.' });
        return res.json({ msg: 'Read' });
    } catch (err) {
        return res.status(500).json({ message: 'Update error.' });
    }
});

// PUT /notification/read-all — mark all as read for this user+role
router.put('/read-all', auth, async (req, res) => {
    try {
        const receiverRoles = getAllowedReceiverRoles(req.user.role);
        await Notification.updateMany({ userId: req.user.id, receiverRole: { $in: receiverRoles } }, { isRead: true });
        return res.json({ msg: 'All Read' });
    } catch (err) {
        return res.status(500).json({ message: 'Update error.' });
    }
});

// DELETE /notification/clear — hard delete all for this user+role
router.delete('/clear', auth, async (req, res) => {
    try {
        const receiverRoles = getAllowedReceiverRoles(req.user.role);
        await Notification.deleteMany({ userId: req.user.id, receiverRole: { $in: receiverRoles } });
        return res.json({ msg: 'Cleared' });
    } catch (err) {
        return res.status(500).json({ message: 'Clear error.' });
    }
});

// DELETE /notification/:id — hard delete one (checks userId AND receiverRole)
router.delete('/:id', auth, async (req, res) => {
    try {
        const receiverRoles = getAllowedReceiverRoles(req.user.role);
        // Triple safety: _id + userId + receiverRole must all match
        const removed = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
            receiverRole: { $in: receiverRoles }
        });
        if (!removed) return res.status(404).json({ message: 'Notification not found.' });
        return res.json({ msg: 'Removed' });
    } catch (err) {
        return res.status(500).json({ message: 'Delete error.' });
    }
});

module.exports = router;
