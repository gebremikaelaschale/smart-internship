require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');

const students = [
    {
        studentId: 'UOG-2026-0001',
        name: 'Abebe Balcha',
        email: 'abebe.balcha@uog.edu.et',
        department: 'Computer Science',
        college: 'College of Informatics'
    },
    {
        studentId: 'UOG-2026-0002',
        name: 'Meseret Tadesse',
        email: 'meseret.tadesse@uog.edu.et',
        department: 'Software Engineering',
        college: 'College of Informatics'
    }
];

async function seedStudents() {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program';

    await mongoose.connect(mongoUri);
    await Student.bulkWrite(
        students.map((student) => ({
            updateOne: {
                filter: { email: student.email.toLowerCase() },
                update: { $set: { ...student, email: student.email.toLowerCase() } },
                upsert: true
            }
        }))
    );

    console.log('Student registry seed completed.');
    await mongoose.disconnect();
}

seedStudents().catch(async (err) => {
    console.error(err);
    await mongoose.disconnect();
    process.exit(1);
});
