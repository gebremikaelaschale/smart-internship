const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Profile = require('../models/Profile');
const CompanyProfile = require('../models/CompanyProfile');
const Task = require('../models/Task');
const Event = require('../models/Event');
const Report = require('../models/Report');
const Evaluation = require('../models/Evaluation');
const natural = require('natural');
const PDFDocument = require('pdfkit');

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

// @route    GET api/dashboard/student
// @desc     Get student dashboard overview data with Strategic Analytics (Master Edition)
// @access   Private
router.get('/student', authMiddleware, async (req, res) => {
    try {
        console.log(`Fetching Strategic Dashboard for student: ${req.user.id}`);
        const studentId = req.user.id;

        // 1. Fetch Profile & Strength
        const profile = await Profile.findOne({ userId: studentId }).populate('userId', ['fullName', 'email']);
        
        // 2. Fetch Application Stats
        const totalApps = await Application.countDocuments({ studentId });
        const pendingApps = await Application.countDocuments({ studentId, status: { $in: ['Pending', 'Under Review'] } });
        const acceptedApps = await Application.countDocuments({ studentId, status: 'Accepted' });
        const rejectedApps = await Application.countDocuments({ studentId, status: 'Rejected' });

        // 3. Fetch Recent Applications (Last 5)
        const recentApplications = await Application.find({ studentId })
            .populate('internshipId', ['title', 'location', 'type'])
            .sort({ createdAt: -1 })
            .limit(5);

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
        const allInternships = await Internship.find({ status: 'Open' }).limit(10);
        let recommendations = [];

        if (profile && profile.academicInfo && profile.academicInfo.skills) {
            const studentSkills = profile.academicInfo.skills.filter(Boolean).map(s => s.toLowerCase().trim());
            
            recommendations = allInternships.map(internship => {
                const reqSkillsArray = internship.requiredSkills || [];
                const requiredSkills = reqSkillsArray.filter(Boolean).map(s => s.toLowerCase().trim());
                let matchedCount = 0;
                
                requiredSkills.forEach(reqS => {
                    studentSkills.forEach(stuS => {
                        if (reqS && stuS && natural.JaroWinklerDistance(reqS, stuS) > 0.85) matchedCount++;
                    });
                });

                const score = Math.round((matchedCount / (requiredSkills.length || 1)) * 100);
                return {
                    ...internship.toObject(),
                    matchScore: score > 100 ? 100 : score
                };
            }).sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
        } else {
            recommendations = allInternships.slice(0, 3).map(i => ({ ...i.toObject(), matchScore: 0 }));
        }

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

        // 7. Generate Smart Tasks
        let finalTasks = [];
        if (!profile || profile.profileStrength < 100) finalTasks.push({ title: 'Complete Your Profile', actionPath: '/dashboard/profile', iconType: 'TrendingUp' });
        if (totalApps === 0) finalTasks.push({ title: 'Apply for your first Internship', actionPath: '/dashboard/internships', iconType: 'Briefcase' });
        if (acceptedApps > 0) finalTasks.push({ title: 'Submit your Progress Report', actionPath: '/dashboard/reports', iconType: 'FileText' });
        studentTasks.forEach(t => finalTasks.push({ title: t.title, actionPath: '#', iconType: 'AlertCircle' }));

        // 8. [MASTER EDITION] STRATEGIC ANALYTICS
        // A. Market Sentiment: Trending Skills
        const marketInternships = await Internship.find({ status: 'Open' }).limit(50);
        let marketSkillCounts = {};
        marketInternships.forEach(i => {
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
        const totalStudents = await Profile.countDocuments();
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

        res.json({
            profile: profile || { profileStrength: 0 },
            stats: { total: totalApps, pending: pendingApps, accepted: acceptedApps, rejected: rejectedApps, saved: profile?.savedInternships?.length || 0 },
            recentApplications,
            tasks: finalTasks,
            recommendations,
            calendarEvents: finalCalendarEvents,
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
        const availablePrograms = myInternships.map((item) => ({
            id: item._id,
            title: item.title || 'Untitled Program'
        }));

        if (internshipIds.length === 0) {
            return res.json({
                stats: {
                    activePrograms: 0,
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

        const acceptedApplications = await Application.find({
            internshipId: { $in: internshipIds },
            status: 'Accepted'
        })
            .populate('internshipId', 'endDate')
            .lean();

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
