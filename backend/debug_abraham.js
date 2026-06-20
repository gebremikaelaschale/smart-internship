const mongoose = require('mongoose');
const User = require('./models/User');
const Profile = require('./models/Profile');
const CompanyProfile = require('./models/CompanyProfile');
require('dotenv').config();

async function checkAbraham() {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(uri);
        console.log('Connected to DB:', uri);

        const users = await User.find({ $or: [{ name: /Abraham/i }, { fullName: /Abraham/i }] }).lean();
        if (users.length === 0) {
            console.log('User Abraham not found');
            return;
        }
        
        for (const user of users) {
            console.log('--- User Found ---');
            console.log('ID:', user._id);
            console.log('Name:', user.name);
            console.log('Role:', user.role);
            console.log('User.profileImage:', user.profileImage || 'NULL');

            const profile = await Profile.findOne({ userId: user._id }).lean();
            if (profile) {
                console.log('Profile.profilePicUrl:', profile.profilePicUrl || 'NULL');
            } else {
                console.log('Student Profile NOT found');
            }

            const company = await CompanyProfile.findOne({ user: user._id }).lean();
            if (company) {
                console.log('CompanyProfile.logo:', company.logo || 'NULL');
            } else {
                console.log('Company Profile NOT found');
            }
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkAbraham();
