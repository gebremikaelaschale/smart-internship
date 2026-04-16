const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const { normalizeRole } = require('../utils/governanceRoles');

module.exports = async function studentAuth(req, res, next) {
    try {
        const headerToken = req.header('x-auth-token');
        const authHeader = req.header('authorization');
        const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
        const token = headerToken || bearerToken;

        if (!token) {
            return res.status(401).json({ message: 'No token provided.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (normalizeRole(decoded.role) !== 'student') {
            return res.status(403).json({ message: 'Access denied: Student role required.' });
        }

        const student = await Student.findById(decoded.studentId || decoded.userId || decoded.id).lean();
        if (!student) {
            return res.status(401).json({ message: 'Access denied: Student account not found.' });
        }

        if (decoded.email && student.email !== String(decoded.email).toLowerCase()) {
            return res.status(401).json({ message: 'Access denied: Token subject mismatch.' });
        }

        req.user = {
            id: student._id.toString(),
            studentId: student.studentId,
            email: student.email,
            name: student.name,
            role: 'student',
            oid: decoded.oid,
            tid: decoded.tid
        };

        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired. Please login again.' });
        }
        return res.status(401).json({ message: 'Invalid token.' });
    }
};
