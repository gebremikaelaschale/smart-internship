const mongoose = require('mongoose');
const CompanyProfile = require('../models/CompanyProfile');
const Internship = require('../models/Internship');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const companies = await CompanyProfile.find({}).lean();
        console.log("--- COMPANIES ---");
        companies.forEach(c => {
            console.log(`Company: ${c.companyName}, License: ${c.verification?.businessLicenseUrl ? 'YES' : 'NO'}, Status: ${c.verification?.status}`);
        });

        const pendingInternships = await Internship.find({ status: 'Pending' }).lean();
        console.log("--- PENDING INTERNSHIPS ---");
        console.log("Total Pending:", pendingInternships.length);
        pendingInternships.forEach(i => {
            console.log(`Internship: ${i.title}, Status: ${i.status}, Description: ${i.description ? i.description.length : 0} chars`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
