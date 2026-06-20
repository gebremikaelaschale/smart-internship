const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const superAdminOnly = require('../middleware/superAdminMiddleware');
const { normalizeRole, normalizeAdminType, hasGovernanceAccess, isSuperAdmin: isSuperAdminRole } = require('../utils/governanceRoles');
const College = require('../models/College');
const Department = require('../models/Department');
const User = require('../models/User');
const CompanyProfile = require('../models/CompanyProfile');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const ActivityLog = require('../models/ActivityLog');
const Report = require('../models/Report');
const Evaluation = require('../models/Evaluation');
const Notification = require('../models/Notification');
const Certificate = require('../models/Certificate');
const SystemSetting = require('../models/SystemSetting');
const LoginLog = require('../models/LoginLog');
const Profile = require('../models/Profile');
const { normalizeString } = require('../utils/normalize');
const { canonicalizeAcademicName, findBestAcademicMatch } = require('../utils/academicNormalization');
const { updateCompanyStatus } = require('../controllers/companyStatusController');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;
const mailTransporter = EMAIL_USER && EMAIL_PASS
    ? nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    })
    : null;

function createRandomPassword(length = 10) {
    const charset = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let index = 0; index < length; index += 1) {
        password += charset[bytes[index] % charset.length];
    }
    return password;
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function createAndEmitNotification(req, payload) {
    const notification = await Notification.create(payload);
    try {
        const io = req.app.get('io');
        if (io && payload?.userId) {
            io.to(`user:${String(payload.userId)}`).emit('notification:new', notification.toObject());
        }
    } catch (e) {
        // socket failures should not block the main request
    }
    return notification;
}

// ─── GET Current Admin Profile (for ProfileAdmin page) ───────────────────────
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select('name fullName email phone profileImage role jobTitle department college')
            .lean();
        if (!user) return res.status(404).json({ message: 'User not found.' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch profile.' });
    }
});


async function sendGovernanceAccountEmail({ to, name, role, password, loginUrl }) {
    if (!mailTransporter) {
        throw new Error('Email service is not configured.');
    }

    await mailTransporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject: 'Your campus portal account has been created',
        html: `
            <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
              <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
                <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#2563eb;font-weight:700;">Smart Internship Placement</p>
                <h1 style="margin:0 0 16px;font-size:28px;color:#0f172a;">Your ${role} account is ready</h1>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">Hello ${name || 'there'},</p>
                <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">A portal account has been created for you. Use the credentials below to sign in and change your password after login.</p>
                <div style="background:#08143a;color:#fff;border-radius:16px;padding:18px 20px;">
                  <p style="margin:0 0 8px;font-size:14px;opacity:0.9;">Login email</p>
                  <p style="margin:0 0 16px;font-size:18px;font-weight:700;">${to}</p>
                  <p style="margin:0 0 8px;font-size:14px;opacity:0.9;">Temporary password</p>
                  <p style="margin:0;font-size:20px;letter-spacing:0.15em;font-weight:700;">${password}</p>
                </div>
                <p style="margin:16px 0 0;font-size:14px;color:#64748b;">Login here: ${loginUrl}</p>
              </div>
            </div>
        `
    });
}

function hasAdminAccess(role) {
    return hasGovernanceAccess(role);
}

function getAdminType(req) {
    return normalizeAdminType(req.user?.adminType || req.user?.role);
}

function isSuperAdmin(req) {
    return isSuperAdminRole(req.user?.adminType || req.user?.role);
}

function normalizeStoredRole(role) {
    return normalizeRole(role);
}

function isGovernanceUser(user) {
    return hasGovernanceAccess(user?.role);
}

function isDeanRoleValue(role) {
    return normalizeAdminType(role) === 'collegeadmin';
}

function isDepartmentHeadRoleValue(role) {
    return normalizeAdminType(role) === 'deptadmin';
}

function isDeanUser(user) {
    return isDeanRoleValue(user?.adminType || user?.role);
}

function isDepartmentHeadUser(user) {
    return isDepartmentHeadRoleValue(user?.adminType || user?.role);
}

function canManageInternshipStatus(req) {
    const adminType = getAdminType(req);
    return ['superadmin', 'collegeadmin'].includes(adminType);
}

function canManageDepartments(req) {
    const adminType = getAdminType(req);
    return adminType === 'collegeadmin';
}

function canExportUsers(req) {
    return isSuperAdmin(req);
}

function canExportStudents(req) {
    const adminType = getAdminType(req);
    return ['superadmin', 'collegeadmin'].includes(adminType);
}

function canExportCompanies(req) {
    return isSuperAdmin(req);
}

function canExportInternships(req) {
    const adminType = getAdminType(req);
    return ['superadmin', 'collegeadmin'].includes(adminType);
}

function canExportApplications(req) {
    const adminType = getAdminType(req);
    return ['superadmin', 'collegeadmin', 'deptadmin'].includes(adminType);
}

function resolveExportReason(req, res) {
    const reason = String(req.query.reason || '').trim();
    if (reason.length < 8) {
        res.status(400).json({ message: 'Export reason is required and must be at least 8 characters.' });
        return null;
    }
    return reason;
}

function monthKey(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function buildRecentMonths(size) {
    const now = new Date();
    const months = [];

    for (let i = size - 1; i >= 0; i -= 1) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        months.push({
            key: monthKey(d),
            month: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })
        });
    }

    return months;
}

function getPagination(req) {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}

function safeRegex(value) {
    const input = String(value || '').trim();
    if (!input) return null;
    const escaped = input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
}

