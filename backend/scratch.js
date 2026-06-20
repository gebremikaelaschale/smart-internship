const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartintern').then(async () => {
    const Application = require('./models/Application');
    let app = await Application.findOne({ studentId: { $exists: true } });
    if (!app) {
        console.log('No applications found.');
        process.exit();
    }
    
    const token = jwt.sign(
        { user: { id: app.studentId, role: 'student' } }, 
        process.env.JWT_SECRET || 'secret'
    );
    
    console.log('Generated token for student:', app.studentId);
    
    try {
       const res = await fetch('http://localhost:5000/api/application/my', {
           headers: { 'x-auth-token': token }
       });
       console.log('Status:', res.status);
       console.log('Response:', await res.text());
    } catch(e) {
       console.error('Fetch error:', e);
    }
    process.exit();
});
