const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function listUsers() {
    try {
        const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(uri);
        console.log('Connected to DB');

        const users = await User.find({}).select('name fullName role').limit(20).lean();
        console.log('Sample Users:');
        users.forEach(u => console.log(`- ${u.name} / ${u.fullName} (${u.role})`));

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

listUsers();
