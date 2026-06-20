const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The person evaluating
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    hodId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    evaluationStatus: { type: String, enum: ['Pending', 'Submitted', 'Completed'], default: 'Pending' },
    type: { type: String, enum: ['Supervisor', 'Self'], required: true },
    performanceRating: { type: Number, min: 1, max: 5 }, // 1 to 5 stars
    score: { type: Number, min: 0, max: 100 },
    comments: { type: String },
    acceptanceForm: {
        companyName: { type: String, default: '' },
        placeTown: { type: String, default: '' },
        contactPerson: { type: String, default: '' },
        companyPhone: { type: String, default: '' },
        companyEmail: { type: String, default: '' },
        representativeName: { type: String, default: '' },
        representativeSignature: { type: String, default: '' },
        representativeDate: { type: String, default: '' }
    },
    criteriaScores: { type: mongoose.Schema.Types.Mixed, default: {} },
    supervisorName: { type: String, default: '' },
    officialPdf: {
        data: Buffer,
        contentType: { type: String, default: '' },
        fileName: { type: String, default: '' },
        uploadedAt: { type: Date, default: null }
    },
    dateEvaluated: { type: Date, default: Date.now },
    is_submitted: { type: Boolean, default: false }
}, { timestamps: true });

// Ensure a single evaluation per student+company (upsert key)
EvaluationSchema.index({ studentId: 1, companyId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