function normalizeAcademicQueryKey(value = '') {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function buildAcademicSpaceInsensitiveRegex(value = '') {
    const compact = normalizeAcademicQueryKey(value);
    if (!compact) return null;

    const pattern = compact
        .split('')
        .map((character) => escapeRegex(character))
        .join('\\s*');

    return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
}

function academicNameMatches(left, right) {
    const leftValue = canonicalizeAcademicName(left);
    const rightValue = canonicalizeAcademicName(right);
    if (!leftValue || !rightValue) return false;
    if (leftValue === rightValue) return true;
    return leftValue.includes(rightValue) || rightValue.includes(leftValue);
}

function buildAuditLogsFilter(req) {
    const q = safeRegex(req.query.q);
    const action = String(req.query.action || 'all').trim();
    const from = String(req.query.from || '').trim();
    const to = String(req.query.to || '').trim();

    const filter = {
        ...(q
            ? {
                $or: [
                    { action: q },
                    { details: q }
                ]
            }
            : {}),
        ...(action && action !== 'all' ? { action } : {})
    };

    if (from || to) {
        const dateFilter = {};
        if (from) {
            const fromDate = new Date(from);
            if (!Number.isNaN(fromDate.getTime())) {
                dateFilter.$gte = fromDate;
            }
        }
        if (to) {
            const toDate = new Date(to);
            if (!Number.isNaN(toDate.getTime())) {
                toDate.setHours(23, 59, 59, 999);
                dateFilter.$lte = toDate;
            }
        }
        if (Object.keys(dateFilter).length > 0) {
            filter.timestamp = dateFilter;
        }
    }

    return filter;
}

function csvCell(value) {
    const text = String(value ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function toCsv(rows) {
    return rows.map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\n');
}

async function logAdminAction(req, action, details) {
    try {
        await ActivityLog.create({
            userId: req.user?.id || req.user?.userId || null,
            action,
            details,
            ipAddress: req.ip,
            deviceInfo: req.headers['user-agent']
        });
    } catch {
        // Logging should never block business actions.
    }
}

async function getOrCreateSystemSettings(userId = null) {
    let settings = await SystemSetting.findOne({ singletonKey: 'default' }).lean();
    if (settings) return settings;

    const created = await SystemSetting.create({
        singletonKey: 'default',
        updatedBy: userId || null
    });

    return created.toObject();
}

async function getAdminScope(req) {
    const adminType = getAdminType(req);
    if (adminType === 'superadmin') {
        return { adminType, college: '', department: '', collegeId: null, departmentId: null };
    }

    const actor = await User.findById(req.user?.id)
        .select('college department collegeId departmentId')
        .lean();

    return {
        adminType,
        college: String(actor?.college || '').trim(),
        department: String(actor?.department || '').trim(),
        collegeId: actor?.collegeId || null,
        departmentId: actor?.departmentId || null
    };
}

function applyStudentScopeFilter(baseFilter, scope) {
    const filter = { ...(baseFilter || {}) };
    const scopeConditions = [];

    if (scope?.adminType === 'collegeadmin') {
        if (scope?.collegeId) scopeConditions.push({ collegeId: scope.collegeId });
        const collegeRegex = buildAcademicSpaceInsensitiveRegex(scope.college);
        if (collegeRegex) scopeConditions.push({ college: collegeRegex });
    }

    if (scope?.adminType === 'deptadmin') {
        if (scope?.departmentId) scopeConditions.push({ departmentId: scope.departmentId });
        const departmentRegex = buildAcademicSpaceInsensitiveRegex(scope.department);
        if (departmentRegex) scopeConditions.push({ department: departmentRegex });
    }

    if (scopeConditions.length === 1) {
        Object.assign(filter, scopeConditions[0]);
    } else if (scopeConditions.length > 1) {
        filter.$and = [...(filter.$and || []), { $or: scopeConditions }];
    }
    return filter;
}

function applyUserScopeFilter(baseFilter, scope) {
    const filter = { ...(baseFilter || {}) };
    if (scope?.adminType === 'collegeadmin') {
        if (scope?.college) filter.college = scope.college;
        else if (scope?.collegeId) filter.collegeId = scope.collegeId;
    }
    if (scope?.adminType === 'deptadmin') {
        if (scope?.college) filter.college = scope.college;
        else if (scope?.collegeId) filter.collegeId = scope.collegeId;
        if (scope?.department) filter.department = scope.department;
        else if (scope?.departmentId) filter.departmentId = scope.departmentId;
    }
    return filter;
}

async function getScopedStudentIds(scope) {
    const studentFilter = applyStudentScopeFilter({ role: { $in: ['student', 'Student'] } }, scope);
    const students = await User.find(studentFilter).select('_id').lean();
    return students.map((item) => item._id);
}

async function getScopedEmployerIds(scope) {
    const employerFilter = applyUserScopeFilter({ role: { $in: ['employer', 'Industry Partner'] } }, scope);
    const employers = await User.find(employerFilter).select('_id').lean();
    return employers.map((item) => item._id);
}

function normalizeDepartmentName(value) {
    return String(value || '').trim().toLowerCase();
}

function buildSpaceInsensitiveRegex(value) {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return null;
    const pattern = parts.map((part) => escapeRegex(part)).join('\\s*');
    return new RegExp(`^\\s*${pattern}\\s*$`, 'i');
}

function normalizeAcademicKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function academicNameMatches(left, right) {
    const leftKey = normalizeAcademicKey(left);
    const rightKey = normalizeAcademicKey(right);
    return Boolean(leftKey && rightKey && leftKey === rightKey);
}

async function getScopedDepartmentNames(scope) {
    if (!scope || scope.adminType === 'superadmin') return [];

    if (scope.adminType === 'deptadmin') {
        if (scope.department) return [scope.department];
        if (!scope.departmentId) return [];

        const department = await Department.findById(scope.departmentId).select('name').lean();
        return department?.name ? [department.name] : [];
    }

    const collegeFilter = scope.collegeId
        ? { _id: scope.collegeId }
        : scope.college
            ? { name: scope.college }
            : null;

    if (!collegeFilter) return [];

    const college = await College.findOne(collegeFilter).select('_id').lean();
    if (!college?._id) return [];

    const departments = await Department.find({ collegeId: college._id }).select('name').lean();
    return departments.map((department) => String(department?.name || '').trim()).filter(Boolean);
}

function applyDepartmentScopeFilter(baseFilter, departmentNames = []) {
    if (!Array.isArray(departmentNames) || departmentNames.length === 0) {
        return baseFilter;
    }

    const scopedRegexes = departmentNames
        .map((name) => String(name || '').trim())
        .filter(Boolean)
        .map((name) => new RegExp(`^${escapeRegex(name)}$`, 'i'));

    if (!scopedRegexes.length) return baseFilter;

    return {
        ...(baseFilter || {}),
        targetDepartments: { $in: scopedRegexes }
    };
}

function normalizeDeviceLabel(raw) {
    const value = String(raw || '').toLowerCase();
    if (!value) return 'Unknown device';
    if (value.includes('windows')) return 'Windows';
    if (value.includes('android')) return 'Android';
    if (value.includes('iphone') || value.includes('ios')) return 'iPhone';
    if (value.includes('mac os') || value.includes('macintosh')) return 'macOS';
    if (value.includes('linux')) return 'Linux';
    return 'Browser session';
}

async function getCurrentUserSecurityOverview(user) {
    if (!user?._id) {
        return {
            lastLogin: null,
            deviceHistory: []
        };
    }

    const userId = user._id;
    const email = String(user.email || '').toLowerCase().trim();

    const [latestLoginLog, latestActivity, recentActivity] = await Promise.all([
        email
            ? LoginLog.findOne({ email, status: 'SUCCESS' })
                .select('createdAt ipAddress userAgent')
                .sort({ createdAt: -1 })
                .lean()
            : null,
        ActivityLog.findOne({ userId })
            .select('timestamp ipAddress deviceInfo action')
            .sort({ timestamp: -1 })
            .lean(),
        ActivityLog.find({ userId })
            .select('timestamp ipAddress deviceInfo action')
            .sort({ timestamp: -1 })
            .limit(40)
            .lean()
    ]);

    const storedLastLogin = user?.lastLoginAt
        ? {
            at: user.lastLoginAt,
            ipAddress: null,
            deviceInfo: null,
            source: 'user-last-login'
        }
        : null;

    const fallbackLastLogin = latestActivity
        ? {
            at: latestActivity.timestamp || null,
            ipAddress: latestActivity.ipAddress || null,
            deviceInfo: latestActivity.deviceInfo || null,
            source: 'activity-log'
        }
        : null;

    const selectedLastLogin = storedLastLogin || latestLoginLog;
    const lastLogin = selectedLastLogin
        ? {
            at: selectedLastLogin.at || selectedLastLogin.createdAt || null,
            ipAddress: selectedLastLogin.ipAddress || null,
            deviceInfo: selectedLastLogin.deviceInfo || selectedLastLogin.userAgent || null,
            source: selectedLastLogin.source || 'login-log'
        }
        : fallbackLastLogin;

    const seenKeys = new Set();
    const deviceHistory = [];

    for (const entry of recentActivity) {
        const ipAddress = String(entry?.ipAddress || '').trim();
        const deviceInfo = String(entry?.deviceInfo || '').trim();
        const key = `${deviceInfo}::${ipAddress}`;
        if (!deviceInfo && !ipAddress) continue;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        deviceHistory.push({
            lastSeenAt: entry?.timestamp || null,
            ipAddress: ipAddress || null,
            deviceInfo: deviceInfo || null,
            deviceLabel: normalizeDeviceLabel(deviceInfo),
            action: entry?.action || 'UNKNOWN'
        });

        if (deviceHistory.length >= 6) break;
    }

    return {
        lastLogin,
        deviceHistory
    };
}

function evaluateCompanyFraudRisk(company = {}) {
    let score = 0;
    const flags = [];

    const completeness = Number(company?.profileCompleteness || 0);
    const officialEmail = String(company?.officialEmail || '').trim().toLowerCase();
    const companyName = String(company?.companyName || '').trim().toLowerCase();
    const website = String(company?.website || '').trim().toLowerCase();
    const description = String(company?.description || '').trim();
    const verification = String(company?.verification?.status || '').trim();
    const hasLicense = Boolean(String(company?.verification?.businessLicenseUrl || '').trim());
    const hasRegistrationDoc = Boolean(String(company?.verification?.registrationDocUrl || '').trim());

    if (verification === 'Rejected') {
        score += 60;
        flags.push('Verification rejected by admin');
    }
    if (!hasLicense) {
        score += 55;
        flags.push('Missing business license');
    } else if (verification === 'Pending' && !hasRegistrationDoc) {
        score += 35;
        flags.push('Missing registration document');
    }
    if (completeness < 40) {
        score += 20;
        flags.push('Very low profile completeness');
    }
    if (!officialEmail || !officialEmail.includes('@')) {
        score += 25;
        flags.push('Official email missing or invalid');
    }

    const emailDomain = officialEmail.split('@')[1] || '';
    const domainHasCompanyName = companyName && emailDomain.includes(companyName.replace(/\s+/g, ''));
    if (officialEmail && !domainHasCompanyName && /gmail\.com|yahoo\.com|outlook\.com/i.test(emailDomain)) {
        score += 15;
        flags.push('Uses personal email domain for official contact');
    }

    if (website && !/^https?:\/\//i.test(website)) {
        score += 10;
        flags.push('Website format looks invalid');
    }

    if (!description || description.length < 30) {
        score += 10;
        flags.push('Company description is too short');
    }

    const riskLevel = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';
    return { score, riskLevel, flags };
}

function evaluateInternshipSpamRisk(internship = {}) {
    let score = 0;
    const flags = [];
    const title = String(internship?.title || '').trim();
    const description = String(internship?.description || '').trim();
    const requiredSkills = Array.isArray(internship?.requiredSkills) ? internship.requiredSkills : [];
    const text = `${title} ${description}`.toLowerCase();

    const spamPatterns = [
        /quick\s+money/i,
        /guaranteed\s+income/i,
        /no\s+experience\s+needed/i,
        /whatsapp|telegram/i,
        /https?:\/\//i
    ];

    spamPatterns.forEach((pattern) => {
        if (pattern.test(text)) {
            score += 20;
        }
    });

    if (description.length < 40) {
        score += 20;
        flags.push('Description too short');
    }
    if (requiredSkills.length === 0) {
        score += 10;
        flags.push('No required skills defined');
    }
    if (!internship?.deadline) {
        score += 15;
        flags.push('No deadline set');
    }

    if (spamPatterns.some((pattern) => pattern.test(text))) {
        flags.push('Suspicious promotional language or external contact detected');
    }

    return {
        score,
        riskLevel: score >= 60 ? 'High' : score >= 30 ? 'Medium' : 'Low',
        flags
    };
}

router.get('/super-admin', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const recentMonths = buildRecentMonths(12);
        const firstMonth = recentMonths[0]?.key;
        const [firstYear, firstMonthNumber] = String(firstMonth || '').split('-').map(Number);
        const startDate = Number.isFinite(firstYear) && Number.isFinite(firstMonthNumber)
            ? new Date(Date.UTC(firstYear, firstMonthNumber - 1, 1))
            : new Date(Date.now() - (365 * 24 * 60 * 60 * 1000));

        const verifiedCompanies = await User.find({
            role: { $in: ['employer', 'Industry Partner'] },
            isVerified: true
        }).select('_id').lean();
        const verifiedCompanyIds = verifiedCompanies.map(c => c._id);

        const [
            studentIds,
            companies,
            internships,
            activeInternships,
            colleges,
            departments,
            totalApplications,
            applicationMonthly,
            internshipMonthly,
            latestInternship,
            latestApplication,
            latestActivatedInternship,
            companyProfiles,
            pendingInternships
        ] = await Promise.all([
            User.distinct('_id', { role: { $in: ['student', 'Student'] } }),
            CompanyProfile.countDocuments(),
            Internship.countDocuments({ companyId: { $in: verifiedCompanyIds } }),
            Internship.countDocuments({ status: 'Open', companyId: { $in: verifiedCompanyIds } }),
            College.countDocuments(),
            Department.countDocuments(),
            Application.countDocuments(),
            Application.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Internship.aggregate([
                { $match: { createdAt: { $gte: startDate } } },
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Internship.findOne().sort({ createdAt: -1 }).select('title createdAt').lean(),
            Application.findOne()
                .sort({ createdAt: -1 })
                .populate('internshipId', 'title')
                .populate('studentId', 'name fullName')
                .select('createdAt internshipId studentId')
                .lean(),
            Internship.findOne({ status: 'Open' }).sort({ updatedAt: -1 }).select('title updatedAt').lean(),
            CompanyProfile.find().select('companyName officialEmail website description profileCompleteness verification').lean(),
            Internship.find({ status: 'Pending' }).select('title description requiredSkills deadline').limit(60).lean()
        ]);

        const applicationMap = new Map(
            applicationMonthly.map((item) => [
                `${item?._id?.year}-${String(item?._id?.month).padStart(2, '0')}`,
                Number(item?.count || 0)
            ])
        );
        const internshipMap = new Map(
            internshipMonthly.map((item) => [
                `${item?._id?.year}-${String(item?._id?.month).padStart(2, '0')}`,
                Number(item?.count || 0)
            ])
        );

        const analyticsSeries = recentMonths.map((item) => ({
            month: item.month,
            applications: applicationMap.get(item.key) || 0,
            approvedInternships: internshipMap.get(item.key) || 0
        }));

        const activity = [];
        if (latestInternship) {
            activity.push({
                type: 'internship-posted',
                message: 'New internship posted',
                details: latestInternship.title || 'A new internship opening was published',
                timestamp: latestInternship.createdAt || new Date()
            });
        }
        if (latestApplication) {
            const studentName = latestApplication?.studentId?.fullName || latestApplication?.studentId?.name || 'Student';
            activity.push({
                type: 'application-submitted',
                message: 'Student submitted application',
                details: `${studentName} applied for ${latestApplication?.internshipId?.title || 'an internship'}`,
                timestamp: latestApplication.createdAt || new Date()
            });
        }
        if (latestActivatedInternship) {
            activity.push({
                type: 'internship-approved',
                message: 'Internship approved by admin',
                details: latestActivatedInternship.title || 'Internship campaign is now live',
                timestamp: latestActivatedInternship.updatedAt || new Date()
            });
        }

        activity.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        const totalInternships = Number(internships || 0);
        const activeInternshipCount = Number(activeInternships || 0);
        const successRate = totalInternships > 0
            ? Math.round((activeInternshipCount / totalInternships) * 100)
            : 0;

        const riskyCompanies = companyProfiles
            .map((company) => ({
                companyName: company?.companyName || 'Unknown company',
                ...evaluateCompanyFraudRisk(company)
            }))
            .filter((item) => item.score >= 40)
            .sort((a, b) => b.score - a.score);

        const spamInternshipCount = pendingInternships
            .map((internship) => evaluateInternshipSpamRisk(internship))
            .filter((item) => item.score >= 30)
            .length;

        return res.json({
            stats: {
                students: Number(studentIds.length || 0),
                companies: Number(companies || 0),
                colleges: Number(colleges || 0),
                departments: Number(departments || 0),
                internships: totalInternships,
                applications: Number(totalApplications || 0)
            },
            analyticsSeries,
            internshipSuccess: {
                rate: successRate,
                activeInternships: activeInternshipCount,
                totalInternships
            },
            fraudSummary: {
                riskyCompanies: riskyCompanies.length,
                pendingInternshipSpamAlerts: spamInternshipCount,
                topRisks: riskyCompanies.slice(0, 5)
            },
            recentActivity: activity.slice(0, 8)
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load super admin dashboard.' });
    }
});

router.get('/college', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);

        if (scope.adminType === 'superadmin') {
            const [colleges, departments, pendingCompanyVerifications, activeStudents, departmentsWithoutHod, acceptedStudentIds, totalPartners, totalInternships, totalApplications] = await Promise.all([
                College.countDocuments(),
                Department.countDocuments(),
                CompanyProfile.countDocuments({ 'verification.status': 'Pending' }),
                User.distinct('_id', { role: { $in: ['student', 'Student'] } }).then((ids) => ids.length),
                Department.countDocuments({ $or: [{ head: null }, { head: { $exists: false } }] }),
                Application.distinct('studentId', { status: 'Accepted' }),
                User.countDocuments({ role: { $in: ['employer', 'Industry Partner'] } }),
                Internship.countDocuments(),
                Application.countDocuments()
            ]);

            const studentsWithoutInternship = Math.max(Number(activeStudents || 0) - Number(acceptedStudentIds.length || 0), 0);

            return res.json({
                stats: {
                    colleges: Number(colleges || 0),
                    departments: Number(departments || 0),
                    pendingRequests: Number(pendingCompanyVerifications || 0),
                    activeStudents: Number(activeStudents || 0),
                    departmentsWithoutHod: Number(departmentsWithoutHod || 0),
                    studentsWithoutInternship: Number(studentsWithoutInternship || 0),
                    students: Number(activeStudents || 0),
                    industryPartners: Number(totalPartners || 0),
                    internships: Number(totalInternships || 0),
                    applications: Number(totalApplications || 0)
                }
            });
        }

        const collegeFilter = scope?.collegeId
            ? { _id: scope.collegeId }
            : scope?.college
                ? { name: scope.college }
                : { _id: null };

        const collegeDoc = await College.findOne(collegeFilter).select('_id name').lean();

        const collegeDepartmentMatch = collegeDoc?._id
            ? {
                $or: [
                    { college: collegeDoc._id },
                    { collegeId: collegeDoc._id }
                ]
            }
            : null;

        const collegeLinkClauses = [];
        if (collegeDoc?._id) collegeLinkClauses.push({ collegeId: collegeDoc._id });
        if (collegeDoc?.name) collegeLinkClauses.push({ college: collegeDoc.name });

        const scopedStudentFilter = collegeLinkClauses.length > 0
            ? { role: { $in: ['student', 'Student'] }, $or: collegeLinkClauses }
            : { role: { $in: ['student', 'Student'] } };

        const scopedEmployerFilter = collegeLinkClauses.length > 0
            ? { role: { $in: ['employer', 'Industry Partner'] }, $or: collegeLinkClauses }
            : { role: { $in: ['employer', 'Industry Partner'] } };

        const [scopedStudentIds, scopedEmployerIds] = await Promise.all([
            User.find(scopedStudentFilter).select('_id').lean(),
            User.find(scopedEmployerFilter).select('_id').lean()
        ]);

        const studentIds = scopedStudentIds.map((item) => item._id);
        const employerIds = scopedEmployerIds.map((item) => item._id);

        const [departments, departmentsWithoutHod, pendingRequests, acceptedStudentIds, totalInternships, totalApplications, scopedStudentUsers, scopedProfiles, scopedApplications] = await Promise.all([
            collegeDepartmentMatch
                ? Department.countDocuments(collegeDepartmentMatch)
                : 0,
            collegeDepartmentMatch
                ? Department.countDocuments({
                    $and: [
                        collegeDepartmentMatch,
                        { $or: [{ head: null }, { head: { $exists: false } }] }
                    ]
                })
                : 0,
            studentIds.length > 0
                ? Application.countDocuments({
                    studentId: { $in: studentIds },
                    status: { $in: ['Pending', 'Under Review', 'Interview'] }
                })
                : 0,
            studentIds.length > 0
                ? Application.distinct('studentId', {
                    studentId: { $in: studentIds },
                    status: 'Accepted'
                })
                : [],
            employerIds.length > 0
                ? Internship.countDocuments({ companyId: { $in: employerIds } })
                : 0,
            studentIds.length > 0
                ? Application.countDocuments({ studentId: { $in: studentIds } })
                : 0,
            studentIds.length > 0
                ? User.find({ _id: { $in: studentIds } }).select('_id fullName name department college collegeId').lean()
                : [],
            studentIds.length > 0
                ? Profile.find({ userId: { $in: studentIds } }).select('userId personalInfo.department').lean()
                : [],
            studentIds.length > 0
                ? Application.find({ studentId: { $in: studentIds } })
                    .populate('studentId', 'fullName name email department college collegeId')
                    .populate('internshipId', 'title companyId')
                    .sort({ updatedAt: -1 })
                    .lean()
                : []
        ]);

        const activeStudents = Number(studentIds.length || 0);
        const studentsWithoutInternship = Math.max(activeStudents - Number(acceptedStudentIds.length || 0), 0);
        const placementStatuses = new Set(['Accepted', 'Placed']);
        const placementCount = scopedApplications.filter((application) => placementStatuses.has(String(application?.status || ''))).length;
        const placementProgress = totalApplications > 0
            ? Math.round((placementCount / totalApplications) * 100)
            : 0;

        const profileDepartmentByUserId = new Map(
            scopedProfiles.map((profile) => [String(profile.userId), String(profile?.personalInfo?.department || '').trim()])
        );

        scopedStudentUsers.forEach((user) => {
            const userId = String(user._id);
            if (!profileDepartmentByUserId.get(userId) && user.department) {
                profileDepartmentByUserId.set(userId, String(user.department).trim());
            }
        });

        const departmentStats = new Map();
        scopedApplications.forEach((application) => {
            const studentId = String(application?.studentId?._id || application?.studentId || '');
            const departmentName = String(
                profileDepartmentByUserId.get(studentId)
                || application?.studentId?.department
                || application?.studentId?.collegeDepartment
                || ''
            ).trim();

            if (!departmentName) return;

            const key = normalizeDepartmentName(departmentName);
            const current = departmentStats.get(key) || {
                department: departmentName,
                totalApplications: 0,
                placementCount: 0
            };

            current.totalApplications += 1;
            if (placementStatuses.has(String(application?.status || ''))) {
                current.placementCount += 1;
            }
            departmentStats.set(key, current);
        });

        const departmentComparison = Array.from(departmentStats.values())
            .map((item) => ({
                department: item.department || 'Department',
                totalApplications: item.totalApplications,
                placementCount: item.placementCount,
                placementRate: item.totalApplications > 0
                    ? Math.round((item.placementCount / item.totalApplications) * 100)
                    : 0
            }))
            .sort((left, right) => right.placementRate - left.placementRate || right.totalApplications - left.totalApplications)
            .slice(0, 6);

        const recentActivities = scopedApplications
            .filter((application) => ['Accepted', 'Placed', 'Interview', 'Shortlisted'].includes(String(application?.status || '')))
            .slice(0, 5)
            .map((application) => {
                const status = String(application?.status || 'Pending');
                const studentName = application?.studentId?.fullName || application?.studentId?.name || 'Unnamed Student';
                const internshipTitle = application?.internshipId?.title || 'Internship';

                return {
                    id: String(application?._id || ''),
                    status,
                    title: `${studentName} ${status.toLowerCase()} for ${internshipTitle}`,
                    message: `${studentName} moved to ${status.toLowerCase()} on ${internshipTitle}.`,
                    timestamp: application?.updatedAt || application?.createdAt || new Date()
                };
            });

        return res.json({
            stats: {
                colleges: collegeDoc ? 1 : 0,
                departments: Number(departments || 0),
                pendingRequests: Number(pendingRequests || 0),
                activeStudents,
                departmentsWithoutHod: Number(departmentsWithoutHod || 0),
                studentsWithoutInternship: Number(studentsWithoutInternship || 0),
                students: Number(activeStudents || 0),
                industryPartners: Number(employerIds.length || 0),
                internships: Number(totalInternships || 0),
                applications: Number(totalApplications || 0)
            },
            analytics: {
                placementProgress: {
                    percent: Number(placementProgress || 0),
                    placed: Number(placementCount || 0),
                    totalApplications: Number(totalApplications || 0)
                },
                departmentComparison,
                recentActivities
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load college dashboard.' });
    }
});

router.get('/security-overview', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const actor = await User.findById(req.user?.id)
            .select('_id email fullName name lastLoginAt')
            .lean();

        const summary = await getCurrentUserSecurityOverview(actor);

        return res.json(summary);
    } catch {
        return res.status(500).json({ message: 'Failed to load security overview.' });
    }
});

router.get('/department', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);

        if (scope.adminType === 'superadmin') {
            const [departmentUsers, activeInternships, reports] = await Promise.all([
                User.countDocuments({ role: { $in: ['student', 'Student', 'admin', 'dean', 'hod', 'DeptAdmin', 'CollegeAdmin'] } }),
                Internship.countDocuments({ status: 'Open' }),
                Report.countDocuments()
            ]);

            return res.json({
                stats: {
                    departmentUsers: Number(departmentUsers || 0),
                    activeInternships: Number(activeInternships || 0),
                    reports: Number(reports || 0)
                }
            });
        }

        const scopedStudentIds = await getScopedStudentIds(scope);
        const internshipIds = scopedStudentIds.length > 0
            ? await Application.distinct('internshipId', {
                studentId: { $in: scopedStudentIds },
                status: { $in: ['Pending', 'Under Review', 'Interview', 'Accepted'] }
            })
            : [];

        const roleFilter = { role: { $in: ['student', 'Student', 'admin', 'dean', 'hod', 'DeptAdmin', 'CollegeAdmin'] } };
        if (scope?.college) roleFilter.college = scope.college;
        if (scope?.department) roleFilter.department = scope.department;

        const [departmentUsers, activeInternships, reports] = await Promise.all([
            User.countDocuments(roleFilter),
            Internship.countDocuments({ _id: { $in: internshipIds }, status: 'Open' }),
            Report.countDocuments({ studentId: { $in: scopedStudentIds.length ? scopedStudentIds : [null] } })
        ]);

        return res.json({
            stats: {
                departmentUsers: Number(departmentUsers || 0),
                activeInternships: Number(activeInternships || 0),
                reports: Number(reports || 0)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load department dashboard.' });
    }
});

router.get('/analytics', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const scopedStudentIds = await getScopedStudentIds(scope);
        const studentScopeMatch = scopedStudentIds.length > 0
            ? { studentId: { $in: scopedStudentIds } }
            : scope.adminType === 'superadmin'
                ? {}
                : { studentId: { $in: [] } };

        const [
            totalStudents,
            totalInternships,
            totalApplications,
            acceptedApplications,
            statusBreakdown,
            monthlyTrend
        ] = await Promise.all([
            User.countDocuments(applyStudentScopeFilter({ role: { $in: ['student', 'Student'] } }, scope)),
            Internship.countDocuments(),
            Application.countDocuments(studentScopeMatch),
            Application.countDocuments({ ...studentScopeMatch, status: 'Accepted' }),
            Application.aggregate([
                ...(Object.keys(studentScopeMatch).length > 0 ? [{ $match: studentScopeMatch }] : []),
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                },
                { $sort: { count: -1 } }
            ]),
            Application.aggregate([
                ...(Object.keys(studentScopeMatch).length > 0 ? [{ $match: studentScopeMatch }] : []),
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        total: { $sum: 1 },
                        accepted: {
                            $sum: {
                                $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0]
                            }
                        }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ])
        ]);

        const successRate = totalApplications > 0
            ? Math.round((acceptedApplications / totalApplications) * 100)
            : 0;

        return res.json({
            totals: {
                students: Number(totalStudents || 0),
                internships: Number(totalInternships || 0),
                successRate,
                applications: Number(totalApplications || 0),
                accepted: Number(acceptedApplications || 0)
            },
            statusBreakdown: statusBreakdown.map((item) => ({
                status: item?._id || 'Unknown',
                count: Number(item?.count || 0)
            })),
            monthlyTrend: monthlyTrend.map((item) => ({
                month: `${String(item?._id?.year || '')}-${String(item?._id?.month || '').padStart(2, '0')}`,
                total: Number(item?.total || 0),
                accepted: Number(item?.accepted || 0)
            }))
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load analytics.' });
    }
});

router.get('/certificates', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const scopedStudentIds = await getScopedStudentIds(scope);
        const { page, limit, skip } = getPagination(req);
        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || 'all').trim();
        let studentIds = [];
        let internshipIds = [];

        if (q) {
            const regex = safeRegex(q);
            const [users, internships] = await Promise.all([
                User.find({ $or: [{ name: regex }, { fullName: regex }, { email: regex }] }).select('_id').lean(),
                Internship.find({ title: regex }).select('_id').lean()
            ]);
            studentIds = users.map((item) => item._id);
            internshipIds = internships.map((item) => item._id);
        }

        const appFilter = {
            status: { $in: ['Accepted', 'Placed', 'PLACED'] },
            ...((scope.adminType === 'collegeadmin' || scope.adminType === 'deptadmin')
                ? { studentId: { $in: scopedStudentIds.length ? scopedStudentIds : [null] } }
                : {}),
            ...(q ? {
                $or: [
                    { studentId: { $in: studentIds.length ? studentIds : [null] } },
                    { internshipId: { $in: internshipIds.length ? internshipIds : [null] } }
                ]
            } : {})
        };

        const acceptedApps = await Application.find(appFilter)
            .select('_id studentId internshipId status createdAt')
            .populate('studentId', 'name fullName email')
            .populate('internshipId', 'title companyId')
            .sort({ createdAt: -1 })
            .lean();

        const appIds = acceptedApps.map((item) => item._id);
        const [evaluations, certificates] = await Promise.all([
            Evaluation.find({ applicationId: { $in: appIds } })
                .select('_id applicationId performanceRating score comments createdAt')
                .sort({ createdAt: -1 })
                .lean(),
            Certificate.find({ applicationId: { $in: appIds } })
                .select('applicationId verificationStatus verificationNote verifiedAt issued issuedAt certificateNumber')
                .sort({ updatedAt: -1 })
                .sort({ createdAt: -1 })
                .lean()
        ]);

        const evaluationByApp = new Map();
        evaluations.forEach((entry) => {
            const key = String(entry?.applicationId || '');
            if (!key || evaluationByApp.has(key)) return;
            evaluationByApp.set(key, entry);
        });

        const certificateByApp = new Map();
        certificates.forEach((entry) => {
            const key = String(entry?.applicationId || '');
            if (!key || certificateByApp.has(key)) return;
            certificateByApp.set(key, entry);
        });

        const rows = acceptedApps.map((application) => {
            const applicationId = String(application?._id || '');
            const evaluation = evaluationByApp.get(applicationId) || null;
            const certificate = certificateByApp.get(applicationId) || null;

            let certificateStatus = 'Pending Evaluation';
            if (evaluation) {
                certificateStatus = 'Awaiting Admin Verification';
            }
            if (certificate?.verificationStatus === 'Rejected') {
                certificateStatus = 'Verification Rejected';
            }
            if (certificate?.verificationStatus === 'Verified') {
                certificateStatus = certificate?.issued ? 'Issued' : 'Verified - Ready to Issue';
            }

            return {
                ...application,
                evaluation,
                certificate,
                certificateStatus
            };
        });

        const filtered = status === 'all'
            ? rows
            : rows.filter((row) => String(row?.certificateStatus || '').toLowerCase() === status.toLowerCase());

        const total = filtered.length;
        const items = filtered.slice(skip, skip + limit);

        return res.json({
            items,
            stats: {
                pendingEvaluation: rows.filter((item) => item.certificateStatus === 'Pending Evaluation').length,
                awaitingVerification: rows.filter((item) => item.certificateStatus === 'Awaiting Admin Verification').length,
                verifiedReadyToIssue: rows.filter((item) => item.certificateStatus === 'Verified - Ready to Issue').length,
                issued: rows.filter((item) => item.certificateStatus === 'Issued').length,
                verificationRejected: rows.filter((item) => item.certificateStatus === 'Verification Rejected').length
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load certificates.' });
    }
});

router.put('/certificates/:applicationId/verify', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const status = String(req.body?.status || '').trim();
        const note = String(req.body?.note || '').trim();
        if (!['Verified', 'Rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be Verified or Rejected.' });
        }

        const application = await Application.findById(req.params.applicationId)
            .select('_id studentId internshipId status')
            .lean();
        if (!application || String(application?.status || '') !== 'Accepted') {
            return res.status(404).json({ message: 'Accepted application not found.' });
        }

        const evaluation = await Evaluation.findOne({ applicationId: application._id })
            .sort({ createdAt: -1 })
            .select('_id')
            .lean();

        if (!evaluation) {
            return res.status(400).json({ message: 'Company evaluation is required before verification.' });
        }

        const certificate = await Certificate.findOneAndUpdate(
            { applicationId: application._id },
            {
                $set: {
                    studentId: application.studentId,
                    internshipId: application.internshipId,
                    evaluationId: evaluation._id,
                    verificationStatus: status,
                    verificationNote: note,
                    verifiedBy: req.user?.id || null,
                    verifiedAt: new Date(),
                    ...(status === 'Rejected'
                        ? {
                            issued: false,
                            issuedAt: null,
                            issuedBy: null,
                            certificateNumber: ''
                        }
                        : {})
                }
            },
            { upsert: true, returnDocument: 'after' }
        ).lean();

        await logAdminAction(
            req,
            'ADMIN_CERTIFICATE_VERIFICATION_UPDATED',
            `Application=${application._id} Verification=${status} Note=${note || '-'}`
        );

        return res.json({ message: `Certificate ${status.toLowerCase()} successfully.`, item: certificate });
    } catch {
        return res.status(500).json({ message: 'Failed to verify certificate.' });
    }
});

