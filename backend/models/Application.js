const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    resumeUrl: { type: String, required: true },
    coverLetter: { type: String },
    remarks: { type: String, default: '' },
    status: { 
        type: String, 
        enum: ['Pending', 'Seen', 'Shortlisted', 'Interview', 'Accepted', 'Offered', 'Placed', 'Rejected', 'Withdrawn'], 
        default: 'Pending' 
    },
    matchingScore: { type: Number, default: 0 }, // AI Internship Matching Score based on Skills & GPA
    timeline: [{
        status: String,
        date: { type: Date, default: Date.now },
        comment: String
    }]
}, { timestamps: true });

module.exports = mongoose.model('Application', ApplicationSchema);