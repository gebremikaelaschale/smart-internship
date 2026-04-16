const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Profile = require('../models/Profile');
const Internship = require('../models/Internship');
const natural = require('natural');

router.get('/:internshipId', auth, async (req, res) => {
    try {
        const profile = await Profile.findOne({ user: req.user.id });
        const internship = await Internship.findById(req.params.internshipId);
        
        if (!profile || !internship) return res.status(404).json({ msg: "Data mismatch. Profile or Internship not found." });

        const studentSkills = profile.skills.map(s => s.toLowerCase().trim());
        const requiredSkills = internship.requiredSkills.map(s => s.toLowerCase().trim());

        // NLP Matching Logic (Jaro-Winkler Similarity)
        let matchedCount = 0;
        requiredSkills.forEach(reqS => {
            studentSkills.forEach(stuS => {
                if (natural.JaroWinklerDistance(reqS, stuS) > 0.85) matchedCount++;
            });
        });

        const score = Math.round((matchedCount / requiredSkills.length) * 100);
        res.json({ matchPercentage: (score > 100 ? 100 : score) + "%" });
    } catch (err) { res.status(500).send("AI Engine Error."); }
});

module.exports = router;