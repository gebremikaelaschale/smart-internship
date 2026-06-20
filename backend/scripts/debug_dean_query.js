const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');
const Department = require('../models/Department');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';
const collegeId = '69df8fc29661594feb1adc1f'; // College of Informatics

async function run() {
  try {
    await mongoose.connect(DB);
    
    // Replicate the endpoint's student filter logic
    const departments = await Department.find({ collegeId })
      .select('_id name')
      .lean();

    const departmentIds = departments.map((department) => department._id);
    console.log('Departments:', departmentIds);

    const collegeMatchClauses = [
      { collegeId }
    ];
    collegeMatchClauses.push({ college: 'College of Informatics' });

    const studentFilter = {
      role: { $in: ['student', 'Student'] },
      $or: [
        ...collegeMatchClauses,
        ...(departmentIds.length > 0 ? [{ departmentId: { $in: departmentIds } }] : [])
      ]
    };

    const scopedStudentIds = await User.find(studentFilter).select('_id name college collegeId departmentId').lean();

    console.log('Scoped students found:', scopedStudentIds.length);
    scopedStudentIds.forEach(s => {
      console.log(`  - ${s.name} (id: ${s._id}, college: ${s.college}, collegeId: ${s.collegeId})`);
    });

    const studentIds = scopedStudentIds.map(s => s._id);
    
    // Check placed applications
    const placedCount = await Application.countDocuments({
      studentId: { $in: studentIds },
      status: { $in: ['Accepted', 'Placed'] }
    });
    
    console.log(`\nPlaced applications for these students: ${placedCount}`);
    
    // List the placed applications
    const placedApps = await Application.find({
      studentId: { $in: studentIds },
      status: { $in: ['Accepted', 'Placed'] }
    }).select('studentId status').lean();
    
    console.log('Placed apps details:');
    placedApps.forEach(a => console.log(`  - Student: ${a.studentId}, Status: ${a.status}`));
    
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
