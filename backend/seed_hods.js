#!/usr/bin/env node

/**
 * Seed script to create HOD users with proper departments
 * This ensures the evaluation form can correctly fetch and display HOD emails
 * Run: node backend/seed_hods.js
 */

const mongoose = require('mongoose');
const User = require('./models/User');

const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-internship';

// Standard departments at University of Gondar (Computer Science College)
const DEPARTMENTS = [
  { name: 'Computer Science', hodName: 'Dr. Misganaw Abeje Debasu', hodEmail: 'misganaw.abeje@uog.edu.et' },
  { name: 'Information Technology', hodName: 'Dr. Abraha Woldichael', hodEmail: 'abraha.woldichael@uog.edu.et' },
  { name: 'Software Engineering', hodName: 'Dr. Getnet Bekele', hodEmail: 'getnet.bekele@uog.edu.et' },
  { name: 'Information Systems', hodName: 'Dr. Mekonnen Assefa', hodEmail: 'mekonnen.assefa@uog.edu.et' }
];

async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✓ Connected to MongoDB');
  } catch (error) {
    console.error('✗ Failed to connect to MongoDB:', error.message);
    process.exit(1);
  }
}

async function seedHODs() {
  try {
    console.log('\n📚 === Seeding HOD Users ===\n');

    // Check existing HODs
    const existingHODs = await User.find({ role: 'hod' }).select('department email').lean();
    console.log(`Found ${existingHODs.length} existing HOD(s)\n`);

    let created = 0;
    let updated = 0;

    for (const dept of DEPARTMENTS) {
      const existingHOD = await User.findOne({
        role: 'hod',
        department: { $regex: `^${dept.name}$`, $options: 'i' }
      });

      if (existingHOD) {
        // Update if email or name is different
        let changed = false;
        if (existingHOD.email !== dept.hodEmail) {
          existingHOD.email = dept.hodEmail;
          changed = true;
        }
        if (existingHOD.fullName !== dept.hodName) {
          existingHOD.fullName = dept.hodName;
          existingHOD.name = dept.hodName;
          changed = true;
        }
        if (changed) {
          await existingHOD.save();
          console.log(`✏️  Updated: ${dept.name}`);
          console.log(`    Name: ${dept.hodName}`);
          console.log(`    Email: ${dept.hodEmail}\n`);
          updated++;
        } else {
          console.log(`ℹ️  Already exists: ${dept.name}\n`);
        }
      } else {
        // Create new HOD
        const newHOD = new User({
          fullName: dept.hodName,
          name: dept.hodName,
          email: dept.hodEmail,
          password: null,
          role: 'hod',
          department: dept.name,
          isVerified: true,
          verificationStatus: 'Verified',
          accountStatus: 'Active',
          status: 'Active'
        });

        await newHOD.save();
        console.log(`✅ Created: ${dept.name}`);
        console.log(`    Name: ${dept.hodName}`);
        console.log(`    Email: ${dept.hodEmail}\n`);
        created++;
      }
    }

    console.log('📊 === Summary ===');
    console.log(`Created: ${created} HOD(s)`);
    console.log(`Updated: ${updated} HOD(s)`);
    console.log(`Total HODs now: ${DEPARTMENTS.length}\n`);

    // Verify final state
    const finalHODs = await User.find({ role: 'hod' }).select('fullName department email').lean();
    console.log('Final HOD Setup:');
    finalHODs.forEach((hod, idx) => {
      console.log(`${idx + 1}. ${hod.fullName}`);
      console.log(`   Department: ${hod.department}`);
      console.log(`   Email: ${hod.email}\n`);
    });

  } catch (error) {
    console.error('Error seeding HODs:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('✓ Disconnected from MongoDB\n');
  }
}

// Run seed
(async () => {
  await connectDB();
  await seedHODs();
})();
