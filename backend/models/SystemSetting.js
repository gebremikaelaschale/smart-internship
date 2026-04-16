const mongoose = require('mongoose');

const rolePermissionsSchema = new mongoose.Schema({
    superadmin: {
        manageUsers: { type: Boolean, default: true },
        manageCompanies: { type: Boolean, default: true },
        manageInternships: { type: Boolean, default: true },
        manageSettings: { type: Boolean, default: true }
    },
    collegeadmin: {
        manageUsers: { type: Boolean, default: true },
        manageCompanies: { type: Boolean, default: false },
        manageInternships: { type: Boolean, default: true },
        manageSettings: { type: Boolean, default: false }
    },
    deptadmin: {
        manageUsers: { type: Boolean, default: false },
        manageCompanies: { type: Boolean, default: false },
        manageInternships: { type: Boolean, default: true },
        manageSettings: { type: Boolean, default: false }
    }
}, { _id: false });

const systemConfigSchema = new mongoose.Schema({
    maintenanceMode: { type: Boolean, default: false },
    registrationOpen: { type: Boolean, default: true },
    maxApplicationsPerStudent: { type: Number, min: 1, max: 50, default: 10 },
    certificateAutoIssue: { type: Boolean, default: false }
}, { _id: false });

const SystemSettingSchema = new mongoose.Schema({
    singletonKey: { type: String, unique: true, default: 'default' },
    rolePermissions: { type: rolePermissionsSchema, default: () => ({}) },
    systemConfig: { type: systemConfigSchema, default: () => ({}) },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

module.exports = mongoose.model('SystemSetting', SystemSettingSchema);
