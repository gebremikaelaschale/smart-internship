const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const { createChatSocket } = require('./socket/chatSocket');

dotenv.config({ path: path.join(__dirname, '.env') });
const app = express();
const server = http.createServer(app);

const allowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    String(process.env.FRONTEND_URL || '').trim()
].filter(Boolean));

// Middlewares (ትልልቅ ፋይሎችን/ፎቶዎችን እንዲቀበል ተደርጓል)
app.use(cors({
    origin(origin, callback) {
        if (!origin) {
            return callback(null, true);
        }

        if (allowedOrigins.has(origin)) {
            return callback(null, true);
        }

        if (/^http:\/\/localhost:\d+$/.test(origin)) {
            return callback(null, true);
        }

        if (/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database Connection
const dbURI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/smart_internship_program";
mongoose.connect(dbURI)
    .then(() => console.log("✅ Enterprise Matrix Database Connected!"))
    .catch(err => console.log("❌ DB Connection Error:", err));

// --- ሁሉንም 7 ራውቶች እዚህ ጋር እናገናኛለን ---
const authRoutes = require('./routes/auth');
app.use('/auth', authRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', require('./routes/admin')); // አዲሱ የዩኒቨርሲቲ መዋቅር መቆጣጠሪያ
app.use('/api/admin', require('./routes/adminGovernance'));
app.use('/api/dean', require('./routes/dean'));
app.use('/api/hod', require('./routes/hod'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/internships', require('./routes/internship'));
app.use('/api/matching', require('./routes/matching'));
app.use('/api/application', require('./routes/application'));
app.use('/api/task', require('./routes/task'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/student', require('./routes/student'));
app.use('/api/students', require('./routes/students'));
app.use('/api/notification', require('./routes/notification'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/employer-profile', require('./routes/employerProfile'));
app.use('/api/evaluation', require('./routes/evaluation'));
app.use('/api/logbook', require('./routes/logbook'));
app.use('/api/user-preferences', require('./routes/userPreferences'));
app.use('/api/landing', require('./routes/landing'));
app.use('/api/super-admin', require('./routes/superAdminPartners'));
app.use('/api/companies', require('./routes/companyVerification'));

const io = new Server(server, {
    cors: {
        origin: [...allowedOrigins],
        credentials: true
    }
});

createChatSocket(io);
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use. Stop the other process or change PORT in .env.`);
        process.exit(1);
    }

    throw error;
});

server.listen(PORT, () => console.log(`🚀 SmartIntern Server running on port ${PORT}`));