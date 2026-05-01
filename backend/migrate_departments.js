const mongoose = require('mongoose');
const Internship = require('./models/Internship');
require('dotenv').config();

async function migrate() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/internship_db');
    console.log('Connected to DB.');

    const internships = await Internship.find({});
    
    for (const item of internships) {
      let dept = 'General';
      const text = [item.title, item.description].join(' ').toLowerCase();
      
      if (text.includes('software') || text.includes('developer') || text.includes('react') || text.includes('full stack')) {
        dept = 'Software Engineering';
      } else if (text.includes('database') || text.includes('sql') || text.includes('data')) {
        dept = 'Information Systems';
      } else if (text.includes('bank') || text.includes('accounting') || text.includes('finance')) {
        dept = 'Accounting and Finance';
      } else if (text.includes('civil') || text.includes('structural')) {
        dept = 'Civil Engineering';
      } else if (text.includes('electrical')) {
        dept = 'Electrical and Computer Engineering';
      }
      
      item.department = dept;
      await item.save();
      console.log(`Updated ${item.title} -> ${dept}`);
    }

    console.log('Migration complete.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

migrate();
