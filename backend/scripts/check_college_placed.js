const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(DB);
    
    // Find students in College of Informatics
    const collegeStudents = await User.find({ 
      college: 'College of Informatics',
      role: { $in: ['student', 'Student'] }
    }).select('_id name').lean();
    
    console.log('College of Informatics students:', collegeStudents.length);
    collegeStudents.forEach(s => console.log(`  - ${s.name} (${s._id})`));
    
    // Get their application IDs
    const studentIds = collegeStudents.map(s => s._id);
    
    // Count total applications from these students
    const totalAppsForCollege = await Application.countDocuments({ studentId: { $in: studentIds } });
    console.log(`\nTotal applications from College students: ${totalAppsForCollege}`);
    
    // Count placed applications from these students
    const placedAppsForCollege = await Application.countDocuments({ 
      studentId: { $in: studentIds },
      status: { $in: ['Accepted', 'Placed'] }
    });
    console.log(`Placed applications from College students: ${placedAppsForCollege}`);
    
    // Also show all placed applications regardless of college
    const allPlaced = await Application.countDocuments({ status: { $in: ['Accepted', 'Placed'] } });
    console.log(`\nTotal placed in DB (all): ${allPlaced}`);
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
