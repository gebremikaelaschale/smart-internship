const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Profile = require('../models/Profile');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for local student resume uploads
const resumeStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/resumes');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const studentName = req.body.fullName || 'student';
        const safeName = studentName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const uniqueSuffix = Date.now();
        cb(null, `${safeName}-resume-${uniqueSuffix}${path.extname(file.originalname)}`);
    }
});

const resumeUpload = multer({
    storage: resumeStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for resumes.'));
        }
    }
});

function ensureStudent(req, res) {
    if (String(req.user?.role || '').toLowerCase() !== 'student') {
        res.status(403).json({ message: 'Access denied: Student role required.' });
        return false;
    }
    return true;
}

function calculateProfileStrength({ user, profile }) {
    const checks = [
        profile?.profilePicUrl,
        user?.name || user?.fullName,
        user?.email,
        user?.phone,
        user?.college,
        user?.department,
        profile?.resumeUrl,
        profile?.academicInfo?.skills?.length,
        profile?.personalInfo?.bio
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
}

router.get('/dashboard', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const user = await User.findById(req.user.id).lean();
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    return res.json({
        message: 'Student dashboard access granted.',
        student: {
            id: user._id,
            name: user.name || user.fullName,
            email: user.email,
            role: 'student'
        }
    });
});

router.get('/profile', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const user = await User.findById(req.user.id).lean();
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    const profile = await Profile.findOne({ userId: req.user.id }).lean();
    const profileStrength = profile?.profileStrength ?? calculateProfileStrength({ user, profile });

    return res.json({
        profile: {
            fullName: user.fullName || user.name || '',
            name: user.name || user.fullName || '',
            email: user.email || '',
            profilePicUrl: profile?.profilePicUrl || '',
            phone: user.phone || profile?.personalInfo?.phone || '',
            college: user.college || '',
            department: user.department || profile?.personalInfo?.department || '',
            yearOfStudy: profile?.personalInfo?.yearOfStudy || '',
            bio: profile?.personalInfo?.bio || '',
            gpa: profile?.academicInfo?.gpa ?? '',
            skills: profile?.academicInfo?.skills || [],
            courses: profile?.academicInfo?.courses || [],
            resumeUrl: profile?.resumeUrl || '',
            portfolioLinks: profile?.portfolioLinks || { github: '', linkedin: '', website: '' },
            profileStrength
        }
    });
});

