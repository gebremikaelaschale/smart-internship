const mongoose = require('mongoose');
const User = require('./models/User');
const Profile = require('./models/Profile');
const bcrypt = require('bcryptjs');

async function seedStudent() {
    try {
        await mongoose.connect('mongodb://localhost:27017/internship_portal');
        console.log('Connected to MongoDB.');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);
        
        let student = await User.findOne({ email: 'student@univ.edu' });
        if (!student) {
            student = new User({
                fullName: 'Abebe Bikila',
                email: 'student@univ.edu',
                password: hashedPassword,
                role: 'Student'
            });
            await student.save();
            console.log('Student created.');
        }

        const profile = await Profile.findOneAndUpdate(
            { userId: student._id },
            { 
                skills: ['React', 'Node.js', 'JavaScript', 'MongoDB', 'UI/UX', 'Figma'],
                profileStrength: 85,
                department: 'Software Engineering',
                yearOfStudy: '4th Year'
            },
            { upsert: true, returnDocument: 'after' }
        );
        console.log('Student profile populated.');

        process.exit(0);
    } catch (err) {
        console.error('Student seeding failed:', err);
        process.exit(1);
    }
}

seedStudent();
