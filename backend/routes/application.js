const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const mongoose = require('mongoose');
const Application = require('../models/Application');
const Report = require('../models/Report');
const Profile = require('../models/Profile');
const Internship = require('../models/Internship');
const Notification = require('../models/Notification');
const Task = require('../models/Task');
const User = require('../models/User');
const ActivityLog = require('../models/ActivityLog');
const { getCalculatedMatch, isDepartmentCompatible } = require('../utils/internshipMatching');
const { emitHodDashboardRefresh } = require('../utils/hodDashboardSync');

function resolveStoredMatchScore(application = {}) {
    const camel = Number(application?.matchingScore);
    const snake = Number(application?.match_score);
    const camelValue = Number.isFinite(camel) ? camel : 0;
    const snakeValue = Number.isFinite(snake) ? snake : 0;
    return Math.max(camelValue, snakeValue);
}

function emitNotification(req, notification) {
    const io = req.app.get('io');
    if (io && notification?.userId) {
        io.to(`user:${notification.userId}`).emit('notification:new', notification);
    }
}

async function upsertNotificationSafely(payload) {
    try {
        return await Notification.upsertBySourceKey(payload);
    } catch (error) {
        console.error('Notification upsert failed:', error);
        return null;
    }
}

async function getStudentAccessContext(studentId) {
    const [student, profile] = await Promise.all([
        User.findById(studentId).select('role department college isVerified verificationStatus status internshipStatus').lean(),
        Profile.findOne({ userId: studentId }).lean()
    ]);

    const verificationStatus = String(student?.verificationStatus || '').toLowerCase();
    const isVerified = Boolean(student?.isVerified) && verificationStatus === 'verified';
    const studentDepartment = String(profile?.personalInfo?.department || student?.department || '').trim().toLowerCase();
    const studentCollege = String(student?.college || '').trim().toLowerCase();

    return { student, profile, isVerified, studentDepartment, studentCollege };
}

