const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Application = require('../models/Application');
const Report = require('../models/Report');
const Profile = require('../models/Profile');
const Internship = require('../models/Internship');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
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
        // Activity logging must not block business actions.
    }
}

// 1. ተማሪው ማመልከቻ እንዲልክ (Apply)
router.post('/apply', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can apply for internships.' });
        }

        const { internshipId, matchScore, resumeUrl, coverLetter } = req.body;
        if (!internshipId) {
            return res.status(400).json({ message: 'internshipId is required.' });
        }

        const existing = await Application.findOne({ studentId: req.user.id, internshipId });
        if (existing) {
            return res.status(409).json({ message: 'You already applied to this internship.' });
        }

        let finalResumeUrl = String(resumeUrl || '').trim();
        if (!finalResumeUrl) {
            const profile = await Profile.findOne({ userId: req.user.id }).lean();
            finalResumeUrl = String(profile?.resumeUrl || '').trim();
        }

        if (!finalResumeUrl) {
            return res.status(400).json({ message: 'Please add your resume URL in profile before applying.' });
        }

        const newApp = new Application({
            studentId: req.user.id,
            internshipId,
            resumeUrl: finalResumeUrl,
            coverLetter: String(coverLetter || '').trim(),
            matchingScore: Number(matchScore || 0)
        });
        await newApp.save();

        await writeActivity(
            req,
            'STUDENT_APPLIED_INTERNSHIP',
            `Student=${req.user?.id || ''} Internship=${internshipId} Application=${newApp?._id || ''}`
        );

        try {
            const [internship, student] = await Promise.all([
                Internship.findById(internshipId).select('title companyId').lean(),
                User.findById(req.user.id).select('fullName name email').lean()
            ]);

            const internshipTitle = internship?.title || 'this internship';
            await Notification.create({
                userId: req.user.id,
                title: 'Application Submitted',
                message: `Your application for ${internshipTitle} was submitted successfully.`,
                type: 'success',
                targetRoute: '/student/applications'
            });

            if (internship?.companyId) {
                const applicantName = student?.fullName || student?.name || student?.email || 'A student';
                await Notification.findOneAndUpdate(
                    { userId: internship.companyId, sourceKey: `new-applicant:${newApp._id}` },
                    {
                        $setOnInsert: {
                            userId: internship.companyId,
                            title: 'New applicant',
                            message: `${applicantName} applied for ${internshipTitle}.`,
                            type: 'info',
                            targetRoute: '/employer/applicants',
                            category: 'new-applicant',
                            sourceKey: `new-applicant:${newApp._id}`,
                            isRead: false,
                            createdAt: new Date()
                        }
                    },
                    { upsert: true, returnDocument: 'before' }
                );
            }
        } catch {
            // Keep the main application flow successful even if notification write fails.
        }

        res.status(201).json({ message: 'Application submitted successfully.', application: newApp });
    } catch (err) { res.status(500).send("Application error."); }
});

// 1.1 ተማሪው የላካቸውን ማመልከቻዎች ለማየት (My Applications)
router.get('/my', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can access their applications.' });
        }

        const apps = await Application.find({ studentId: req.user.id })
            .populate('internshipId', 'title location type status companyId')
            .sort({ createdAt: -1 });
        res.json(apps);
    } catch (err) { res.status(500).send("Fetching error."); }
});

// 2. ለአድሚን/ኮርዲኔተር ሁሉንም ማመልከቻዎች ለማሳየት
router.get('/admin/all', auth, async (req, res) => {
    try {
        const apps = await Application.find()
            .populate('studentId', 'fullName email')
            .populate('internshipId', 'title');
        res.json(apps);
    } catch (err) { res.status(500).send("Database sync error."); }
});

// 2.1 ለአንድ ድርጅት የተላኩ ማመልከቻዎችን ለማሳየት (Industry Partner Matrix)
router.get('/employer/all', auth, async (req, res) => {
    if (String(req.user?.role || '').toLowerCase() !== 'employer') return res.status(403).send("No Permission.");
    try {
        // መጀመሪያ የድርጅቱን ኢንተርንሺፖች ማግኘት
        const myPrograms = await Internship.find({ companyId: req.user.id });
        const programIds = myPrograms.map(p => p._id);

        const apps = await Application.find({ internshipId: { $in: programIds } })
            .populate('studentId', 'fullName email profilePicUrl department')
            .populate('internshipId', 'title location');

        const studentIds = [...new Set(
            apps
                .map((app) => String(app?.studentId?._id || ''))
                .filter(Boolean)
        )];

        const profiles = await Profile.find({ userId: { $in: studentIds } })
            .select('userId personalInfo.department academicInfo.skills resumeUrl')
            .lean();

        const profileByUserId = new Map(
            profiles.map((profile) => [String(profile.userId), profile])
        );

        const enrichedApps = apps.map((app) => {
            const appObject = app.toObject();
            const studentId = String(appObject?.studentId?._id || '');
            const profile = profileByUserId.get(studentId);
            return {
                ...appObject,
                studentProfile: {
                    department: String(profile?.personalInfo?.department || appObject?.studentId?.department || '').trim(),
                    skills: Array.isArray(profile?.academicInfo?.skills) ? profile.academicInfo.skills : [],
                    resumeUrl: String(profile?.resumeUrl || appObject?.resumeUrl || '').trim()
                }
            };
        });

        res.json(enrichedApps);
    } catch (err) { res.status(500).send("Matrix retrieval failed."); }
});

