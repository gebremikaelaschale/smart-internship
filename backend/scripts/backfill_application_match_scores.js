const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const Application = require('../models/Application');
const { getCalculatedMatch } = require('../utils/internshipMatching');

function resolveBestScore(application = {}) {
  const camel = Number(application?.matchingScore);
  const snake = Number(application?.match_score);
  const camelValue = Number.isFinite(camel) ? camel : 0;
  const snakeValue = Number.isFinite(snake) ? snake : 0;
  return Math.max(camelValue, snakeValue);
}

async function main() {
  const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';
  await mongoose.connect(dbURI, { maxPoolSize: 5 });

  const argv = process.argv.slice(2);
  const args = new Set(argv);
  const recomputeMissing = args.has('--recompute-missing');
  const dryRun = args.has('--dry-run');
  const force = args.has('--force');

  const studentIdArgIndex = argv.findIndex((value) => value === '--studentId' || value === '--student');
  const internshipIdArgIndex = argv.findIndex((value) => value === '--internshipId' || value === '--internship');
  const studentId = studentIdArgIndex >= 0 ? String(argv[studentIdArgIndex + 1] || '').trim() : '';
  const internshipId = internshipIdArgIndex >= 0 ? String(argv[internshipIdArgIndex + 1] || '').trim() : '';

  const filter = {};
  if (studentId) filter.studentId = studentId;
  if (internshipId) filter.internshipId = internshipId;

  const cursor = Application.find(filter)
    .select('_id studentId internshipId matchingScore match_score createdAt')
    .cursor();

  let scanned = 0;
  let updated = 0;
  let recomputed = 0;
  let failed = 0;

  for await (const app of cursor) {
    scanned += 1;
    try {
      const bestStored = resolveBestScore(app);

      if (bestStored > 0 && !force) {
        const needsSync = Number(app.matchingScore || 0) !== bestStored || Number(app.match_score || 0) !== bestStored;
        if (!needsSync) continue;
        if (!dryRun) {
          await Application.updateOne(
            { _id: app._id },
            { $set: { matchingScore: bestStored, match_score: bestStored } }
          );
        }
        updated += 1;
        continue;
      }

      if (!recomputeMissing) {
        continue;
      }

      const match = await getCalculatedMatch(app.studentId, app.internshipId);
      const score = Math.max(0, Math.min(100, Number(match?.score || 0)));
      if (!dryRun) {
        await Application.updateOne(
          { _id: app._id },
          { $set: { matchingScore: score, match_score: score } }
        );
      }
      updated += 1;
      recomputed += 1;
    } catch (error) {
      failed += 1;
      console.error('[backfill_match_scores] failed', String(app?._id || ''), error?.message || error);
    }
  }

  console.log(
    JSON.stringify(
      { scanned, updated, recomputed, failed, dryRun, recomputeMissing, force, studentId, internshipId },
      null,
      2
    )
  );

  await mongoose.connection.close();
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
