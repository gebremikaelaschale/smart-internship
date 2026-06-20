const mongoose = require('mongoose');
const CompanyProfile = require('../models/CompanyProfile');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const profiles = await CompanyProfile.find({}).lean();
        console.log("--- PROFILES ---");
        for (const p of profiles) {
            console.log(`Profile Name: ${p.companyName}`);
            console.log(`Profile ID (_id): ${p._id}`);
            console.log(`User ID (user): ${p.user}`);
            console.log(`Verification Status: ${p.verification?.status}`);
            console.log(`Verification License Url: ${p.verification?.businessLicenseUrl}`);
            
            // Try to findById
            const found = await CompanyProfile.findById(p._id).populate('user').lean();
            console.log(`FindByID Test: ${found ? 'SUCCESS' : 'FAILED'}`);
            console.log("-----------------------");
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