router.put('/certificates/:applicationId/issue', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const application = await Application.findById(req.params.applicationId)
            .select('_id studentId internshipId status')
            .lean();
        if (!application || String(application?.status || '') !== 'Accepted') {
            return res.status(404).json({ message: 'Accepted application not found.' });
        }

        const certificate = await Certificate.findOne({ applicationId: application._id })
            .select('_id verificationStatus issued certificateNumber')
            .lean();

        if (!certificate || String(certificate?.verificationStatus || '') !== 'Verified') {
            return res.status(400).json({ message: 'Certificate must be verified before issuance.' });
        }
        if (certificate?.issued) {
            return res.status(409).json({ message: 'Certificate already issued.' });
        }

        const certificateNumber = `CERT-${new Date().getUTCFullYear()}-${String(application._id).slice(-6).toUpperCase()}`;

        const issued = await Certificate.findByIdAndUpdate(
            certificate._id,
            {
                $set: {
                    issued: true,
                    issuedAt: new Date(),
                    issuedBy: req.user?.id || null,
                    certificateNumber
                }
            },
            { returnDocument: 'after' }
        ).lean();

        await logAdminAction(
            req,
            'ADMIN_CERTIFICATE_ISSUED',
            `Application=${application._id} CertificateNumber=${certificateNumber}`
        );

        return res.json({ message: 'Certificate issued successfully.', item: issued });
    } catch {
        return res.status(500).json({ message: 'Failed to issue certificate.' });
    }
});

router.get('/reports/internship-statistics', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const [
            totalInternships,
            pendingInternships,
            openInternships,
            closedInternships,
            totalApplications,
            acceptedApplications,
            reportsSubmitted,
            reportStatuses,
            monthlyInternshipTrend
        ] = await Promise.all([
            Internship.countDocuments(),
            Internship.countDocuments({ status: 'Pending' }),
            Internship.countDocuments({ status: 'Open' }),
            Internship.countDocuments({ status: 'Closed' }),
            Application.countDocuments(),
            Application.countDocuments({ status: 'Accepted' }),
            Report.countDocuments(),
            Report.aggregate([
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ]),
            Internship.aggregate([
                {
                    $group: {
                        _id: {
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } },
                { $limit: 12 }
            ])
        ]);

        const acceptanceRate = totalApplications > 0
            ? Math.round((acceptedApplications / totalApplications) * 100)
            : 0;

        return res.json({
            summary: {
                internships: Number(totalInternships || 0),
                internshipPending: Number(pendingInternships || 0),
                internshipOpen: Number(openInternships || 0),
                internshipClosed: Number(closedInternships || 0),
                applications: Number(totalApplications || 0),
                acceptedApplications: Number(acceptedApplications || 0),
                acceptanceRate,
                reportsSubmitted: Number(reportsSubmitted || 0)
            },
            reportStatusBreakdown: reportStatuses.map((item) => ({
                status: item?._id || 'Unknown',
                count: Number(item?.count || 0)
            })),
            monthlyInternshipTrend: monthlyInternshipTrend.map((item) => ({
                month: `${String(item?._id?.year || '')}-${String(item?._id?.month || '').padStart(2, '0')}`,
                count: Number(item?.count || 0)
            }))
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load internship statistics.' });
    }
});

router.post('/reports/generate', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const reportName = String(req.body?.name || 'Internship Statistics Report').trim();
        const statistics = await Promise.all([
            Internship.countDocuments(),
            Internship.countDocuments({ status: 'Open' }),
            Application.countDocuments(),
            Application.countDocuments({ status: 'Accepted' })
        ]);

        const [totalInternships, openInternships, totalApplications, acceptedApplications] = statistics;
        const acceptanceRate = totalApplications > 0
            ? Math.round((acceptedApplications / totalApplications) * 100)
            : 0;

        await logAdminAction(
            req,
            'ADMIN_REPORT_GENERATED',
            `Name=${reportName} Internships=${totalInternships} Open=${openInternships} Applications=${totalApplications} Accepted=${acceptedApplications}`
        );

        return res.status(201).json({
            message: 'Report generated successfully.',
            report: {
                name: reportName,
                generatedAt: new Date(),
                metrics: {
                    totalInternships,
                    openInternships,
                    totalApplications,
                    acceptedApplications,
                    acceptanceRate
                }
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to generate report.' });
    }
});

router.get('/settings', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const [
            totalUsers,
            emailEnabled,
            inAppEnabled,
            twoFactorEnabled,
            privateProfiles,
            darkThemeUsers,
            settingDoc
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ 'notificationSettings.channels.email': true }),
            User.countDocuments({ 'notificationSettings.channels.inApp': true }),
            User.countDocuments({ 'securitySettings.twoFactor': true }),
            User.countDocuments({ 'privacySettings.profileVisibility': 'Private' }),
            User.countDocuments({ 'uxPreferences.theme': 'Dark' }),
            getOrCreateSystemSettings(req.user?.id)
        ]);

        return res.json({
            totals: {
                users: Number(totalUsers || 0),
                emailEnabled: Number(emailEnabled || 0),
                inAppEnabled: Number(inAppEnabled || 0),
                twoFactorEnabled: Number(twoFactorEnabled || 0),
                privateProfiles: Number(privateProfiles || 0),
                darkThemeUsers: Number(darkThemeUsers || 0)
            },
            rolePermissions: settingDoc?.rolePermissions || {},
            systemConfig: settingDoc?.systemConfig || {}
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load settings overview.' });
    }
});