router.put('/profile', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const {
        fullName,
        phone,
        college,
        department,
        yearOfStudy,
        bio,
        profilePicUrl,
        gpa,
        skills,
        courses,
        resumeUrl,
        portfolioLinks
    } = req.body || {};

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    if (fullName) {
        user.fullName = String(fullName).trim();
        user.name = String(fullName).trim();
    }
    if (typeof phone !== 'undefined') user.phone = String(phone || '').trim();
    if (typeof college !== 'undefined') user.college = String(college || '').trim();
    if (typeof department !== 'undefined') user.department = String(department || '').trim();
    await user.save();

    const profile = await Profile.findOneAndUpdate(
        { userId: req.user.id },
        {
            $set: {
                profilePicUrl: String(profilePicUrl || '').trim(),
                'personalInfo.department': String(department || '').trim(),
                'personalInfo.yearOfStudy': String(yearOfStudy || '').trim(),
                'personalInfo.phone': String(phone || '').trim(),
                'personalInfo.bio': String(bio || '').trim(),
                'academicInfo.gpa': gpa === '' || gpa === null || typeof gpa === 'undefined' ? null : Number(gpa),
                'academicInfo.skills': Array.isArray(skills) ? skills.filter(Boolean).map((s) => String(s).trim()) : [],
                'academicInfo.courses': Array.isArray(courses) ? courses.filter(Boolean).map((c) => String(c).trim()) : [],
                resumeUrl: String(resumeUrl || '').trim(),
                portfolioLinks: {
                    github: String(portfolioLinks?.github || '').trim(),
                    linkedin: String(portfolioLinks?.linkedin || '').trim(),
                    website: String(portfolioLinks?.website || '').trim()
                }
            }
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    profile.profileStrength = calculateProfileStrength({ user, profile });
    await profile.save();

    return res.json({
        message: 'Profile updated successfully.',
        profile: {
            fullName: user.fullName || user.name || '',
            name: user.name || user.fullName || '',
            email: user.email || '',
            profilePicUrl: profile?.profilePicUrl || '',
            phone: user.phone || '',
            college: user.college || '',
            department: user.department || '',
            yearOfStudy: profile?.personalInfo?.yearOfStudy || '',
            bio: profile?.personalInfo?.bio || '',
            gpa: profile?.academicInfo?.gpa ?? '',
            skills: profile?.academicInfo?.skills || [],
            courses: profile?.academicInfo?.courses || [],
            resumeUrl: profile?.resumeUrl || '',
            portfolioLinks: profile?.portfolioLinks || { github: '', linkedin: '', website: '' },
            profileStrength: profile.profileStrength || 0
        }
    });
});

// 💾 Save/Toggle Internship
router.post('/saved-internships', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;
    try {
        const { internshipId } = req.body;
        if (!internshipId) return res.status(400).json({ message: 'Internship ID required' });

        const user = await User.findById(req.user.id);
        if (!user.savedInternships) user.savedInternships = [];
        
        const idStr = String(internshipId);
        const index = user.savedInternships.findIndex(id => String(id) === idStr);

        if (index > -1) {
            user.savedInternships.splice(index, 1);
            await user.save();
            return res.json({ message: 'Removed from saved items', savedIds: user.savedInternships });
        } else {
            user.savedInternships.push(internshipId);
            await user.save();
            return res.json({ message: 'Saved successfully', savedIds: user.savedInternships });
        }
    } catch (err) {
        console.error("❌ Save Toggle Error Details:", {
            userId: req.user?.id,
            internshipId: req.body?.internshipId,
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: `Failed to toggle save: ${err.message}` });
    }
});

// 📋 Fetch Saved Internships
router.get('/saved-internships', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;
    try {
        const user = await User.findById(req.user.id).populate('savedInternships');
        res.json(user.savedInternships || []);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch saved items.' });
    }
});

module.exports = router;

async function notifyDepartmentHodForVerification(req, studentUser, departmentDoc) {
    if (!departmentDoc) return;

    const hodId = String(departmentDoc.headId || departmentDoc.head || '').trim();
    if (!hodId) return;

    const sourceKey = `student-verification:${studentUser._id}:${departmentDoc._id}`;
    const notification = await Notification.findOneAndUpdate(
        { userId: hodId, sourceKey },
        {
            $setOnInsert: {
                userId: hodId,
                title: 'Student Verification Request',
                message: `${studentUser.fullName || studentUser.name || 'A student'} completed their profile and is waiting for your verification.`,
                type: 'info',
                targetRoute: '/hod/dashboard',
                category: 'general',
                sourceKey,
                isRead: false,
                createdAt: new Date()
            }
        },
        { upsert: true, returnDocument: 'after' }
    );

    await emitNotification(req, notification?.toObject ? notification.toObject() : notification);
}

function calculateProfileStrength({ user, profile }) {
    const checks = [
        profile?.profilePicUrl,
        user?.name || user?.fullName,
        user?.email,
        user?.phone,
        user?.college,
        user?.department,
        profile?.resumeUrl,
        profile?.skills_description,
        profile?.academicInfo?.skills?.length,
        profile?.personalInfo?.bio
    ];

    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
}

router.get('/dashboard', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const user = await User.findById(req.user.id).lean();
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    return res.json({
        message: 'Student dashboard access granted.',
        student: {
            id: user._id,
            name: user.name || user.fullName,
            email: user.email,
            role: 'student'
        }
    });
});

