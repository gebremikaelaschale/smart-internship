const mongoose = require('mongoose');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');
require('dotenv').config();

async function syncLogos() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/internship_db');
        console.log('Connected to MongoDB.');

        const profiles = await CompanyProfile.find({ logo: { $exists: true, $ne: '' } }).lean();
        console.log(`Found ${profiles.length} company profiles with logos.`);

        let updatedCount = 0;
        for (const profile of profiles) {
            const result = await User.findByIdAndUpdate(profile.user, {
                profileImage: profile.logo
            });
            if (result) updatedCount++;
        }

        console.log(`Successfully synced ${updatedCount} logos to User collection.`);
        process.exit(0);
    } catch (err) {
        console.error('Sync Error:', err);
        process.exit(1);
    }
}

syncLogos();
