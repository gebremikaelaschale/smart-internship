const mongoose = require('mongoose');
const LoginLog = require('../models/LoginLog');

async function run() {
    try {
        const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
        await mongoose.connect(dbURI);

        const logs = await LoginLog.find({}).sort({ timestamp: -1 }).limit(10).lean();
        console.log(`=== Recent Login Attempt Logs (${logs.length}) ===`);
        logs.forEach((log, index) => {
            console.log(`[${index + 1}] Timestamp: ${log.timestamp}`);
            console.log(`    Email: ${log.email}`);
            console.log(`    Status: ${log.status}`);
            console.log(`    Reason: ${log.reason}`);
            console.log(`    IP: ${log.ipAddress}`);
            console.log(`-----------------------------------`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
