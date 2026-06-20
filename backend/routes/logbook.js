const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Report = require('../models/Report');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const User = require('../models/User');
const Profile = require('../models/Profile');
const CompanyProfile = require('../models/CompanyProfile');
const Notification = require('../models/Notification');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/logbooks');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'logbook-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only images, PDFs, and DOCX files are allowed.'));
    }
});

// ─── Student: Submit a weekly logbook ───────────────────────────────────────
router.post('/', auth, upload.single('file'), async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'student') {
            return res.status(403).json({ message: 'Only students can submit logbooks.' });
        }

        let {
            internshipId, weekNumber, summary, title, fileUrl, hoursWorked,
            startDate, endDate, attachments, dailyBreakdown, skills,
            mentorshipRequested, goals, status
        } = req.body;

        // If a file was uploaded, construct the URL
        if (req.file) {
            fileUrl = `/uploads/logbooks/${req.file.filename}`;
        }

        if (!internshipId || String(internshipId) === 'undefined') {
            return res.status(400).json({ message: 'Internship ID is missing. You might not have an active internship.' });
        }
        if (!weekNumber) {
            return res.status(400).json({ message: 'Week Number is required.' });
        }
        if (!summary && status !== 'Draft') {
            return res.status(400).json({ message: 'Description (Summary) is required. Please write what you did.' });
        }

        if (!mongoose.Types.ObjectId.isValid(internshipId)) {
            return res.status(400).json({ message: 'Invalid Internship ID format.' });
        }

        // Verify student has an accepted application for this internship
        const application = await Application.findOne({
            studentId: req.user.id,
            internshipId,
            status: 'Accepted'
        }).lean();

        if (!application) {
            return res.status(403).json({ message: 'You do not have an accepted internship for this program.' });
        }

        // Check for duplicate submission for same week
        const existing = await Report.findOne({
            studentId: req.user.id,
            internshipId,
            weekNumber: Number(weekNumber),
            type: 'Weekly'
        });

        // If it exists and it's NOT a draft, it's a real duplicate submission
        if (existing && existing.status !== 'Draft') {
            return res.status(400).json({ message: `Week ${weekNumber} logbook already submitted.` });
        }

        // Simulate AI Insights based on content
        const skillsList = Array.isArray(skills) ? skills.join(', ') : '';
        const aiInsights = `AI ANALYSIS: The student demonstrated strong proficiency in ${skillsList || 'assigned tasks'}. ` +
            `Workflow consistency is high with ${hoursWorked || 0} hours logged. ` +
            `Summary suggests proactive resolution of technical hurdles.`;

        // --- Parse Skills for FormData ---
        let parsedSkills = [];
        if (req.body['skills[]']) {
            parsedSkills = Array.isArray(req.body['skills[]']) ? req.body['skills[]'] : [req.body['skills[]']];
        } else if (req.body.skills) {
            parsedSkills = Array.isArray(req.body.skills) ? req.body.skills : [req.body.skills];
        }

        // --- Parse Goals for FormData ---
        let parsedGoals = [];
        if (req.body['goals[0][text]']) {
            parsedGoals.push({ text: req.body['goals[0][text]'], completed: true });
        } else if (typeof goals === 'string') {
            try { parsedGoals = JSON.parse(goals); } catch (e) { }
        } else if (Array.isArray(goals)) {
            parsedGoals = goals;
        }

        const reportData = {
            studentId: req.user.id,
            internshipId,
            weekNumber: Number(weekNumber),
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            hoursWorked: hoursWorked ? Number(hoursWorked) : undefined,
            dailyBreakdown: Array.isArray(dailyBreakdown) ? dailyBreakdown : [],
            skills: parsedSkills,
            mentorshipRequested: Boolean(mentorshipRequested),
            goals: parsedGoals,
            aiInsights,
            auditTrail: {
                ipAddress: req.ip || '127.0.0.1',
                location: 'Corporate HQ',
                verified: true
            },
            type: 'Weekly',
            title: String(title || '').trim(),
            summary: String(summary).trim(),
            fileUrl: fileUrl ? String(fileUrl).trim() : undefined,
            attachments: Array.isArray(attachments) ? attachments : [],
            status: status === 'Draft' ? 'Draft' : 'Submitted'
        };

        let report;
        if (existing && existing.status === 'Draft') {
            // Update existing draft
            report = await Report.findByIdAndUpdate(existing._id, reportData, { new: true });
        } else {
            // Create new report
            report = new Report(reportData);
            await report.save();
        }

        // Only send notifications if it's a full submission (not a draft)
        if (report.status === 'Submitted') {
            // --- Badge & Achievement System ---
            const user = await User.findById(req.user.id);
            const reportCount = await Report.countDocuments({ studentId: req.user.id, status: 'Submitted' });

            let newBadge = null;
            if (reportCount === 1) newBadge = { title: 'First Milestone', icon: '🚀' };
            else if (reportCount === 3) newBadge = { title: 'Consistent Reporter', icon: '🔥' };
            else if (reportCount === 10) newBadge = { title: 'Internship Veteran', icon: '💼' };

            if (newBadge && !user.badges.some(b => b.title === newBadge.title)) {
                user.badges.push(newBadge);
            }

            // Note: Skill analytics updates removed as requested

            await user.save();

            // Notify employer/supervisor
            const internship = await Internship.findById(internshipId).select('companyId title').lean();
            if (internship?.companyId) {
                const student = await User.findById(req.user.id).select('fullName name').lean();
                const studentName = student?.fullName || student?.name || 'A student';
                await Notification.create({
                    userId: internship.companyId,
                    title: 'New Logbook Submitted',
                    message: `${studentName} submitted their Week ${weekNumber} logbook for "${internship.title}".`,
                    type: 'info',
                    targetRoute: '/employer-dashboard/reports',
                    sourceKey: `logbook-submission:${report._id}`
                });
            }
        }

        res.status(201).json({ message: report.status === 'Draft' ? 'Draft saved successfully.' : 'Logbook submitted successfully.', report });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message || 'Failed to submit logbook.' });
    }
});

