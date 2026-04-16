const mongoose = require('mongoose');
const Internship = require('./models/Internship');

mongoose.connect('mongodb://localhost:27017/internship_portal').then(async () => {
    const samples = [
        { title: 'Software Engineering Trainee', company: 'TechNova Ethiopia', location: 'Addis Ababa (On-site)', description: 'Join our agile team to build next-gen financial systems. High emphasis on React and Node.js.', duration: '6 Months', isPaid: true },
        { title: 'Backend Development Intern', company: 'EthioConnect', location: 'Remote', description: 'Help us scale our microservices. Focus on MongoDB, Express, and distributed systems.', duration: '3 Months', isPaid: false },
        { title: 'UI/UX Design Placement', company: 'Digital Horizon', location: 'Gondar, University Area', description: 'Collaborate with our designers to create stunning student portals. Figma expertise required.', duration: '4 Months', isPaid: true }
    ];
    await Internship.insertMany(samples);
    console.log('Sample internships seeded successfully!');
    process.exit();
}).catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
});
