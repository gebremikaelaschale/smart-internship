const mongoose = require('mongoose');

const savedInternshipSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  internshipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Internship',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

savedInternshipSchema.index({ studentId: 1, internshipId: 1 }, { unique: true });

module.exports = mongoose.model('SavedInternship', savedInternshipSchema);
