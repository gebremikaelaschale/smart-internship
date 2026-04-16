const jwt = require('jsonwebtoken');
const { normalizeRole } = require('../utils/governanceRoles');

module.exports = function authMiddleware(req, res, next) {
    const headerToken = req.header('x-auth-token');
    const authHeader = req.header('authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = headerToken || bearerToken;

    if (!token) {
        return res.status(401).json({ message: 'No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const role = normalizeRole(decoded.role);

        req.user = {
            ...decoded,
            role,
            id: decoded.userId || decoded.studentId || decoded.id || decoded._id || null,
            userId: decoded.userId || decoded.id || decoded._id || null
        };

        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token.' });
    }
};