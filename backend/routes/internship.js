const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Internship = require('../models/Internship');
const Profile = require('../models/Profile');
const Notification = require('../models/Notification');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');
const Application = require('../models/Application');
const ActivityLog = require('../models/ActivityLog');
const { calculateMatchScore } = require('../utils/internshipMatching');

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

function parseJsonField(value, fallback) {
    if (typeof value === 'undefined' || value === null || value === '') return fallback;
    if (Array.isArray(value) || typeof value === 'object') return value;

    if (typeof value === 'string') {
        try {
            return JSON.parse(value);
        } catch {
            return fallback;
        }
    }

    return fallback;
}

function normalizeList(value) {
    return (Array.isArray(value) ? value : [])
        .map((item) => String(item || '').trim())
        .filter(Boolean);
}

function normalizeStructuredRequirements(value) {
    const structured = parseJsonField(value, {}) || {};
    return {
        coreTechnicalSkills: normalizeList(structured.coreTechnicalSkills || structured.core || []),
        preferredSkills: normalizeList(structured.preferredSkills || structured.preferred || []),
        softSkills: normalizeList(structured.softSkills || structured.soft || [])
    };
}

function flattenRequirementBuckets(structuredRequirements = {}) {
    return [
        ...(Array.isArray(structuredRequirements.coreTechnicalSkills) ? structuredRequirements.coreTechnicalSkills : []),
        ...(Array.isArray(structuredRequirements.preferredSkills) ? structuredRequirements.preferredSkills : []),
        ...(Array.isArray(structuredRequirements.softSkills) ? structuredRequirements.softSkills : [])
    ].map((item) => String(item || '').trim()).filter(Boolean);
}

function deriveRequirementTokens(text = '') {
    return String(text || '')
        .split(/[\n,.]/)
        .map((item) => item.trim())
        .filter(Boolean);
}

function resolveCompanyLogoUrl(company = {}) {
    if (!company) return '';
    return String(company.profileImage || company.logo || company.logoUrl || '').trim();
}

function getCompanyDisplayName(company = {}) {
    return String(company.name || company.fullName || 'Industry Partner').trim();
}

function normalizeInternshipResponse(internship, companyLogoFallback = '') {
    const item = internship && typeof internship.toObject === 'function' ? internship.toObject() : { ...internship };
    const company = item.companyId || {};
    const logo = resolveCompanyLogoUrl(company) || String(companyLogoFallback || '').trim();

    return {
        ...item,
        internship_title: String(item.title || '').trim(),
        company_name: getCompanyDisplayName(company),
        company_logo_url: logo,
        location: String(item.location || 'Addis Ababa').trim(),
        duration: String(item.duration || item.internshipDuration || item.trainingDuration || '').trim(),
        modality: String(item.workModality || 'On-site').trim()
    };
}

async function buildStudentInternshipScope(req) {
    const [student, verifiedCompanies] = await Promise.all([
        User.findById(req.user.id).select('role department college isVerified verificationStatus').lean(),
        User.find({
            role: { $in: ['employer', 'Industry Partner'] },
            isVerified: true
        }).select('_id').lean()
    ]);

    if (!student || String(student.role || '').toLowerCase() !== 'student') {
        return null;
    }

    if (!student.isVerified || String(student.verificationStatus || '').toLowerCase() !== 'verified') {
        return {
            blocked: true,
            message: 'Complete your profile and wait for HOD verification before browsing internships.'
        };
    }

    const departmentPattern = String(student.department || '').trim()
        ? new RegExp(`^${escapeRegex(student.department)}$`, 'i')
        : null;
    const collegePattern = String(student.college || '').trim()
        ? new RegExp(`^${escapeRegex(student.college)}$`, 'i')
        : null;

    const visibilityConditions = [];

    const targetConditions = [{ targetDepartments: { $size: 0 } }];
    if (departmentPattern) targetConditions.push({ targetDepartments: departmentPattern });
    if (collegePattern) targetConditions.push({ targetDepartments: collegePattern });

    if (targetConditions.length > 0) {
        visibilityConditions.push({ $or: targetConditions });
    }

    return {
        student,
        verifiedCompanyIds: verifiedCompanies.map((company) => company._id),
        departmentPattern,
        visibilityConditions
    };
}

