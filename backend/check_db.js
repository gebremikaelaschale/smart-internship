const mongoose = require('mongoose');
const Internship = require('./models/Internship');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";

async function check() {
    await mongoose.connect(dbURI);
    const count = await Internship.countDocuments();
    const internships = await Internship.find().limit(5).lean();
    console.log('Total Internships:', count);
    console.log('Sample Internships Status:', internships.map(i => ({ title: i.title, status: i.status })));
    process.exit(0);
}

check();