function internshipMatchesStudent(internship, context) {
    return isDepartmentCompatible(
        context.studentDepartment,
        internship?.department || '',
        internship?.targetDepartments || []
    );
}

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

        if (!req.user?.id || !mongoose.Types.ObjectId.isValid(String(req.user.id))) {
            return res.status(401).json({ message: 'Invalid or missing student session.' });
        }

        const { internshipId, matchScore, resumeUrl, coverLetter } = req.body;
        if (!internshipId) {
            return res.status(400).json({ message: 'internshipId is required.' });
        }

        if (!mongoose.Types.ObjectId.isValid(String(internshipId))) {
            return res.status(400).json({ message: 'internshipId is invalid.' });
        }

        const existing = await Application.findOne({ studentId: req.user.id, internshipId });
        if (existing) {
            return res.status(409).json({ message: 'You already applied to this internship.' });
        }

        const [accessContext, internship] = await Promise.all([
            getStudentAccessContext(req.user.id),
            Internship.findById(internshipId).lean()
        ]);

        const alreadyPlacedApp = await Application.findOne({ studentId: req.user.id, status: { $in: ['Accepted', 'Placed'] } });
        const studentAlreadyPlaced = ['placed'].includes(String(accessContext.student?.status || accessContext.student?.internshipStatus || '').toLowerCase());
        if (alreadyPlacedApp || studentAlreadyPlaced) {
            return res.status(403).json({ message: 'You are already placed in an internship and cannot apply for another one.' });
        }

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found.' });
        }

        if (!accessContext.isVerified) {
            return res.status(403).json({ message: 'You must complete your profile and wait for HOD verification before applying.' });
        }

        if (!internshipMatchesStudent(internship, accessContext)) {
            return res.status(403).json({ message: 'This internship is not available to your department or college.' });
        }

        const profile = accessContext.profile;

        const matchResult = await getCalculatedMatch(req.user.id, internshipId);
        const fallbackScore = Number(matchScore);
        const calculatedScore = Number.isFinite(fallbackScore)
            ? fallbackScore
            : Number(matchResult?.score || 0);

        const finalResumeUrl = String(resumeUrl || profile?.resumeUrl || '').trim();
        if (!finalResumeUrl) {
            return res.status(400).json({ message: 'Please add your resume URL in profile before applying.' });
        }

        const initialStatus = 'Pending';

        const newApp = new Application({
            studentId: req.user.id,
            internshipId,
            resumeUrl: finalResumeUrl,
            coverLetter: String(coverLetter || '').trim(),
            matchingScore: calculatedScore,
            match_score: calculatedScore,
            status: initialStatus,
            source: 'student',
            timeline: [{
                status: initialStatus,
                date: new Date(),
                comment: 'Your application has been submitted and is awaiting employer review.'
            }]
        });
        await newApp.save();

        // Application creation should never auto-place a student. Placement happens only after employer acceptance.

        await writeActivity(
            req,
            'STUDENT_APPLIED_INTERNSHIP',
            `Student=${req.user?.id || ''} Internship=${internshipId} Application=${newApp?._id || ''}`
        );

        try {
            const [internshipSummary, student] = await Promise.all([
                Internship.findById(internshipId).select('title companyId').lean(),
                User.findById(req.user.id).select('fullName name email').lean()
            ]);

            const internshipTitle = internshipSummary?.title || 'this internship';
            const studentNotification = await Notification.create({
                userId: req.user.id,
                receiverRole: 'student',
                senderId: internshipSummary?.companyId || null,
                senderRole: 'employer',
                title: 'Application Submitted',
                message: `Your application for ${internshipTitle} was submitted successfully.`,
                type: 'success',
                targetRoute: '/student/applications'
            });
            emitNotification(req, studentNotification?.toObject ? studentNotification.toObject() : studentNotification);

            if (internshipSummary?.companyId) {
                const applicantName = student?.fullName || student?.name || student?.email || 'A student';
                const employerNotification = await Notification.create({
                    userId: internshipSummary.companyId,
                    receiverRole: 'employer',
                    senderId: req.user.id,
                    senderRole: 'student',
                    title: 'New Internship Application',
                    message: `A new student ${applicantName} has applied for your internship position.`,
                    type: 'info',
                    targetRoute: '/employer/applicants',
                    category: 'new-applicant',
                    metadata: {
                        kind: 'application-submitted',
                        applicationId: newApp._id,
                        internshipId: internshipSummary._id,
                        studentId: req.user.id
                    }
                });
                emitNotification(req, employerNotification?.toObject ? employerNotification.toObject() : employerNotification);

                const io = req.app.get('io');
                if (io && internshipSummary.companyId) {
                    io.to(`user:${String(internshipSummary.companyId)}`).emit('contacts:refresh', {
                        reason: 'new-application',
                        internshipId: String(internshipSummary._id || internshipId),
                        studentId: String(req.user.id || '')
                    });
                }
            }
        } catch {
            // Keep the main application flow successful even if notification write fails.
        }

        res.status(201).json({ message: 'Application submitted successfully.', application: newApp });
    } catch (err) {
        console.error('Error in /application/apply:', err);
        res.status(500).json({ message: err?.message || 'Application error.' });
    }
});

// 1.1 ተማሪው የላካቸውን ማመልከቻዎች ለማየት (My Applications)
router.get('/my', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can access their applications.' });
        }

        const apps = await Application.find({ studentId: req.user.id })
            .populate('internshipId', 'title location type status companyId duration startDate description internship_requirements requirements requiredSkills structuredRequirements programType department endDate isPaid stipend studentsNeeded trainingFocus')
            .sort({ createdAt: -1 })
            .lean();

        const CompanyProfile = require('../models/CompanyProfile');
        const companyIds = apps.map(app => app.internshipId?.companyId).filter(Boolean);
        const uniqueCompanyIds = [...new Set(companyIds.map(id => String(id)))];
        const companyProfiles = await CompanyProfile.find({ user: { $in: uniqueCompanyIds } }).lean();
        const profileMap = {};
        companyProfiles.forEach(cp => {
            profileMap[String(cp.user)] = cp;
        });

        const profile = await Profile.findOne({ userId: req.user.id }).lean();
        const studentSkills = (profile?.academicInfo?.skills || []).filter(Boolean).map(s => String(s).toLowerCase().trim());

        const enrichedApps = await Promise.all(apps.map(async app => {
            const internship = app.internshipId;
            if (internship) {
                internship.companyProfile = profileMap[String(internship.companyId)] || null;
                let finalScore = resolveStoredMatchScore(app);

                if (!finalScore || finalScore === 0) {
                     const matchResult = await getCalculatedMatch(req.user.id, internship._id);
                     finalScore = matchResult ? matchResult.score : 0;
                     if (finalScore > 0) {
                         await Application.updateOne(
                             { _id: app._id },
                             { $set: { matchingScore: finalScore, match_score: finalScore } }
                         );
                     }
                }

                app.matchingScore = finalScore;
                app.matchScore = finalScore;
                app.match_score = finalScore;
                internship.matchScore = finalScore;
                internship.aiMatchScore = finalScore;
                internship.matchingScore = finalScore;
            }

            // Hide HOD-only rejection reasons from students
            try {
                if (String(app.rejectionVisibleTo || '').toUpperCase() === 'HOD') {
                    app.rejectionReason = '';
                    app.rejection_reason_by_company = '';
                }
            } catch (e) {
                // ignore
            }

            return app;
        }));

        res.json(enrichedApps);
    } catch (err) {
        console.error("Error in /application/my:", err);
        res.status(500).json({ message: err?.message || 'Fetching error.' });
    }
});