// ─── Student: Update a logbook (if not approved) ───────────────────────────
router.patch('/:id', auth, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Logbook not found.' });

        if (String(report.studentId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        // 🔐 6. VERIFIED REPORT SYSTEM: cannot be edited after approval
        if (report.status === 'Approved by Company' || report.status === 'Approved by University') {
            return res.status(400).json({ message: 'Verified reports cannot be modified.' });
        }

        const { summary, goals, hoursWorked, dailyBreakdown, skills, attachments } = req.body;

        if (summary) report.summary = summary;
        if (goals) report.goals = goals;
        if (hoursWorked) report.hoursWorked = hoursWorked;
        if (dailyBreakdown) report.dailyBreakdown = dailyBreakdown;
        if (skills) report.skills = skills;
        if (attachments) report.attachments = attachments;

        report.status = 'Submitted'; // Reset status to submitted for re-review
        await report.save();

        res.json({ message: 'Logbook updated.', report });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update logbook.' });
    }
});

// ─── Student: Delete a draft logbook ─────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
    try {
        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Logbook not found.' });

        if (String(report.studentId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        // Only allow deleting drafts or unreviewed submissions to preserve academic record integrity
        if (report.status !== 'Draft' && report.status !== 'Submitted') {
            return res.status(400).json({ message: 'Only Drafts or unreviewed reports can be deleted.' });
        }

        await Report.findByIdAndDelete(req.params.id);
        res.json({ message: 'Draft deleted successfully.' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to delete draft.' });
    }
});

// ─── Student: Get my logbooks ────────────────────────────────────────────────
router.get('/mine', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'student') {
            return res.status(403).json({ message: 'Only students can view their logbooks.' });
        }

        // Fetch Advisor
        const student = await User.findById(req.user.id).select('departmentId').lean();
        let advisor = null;
        if (student?.departmentId) {
            advisor = await User.findOne({
                departmentId: student.departmentId,
                role: { $in: ['hod', 'DeptAdmin', 'CollegeAdmin', 'admin'] }
            }).select('name fullName email phone profileImage role').lean();
        }

        const reports = await Report.find({ studentId: req.user.id, type: 'Weekly' })
            .populate({
                path: 'internshipId',
                select: 'title companyId',
                populate: {
                    path: 'companyId',
                    select: 'name fullName email phone profileImage'
                }
            })
            .sort({ weekNumber: 1 })
            .lean();

        // 🏢 Fetch Company Profiles for correct Supervisor details
        const companyIds = [...new Set(reports.map(r => r.internshipId?.companyId?._id).filter(Boolean))];
        const companyProfiles = await CompanyProfile.find({ user: { $in: companyIds } }).lean();
        const profileMap = companyProfiles.reduce((acc, p) => {
            acc[p.user.toString()] = p;
            return acc;
        }, {});

        const enrichedReports = reports.map(r => {
            const compId = r.internshipId?.companyId?._id?.toString();
            const profile = compId ? profileMap[compId] : null;
            
            let mentorDetails = null;
            if (r.internshipId?.companyId) {
                // Strictly prioritize Focal Person (Supervisor) as requested
                const hasFocal = profile?.focalPerson?.name;
                const rep = hasFocal ? profile.focalPerson : (profile?.representative || {});
                
                mentorDetails = {
                    name: rep.name || profile?.companyName || r.internshipId.companyId.fullName || r.internshipId.companyId.name,
                    email: rep.email || profile?.officialEmail || r.internshipId.companyId.email,
                    phone: rep.phone || profile?.phone || r.internshipId.companyId.phone,
                    position: hasFocal ? 'Internship Supervisor' : (rep.position || 'Company Representative'),
                    profileImage: profile?.logo || r.internshipId.companyId.profileImage
                };
            }

            return {
                ...r,
                advisor: advisor || null,
                mentorDetails: mentorDetails
            };
        });

        res.json(enrichedReports);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load logbooks.' });
    }
});

