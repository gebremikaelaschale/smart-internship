const { resolveUniversityRole } = require('../utils/universityRoles');

module.exports = function universityRoleMiddleware(allowedRoles = []) {
  const normalizedAllowed = new Set((Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    .filter(Boolean)
    .map((role) => String(role).trim().toLowerCase()));

  return (req, res, next) => {
    const role = resolveUniversityRole(req.user);

    if (!normalizedAllowed.has(role)) {
      return res.status(403).json({ message: 'Access denied: insufficient permissions.' });
    }

    return next();
  };
};