router.get('/profile', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const user = await User.findById(req.user.id).lean();
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    const profile = await Profile.findOne({ userId: req.user.id }).lean();
    const profileStrength = profile?.profileStrength ?? calculateProfileStrength({ user, profile });

    return res.json({
        profile: {
            fullName: user.fullName || user.name || '',
            name: user.name || user.fullName || '',
            email: user.email || '',
            profilePicUrl: user.profileImage || profile?.profilePicUrl || '',
            phone: user.phone || profile?.personalInfo?.phone || '',
            college: user.college || '',
            collegeId: user.collegeId || null,
            department: user.department || profile?.personalInfo?.department || '',
            departmentId: user.departmentId || null,
            isVerified: Boolean(user.isVerified),
            verificationStatus: user.verificationStatus || (user.isVerified ? 'Verified' : 'Not Submitted'),
            verificationRequestedAt: user.verificationRequestedAt || null,
            verificationReviewedAt: user.verificationReviewedAt || null,
            verificationNote: user.verificationNote || '',
            rejectionReason: user.rejectionReason || '',
            rejection_reason: user.rejection_reason || user.rejectionReason || '',
            yearOfStudy: profile?.personalInfo?.yearOfStudy || '',
            bio: profile?.personalInfo?.bio || user.bio || '',
            skills_description: profile?.skills_description || '',
            gpa: profile?.academicInfo?.gpa ?? '',
            skills: profile?.academicInfo?.skills || [],
            courses: profile?.academicInfo?.courses || [],
            resumeUrl: profile?.resumeUrl || '',
            portfolioLinks: profile?.portfolioLinks || { github: '', linkedin: '', website: '' },
            idNumber: user.studentIdNumber || user.idNumber || user.id_number || '',
            studentSignatureUrl: user.studentSignatureUrl || '',
            studentSignature: user.studentSignature || user.studentSignatureUrl || user.student_signature || '',
            student_signature: user.student_signature || user.studentSignature || user.studentSignatureUrl || '',
            signatureData: user.signatureData || user.signature_data || user.studentSignatureUrl || '',
            signature_data: user.signature_data || user.signatureData || user.studentSignatureUrl || '',
            profileStrength
        }
    });
});