router.put('/settings/permissions', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can update role permissions.' });
    }

    try {
        const rolePermissions = req.body?.rolePermissions;
        if (!rolePermissions || typeof rolePermissions !== 'object') {
            return res.status(400).json({ message: 'rolePermissions object is required.' });
        }

        const settings = await SystemSetting.findOneAndUpdate(
            { singletonKey: 'default' },
            { $set: { rolePermissions, updatedBy: req.user?.id || null } },
            { upsert: true, returnDocument: 'after' }
        ).lean();

        await logAdminAction(req, 'ADMIN_ROLE_PERMISSIONS_UPDATED', 'Role permissions updated from settings console.');

        return res.json({ message: 'Role permissions updated successfully.', rolePermissions: settings?.rolePermissions || {} });
    } catch {
        return res.status(500).json({ message: 'Failed to update role permissions.' });
    }
});

router.put('/settings/config', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can update system config.' });
    }

    try {
        const incoming = req.body?.systemConfig;
        if (!incoming || typeof incoming !== 'object') {
            return res.status(400).json({ message: 'systemConfig object is required.' });
        }

        const maxApplicationsPerStudent = Number(incoming.maxApplicationsPerStudent);
        if (!Number.isFinite(maxApplicationsPerStudent) || maxApplicationsPerStudent < 1 || maxApplicationsPerStudent > 50) {
            return res.status(400).json({ message: 'maxApplicationsPerStudent must be between 1 and 50.' });
        }

        const systemConfig = {
            maintenanceMode: Boolean(incoming.maintenanceMode),
            registrationOpen: Boolean(incoming.registrationOpen),
            maxApplicationsPerStudent,
            certificateAutoIssue: Boolean(incoming.certificateAutoIssue)
        };

        const settings = await SystemSetting.findOneAndUpdate(
            { singletonKey: 'default' },
            { $set: { systemConfig, updatedBy: req.user?.id || null } },
            { upsert: true, returnDocument: 'after' }
        ).lean();

        await logAdminAction(req, 'ADMIN_SYSTEM_CONFIG_UPDATED', `System config updated: ${JSON.stringify(systemConfig)}`);

        return res.json({ message: 'System configuration updated successfully.', systemConfig: settings?.systemConfig || {} });
    } catch {
        return res.status(500).json({ message: 'Failed to update system config.' });
    }
});

router.get('/notifications', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
        const page = Math.max(Number(req.query.page) || 1, 1);
        const skip = (page - 1) * limit;
        const type = String(req.query.type || 'all').trim();
        const q = safeRegex(req.query.q);

        const filter = {
            ...(type !== 'all' ? { type } : {}),
            ...(q ? { $or: [{ title: q }, { message: q }] } : {})
        };

        const [total, items] = await Promise.all([
            Notification.countDocuments(filter),
            Notification.find(filter)
                .populate('userId', 'name fullName email role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return res.json({
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load notifications.' });
    }
});

router.post('/notifications/announce', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const title = String(req.body?.title || '').trim();
        const message = String(req.body?.message || '').trim();
        const targetRole = String(req.body?.targetRole || 'all').trim().toLowerCase();
        const type = String(req.body?.type || 'info').trim();

        if (!title || !message) {
            return res.status(400).json({ message: 'Title and message are required.' });
        }

        const allowedRoles = new Set(['all', 'student', 'employer', 'admin']);
        if (!allowedRoles.has(targetRole)) {
            return res.status(400).json({ message: 'Invalid target role.' });
        }

        const recipientsFilter = targetRole === 'all'
            ? {}
            : targetRole === 'admin'
                ? { role: { $in: ['admin', 'dean', 'hod', 'SuperAdmin', 'CollegeAdmin', 'DeptAdmin'] } }
                : { role: { $in: [targetRole, targetRole.charAt(0).toUpperCase() + targetRole.slice(1)] } };

        const recipients = await User.find(recipientsFilter).select('_id').lean();
        if (!recipients.length) {
            return res.status(404).json({ message: 'No recipients found for this target.' });
        }

        const sourceKeyPrefix = `admin-broadcast:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        const docs = recipients.map((user, index) => ({
            userId: user._id,
            title,
            message,
            type: ['info', 'success', 'warning', 'error'].includes(type) ? type : 'info',
            category: 'general',
            targetRoute: targetRole === 'admin'
                ? '/admin/dashboard'
                : targetRole === 'employer'
                    ? '/employer/dashboard'
                    : '/student/dashboard',
            sourceKey: `${sourceKeyPrefix}:${index}`,
            isRead: false,
            createdAt: new Date()
        }));

        await Notification.insertMany(docs, { ordered: false });

        await logAdminAction(
            req,
            'ADMIN_NOTIFICATION_ANNOUNCEMENT_SENT',
            `Recipients=${recipients.length} TargetRole=${targetRole} Type=${type} Title=${title}`
        );

        return res.status(201).json({
            message: 'Announcement sent successfully.',
            delivered: recipients.length
        });
    } catch {
        return res.status(500).json({ message: 'Failed to send announcement.' });
    }
});

router.get('/users', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const { page, limit, skip } = getPagination(req);
        const q = safeRegex(req.query.q);
        const role = String(req.query.role || 'all').trim();

        const filter = applyUserScopeFilter({
            ...(role && role !== 'all' ? { role: { $regex: new RegExp(`^${role}$`, 'i') } } : {}),
            ...(q ? {
                $or: [
                    { name: q },
                    { fullName: q },
                    { email: q },
                    { department: q },
                    { college: q }
                ]
            } : {})
        }, scope);

        const pipeline = [
            { $match: filter },
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'studentProfile'
                }
            },
            {
                $lookup: {
                    from: 'companyprofiles',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'companyProfile'
                }
            },
            {
                $addFields: {
                    userImg: '$profileImage',
                    studentImg: { $arrayElemAt: ['$studentProfile.profilePicUrl', 0] },
                    companyImg: { $arrayElemAt: ['$companyProfile.logo', 0] }
                }
            },
            {
                $addFields: {
                    profileImage: {
                        $cond: [
                            { $and: [{ $ne: ['$userImg', null] }, { $ne: ['$userImg', ''] }] },
                            '$userImg',
                            {
                                $cond: [
                                    { $and: [{ $ne: ['$studentImg', null] }, { $ne: ['$studentImg', ''] }] },
                                    '$studentImg',
                                    {
                                        $cond: [
                                            { $and: [{ $ne: ['$companyImg', null] }, { $ne: ['$companyImg', ''] }] },
                                            '$companyImg',
                                            null
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $project: {
                    name: 1,
                    fullName: 1,
                    email: 1,
                    role: 1,
                    isVerified: 1,
                    status: 1,
                    accountStatus: 1,
                    department: 1,
                    college: 1,
                    createdAt: 1,
                    profileImage: 1
                }
            }
        ];

        const [total, items] = await Promise.all([
            User.countDocuments(filter),
            User.aggregate(pipeline)
        ]);

        return res.json({
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load users.' });
    }
});

router.get('/users/export', auth, async (req, res) => {
    if (!canExportUsers(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can export users.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const q = safeRegex(req.query.q);
        const role = String(req.query.role || 'all').trim();

        const filter = {
            ...(role && role !== 'all' ? { role } : {}),
            ...(q ? {
                $or: [
                    { name: q },
                    { fullName: q },
                    { email: q },
                    { department: q },
                    { college: q }
                ]
            } : {})
        };

        const users = await User.find(filter)
            .select('name fullName email role department college isVerified status accountStatus createdAt')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Name', 'Email', 'Role', 'Department', 'College', 'Verified', 'Status', 'Account Status', 'Created At'],
            ...users.map((item) => [
                item?.fullName || item?.name || '',
                item?.email || '',
                item?.role || '',
                item?.department || '',
                item?.college || '',
                item?.isVerified ? 'Yes' : 'No',
                item?.status || '',
                item?.accountStatus || '',
                item?.createdAt ? new Date(item.createdAt).toISOString() : ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-users-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_USERS',
            `Rows=${users.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', role: req.query.role || 'all' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export users.' });
    }
});

router.get('/students', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const { page, limit, skip } = getPagination(req);
        const q = safeRegex(req.query.q);
        const department = String(req.query.department || 'all').trim();
        const internshipStatus = String(req.query.internshipStatus || 'all').trim();
        const scopeDepartmentName = String(scope?.department || '').trim();
        const scopeCollegeName = String(scope?.college || '').trim();

        const filter = applyStudentScopeFilter({
            role: { $in: ['student', 'Student'] },
            ...(department && department !== 'all' ? { department } : {}),
            ...(q ? {
                $or: [
                    { name: q },
                    { fullName: q },
                    { email: q },
                    { department: q },
                    { college: q }
                ]
            } : {})
        }, scope);

        const students = await User.find(filter)
            .select('name fullName email department college collegeId departmentId isVerified verificationStatus verificationRequestedAt verificationReviewedAt verificationNote rejectionReason status accountStatus profileImage createdAt')
            .sort({ createdAt: -1 })
            .lean();

        const visibleStudents = scope?.adminType === 'deptadmin'
            ? students.filter((student) => {
                const departmentIdMatch = scope?.departmentId && String(student?.departmentId || '') === String(scope.departmentId);
                const departmentNameMatch = academicNameMatches(student?.department || '', scopeDepartmentName);

                return departmentIdMatch || departmentNameMatch;
            })
            : students;

        const studentIds = visibleStudents.map((item) => item?._id).filter(Boolean);
        let statusByStudentId = new Map();
        let companyByStudentId = new Map();
        let progressByStudentId = new Map();

        if (studentIds.length > 0) {
            const [applicationStatuses, profiles] = await Promise.all([
                Application.aggregate([
                    { $match: { studentId: { $in: studentIds } } },
                    { $sort: { updatedAt: -1, createdAt: -1 } },
                    { $group: { _id: '$studentId', status: { $first: '$status' }, companyId: { $first: '$companyId' }, internshipId: { $first: '$internshipId' } } }
                ]),
                Profile.find({ userId: { $in: studentIds } }).lean()
            ]);

            statusByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), String(item?.status || '')])
            );

            // Also map assigned company/internship for quick lookups
            companyByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), item?.companyId || null])
            );

            progressByStudentId = new Map(
                profiles.map((item) => [String(item?.userId || ''), item])
            );
        }

            const withInternshipData = visibleStudents.map((student) => {
            const studentId = String(student?._id || '');
            const rawStatus = statusByStudentId.get(studentId) || '';
            const assignedCompany = companyByStudentId.get(studentId) || null;
            const profile = progressByStudentId.get(studentId);

            let normalizedInternshipStatus = 'Not Applied';
            if (['Placed', 'Accepted'].includes(rawStatus)) normalizedInternshipStatus = 'Placed';
            else if (['Pending', 'Under Review', 'Interview', 'Seen', 'Shortlisted', 'Offered'].includes(rawStatus)) normalizedInternshipStatus = 'In Progress';
            else if (['Rejected', 'Withdrawn'].includes(rawStatus)) normalizedInternshipStatus = 'Not Placed';

            let progress = 0;
            // Strict Database Check for Progress
            if (['Placed', 'Accepted'].includes(rawStatus)) {
                progress = 100; // Successfully Placed
            } else if (rawStatus === 'Interview') {
                progress = 75; // Advanced Stage
            } else if (['Pending', 'Under Review', 'Seen', 'Shortlisted', 'Offered'].includes(rawStatus)) {
                progress = 50; // Active Applicant
            } else if (rawStatus === 'Rejected') {
                progress = 25; // Attempted but currently not placed
            } else {
                progress = 0; // No real progress detected in DB
            }

            const verificationStatus = String(student?.verificationStatus || '').trim()
                || (student?.isVerified ? 'Verified' : 'Not Submitted');

            return {
                ...student,
                assignedCompanyId: assignedCompany || null,
                fullName: student.fullName || student.name || '',
                full_name: student.fullName || student.name || '',
                profilePicture: profile?.profilePicUrl || student.profileImage || '',
                profile_picture: profile?.profilePicUrl || student.profileImage || '',
                verificationStatus,
                status: verificationStatus,
                internshipStatus: normalizedInternshipStatus,
                progress: Math.max(0, Math.min(100, Math.round(progress))),
                profileDetails: profile ? {
                    phone: profile.personalInfo?.phone || student.phone || '',
                    bio: profile.personalInfo?.bio || '',
                    address: profile.personalInfo?.address || '',
                    yearOfStudy: profile.personalInfo?.yearOfStudy || '',
                    college: student.college || profile.personalInfo?.college || '',
                    gpa: profile.academicInfo?.gpa || '',
                    skills: profile.academicInfo?.skills || [],
                    resumeUrl: profile.resumeUrl || '',
                    profilePicUrl: profile.profilePicUrl || student.profileImage || '',
                    portfolio: profile.portfolioLinks || {}
                } : null
            };
        });

        const filteredByStatus = internshipStatus && internshipStatus !== 'all'
            ? withInternshipData.filter((student) => String(student?.internshipStatus || '') === internshipStatus)
            : withInternshipData;

        const pagedItems = filteredByStatus.slice(skip, skip + limit);
        const total = filteredByStatus.length;

        const departmentOptions = [...new Set(visibleStudents.map((student) => String(student?.department || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));

        return res.json({
            items: pagedItems,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            },
            filters: {
                departments: departmentOptions,
                internshipStatuses: ['Placed', 'In Progress', 'Not Placed', 'Not Applied']
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load students.' });
    }
});

router.get('/students/:id', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const { id } = req.params;
        const student = await User.findById(id)
            .select('name fullName email department college collegeId departmentId isVerified verificationStatus verificationRequestedAt verificationReviewedAt verificationNote rejectionReason status accountStatus profileImage createdAt')
            .lean();

        if (!student) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [applications, profile] = await Promise.all([
            Application.find({ studentId: id }).lean(),
            Profile.findOne({ userId: id }).lean()
        ]);

        let normalizedInternshipStatus = 'Not Applied';
        if (applications.length > 0) {
            const statusPriority = {
                'Placed': 6,
                'Accepted': 5,
                'Interview': 4,
                'Shortlisted': 3,
                'Seen': 2,
                'Pending': 2,
                'Under Review': 2,
                'Rejected': 1,
                'Withdrawn': 1
            };

            let highestRank = -1;
            let rawStatus = 'Pending';

            applications.forEach(app => {
                const rank = statusPriority[app.status] || 0;
                if (rank > highestRank) {
                    highestRank = rank;
                    rawStatus = app.status;
                }
            });

            if (['Placed', 'Accepted'].includes(rawStatus)) normalizedInternshipStatus = 'Placed';
            else if (['Pending', 'Under Review', 'Interview', 'Seen', 'Shortlisted', 'Offered'].includes(rawStatus)) normalizedInternshipStatus = 'In Progress';
            else if (['Rejected', 'Withdrawn'].includes(rawStatus)) normalizedInternshipStatus = 'Not Placed';
        }

        const data = {
            ...student,
            verificationStatus: String(student?.verificationStatus || '').trim()
                || (student?.isVerified ? 'Verified' : 'Not Submitted'),
            internshipStatus: normalizedInternshipStatus,
            profileDetails: profile ? {
                phone: profile.personalInfo?.phone || student.phone || '',
                bio: profile.personalInfo?.bio || '',
                address: profile.personalInfo?.address || '',
                yearOfStudy: profile.personalInfo?.yearOfStudy || '',
                college: student.college || profile.personalInfo?.college || '',
                gpa: profile.academicInfo?.gpa || '',
                skills: profile.academicInfo?.skills || [],
                resumeUrl: profile.resumeUrl || '',
                profilePicUrl: profile.profilePicUrl || student.profileImage || '',
                portfolio: profile.portfolioLinks || {}
            } : null
        };

        return res.json({ item: data });
    } catch {
        return res.status(500).json({ message: 'Failed to fetch student profile.' });
    }
});



