const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

async function checkSort() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/internship_db');
    console.log('Connected.');

    const internships = await Internship.find({})
      .sort({ studentsNeeded: -1 })
      .select('title studentsNeeded')
      .limit(5);

    console.log('Sorted by Seats (studentsNeeded):');
    internships.forEach(i => console.log(`${i.title}: ${i.studentsNeeded} seats`));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSort();
