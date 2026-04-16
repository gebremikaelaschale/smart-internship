const ActivityLog = require('../models/ActivityLog');

const auditLog = (actionLabel) => {
    return async (req, res, next) => {
        const originalSend = res.send;
        
        res.send = function (data) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                let dynamicUserId = req.user ? req.user.id : null;

                // For Login/Register, try to extract ID from response
                if (!dynamicUserId && data) {
                    try {
                        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
                        dynamicUserId = parsed?.user?.id || parsed?.user?._id || parsed?.id || null;
                    } catch (e) { /* non-json response */ }
                }

                const logEntry = new ActivityLog({
                    userId: dynamicUserId,
                    action: actionLabel || `${req.method} ${req.originalUrl}`,
                    details: `Payload: ${JSON.stringify(req.body).substring(0, 500)}`,
                    ipAddress: req.ip,
                    deviceInfo: req.headers['user-agent']
                });
                logEntry.save().catch(err => console.error("Audit log failure:", err));
            }
            originalSend.apply(res, arguments);
        };
        next();
    };
};

module.exports = auditLog;
