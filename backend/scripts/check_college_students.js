const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const College = require('../models/College');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(DB);
    
    // Find College of Informatics
    const college = await College.findOne({ name: 'College of Informatics' }).lean();
    console.log('College of Informatics:', college?._id, college?.name);
    
    if (!college) {
      console.log('College not found');
      return;
    }
    
    // Find students linked by collegeId
    const studentsById = await User.find({ 
      collegeId: college._id,
      role: { $in: ['student', 'Student'] }
    }).select('_id name collegeId college role').lean();
    
    console.log('\nStudents with collegeId match:', studentsById.length);
    studentsById.forEach(s => console.log(`  - ${s.name} (id: ${s._id})`));
    
    // Find students linked by college string
    const studentsByString = await User.find({ 
      college: college.name,
      role: { $in: ['student', 'Student'] }
    }).select('_id name collegeId college role').lean();
    
    console.log('\nStudents with college string match:', studentsByString.length);
    studentsByString.forEach(s => console.log(`  - ${s.name} (id: ${s._id})`));
    
    // All students total
    const allStudents = await User.find({ role: { $in: ['student', 'Student'] } }).lean();
    console.log('\nTotal students in DB:', allStudents.length);
    allStudents.slice(0, 5).forEach(s => console.log(`  - ${s.name} (collegeId: ${s.collegeId}, college: ${s.college})`));
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
