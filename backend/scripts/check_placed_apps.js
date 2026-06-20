const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Application = require('../models/Application');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(DB);
    const allApps = await Application.countDocuments();
    const placed = await Application.countDocuments({ status: { $in: ['Placed', 'Accepted'] } });
    const docs = await Application.find({ status: { $in: ['Placed', 'Accepted'] } })
      .select('studentId status createdAt updatedAt')
      .lean();
    
    console.log('Total applications:', allApps);
    console.log('Placed/Accepted applications:', placed);
    console.log('\nPlaced/Accepted applications details:');
    docs.forEach((d, i) => {
      console.log(`  ${i + 1}. Status: ${d.status}, StudentId: ${d.studentId}, Updated: ${d.updatedAt}`);
    });
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
