const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const audit = require('../middleware/auditMiddleware');
const Profile = require('../models/Profile');
const User = require('../models/User');

// Calculate Profile Strength Helper
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
router.post('/', auth, async (req, res) => {
    try {
        const payload = req.body;
        const computedScore = calculateStrength(payload);
        const updateData = { ...payload, profileStrength: computedScore, updatedAt: Date.now() };

        let profile = await Profile.findOneAndUpdate(
            { userId: req.user.id },
            { $set: updateData },
            { returnDocument: 'after', upsert: true }
        );

        if (req.body.fullName) await User.findByIdAndUpdate(req.user.id, { fullName: req.body.fullName });
        if (req.body.email) await User.findByIdAndUpdate(req.user.id, { email: req.body.email });

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
        const { fullName, email, phone, language, timezone, notificationSettings, privacySettings, integrations, uxPreferences, securitySettings } = req.body;
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { fullName, email, phone, language, timezone, notificationSettings, privacySettings, integrations, uxPreferences, securitySettings } },
            { returnDocument: 'after' }
        ).select('-password');
        res.json(user);
    } catch (err) { res.status(500).send("Account update failed."); }
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