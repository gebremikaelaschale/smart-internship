const express = require('express');
const router = express.Router();
const College = require('../models/College');
const Department = require('../models/Department');
const User = require('../models/User');

// GET /api/landing/stats — Public endpoint, no auth required
router.get('/stats', async (req, res) => {
    try {
        const [totalColleges, totalDepartments, totalIndustryPartners, totalStudents] = await Promise.all([
            College.countDocuments(),
            Department.countDocuments(),
            User.countDocuments({
                role: { $in: ['employer', 'Industry Partner'] },
                $or: [
                    { isVerified: true },
                    { verificationStatus: 'Verified' }
                ]
            }),
            User.countDocuments({ role: { $in: ['student', 'Student'] } })
        ]);

        res.json({
            success: true,
            data: {
                totalColleges,
                totalDepartments,
                totalIndustryPartners,
                totalStudents,
                // Backward compatible aliases for older frontend consumers.
                totalEmployers: totalIndustryPartners,
                totalStudentsPlaced: totalStudents
            }
        });
    } catch (error) {
        console.error('Error fetching landing stats:', error);
        res.status(500).json({ success: false, message: 'Server error fetching stats' });
    }
});

module.exports = router;