router.get('/students/export', auth, async (req, res) => {
    if (!canExportStudents(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin or CollegeAdmin can export students.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const scope = await getAdminScope(req);
        const q = safeRegex(req.query.q);
        const department = String(req.query.department || 'all').trim();
        const internshipStatus = String(req.query.internshipStatus || 'all').trim();
        const filter = applyStudentScopeFilter({
            role: { $in: ['student', 'Student'] },
            ...(department && department !== 'all' ? { department } : {}),
            ...(q ? {
                $or: [
                    { name: q },
                    { fullName: q },
                    { email: q },
                    { department: q },
                    { college: q }
                ]
            } : {})
        }, scope);

        const students = await User.find(filter)
            .select('name fullName email college department isVerified status accountStatus createdAt')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const studentIds = students.map((item) => item?._id).filter(Boolean);
        let statusByStudentId = new Map();
        let progressByStudentId = new Map();

        if (studentIds.length > 0) {
            const [applicationStatuses, profiles] = await Promise.all([
                Application.aggregate([
                    { $match: { studentId: { $in: studentIds } } },
                    {
                        $addFields: {
                            statusRank: {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ['$status', 'Placed'] }, then: 6 },
                                        { case: { $eq: ['$status', 'Accepted'] }, then: 5 },
                                        { case: { $eq: ['$status', 'Interview'] }, then: 4 },
                                        { case: { $eq: ['$status', 'Under Review'] }, then: 3 },
                                        { case: { $eq: ['$status', 'Pending'] }, then: 2 },
                                        { case: { $eq: ['$status', 'Rejected'] }, then: 1 }
                                    ],
                                    default: 0
                                }
                            }
                        }
                    },
                    { $sort: { statusRank: -1, updatedAt: -1, createdAt: -1 } },
                    { $group: { _id: '$studentId', status: { $first: '$status' }, companyId: { $first: '$companyId' }, internshipId: { $first: '$internshipId' } } }
                ]),
                Profile.find({ userId: { $in: studentIds } })
                    .select('userId profileStrength')
                    .lean()
            ]);

            statusByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), String(item?.status || '')])
            );

            const companyByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), item?.companyId || null])
            );

            progressByStudentId = new Map(
                profiles.map((item) => [String(item?.userId || ''), Number(item?.profileStrength || 0)])
            );
        }

        const enrichedStudents = students.map((student) => {
            const studentId = String(student?._id || '');
            const rawStatus = statusByStudentId.get(studentId) || '';

            let normalizedInternshipStatus = 'Not Applied';
            if (['Placed', 'Accepted'].includes(rawStatus)) normalizedInternshipStatus = 'Placed';
            else if (['Pending', 'Under Review', 'Interview', 'Seen', 'Shortlisted', 'Offered'].includes(rawStatus)) normalizedInternshipStatus = 'In Progress';
            else if (['Rejected', 'Withdrawn'].includes(rawStatus)) normalizedInternshipStatus = 'Not Placed';

            const profileProgress = progressByStudentId.get(studentId);
            let progress = Number.isFinite(profileProgress) ? profileProgress : 0;
            if (!Number.isFinite(profileProgress) || profileProgress <= 0) {
                if (normalizedInternshipStatus === 'Placed') progress = 100;
                else if (normalizedInternshipStatus === 'In Progress') progress = 65;
                else if (normalizedInternshipStatus === 'Not Placed') progress = 40;
                else progress = 20;
            }

            const assignedCompany = companyByStudentId.get(studentId) || null;

            return {
                ...student,
                assignedCompanyId: assignedCompany || null,
                internshipStatus: normalizedInternshipStatus,
                progress: Math.max(0, Math.min(100, Math.round(progress)))
            };
        });

        const filteredStudents = internshipStatus && internshipStatus !== 'all'
            ? enrichedStudents.filter((student) => String(student?.internshipStatus || '') === internshipStatus)
            : enrichedStudents;

        const rows = [
            ['Name', 'Email', 'College', 'Department', 'Internship Status', 'Progress %', 'Verified', 'Status', 'Account Status', 'Created At'],
            ...filteredStudents.map((item) => [
                item?.fullName || item?.name || '',
                item?.email || '',
                item?.college || '',
                item?.department || '',
                item?.internshipStatus || '',
                item?.progress ?? '',
                item?.isVerified ? 'Yes' : 'No',
                item?.status || '',
                item?.accountStatus || '',
                item?.createdAt ? new Date(item.createdAt).toISOString() : ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-students-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_STUDENTS',
            `Rows=${filteredStudents.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', department: req.query.department || 'all', internshipStatus: req.query.internshipStatus || 'all' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export students.' });
    }
});

router.get('/companies', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const { page, limit, skip } = getPagination(req);
        const q = safeRegex(req.query.q);
        const verification = String(req.query.verification || 'all').trim();

        const filter = {
            ...(verification && verification !== 'all' ? { 'verification.status': verification } : {}),
            ...(q ? {
                $or: [
                    { companyName: q },
                    { industryType: q },
                    { hqLocation: q },
                    { officialEmail: q }
                ]
            } : {})
        };

        const [total, items] = await Promise.all([
            CompanyProfile.countDocuments(filter),
            CompanyProfile.find(filter)
                .select('companyName logo industryType hqLocation verification isActive user representative createdAt')
                .populate('user', 'name fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        const enhancedItems = items.map((item) => ({
            ...item,
            fraud: evaluateCompanyFraudRisk(item)
        }));

        return res.json({
            items: enhancedItems,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load companies.' });
    }
});

router.get('/companies/:id', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        let profile = await CompanyProfile.findById(req.params.id)
            .populate('user', 'name fullName email role isVerified createdAt')
            .lean();

        if (!profile) {
            profile = await CompanyProfile.findOne({ user: req.params.id })
                .populate('user', 'name fullName email role isVerified createdAt')
                .lean();
        }

        if (!profile) {
            return res.status(404).json({ message: 'Company profile not found.' });
        }

        return res.json({ item: profile });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load company profile.' });
    }
});

router.get('/companies/export', auth, async (req, res) => {
    if (!canExportCompanies(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can export companies.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const q = safeRegex(req.query.q);
        const verification = String(req.query.verification || 'all').trim();

        const filter = {
            ...(verification && verification !== 'all' ? { 'verification.status': verification } : {}),
            ...(q ? {
                $or: [
                    { companyName: q },
                    { industryType: q },
                    { hqLocation: q },
                    { officialEmail: q }
                ]
            } : {})
        };

        const companies = await CompanyProfile.find(filter)
            .select('companyName industryType hqLocation verification isActive user representative createdAt')
            .populate('user', 'name fullName email')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Company', 'Representative', 'Email', 'Industry', 'Location', 'Verification', 'Active', 'Created At'],
            ...companies.map((item) => [
                item?.companyName || '',
                item?.representative?.name || item?.user?.fullName || item?.user?.name || '',
                item?.user?.email || '',
                item?.industryType || '',
                item?.hqLocation || '',
                item?.verification?.status || '',
                item?.isActive ? 'Yes' : 'No',
                item?.createdAt ? new Date(item.createdAt).toISOString() : ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-companies-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_COMPANIES',
            `Rows=${companies.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', verification: req.query.verification || 'all' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export companies.' });
    }
});

router.get('/internships', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const scopedDepartmentNames = await getScopedDepartmentNames(scope);
        const effectiveDepartmentNames = scope?.adminType === 'superadmin'
            ? []
            : (scopedDepartmentNames.length ? scopedDepartmentNames : ['__no_department_match__']);
        const { page, limit, skip } = getPagination(req);
        const q = safeRegex(req.query.q);
        const status = String(req.query.status || 'all').trim();

        const filter = {
            ...(status && status !== 'all' ? { status: status.charAt(0).toUpperCase() + status.slice(1) } : {}),
            ...(q ? {
                $or: [
                    { title: q },
                    { location: q },
                    { description: q }
                ]
            } : {})
        };

        const scopedFilter = applyDepartmentScopeFilter(filter, effectiveDepartmentNames);
        const pendingFilter = applyDepartmentScopeFilter({ status: 'Pending' }, effectiveDepartmentNames);
        const openFilter = applyDepartmentScopeFilter({ status: 'Open' }, effectiveDepartmentNames);
        const closedFilter = applyDepartmentScopeFilter({ status: 'Closed' }, effectiveDepartmentNames);

        const [total, items, totalPending, totalOpen, totalClosed] = await Promise.all([
            Internship.countDocuments(scopedFilter),
            Internship.find(scopedFilter)
                .select('title location status studentsNeeded deadline companyId createdAt')
                .populate('companyId', 'name fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Internship.countDocuments(pendingFilter),
            Internship.countDocuments(openFilter),
            Internship.countDocuments(closedFilter)
        ]);

        return res.json({
            items,
            stats: {
                pending: Number(totalPending || 0),
                open: Number(totalOpen || 0),
                closed: Number(totalClosed || 0)
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load internships.' });
    }
});

router.get('/internships/export', auth, async (req, res) => {
    if (!canExportInternships(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin or CollegeAdmin can export internships.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const scope = await getAdminScope(req);
        const scopedDepartmentNames = await getScopedDepartmentNames(scope);
        const effectiveDepartmentNames = scope?.adminType === 'superadmin'
            ? []
            : (scopedDepartmentNames.length ? scopedDepartmentNames : ['__no_department_match__']);
        const q = safeRegex(req.query.q);
        const status = String(req.query.status || 'all').trim();

        const filter = {
            ...(status && status !== 'all' ? { status: status.charAt(0).toUpperCase() + status.slice(1) } : {}),
            ...(q ? {
                $or: [
                    { title: q },
                    { location: q },
                    { description: q }
                ]
            } : {})
        };

        const scopedFilter = applyDepartmentScopeFilter(filter, effectiveDepartmentNames);

        const internships = await Internship.find(scopedFilter)
            .select('title location status studentsNeeded deadline companyId createdAt')
            .populate('companyId', 'name fullName email')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Title', 'Company', 'Email', 'Location', 'Students Needed', 'Status', 'Deadline', 'Created At'],
            ...internships.map((item) => [
                item?.title || '',
                item?.companyId?.fullName || item?.companyId?.name || '',
                item?.companyId?.email || '',
                item?.location || '',
                item?.studentsNeeded ?? '',
                item?.status || '',
                item?.deadline ? new Date(item.deadline).toISOString() : '',
                item?.createdAt ? new Date(item.createdAt).toISOString() : ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-internships-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_INTERNSHIPS',
            `Rows=${internships.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', status: req.query.status || 'all' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export internships.' });
    }
});

router.get('/applications', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const scopedStudentIds = await getScopedStudentIds(scope);
        const { page, limit, skip } = getPagination(req);
        const q = String(req.query.q || '').trim();
        const status = String(req.query.status || 'all').trim();

        let studentIds = [];
        let internshipIds = [];
        if (q) {
            const regex = safeRegex(q);
            const [users, internships] = await Promise.all([
                User.find({ $or: [{ name: regex }, { fullName: regex }, { email: regex }] }).select('_id').lean(),
                Internship.find({ title: regex }).select('_id').lean()
            ]);
            studentIds = users.map((item) => item._id);
            internshipIds = internships.map((item) => item._id);
        }

        const filter = {
            ...(status && status !== 'all'
                ? status === 'Accepted' || status === 'Placed'
                    ? { status: { $in: ['Accepted', 'Placed'] } }
                    : { status }
                : {}),
            ...((scope.adminType === 'collegeadmin' || scope.adminType === 'deptadmin')
                ? { studentId: { $in: scopedStudentIds.length ? scopedStudentIds : [null] } }
                : {}),
            ...(q ? {
                $or: [
                    { remarks: safeRegex(q) },
                    { studentId: { $in: studentIds.length ? studentIds : [null] } },
                    { internshipId: { $in: internshipIds.length ? internshipIds : [null] } }
                ]
            } : {})
        };

        const [total, items, pending, underReview, interview, accepted, rejected] = await Promise.all([
            Application.countDocuments(filter),
            Application.find(filter)
                .select('studentId internshipId status matchingScore match_score createdAt')
                .populate('studentId', 'name fullName email')
                .populate('internshipId', 'title location requiredSkills targetDepartments department')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
            , Application.countDocuments({ ...filter, status: 'Pending' }),
            Application.countDocuments({ ...filter, status: 'Under Review' }),
            Application.countDocuments({ ...filter, status: 'Interview' }),
            Application.countDocuments({ ...filter, status: { $in: ['Accepted', 'Placed'] } }),
            Application.countDocuments({ ...filter, status: 'Rejected' })
        ]);

        const enrichedItems = items.map(app => {
            const camel = Number(app?.matchingScore);
            const snake = Number(app?.match_score);
            const camelValue = Number.isFinite(camel) ? camel : 0;
            const snakeValue = Number.isFinite(snake) ? snake : 0;
            const finalScore = Math.max(camelValue, snakeValue);

            return {
                ...app,
                matchingScore: finalScore,
                match_score: finalScore,
                matchScore: finalScore
            };
        });

        return res.json({
            items: enrichedItems,
            stats: {
                pending: Number(pending || 0),
                underReview: Number(underReview || 0),
                interview: Number(interview || 0),
                accepted: Number(accepted || 0),
                rejected: Number(rejected || 0)
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load applications.' });
    }
});

router.put('/companies/:id/verification', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can update company verification.' });
    }
    const status = String(req.body?.status || '').trim();
    req.body = req.body || {};
    req.body.status = status;
    return updateCompanyStatus(req, res);
});

router.put('/internships/:id/status', auth, async (req, res) => {
    if (!canManageInternshipStatus(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin or CollegeAdmin can update internship status.' });
    }

    try {
        const allowedStatuses = new Set(['Open', 'Closed']);
        const status = String(req.body?.status || '').trim();
        if (!allowedStatuses.has(status)) {
            return res.status(400).json({ message: 'Invalid internship status.' });
        }

        const internship = await Internship.findByIdAndUpdate(
            req.params.id,
            { $set: { status } },
            { returnDocument: 'after' }
        )
            .select('title location status description studentsNeeded deadline companyId createdAt')
            .populate('companyId', 'name fullName email')
            .lean();

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found.' });
        }

        // 🚀 Trigger Email Notifications if newly opened
        if (status === 'Open') {
            console.log(`🚀 Internship [${internship.title}] was approved. Starting notification fan-out...`);
            const { sendEmail } = require('../utils/mailer');
            const UserPreferences = require('../models/UserPreferences');

            try {
                // Fetch all students
                const students = await User.find({ role: { $in: ['student', 'Student'] } })
                    .select('_id email name fullName')
                    .lean();

                console.log(`👥 Found ${students.length} total students in database.`);

                const studentIds = students.map(s => s._id);

                // Filter out only those who specifically disabled emailAlerts
                const optOutPrefs = await UserPreferences.find({
                    userId: { $in: studentIds },
                    'notifications.emailAlerts': false
                }).select('userId').lean();

                const optOutIds = new Set(optOutPrefs.map(p => String(p.userId)));
                const targets = students.filter(s => !optOutIds.has(String(s._id)));

                console.log(`📣 Target list finalized: ${targets.length} students to be notified.`);

                if (targets.length) {
                    const companyName = internship.companyId?.fullName || internship.companyId?.name || 'A Partner Company';
                    targets.forEach((student, index) => {
                        console.log(`📧 Queuing email to: ${student.email} (${index + 1}/${targets.length})`);
                        sendEmail({
                            to: student.email,
                            subject: `New Internship Opportunity: ${internship.title}`,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h2 style="color: #0891b2;">🚀 New Internship Published!</h2>
                                    <p>Hello ${student.name || student.fullName},</p>
                                    <p>The internship <strong>${internship.title}</strong> by <strong>${companyName}</strong> has just been approved and is now open for applications!</p>
                                    <div style="background: #f0f9ff; padding: 15px; border-radius: 12px; border: 1px solid #bae6fd; margin: 20px 0;">
                                        <h3 style="margin: 0; color: #0369a1;">${internship.title}</h3>
                                        <p style="margin: 5px 0; font-size: 14px;">📍 Location: ${internship.location || 'Remote'}</p>
                                        <p style="margin: 10px 0; color: #475569;">${internship.description ? internship.description.substring(0, 150) + '...' : ''}</p>
                                    </div>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/student/internships" 
                                       style="display: inline-block; background: #0891b2; color: white; padding: 12px 30px; border-radius: 50px; text-decoration: none; font-weight: bold;">
                                        Apply Now
                                    </a>
                                </div>
                            `
                        });
                    });
                } else {
                    console.warn('⚠️ No eligible students found for notification.');
                }
            } catch (err) {
                console.error("❌ Admin approval email fan-out failed:", err);
            }
        }

        await logAdminAction(
            req,
            'ADMIN_INTERNSHIP_STATUS_UPDATED',
            `Internship=${internship?.title || internship?._id} Status=${status}`
        );

        return res.json({ message: 'Internship status updated.', item: internship });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to update internship status.' });
    }
});