// 2.2 Active interns for employer with progress
router.get('/employer/active', auth, async (req, res) => {
    if (String(req.user?.role || '').toLowerCase() !== 'employer') return res.status(403).send("No Permission.");
    try {
        const myPrograms = await Internship.find({ companyId: req.user.id }).select('_id title status').lean();
        const programIds = myPrograms.map((program) => program._id);
        const internshipById = new Map(myPrograms.map((program) => [String(program._id), program]));

        const acceptedApps = await Application.find({
            internshipId: { $in: programIds },
            status: 'Accepted'
        })
            .populate('studentId', 'fullName email department')
            .populate('internshipId', 'title status')
            .lean();

        const appIds = acceptedApps.map((app) => app._id);
        const tasks = await Task.find({ application: { $in: appIds } }).select('application status').lean();
        const tasksByAppId = new Map();

        for (const task of tasks) {
            const key = String(task.application);
            const existing = tasksByAppId.get(key) || { total: 0, completed: 0 };
            existing.total += 1;
            if (String(task.status || '').toLowerCase() === 'completed') {
                existing.completed += 1;
            }
            tasksByAppId.set(key, existing);
        }

        const studentIds = [...new Set(
            acceptedApps.map((app) => String(app?.studentId?._id || '')).filter(Boolean)
        )];
        const profiles = await Profile.find({ userId: { $in: studentIds } })
            .select('userId personalInfo.department academicInfo.skills')
            .lean();
        const profileByUserId = new Map(
            profiles.map((profile) => [String(profile.userId), profile])
        );

        const results = acceptedApps.map((app) => {
            const appId = String(app._id || '');
            const taskStats = tasksByAppId.get(appId) || { total: 0, completed: 0 };
            const progress = taskStats.total > 0 ? Math.round((taskStats.completed / taskStats.total) * 100) : 0;
            const studentId = String(app?.studentId?._id || '');
            const profile = profileByUserId.get(studentId);
            const internship = app?.internshipId || internshipById.get(String(app?.internshipId || '')) || {};

            return {
                applicationId: app._id,
                student: {
                    id: app?.studentId?._id,
                    name: app?.studentId?.fullName || 'Unnamed Student',
                    department: String(profile?.personalInfo?.department || app?.studentId?.department || '').trim(),
                    skills: Array.isArray(profile?.academicInfo?.skills) ? profile.academicInfo.skills : []
                },
                internship: {
                    id: internship?._id,
                    title: internship?.title || 'Unknown Internship'
                },
                progress,
                status: String(internship?.status || '').toLowerCase() === 'closed' ? 'Closed' : 'Active',
                tasks: taskStats
            };
        });

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: 'Failed to load active interns.' });
    }
});

// 3. ሪፖርቶችን ማምጣት (Reporting Matrix)
router.get('/reports/:appId', auth, async (req, res) => {
    try {
        const reports = await Report.find({ application: req.params.appId });
        res.json(reports);
    } catch (err) { res.status(500).send("Error fetching reports."); }
});

// 4. ማመልከቻ ማጽደቅ ወይም መገምገም (Evaluation & Decision)
router.put('/status/:id', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (!['admin', 'employer'].includes(role)) {
            return res.status(403).json({ message: 'Only admin or employer can update application status.' });
        }

        const { status, remarks } = req.body;
        const normalizedRemarks = String(remarks || '').trim();

        const currentApp = await Application.findById(req.params.id)
            .select('studentId internshipId status')
            .populate('internshipId', 'title companyId')
            .lean();

        if (!currentApp) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        if (role === 'employer') {
            const ownerId = String(currentApp?.internshipId?.companyId || '');
            if (!ownerId || ownerId !== String(req.user?.id || '')) {
                return res.status(403).json({ message: 'You can only update applicants for your own internships.' });
            }

            const employerAllowed = new Set(['Under Review', 'Interview', 'Accepted', 'Rejected']);
            if (!employerAllowed.has(String(status || '').trim())) {
                return res.status(400).json({ message: 'Invalid status transition for employer.' });
            }
        }

        const updatedApp = await Application.findByIdAndUpdate(
            req.params.id, 
            {
                $set: { status, remarks: normalizedRemarks, updatedAt: Date.now() },
                $push: {
                    timeline: {
                        status,
                        date: new Date(),
                        comment: normalizedRemarks
                    }
                }
            }, 
            { returnDocument: 'after' }
        );

        if (!updatedApp) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        if (role === 'employer' && String(status || '').trim() === 'Accepted') {
            await writeActivity(
                req,
                'COMPANY_SELECTED_STUDENT',
                `Employer=${req.user?.id || ''} Application=${updatedApp?._id || ''} Internship=${currentApp?.internshipId?._id || ''}`
            );
        } else {
            await writeActivity(
                req,
                'APPLICATION_STATUS_UPDATED',
                `Actor=${req.user?.id || ''} Application=${updatedApp?._id || ''} Status=${String(status || '').trim()}`
            );
        }

        if (updatedApp?.studentId) {
            try {
                await Notification.create({
                    userId: updatedApp.studentId,
                    title: 'Application Status Updated',
                    message: `Your application status is now ${status || updatedApp.status}.`,
                    type: 'info',
                    targetRoute: '/student/applications'
                });
            } catch {
                // Status updates should not fail if notification write fails.
            }
        }

        res.json(updatedApp);
    } catch (err) { res.status(500).send("Status update failed."); }
});

module.exports = router;