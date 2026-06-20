const Application = require('../models/Application');
const { getCalculatedMatch } = require('./internshipMatching');

const DEFAULT_PENDING_STATUSES = ['Pending', 'Seen', 'Shortlisted', 'Interview'];

function resolveScore(matchResult) {
    const value = Number(matchResult?.score);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

async function refreshStudentPendingApplicationMatchScores(studentId, options = {}) {
    const statuses = Array.isArray(options.statuses) && options.statuses.length
        ? options.statuses
        : DEFAULT_PENDING_STATUSES;

    if (!studentId) return { scanned: 0, updated: 0, failed: 0 };

    const apps = await Application.find({ studentId, status: { $in: statuses } })
        .select('_id internshipId')
        .lean();

    let updated = 0;
    let failed = 0;

    for (const app of apps) {
        try {
            const matchResult = await getCalculatedMatch(studentId, app.internshipId);
            const score = resolveScore(matchResult);
            await Application.updateOne(
                { _id: app._id },
                { $set: { matchingScore: score, match_score: score } }
            );
            updated += 1;
        } catch {
            failed += 1;
        }
    }

    return { scanned: apps.length, updated, failed };
}

module.exports = {
    refreshStudentPendingApplicationMatchScores
};

