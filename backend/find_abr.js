const mongoose = require('mongoose');
const User = require('./models/User');
const Profile = require('./models/Profile');
const CompanyProfile = require('./models/CompanyProfile');
const fs = require('fs');
require('dotenv').config();

async function findAbr() {
    let output = '';
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(uri);
        output += 'Connected\n';

        const users = await User.find({ 
            $or: [
                { name: { $regex: /abr/i } }, 
                { fullName: { $regex: /abr/i } },
                { email: { $regex: /abr/i } }
            ] 
        }).lean();

        output += `Found ${users.length} users matching 'abr'\n`;
        for (const u of users) {
            output += `- ${u.name} / ${u.fullName} (${u.role}) ID: ${u._id}\n`;
            const p = await Profile.findOne({ userId: u._id }).lean();
            const cp = await CompanyProfile.findOne({ user: u._id }).lean();
            output += `  User Img: ${u.profileImage || 'None'}\n`;
            output += `  Profile Img: ${p?.profilePicUrl || 'None'}\n`;
            output += `  Company Logo: ${cp?.logo || 'None'}\n`;
        }

    } catch (err) {
        output += err.toString() + '\n';
    } finally {
        await mongoose.disconnect();
        fs.writeFileSync('abr_results.txt', output);
        console.log('Results written to abr_results.txt');
    }
}

findAbr();
