const mongoose = require('mongoose');
const CompanyProfile = require('../models/CompanyProfile');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program");
    console.log("Connected to DB");
    
    const profiles = await CompanyProfile.find({}).sort({ updatedAt: -1 }).limit(1);
    if (profiles.length > 0) {
      console.log("Latest Profile Verification Data:");
      console.log(JSON.stringify(profiles[0].verification, null, 2));
      
      const docPath = profiles[0].verification?.registrationDocUrl;
      if (docPath && docPath.startsWith('/uploads')) {
        const fullPath = path.join(__dirname, '..', docPath);
        const exists = require('fs').existsSync(fullPath);
        console.log(`File on disk (${docPath}): ${exists ? "FOUND ✅" : "MISSING ❌"}`);
        if (exists) {
          const stats = require('fs').statSync(fullPath);
          console.log(`File Size: ${stats.size} bytes`);
        }
      }
    } else {
      console.log("No profiles found");
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
  }
}

check();
