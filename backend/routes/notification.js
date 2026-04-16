const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const Notification = require('../models/Notification');
const Application = require('../models/Application');
const Internship = require('../models/Internship');

async function upsertNotification(payload) {
    const safeSourceKey = String(payload.sourceKey || '').trim();
    if (!safeSourceKey) return;

    await Notification.findOneAndUpdate(
        { userId: payload.userId, sourceKey: safeSourceKey },
        {
            $setOnInsert: {
                userId: payload.userId,
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
        .populate('internshipId', 'title startDate deadline status')
        .lean();

    for (const app of acceptedApps) {
        const internship = app?.internshipId;
        if (!internship) continue;

        const title = internship?.title || 'Your internship';
        const startDate = internship?.startDate ? new Date(internship.startDate) : null;
        if (startDate && !Number.isNaN(startDate.getTime()) && startDate <= now) {
            await upsertNotification({
                userId,
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

    if (role === 'employer') {
        await syncEmployerNotifications(userId);
    }
    if (role === 'student') {
        await syncStudentNotifications(userId);
    }

    await syncBaselineNotifications(userId, role);
}

// Create notification (admin/employer)
router.post('/', auth, roleMiddleware(['admin', 'employer']), async (req, res) => {
    try {
        const { userId, title, message, type, targetRoute } = req.body || {};

        if (!userId || !title || !message) {
            return res.status(400).json({ message: 'userId, title and message are required.' });
        }

        const safeTargetRoute = String(targetRoute || '').trim();
        if (safeTargetRoute && !safeTargetRoute.startsWith('/student/')) {
            return res.status(400).json({ message: 'targetRoute must start with /student/.' });
        }

        const notification = await Notification.create({
            userId,
            title,
            message,
            type,
            targetRoute: safeTargetRoute
        });

        return res.status(201).json(notification);
    } catch (err) {
        return res.status(500).json({ message: 'Create error.' });
    }
});

// Get all notifications for user
router.get('/', auth, async (req, res) => {
    try {
        await syncSystemNotifications(req);

        const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
        const skip = Math.max(Number(req.query.skip) || 0, 0);
        const category = String(req.query.category || '').trim().toLowerCase();
        const unreadOnly = String(req.query.unreadOnly || '').trim().toLowerCase() === 'true';

        const query = { userId: req.user.id };
        if (unreadOnly) {
            query.isRead = false;
        }
        if (['new-applicant', 'internship-started', 'deadline-reminder', 'general'].includes(category)) {
            query.category = category;
        }

        const [items, total, unreadCount] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification.countDocuments(query),
            Notification.countDocuments({ userId: req.user.id, isRead: false })
        ]);

        return res.json({ items, total, unreadCount, limit, skip });
    } catch (err) { res.status(500).send("Database sync error."); }
});

// Mark as read
router.put('/read/:id', auth, async (req, res) => {
    try {
        const updated = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { isRead: true },
            { returnDocument: 'after' }
        );

        if (!updated) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.json({ msg: "Read" });
    } catch (err) { res.status(500).send("Update error."); }
});

// Mark all as read
router.put('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id }, { isRead: true });
        res.json({ msg: "All Read" });
    } catch (err) { res.status(500).send("Update error."); }
});

// Clear all
router.delete('/clear', auth, async (req, res) => {
    try {
        await Notification.deleteMany({ userId: req.user.id });
        res.json({ msg: "Cleared" });
    } catch (err) { res.status(500).send("Clear error."); }
});

// Delete one notification
router.delete('/:id', auth, async (req, res) => {
    try {
        const removed = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

        if (!removed) {
            return res.status(404).json({ message: 'Notification not found.' });
        }

        return res.json({ msg: 'Removed' });
    } catch (err) {
        return res.status(500).send('Delete error.');
    }
});

module.exports = router;
