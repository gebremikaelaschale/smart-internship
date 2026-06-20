const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function reset(email, newPassword = 'AdminPassword123!') {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);
        console.log("Connected to DB.");

        const cleanEmail = email.trim().toLowerCase();
        
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const updated = await User.findOneAndUpdate(
            { email: cleanEmail },
            { password: hashedPassword, isVerified: true, isFirstLogin: false },
            { new: true }
        );

        if (updated) {
            console.log(`✅ SUCCESS: Password for user ${cleanEmail} successfully updated to: ${newPassword}`);
            console.log(`👤 User Role: ${updated.role}`);
        } else {
            console.log(`❌ FAILED: User with email ${cleanEmail} was not found in the database.`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

// Read CLI arguments
const emailArg = process.argv[2];
const passwordArg = process.argv[3] || 'AdminPassword123!';

if (!emailArg) {
    console.log("Usage: node scratch/reset_any_password.js <email> [newPassword]");
    process.exit(1);
}

reset(emailArg, passwordArg);
