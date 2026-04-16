const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Internship = require('../models/Internship');
const Notification = require('../models/Notification');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');

async function writeActivity(req, action, details) {
    try {
        await ActivityLog.create({
            userId: req.user?.id || null,
            action,
            details,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent']
        });
    } catch {
        // Activity log should never block core request.
    }
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 1. መፍጠር (Industry Partner Only)
router.post('/', auth, async (req, res) => {
    if (String(req.user.role || '').toLowerCase() !== 'employer') return res.status(403).json({ msg: "Access Denied: Employers only." });
    try {
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const duration = String(req.body.duration || '').trim();
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
        const studentsNeeded = Number(req.body.studentsNeeded);

        if (!title || !description || !duration || !startDate || !endDate || !Number.isInteger(studentsNeeded) || studentsNeeded < 1) {
            return res.status(400).json({ message: 'Please provide title, description, duration, startDate, endDate and a valid studentsNeeded value.' });
        }

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
            return res.status(400).json({ message: 'Invalid date range: endDate must be the same as or after startDate.' });
        }

        const skills = Array.isArray(req.body.requiredSkills)
            ? req.body.requiredSkills.map((skill) => String(skill).trim()).filter(Boolean)
            : String(req.body.requiredSkills || '').split(',').map((skill) => skill.trim()).filter(Boolean);

        const newInternship = new Internship({
            ...req.body,
            title,
            description,
            duration,
            startDate,
            endDate,
            deadline: req.body.deadline || endDate,
            studentsNeeded,
            requiredSkills: skills,
            programType: 'Internship Program',
            trainingFocus: true,
            companyId: req.user.id,
            status: 'Pending'
        });
        await newInternship.save();

        await writeActivity(
            req,
            'COMPANY_POSTED_INTERNSHIP',
            `Employer=${req.user?.id || ''} Internship=${newInternship?._id || ''} Title=${title}`
        );

        try {
            const students = await User.find({ role: { $in: ['student', 'Student'] } }).select('_id').lean();
            if (students.length) {
                await Notification.insertMany(
                    students.map((student) => ({
                        userId: student._id,
                        title: `New Internship Opening: ${newInternship.title}`,
                        message: 'A new internship was posted. Tap to view details and apply.',
                        type: 'info',
                        targetRoute: '/student/internships'
                    }))
                );
            }
        } catch {
            // Internship creation should not fail if fan-out notifications fail.
        }

        res.status(201).json(newInternship);
    } catch (err) { res.status(500).send("Failed to create internship program."); }
});

// 2. ለተማሪዎች (ክፍት የሆኑትን ብቻ)
router.get('/', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || 'Open').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);

        const filter = {};
        if (status && status.toLowerCase() !== 'all') {
            filter.status = status;
        }

        if (q) {
            const pattern = new RegExp(escapeRegex(q), 'i');
            filter.$or = [
                { title: pattern },
                { description: pattern },
                { location: pattern },
                { duration: pattern },
                { requirements: pattern },
                { requiredSkills: pattern }
            ];
        }

        const internships = await Internship.find(filter).sort({ createdAt: -1 }).limit(limit);
        return res.json(internships);
    } catch (err) { res.status(500).send("Error fetching internships."); }
});

// 2.1 Search suggestions for internship titles
router.get('/suggestions', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim();
        if (!q) {
            return res.json([]);
        }

        const pattern = new RegExp(escapeRegex(q), 'i');
        const suggestions = await Internship.find({ status: 'Open', title: pattern })
            .select('title location')
            .sort({ createdAt: -1 })
            .limit(8)
            .lean();

        return res.json(suggestions.map((item) => ({
            id: item._id,
            title: item.title,
            subtitle: item.location || ''
        })));
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load suggestions.' });
    }
});

// 3. ለእያንዳንዱ ድርጅት የራሱን ብቻ (Employer Dashboard)
router.get('/my-internships', auth, async (req, res) => {
    if (String(req.user.role || '').toLowerCase() !== 'employer') return res.status(403).json({ msg: "Access Denied." });
    try {
        const myInternships = await Internship.find({ companyId: req.user.id }).sort({ createdAt: -1 });
        res.json(myInternships);
    } catch (err) { res.status(500).send("Error fetching your internships."); }
});

// 4. Update Status (Publish/Archive)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const internship = await Internship.findByIdAndUpdate(req.params.id, { status: req.body.status }, { returnDocument: 'after' });
        res.json(internship);
    } catch (err) { res.status(500).send("Update failed."); }
});

// 5. Delete
router.delete('/:id', auth, async (req, res) => {
    try {
        await Internship.findByIdAndDelete(req.params.id);
        res.json({ msg: "Removed successfully." });
    } catch (err) { res.status(500).send("Deletion failed."); }
});

module.exports = router;