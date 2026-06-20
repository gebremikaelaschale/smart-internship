#!/usr/bin/env node

/**
 * Diagnostic script to check HOD setup and department matching
 * Helps verify that HOD users are correctly configured with departments
 * Run: node backend/check_hod_setup.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');
const Application = require('./models/Application');
const Profile = require('./models/Profile');
const Internship = require('./models/Internship');

// Database connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-internship';

async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function checkHODSetup() {
  try {
    console.log('\n📋 === HOD Setup Diagnostic Report === \n');

    // 1. Check all HOD users
    console.log('1️⃣  Checking HOD Users in Database...');
    const hodUsers = await User.find({ role: 'hod' }).select('fullName name email department departmentId').lean();
    console.log(`   Found ${hodUsers.length} HOD user(s)\n`);
    
    if (hodUsers.length === 0) {
      console.log('   ⚠️  WARNING: No HOD users found in database!');
      console.log('   Please create HOD users first before evaluation forms can populate HOD emails.\n');
    } else {
      hodUsers.forEach((hod, idx) => {
        console.log(`   ${idx + 1}. ${hod.fullName || hod.name || 'Unnamed'}`);
        console.log(`      Email: ${hod.email}`);
        console.log(`      Department: ${hod.department || '(not set)'}`);
        console.log(`      DepartmentId: ${hod.departmentId || '(not set)'}\n`);
      });
    }

    // 2. Check accepted applications
    console.log('2️⃣  Checking Applications with Accepted Students...');
    const acceptedApps = await Application.find({
      status: { $in: ['Accepted', 'Placed', 'PLACED'] }
    })
      .populate('studentId', 'fullName name email department')
      .populate('internshipId', 'title')
      .lean();
    
    console.log(`   Found ${acceptedApps.length} accepted application(s)\n`);

    if (acceptedApps.length === 0) {
      console.log('   ℹ️  No accepted applications found.\n');
    } else {
      // Get unique departments
      const studentIds = acceptedApps.map(a => a.studentId?._id).filter(Boolean);
      const profiles = await Profile.find({ userId: { $in: studentIds } }).lean();
      const profileMap = profiles.reduce((acc, p) => {
        acc[p.userId] = p;
        return acc;
      }, {});

      const departments = new Set();
      acceptedApps.forEach(app => {
        const studentId = app.studentId?._id;
        const profile = profileMap[studentId] || {};
        const dept = profile?.personalInfo?.department || app.studentId?.department;
        if (dept) departments.add(String(dept).trim().toLowerCase());
      });

      console.log(`   Departments required: ${Array.from(departments).join(', ')}\n`);

      // 3. Check department matching
      console.log('3️⃣  Checking Department Matching...\n');
      
      departments.forEach(deptName => {
        const hodForDept = hodUsers.find(h => String(h.department || '').trim().toLowerCase() === deptName);
        if (hodForDept) {
          console.log(`   ✓ ${deptName}`);
          console.log(`     HOD: ${hodForDept.fullName || hodForDept.name}`);
          console.log(`     Email: ${hodForDept.email}\n`);
        } else {
          console.log(`   ✗ ${deptName}`);
          console.log(`     ⚠️  NO HOD FOUND FOR THIS DEPARTMENT!\n`);
        }
      });

      // 4. Sample evaluation targets
      console.log('4️⃣  Sample Evaluation Targets (First 3 Applications)...\n');
      
      acceptedApps.slice(0, 3).forEach((app, idx) => {
        const studentId = app.studentId?._id;
        const profile = profileMap[studentId] || {};
        const personalInfo = profile?.personalInfo || {};
        const deptName = String(personalInfo?.department || app.studentId?.department || '').trim();
        const departmentHead = deptName ? hodUsers.find(h => String(h.department || '').trim().toLowerCase() === deptName.toLowerCase()) : null;

        console.log(`   ${idx + 1}. Student: ${app.studentId?.fullName || app.studentId?.name}`);
        console.log(`      Department: ${deptName || '(not set)'}`);
        console.log(`      HOD Email: ${departmentHead?.email || '❌ NOT FOUND'}\n`);
      });
    }

    console.log('📊 === End of Report ===\n');

  } catch (error) {
    console.error('Error during diagnostic:', error);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Disconnected from MongoDB\n');
  }
}

// Run diagnostic
(async () => {
  await connectDB();
  await checkHODSetup();
})();
