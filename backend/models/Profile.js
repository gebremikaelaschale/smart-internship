const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    personalInfo: {
        department: String,
        yearOfStudy: String,
        phone: String,
        address: String,
        bio: String
    },
    academicInfo: {
        gpa: Number,
        skills: [String],
        courses: [String]
    },
    profilePicUrl: String,
    resumeUrl: String, // PDF upload link
    portfolioLinks: {
        github: String,
        linkedin: String,
        website: String
    },
    profileStrength: { type: Number, default: 0 } // 0 to 100% indicator
}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);