router.put('/applications/:id/status', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const allowedStatuses = new Set(['Pending', 'Under Review', 'Interview', 'Accepted', 'Rejected']);
        const status = String(req.body?.status || '').trim();
        const remarks = String(req.body?.remarks || '').trim();
        if (!allowedStatuses.has(status)) {
            return res.status(400).json({ message: 'Invalid application status.' });
        }
        if (status === 'Rejected' && !remarks) {
            return res.status(400).json({ message: 'Remarks are required when rejecting an application.' });
        }

        const item = await Application.findByIdAndUpdate(
            req.params.id,
            {
                $set: { status, remarks, updatedAt: Date.now() },
                $push: {
                    timeline: {
                        status,
                        date: new Date(),
                        comment: remarks
                    }
                }
            },
            { returnDocument: 'after' }
        )
            .select('studentId internshipId status matchingScore createdAt timeline remarks')
            .populate('studentId', 'name fullName email')
            .populate('internshipId', 'title')
            .lean();

        if (!item) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        await logAdminAction(
            req,
            'ADMIN_APPLICATION_STATUS_UPDATED',
            `Application=${item?._id} Status=${status} Internship=${item?.internshipId?.title || 'N/A'} Remarks=${remarks || '-'}`
        );

        // If admin marked an application as Accepted or Placed, ensure the student's User record reflects placement
        try {
            if (['Accepted', 'Placed'].includes(String(item?.status || '').trim())) {
                await User.findByIdAndUpdate(item.studentId, { internshipStatus: 'Placed', status: 'PLACED' }).catch(() => {});
            }
        } catch (e) {
            // non-critical
        }

        return res.json({ message: 'Application status updated.', item });
    } catch {
        return res.status(500).json({ message: 'Failed to update application status.' });
    }
});

// 1. Governance Structure: Get & Create Colleges/Departments
router.get('/colleges', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const collegeFilter = scope.adminType === 'superadmin'
            ? {}
            : scope?.collegeId
                ? { _id: scope.collegeId }
                : scope?.college
                    ? { name: scope.college }
                    : { _id: null };

        const colleges = await College.find(collegeFilter)
            .populate('dean', 'name fullName email phone role createdAt')
            .sort({ name: 1 })
            .lean();

        const collegeIds = colleges.map((college) => college._id);
        const departments = await Department.find({
            $or: [
                { college: { $in: collegeIds } },
                { collegeId: { $in: collegeIds } }
            ]
        }).select('college collegeId').lean();

        const departmentCounts = departments.reduce((accumulator, item) => {
            // try both fields
            const key = String(item?.college || item?.collegeId || '');
            if (key) accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});

        res.json(colleges.map((college) => ({
            ...college,
            departmentCount: departmentCounts[String(college._id)] || 0
        })));
    } catch (err) { res.status(500).send("Fetch failed."); }
});

router.get('/college-deans', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const deansFilter = {
            role: { $in: ['dean', 'collegeadmin', 'CollegeAdmin'] }
        };

        if (scope.adminType === 'collegeadmin') {
            if (scope?.college) {
                deansFilter.college = scope.college;
            } else if (scope?.collegeId) {
                deansFilter.collegeId = scope.collegeId;
            } else {
                deansFilter._id = null;
            }
        }

        if (scope.adminType === 'deptadmin') {
            deansFilter._id = null;
        }

        const deans = await User.find(deansFilter)
            .select('name fullName email role college createdAt')
            .sort({ fullName: 1, name: 1 })
            .lean();

        return res.json(deans.filter(isDeanUser));
    } catch {
        return res.status(500).json({ message: 'Failed to load dean candidates.' });
    }
});

router.post('/add-college', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ msg: "SuperAdmin access only." });
    try {
        const name = String(req.body.name || '').trim();
        const deanId = String(req.body.deanId || '').trim();

        if (!name) {
            return res.status(400).json({ message: 'College name is required.' });
        }

        const existing = await College.findOne({ name }).lean();
        if (existing) {
            return res.status(409).json({ message: 'A college with this name already exists.' });
        }

        let deanUser = null;
        if (deanId) {
            deanUser = await User.findById(deanId).select('name fullName email role college').lean();
            if (!deanUser || !isDeanUser(deanUser)) {
                return res.status(400).json({ message: 'Please choose a valid dean user account.' });
            }
        }

        const college = await College.create({
            name,
            dean: deanUser?._id || null,
            deanId: deanUser?._id || null
        });

        if (deanUser?._id) {
            await User.findByIdAndUpdate(deanUser._id, { college: name, collegeId: college._id });
        }

        const populated = await College.findById(college._id).populate('dean', 'name fullName email phone role college').lean();
        res.status(201).json({ msg: "College added successfully", college: populated });
    } catch (err) { res.status(500).json({ error: "Failed to create college." }); }
});

router.post('/colleges', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ msg: "SuperAdmin access only." });
    try {
        const name = String(req.body.name || '').trim();
        const deanId = String(req.body.deanId || '').trim();
        const deanName = String(req.body?.dean?.name || '').trim();
        const deanEmail = String(req.body?.dean?.email || '').toLowerCase().trim();
        const deanPhone = String(req.body?.dean?.phone || '').trim();

        if (!name) {
            return res.status(400).json({ message: 'College name is required.' });
        }

        const existing = await College.findOne({ name }).lean();
        if (existing) {
            return res.status(409).json({ message: 'A college with this name already exists.' });
        }

        let deanUser = null;
        let temporaryPassword = '';
        if (deanId) {
            deanUser = await User.findById(deanId).select('name fullName email role college').lean();
            if (!deanUser || !isDeanUser(deanUser)) {
                return res.status(400).json({ message: 'Please choose a valid dean user account.' });
            }
        } else if (deanName && deanEmail) {
            if (await User.findOne({ email: deanEmail }).lean()) {
                return res.status(409).json({ message: 'An account with this dean email already exists.' });
            }

            temporaryPassword = createRandomPassword();
            const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
            deanUser = await User.create({
                name: deanName,
                fullName: deanName,
                email: deanEmail,
                phone: deanPhone,
                password: hashedPassword,
                role: 'dean',
                isFirstLogin: true,
                college: name,
                collegeId: null
            });
        }

        const college = await College.create({
            name,
            dean: deanUser?._id || null,
            deanId: deanUser?._id || null
        });

        if (deanUser?._id) {
            await User.findByIdAndUpdate(deanUser._id, { college: name, collegeId: college._id });
        }

        let credentialsEmailSent = false;
        let credentialsEmailError = '';
        if (temporaryPassword && deanUser?.email) {
            try {
                await sendGovernanceAccountEmail({
                    to: deanUser.email,
                    name: deanUser.name || deanUser.fullName,
                    role: 'Dean',
                    password: temporaryPassword,
                    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
                });
                credentialsEmailSent = true;
            } catch (mailError) {
                credentialsEmailError = String(mailError?.message || 'Email delivery failed');
            }
        }

        const populated = await College.findById(college._id).populate('dean', 'name fullName email phone role college').lean();
        res.status(201).json({
            college: populated,
            temporaryPassword: temporaryPassword || null,
            credentialsEmailSent,
            credentialsEmailError: credentialsEmailError || null,
            message: temporaryPassword
                ? (credentialsEmailSent
                    ? 'College and dean account created successfully. Credentials email sent.'
                    : 'College and dean account created. Credentials email was not sent; use temporaryPassword in this response.')
                : 'College created successfully.'
        });
    } catch (err) { res.status(500).send("Failed to create college."); }
});

router.put('/colleges/:id/dean', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'SuperAdmin access only.' });

    try {
        const deanId = String(req.body.deanId || '').trim();
        let deanUser = null;

        if (deanId) {
            deanUser = await User.findById(deanId).select('name fullName email role college').lean();
            if (!deanUser || !isDeanUser(deanUser)) {
                return res.status(400).json({ message: 'Please choose a valid dean user account.' });
            }
        }

        const college = await College.findByIdAndUpdate(
            req.params.id,
            { $set: { dean: deanUser?._id || null, deanId: deanUser?._id || null } },
            { returnDocument: 'after' }
        )
            .populate('dean', 'name fullName email phone role college')
            .lean();

        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        if (deanUser?._id) {
            await User.findByIdAndUpdate(deanUser._id, { college: college.name, collegeId: college._id });
        }

        return res.json({ message: 'Dean assigned successfully.', college });
    } catch {
        return res.status(500).json({ message: 'Failed to assign dean.' });
    }
});

router.post('/colleges/:id/dean/reset-password', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'SuperAdmin access only.' });

    try {
        const college = await College.findById(req.params.id)
            .populate('dean', 'name fullName email phone role')
            .lean();

        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        const deanUser = college?.dean;
        if (!deanUser?._id || !deanUser?.email) {
            return res.status(400).json({ message: 'No dean is assigned to this college.' });
        }

        const temporaryPassword = createRandomPassword();
        let emailSent = true;

        try {
            await sendGovernanceAccountEmail({
                to: deanUser.email,
                name: deanUser.name || deanUser.fullName,
                role: 'Dean',
                password: temporaryPassword,
                loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
            });
        } catch (mailError) {
            emailSent = false;
            console.log("Email delivery skipped or offline. Password will be updated in database anyway.");
        }

        const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
        await User.findByIdAndUpdate(deanUser._id, {
            $set: {
                password: hashedPassword,
                isFirstLogin: true
            }
        });

        await logAdminAction(
            req,
            'ADMIN_DEAN_PASSWORD_RESET',
            `College=${college?.name || ''} Dean=${deanUser?.email || ''}`
        );

        return res.json({
            message: emailSent
                ? `Dean password reset successfully. Credentials were sent by email to ${deanUser.email}.`
                : `Dean password updated! (Email system offline). Temporary Password: ${temporaryPassword}`
        });
    } catch (err) {
        console.error('Failed to reset dean password:', err);
        return res.status(500).json({ message: (err && err.message) || 'Failed to reset dean password.' });
    }
});

router.get('/colleges/export', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can export colleges.' });
    }

    try {
        const colleges = await College.find({})
            .populate('dean', 'name fullName email')
            .sort({ createdAt: -1 })
            .lean();

        const collegeIds = colleges.map((college) => college?._id).filter(Boolean);
        const departmentDocs = await Department.find({ college: { $in: collegeIds } }).select('college').lean();
        const departmentCounts = departmentDocs.reduce((accumulator, item) => {
            const key = String(item?.college || '');
            accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});

        const rows = [
            ['College', 'Dean Name', 'Dean Email', 'Departments', 'Status', 'Created At'],
            ...colleges.map((college) => {
                const count = Number(departmentCounts[String(college?._id)] || 0);
                const hasDean = Boolean(college?.dean?._id || college?.dean);
                const status = hasDean && count > 0 ? 'Active' : hasDean ? 'Partial' : 'Missing';
                return [
                    college?.name || '',
                    college?.dean?.fullName || college?.dean?.name || '',
                    college?.dean?.email || '',
                    count,
                    status,
                    college?.createdAt ? new Date(college.createdAt).toISOString() : ''
                ];
            })
        ];

        const csv = toCsv(rows);
        const filename = `admin-colleges-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_COLLEGES',
            `Rows=${colleges.length}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export colleges.' });
    }
});

