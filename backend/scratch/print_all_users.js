const mongoose = require('mongoose');
const User = require('../models/User');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);

        const users = await User.find({}).lean();
        console.log(`=== Total Users in Database: ${users.length} ===`);
        users.forEach((u, i) => {
            console.log(`[${i+1}] Name: ${u.fullName || u.name}, Email: ${u.email}, Role: ${u.role}, AdminType: ${u.adminType || 'None'}, isVerified: ${u.isVerified}`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
