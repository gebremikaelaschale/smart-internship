const mongoose = require('mongoose');
const CompanyProfile = require('../models/CompanyProfile');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const profile = await CompanyProfile.findById("69fdc76bf8c8078c9415cc12").lean();
        console.log("--- ETHIOTELCOM PROFILE ---");
        console.log(JSON.stringify(profile, null, 2));

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
