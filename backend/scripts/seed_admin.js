const mongoose = require('mongoose');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function seedSuperAdmin() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program');
        console.log('Connected to MongoDB.');

        const email = 'admin@uog.edu'; // Official UoG Governance Email
        const password = 'AdminPassword123!'; // Secure default password

        const existing = await User.findOne({ email });
        if (existing) {
            console.log('SuperAdmin already exists with this email.');
            process.exit(0);
        }

        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const superAdmin = new User({
            fullName: 'Dr. Solomon Bekele',
            email: email,
            password: hashedPassword,
            role: 'SuperAdmin',
            isVerified: true,
            college: 'Main Directorate',
            department: 'Institutional Governance'
        });

        await superAdmin.save();
        console.log('--------------------------------------------------');
        console.log('✅ SUPERADMIN SEEDED SUCCESSFULLY');
        console.log(`📧 Email: ${email}`);
        console.log(`🔑 Password: ${password}`);
        console.log('--------------------------------------------------');
        console.log('Please use these credentials to initialize the Governance Hub.');
        
        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seedSuperAdmin();
