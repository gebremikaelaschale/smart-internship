const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const User = require('../models/User');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const College = require('../models/College');
const Department = require('../models/Department');

const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    console.log('Connecting to DB:', dbURI);
    await mongoose.connect(dbURI, { maxPoolSize: 5 });
    console.log('✅ Connected to database');

    const [users, students, employers, colleges, departments, applications, internships] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: { $in: ['student', 'Student'] } }),
      User.countDocuments({ role: { $in: ['employer', 'Industry Partner'] } }),
      College.countDocuments(),
      Department.countDocuments(),
      Application.countDocuments(),
      Internship.countDocuments()
    ]);

    console.log('Collection counts:');
    console.log(' - users:', users);
    console.log(' - students:', students);
    console.log(' - employers:', employers);
    console.log(' - colleges:', colleges);
    console.log(' - departments:', departments);
    console.log(' - applications:', applications);
    console.log(' - internships:', internships);

    const dean = await User.findOne({ role: { $in: ['dean', 'Dean'] } }).lean();
    if (dean) {
      console.log('Sample dean user:', { id: String(dean._id), name: dean.fullName || dean.name, email: dean.email, collegeId: dean.collegeId || dean.college });
    } else {
      console.log('No dean user found in `users` collection.');
    }
  } catch (err) {
    console.error('DB inspect failed:', err.message || err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(0);
  }
}

run();
