const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    internshipId: { type: mongoose.Schema.Types.ObjectId, ref: 'Internship', required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resumeUrl: { type: String, required: false },
    coverLetter: { type: String },
    remarks: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    rejection_reason_by_company: { type: String, default: '' },
    rejectionVisibleTo: { type: String, enum: ['HOD', 'STUDENT', 'BOTH'], default: 'STUDENT' },
    status: { 
        type: String, 
        enum: ['Pending', 'Seen', 'Shortlisted', 'Interview', 'Accepted', 'Offered', 'Placed', 'PLACED', 'Rejected', 'Withdrawn', 'HOD_ASSIGNED'], 
        default: 'Pending' 
    },
    matchingScore: { type: Number, default: 0 }, // AI Internship Matching Score based on Skills & GPA
    // Backwards-compatible snake_case field used by some frontends / external integrations
    match_score: { type: Number, default: 0 },
    is_manual_assignment: { type: Boolean, default: false },
    source: { type: String, enum: ['student', 'hod'], default: 'student' },
    placement_source: { type: String, enum: ['STUDENT_APPLIED', 'HOD_ASSIGNED'], default: 'STUDENT_APPLIED' },
    hod_note: { type: String, default: '' },
    hod_assignment_note: { type: String, default: '' },
    placed_at: { type: Date },
    assignedBy: { type: String },
    timeline: [{
        status: String,
        date: { type: Date, default: Date.now },
        comment: String
    }]
}, { timestamps: true });

function coerceScore(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function getSyncedScore(matchingScore, match_score) {
    const camel = coerceScore(matchingScore);
    const snake = coerceScore(match_score);

    if (camel === null && snake === null) return 0;
    if (camel === null) return snake;
    if (snake === null) return camel;

    // Prefer the non-zero / higher value when one side is stale.
    return Math.max(camel, snake);
}

// Keep `matchingScore` and `match_score` in sync so every consumer can rely on either field.
ApplicationSchema.pre('save', function syncScoresOnSave() {
    const synced = getSyncedScore(this.matchingScore, this.match_score);
    this.matchingScore = synced;
    this.match_score = synced;
});

function syncScoresOnUpdate() {
    const update = this.getUpdate() || {};
    const set = update.$set || {};

    const synced = getSyncedScore(
        set.matchingScore ?? update.matchingScore,
        set.match_score ?? update.match_score
    );

    // Only write when a score is being touched by this update.
    const touched =
        'matchingScore' in set || 'match_score' in set ||
        'matchingScore' in update || 'match_score' in update;

    if (!touched) return;

    update.$set = { ...set, matchingScore: synced, match_score: synced };
    delete update.matchingScore;
    delete update.match_score;

    this.setUpdate(update);
}

ApplicationSchema.pre('findOneAndUpdate', syncScoresOnUpdate);
ApplicationSchema.pre('updateOne', syncScoresOnUpdate);
ApplicationSchema.pre('updateMany', syncScoresOnUpdate);

module.exports = mongoose.model('Application', ApplicationSchema);