router.put('/profile', auth, resumeUpload.single('resumeFile'), async (req, res) => {
    if (!ensureStudent(req, res)) return;

    const {
        fullName,
        phone,
        college,
        collegeId,
        department,
        departmentId,
        yearOfStudy,
        bio,
        skills_description,
        profilePicUrl,
        gpa,
        skills,
        skillEntries,
        courses,
        resumeUrl,
        portfolioLinks,
        idNumber,
        studentIdNumber,
        signatureDataUrl,
        signatureUrl
    } = req.body || {};

    let finalResumeUrl = resumeUrl;
    // Handle resume file from Cloudinary
    if (req.file) {
        finalResumeUrl = req.file.path; // Cloudinary secure_url
    }

    let finalSignatureUrl = undefined;
    let signatureDataValue = undefined;

    // Handle signature upload - can be file or base64 data URL
    if (signatureDataUrl && String(signatureDataUrl).trim().startsWith('data:')) {
        // Upload base64 signature to Cloudinary
        const uploadedUrl = await uploadSignatureToCloudinary(signatureDataUrl, req.user.id);
        if (!uploadedUrl) {
            return res.status(400).json({ message: 'Invalid signature data provided.' });
        }
        finalSignatureUrl = uploadedUrl;
        signatureDataValue = uploadedUrl;
    } else if (signatureDataUrl) {
        finalSignatureUrl = String(signatureDataUrl).trim();
        signatureDataValue = finalSignatureUrl;
    } else if (signatureUrl) {
        finalSignatureUrl = String(signatureUrl).trim();
        signatureDataValue = finalSignatureUrl;
    }

    const user = await User.findById(req.user.id);
    if (!user) {
        return res.status(404).json({ message: 'Student account not found.' });
    }

    const shouldRefreshPendingMatches = String(req.query?.refreshPendingMatchScores || process.env.REFRESH_PENDING_MATCH_SCORES || '0') === '1';

    const currentSelection = {
        collegeId: user.collegeId || null,
        departmentId: user.departmentId || null
    };

    const nextSelection = await resolveStudentSelection({
        collegeId,
        departmentId,
        collegeName: college,
        departmentName: department
    });

    const nextCollegeName = nextSelection.college?.name || canonicalizeAcademicName(college);
    const nextDepartmentName = nextSelection.department?.name || canonicalizeAcademicName(department);
    const selectionChanged = String(currentSelection.collegeId || '') !== String(nextSelection.college?._id || collegeId || '')
        || String(currentSelection.departmentId || '') !== String(nextSelection.department?._id || departmentId || '');
    const hasSelection = Boolean(nextSelection.college?._id && nextSelection.department?._id);

    if (fullName) {
        user.fullName = String(fullName).trim();
        user.name = String(fullName).trim();
    }
    if (typeof phone !== 'undefined') user.phone = String(phone || '').trim();
    if (typeof college !== 'undefined' || typeof collegeId !== 'undefined') {
        user.college = nextCollegeName;
        user.collegeId = nextSelection.college?._id || null;
    }
    if (typeof department !== 'undefined' || typeof departmentId !== 'undefined') {
        user.department = nextDepartmentName;
        user.departmentId = nextSelection.department?._id || null;
    }
    if (profilePicUrl) user.profileImage = String(profilePicUrl).trim();
    if (typeof idNumber !== 'undefined' || typeof studentIdNumber !== 'undefined') {
        const normalizedId = String(idNumber || studentIdNumber || '').trim();
        user.studentIdNumber = normalizedId;
        user.idNumber = normalizedId;
        user.id_number = normalizedId;
    }
    if (typeof bio !== 'undefined') {
        user.bio = String(bio || '').trim();
    }
    if (typeof skills_description !== 'undefined') {
        user.skills_description = String(skills_description || '').trim();
    }
    if (typeof finalSignatureUrl !== 'undefined') {
        const normalizedSignature = String(finalSignatureUrl || '').trim();
        user.studentSignatureUrl = normalizedSignature;
        user.studentSignature = normalizedSignature;
        user.student_signature = normalizedSignature;
        user.signatureData = String(signatureDataValue || normalizedSignature).trim();
        user.signature_data = String(signatureDataValue || normalizedSignature).trim();
    }

    const hasSkillEntriesInput = typeof skillEntries !== 'undefined';
    const hasSkillsInput = typeof skills !== 'undefined';
    const parsedSkillEntries = hasSkillEntriesInput ? normalizeSkillEntries(parseJsonField(skillEntries, []), skills) : [];
    const normalizedSkills = hasSkillsInput
        ? (Array.isArray(skills) ? skills.filter(Boolean).map((s) => String(s).trim()) : (typeof skills === 'string' ? skills.split(',').map((s) => s.trim()).filter(Boolean) : []))
        : null;

    if (hasSelection) {
        if (selectionChanged || String(user.verificationStatus || '') !== 'Verified') {
            user.isVerified = false;
            user.verificationStatus = 'Submitted';
            user.verificationRequestedAt = new Date();
            user.verificationReviewedAt = null;
            user.verificationReviewedBy = null;
            user.verificationNote = '';
            user.rejectionReason = '';
        }
    } else {
        user.isVerified = false;
        user.verificationStatus = 'Not Submitted';
        user.verificationRequestedAt = null;
        user.verificationReviewedAt = null;
        user.verificationReviewedBy = null;
        user.verificationNote = '';
        user.rejectionReason = '';
    }

    await user.save();

    const skillsTouched = hasSkillsInput || hasSkillEntriesInput || (typeof skills_description !== 'undefined');

    const profile = await Profile.findOneAndUpdate(
        { userId: req.user.id },
        {
            $set: {
                profilePicUrl: String(profilePicUrl || '').trim(),
                'personalInfo.department': hasSelection ? nextDepartmentName : String(department || '').trim(),
                'personalInfo.college': hasSelection ? nextCollegeName : String(college || '').trim(),
                'personalInfo.yearOfStudy': String(yearOfStudy || '').trim(),
                'personalInfo.phone': String(phone || '').trim(),
                'personalInfo.bio': String(bio || '').trim(),
                'academicInfo.gpa': gpa === '' || gpa === null || typeof gpa === 'undefined' ? null : Number(gpa),
                ...(typeof skills_description !== 'undefined' ? { skills_description: String(skills_description || '').trim() } : {}),
                ...(hasSkillEntriesInput ? { 'academicInfo.skillEntries': parsedSkillEntries } : {}),
                ...(hasSkillsInput ? {
                    'academicInfo.skills': parsedSkillEntries.length > 0
                        ? parsedSkillEntries.map((entry) => entry.skill)
                        : normalizedSkills
                } : {}),
                'academicInfo.courses': Array.isArray(courses) ? courses.filter(Boolean).map((c) => String(c).trim()) : [],
                resumeUrl: String(finalResumeUrl || '').trim(),
                portfolioLinks: {
                    github: String(portfolioLinks?.github || '').trim(),
                    linkedin: String(portfolioLinks?.linkedin || '').trim(),
                    website: String(portfolioLinks?.website || '').trim()
                }
            }
        },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
    );

    profile.profileStrength = calculateProfileStrength({ user, profile });
    await profile.save();

    if (hasSelection) {
        await notifyDepartmentHodForVerification(req, user, nextSelection.department);
    }

    const payload = {
        message: 'Profile updated successfully.',
        profile: {
            fullName: user.fullName || user.name || '',
            name: user.name || user.fullName || '',
            email: user.email || '',
            profilePicUrl: profile?.profilePicUrl || '',
            phone: user.phone || '',
            college: user.college || '',
            collegeId: user.collegeId || null,
            department: user.department || '',
            departmentId: user.departmentId || null,
            isVerified: Boolean(user.isVerified),
            verificationStatus: user.verificationStatus || (user.isVerified ? 'Verified' : 'Not Submitted'),
            verificationRequestedAt: user.verificationRequestedAt || null,
            verificationReviewedAt: user.verificationReviewedAt || null,
            verificationNote: user.verificationNote || '',
            rejectionReason: user.rejectionReason || '',
            yearOfStudy: profile?.personalInfo?.yearOfStudy || '',
            bio: profile?.personalInfo?.bio || '',
            skills_description: profile?.skills_description || '',
            gpa: profile?.academicInfo?.gpa ?? '',
            skills: profile?.academicInfo?.skills || [],
            skillEntries: profile?.academicInfo?.skillEntries || [],
            courses: profile?.academicInfo?.courses || [],
            resumeUrl: profile?.resumeUrl || '',
            portfolioLinks: profile?.portfolioLinks || { github: '', linkedin: '', website: '' },
            idNumber: user.studentIdNumber || '',
            studentSignatureUrl: user.studentSignatureUrl || '',
            studentSignature: user.studentSignature || user.studentSignatureUrl || user.student_signature || '',
            student_signature: user.student_signature || user.studentSignature || user.studentSignatureUrl || '',
            profileStrength: profile.profileStrength || 0
        }
    };

    res.json(payload);

    // Optional: if enabled, refresh match scores for *pending* applications after skills/profile updates.
    // Note: this breaks "frozen at apply-time" behavior, but matches the user's request for real-time consistency.
    if (shouldRefreshPendingMatches && skillsTouched) {
        setImmediate(() => {
            refreshStudentPendingApplicationMatchScores(req.user.id).catch(() => { });
        });
    }
});

