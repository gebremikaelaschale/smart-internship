const express = require('express');
const app = express();
require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smartintern').then(async () => {
    
    const User = require('./models/User');
    const Profile = require('./models/Profile');
    const Internship = require('./models/Internship');
    const Application = require('./models/Application');
    const CompanyProfile = require('./models/CompanyProfile');
    const ActivityLog = require('./models/ActivityLog');
    const Notification = require('./models/Notification');
    
    app.use(express.json());
    
    // mock auth
    app.use((req, res, next) => {
        User.findOne({role: 'student'}).then(user => {
            req.user = { id: user._id, role: 'student', adminType: '' };
            next();
        });
    });
    
    app.use('/api/application', require('./routes/application'));
    
    const request = require('supertest');
    
    const res = await request(app).get('/api/application/my');
    console.log(res.status);
    console.log(res.text);

    process.exit();
}).catch(console.error);
