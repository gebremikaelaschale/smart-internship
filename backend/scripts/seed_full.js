const mongoose = require('mongoose');
const User = require('./models/User');
const Internship = require('./models/Internship');
const bcrypt = require('bcryptjs');

async function seed() {
    try {
        await mongoose.connect('mongodb://localhost:27017/internship_portal');
        console.log('Connected to MongoDB.');

        // 1. Create a Partner Organization (Employer)
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('password123', salt);
        
        let partner = await User.findOne({ email: 'partner@univ.edu' });
        if (!partner) {
            partner = new User({
                fullName: 'Global Tech Solutions',
                email: 'partner@univ.edu',
                password: hashedPassword,
                role: 'Industry Partner' // Fixed: was 'employer' before
            });
            await partner.save();
            console.log('Partner Organization created.');
        }

        // 2. Create Sample Internships
        const deadline = new Date();
        deadline.setMonth(deadline.getMonth() + 2); // 2 months from now

        const samples = [
            { 
                companyId: partner._id,
                title: 'Software Engineering Trainee', 
                description: 'Join our agile team to build next-gen financial systems. High emphasis on React and Node.js.', 
                location: 'Addis Ababa (On-site)', 
                duration: '6 Months', 
                isPaid: true,
                deadline: deadline,
                status: 'Open'
            },
            { 
                companyId: partner._id,
                title: 'Backend Development Intern', 
                description: 'Help us scale our microservices. Focus on MongoDB, Express, and distributed systems.', 
                location: 'Remote', 
                duration: '3 Months', 
                isPaid: false,
                deadline: deadline,
                status: 'Open'
            },
            { 
                companyId: partner._id,
                title: 'UI/UX Design Placement', 
                description: 'Collaborate with our designers to create stunning student portals. Figma expertise required.', 
                location: 'Gondar, University Area', 
                duration: '4 Months', 
                isPaid: true,
                deadline: deadline,
                status: 'Open'
            }
        ];

        await Internship.deleteMany({}); // Clear old ones if any
        await Internship.insertMany(samples);
        console.log('Sample internships seeded successfully!');

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
}

seed();