// 2. ለአድሚን/ኮርዲኔተር ሁሉንም ማመልከቻዎች ለማሳየት
router.get('/admin/all', auth, async (req, res) => {
    try {
        const apps = await Application.find()
            .populate('studentId', 'fullName email')
            .populate('internshipId', 'title');
        // Ensure snake_case field is present for consumers expecting match_score
        const normalized = apps.map((a) => {
            const app = a.toObject ? a.toObject() : a;
            const finalScore = resolveStoredMatchScore(app);
            app.matchingScore = finalScore;
            app.matchScore = finalScore;
            app.match_score = finalScore;
            return app;
        });
        res.json(normalized);
    } catch (err) { res.status(500).send("Database sync error."); }
});


router.get('/employer/all', auth, async (req, res) => {
    if (String(req.user?.role || '').toLowerCase() !== 'employer') return res.status(403).send("No Permission.");
    try {
        
        const myPrograms = await Internship.find({ companyId: req.user.id });
        const programIds = myPrograms.map(p => p._id);

        const sortOrder = String(req.query.sortOrder || 'desc').toLowerCase() === 'asc' ? 1 : -1;
        const minMatchScore = Number(req.query.minMatchScore);
        const query = { internshipId: { $in: programIds } };
        if (Number.isFinite(minMatchScore) && minMatchScore >= 0) {
            query.match_score = { $gte: minMatchScore };
        }

        const apps = await Application.find(query)
            .sort({ match_score: sortOrder, createdAt: -1 })
            .populate('studentId', 'fullName email profileImage department college phone')
            .populate('internshipId', 'title location');

        const studentIds = [...new Set(
            apps
                .map((app) => String(app?.studentId?._id || ''))
                .filter(Boolean)
        )];

        const profiles = await Profile.find({ userId: { $in: studentIds } })
            .select('userId personalInfo academicInfo portfolioLinks resumeUrl profilePicUrl')
            .lean();

        const profileByUserId = new Map(
            profiles.map((profile) => [String(profile.userId), profile])
        );

        const enrichedApps = apps.map((app) => {
            const appObject = app.toObject();
            const studentId = String(appObject?.studentId?._id || '');
            const profile = profileByUserId.get(studentId);
            const finalScore = resolveStoredMatchScore(appObject);

            // Comprehensive mapping to ensure "really fetch everything"
            return {
                ...appObject,
                matchingScore: finalScore,
                matchScore: finalScore,
                match_score: finalScore,
                studentProfile: {
                    department: String(profile?.personalInfo?.department || appObject?.studentId?.department || '').trim(),
                    yearOfStudy: String(profile?.personalInfo?.yearOfStudy || '').trim(),
                    phone: String(profile?.personalInfo?.phone || appObject?.studentId?.phone || '').trim(),
                    bio: String(profile?.personalInfo?.bio || '').trim(),
                    address: String(profile?.personalInfo?.address || '').trim(),
                    gpa: profile?.academicInfo?.gpa || null,
                    courses: Array.isArray(profile?.academicInfo?.courses) ? profile.academicInfo.courses : [],
                    skills: Array.isArray(profile?.academicInfo?.skills) ? profile.academicInfo.skills : [],
                    portfolioLinks: profile?.portfolioLinks || {},
                    resumeUrl: String(profile?.resumeUrl || appObject?.resumeUrl || '').trim(),
                    profilePicUrl: String(profile?.profilePicUrl || appObject?.studentId?.profileImage || '').trim(),
                    college: String(appObject?.studentId?.college || '').trim()
                },
                placement_source: appObject?.placement_source || 'STUDENT_APPLIED',
                source: appObject?.source || 'student',
                hod_note: appObject?.hod_note || '',
                hod_assignment_note: appObject?.hod_assignment_note || '',
                assignedBy: appObject?.assignedBy || ''
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
        console.log(`[ActiveInterns] Found ${programIds.length} programs for employer ${req.user.id}`);
        const internshipById = new Map(myPrograms.map((program) => [String(program._id), program]));

        const acceptedApps = await Application.find({
            internshipId: { $in: programIds },
            status: { $in: ['Accepted', 'Placed'] }
        })
            .populate('studentId', 'fullName email department')
            .populate('internshipId', 'title status')
            .lean();
        console.log(`[ActiveInterns] Found ${acceptedApps.length} accepted/placed applications`);

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
                // expose the stored match score for employer/HOD views
                match_score: resolveStoredMatchScore(app),
                matchScore: resolveStoredMatchScore(app),
                progress,
                status: String(internship?.status || '').toLowerCase() === 'closed' ? 'Closed' : 'Active',
                tasks: taskStats,
                placement_source: app?.placement_source || 'STUDENT_APPLIED',
                source: app?.source || 'student',
                hod_note: app?.hod_note || '',
                hod_assignment_note: app?.hod_assignment_note || '',
                assignedBy: app?.assignedBy || ''
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

            const employerAllowed = new Set(['Pending', 'Under Review', 'Interview', 'Accepted', 'Rejected', 'Placed']);
            if (!employerAllowed.has(String(status || '').trim())) {
                return res.status(400).json({ message: 'Invalid status transition for employer.' });
            }
        }

        const finalStatus = String(status || '').trim();

        const updatedApp = await Application.findByIdAndUpdate(
            req.params.id,
            {
                $set: { status: finalStatus, remarks: normalizedRemarks, updatedAt: Date.now() },
                $push: {
                    timeline: {
                        status: finalStatus,
                        date: new Date(),
                        comment: normalizedRemarks || (finalStatus === 'Accepted' ? 'Employer accepted this application.' : '')
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

        // Smart rejection routing for employers: route reason to HOD or Student depending on placement_source
        if (updatedApp?.studentId) {
            try {
                const actorRole = String(req.user.role || 'employer').toLowerCase();
                const studentId = updatedApp.studentId;
                const companyUserId = currentApp?.internshipId?.companyId || updatedApp.companyId || null;
                const companyUser = companyUserId ? await User.findById(companyUserId).select('fullName name companyName').lean() : null;
                const companyName = companyUser?.companyName || companyUser?.fullName || companyUser?.name || 'Company';
                const makeSourceKey = (scope) => `application-status:${updatedApp._id}:${scope}`;

                // Extract a rejection reason if provided
                const rejectReason = String(req.body?.reason || req.body?.rejectionReason || req.body?.remarks || '').trim();

                if (actorRole === 'employer' && String(updatedApp.status || '').trim() === 'Rejected') {
                    // store rejection reason and visibility
                    const visibleTo = String(updatedApp.placement_source || '').toUpperCase() === 'HOD_ASSIGNED' ? 'HOD' : 'STUDENT';
                    updatedApp.rejectionReason = rejectReason;
                    updatedApp.rejection_reason_by_company = rejectReason;
                    updatedApp.rejectionVisibleTo = visibleTo;
                    await updatedApp.save();

                    if (visibleTo === 'HOD') {
                        // Notify HOD(s) in student's department with reason
                        const studentUser = await User.findById(studentId).select('fullName department departmentId').lean();
                        let hod = await User.findOne({ role: { $in: ['hod', 'deptadmin'] }, $or: [{ departmentId: studentUser?.departmentId }, { department: studentUser?.department }] }).select('_id fullName').lean();
                        if (hod && hod._id) {
                            const hodNotification = await upsertNotificationSafely({
                                userId: hod._id,
                                receiverRole: 'hod',
                                senderId: req.user.id,
                                senderRole: 'employer',
                                type: 'warning',
                                title: `Company ${companyName} rejected assigned student`,
                                message: `Company ${companyName} has rejected the assigned student ${studentUser?.fullName || 'Student'}. Reason: ${rejectReason}`,
                                targetRoute: '/hod/dashboard',
                                sourceKey: makeSourceKey('hod-rejection'),
                                metadata: { applicationId: updatedApp._id, reason: rejectReason, visible_to: 'HOD' }
                            });
                            emitNotification(req, hodNotification?.toObject ? hodNotification.toObject() : hodNotification);
                        }

                        // Inform the student of rejection but do NOT include the specific reason
                        const studentNotification = await upsertNotificationSafely({
                            userId: studentId,
                            receiverRole: 'student',
                            senderId: req.user.id,
                            senderRole: 'employer',
                            type: 'info',
                            title: 'Application Rejected',
                            message: `Your application to ${companyName} was not successful.`,
                            targetRoute: '/student/applications',
                            sourceKey: makeSourceKey('student-rejection-hidden'),
                            metadata: { applicationId: updatedApp._id, visible_to: 'HOD' }
                        });
                        emitNotification(req, studentNotification?.toObject ? studentNotification.toObject() : studentNotification);
                    } else {
                        // Visible to student (direct applicant) — send reason to student
                        const studentNotification = await upsertNotificationSafely({
                            userId: studentId,
                            receiverRole: 'student',
                            senderId: req.user.id,
                            senderRole: 'employer',
                            type: 'warning',
                            title: 'Application Feedback Available',
                            message: `Industry Partner ${companyName} has provided feedback on your application. Click to view details.`,
                            targetRoute: '/student/applications',
                            sourceKey: makeSourceKey('student-rejection-visible'),
                            metadata: { applicationId: updatedApp._id, companyName, reason: rejectReason, rejectionReason: rejectReason, visible_to: 'STUDENT' }
                        });
                        emitNotification(req, studentNotification?.toObject ? studentNotification.toObject() : studentNotification);

                        // Also notify HOD that the student was rejected (no reason detail required)
                        const studentUser = await User.findById(studentId).select('fullName department departmentId').lean();
                        let hod = await User.findOne({ role: { $in: ['hod', 'deptadmin'] }, $or: [{ departmentId: studentUser?.departmentId }, { department: studentUser?.department }] }).select('_id fullName').lean();
                        if (hod && hod._id) {
                            const hodNotification = await upsertNotificationSafely({
                                userId: hod._id,
                                receiverRole: 'hod',
                                senderId: req.user.id,
                                senderRole: 'employer',
                                type: 'info',
                                title: `Company ${companyName} rejected ${studentUser?.fullName || 'a student'}`,
                                message: `Company ${companyName} has rejected ${studentUser?.fullName || 'a student'} for their internship application.`,
                                targetRoute: '/hod/dashboard',
                                sourceKey: makeSourceKey('hod-rejection-visible'),
                                metadata: { applicationId: updatedApp._id, visible_to: 'STUDENT' }
                            });
                            emitNotification(req, hodNotification?.toObject ? hodNotification.toObject() : hodNotification);
                        }
                    }
                } else {
                    // Non-employer actor or non-rejection: default notification to student about status
                    const notification = await upsertNotificationSafely({
                        userId: updatedApp.studentId,
                        receiverRole: 'student',
                        senderId: req.user.id,
                        senderRole: actorRole,
                        title: 'Application Status Updated',
                        message: `Your application status is now ${status || updatedApp.status}.`,
                        type: 'info',
                        targetRoute: '/student/applications',
                        sourceKey: makeSourceKey('status-updated')
                    });
                    emitNotification(req, notification?.toObject ? notification.toObject() : notification);
                }
            } catch (notifyErr) {
                // don't block main flow on notification errors
                console.error('Notification routing error:', notifyErr);
            }
        }

        // Only update student placement status when the application is actually marked Placed.
        try {
            const finalPlaced = ['placed', 'PLACED'].includes(String(updatedApp?.status || '').toLowerCase());
            if (finalPlaced && updatedApp?.studentId) {
                await User.findByIdAndUpdate(updatedApp.studentId, {
                    internshipStatus: 'Placed',
                    status: 'PLACED'
                }).catch(() => {});
            }
        } catch (e) {
            // non-critical
        }

        const io = req.app.get('io');
        if (io && updatedApp?.studentId) {
            io.to(`user:${String(updatedApp.studentId)}`).emit('application:status-updated', {
                applicationId: String(updatedApp._id || ''),
                status: String(updatedApp.status || '').trim()
            });
            io.to(`user:${String(updatedApp.studentId)}`).emit('application:updated', {
                id: String(updatedApp._id || ''),
                status: String(updatedApp.status || '').trim()
            });
        }

        emitHodDashboardRefresh(req, {
            reason: 'application-status-updated',
            applicationId: String(updatedApp._id || ''),
            studentId: String(updatedApp.studentId || ''),
            internshipId: String(updatedApp.internshipId || '')
        });

        res.json(updatedApp);
    } catch (err) { res.status(500).send("Status update failed."); }
});

// 5. ተማሪው ማመልከቻውን እንዲሰርዝ (Withdraw)
router.put('/withdraw/:id', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') return res.status(403).send("Unauthorized.");

        const app = await Application.findOne({ _id: req.params.id, studentId: req.user.id });
        if (!app) return res.status(404).send("Application not found.");

        app.status = 'Withdrawn';
        await app.save();

        await writeActivity(req, 'STUDENT_WITHDREW_APPLICATION', `AppId=${app._id}`);
        emitHodDashboardRefresh(req, { reason: 'application-withdrawn', applicationId: String(app._id || '') });
        res.json({ message: "Application withdrawn successfully.", application: app });
    } catch (err) { res.status(500).send("Withdrawal failed."); }
});

// 6. ተማሪው ለቀረበለት እድል ምላሽ እንዲሰጥ (Accept/Decline Offer)
router.put('/respond/:id', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') return res.status(403).send("Unauthorized.");
        const { status } = req.body; // 'Accepted' or 'Rejected'

        if (!['Accepted', 'Rejected'].includes(status)) return res.status(400).send("Invalid status.");

        const app = await Application.findOne({ _id: req.params.id, studentId: req.user.id });
        if (!app) return res.status(404).send("Application not found.");

        app.status = status === 'Accepted' ? 'Placed' : 'Rejected';
        await app.save();

        await writeActivity(req, 'STUDENT_RESPONDED_TO_OFFER', `AppId=${app._id} Status=${status}`);
        emitHodDashboardRefresh(req, {
            reason: 'offer-response-updated',
            applicationId: String(app._id || ''),
            responseStatus: status
        });
        // When a student accepts an offer and status becomes Placed, update their User record
        try {
            if (String(app.status || '').toLowerCase() === 'placed') {
                await User.findByIdAndUpdate(app.studentId, { internshipStatus: 'Placed', status: 'PLACED' }).catch(() => {});
            }
        } catch (e) {
            // ignore
        }
        res.json({ message: `Offer ${status.toLowerCase()} successfully.`, application: app });
    } catch (err) { res.status(500).send("Response failed."); }
});

// 7. ማመልከቻን ለመሰረዝ (Delete Application)
router.delete('/:id', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || '').toLowerCase();
        if (!['admin', 'employer'].includes(role)) {
            return res.status(403).json({ message: 'No permission to delete applications.' });
        }

        const app = await Application.findById(req.params.id);
        if (!app) return res.status(404).json({ message: 'Application not found.' });

        // If employer, check ownership
        if (role === 'employer') {
            const internship = await Internship.findById(app.internshipId);
            const ownerId = String(internship?.companyId || '');
            if (ownerId !== String(req.user.id)) {
                return res.status(403).json({ message: 'You can only delete applicants for your own internships.' });
            }
        }

        // Clean up related data if necessary (Tasks, Reports, Notifications)
        await Promise.all([
            Application.findByIdAndDelete(req.params.id),
            Task.deleteMany({ application: req.params.id }),
            Report.deleteMany({ application: req.params.id }),
            Notification.deleteMany({ sourceKey: `new-applicant:${req.params.id}` })
        ]);

        await writeActivity(req, 'APPLICATION_DELETED', `AppId=${req.params.id} DeletedBy=${req.user.id}`);
        res.json({ success: true, message: "Application and related data deleted successfully." });
    } catch (err) { 
        console.error("Delete error:", err);
        res.status(500).json({ message: "Deletion failed due to a server error." }); 
    }
});

module.exports = router;