function emitHodDashboardRefresh(req, payload = {}) {
    try {
        const io = req?.app?.get?.('io');
        if (!io) return;

        io.emit('hod:dashboard-updated', {
            ...payload,
            timestamp: new Date().toISOString()
        });
    } catch {
        // Dashboard refresh should never block business actions.
    }
}

module.exports = {
    emitHodDashboardRefresh
};