// ─── Student: Get accepted internship for logbook submission ────────────────
router.get('/my-internship', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (role !== 'student') {
            return res.status(403).json({ message: 'Only students can access this.' });
        }

        const application = await Application.findOne({
            studentId: req.user.id,
            status: 'Accepted'
        }).populate({
            path: 'internshipId',
            select: 'title companyId startDate endDate',
            populate: {
                path: 'companyId',
                select: 'name fullName profileImage'
            }
        }).lean();

        if (!application || !application.internshipId) {
            return res.json(null);
        }

        // 🏫 Fetch University Advisor (HOD or DeptAdmin for student's department)
        const student = await User.findById(req.user.id).select('departmentId').lean();
        let advisor = null;
        if (student?.departmentId) {
            advisor = await User.findOne({
                departmentId: student.departmentId,
                role: { $in: ['hod', 'DeptAdmin', 'CollegeAdmin'] }
            }).select('name fullName profileImage role').lean();
        }

        // Fallback advisor if none found
        if (!advisor) {
            advisor = {
                fullName: 'Dr. Academic Advisor',
                role: 'University Advisor',
                profileImage: ''
            };
        }

        res.json({
            applicationId: application._id,
            internshipId: application.internshipId?._id,
            internshipTitle: application.internshipId?.title || 'Internship',
            companyName: application.internshipId?.companyId?.fullName || application.internshipId?.companyId?.name || 'Industry Partner',

            // 👨‍🏫 Mentor (Industry)
            mentor: {
                name: application.internshipId?.companyId?.fullName || application.internshipId?.companyId?.name || 'Company Mentor',
                image: application.internshipId?.companyId?.profileImage || '',
                role: 'Industry Mentor'
            },

            // 🎓 Advisor (University)
            advisor: {
                name: advisor.fullName || advisor.name || 'University Advisor',
                image: advisor.profileImage || '',
                role: advisor.role || 'Academic Advisor'
            },

            startDate: application.internshipId?.startDate,
            endDate: application.internshipId?.endDate
        });
    } catch (err) {
        console.error('My-Internship Load Error:', err);
        res.status(500).json({ message: 'Failed to load internship info.' });
    }
});

// ─── Employer: Get logbooks submitted for their internships ──────────────────
router.get('/employer', auth, async (req, res) => {
    try {
        const rawRole = String(req.user?.role || '');
        const role = rawRole.toLowerCase();
        const isEmployer = role === 'employer' || role === 'industry partner' || rawRole === 'Industry Partner';

        if (!isEmployer) {
            return res.status(403).json({ message: 'Only employers can view submitted logbooks.' });
        }

        // 1. Find all internships belonging to this employer
        const employerInternships = await Internship.find({
            $or: [{ companyId: req.user.id }, { companyEmail: req.user.email }]
        }).select('_id').lean();
        const internshipIds = employerInternships.map(i => String(i._id));

        if (internshipIds.length === 0) return res.json([]);

        // 2. Find all 'Weekly' reports that match these internships
        // We use a broad search first to ensure we don't miss anything
        const reports = await Report.find({
            type: 'Weekly',
            internshipId: { $in: internshipIds },
            status: { $ne: 'Draft' }
        })
            .populate('studentId', 'fullName name email department profileImage')
            .populate('internshipId', 'title')
            .sort({ createdAt: -1 })
            .lean();

        // 3. Robust Photo Sync with Profile Model
        const studentIds = [...new Set(reports.map(r => r.studentId?._id).filter(Boolean))];
        const profiles = await Profile.find({ userId: { $in: studentIds } }).select('profilePicUrl userId').lean();
        const profileMap = profiles.reduce((acc, p) => {
            acc[String(p.userId)] = p.profilePicUrl;
            return acc;
        }, {});

        const enrichedReports = reports.map(report => {
            if (report.studentId) {
                report.studentId.profileImage = report.studentId.profileImage || profileMap[String(report.studentId._id)] || '';
            }
            return report;
        });

        res.json(enrichedReports);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load logbooks.' });
    }
});