router.put('/colleges/:id', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ message: 'SuperAdmin access only.' });

    try {
        const name = String(req.body?.name || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'College name is required.' });
        }

        const duplicate = await College.findOne({
            _id: { $ne: req.params.id },
            name
        }).lean();
        if (duplicate) {
            return res.status(409).json({ message: 'A college with this name already exists.' });
        }

        const college = await College.findByIdAndUpdate(
            req.params.id,
            { $set: { name } },
            { returnDocument: 'after' }
        )
            .populate('dean', 'name fullName email role college')
            .lean();

        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        if (college.dean?._id) {
            const updates = { college: college.name, collegeId: college._id };
            
            if (req.body?.dean) {
                if (req.body.dean.name !== undefined) {
                    updates.name = req.body.dean.name;
                    updates.fullName = req.body.dean.name;
                }
                if (req.body.dean.email !== undefined) {
                    updates.email = req.body.dean.email.toLowerCase().trim();
                }
                if (req.body.dean.phone !== undefined) {
                    updates.phone = req.body.dean.phone;
                }
            }

            const updatedDean = await User.findByIdAndUpdate(
                college.dean._id, 
                updates,
                { returnDocument: 'after' }
            ).select('name fullName email phone role college createdAt').lean();
            
            college.dean = updatedDean;
        }

        return res.json({ message: 'College updated successfully.', college });
    } catch {
        return res.status(500).json({ message: 'Failed to update college.' });
    }
});

router.delete('/colleges/:id', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ msg: "SuperAdmin access only." });
    try {
        const college = await College.findById(req.params.id);
        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }
        
        // Delete the associated dean user account
        const deanId = college.dean || college.deanId;
        if (deanId) {
            await User.findByIdAndDelete(deanId);
        }

        await College.findByIdAndDelete(req.params.id);
        res.json({ msg: "College and associated dean account removed." });
    } catch (err) { res.status(500).send("Delete failed."); }
});

router.get('/departments', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        let collegeId = scope?.collegeId || null;
        if (!collegeId && scope?.college && scope.adminType !== 'superadmin') {
            const college = await College.findOne({ name: scope.college }).select('_id').lean();
            collegeId = college?._id || null;
        }

        const departmentFilter = {};
        if (scope.adminType !== 'superadmin') {
            if (collegeId) {
                departmentFilter.college = collegeId;
            } else {
                departmentFilter._id = null;
            }
        }
        if (scope.adminType === 'deptadmin') {
            if (scope?.departmentId) {
                departmentFilter._id = scope.departmentId;
            } else if (scope?.department) {
                departmentFilter.name = scope.department;
            }
        }

        const departments = await Department.find(departmentFilter)
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role createdAt')
            .sort({ name: 1 })
            .lean();

        const studentUsers = await User.find({ role: { $in: ['student', 'Student'] } })
            .select('_id college collegeId department departmentId')
            .lean();

        const departmentById = new Map(
            departments.map((department) => [String(department?._id || ''), department])
        );

        const collegeCandidates = [];
        const collegeById = new Map();
        const collegeByName = new Map();
        departments.forEach((department) => {
            const collegeIdKey = String(department?.college?._id || department?.collegeId || department?.college || '').trim();
            const collegeName = String(department?.college?.name || '').trim();
            if (!collegeIdKey || collegeById.has(collegeIdKey)) return;
            const candidate = { _id: collegeIdKey, name: collegeName };
            collegeById.set(collegeIdKey, candidate);
            if (collegeName) collegeByName.set(canonicalizeAcademicName(collegeName), candidate);
            collegeCandidates.push(candidate);
        });

        const studentCountAccumulator = {};
        studentUsers.forEach((student) => {
            const explicitDepartmentId = String(student?.departmentId || '').trim();
            if (explicitDepartmentId && departmentById.has(explicitDepartmentId)) {
                studentCountAccumulator[explicitDepartmentId] = (studentCountAccumulator[explicitDepartmentId] || 0) + 1;
                return;
            }

            const studentCollegeId = String(student?.collegeId || '').trim();
            const studentCollegeName = canonicalizeAcademicName(student?.college || '');
            const resolvedCollege = studentCollegeId && collegeById.has(studentCollegeId)
                ? collegeById.get(studentCollegeId)
                : (studentCollegeName ? collegeByName.get(studentCollegeName) || findBestAcademicMatch(studentCollegeName, collegeCandidates, 0.8)?.candidate || null : null);

            const departmentCandidates = departments.filter((department) => {
                if (!resolvedCollege) return true;
                const candidateCollegeId = String(department?.college?._id || department?.collegeId || department?.college || '').trim();
                return candidateCollegeId === String(resolvedCollege._id || '').trim();
            });

            const departmentMatch = findBestAcademicMatch(student?.department || '', departmentCandidates, 0.8);
            if (departmentMatch?.candidate?._id) {
                const matchedDepartmentId = String(departmentMatch.candidate._id);
                studentCountAccumulator[matchedDepartmentId] = (studentCountAccumulator[matchedDepartmentId] || 0) + 1;
            }
        });

        const departmentNameFrequency = departments.reduce((accumulator, item) => {
            const key = String(item?.name || '').trim().toLowerCase();
            if (key) accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});

        const memberAgg = await User.aggregate([
            {
                $group: {
                    _id: {
                        departmentId: { $ifNull: ['$departmentId', ''] },
                        collegeId: { $ifNull: ['$collegeId', ''] },
                        departmentName: { $toLower: { $ifNull: ['$department', ''] } },
                        collegeName: { $ifNull: ['$college', ''] }
                    },
                    count: { $sum: 1 }
                }
            }
        ]).allowDiskUse(true);

        const studentCountByDepartmentId = studentCountAccumulator;
        const memberCountByDepartmentId = {};
        const memberCountByDepartmentKey = {};
        const memberCountByDepartmentName = {};

        memberAgg.forEach((row) => {
            const deptId = String(row._id.departmentId || '');
            if (deptId) memberCountByDepartmentId[deptId] = (memberCountByDepartmentId[deptId] || 0) + row.count;

            const scopedKey = `${String(row._id.collegeId || '').trim().toLowerCase()}::${String(row._id.departmentName || '').trim().toLowerCase()}`;
            if (scopedKey) memberCountByDepartmentKey[scopedKey] = (memberCountByDepartmentKey[scopedKey] || 0) + row.count;

            const deptNameKey = String(row._id.departmentName || '').trim().toLowerCase();
            if (deptNameKey) memberCountByDepartmentName[deptNameKey] = (memberCountByDepartmentName[deptNameKey] || 0) + row.count;
        });

        const makeDepartmentKey = (collegeValue, departmentValue) => {
            const collegeKey = String(collegeValue || '').trim().toLowerCase();
            const departmentKey = String(departmentValue || '').trim().toLowerCase();
            return collegeKey && departmentKey ? `${collegeKey}::${departmentKey}` : '';
        };

        return res.json(departments.map((department) => {
            const departmentIdKey = String(department?._id || '');
            const departmentNameKey = String(department?.name || '').trim().toLowerCase();
            const collegeIdKey = String(department?.college?._id || department?.collegeId || department?.college || '');
            const collegeNameKey = String(department?.college?.name || '').trim();
            const scopedIdKey = makeDepartmentKey(collegeIdKey, department?.name);
            const scopedNameKey = makeDepartmentKey(collegeNameKey, department?.name);
            const allowLooseNameFallback = departmentNameFrequency[departmentNameKey] === 1;
            const fallbackMemberCount = (memberCountByDepartmentKey[scopedIdKey] || 0)
                + (scopedNameKey !== scopedIdKey ? (memberCountByDepartmentKey[scopedNameKey] || 0) : 0)
                + (allowLooseNameFallback ? (memberCountByDepartmentName[departmentNameKey] || 0) : 0);
            return {
                ...department,
                memberCount: (memberCountByDepartmentId[departmentIdKey] || 0) + fallbackMemberCount,
                studentCount: studentCountByDepartmentId[departmentIdKey] || 0
            };
        }));
    } catch (err) {
        console.error('Failed to load departments:', err);
        return res.status(500).json({ message: (err && err.message) || 'Failed to load departments.' });
    }
});

router.get('/department-heads', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const scope = await getAdminScope(req);
        const headRoles = ['hod', 'deptadmin', 'DeptAdmin'];
        const headFilter = {
            role: { $in: headRoles }
        };

        if (scope.adminType !== 'superadmin') {
            if (scope?.collegeId || scope?.college) {
                headFilter.$or = [
                    ...(scope?.college ? [{ college: scope.college }] : []),
                    ...(scope?.collegeId ? [{ collegeId: scope.collegeId }] : [])
                ];
            } else {
                headFilter._id = null;
            }
        }

        const heads = await User.find(headFilter)
            .select('name fullName email phone role college department createdAt')
            .sort({ fullName: 1, name: 1 })
            .lean();

        return res.json(heads.filter(isGovernanceUser));
    } catch {
        return res.status(500).json({ message: 'Failed to load department head candidates.' });
    }
});

router.post('/add-department', auth, async (req, res) => {
    if (!canManageDepartments(req)) return res.status(403).json({ msg: 'Unauthorized.' });
    try {
        const name = String(req.body?.name || '').trim();
        const collegeId = String(req.body?.collegeId || '').trim();
        const headId = String(req.body?.headId || '').trim();

        if (!name || !collegeId) {
            return res.status(400).json({ message: 'Department name and college are required.' });
        }

        const college = await College.findById(collegeId).select('name').lean();
        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(college.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only manage departments in their own college.' });
            }
        }

        const existing = await Department.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            college: collegeId
        }).lean();

        if (existing) {
            return res.status(409).json({ message: 'This department already exists in the selected college.' });
        }

        let headUser = null;
        if (headId) {
            headUser = await User.findById(headId).select('name fullName email phone role').lean();
            if (!headUser || !isDepartmentHeadUser(headUser)) {
                return res.status(400).json({ message: 'Please choose a valid head user account.' });
            }
        }

        const department = await Department.create({
            name,
            college: collegeId,
            collegeId,
            head: headUser?._id || null,
            headId: headUser?._id || null
        });

        if (headUser?._id) {
            await User.findByIdAndUpdate(headUser._id, {
                $set: {
                    department: name,
                    college: college.name,
                    collegeId: college._id
                }
            });
        }

        const populated = await Department.findById(department._id)
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role')
            .lean();

        res.status(201).json({ msg: 'Department added successfully', department: populated });
    } catch {
        res.status(500).json({ error: 'Failed to create department.' });
    }
});

router.post('/departments', auth, async (req, res) => {
    if (!canManageDepartments(req)) return res.status(403).json({ msg: 'Unauthorized.' });
    try {
        const name = String(req.body?.name || '').trim();
        const collegeId = String(req.body?.collegeId || '').trim();
        const headId = String(req.body?.headId || '').trim();
        const headName = String(req.body?.head?.name || '').trim();
        const headEmail = String(req.body?.head?.email || '').toLowerCase().trim();
        const headPhone = String(req.body?.head?.phone || '').trim();

        if (!name || !collegeId) {
            return res.status(400).json({ message: 'Department name and college are required.' });
        }

        if (!headId) {
            if (!headName) {
                return res.status(400).json({ message: 'HOD full name is required.' });
            }
            if (!headEmail) {
                return res.status(400).json({ message: 'HOD email address is required.' });
            }
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(headEmail)) {
                return res.status(400).json({ message: 'Please enter a valid HOD email address (e.g., hod@gmail.com).' });
            }
            if (!headPhone) {
                return res.status(400).json({ message: 'HOD phone number is required.' });
            }
        }

        const college = await College.findById(collegeId).select('name').lean();
        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(college.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only manage departments in their own college.' });
            }
        }

        const existing = await Department.findOne({
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
            college: collegeId
        }).lean();

        if (existing) {
            return res.status(409).json({ message: 'This department already exists in the selected college.' });
        }

        let headUser = null;
        let temporaryPassword = '';
        if (headId) {
            headUser = await User.findById(headId).select('name fullName email phone role').lean();
            if (!headUser || !isDepartmentHeadUser(headUser)) {
                return res.status(400).json({ message: 'Please choose a valid head user account.' });
            }
        } else if (headName && headEmail && headPhone) {
            if (await User.findOne({ email: headEmail }).lean()) {
                return res.status(409).json({ message: 'An account with this HOD email already exists.' });
            }

            temporaryPassword = createRandomPassword();
            const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
            headUser = await User.create({
                name: headName,
                fullName: headName,
                email: headEmail,
                phone: headPhone,
                password: hashedPassword,
                role: 'hod',
                isFirstLogin: true,
                college: college.name,
                department: name,
                collegeId,
                departmentId: null
            });
        }

        const department = await Department.create({
            name,
            college: collegeId,
            collegeId,
            head: headUser?._id || null,
            headId: headUser?._id || null
        });

        if (headUser?._id) {
            await User.findByIdAndUpdate(headUser._id, {
                $set: {
                    department: name,
                    college: college.name,
                    collegeId: college._id,
                    departmentId: department._id
                }
            });
        }

        let credentialsEmailSent = false;
        let credentialsEmailError = '';
        if (temporaryPassword && headUser?.email) {
            try {
                await sendGovernanceAccountEmail({
                    to: headUser.email,
                    name: headUser.name || headUser.fullName,
                    role: 'HOD',
                    password: temporaryPassword,
                    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
                });
                credentialsEmailSent = true;
            } catch (mailError) {
                credentialsEmailError = String(mailError?.message || 'Email delivery failed');
            }
        }

        const populated = await Department.findById(department._id)
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role')
            .lean();

        await logAdminAction(
            req,
            'ADMIN_DEPARTMENT_CREATED',
            `Department=${populated?.name || name} College=${populated?.college?.name || college?.name || ''}`
        );

        res.status(201).json({
            department: populated,
            temporaryPassword: temporaryPassword || null,
            credentialsEmailSent,
            credentialsEmailError: credentialsEmailError || null,
            message: temporaryPassword
                ? (credentialsEmailSent
                    ? 'Department and HOD account created successfully. Credentials email sent.'
                    : 'Department and HOD account created. Credentials email was not sent; use temporaryPassword in this response.')
                : 'Department created successfully.'
        });
    } catch {
        res.status(500).send('Failed to create department.');
    }
});

