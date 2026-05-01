const mongoose = require('mongoose');
const Internship = require('./models/Internship');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";

async function check() {
    await mongoose.connect(dbURI);
    const internships = await Internship.find().select('title duration').lean();
    console.log('Internships Duration:', internships.map(i => ({ title: i.title, duration: i.duration })));
    process.exit(0);
}

check();
