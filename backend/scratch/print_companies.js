const mongoose = require('mongoose');
const User = require('../models/User'); // Load User schema
const CompanyProfile = require('../models/CompanyProfile');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const profiles = await CompanyProfile.find({}).populate('user').lean();
        console.log("--- COMPANIES IN DB ---");
        profiles.forEach(p => {
            console.log(`Name: ${p.companyName}`);
            console.log(`Profile ID (_id): ${p._id}`);
            console.log(`User ID: ${p.user?._id || p.user}`);
            console.log(`User Email: ${p.user?.email}`);
            console.log("------------------------");
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
