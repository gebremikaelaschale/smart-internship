const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Profile = require('../models/Profile');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');
const Certificate = require('../models/Certificate');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Report = require('../models/Report');
const Evaluation = require('../models/Evaluation');
const natural = require('natural');
const PDFDocument = require('pdfkit');
const { calculateMatchScore } = require('../utils/internshipMatching');

function resolveStoredMatchScore(application = {}) {
    const camel = Number(application?.matchingScore);
    const snake = Number(application?.match_score);
    const camelValue = Number.isFinite(camel) ? camel : 0;
    const snakeValue = Number.isFinite(snake) ? snake : 0;
    return Math.max(camelValue, snakeValue);
}

function dataUrlToBuffer(dataUrl = '') {
    const value = String(dataUrl || '');
    const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) return null;
    try {
        return Buffer.from(match[2], 'base64');
    } catch {
        return null;
    }
}

async function buildEmployerRecentActivity({ partnerId, internshipIds, today, limit = 8, offset = 0, activityType = 'all', fromDate = null, toDate = null }) {
    if (!internshipIds.length) {
        return { total: 0, items: [] };
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 8, 1), 100);
    const safeOffset = Math.max(Number(offset) || 0, 0);
    const fetchLimit = Math.min(Math.max((safeOffset + safeLimit) * 3, 50), 400);

    const [recentApplications, startedInternships, recentEvaluations] = await Promise.all([
        Application.find({ internshipId: { $in: internshipIds } })
            .select('studentId internshipId createdAt')
            .populate('studentId', 'fullName name')
            .populate('internshipId', 'title')
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .lean(),
        Internship.find({
            companyId: partnerId,
            startDate: { $ne: null, $lte: today }
        })
            .select('title startDate')
            .sort({ startDate: -1 })
            .limit(fetchLimit)
            .lean(),
        Evaluation.find({ internshipId: { $in: internshipIds } })
            .select('studentId internshipId createdAt dateEvaluated')
            .populate('studentId', 'fullName name')
            .populate('internshipId', 'title')
            .sort({ createdAt: -1 })
            .limit(fetchLimit)
            .lean()
    ]);

    const merged = [
        ...recentApplications.map((item) => ({
            id: `application-${item._id}`,
            type: 'application',
            title: 'New student applied',
            description: `${item?.studentId?.fullName || item?.studentId?.name || 'A student'} applied to ${item?.internshipId?.title || 'a program'}.`,
            timestamp: item.createdAt || new Date()
        })),
        ...startedInternships.map((item) => ({
            id: `start-${item._id}`,
            type: 'internship-started',
            title: 'Internship started',
            description: `${item?.title || 'An internship program'} has started.`,
            timestamp: item.startDate || new Date()
        })),
        ...recentEvaluations.map((item) => ({
            id: `evaluation-${item._id}`,
            type: 'evaluation',
            title: 'Evaluation submitted',
            description: `${item?.studentId?.fullName || item?.studentId?.name || 'A student'} received an evaluation for ${item?.internshipId?.title || 'a program'}.`,
            timestamp: item.dateEvaluated || item.createdAt || new Date()
        }))
    ]
        .filter((item) => {
            const typeMatch = String(activityType || 'all').toLowerCase() === 'all'
                ? true
                : String(item.type || '').toLowerCase() === String(activityType || '').toLowerCase();
            if (!typeMatch) return false;

            const ts = item.timestamp ? new Date(item.timestamp) : null;
            if (!ts || Number.isNaN(ts.getTime())) return false;

            if (fromDate && ts < fromDate) return false;
            if (toDate && ts > toDate) return false;
            return true;
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return {
        total: merged.length,
        items: merged.slice(safeOffset, safeOffset + safeLimit)
    };
}

const CAREER_JOURNEY_STEPS = [
    'Onboarding',
    'Profile Review',
    'Internship Search',
    'Applied',
    'Interview',
    'Internship',
    'Certification'
];

function normalizeValue(value = '') {
    return String(value || '').trim().toLowerCase();
}

function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + Number(days || 0));
    return result;
}

function buildStudentJourney({ verificationStatus, applications = [], reports = [], certificates = [], now = new Date() }) {
    const normalizedVerification = normalizeValue(verificationStatus);
    const acceptedStatuses = new Set(['accepted', 'placed']);
    const interviewStatuses = new Set(['interview']);
    const offerStatuses = new Set(['offered']);
    const reviewStatuses = new Set(['pending', 'seen', 'shortlisted']);

    const activeApplication = applications.find((application) => acceptedStatuses.has(normalizeValue(application?.status)));
    const interviewApplication = applications.find((application) => interviewStatuses.has(normalizeValue(application?.status)));
    const offerApplication = applications.find((application) => offerStatuses.has(normalizeValue(application?.status)));
    const completedCertificate = certificates.find((certificate) => normalizeValue(certificate?.verificationStatus) === 'verified' || certificate?.issued);

    const submittedReports = reports.filter((report) => normalizeValue(report?.status) !== 'draft');
    const latestSubmittedWeek = submittedReports.reduce((max, report) => Math.max(max, Number(report?.weekNumber) || 0), 0);

    const acceptedInternshipEnd = activeApplication?.internshipId?.endDate ? new Date(activeApplication.internshipId.endDate) : null;
    const internshipCompleted = acceptedInternshipEnd && !Number.isNaN(acceptedInternshipEnd.getTime()) && acceptedInternshipEnd < now;

    let stageIndex = 2;
    if (normalizedVerification === 'not submitted' || !normalizedVerification) {
        stageIndex = 0;
    } else if (normalizedVerification === 'submitted' || normalizedVerification === 'pending') {
        stageIndex = 1;
    } else if (completedCertificate || internshipCompleted) {
        stageIndex = 6;
    } else if (activeApplication) {
        stageIndex = 5;
    } else if (interviewApplication) {
        stageIndex = 4;
    } else if (offerApplication || applications.some((application) => reviewStatuses.has(normalizeValue(application?.status)))) {
        stageIndex = 3;
    } else if (normalizedVerification === 'verified') {
        stageIndex = 2;
    }

    const summaries = [
        'Complete your onboarding details to enter the verification flow.',
        'Your profile is being reviewed by the department team.',
        'You are verified and ready to explore internships.',
        'Your applications are active and waiting for responses.',
        'An interview is on the horizon. Prepare and stay alert.',
        'You are in an active internship placement.',
        'Your placement is ready for certification.'
    ];

    return {
        currentStage: CAREER_JOURNEY_STEPS[stageIndex],
        currentIndex: stageIndex,
        progress: Math.round((stageIndex / (CAREER_JOURNEY_STEPS.length - 1)) * 100),
        summary: summaries[stageIndex],
        completedReports: submittedReports.length,
        latestWeek: latestSubmittedWeek,
        steps: CAREER_JOURNEY_STEPS.map((label, index) => ({
            label,
            state: index < stageIndex ? 'complete' : index === stageIndex ? 'current' : 'upcoming'
        }))
    };
}

