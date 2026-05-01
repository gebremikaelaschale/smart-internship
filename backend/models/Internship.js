const mongoose = require('mongoose');

const InternshipSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // The Industry Partner
    programType: { type: String, default: 'Internship Program' },
    trainingFocus: { type: Boolean, default: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, default: 'Addis Ababa' },
    targetDepartments: [String],
    targetBatch: { type: String }, // e.g. 3rd Year, 4th Year, Graduating
    workModality: { type: String, enum: ['On-site', 'Remote', 'Hybrid'], default: 'On-site' },
    compensationType: { type: String, enum: ['Unpaid', 'Allowance', 'Paid'], default: 'Unpaid' },
    minCgpa: { type: Number, default: 0 },
    interviewRequired: { type: Boolean, default: false },
    studentsNeeded: { type: Number, min: 1 },
    isPaid: { type: Boolean, default: false },
    stipend: { type: String },
    requirements: [String],
    requiredSkills: [String],
    deadline: { type: Date, required: true },
    status: { type: String, enum: ['Pending', 'Open', 'Closed'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Internship', InternshipSchema);