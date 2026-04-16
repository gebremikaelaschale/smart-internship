const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentId: { type: String, required: true, unique: true, trim: true },
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        department: { type: String, required: true, trim: true },
        college: { type: String, required: true, trim: true },
        lastLoginAt: { type: Date, default: null }
    },
    { timestamps: true }
);

module.exports = mongoose.model('Student', studentSchema);