// ─── Employer: Company Supervisor Review ─────────────────────────────────────
router.patch('/:id/company-review', auth, async (req, res) => {
    try {
        const rawRole = String(req.user?.role || '');
        const role = rawRole.toLowerCase();
        const isEmployer = role === 'employer' || role === 'industry partner' || rawRole === 'Industry Partner';
        if (!isEmployer) {
            return res.status(403).json({ message: 'Only employers can perform company reviews.' });
        }

        const { status, feedback, performanceScores, reviewedBy } = req.body; // status: 'Approved', 'Needs Revision', 'Declined'
        const validStatuses = ['Approved', 'Needs Revision', 'Declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        const report = await Report.findById(req.params.id).populate('internshipId', 'companyId title');
        if (!report) return res.status(404).json({ message: 'Logbook not found.' });

        if (String(report.internshipId?.companyId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Not authorized for this internship.' });
        }

        report.companyStatus = status;
        report.companyFeedback = feedback;

        // 📊 7. PERFORMANCE SCORE SYSTEM
        if (performanceScores && typeof performanceScores === 'object') {
            report.performanceScores = {
                technical: Math.min(10, Math.max(0, Number(performanceScores.technical || 0))),
                communication: Math.min(10, Math.max(0, Number(performanceScores.communication || 0))),
                teamwork: Math.min(10, Math.max(0, Number(performanceScores.teamwork || 0)))
            };
        }

        if (status === 'Approved') {
            report.status = 'Approved by Company';
        } else if (status === 'Needs Revision') {
            report.status = 'Needs Revision';
        } else {
            report.status = 'Declined';
        }

        await report.save();

        await Notification.create({
            userId: report.studentId,
            title: 'Logbook Review: Company',
            message: `Your Week ${report.weekNumber} logbook was ${status.toLowerCase()} by your company supervisor.`,
            type: status === 'Approved' ? 'success' : 'warning',
            targetRoute: '/student-dashboard/logbook',
            sourceKey: `logbook-review-company:${report._id}:${new Date().getTime()}`
        });

        res.json({ message: `Company review complete: ${status}`, report });
    } catch (err) {
        console.error('Company Review Error:', err);
        res.status(500).json({ message: err.message || 'Failed to process company review.' });
    }
});

// ─── University: Advisor / Department Review ──────────────────────────────────
router.patch('/:id/university-review', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        // Allow any academic admin role to perform university review
        const universityRoles = ['dean', 'hod', 'deptadmin', 'collegeadmin', 'admin'];
        if (!universityRoles.includes(role)) {
            return res.status(403).json({ message: 'Only university advisors/admins can perform final reviews.' });
        }

        const { status, feedback } = req.body;
        const validStatuses = ['Approved', 'Needs Revision', 'Declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        const report = await Report.findById(req.params.id);
        if (!report) return res.status(404).json({ message: 'Logbook not found.' });

        if (report.companyStatus !== 'Approved') {
            return res.status(400).json({ message: 'Logbook must be approved by the company before university approval.' });
        }

        report.universityStatus = status;
        report.universityFeedback = feedback;

        if (status === 'Approved') {
            report.status = 'Approved by University';
        } else if (status === 'Needs Revision') {
            report.status = 'Needs Revision';
        } else {
            report.status = 'Declined';
        }

        await report.save();

        await Notification.create({
            userId: report.studentId,
            title: 'Logbook Review: Final',
            message: `Your Week ${report.weekNumber} logbook has reached final ${status.toLowerCase()} status by the University.`,
            type: status === 'Approved' ? 'success' : 'warning',
            targetRoute: '/student-dashboard/logbook'
        });

        res.json({ message: `University review complete: ${status}`, report });
    } catch (err) {
        res.status(500).json({ message: 'Failed to process university review.' });
    }
});

// ─── University: Get all logbooks for their department/college ────────────────
router.get('/university-all', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        const universityRoles = ['dean', 'hod', 'deptadmin', 'collegeadmin', 'admin'];
        if (!universityRoles.includes(role)) {
            return res.status(403).json({ message: 'Not authorized.' });
        }

        // In a real system, we would filter by departmentId or collegeId of the user
        const reports = await Report.find({ type: 'Weekly', status: { $ne: 'Draft' } })
            .populate('studentId', 'fullName name email')
            .populate('internshipId', 'title')
            .sort({ createdAt: -1 })
            .lean();

        res.json(reports);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load logbooks.' });
    }
});

module.exports = router;
