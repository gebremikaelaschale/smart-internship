const mongoose = require('mongoose');

const InternshipSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The Industry Partner
    programType: { type: String, default: 'Internship Program' },
    trainingFocus: { type: Boolean, default: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String }, // e.g., Remote, Addis Ababa
    duration: { type: String }, // e.g., 3 months
    startDate: { type: Date },
    endDate: { type: Date },
    studentsNeeded: { type: Number, min: 1 },
    isPaid: { type: Boolean, default: false },
    stipend: { type: String },
    requirements: [String],
    requiredSkills: [String],
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Open', 'Closed'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Internship', InternshipSchema);