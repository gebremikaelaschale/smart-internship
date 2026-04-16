const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');

// Calculate Profile Completeness Score
const calculateCompleteness = (data) => {
    let score = 0;
    if (data.logo) score += 10;
    if (data.coverImage) score += 10;
    if (data.description) score += 10;
    if (data.industryType) score += 10;
    if (data.hqLocation) score += 10;
    if (data.website) score += 10;
    if (data.officialEmail) score += 10;
    if (data.phone) score += 10;
    if (data.representative?.name) score += 10;
    if (data.verification?.status === 'Verified') score += 10;
    return score;
};

// 1. Get Employer Profile
router.get('/', auth, async (req, res) => {
    try {
        let profile = await CompanyProfile.findOne({ user: req.user.id });
        if (!profile) {
            const user = await User.findById(req.user.id).select('fullName name email').lean();
            const defaultCompanyName = String(user?.fullName || user?.name || 'Company').trim() || 'Company';
            profile = await CompanyProfile.create({
                user: req.user.id,
                companyName: defaultCompanyName,
                officialEmail: user?.email || '',
                profileCompleteness: calculateCompleteness({
                    companyName: defaultCompanyName,
                    officialEmail: user?.email || ''
                })
            });
        }
        res.json(profile);
    } catch (err) { res.status(500).send("Fetch error."); }
});

// 2. Sync / Update Profile
router.post('/', auth, async (req, res) => {
    try {
        const existingProfile = await CompanyProfile.findOne({ user: req.user.id }).lean();
        const mergedData = {
            ...(existingProfile || {}),
            ...req.body,
            user: req.user.id
        };

        const completeness = calculateCompleteness(mergedData);
        const updateData = { ...req.body, user: req.user.id, profileCompleteness: completeness, updatedAt: Date.now() };

        let profile = await CompanyProfile.findOneAndUpdate(
            { user: req.user.id },
            { $set: updateData },
            { returnDocument: 'after', upsert: true }
        );

        if (req.body.companyName) {
            const companyName = String(req.body.companyName || '').trim();
            if (companyName) {
                await User.findByIdAndUpdate(req.user.id, { fullName: companyName, name: companyName });
            }
        }

        res.json(profile);
    } catch (err) { 
        console.error(err);
        res.status(500).send("Sync failed."); 
    }
});

// 3. Public View (for Students)
router.get('/:id', async (req, res) => {
    try {
        const profile = await CompanyProfile.findById(req.params.id);
        res.json(profile);
    } catch (err) { res.status(500).send("Error fetching public profile."); }
});

module.exports = router;