// 💾 Save/Toggle Internship

router.get('/structure', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    try {
        const [colleges, departments] = await Promise.all([
            College.find().select('_id name').sort({ name: 1 }).lean(),
            Department.find().select('_id name college collegeId head headId').sort({ name: 1 }).lean()
        ]);

        const departmentsByCollege = departments.reduce((accumulator, department) => {
            const key = String(department.collegeId || department.college || '');
            if (!key) return accumulator;
            if (!accumulator[key]) accumulator[key] = [];
            accumulator[key].push(department);
            return accumulator;
        }, {});

        return res.json({
            colleges: colleges.map((college) => ({
                ...college,
                departments: departmentsByCollege[String(college._id)] || []
            }))
        });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load university structure.' });
    }
});

router.get('/structure/suggestions', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;

    try {
        const field = String(req.query.field || 'department').toLowerCase();
        const query = canonicalizeAcademicName(req.query.q || '');

        if (!query) {
            return res.json({ suggestions: [] });
        }

        if (field === 'college') {
            const colleges = await College.find().select('_id name').sort({ name: 1 }).lean();
            return res.json({
                suggestions: buildAcademicSuggestionList(query, colleges, 3).map((item) => ({
                    id: String(item.candidate?._id || ''),
                    name: item.name,
                    score: item.score
                }))
            });
        }

        const departments = await Department.find().select('_id name college collegeId').sort({ name: 1 }).lean();
        return res.json({
            suggestions: buildAcademicSuggestionList(query, departments, 3).map((item) => ({
                id: String(item.candidate?._id || ''),
                name: item.name,
                score: item.score
            }))
        });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load academic suggestions.' });
    }
});

