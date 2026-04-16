const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    type: { type: String, enum: ['Interview', 'Meeting', 'Deadline', 'Other'], required: true },
    eventDate: { type: Date, required: true },
    description: { type: String },
    relatedId: { type: mongoose.Schema.Types.ObjectId }, // Flexible ref, could be Internship, Application, etc.
    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' }
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
