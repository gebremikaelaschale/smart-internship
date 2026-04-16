const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    weekNumber: { type: Number },
    type: { type: String, enum: ['Weekly', 'Final'], required: true },
    summary: { type: String, required: true },
    fileUrl: { type: String }, // Uploaded PDF/Doc
    supervisorFeedback: { type: String },
    status: { type: String, enum: ['Submitted', 'Reviewed', 'Revisions Requested'], default: 'Submitted' }
}, { timestamps: true });

module.exports = mongoose.model('Report', ReportSchema);