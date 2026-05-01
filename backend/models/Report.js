const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    weekNumber: { type: Number },
    startDate: { type: Date },
    endDate: { type: Date },
    hoursWorked: { type: Number },
    type: { type: String, enum: ['Weekly', 'Final'], required: true },
    summary: { type: String, required: true },
    title: { type: String, default: '' }, // Short title for the entry
    fileUrl: { type: String }, // Primary attachment URL
    attachments: [{ name: String, url: String }], // Multi-file support
    dailyBreakdown: [
        { day: { type: String }, activity: { type: String } }
    ],
    skills: [String],
    mentorshipRequested: { type: Boolean, default: false },
    aiInsights: { type: String },
    goals: [
        { text: { type: String }, completed: { type: Boolean, default: false } }
    ],
    performanceScores: {
        technical: { type: Number, default: 0 },
        communication: { type: Number, default: 0 },
        teamwork: { type: Number, default: 0 }
    },
    auditTrail: {
        ipAddress: { type: String },
        location: { type: String },
        verified: { type: Boolean, default: true }
    },
    companyStatus: { type: String, enum: ['Pending', 'Approved', 'Needs Revision', 'Declined'], default: 'Pending' },
    companyFeedback: { type: String },
    universityStatus: { type: String, enum: ['Pending', 'Approved', 'Needs Revision', 'Declined'], default: 'Pending' },
    universityFeedback: { type: String },
    status: { type: String, enum: ['Draft', 'Submitted', 'Needs Revision', 'Approved by Company', 'Approved by University', 'Declined'], default: 'Submitted' }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);