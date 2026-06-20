const mongoose = require('mongoose');
const User = require('../models/User');
const Application = require('../models/Application');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);

        const student = await User.findOne({ name: /Gebremikael/i }).lean();
        if (!student) {
            console.log("Student not found!");
            process.exit(1);
        }

        console.log(`Student Found: ${student.fullName || student.name} (ID: ${student._id})`);

        const apps = await Application.find({ studentId: student._id }).sort({ createdAt: -1 }).lean();
        console.log(`Found ${apps.length} applications:`);
        apps.forEach((app, index) => {
            console.log(`[${index + 1}] Status: ${app.status}, CreatedAt: ${app.createdAt}, UpdatedAt: ${app.updatedAt}, ID: ${app._id}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