router.post('/saved-internships', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;
    try {
        const studentId = req.user.id;
        const { internshipId } = req.body;
        if (!internshipId) return res.status(400).json({ message: 'Internship ID required' });

            const internship = await Internship.findById(internshipId).select('_id');
        if (!internship) return res.status(404).json({ message: 'Internship not found.' });

        const [existingSaved, user] = await Promise.all([
            SavedInternship.findOne({ studentId, internshipId }),
            User.findById(studentId)
        ]);

        const savedFromUser = Array.isArray(user?.savedInternships)
            ? user.savedInternships.map((id) => String(id))
            : [];
        const wasSaved = Boolean(existingSaved) || savedFromUser.includes(String(internshipId));

        if (wasSaved) {
            if (existingSaved) {
                await existingSaved.deleteOne();
            }
            if (user) {
                user.savedInternships = (user.savedInternships || [])
                    .filter((id) => String(id) !== String(internshipId));
                await user.save();
            }

            const savedDocs = await SavedInternship.find({ studentId }).select('internshipId').lean();
            const savedIds = [...new Set([
                ...savedDocs.map((doc) => String(doc.internshipId)),
                ...savedFromUser.filter((id) => String(id) !== String(internshipId))
            ])];

            return res.json({
                message: 'Removed from saved items',
                savedIds
            });
        }

        await SavedInternship.create({ studentId, internshipId });
        if (user) {
            user.savedInternships = Array.from(new Set([...(user.savedInternships || []).map(String), String(internshipId)]));
            await user.save();
        }

        const savedDocs = await SavedInternship.find({ studentId }).select('internshipId').lean();
        const savedIds = Array.from(new Set([
            ...savedDocs.map((doc) => String(doc.internshipId)),
            ...savedFromUser
        ]));

        return res.json({
            message: 'Saved successfully',
            savedIds
        });
    } catch (err) {
        console.error("❌ Save Toggle Error Details:", {
            userId: req.user?.id,
            internshipId: req.body?.internshipId,
            error: err.message,
            stack: err.stack
        });
        res.status(500).json({ message: `Failed to toggle save: ${err.message}` });
    }
});

