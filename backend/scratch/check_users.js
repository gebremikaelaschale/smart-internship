const mongoose = require('mongoose');
const User = require('../models/User');

async function check() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const users = await User.find({ role: { $regex: /admin/i } }).select('fullName email role isVerified').lean();
        console.log("--- ADMIN USERS ---");
        console.log(users);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

check();