function buildActionRequiredItems({ applications = [], reports = [], calendarEvents = [], now = new Date() }) {
    const items = [];
    const acceptedStatuses = new Set(['accepted', 'placed']);

    calendarEvents
        .filter((event) => normalizeValue(event?.type) === 'interview')
        .slice(0, 2)
        .forEach((event, index) => {
            items.push({
                id: `interview-${index}-${event?.title || 'event'}`,
                type: 'interview',
                title: event?.title || 'Upcoming interview',
                subtitle: 'Interview date is scheduled. Be ready on time.',
                dueAt: event?.originalDate || event?.date || now.toISOString(),
                route: '/student/applications'
            });
        });

    const activeApplication = applications.find((application) => acceptedStatuses.has(normalizeValue(application?.status)));
    if (activeApplication) {
        const submittedReports = reports.filter((report) => normalizeValue(report?.status) !== 'draft');
        const latestWeek = submittedReports.reduce((max, report) => Math.max(max, Number(report?.weekNumber) || 0), 0);
        const internshipStart = activeApplication?.internshipId?.startDate ? new Date(activeApplication.internshipId.startDate) : null;
        const dueAt = internshipStart && !Number.isNaN(internshipStart.getTime())
            ? addDays(internshipStart, (latestWeek + 1) * 7)
            : addDays(now, 3);

        items.push({
            id: 'logbook-next-entry',
            type: 'logbook',
            title: `Week ${latestWeek + 1} logbook entry`,
            subtitle: 'Submit your weekly internship progress report.',
            dueAt: dueAt.toISOString(),
            route: '/student/logbook'
        });
    }

    applications
        .filter((application) => normalizeValue(application?.status) === 'offered')
        .slice(0, 2)
        .forEach((application, index) => {
            const dueAt = application?.updatedAt
                ? addDays(new Date(application.updatedAt), 2)
                : application?.createdAt
                    ? addDays(new Date(application.createdAt), 2)
                    : addDays(now, 2);

            items.push({
                id: `offer-${index}-${application?._id || 'item'}`,
                type: 'offer',
                title: `${application?.internshipId?.title || 'Internship'} offer expiring`,
                subtitle: 'Confirm or respond before the offer window closes.',
                dueAt: dueAt.toISOString(),
                route: '/student/applications'
            });
        });

    calendarEvents
        .filter((event) => normalizeValue(event?.type) === 'deadline')
        .slice(0, 2)
        .forEach((event, index) => {
            items.push({
                id: `deadline-${index}-${event?.title || 'item'}`,
                type: 'deadline',
                title: event?.title || 'Upcoming deadline',
                subtitle: 'Complete this action before it expires.',
                dueAt: event?.originalDate || event?.date || now.toISOString(),
                route: '/student/dashboard'
            });
        });

    return items
        .filter((item) => item?.dueAt)
        .sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
        .slice(0, 4);
}

