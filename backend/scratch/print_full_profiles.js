const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);

        const profiles = await CompanyProfile.find({}).lean();
        let output = "=== MongoDB Company Profiles ===\n\n";
        profiles.forEach(p => {
            output += `Name: ${p.companyName}\n`;
            output += `Logo: ${p.logo}\n`;
            output += `CoverImage: ${p.coverImage}\n`;
            output += `Verification Status: ${p.verification?.status}\n`;
            output += `Verification Doc: ${p.verification?.businessLicenseUrl}\n`;
            output += `HQ Location: ${p.hqLocation}\n`;
            output += `Industry Type: ${p.industryType}\n`;
            output += `--------------------------------\n\n`;
        });

        fs.writeFileSync(path.join(__dirname, 'profile_inspection.txt'), output);
        console.log("Inspection written to profile_inspection.txt");
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
