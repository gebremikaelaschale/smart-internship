const { normalizeAdminType } = require('../utils/governanceRoles');

module.exports = function superAdminOnly(req, res, next) {
    // Strict check: prefer explicit raw role match, but also accept normalized admin type
    const rawRole = String(req.user?.rawRole || '').trim().toLowerCase();
    const adminType = String(req.user?.adminType || '').trim().toLowerCase();

    // User requested explicit guard: if (req.user.role !== 'super_admin') return 403
    if (rawRole === 'super_admin' || adminType === 'superadmin') {
        return next();
    }

    return res.status(403).json({ message: 'Unauthorized' });
};
