const { normalizeRole, normalizeAdminType } = require('../utils/governanceRoles');

module.exports = function roleMiddleware(allowedRoles = []) {
    const normalizedAllowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
        .filter(Boolean)
        .map((role) => String(role).trim().toLowerCase());

    return (req, res, next) => {
        const role = normalizeRole(req.user?.role);
        const adminType = normalizeAdminType(req.user?.adminType || req.user?.role);
        const normalizedRole = role === 'admin' || adminType === 'superadmin' ? 'admin' : role;

        if (!normalizedAllowed.includes(normalizedRole)) {
            return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
        }

        return next();
    };
};