// @route    GET api/dashboard/student
// @desc     Get student dashboard overview data with Strategic Analytics (Master Edition)
// @access   Private
router.get('/student', authMiddleware, async (req, res) => {
    try {
        console.log(`Fetching Strategic Dashboard for student: ${req.user.id}`);
        const studentId = req.user.id;

        // 1. Fetch Profile & Strength
        const [profile, studentUser] = await Promise.all([
            Profile.findOne({ userId: studentId }).populate('userId', ['fullName', 'email']),
            User.findById(studentId).select('department college isVerified verificationStatus verificationNote rejectionReason').lean()
        ]);
        
        // 2. Fetch Application Stats
        const totalApps = await Application.countDocuments({ studentId });
        const pendingApps = await Application.countDocuments({ studentId, status: { $in: ['Pending', 'Seen', 'Shortlisted', 'Interview'] } });
        const acceptedApps = await Application.countDocuments({ studentId, status: 'Accepted' });
        const rejectedApps = await Application.countDocuments({ studentId, status: 'Rejected' });
        const openInternships = await Internship.countDocuments({ status: 'Open' });

        // 3. Fetch Recent Applications (Last 5)
        const studentApplications = await Application.find({ studentId })
            .populate('internshipId', ['title', 'location', 'type', 'startDate', 'endDate', 'deadline'])
            .sort({ createdAt: -1 })
            .lean();

        // Normalize score fields so every consumer sees the same stored value.
        studentApplications.forEach((application) => {
            const finalScore = resolveStoredMatchScore(application);
            application.matchingScore = finalScore;
            application.match_score = finalScore;
            application.matchScore = finalScore;
        });

        const recentApplications = studentApplications.slice(0, 5);

        const studentReports = await Report.find({ studentId, type: 'Weekly' })
            .select('weekNumber status internshipId createdAt updatedAt')
            .populate('internshipId', 'title startDate endDate deadline')
            .sort({ weekNumber: 1, createdAt: 1 })
            .lean();

        const studentCertificates = await Certificate.find({ studentId })
            .select('verificationStatus issued internshipId applicationId updatedAt')
            .populate('internshipId', 'title startDate endDate deadline')
            .sort({ updatedAt: -1 })
            .lean();

        // 4. Fetch Pending Tasks (Last 5)
        const pendingTasks = await Task.find({ status: 'Pending' })
            .populate({
                path: 'application',
                match: { studentId: studentId }
            })
            .sort({ createdAt: -1 })
            .limit(5);
        
        const studentTasks = pendingTasks.filter(task => task.application !== null);

        // 5. Smart Recommendations (AI Matching)
        const allInternships = await Internship.find({ status: 'Open' }).limit(10).lean();

        const companyIds = [...new Set(allInternships.map(i => i.companyId).filter(Boolean))];
        // Only consider internships from verified companies
        const companyProfiles = await CompanyProfile.find({ user: { $in: companyIds }, 'verification.status': 'Verified' }).lean();
        const verifiedCompanyIds = companyProfiles.map(cp => String(cp.user));
        // filter internships to only those posted by verified companies
        const verifiedInternships = allInternships.filter(i => verifiedCompanyIds.includes(String(i.companyId)));
        const compMap = {};
        companyProfiles.forEach(cp => { compMap[String(cp.user)] = cp; });

        const studentDepartment = String(studentUser?.department || profile?.personalInfo?.department || '').trim();
        const storedScoreByInternshipId = new Map(
            studentApplications
                .filter((application) => application?.internshipId?._id)
                .map((application) => [String(application.internshipId._id), resolveStoredMatchScore(application)])
        );

        const recommendations = verifiedInternships
            .map((internship) => {
                // For internships the student already applied to, always use the stored score from the application.
                const storedScore = storedScoreByInternshipId.get(String(internship?._id || ''));
                const match = storedScore != null
                    ? { score: storedScore, reasoning: '', matchedTerms: [], departmentMatched: true }
                    : calculateMatchScore(profile, internship, { student: studentUser, studentDepartment });

                return {
                    ...internship,
                    companyProfile: compMap[String(internship.companyId)] || null,
                    matchScore: match.score,
                    matchReasoning: match.reasoning,
                    matchedTerms: match.matchedTerms,
                    departmentMatched: match.departmentMatched
                };
            })
            .filter((item) => item.departmentMatched !== false)
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 3);

        // 6. Fetch Calendar Events
        const now = new Date();
        const upcomingTasksWithDeadlines = await Task.find({ 
            status: 'Pending',
            deadline: { $gte: now }
        }).populate({
            path: 'application',
            match: { studentId: studentId }
        });

        const studentDeadlineTasks = upcomingTasksWithDeadlines.filter(t => t.application !== null);

        const upcomingEventsMap = await Event.find({
            studentId: studentId,
            eventDate: { $gte: now }
        }).sort({ eventDate: 1 }).limit(10);

        let mergedEvents = [];
        studentDeadlineTasks.forEach(t => {
            mergedEvents.push({ type: 'deadline', title: t.title, originalDate: t.deadline, iconKey: 'FileText', iconClass: 'bg-rose-100 text-rose-600', colorClass: 'bg-rose-50/50 border-rose-100' });
        });
        upcomingEventsMap.forEach(e => {
            const eType = e.type || 'Other';
            const iconConfig = eType === 'Interview' ? { k: 'Video', c: 'bg-blue-100 text-blue-600', cl: 'bg-blue-50/50 border-blue-100' } :
                               eType === 'Meeting' ? { k: 'Calendar', c: 'bg-emerald-100 text-emerald-600', cl: 'bg-emerald-50/50 border-emerald-100' } :
                               { k: 'Clock', c: 'bg-amber-100 text-amber-600', cl: 'bg-amber-50/50 border-amber-100' };
            mergedEvents.push({ type: eType.toLowerCase(), title: e.title, originalDate: e.eventDate, iconKey: iconConfig.k, iconClass: iconConfig.c, colorClass: iconConfig.cl });
        });
        mergedEvents.sort((a, b) => new Date(a.originalDate) - new Date(b.originalDate));
        
        const finalCalendarEvents = mergedEvents.slice(0, 5).map(evt => {
            const dateObj = new Date(evt.originalDate);
            return {
                ...evt,
                date: dateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }),
                time: dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute:'2-digit' })
            };
        });

        const journey = buildStudentJourney({
            verificationStatus: studentUser?.verificationStatus || profile?.verificationStatus,
            applications: studentApplications,
            reports: studentReports,
            certificates: studentCertificates
        });

        const actionRequired = buildActionRequiredItems({
            applications: studentApplications,
            reports: studentReports,
            calendarEvents: finalCalendarEvents
        });

        // 7. Generate Smart Tasks
        let finalTasks = [];
        if (!profile || profile.profileStrength < 100) finalTasks.push({ title: 'Complete Your Profile', actionPath: '/dashboard/profile', iconType: 'TrendingUp' });
        if (totalApps === 0) finalTasks.push({ title: 'Apply for your first Internship', actionPath: '/dashboard/internships', iconType: 'Briefcase' });
        if (acceptedApps > 0) finalTasks.push({ title: 'Submit your Progress Report', actionPath: '/dashboard/reports', iconType: 'FileText' });
        studentTasks.forEach(t => finalTasks.push({ title: t.title, actionPath: '#', iconType: 'AlertCircle' }));

        // 8. [MASTER EDITION] STRATEGIC ANALYTICS
        // A. Market Sentiment: Trending Skills
        const marketInternships = await Internship.find({ status: 'Open' }).limit(50).lean();
        // filter market internships to only verified companies
        const marketCompanyIds = [...new Set(marketInternships.map(i => i.companyId).filter(Boolean))];
        const marketCompanyProfiles = await CompanyProfile.find({ user: { $in: marketCompanyIds }, 'verification.status': 'Verified' }).lean();
        const marketVerifiedIds = marketCompanyProfiles.map(cp => String(cp.user));
        const filteredMarketInternships = marketInternships.filter(i => marketVerifiedIds.includes(String(i.companyId)));
        let marketSkillCounts = {}; 
        filteredMarketInternships.forEach(i => {
           if(i.requiredSkills) {
               i.requiredSkills.forEach(sk => {
                   if (sk && typeof sk === 'string') {
                       const s = sk.trim().toLowerCase();
                       marketSkillCounts[s] = (marketSkillCounts[s] || 0) + 1;
                   }
               });
           }
        });
        const trendingSkills = Object.entries(marketSkillCounts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 10);

        // B. Growth Velocity (Last 30 vs Previous 30)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

        const currentActivity = await Application.countDocuments({ studentId, createdAt: { $gte: thirtyDaysAgo } }) +
                                await Report.countDocuments({ studentId, createdAt: { $gte: thirtyDaysAgo } });
        
        const previousActivity = await Application.countDocuments({ studentId, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } }) +
                                 await Report.countDocuments({ studentId, createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo } });
        
        const growthVelocity = previousActivity === 0 ? (currentActivity > 0 ? 100 : 0) : 
                              Math.round(((currentActivity - previousActivity) / previousActivity) * 100);

        // C. Peer Benchmarking (Simulated University Average)
        const totalStudents = await User.distinct('_id', { role: { $in: ['student', 'Student'] } }).then((ids) => ids.length);
        const globalAcceptedApps = await Application.countDocuments({ status: 'Accepted' });
        const avgAccepted = totalStudents > 0 ? (globalAcceptedApps / totalStudents) : 0;
        const marketPosition = acceptedApps >= avgAccepted ? 'Top Performer' : 'Emerging Talent';
        const marketPositionScore = acceptedApps >= avgAccepted ? 85 + (acceptedApps - avgAccepted) * 5 : 60 + (acceptedApps / (avgAccepted || 1)) * 20;

        // D. Final Analytics Struct
        const analytics = {
            successRate: totalApps > 0 ? [
                { name: 'Accepted', value: acceptedApps, fill: '#10b981' }, 
                { name: 'Pending', value: pendingApps, fill: '#3b82f6' }, 
                { name: 'Rejected', value: rejectedApps, fill: '#f43f5e' }
            ].filter(d => d.value > 0) : [{ name: 'Initiating Data', value: 1, fill: '#e2e8f0' }],
            
            skills: trendingSkills.slice(0,6).map(([skill, count]) => {
                const userSkills = profile?.academicInfo?.skills?.filter(Boolean).map(s => s.toLowerCase().trim()) || [];
                const isMatched = userSkills.some(us => us.includes(skill) || skill.includes(us));
                return {
                    subject: skill.charAt(0).toUpperCase() + skill.slice(1),
                    score: isMatched ? 95 : 35,
                    marketDemand: Math.min(count * 20, 100),
                    fullMark: 100
                };
            }),

            activity: [], // 6 month history logic
            marketIntelligence: {
                trendingSkills: trendingSkills.map(([name, count]) => ({ name, intensity: count })),
                growthVelocity,
                marketPosition,
                marketPositionScore: Math.min(Math.round(marketPositionScore), 100),
                peerComparisonAvg: Math.round(avgAccepted * 10) / 10
            }
        };

        // Reuse activity level logic from previous turn...
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);

        const [monthlyApps, monthlyReports, monthlyTasks] = await Promise.all([
            Application.find({ studentId, createdAt: { $gte: sixMonthsAgo } }),
            Report.find({ studentId, createdAt: { $gte: sixMonthsAgo } }),
            Task.find({ status: 'Completed', createdAt: { $gte: sixMonthsAgo } }).populate({ path: 'application', match: { studentId: studentId } })
        ]);

        const filteredMonthlyTasks = monthlyTasks.filter(t => t.application !== null);
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        let activityMap = {};

        for(let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const m = monthNames[d.getMonth()];
            activityMap[m] = { name: m, actions: 0, applications: 0, reports: 0, tasks: 0 };
        }

        monthlyApps.forEach(a => { if(a.createdAt) { const m = monthNames[a.createdAt.getMonth()]; if(activityMap[m]) { activityMap[m].actions++; activityMap[m].applications++; } } });
        monthlyReports.forEach(r => { if(r.createdAt) { const m = monthNames[r.createdAt.getMonth()]; if(activityMap[m]) { activityMap[m].actions++; activityMap[m].reports++; } } });
        filteredMonthlyTasks.forEach(t => { if(t.createdAt) { const m = monthNames[t.createdAt.getMonth()]; if(activityMap[m]) { activityMap[m].actions++; activityMap[m].tasks++; } } });

        analytics.activity = Object.values(activityMap);

        const profilePayload = profile
            ? (typeof profile.toObject === 'function' ? profile.toObject() : { ...profile })
            : { profileStrength: 0 };

        if (studentUser) {
            profilePayload.isVerified = Boolean(studentUser.isVerified);
            profilePayload.verificationStatus = studentUser.verificationStatus
                || (studentUser.isVerified ? 'Verified' : 'Not Submitted');
            profilePayload.verificationNote = studentUser.verificationNote || '';
            profilePayload.rejectionReason = studentUser.rejectionReason || '';
            profilePayload.rejection_reason = studentUser.rejection_reason || studentUser.rejectionReason || '';
        }

        res.json({
            profile: profilePayload,
            stats: {
              total: totalApps,
              pending: pendingApps,
              accepted: acceptedApps,
              rejected: rejectedApps,
              saved: profile?.savedInternships?.length || 0,
              openInternships: openInternships
            },
            recentApplications,
            tasks: finalTasks,
            recommendations,
            calendarEvents: finalCalendarEvents,
            journey,
            actionRequired,
            analytics,
            saved: profile?.savedInternships?.length || 0,
            profileCompletion: profile?.profileStrength || 0
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route    GET api/dashboard/employer
// @desc     Get industry partner dashboard stats from real data
// @access   Private (Employer)
router.get('/employer', authMiddleware, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only industry partners can access this dashboard.' });
        }

        const partnerId = req.user.id;
        const today = new Date();
        const requestedMonths = Number(req.query.months || 6);
        const allowedMonths = [3, 6, 12];
        const rangeMonths = allowedMonths.includes(requestedMonths) ? requestedMonths : 6;
        const requestedInternshipId = String(req.query.internshipId || '').trim();

        const myInternships = await Internship.find({ companyId: partnerId })
            .select('_id title status endDate requiredSkills')
            .lean();

        const allInternshipIds = myInternships.map((item) => item._id);
        const hasSelectedInternship = requestedInternshipId && allInternshipIds.some((id) => String(id) === requestedInternshipId);
        const filteredInternships = hasSelectedInternship
            ? myInternships.filter((item) => String(item._id) === requestedInternshipId)
            : myInternships;
        const internshipIds = filteredInternships.map((item) => item._id);
        const activePrograms = filteredInternships.filter((item) => String(item.status || '').toLowerCase() === 'open').length;
        const totalPrograms = myInternships.length;
        const availablePrograms = myInternships.map((item) => ({
            id: item._id,
            title: item.title || 'Untitled Program'
        }));

        if (internshipIds.length === 0) {
            return res.json({
                stats: {
                    activePrograms: 0,
                    totalPrograms: 0,
                    totalApplicants: 0,
                    totalActiveInterns: 0,
                    totalAcceptedStudents: 0,
                    totalInterns: 0,
                    ongoing: 0,
                    completed: 0
                },
                performance: [],
                recommendedStudents: [],
                recentActivity: [],
                analytics: {
                    aiMatching: { matchScore: 0, topMatchScore: 0, sampleSize: 0 },
                    internshipSuccess: { successRate: 0, completedInterns: 0, totalInterns: 0 },
                    studentEngagement: {
                        engagementScore: 0,
                        responseRate: 0,
                        interviewRate: 0,
                        recentApplicantsCount: 0,
                        totalApplications: 0,
                        acceptedApplications: 0
                    },
                    trends: []
                },
                availablePrograms,
                filters: {
                    months: rangeMonths,
                    internshipId: hasSelectedInternship ? requestedInternshipId : 'all'
                }
            });
        }

        const allApplications = await Application.find({
            internshipId: { $in: internshipIds }
        })
            .select('internshipId status studentId matchingScore timeline createdAt')
            .lean();

        const companyApplicationsFilter = {
            internshipId: { $in: internshipIds }
        };

        const [distinctApplicantIds, distinctActiveIds, distinctAcceptedIds] = await Promise.all([
            Application.distinct('studentId', companyApplicationsFilter),
            Application.distinct('studentId', {
                ...companyApplicationsFilter,
                status: { $in: ['Accepted', 'Placed', 'PLACED'] }
            }),
            Application.distinct('studentId', {
                ...companyApplicationsFilter,
                status: { $in: ['Accepted', 'Placed', 'PLACED', 'Completed', 'COMPLETED'] }
            })
        ]);

        const acceptedApplications = await Application.find({
            internshipId: { $in: internshipIds },
            status: { $in: ['Accepted', 'Placed', 'PLACED', 'Completed', 'COMPLETED'] }
        })
            .populate('internshipId', 'endDate')
            .lean();

        const totalApplicants = distinctApplicantIds.length;
        const totalActiveInterns = distinctActiveIds.length;
        const totalAcceptedStudents = distinctAcceptedIds.length;

        let ongoing = 0;
        let completed = 0;

        acceptedApplications.forEach((application) => {
            const endDateValue = application?.internshipId?.endDate;
            const endDate = endDateValue ? new Date(endDateValue) : null;

            if (!endDate || Number.isNaN(endDate.getTime()) || endDate >= today) {
                ongoing += 1;
            } else {
                completed += 1;
            }
        });

        const totalInterns = ongoing + completed;

        const programMap = new Map(filteredInternships.map((internship) => [String(internship._id), internship]));
        const performanceMap = new Map();

        filteredInternships.forEach((internship) => {
            performanceMap.set(String(internship._id), {
                internshipId: internship._id,
                programTitle: internship.title || 'Untitled Program',
                status: internship.status || 'Pending',
                applicants: 0,
                accepted: 0,
                completed: 0,
                completionRate: 0
            });
        });

        allApplications.forEach((application) => {
            const key = String(application.internshipId);
            const program = performanceMap.get(key);
            if (!program) return;
            program.applicants += 1;

            if (String(application.status || '').toLowerCase() === 'accepted') {
                program.accepted += 1;
                const internship = programMap.get(key);
                const endDate = internship?.endDate ? new Date(internship.endDate) : null;
                const hasCompleted = endDate && !Number.isNaN(endDate.getTime()) && endDate < today;
                if (hasCompleted) {
                    program.completed += 1;
                }
            }
        });

        const performance = Array.from(performanceMap.values())
            .map((item) => ({
                ...item,
                completionRate: item.accepted > 0 ? Math.round((item.completed / item.accepted) * 100) : 0
            }))
            .sort((a, b) => b.applicants - a.applicants)
            .slice(0, 8);

        const marketSkills = new Map();
        filteredInternships
            .filter((internship) => String(internship.status || '').toLowerCase() === 'open')
            .forEach((internship) => {
                const skills = Array.isArray(internship.requiredSkills) ? internship.requiredSkills : [];
                skills.forEach((skill) => {
                    const key = String(skill || '').trim().toLowerCase();
                    if (!key) return;
                    marketSkills.set(key, (marketSkills.get(key) || 0) + 1);
                });
            });

        const weightedSkillEntries = Array.from(marketSkills.entries());
        const totalSkillWeight = weightedSkillEntries.reduce((sum, [, weight]) => sum + weight, 0);

        const studentProfiles = await Profile.find({})
            .select('userId academicInfo.skills')
            .populate('userId', 'fullName name email role')
            .lean();

        const applicantsSet = new Set(allApplications.map((app) => String(app.studentId)));

        const recommendedStudents = studentProfiles
            .filter((profileItem) => {
                const role = String(profileItem?.userId?.role || '').toLowerCase();
                return role === 'student' && !applicantsSet.has(String(profileItem?.userId?._id || profileItem?.userId));
            })
            .map((profileItem) => {
                const skills = Array.isArray(profileItem?.academicInfo?.skills) ? profileItem.academicInfo.skills : [];
                const skillSet = new Set(skills.map((skill) => String(skill || '').trim().toLowerCase()).filter(Boolean));

                let score = 0;
                weightedSkillEntries.forEach(([skill, weight]) => {
                    if (skillSet.has(skill)) {
                        score += weight;
                    }
                });

                const matchScore = totalSkillWeight > 0 ? Math.round((score / totalSkillWeight) * 100) : 0;
                return {
                    userId: profileItem?.userId?._id,
                    name: profileItem?.userId?.fullName || profileItem?.userId?.name || profileItem?.userId?.email || 'Student',
                    matchScore
                };
            })
            .sort((a, b) => b.matchScore - a.matchScore)
            .slice(0, 3);

        const recentActivityData = await buildEmployerRecentActivity({
            partnerId,
            internshipIds,
            today,
            limit: 8,
            offset: 0
        });
        const recentActivity = recentActivityData.items;

        const acceptedCount = allApplications.filter((item) => String(item?.status || '').toLowerCase() === 'accepted').length;
        const interviewCount = allApplications.filter((item) => String(item?.status || '').toLowerCase() === 'interview').length;
        const progressedCount = allApplications.filter((item) => {
            const status = String(item?.status || '').toLowerCase();
            return status === 'under review' || status === 'interview' || status === 'accepted' || status === 'rejected';
        }).length;

        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentApplicantsCount = allApplications.filter((item) => {
            const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
            return createdAt && !Number.isNaN(createdAt.getTime()) && createdAt >= thirtyDaysAgo;
        }).length;

        const matchingScores = allApplications
            .map((item) => Number(item?.matchingScore || 0))
            .filter((value) => Number.isFinite(value) && value > 0);
        const avgApplicationMatchScore = matchingScores.length
            ? Math.round(matchingScores.reduce((sum, value) => sum + value, 0) / matchingScores.length)
            : 0;
        const topApplicationMatchScore = matchingScores.length
            ? Math.round(Math.max(...matchingScores))
            : 0;

        const recommendedAverageScore = recommendedStudents.length
            ? Math.round(recommendedStudents.reduce((sum, item) => sum + Number(item?.matchScore || 0), 0) / recommendedStudents.length)
            : 0;

        const aiMatchScore = avgApplicationMatchScore > 0 ? avgApplicationMatchScore : recommendedAverageScore;
        const aiTopMatchScore = topApplicationMatchScore > 0
            ? topApplicationMatchScore
            : Math.max(0, ...recommendedStudents.map((item) => Number(item?.matchScore || 0)));

        const internshipSuccessRate = totalInterns > 0 ? Math.round((completed / totalInterns) * 100) : 0;
        const responseRate = allApplications.length > 0 ? Math.round((progressedCount / allApplications.length) * 100) : 0;
        const interviewRate = allApplications.length > 0 ? Math.round((interviewCount / allApplications.length) * 100) : 0;
        const activityRate = allApplications.length > 0 ? Math.round((recentApplicantsCount / allApplications.length) * 100) : 0;
        const studentEngagementScore = Math.round((responseRate * 0.5) + (interviewRate * 0.3) + (activityRate * 0.2));

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendsMap = new Map();
        for (let i = rangeMonths - 1; i >= 0; i -= 1) {
            const d = new Date(today);
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            trendsMap.set(key, {
                month: monthNames[d.getMonth()],
                totalApplications: 0,
                progressed: 0,
                interview: 0,
                accepted: 0,
                matchScoreSum: 0,
                matchScoreCount: 0
            });
        }

        allApplications.forEach((application) => {
            const createdAt = application?.createdAt ? new Date(application.createdAt) : null;
            if (!createdAt || Number.isNaN(createdAt.getTime())) return;

            const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
            const bucket = trendsMap.get(key);
            if (!bucket) return;

            bucket.totalApplications += 1;

            const status = String(application?.status || '').toLowerCase();
            if (status === 'under review' || status === 'interview' || status === 'accepted' || status === 'rejected') {
                bucket.progressed += 1;
            }
            if (status === 'interview') {
                bucket.interview += 1;
            }
            if (status === 'accepted') {
                bucket.accepted += 1;
            }

            const score = Number(application?.matchingScore || 0);
            if (Number.isFinite(score) && score > 0) {
                bucket.matchScoreSum += score;
                bucket.matchScoreCount += 1;
            }
        });

        const trends = Array.from(trendsMap.values()).map((item) => {
            const monthlyResponseRate = item.totalApplications > 0 ? Math.round((item.progressed / item.totalApplications) * 100) : 0;
            const monthlyInterviewRate = item.totalApplications > 0 ? Math.round((item.interview / item.totalApplications) * 100) : 0;
            const monthlySuccessRate = item.totalApplications > 0 ? Math.round((item.accepted / item.totalApplications) * 100) : 0;
            const monthlyAiMatch = item.matchScoreCount > 0 ? Math.round(item.matchScoreSum / item.matchScoreCount) : 0;
            const monthlyEngagement = Math.round((monthlyResponseRate * 0.6) + (monthlyInterviewRate * 0.4));

            return {
                month: item.month,
                aiMatchScore: monthlyAiMatch,
                successRate: monthlySuccessRate,
                engagementScore: monthlyEngagement
            };
        });

        const analytics = {
            aiMatching: {
                matchScore: aiMatchScore,
                topMatchScore: aiTopMatchScore,
                sampleSize: matchingScores.length
            },
            internshipSuccess: {
                successRate: internshipSuccessRate,
                completedInterns: completed,
                totalInterns
            },
            studentEngagement: {
                engagementScore: studentEngagementScore,
                responseRate,
                interviewRate,
                recentApplicantsCount,
                totalApplications: allApplications.length,
                acceptedApplications: acceptedCount
            },
            trends
        };

        return res.json({
            stats: {
                activePrograms,
                totalPrograms,
                totalApplicants,
                totalActiveInterns,
                totalAcceptedStudents,
                totalInterns,
                ongoing,
                completed
            },
            performance,
            recommendedStudents,
            recentActivity,
            analytics,
            availablePrograms,
            filters: {
                months: rangeMonths,
                internshipId: hasSelectedInternship ? requestedInternshipId : 'all'
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Failed to load industry partner dashboard.' });
    }
});

// @route    GET api/dashboard/employer/activity
// @desc     Get paginated recent activity for industry partner dashboard
// @access   Private (Employer)
router.get('/employer/activity', authMiddleware, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only industry partners can access this activity feed.' });
        }

        const partnerId = req.user.id;
        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 50);
        const offset = (page - 1) * limit;
        const activityType = String(req.query.type || 'all').trim().toLowerCase();
        const fromDate = req.query.from ? new Date(req.query.from) : null;
        const toDate = req.query.to ? new Date(req.query.to) : null;

        const safeFrom = fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : null;
        const safeTo = toDate && !Number.isNaN(toDate.getTime()) ? toDate : null;

        const myInternships = await Internship.find({ companyId: partnerId }).select('_id').lean();
        const internshipIds = myInternships.map((item) => item._id);
        const today = new Date();

        const activityData = await buildEmployerRecentActivity({
            partnerId,
            internshipIds,
            today,
            limit,
            offset,
            activityType,
            fromDate: safeFrom,
            toDate: safeTo
        });

        return res.json({
            items: activityData.items,
            pagination: {
                page,
                limit,
                total: activityData.total,
                totalPages: Math.max(1, Math.ceil(activityData.total / limit))
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Failed to load activity feed.' });
    }
});

// @route    GET api/dashboard/employer/reports
// @desc     Employer reports summary from live internship/application/evaluation data
// @access   Private (Employer)
router.get('/employer/reports', authMiddleware, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only industry partners can access reports.' });
        }

        const partnerId = req.user.id;
        const today = new Date();

        const myInternships = await Internship.find({ companyId: partnerId })
            .select('_id title endDate')
            .lean();
        const internshipIds = myInternships.map((item) => item._id);

        if (!internshipIds.length) {
            return res.json({
                totalInterns: 0,
                completed: 0,
                performanceSummary: {
                    completionRate: 0,
                    averageRating: 0,
                    averageScore: 0,
                    evaluatedInterns: 0,
                    acceptedInterns: 0
                }
            });
        }

        const acceptedApplications = await Application.find({
            internshipId: { $in: internshipIds },
            status: 'Accepted'
        })
            .select('_id internshipId studentId')
            .lean();

        let completed = 0;
        const internshipById = new Map(myInternships.map((item) => [String(item._id), item]));
        for (const application of acceptedApplications) {
            const internship = internshipById.get(String(application.internshipId));
            const endDate = internship?.endDate ? new Date(internship.endDate) : null;
            if (endDate && !Number.isNaN(endDate.getTime()) && endDate < today) {
                completed += 1;
            }
        }

        const evaluations = await Evaluation.find({ internshipId: { $in: internshipIds } })
            .select('studentId performanceRating score')
            .lean();

        const ratingValues = evaluations
            .map((item) => Number(item?.performanceRating))
            .filter((value) => Number.isFinite(value) && value > 0);

        const scoreValues = evaluations
            .map((item) => Number(item?.score))
            .filter((value) => Number.isFinite(value) && value >= 0);

        const evaluatedStudentsSet = new Set(
            evaluations
                .map((item) => String(item?.studentId || ''))
                .filter(Boolean)
        );

        const totalInterns = acceptedApplications.length;
        const completionRate = totalInterns > 0 ? Math.round((completed / totalInterns) * 100) : 0;
        const averageRating = ratingValues.length
            ? Math.round((ratingValues.reduce((sum, value) => sum + value, 0) / ratingValues.length) * 10) / 10
            : 0;
        const averageScore = scoreValues.length
            ? Math.round((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length) * 10) / 10
            : 0;

        return res.json({
            totalInterns,
            completed,
            performanceSummary: {
                completionRate,
                averageRating,
                averageScore,
                evaluatedInterns: evaluatedStudentsSet.size,
                acceptedInterns: totalInterns
            }
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).json({ message: 'Failed to load reports summary.' });
    }
});

