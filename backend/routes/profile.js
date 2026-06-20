const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');
const Profile = require('../models/Profile');
const User = require('../models/User');
const { emitHodDashboardRefresh } = require('../utils/hodDashboardSync');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure Multer for student resumes
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
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed for resumes.'));
        }
    }
});

// ─── Profile Photo Upload ────────────────────────────────────────────────────
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/profile-photos');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const userId = req.user?.id || 'user';
        cb(null, `profile-${userId}-${Date.now()}${path.extname(file.originalname)}`);
    }
});

const photoUpload = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed.'));
    }
});

// POST /profile/upload-photo — save photo file to Cloudinary, store URL in user record
router.post('/upload-photo', auth, photoUpload.single('photo'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
        // req.file.path is the Cloudinary secure_url
        const photoUrl = req.file.path;
        
        await User.findByIdAndUpdate(
            req.user.id, 
            { $set: { profileImage: photoUrl } },
            { new: true }
        );
        
        res.json({ url: photoUrl });
    } catch (err) {
        console.error('Photo upload error:', err);
        res.status(500).json({ message: 'Photo upload failed.', error: err.message });
    }
});


const calculateStrength = (data) => {
    let score = 0;
    // Picture: 10%
    if (data.profilePicUrl && data.profilePicUrl.trim().length > 0) score += 10;

    // Bio: 10%
    if (data.personalInfo?.bio && data.personalInfo.bio.trim().length > 0) score += 10;

    // Contacts: 20% (Phone: 10%, Website: 10%)
    if (data.personalInfo?.phone && data.personalInfo.phone.trim().length > 0) score += 10;
    if (data.portfolioLinks?.website && data.portfolioLinks.website.trim().length > 0) score += 10;

    // Academic: 20% (GPA: 10%, Courses: 10%)
    if (data.academicInfo?.gpa) score += 10;
    if (data.academicInfo?.courses && data.academicInfo.courses.length > 0) score += 10;

    // Skills: 20%
    if (data.academicInfo?.skills && data.academicInfo.skills.length > 0) score += 20;

    // Projects/Links: 20% (Github: 10%, Linkedin: 10%)
    if (data.portfolioLinks?.github && data.portfolioLinks.github.trim().length > 0) score += 10;
    if (data.portfolioLinks?.linkedin && data.portfolioLinks.linkedin.trim().length > 0) score += 10;

    return score;
};

// 1. Full Data Sync (Identity Matrix)
router.post('/', auth, resumeUpload.single('resumeFile'), async (req, res) => {
    try {
        let payload = { ...req.body };

        // Handle nested objects if they are sent as strings from FormData
        try {
            if (typeof payload.personalInfo === 'string') payload.personalInfo = JSON.parse(payload.personalInfo);
            if (typeof payload.academicInfo === 'string') payload.academicInfo = JSON.parse(payload.academicInfo);
            if (typeof payload.portfolioLinks === 'string') payload.portfolioLinks = JSON.parse(payload.portfolioLinks);
        } catch (e) {
            // If parsing fails, it's likely flat fields from FormData
        }

        // Map flat fields from FormData to structured objects if they exist
        if (payload.fullName || payload.phone || payload.department || payload.bio || payload.yearOfStudy) {
            payload.personalInfo = {
                ...(payload.personalInfo || {}),
                fullName: payload.fullName || payload.personalInfo?.fullName,
                phone: payload.phone || payload.personalInfo?.phone,
                department: payload.department || payload.personalInfo?.department,
                bio: payload.bio || payload.personalInfo?.bio,
                yearOfStudy: payload.yearOfStudy || payload.personalInfo?.yearOfStudy
            };
        }

        if (payload.skills || payload.gpa) {
            payload.academicInfo = {
                ...(payload.academicInfo || {}),
                skills: payload.skills ? (typeof payload.skills === 'string' ? payload.skills.split(',').map(s => s.trim()) : payload.skills) : payload.academicInfo?.skills,
                gpa: payload.gpa || payload.academicInfo?.gpa
            };
        }

        if (req.file) {
            payload.resumeUrl = `/uploads/resumes/${req.file.filename}`;
        }

        // FILTER: If the resumeUrl is a known placeholder, clear it
        if (payload.resumeUrl && (payload.resumeUrl.includes('chatgpt.com') || payload.resumeUrl.includes('openai.com'))) {
            payload.resumeUrl = '';
        }

        const computedScore = calculateStrength(payload);
        const updateData = { ...payload, profileStrength: computedScore, updatedAt: Date.now() };

        let profile = await Profile.findOneAndUpdate(
            { userId: req.user.id },
            { $set: updateData },
            { returnDocument: 'after', upsert: true }
        );

        if (req.body.fullName) await User.findByIdAndUpdate(req.user.id, { fullName: req.body.fullName });
        if (req.body.email) await User.findByIdAndUpdate(req.user.id, { email: req.body.email });

        emitHodDashboardRefresh(req, { reason: 'profile-updated', userId: String(req.user.id || '') });

        res.json({ profile, score: computedScore, user: { fullName: req.body.fullName, email: req.body.email } });
    } catch (err) {
        console.error(err);
        res.status(500).send("Profile synchronization failed.");
    }
});