router.put('/departments/:id', auth, async (req, res) => {
    if (!canManageDepartments(req)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const name = String(req.body?.name || '').trim();
        const hodName = String(req.body?.hodName || req.body?.head?.name || '').trim();
        const hodEmail = String(req.body?.hodEmail || req.body?.head?.email || '').toLowerCase().trim();
        const hodPhone = String(req.body?.hodPhone || req.body?.head?.phone || '').trim();
        if (!name) {
            return res.status(400).json({ message: 'Department name is required.' });
        }

        const currentDepartment = await Department.findById(req.params.id)
            .populate('college', 'name')
            .lean();

        if (!currentDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(currentDepartment?.college?.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only edit departments in their own college.' });
            }
        }

        const duplicate = await Department.findOne({
            _id: { $ne: req.params.id },
            college: currentDepartment?.college?._id,
            name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
        }).lean();

        if (duplicate) {
            return res.status(409).json({ message: 'A department with this name already exists in the selected college.' });
        }

        const previousName = String(currentDepartment?.name || '').trim();

        let currentHead = null;
        if (currentDepartment?.head) {
            currentHead = await User.findById(currentDepartment.head).select('name fullName email phone role').lean();
        }

        if (hodEmail && currentHead && String(currentHead.email || '').toLowerCase() !== hodEmail) {
            const emailConflict = await User.findOne({ email: hodEmail, _id: { $ne: currentHead._id } }).lean();
            if (emailConflict) {
                return res.status(409).json({ message: 'An account with this HOD email already exists.' });
            }
        }

        let updatedHead = currentHead;
        if (hodName || hodEmail || hodPhone) {
            if (currentHead?._id) {
                updatedHead = await User.findByIdAndUpdate(
                    currentHead._id,
                    {
                        $set: {
                            ...(hodName ? { name: hodName, fullName: hodName } : {}),
                            ...(hodEmail ? { email: hodEmail } : {}),
                            ...(hodPhone ? { phone: hodPhone } : {}),
                            department: name,
                            college: currentDepartment?.college?.name || '',
                            collegeId: currentDepartment?.college?._id || null,
                            departmentId: req.params.id
                        }
                    },
                    { returnDocument: 'after' }
                ).select('name fullName email phone role').lean();
            } else if (hodName && hodEmail && hodPhone) {
                if (await User.findOne({ email: hodEmail }).lean()) {
                    return res.status(409).json({ message: 'An account with this HOD email already exists.' });
                }

                const temporaryPassword = createRandomPassword();
                const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
                updatedHead = await User.create({
                    name: hodName,
                    fullName: hodName,
                    email: hodEmail,
                    phone: hodPhone,
                    password: hashedPassword,
                    role: 'hod',
                    isFirstLogin: true,
                    college: currentDepartment?.college?.name || '',
                    collegeId: currentDepartment?.college?._id || null,
                    department: name,
                    departmentId: req.params.id
                });

                await sendGovernanceAccountEmail({
                    to: hodEmail,
                    name: hodName,
                    role: 'HOD',
                    password: temporaryPassword,
                    loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
                });
            }
        }

        const updatedDepartment = await Department.findByIdAndUpdate(
            req.params.id,
            {
                $set: {
                    name,
                    ...(updatedHead?._id ? { head: updatedHead._id, headId: updatedHead._id } : {})
                }
            },
            { returnDocument: 'after' }
        )
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role')
            .lean();

        if (previousName && previousName.toLowerCase() !== name.toLowerCase()) {
            await User.updateMany(
                {
                    department: previousName,
                    ...(updatedDepartment?.college?.name ? { college: updatedDepartment.college.name } : {})
                },
                { $set: { department: name } }
            );
        }

        await logAdminAction(
            req,
            'ADMIN_DEPARTMENT_UPDATED',
            `Department=${previousName || ''} -> ${updatedDepartment?.name || name}`
        );

        return res.json({ message: 'Department updated successfully.', department: updatedDepartment });
    } catch {
        return res.status(500).json({ message: 'Failed to update department.' });
    }
});

router.put('/departments/:id/head', auth, async (req, res) => {
    if (!canManageDepartments(req)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const headId = String(req.body?.headId || '').trim();

        let headUser = null;
        if (headId) {
            headUser = await User.findById(headId).select('name fullName email phone role').lean();
            if (!headUser || !isDepartmentHeadUser(headUser)) {
                return res.status(400).json({ message: 'Please choose a valid head user account.' });
            }
        }

        const currentDepartment = await Department.findById(req.params.id)
            .populate('college', 'name')
            .lean();

        if (!currentDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(currentDepartment?.college?.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only assign heads in their own college.' });
            }
        }

        const updatedDepartment = await Department.findByIdAndUpdate(
            req.params.id,
            { $set: { head: headUser?._id || null, headId: headUser?._id || null } },
            { returnDocument: 'after' }
        )
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role')
            .lean();

        if (headUser?._id) {
            await User.findByIdAndUpdate(headUser._id, {
                $set: {
                    department: updatedDepartment?.name || currentDepartment?.name || '',
                    college: updatedDepartment?.college?.name || currentDepartment?.college?.name || '',
                    collegeId: updatedDepartment?.college?._id || currentDepartment?.college?._id || null,
                    departmentId: updatedDepartment?._id || currentDepartment?._id || null
                }
            });
        }

        return res.json({ message: 'Department head assigned successfully.', department: updatedDepartment });
    } catch {
        return res.status(500).json({ message: 'Failed to assign department head.' });
    }
});

router.post('/departments/:id/head/reset-password', auth, async (req, res) => {
    if (!canManageDepartments(req)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const department = await Department.findById(req.params.id)
            .populate('college', 'name')
            .populate('head', 'name fullName email phone role')
            .lean();

        if (!department) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(department?.college?.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only reset heads in their own college.' });
            }
        }

        const headUser = department?.head;
        if (!headUser?._id || !headUser?.email) {
            return res.status(400).json({ message: 'No HOD is assigned to this department.' });
        }

        const temporaryPassword = createRandomPassword();
        let emailSent = true;

        try {
            await sendGovernanceAccountEmail({
                to: headUser.email,
                name: headUser.name || headUser.fullName,
                role: 'HOD',
                password: temporaryPassword,
                loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
            });
        } catch (mailError) {
            emailSent = false;
            console.log('Email delivery skipped or offline. Password will be updated in database anyway.');
        }

        const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
        await User.findByIdAndUpdate(headUser._id, {
            $set: {
                password: hashedPassword,
                isFirstLogin: true
            }
        });

        await logAdminAction(
            req,
            'ADMIN_DEPARTMENT_HEAD_PASSWORD_RESET',
            `Department=${department?.name || ''} HOD=${headUser?.email || ''}`
        );

        return res.json({
            message: emailSent
                ? `Department head password reset successfully. Credentials were sent by email to ${headUser.email}.`
                : `Department head password updated! (Email system offline). Temporary Password: ${temporaryPassword}`
        });
    } catch (err) {
        console.error('Failed to reset department head password:', err);
        return res.status(500).json({ message: (err && err.message) || 'Failed to reset department head password.' });
    }
});

router.get('/fraud-detection', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).json({ message: 'Unauthorized.' });
    }

    try {
        const [companies, internships] = await Promise.all([
            CompanyProfile.find()
                .select('companyName officialEmail website description profileCompleteness verification user')
                .populate('user', 'fullName name email')
                .lean(),
            Internship.find({ status: { $in: ['Pending', 'Open'] } })
                .select('title description requiredSkills deadline companyId status createdAt')
                .populate('companyId', 'fullName name email')
                .sort({ createdAt: -1 })
                .limit(200)
                .lean()
        ]);

        const riskyCompanies = companies
            .map((company) => ({
                _id: company?._id,
                companyName: company?.companyName || 'Unknown company',
                owner: company?.user?.fullName || company?.user?.name || company?.user?.email || 'N/A',
                ...evaluateCompanyFraudRisk(company)
            }))
            .filter((item) => item.score >= 40)
            .sort((a, b) => b.score - a.score);

        const spamInternships = internships
            .map((internship) => ({
                _id: internship?._id,
                title: internship?.title || 'Untitled',
                company: internship?.companyId?.fullName || internship?.companyId?.name || internship?.companyId?.email || 'N/A',
                status: internship?.status || 'Unknown',
                ...evaluateInternshipSpamRisk(internship)
            }))
            .filter((item) => item.score >= 30)
            .sort((a, b) => b.score - a.score);

        return res.json({
            riskyCompanies,
            spamInternships,
            summary: {
                riskyCompanies: riskyCompanies.length,
                spamInternships: spamInternships.length
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to run fraud detection.' });
    }
});

router.delete('/departments/:id', auth, async (req, res) => {
    if (!canManageDepartments(req)) return res.status(403).json({ msg: 'Unauthorized.' });
    try {
        const currentDepartment = await Department.findById(req.params.id)
            .populate('college', 'name')
            .populate('head', 'email name fullName')
            .lean();

        if (!currentDepartment) {
            return res.status(404).json({ message: 'Department not found.' });
        }

        if (getAdminType(req) === 'collegeadmin') {
            const actor = await User.findById(req.user?.id).select('college').lean();
            if (!actor?.college || String(actor.college).trim().toLowerCase() !== String(currentDepartment?.college?.name || '').trim().toLowerCase()) {
                return res.status(403).json({ message: 'CollegeAdmin can only manage departments in their own college.' });
            }
        }

        const linkedHeadId = currentDepartment?.headId || currentDepartment?.head?._id || currentDepartment?.head || null;
        await Department.findByIdAndDelete(req.params.id);
        if (linkedHeadId) {
            await User.findByIdAndDelete(linkedHeadId);
        } else if (currentDepartment?.head?.email) {
            await User.findOneAndDelete({ email: String(currentDepartment.head.email).toLowerCase().trim() });
        }
        await User.deleteMany({
            role: 'hod',
            collegeId: currentDepartment?.college?._id || null,
            department: currentDepartment?.name || ''
        });

        await logAdminAction(
            req,
            'ADMIN_DEPARTMENT_DELETED',
            `Department=${currentDepartment?.name || ''} College=${currentDepartment?.college?.name || ''} HOD=${String(linkedHeadId || '')}`
        );

        res.json({ msg: "Department removed." });
    } catch (err) { res.status(500).send("Delete failed."); }
});

router.get('/structure', async (req, res) => {
    try {
        const colleges = await College.find().lean();
        const structure = await Promise.all(colleges.map(async (college) => {
            const departments = await Department.find({ college: college._id }).select('name').lean();
            return {
                ...college,
                departments
            };
        }));
        res.json(structure);
    } catch (err) { res.status(500).json({ error: "Failed to retrieve university structure." }); }
});

// 2. Partner Vetting System (Inactive by Default)
router.get('/partners', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).send("Unauthorized.");
    try {
        const profiles = await CompanyProfile.find().populate('user', 'fullName email isVerified');
        res.json(profiles);
    } catch (err) { res.status(500).send("Partner fetch failed."); }
});

router.put('/companies/:id/verification', auth, superAdminOnly, async (req, res) => {
    // Delegate to centralized company status updater
    req.body = req.body || {};
    req.body.status = String(req.body?.status || '').trim();
    return updateCompanyStatus(req, res);
});

router.put('/verify-partner/:id', auth, superAdminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const reason = String(req.body?.reason || '').trim();

        if (status === 'Rejected' && !reason) {
            return res.status(400).json({ message: 'Rejection reason is required.' });
        }

        const profile = await CompanyProfile.findByIdAndUpdate(
            req.params.id,
            {
                'verification.status': status,
                'verification.reason': status === 'Rejected' ? reason : ''
            },
            { returnDocument: 'after' }
        );

        if (!profile) return res.status(404).json({ message: 'Company profile not found.' });

        const userId = profile.user?._id || profile.user || null;

        if (userId) {
            await User.findByIdAndUpdate(userId, { isVerified: status === 'Verified' });
        }

        await createAndEmitNotification(req, {
            userId,
            receiverRole: 'industry',
            senderId: req.user?.id || null,
            senderRole: 'super_admin',
            title: status === 'Rejected' ? 'Action Required: Verification Rejected' : 'Verification Approved',
            message: status === 'Verified'
                ? 'Your organization verification has been approved. You may now continue posting internships and managing your employer profile.'
                : `Your organization verification was rejected for the following reason: ${reason}. Please update your profile and resubmit.`,
            type: status === 'Verified' ? 'success' : 'warning',
            targetRoute: '/employer/profile',
            category: 'general',
            metadata: {
                kind: 'company-verification',
                verificationStatus: status,
                rejectionReason: status === 'Rejected' ? reason : '',
                reviewedBy: req.user?.id || null,
                reviewedAt: new Date().toISOString()
            }
        });

        try {
            const io = req.app.get('io');
            if (io) {
                io.emit('company:status-changed', { companyId: String(userId), status, reason: status === 'Rejected' ? reason : '' });
            }
        } catch (e) { }

        res.json(profile);
    } catch (err) { res.status(500).send("Verification update failed."); }
});

// 3. User Management Matrix (Role-Based Access)
router.get('/governance-admins', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).send("Unauthorized.");
    try {
        const admins = await User.find({
            role: { $in: ['SuperAdmin', 'CollegeAdmin', 'DeptAdmin', 'Admin', 'admin', 'dean', 'hod'] }
        }).select('-password').sort({ role: 1 });
        res.json(admins);
    } catch (err) { res.status(500).send("Admin fetch failed."); }
});

router.post('/create-governance-admin', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).send("SuperAdmin only.");
    try {
        const { fullName, email, password, role, college, department } = req.body;
        if (normalizeRole(role) !== 'dean') {
            return res.status(400).json({ message: 'SuperAdmin can create dean accounts only in this endpoint.' });
        }
        if (!college || department) {
            return res.status(400).json({ message: 'Dean account requires college only and cannot include department.' });
        }
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            fullName,
            email,
            password: hashedPassword,
            role: 'dean',
            college,
            department: '',
            isVerified: true
        });

        await newUser.save();
        res.json(newUser);
    } catch (err) { res.status(500).send("Admin creation failed."); }
});

// 4. Master Analytics Engine (Placement Stats)
router.get('/placement-stats', auth, async (req, res) => {
    if (!hasAdminAccess(req.user?.role)) {
        return res.status(403).send("Unauthorized.");
    }
    try {
        const stats = await Application.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        const monthlyStats = await Application.aggregate([
            {
                $group: {
                    _id: { $month: "$createdAt" },
                    total: { $sum: 1 },
                    placed: {
                        $sum: { $cond: [{ $eq: ["$status", "Accepted"] }, 1, 0] }
                    }
                }
            },
            { $sort: { "_id": 1 } }
        ]);

        res.json({ stats, monthlyStats });
    } catch (err) { res.status(500).send("Analytics failed."); }
});

// 5. Enterprise Security Observability (Audit Logs)
router.get('/audit-logs', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Institutional Security Access Only.' });
    }

    try {
        const { page, limit, skip } = getPagination(req);
        const filter = buildAuditLogsFilter(req);

        const [total, logs] = await Promise.all([
            ActivityLog.countDocuments(filter),
            ActivityLog.find(filter)
                .populate('userId', 'fullName email role')
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return res.json({
            items: logs,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ error: 'Audit retrieval matrix failure.' });
    }
});

router.get('/audit-logs/export', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Institutional Security Access Only.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const filter = buildAuditLogsFilter(req);
        const logs = await ActivityLog.find(filter)
            .populate('userId', 'fullName email role')
            .sort({ timestamp: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Timestamp', 'Actor', 'Role', 'Action', 'Details', 'IP Address', 'Device Info'],
            ...logs.map((log) => [
                log?.timestamp ? new Date(log.timestamp).toISOString() : '',
                log?.userId?.fullName || log?.userId?.email || 'System',
                log?.userId?.role || 'N/A',
                log?.action || '',
                log?.details || '',
                log?.ipAddress || '',
                log?.deviceInfo || ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-audit-logs-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_AUDIT_LOGS',
            `Rows=${logs.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', action: req.query.action || 'all', from: req.query.from || '', to: req.query.to || '' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export audit logs.' });
    }
});

module.exports = router;
