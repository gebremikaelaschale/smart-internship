const mongoose = require('mongoose');
const Event = require('./models/Event');
const User = require('./models/User');

const seedEvents = async () => {
    try {
        await mongoose.connect('mongodb://127.0.0.1:27017/smart_internship_program');
        console.log("Connected to MongoDB");

        // Find a student
        const student = await User.findOne({ role: 'student' });
        if (!student) {
            console.log("No student found. Create a student first.");
            process.exit();
        }

        console.log(`Creating test events for student: ${student.email}`);

        // Clean previous dummy events (optional)
        await Event.deleteMany({ studentId: student._id });

        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(now.getDate() + 1);
        tomorrow.setHours(14, 30, 0, 0);

        const nextWeek = new Date(now);
        nextWeek.setDate(now.getDate() + 5);
        nextWeek.setHours(10, 0, 0, 0);

        const events = [
            {
                studentId: student._id,
                title: 'Technical Interview - Safaricom',
                type: 'Interview',
                eventDate: tomorrow,
                description: 'First round technical interview via Zoom.'
            },
            {
                studentId: student._id,
                title: 'Advisor Sync-up Meeting',
                type: 'Meeting',
                eventDate: nextWeek,
                description: 'Review portfolio progress with University Advisor.'
            }
        ];

        await Event.insertMany(events);
        console.log("Successfully seeded 2 events!");
        process.exit();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

seedEvents();
