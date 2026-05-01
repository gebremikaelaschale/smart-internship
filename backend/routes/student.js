const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const Profile = require('../models/Profile');

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
