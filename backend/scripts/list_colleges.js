const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const College = require('../models/College');

const dbURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

async function run() {
  try {
    await mongoose.connect(dbURI);
    const docs = await College.find({}).lean();
    console.log('Colleges:', docs.map(d => ({ id: String(d._id), name: d.name })));
  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