// 🚀 Aggregate Dashboard Summary (Fast Loading)
router.get('/dashboard-summary', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can access this endpoint.' });
        }

        const studentId = req.user.id;
        const MatchCache = require('../models/MatchCache');
        const { syncStudentMatches } = require('../utils/internshipMatching');
        
        const cacheCount = await MatchCache.countDocuments({ studentId });
        if (cacheCount === 0) {
            await syncStudentMatches(studentId);
        }

        const [totalInternships, totalApplications, totalAccepted, totalRejected, savedDocs, user, topMatches, recentInternships] = await Promise.all([
            Internship.countDocuments({ status: { $regex: /^open$/i } }),
            Application.countDocuments({ studentId }),
            Application.countDocuments({ studentId, status: { $regex: /^placed$/i } }),
            Application.countDocuments({ studentId, status: { $regex: /^rejected$/i } }),
            SavedInternship.find({ studentId }).select('internshipId').lean(),
            User.findById(studentId).select('savedInternships').lean(),
            MatchCache.find({ studentId, score: { $gt: 50 }, departmentMatched: true })
                .sort({ score: -1 })
                .limit(4)
                .populate({ path: 'internshipId', populate: { path: 'companyId', select: 'name fullName profileImage status' } })
                .lean(),
            Internship.find({ status: { $regex: /^open$/i } })
                .sort({ createdAt: -1 })
                .limit(10)
                .populate('companyId', 'name fullName profileImage')
                .lean()
        ]);

        const newSavedIds = new Set(savedDocs.map((doc) => String(doc.internshipId)));
        const legacySavedIds = Array.isArray(user?.savedInternships) ? user.savedInternships.map(String) : [];
        legacySavedIds.forEach((id) => newSavedIds.add(id));

        const recommended = topMatches.map(m => {
            const intern = m.internshipId || {};
            const comp = intern.companyId || {};
            return {
                ...intern,
                matchScore: m.score,
                company_name: String(comp.name || comp.fullName || ''),
                company_logo_url: String(comp.profileImage || '')
            };
        });

        const recent = recentInternships.map(intern => {
            const comp = intern.companyId || {};
            return {
                ...intern,
                company_name: String(comp.name || comp.fullName || ''),
                company_logo_url: String(comp.profileImage || '')
            };
        });

        res.json({
            stats: {
                totalInternships,
                totalApplications,
                totalAccepted,
                totalRejected,
                totalSaved: newSavedIds.size
            },
            recommended,
            allInternships: recent
        });

    } catch (err) {
        console.error('Dashboard summary error:', err.message);
        res.status(500).json({ message: 'Failed to fetch dashboard summary.' });
    }
});

router.get('/stats', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can access this endpoint.' });
        }

        const studentId = req.user.id;
        const [totalInternships, totalApplications, totalAccepted, totalRejected, savedDocs, user] = await Promise.all([
            Internship.countDocuments({ status: { $regex: /^open$/i } }),
            Application.countDocuments({ studentId }),
            Application.countDocuments({ studentId, status: { $regex: /^placed$/i } }),
            Application.countDocuments({ studentId, status: { $regex: /^rejected$/i } }),
            SavedInternship.find({ studentId }).select('internshipId').lean(),
            User.findById(studentId).select('savedInternships').lean()
        ]);

        const newSavedIds = new Set(savedDocs.map((doc) => String(doc.internshipId)));
        const legacySavedIds = Array.isArray(user?.savedInternships) ? user.savedInternships.map(String) : [];
        legacySavedIds.forEach((id) => newSavedIds.add(id));

        res.json({
            totalInternships,
            totalApplications,
            totalAccepted,
            totalRejected,
            totalSaved: newSavedIds.size
        });
    } catch (err) {
        console.error('Student stats error:', err.message);
        res.status(500).json({ message: 'Failed to fetch student stats.' });
    }
});
// �📋 Fetch Saved Internships
router.get('/saved-internships', auth, async (req, res) => {
    if (!ensureStudent(req, res)) return;
    try {
        const studentId = req.user.id;
        const [savedDocs, user] = await Promise.all([
            SavedInternship.find({ studentId }).populate('internshipId').lean(),
            User.findById(studentId).select('savedInternships').lean()
        ]);

        const savedItemsFromNew = savedDocs
            .map((doc) => doc.internshipId)
            .filter(Boolean);

        const newIds = new Set(savedItemsFromNew.map((item) => String(item._id)));
        const legacyIds = Array.isArray(user?.savedInternships) ? user.savedInternships.map(String) : [];
        const legacyOnlyIds = legacyIds.filter((id) => !newIds.has(id));

        let legacyItems = [];
        if (legacyOnlyIds.length) {
            legacyItems = await Internship.find({ _id: { $in: legacyOnlyIds } }).lean();
        }

        res.json([...savedItemsFromNew, ...legacyItems]);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch saved items.' });
    }
});

module.exports = router;
