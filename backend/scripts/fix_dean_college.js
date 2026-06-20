const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const DB = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(DB);
    const deanId = process.argv[2] || '69df6af6ffbaa0349e9899a0';
    const targetCollegeId = process.argv[3] || '69df8fc29661594feb1adc1f';
    const updated = await User.findByIdAndUpdate(deanId, { collegeId: targetCollegeId }, { new: true }).lean();
    if (updated) {
      console.log('Updated dean:', { id: String(updated._id), collegeId: String(updated.collegeId) });
    } else {
      console.log('Dean not found for id', deanId);
    }
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