// @route    GET api/dashboard/employer/reports/pdf
// @desc     Download employer analytics report as server-generated PDF
// @access   Private (Employer)
router.get('/employer/reports/pdf', authMiddleware, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only industry partners can export reports.' });
        }

        const partnerId = req.user.id;
        const requestedMonths = Number(req.query.months || 6);
        const allowedMonths = [3, 6, 12];
        const rangeMonths = allowedMonths.includes(requestedMonths) ? requestedMonths : 6;
        const requestedInternshipId = String(req.query.internshipId || '').trim();
        const today = new Date();

        const myInternships = await Internship.find({ companyId: partnerId })
            .select('_id title status endDate requiredSkills')
            .lean();
        const allInternshipIds = myInternships.map((item) => item._id);
        const hasSelectedInternship = requestedInternshipId && allInternshipIds.some((id) => String(id) === requestedInternshipId);
        const filteredInternships = hasSelectedInternship
            ? myInternships.filter((item) => String(item._id) === requestedInternshipId)
            : myInternships;
        const internshipIds = filteredInternships.map((item) => item._id);

        const selectedProgramTitle = hasSelectedInternship
            ? (filteredInternships[0]?.title || 'Selected Program')
            : 'All programs';
        const companyProfile = await CompanyProfile.findOne({ user: partnerId })
            .select('companyName logo officialEmail')
            .lean();
        const companyName = String(companyProfile?.companyName || req.user?.name || 'Industry Partner').trim() || 'Industry Partner';
        const companyEmail = String(companyProfile?.officialEmail || '').trim();
        const logoBuffer = dataUrlToBuffer(companyProfile?.logo || '');

        const allApplications = internshipIds.length > 0
            ? await Application.find({ internshipId: { $in: internshipIds } })
                .select('status matchingScore createdAt')
                .lean()
            : [];

        const acceptedApplications = internshipIds.length > 0
            ? await Application.find({ internshipId: { $in: internshipIds }, status: 'Accepted' })
                .populate('internshipId', 'endDate')
                .lean()
            : [];

        let completed = 0;
        acceptedApplications.forEach((application) => {
            const endDateValue = application?.internshipId?.endDate;
            const endDate = endDateValue ? new Date(endDateValue) : null;
            if (endDate && !Number.isNaN(endDate.getTime()) && endDate < today) {
                completed += 1;
            }
        });

        const totalInterns = acceptedApplications.length;
        const successRate = totalInterns > 0 ? Math.round((completed / totalInterns) * 100) : 0;

        const scored = allApplications
            .map((item) => Number(item?.matchingScore || 0))
            .filter((value) => Number.isFinite(value) && value > 0);
        const avgMatch = scored.length > 0
            ? Math.round(scored.reduce((sum, value) => sum + value, 0) / scored.length)
            : 0;
        const topMatch = scored.length > 0 ? Math.round(Math.max(...scored)) : 0;

        const progressedCount = allApplications.filter((item) => {
            const status = String(item?.status || '').toLowerCase();
            return status === 'under review' || status === 'interview' || status === 'accepted' || status === 'rejected';
        }).length;
        const interviewCount = allApplications.filter((item) => String(item?.status || '').toLowerCase() === 'interview').length;
        const recentApplicantsCount = allApplications.filter((item) => {
            const createdAt = item?.createdAt ? new Date(item.createdAt) : null;
            if (!createdAt || Number.isNaN(createdAt.getTime())) return false;
            const threshold = new Date();
            threshold.setDate(threshold.getDate() - 30);
            return createdAt >= threshold;
        }).length;
        const responseRate = allApplications.length > 0 ? Math.round((progressedCount / allApplications.length) * 100) : 0;
        const interviewRate = allApplications.length > 0 ? Math.round((interviewCount / allApplications.length) * 100) : 0;
        const activityRate = allApplications.length > 0 ? Math.round((recentApplicantsCount / allApplications.length) * 100) : 0;
        const engagementScore = Math.round((responseRate * 0.5) + (interviewRate * 0.3) + (activityRate * 0.2));

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendsMap = new Map();
        for (let i = rangeMonths - 1; i >= 0; i -= 1) {
            const d = new Date(today);
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            trendsMap.set(key, {
                month: monthNames[d.getMonth()],
                total: 0,
                progressed: 0,
                interview: 0,
                accepted: 0,
                matchSum: 0,
                matchCount: 0
            });
        }

        allApplications.forEach((application) => {
            const createdAt = application?.createdAt ? new Date(application.createdAt) : null;
            if (!createdAt || Number.isNaN(createdAt.getTime())) return;
            const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}`;
            const bucket = trendsMap.get(key);
            if (!bucket) return;

            bucket.total += 1;
            const status = String(application?.status || '').toLowerCase();
            if (status === 'under review' || status === 'interview' || status === 'accepted' || status === 'rejected') bucket.progressed += 1;
            if (status === 'interview') bucket.interview += 1;
            if (status === 'accepted') bucket.accepted += 1;

            const score = Number(application?.matchingScore || 0);
            if (Number.isFinite(score) && score > 0) {
                bucket.matchSum += score;
                bucket.matchCount += 1;
            }
        });

        const trends = Array.from(trendsMap.values()).map((item) => {
            const monthlyResponse = item.total > 0 ? Math.round((item.progressed / item.total) * 100) : 0;
            const monthlyInterview = item.total > 0 ? Math.round((item.interview / item.total) * 100) : 0;
            const monthlySuccess = item.total > 0 ? Math.round((item.accepted / item.total) * 100) : 0;
            const monthlyAiMatch = item.matchCount > 0 ? Math.round(item.matchSum / item.matchCount) : 0;
            const monthlyEngagement = Math.round((monthlyResponse * 0.6) + (monthlyInterview * 0.4));
            return {
                month: item.month,
                aiMatchScore: monthlyAiMatch,
                successRate: monthlySuccess,
                engagementScore: monthlyEngagement
            };
        });

        const fileName = `employer-analytics-${Date.now()}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        doc.pipe(res);

        if (logoBuffer) {
            try {
                doc.image(logoBuffer, 40, 34, { fit: [44, 44], align: 'left', valign: 'center' });
            } catch {
                // Ignore invalid or unsupported logo formats and continue rendering report.
            }
        }

        doc.fontSize(10).fillColor('#64748b').text(companyName, logoBuffer ? 94 : 40, 36, { align: 'left' });
        if (companyEmail) {
            doc.fontSize(9).fillColor('#94a3b8').text(companyEmail, logoBuffer ? 94 : 40, 50, { align: 'left' });
        }

        doc.fontSize(20).fillColor('#0f172a').text('Employer Analytics Report');
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#475569').text(`Generated: ${today.toLocaleString()}`);
        doc.text(`Range: Last ${rangeMonths} month(s)`);
        doc.text(`Program: ${selectedProgramTitle}`);

        doc.moveDown(0.8);
        doc.fontSize(13).fillColor('#0f172a').text('Summary Metrics');
        doc.moveDown(0.3);
        doc.fontSize(10).fillColor('#111827');
        doc.text(`AI Matching Score: ${avgMatch}% (Top: ${topMatch}%, Sample: ${scored.length})`);
        doc.text(`Internship Success Rate: ${successRate}% (${completed}/${totalInterns})`);
        doc.text(`Student Engagement: ${engagementScore}% (Response ${responseRate}%, Interview ${interviewRate}%)`);

        doc.moveDown(0.8);
        doc.fontSize(13).fillColor('#0f172a').text('KPI Trends');
        doc.moveDown(0.3);

        const startX = 40;
        let y = doc.y;
        const colWidths = [120, 120, 120, 120];
        const headers = ['Month', 'AI Match', 'Success', 'Engagement'];

        headers.forEach((header, index) => {
            const x = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0);
            doc.rect(x, y, colWidths[index], 20).fillAndStroke('#f1f5f9', '#cbd5e1');
            doc.fillColor('#0f172a').fontSize(9).text(header, x + 6, y + 6, { width: colWidths[index] - 12 });
        });
        y += 20;

        trends.forEach((row) => {
            const values = [row.month, `${row.aiMatchScore}%`, `${row.successRate}%`, `${row.engagementScore}%`];
            values.forEach((value, index) => {
                const x = startX + colWidths.slice(0, index).reduce((a, b) => a + b, 0);
                doc.rect(x, y, colWidths[index], 18).stroke('#e2e8f0');
                doc.fillColor('#334155').fontSize(9).text(value, x + 6, y + 5, { width: colWidths[index] - 12 });
            });
            y += 18;
            if (y > 760) {
                doc.addPage();
                y = 50;
            }
        });

        doc.moveDown(1.2);
        doc.fontSize(9).fillColor('#64748b').text('Generated from live database records for employer-owned internships.');
        doc.end();
    } catch (err) {
        console.error(err.message);

        if (res.headersSent) {
            return;
        }

        try {
            const fallbackName = `employer-analytics-error-${Date.now()}.pdf`;
            res.status(200);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${fallbackName}"`);

            const fallbackDoc = new PDFDocument({ margin: 40, size: 'A4' });
            fallbackDoc.pipe(res);
            fallbackDoc.fontSize(20).fillColor('#0f172a').text('Employer Analytics Report');
            fallbackDoc.moveDown(0.5);
            fallbackDoc.fontSize(12).fillColor('#b91c1c').text('Report generation encountered an issue.');
            fallbackDoc.moveDown(0.4);
            fallbackDoc.fontSize(10).fillColor('#475569').text(`Time: ${new Date().toLocaleString()}`);
            fallbackDoc.text('Please try again or contact support with this message:');
            fallbackDoc.moveDown(0.2);
            fallbackDoc.fontSize(10).fillColor('#0f172a').text(String(err?.message || 'Unknown report generation error.'));
            fallbackDoc.end();
        } catch (fallbackError) {
            console.error(fallbackError.message);
            return res.status(500).send('Failed to generate PDF report.');
        }
    }
});

module.exports = router;
