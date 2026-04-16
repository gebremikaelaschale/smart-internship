const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema({
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    supervisorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The person evaluating
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    type: { type: String, enum: ['Supervisor', 'Self'], required: true },
    performanceRating: { type: Number, min: 1, max: 5 }, // 1 to 5 stars
    score: { type: Number, min: 0, max: 100 },
    comments: { type: String },
    dateEvaluated: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