// 2. Fetch Identity
router.get('/me', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ userId: req.user.id })
            .populate('userId', ['fullName', 'email', 'role']);
        if (!profile) return res.json(null);

        // Ensure strength is calculated dynamically if missing
        const computedScore = calculateStrength(profile);
        res.json({ ...profile.toObject(), profileStrength: computedScore });
    } catch (err) { res.status(500).send("Fetch error."); }
});

// 3. User Account Matrix Update
router.put('/update-user', auth, audit('Security: Profile Update Handshake'), async (req, res) => {
    try {
        const { fullName, email, phone, department, jobTitle, language, timezone, notificationSettings, privacySettings, integrations, uxPreferences, securitySettings, profileImage } = req.body;
        const updateFields = { fullName, email, phone, department, jobTitle, language, timezone, notificationSettings, privacySettings, integrations, uxPreferences, securitySettings };
        if (profileImage !== undefined) updateFields.profileImage = profileImage;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: updateFields },
            { new: true }
        ).select('-password').lean();
        if (!user) return res.status(404).json({ message: 'User not found.' });

        emitHodDashboardRefresh(req, { reason: 'user-profile-updated', userId: String(req.user.id || '') });
        res.json(user);
    } catch (err) { res.status(500).json({ message: 'Account update failed.' }); }
});

// 4. Deactivate/Delete Account
router.delete('/delete-account', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, { accountStatus: 'Deactivated' });
        // In a real system, you'd perform a full cascade delete or flag for deletion
        res.json({ msg: "Account deactivated successfully." });
    } catch (err) { res.status(500).send("Operation failed."); }
});

// 5. Secure Password Rotation Handshake
router.put('/change-password', auth, audit('Security: Manual Password Mutation'), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const bcrypt = require('bcryptjs');
        const user = await User.findById(req.user.id).select('+password');

        if (!(await bcrypt.compare(currentPassword, user.password))) {
            return res.status(400).json({ msg: "Authentication failure: Current password incorrect." });
        }

        const salt = await bcrypt.genSalt(12);
        user.password = await bcrypt.hash(newPassword, salt);
        await user.save();

        res.json({ msg: "Security Matrix Updated: Password changed correctly." });
    } catch (err) { res.status(500).send("Security handshake failure."); }
});

// 6. Active Session Intelligence Matrix
router.get('/active-sessions', auth, async (req, res) => {
    try {
        const ActivityLog = require('../models/ActivityLog');
        const sessions = await ActivityLog.find({
            userId: req.user.id,
            action: 'Security: Nexus Login Handshake'
        })
            .sort({ timestamp: -1 })
            .limit(5);
        res.json(sessions);
    } catch (err) { res.status(500).send("Session retrieval failure."); }
});

module.exports = router;