const mongoose = require('mongoose');
const College = require('../models/College');
const Department = require('../models/Department');
const User = require('../models/User');
const Internship = require('../models/Internship');
const Application = require('../models/Application');

async function check() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to MongoDB:", dbURI);

        const students = await User.countDocuments({ role: { $in: ['student', 'Student'] } });
        const companies = await User.countDocuments({ role: { $in: ['employer', 'Employer', 'Industry Partner'] } });
        const colleges = await College.countDocuments();
        const departments = await Department.countDocuments();
        const internships = await Internship.countDocuments();
        const applications = await Application.countDocuments();

        console.log("--- DATABASE COUNTS ---");
        console.log("Students:", students);
        console.log("Companies/Partners:", companies);
        console.log("Colleges:", colleges);
        console.log("Departments:", departments);
        console.log("Internships:", internships);
        console.log("Applications:", applications);

        // Also check some records from College and Department
        const sampleColleges = await College.find({}).limit(5);
        console.log("Colleges sample:", sampleColleges);

        const sampleDeps = await Department.find({}).limit(5);
        console.log("Departments sample:", sampleDeps);

        process.exit(0);
    } catch (err) {
        console.error("Failed:", err);
        process.exit(1);
    }
}

check();
