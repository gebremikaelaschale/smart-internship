const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true, unique: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    evaluationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Evaluation', default: null },
    verificationStatus: {
        type: String,
        enum: ['Pending', 'Verified', 'Rejected'],
        default: 'Pending'
    },
    verificationNote: { type: String, default: '' },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
    issued: { type: Boolean, default: false },
    issuedAt: { type: Date, default: null },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    certificateNumber: { type: String, default: '' }
}, { timestamps: true });

CertificateSchema.index({ studentId: 1, internshipId: 1 });

module.exports = mongoose.model('Certificate', CertificateSchema);
