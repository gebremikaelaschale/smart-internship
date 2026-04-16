const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
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
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const bytes = crypto.randomBytes(length);
    let password = '';
    for (let index = 0; index < length; index += 1) {
        password += charset[bytes[index] % charset.length];
    }
    return password;
}

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
    return ['superadmin', 'collegeadmin'].includes(adminType);
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
    if (scope?.adminType === 'collegeadmin' && scope?.college) {
        filter.college = scope.college;
    }
    if (scope?.adminType === 'deptadmin') {
        if (scope?.college) filter.college = scope.college;
        if (scope?.department) filter.department = scope.department;
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

    const fallbackLastLogin = latestActivity
        ? {
            at: latestActivity.timestamp || null,
            ipAddress: latestActivity.ipAddress || null,
            deviceInfo: latestActivity.deviceInfo || null,
            source: 'activity-log'
        }
        : null;

    const lastLogin = latestLoginLog
        ? {
            at: latestLoginLog.createdAt || null,
            ipAddress: latestLoginLog.ipAddress || null,
            deviceInfo: latestLoginLog.userAgent || null,
            source: 'login-log'
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
    if (verification === 'Pending' && (!hasLicense || !hasRegistrationDoc)) {
        score += 35;
        flags.push('Missing legal verification documents');
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
        const recentMonths = buildRecentMonths(6);
        const firstMonth = recentMonths[0]?.key;
        const [firstYear, firstMonthNumber] = String(firstMonth || '').split('-').map(Number);
        const startDate = Number.isFinite(firstYear) && Number.isFinite(firstMonthNumber)
            ? new Date(Date.UTC(firstYear, firstMonthNumber - 1, 1))
            : new Date(Date.now() - (180 * 24 * 60 * 60 * 1000));

        const [
            students,
            companies,
            internships,
            activeInternships,
            applicationMonthly,
            internshipMonthly,
            latestInternship,
            latestApplication,
            latestActivatedInternship,
            companyProfiles,
            pendingInternships
        ] = await Promise.all([
            User.countDocuments({ role: { $in: ['student', 'Student'] } }),
            CompanyProfile.countDocuments(),
            Internship.countDocuments(),
            Internship.countDocuments({ status: 'Open' }),
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
                message: 'Company posted internship',
                details: latestInternship.title || 'New internship was posted',
                timestamp: latestInternship.createdAt || new Date()
            });
        }
        if (latestApplication) {
            const studentName = latestApplication?.studentId?.fullName || latestApplication?.studentId?.name || 'Student';
            activity.push({
                type: 'application-submitted',
                message: 'Student applied',
                details: `${studentName} applied for ${latestApplication?.internshipId?.title || 'an internship'}`,
                timestamp: latestApplication.createdAt || new Date()
            });
        }
        if (latestActivatedInternship) {
            activity.push({
                type: 'internship-approved',
                message: 'Admin approved internship',
                details: latestActivatedInternship.title || 'Internship is active',
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
                students: Number(students || 0),
                companies: Number(companies || 0),
                internships: totalInternships,
                activeInternships: activeInternshipCount
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
            const [colleges, departments, pendingCompanyVerifications, activeStudents, departmentsWithoutHod, acceptedStudentIds] = await Promise.all([
                College.countDocuments(),
                Department.countDocuments(),
                CompanyProfile.countDocuments({ 'verification.status': 'Pending' }),
                User.countDocuments({ role: { $in: ['student', 'Student'] } }),
                Department.countDocuments({ $or: [{ head: null }, { head: { $exists: false } }] }),
                Application.distinct('studentId', { status: 'Accepted' })
            ]);

            const studentsWithoutInternship = Math.max(Number(activeStudents || 0) - Number(acceptedStudentIds.length || 0), 0);

            return res.json({
                stats: {
                    colleges: Number(colleges || 0),
                    departments: Number(departments || 0),
                    pendingRequests: Number(pendingCompanyVerifications || 0),
                    activeStudents: Number(activeStudents || 0),
                    departmentsWithoutHod: Number(departmentsWithoutHod || 0),
                    studentsWithoutInternship: Number(studentsWithoutInternship || 0)
                }
            });
        }

        const collegeFilter = scope?.collegeId
            ? { _id: scope.collegeId }
            : scope?.college
                ? { name: scope.college }
                : { _id: null };

        const [collegeDoc, scopedStudentIds] = await Promise.all([
            College.findOne(collegeFilter).select('_id').lean(),
            getScopedStudentIds(scope)
        ]);

        const [departments, departmentsWithoutHod, pendingRequests, acceptedStudentIds] = await Promise.all([
            collegeDoc?._id
                ? Department.countDocuments({ college: collegeDoc._id })
                : 0,
            collegeDoc?._id
                ? Department.countDocuments({
                    college: collegeDoc._id,
                    $or: [{ head: null }, { head: { $exists: false } }]
                })
                : 0,
            scopedStudentIds.length > 0
                ? Application.countDocuments({
                    studentId: { $in: scopedStudentIds },
                    status: { $in: ['Pending', 'Under Review', 'Interview'] }
                })
                : 0,
            scopedStudentIds.length > 0
                ? Application.distinct('studentId', {
                    studentId: { $in: scopedStudentIds },
                    status: 'Accepted'
                })
                : []
        ]);

        const activeStudents = Number(scopedStudentIds.length || 0);
        const studentsWithoutInternship = Math.max(activeStudents - Number(acceptedStudentIds.length || 0), 0);

        return res.json({
            stats: {
                colleges: collegeDoc ? 1 : 0,
                departments: Number(departments || 0),
                pendingRequests: Number(pendingRequests || 0),
                activeStudents,
                departmentsWithoutHod: Number(departmentsWithoutHod || 0),
                studentsWithoutInternship: Number(studentsWithoutInternship || 0)
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
            .select('_id email fullName name')
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
            status: 'Accepted',
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
        }, scope);

        const [total, items] = await Promise.all([
            User.countDocuments(filter),
            User.find(filter)
                .select('name fullName email role isVerified status accountStatus department college createdAt')
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
            .select('name fullName email department college isVerified status accountStatus createdAt')
            .sort({ createdAt: -1 })
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
                    { $group: { _id: '$studentId', status: { $first: '$status' } } }
                ]),
                Profile.find({ userId: { $in: studentIds } })
                    .select('userId profileStrength')
                    .lean()
            ]);

            statusByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), String(item?.status || '')])
            );

            progressByStudentId = new Map(
                profiles.map((item) => [String(item?.userId || ''), Number(item?.profileStrength || 0)])
            );
        }

        const withInternshipData = students.map((student) => {
            const studentId = String(student?._id || '');
            const rawStatus = statusByStudentId.get(studentId) || '';

            let normalizedInternshipStatus = 'Not Applied';
            if (rawStatus === 'Accepted') normalizedInternshipStatus = 'Placed';
            else if (['Pending', 'Under Review', 'Interview'].includes(rawStatus)) normalizedInternshipStatus = 'In Progress';
            else if (rawStatus === 'Rejected') normalizedInternshipStatus = 'Not Placed';

            const profileProgress = progressByStudentId.get(studentId);
            let progress = Number.isFinite(profileProgress) ? profileProgress : 0;
            if (!Number.isFinite(profileProgress) || profileProgress <= 0) {
                if (normalizedInternshipStatus === 'Placed') progress = 100;
                else if (normalizedInternshipStatus === 'In Progress') progress = 65;
                else if (normalizedInternshipStatus === 'Not Placed') progress = 40;
                else progress = 20;
            }

            return {
                ...student,
                internshipStatus: normalizedInternshipStatus,
                progress: Math.max(0, Math.min(100, Math.round(progress)))
            };
        });

        const filteredByStatus = internshipStatus && internshipStatus !== 'all'
            ? withInternshipData.filter((student) => String(student?.internshipStatus || '') === internshipStatus)
            : withInternshipData;

        const pagedItems = filteredByStatus.slice(skip, skip + limit);
        const total = filteredByStatus.length;

        const departmentOptions = [...new Set(students.map((student) => String(student?.department || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));

        return res.json({
            items: pagedItems,
            filters: {
                departments: departmentOptions,
                internshipStatuses: ['Placed', 'In Progress', 'Not Placed', 'Not Applied']
            },
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch {
        return res.status(500).json({ message: 'Failed to load students.' });
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
                    { $group: { _id: '$studentId', status: { $first: '$status' } } }
                ]),
                Profile.find({ userId: { $in: studentIds } })
                    .select('userId profileStrength')
                    .lean()
            ]);

            statusByStudentId = new Map(
                applicationStatuses.map((item) => [String(item?._id || ''), String(item?.status || '')])
            );

            progressByStudentId = new Map(
                profiles.map((item) => [String(item?.userId || ''), Number(item?.profileStrength || 0)])
            );
        }

        const enrichedStudents = students.map((student) => {
            const studentId = String(student?._id || '');
            const rawStatus = statusByStudentId.get(studentId) || '';

            let normalizedInternshipStatus = 'Not Applied';
            if (rawStatus === 'Accepted') normalizedInternshipStatus = 'Placed';
            else if (['Pending', 'Under Review', 'Interview'].includes(rawStatus)) normalizedInternshipStatus = 'In Progress';
            else if (rawStatus === 'Rejected') normalizedInternshipStatus = 'Not Placed';

            const profileProgress = progressByStudentId.get(studentId);
            let progress = Number.isFinite(profileProgress) ? profileProgress : 0;
            if (!Number.isFinite(profileProgress) || profileProgress <= 0) {
                if (normalizedInternshipStatus === 'Placed') progress = 100;
                else if (normalizedInternshipStatus === 'In Progress') progress = 65;
                else if (normalizedInternshipStatus === 'Not Placed') progress = 40;
                else progress = 20;
            }

            return {
                ...student,
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
                .select('companyName industryType hqLocation verification isActive user createdAt')
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
        const profile = await CompanyProfile.findById(req.params.id)
            .populate('user', 'name fullName email role isVerified createdAt')
            .lean();

        if (!profile) {
            return res.status(404).json({ message: 'Company profile not found.' });
        }

        return res.json({ item: profile });
    } catch {
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
            .select('companyName industryType hqLocation verification isActive user createdAt')
            .populate('user', 'name fullName email')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Company', 'Representative', 'Email', 'Industry', 'Location', 'Verification', 'Active', 'Created At'],
            ...companies.map((item) => [
                item?.companyName || '',
                item?.user?.fullName || item?.user?.name || '',
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
        const { page, limit, skip } = getPagination(req);
        const q = safeRegex(req.query.q);
        const status = String(req.query.status || 'all').trim();

        const filter = {
            ...(status && status !== 'all' ? { status } : {}),
            ...(q ? {
                $or: [
                    { title: q },
                    { location: q },
                    { description: q }
                ]
            } : {})
        };

        const [total, items, totalPending, totalOpen, totalClosed] = await Promise.all([
            Internship.countDocuments(filter),
            Internship.find(filter)
                .select('title location status studentsNeeded deadline companyId createdAt')
                .populate('companyId', 'name fullName email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Internship.countDocuments({ status: 'Pending' }),
            Internship.countDocuments({ status: 'Open' }),
            Internship.countDocuments({ status: 'Closed' })
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
        const q = safeRegex(req.query.q);
        const status = String(req.query.status || 'all').trim();

        const filter = {
            ...(status && status !== 'all' ? { status } : {}),
            ...(q ? {
                $or: [
                    { title: q },
                    { location: q },
                    { description: q }
                ]
            } : {})
        };

        const internships = await Internship.find(filter)
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
            ...(status && status !== 'all' ? { status } : {}),
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
                .select('studentId internshipId status matchingScore createdAt')
                .populate('studentId', 'name fullName email')
                .populate('internshipId', 'title')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
            ,Application.countDocuments({ ...filter, status: 'Pending' }),
            Application.countDocuments({ ...filter, status: 'Under Review' }),
            Application.countDocuments({ ...filter, status: 'Interview' }),
            Application.countDocuments({ ...filter, status: 'Accepted' }),
            Application.countDocuments({ ...filter, status: 'Rejected' })
        ]);

        return res.json({
            items,
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

router.get('/applications/export', auth, async (req, res) => {
    if (!canExportApplications(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin or CollegeAdmin can export applications.' });
    }

    const exportReason = resolveExportReason(req, res);
    if (!exportReason) return;

    try {
        const scope = await getAdminScope(req);
        const scopedStudentIds = await getScopedStudentIds(scope);
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
            ...(status && status !== 'all' ? { status } : {}),
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

        const applications = await Application.find(filter)
            .select('studentId internshipId status matchingScore remarks createdAt')
            .populate('studentId', 'name fullName email')
            .populate('internshipId', 'title')
            .sort({ createdAt: -1 })
            .limit(10000)
            .lean();

        const rows = [
            ['Student', 'Email', 'Internship', 'Status', 'Match Score', 'Remarks', 'Created At'],
            ...applications.map((item) => [
                item?.studentId?.fullName || item?.studentId?.name || '',
                item?.studentId?.email || '',
                item?.internshipId?.title || '',
                item?.status || '',
                item?.matchingScore ?? '',
                item?.remarks || '',
                item?.createdAt ? new Date(item.createdAt).toISOString() : ''
            ])
        ];

        const csv = toCsv(rows);
        const filename = `admin-applications-${Date.now()}.csv`;

        await logAdminAction(
            req,
            'ADMIN_EXPORT_APPLICATIONS',
            `Rows=${applications.length} Reason=${exportReason} Filters=${JSON.stringify({ q: req.query.q || '', status: req.query.status || 'all' })}`
        );

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
    } catch {
        return res.status(500).json({ message: 'Failed to export applications.' });
    }
});

router.put('/companies/:id/verification', auth, async (req, res) => {
    if (!isSuperAdmin(req)) {
        return res.status(403).json({ message: 'Only SuperAdmin can update company verification.' });
    }

    try {
        const allowedStatuses = new Set(['Pending', 'Verified', 'Rejected']);
        const status = String(req.body?.status || '').trim();
        if (!allowedStatuses.has(status)) {
            return res.status(400).json({ message: 'Invalid verification status.' });
        }

        const profile = await CompanyProfile.findByIdAndUpdate(
            req.params.id,
            { $set: { 'verification.status': status } },
            { returnDocument: 'after' }
        )
            .select('companyName verification user')
            .populate('user', 'name fullName email')
            .lean();

        if (!profile) {
            return res.status(404).json({ message: 'Company profile not found.' });
        }

        if (profile.user?._id) {
            await User.findByIdAndUpdate(profile.user._id, {
                $set: { isVerified: status === 'Verified' }
            });
        }

        await logAdminAction(
            req,
            'ADMIN_COMPANY_VERIFICATION_UPDATED',
            `Company=${profile?.companyName || profile?._id} Verification=${status}`
        );

        return res.json({ message: 'Company verification updated.', item: profile });
    } catch {
        return res.status(500).json({ message: 'Failed to update company verification.' });
    }
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
            .select('title location status studentsNeeded deadline companyId createdAt')
            .populate('companyId', 'name fullName email')
            .lean();

        if (!internship) {
            return res.status(404).json({ message: 'Internship not found.' });
        }

        await logAdminAction(
            req,
            'ADMIN_INTERNSHIP_STATUS_UPDATED',
            `Internship=${internship?.title || internship?._id} Status=${status}`
        );

        return res.json({ message: 'Internship status updated.', item: internship });
    } catch {
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
            .populate('dean', 'name fullName email role createdAt')
            .sort({ name: 1 })
            .lean();

        const collegeIds = colleges.map((college) => college._id);
        const departments = await Department.find({ college: { $in: collegeIds } }).select('college').lean();
        const departmentCounts = departments.reduce((accumulator, item) => {
            const key = String(item?.college || '');
            accumulator[key] = (accumulator[key] || 0) + 1;
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

        const populated = await College.findById(college._id).populate('dean', 'name fullName email role college').lean();
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

        const populated = await College.findById(college._id).populate('dean', 'name fullName email role college').lean();
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
            .populate('dean', 'name fullName email role college')
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
            .populate('dean', 'name fullName email role')
            .lean();

        if (!college) {
            return res.status(404).json({ message: 'College not found.' });
        }

        const deanUser = college?.dean;
        if (!deanUser?._id || !deanUser?.email) {
            return res.status(400).json({ message: 'No dean is assigned to this college.' });
        }

        const temporaryPassword = createRandomPassword();

        try {
            await sendGovernanceAccountEmail({
                to: deanUser.email,
                name: deanUser.name || deanUser.fullName,
                role: 'Dean',
                password: temporaryPassword,
                loginUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login`
            });
        } catch {
            return res.status(500).json({ message: 'Failed to send password reset email to dean.' });
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

        return res.json({ message: 'Dean password reset successfully. Credentials were sent by email.' });
    } catch {
        return res.status(500).json({ message: 'Failed to reset dean password.' });
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
            await User.findByIdAndUpdate(college.dean._id, { college: college.name, collegeId: college._id });
        }

        return res.json({ message: 'College updated successfully.', college });
    } catch {
        return res.status(500).json({ message: 'Failed to update college.' });
    }
});

router.delete('/colleges/:id', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).json({ msg: "SuperAdmin access only." });
    try {
        await College.findByIdAndDelete(req.params.id);
        res.json({ msg: "College removed." });
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
            .populate('head', 'name fullName email role createdAt')
            .sort({ name: 1 })
            .lean();

        const departmentNames = departments.map((item) => String(item?.name || '').trim()).filter(Boolean);
        const users = await User.find({ department: { $exists: true, $ne: '' } })
            .select('department')
            .lean();

        const memberCountByDepartment = users.reduce((accumulator, user) => {
            const key = String(user?.department || '').trim().toLowerCase();
            if (!key) return accumulator;
            accumulator[key] = (accumulator[key] || 0) + 1;
            return accumulator;
        }, {});

        return res.json(departments.map((department) => ({
            ...department,
            memberCount: memberCountByDepartment[String(department?.name || '').trim().toLowerCase()] || 0
        })).filter((department) => departmentNames.includes(String(department?.name || '').trim())));
    } catch {
        return res.status(500).json({ message: 'Failed to load departments.' });
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
            .select('name fullName email role college department createdAt')
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
            headUser = await User.findById(headId).select('name fullName email role').lean();
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
            .populate('head', 'name fullName email role')
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
        let temporaryPassword = '';
        if (headId) {
            headUser = await User.findById(headId).select('name fullName email role').lean();
            if (!headUser || !isDepartmentHeadUser(headUser)) {
                return res.status(400).json({ message: 'Please choose a valid head user account.' });
            }
        } else if (headName && headEmail) {
            if (await User.findOne({ email: headEmail }).lean()) {
                return res.status(409).json({ message: 'An account with this HOD email already exists.' });
            }

            temporaryPassword = createRandomPassword();
            const hashedPassword = await bcrypt.hash(temporaryPassword, 12);
            headUser = await User.create({
                name: headName,
                fullName: headName,
                email: headEmail,
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
            .populate('head', 'name fullName email role')
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

        const updatedDepartment = await Department.findByIdAndUpdate(
            req.params.id,
            { $set: { name } },
            { returnDocument: 'after' }
        )
            .populate('college', 'name')
            .populate('head', 'name fullName email role')
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
            headUser = await User.findById(headId).select('name fullName email role').lean();
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
            .populate('head', 'name fullName email role')
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

        await Department.findByIdAndDelete(req.params.id);
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

router.put('/verify-partner/:id', auth, async (req, res) => {
    if (!isSuperAdmin(req)) return res.status(403).send("SuperAdmin only.");
    try {
        const { status } = req.body; // 'Verified' or 'Rejected'
        const profile = await CompanyProfile.findByIdAndUpdate(req.params.id, { 
            'verification.status': status 
        }, { returnDocument: 'after' });
        
        // Also update the User model verification status
        if (status === 'Verified') {
            await User.findByIdAndUpdate(profile.user, { isVerified: true });
        } else {
            await User.findByIdAndUpdate(profile.user, { isVerified: false });
        }
        
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