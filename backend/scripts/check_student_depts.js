const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(DB);
    
    // Get placed applications
    const placedApps = await Application.find({ status: { $in: ['Accepted', 'Placed'] } })
      .select('studentId status')
      .lean();
    
    console.log('Placed applications:', placedApps.length);
    
    // Check each student
    const studentIds = [...new Set(placedApps.map(a => String(a.studentId)))];
    
    for (const studentId of studentIds) {
      const student = await User.findById(studentId).select('_id name collegeId college departmentId department').lean();
      console.log(`\nStudent: ${student.name}`);
      console.log(`  - collegeId: ${student.collegeId}`);
      console.log(`  - college: ${student.college}`);
      console.log(`  - departmentId: ${student.departmentId}`);
      console.log(`  - department: ${student.department}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