// 1. መፍጠር (Industry Partner Only)
router.post('/', auth, async (req, res) => {
    if (String(req.user.role || '').toLowerCase() !== 'employer') return res.status(403).json({ msg: "Access Denied: Employers only." });
    try {
        const title = String(req.body.title || '').trim();
        const internshipRequirements = String(req.body.internship_requirements || req.body.description || '').trim();
        const description = internshipRequirements;
        let duration = String(req.body.duration || '').trim();
        const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
        const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
        const studentsNeeded = Number(req.body.studentsNeeded);

        // Auto-calculate duration if missing but dates are present
        if (!duration && startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
            const diffMs = endDate - startDate;
            if (diffMs >= 0) {
                const diffDays = diffMs / (1000 * 60 * 60 * 24);
                const months = Math.round(diffDays / 30);
                if (months >= 1) {
                    duration = `${months} month${months > 1 ? 's' : ''}`;
                } else {
                    const weeks = Math.round(diffDays / 7);
                    duration = `${weeks} week${weeks > 1 ? 's' : ''}`;
                }
            }
        }

        if (!title || !description || !duration || !startDate || !endDate || !Number.isInteger(studentsNeeded) || studentsNeeded < 1) {
            return res.status(400).json({ message: 'Please provide title, internship requirements, duration (or start/end dates), and a valid studentsNeeded value.' });
        }

        if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
            return res.status(400).json({ message: 'Invalid date range: endDate must be the same as or after startDate.' });
        }

        const derivedSkills = deriveRequirementTokens(internshipRequirements);

        const newInternship = new Internship({
            ...req.body,
            title,
            description,
            internship_requirements: internshipRequirements,
            duration,
            startDate,
            endDate,
            deadline: req.body.deadline || endDate,
            studentsNeeded,
            requiredSkills: derivedSkills,
            requirements: derivedSkills,
            targetDepartments: req.body.targetDepartments || [],
            targetBatch: req.body.targetBatch || 'Graduating Class',
            workModality: req.body.workModality || 'On-site',
            compensationType: req.body.compensationType || 'Unpaid',
            minCgpa: Number(req.body.minCgpa) || 0,
            interviewRequired: req.body.interviewRequired === true || req.body.interviewRequired === 'true',
            location: req.body.location || 'Addis Ababa',
            programType: 'Internship Program',
            trainingFocus: true,
            companyId: req.user.id,
            companyEmail: req.user.email,
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
// 🔍 GET Dynamic Filters (Majors, Locations, Durations)
router.get('/filters', auth, async (req, res) => {
    try {
        const scope = await buildStudentInternshipScope(req);
        if (!scope) {
            return res.status(403).json({ message: 'Access denied: Student role required.' });
        }
        if (scope.blocked) {
            return res.status(403).json({ message: scope.message });
        }

        const baseConditions = [
            { status: 'Open' },
            { companyId: { $in: scope.verifiedCompanyIds } },
            ...scope.visibilityConditions
        ];
        const filter = baseConditions.length === 1 ? baseConditions[0] : { $and: baseConditions };

        const [departments, locations, durations] = await Promise.all([
            Internship.distinct('targetDepartments', filter),
            Internship.distinct('location', filter),
            Internship.distinct('duration', filter)
        ]);

        const normalize = (list) => {
            const normalized = list
                .filter(Boolean)
                .map(s => s.trim().toLowerCase())
                .map(s => s.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
            return [...new Set(normalized)].sort();
        };

        return res.json({
            departments: normalize(departments),
            locations: normalize(locations),
            durations: normalize(durations)
        });
    } catch (err) {
        console.error("Filter Fetch Error:", err);
        res.status(500).send("Error fetching filters.");
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const scope = await buildStudentInternshipScope(req);
        if (!scope) {
            return res.status(403).json({ message: 'Access denied: Student role required.' });
        }
        if (scope.blocked) {
            return res.status(403).json({ message: scope.message });
        }

        const q = String(req.query.q || '').trim();
        const location = String(req.query.location || '').trim();
        const isPaid = req.query.isPaid;
        const duration = String(req.query.duration || '').trim();
        const major = String(req.query.major || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 12, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;

        const conditions = [
            { status: 'Open' },
            { companyId: { $in: scope.verifiedCompanyIds } },
            ...scope.visibilityConditions
        ];

        if (location && location.toLowerCase() !== 'any location') {
            conditions.push({ location: new RegExp(escapeRegex(location), 'i') });
        }

        if (isPaid !== undefined && isPaid !== 'all' && isPaid !== '') {
            conditions.push({ isPaid: isPaid === 'true' });
        }

        if (duration && duration.toLowerCase() !== 'all' && duration.toLowerCase() !== 'any duration') {
            conditions.push({ duration: new RegExp(escapeRegex(duration), 'i') });
        }

        if (major) {
            conditions.push({ targetDepartments: new RegExp(`^${escapeRegex(major)}$`, 'i') });
        }

        if (q) {
            const pattern = new RegExp(escapeRegex(q), 'i');
            
            // Search for company names first
            const matchingCompanies = await User.find({
                role: { $in: ['employer', 'Industry Partner', 'Employer'] },
                isVerified: true,
                $or: [
                    { name: pattern },
                    { fullName: pattern }
                ]
            }).select('_id');
            const companyIds = matchingCompanies.map(c => c._id);

            const searchFilter = {
                $or: [
                    { title: pattern },
                    { description: pattern },
                    { location: pattern },
                    { duration: pattern },
                    { requiredSkills: pattern },
                    { companyId: { $in: companyIds } }
                ]
            };

            conditions.push(searchFilter);
        }

        const filter = conditions.length === 1 ? conditions[0] : { $and: conditions };

        const sortKey = String(req.query.sort || 'newest').toLowerCase();
        let sortObj = { createdAt: -1 }; // Default: Newest

        const sortMap = {
            'newest': { createdAt: -1 },
            'oldest': { createdAt: 1 },
            'deadline': { deadline: 1 },
            'alphabetical': { title: 1 },
            'seats': { studentsNeeded: -1 }
        };

        if (sortMap[sortKey]) {
            sortObj = sortMap[sortKey];
        }

        let query = Internship.find(filter)
            .populate('companyId', 'name fullName profileImage')
            .sort(sortObj);

        if (sortKey === 'alphabetical') {
            query = query.collation({ locale: 'en', strength: 2 });
        }

        const [internships, total] = await Promise.all([
            query.skip(skip).limit(limit),
            Internship.countDocuments(filter)
        ]);

        const companyIds = [...new Set(internships
            .map((item) => String(item.companyId?._id || item.companyId || ''))
            .filter(Boolean)
        )];

        const companyProfiles = companyIds.length > 0
            ? await CompanyProfile.find({ user: { $in: companyIds } }).select('user logo logoUrl').lean()
            : [];

        const companyProfileMap = companyProfiles.reduce((map, profile) => {
            map[String(profile.user)] = profile;
            return map;
        }, {});

        const profile = await Profile.findOne({ userId: req.user.id }).lean();
        const studentDepartment = String(scope.student?.department || profile?.personalInfo?.department || '').trim();

        const internshipIds = internships.map((internship) => internship?._id).filter(Boolean);
        const existingApplications = internshipIds.length > 0
            ? await Application.find({ studentId: req.user.id, internshipId: { $in: internshipIds } })
                .select('internshipId matchingScore match_score')
                .lean()
            : [];

        const storedScoreByInternshipId = new Map(
            existingApplications.map((application) => {
                const camel = Number(application?.matchingScore);
                const snake = Number(application?.match_score);
                const camelValue = Number.isFinite(camel) ? camel : 0;
                const snakeValue = Number.isFinite(snake) ? snake : 0;
                return [String(application?.internshipId || ''), Math.max(camelValue, snakeValue)];
            })
        );

        const scoredInternships = internships.map((internship) => {
            const storedScore = storedScoreByInternshipId.get(String(internship?._id || ''));
            const match = storedScore != null
                ? { score: storedScore, reasoning: '', matchedTerms: [], departmentMatched: true }
                : calculateMatchScore(profile || {}, internship, {
                    student: scope.student,
                    studentDepartment
                });

            const company = internship.companyId || {};
            const companyFallback = companyProfileMap[String(company._id || company)]?.logoUrl
                || companyProfileMap[String(company._id || company)]?.logo
                || '';

            return {
                ...normalizeInternshipResponse(internship, companyFallback),
                matchScore: match.score,
                matchReasoning: match.reasoning,
                matchedTerms: match.matchedTerms,
                departmentMatched: match.departmentMatched
            };
        });

        return res.json({
            items: scoredInternships,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (err) { 
        console.error("Internship Fetch Error:", err);
        res.status(500).send("Error fetching internships."); 
    }
});

// 2.1 Search suggestions for internship titles
router.get('/suggestions', auth, async (req, res) => {
    try {
        const scope = await buildStudentInternshipScope(req);
        if (!scope) {
            return res.status(403).json({ message: 'Access denied: Student role required.' });
        }
        if (scope.blocked) {
            return res.status(403).json({ message: scope.message });
        }

        const q = String(req.query.q || '').trim();
        if (!q) {
            return res.json([]);
        }

        const pattern = new RegExp(escapeRegex(q), 'i');
        const suggestionFilter = {
            $and: [
                { status: 'Open' },
                { companyId: { $in: scope.verifiedCompanyIds } },
                ...scope.visibilityConditions,
                { title: pattern }
            ]
        };

        const suggestions = await Internship.find(suggestionFilter)
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
        const mongoose = require('mongoose');
        const myInternships = await Internship.aggregate([
            { $match: { companyId: new mongoose.Types.ObjectId(req.user.id) } },
            {
                $lookup: {
                    from: 'applications',
                    localField: '_id',
                    foreignField: 'internshipId',
                    as: 'applicants'
                }
            },
            {
                $addFields: {
                    applicantCount: { $size: '$applicants' }
                }
            },
            { $project: { applicants: 0 } },
            { $sort: { createdAt: -1 } }
        ]);
        res.json(myInternships);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching your internships.");
    }
});

// 3.1 Get Single Internship by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Invalid Internship ID format.' });
        }
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'Internship not found.' });

        // Enforce: only return internships that are Open and belong to verified companies,
        // unless the requester is the owning employer.
        const companyId = internship.companyId;

        // If requester owns the internship, allow access even if the status is still pending/closed.
        const requesterId = String(req.user?.id || req.user?.userId || req.user?._id || '');
        if (requesterId && requesterId === String(companyId)) {
            const populated = await Internship.findById(req.params.id).populate('companyId', 'name fullName profileImage');
            return res.json(populated);
        }

        if (String(internship.status || '').toLowerCase() !== 'open') {
            return res.status(404).json({ message: 'Internship not found.' });
        }

        // Check company verification via User or CompanyProfile
        const companyUser = await User.findById(companyId).select('isVerified').lean();
        let isCompanyVerified = companyUser ? Boolean(companyUser.isVerified) : false;
        if (!isCompanyVerified) {
            // try CompanyProfile fallback
            try {
                const CompanyProfile = require('../models/CompanyProfile');
                const cp = await CompanyProfile.findOne({ user: companyId }).select('verification.status').lean();
                if (cp && String(cp.verification?.status || '').toLowerCase() === 'verified') isCompanyVerified = true;
            } catch (e) {
                // ignore
            }
        }

        if (!isCompanyVerified) return res.status(404).json({ message: 'Internship not found.' });

        const populated = await Internship.findById(req.params.id).populate('companyId', 'name fullName profileImage');
        res.json(populated);
    } catch (err) {
        res.status(500).json({ message: 'Error fetching internship details.' });
    }
});

// 3.2 Update General Internship Details
router.put('/:id', auth, async (req, res) => {
    if (String(req.user.role || '').toLowerCase() !== 'employer') return res.status(403).json({ msg: "Access Denied." });
    try {
        const internship = await Internship.findById(req.params.id);
        if (!internship) return res.status(404).json({ message: 'Internship not found.' });
        if (String(internship.companyId) !== String(req.user.id)) return res.status(403).json({ message: 'Unauthorized: You can only update your own internships.' });

        const title = String(req.body.title || '').trim();
        const internshipRequirements = String(req.body.internship_requirements || req.body.description || '').trim();
        const description = internshipRequirements;
        const studentsNeeded = Number(req.body.studentsNeeded);

        if (!title || !description || !Number.isInteger(studentsNeeded) || studentsNeeded < 1) {
            return res.status(400).json({ message: 'Please provide title, internship requirements, and a valid studentsNeeded value.' });
        }

        const derivedSkills = deriveRequirementTokens(internshipRequirements);

        Object.assign(internship, {
            ...req.body,
            title,
            description,
            internship_requirements: internshipRequirements,
            studentsNeeded,
            requiredSkills: derivedSkills,
            requirements: derivedSkills,
            // Deadline might be updated, if not use current
            deadline: req.body.deadline || internship.deadline
        });

        await internship.save();
        await writeActivity(req, 'COMPANY_UPDATED_INTERNSHIP', `Employer=${req.user.id} Internship=${internship._id}`);

        res.json(internship);
    } catch (err) {
        res.status(500).json({ message: 'Failed to update internship details.' });
    }
});

// 4. Update Status (Publish/Archive)
router.put('/:id/status', auth, async (req, res) => {
    try {
        const { status } = req.body;
        const internship = await Internship.findByIdAndUpdate(req.params.id, { status }, { returnDocument: 'after' }).populate('companyId', 'name fullName');
        
        if (status === 'Open') {
            // 🚀 Send Email Alerts to Students
            const { sendEmail } = require('../utils/mailer');
            const UserPreferences = require('../models/UserPreferences');
            
            try {
                const students = await User.find({ role: { $in: ['student', 'Student'] } }).select('_id email name fullName').lean();
                const studentIds = students.map(s => s._id);
                
                // Filter out only those who specifically disabled emailAlerts
                const optOutPrefs = await UserPreferences.find({ 
                    userId: { $in: studentIds },
                    'notifications.emailAlerts': false 
                }).select('userId').lean();
                
                const optOutIds = new Set(optOutPrefs.map(p => String(p.userId)));
                const targets = students.filter(s => !optOutIds.has(String(s._id)));

                if (targets.length) {
                    const companyName = internship.companyId?.name || internship.companyId?.fullName || 'A Partner Company';
                    
                    // Send emails in background
                    targets.forEach(student => {
                        sendEmail({
                            to: student.email,
                            subject: `New Opportunity: ${internship.title}`,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h2 style="color: #0891b2;">New Internship Available!</h2>
                                    <p>Hello ${student.name || student.fullName},</p>
                                    <p>A new internship opportunity has been posted by <strong>${companyName}</strong>:</p>
                                    <div style="background: #f0f9ff; padding: 15px; border-radius: 10px; border: 1px solid #bae6fd; margin: 20px 0;">
                                        <h3 style="margin: 0;">${internship.title}</h3>
                                        <p style="margin: 5px 0; font-size: 14px;">Location: ${internship.location || 'Remote'}</p>
                                        <p style="margin: 10px 0;">${internship.description.substring(0, 150)}...</p>
                                    </div>
                                    <p>Log in to your dashboard to view more details and apply.</p>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/internships" 
                                       style="display: inline-block; background: #0891b2; color: white; padding: 12px 25px; border-radius: 50px; text-decoration: none; font-weight: bold; margin-top: 10px;">
                                        View Internship
                                    </a>
                                </div>
                            `
                        });
                    });
                }
            } catch (err) {
                console.error("Email notification fan-out failed:", err);
            }
        }

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
