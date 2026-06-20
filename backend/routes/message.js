const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const College = require('../models/College');
const Profile = require('../models/Profile');
const CompanyProfile = require('../models/CompanyProfile');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Department = require('../models/Department');
const ChatRoom = require('../models/ChatRoom');
const CallSession = require('../models/CallSession');
const { normalizeRole } = require('../utils/governanceRoles');
const { canonicalizeAcademicName, findBestAcademicMatch } = require('../utils/academicNormalization');

function getRoleVariants(role) {
    const value = String(role || 'all').trim().toLowerCase();
    if (value === 'student') return ['student', 'Student'];
    if (value === 'employer') return ['employer', 'Employer', 'Industry Partner'];
    if (value === 'admin') return ['admin', 'Admin'];
    if (value === 'dean') return ['dean', 'collegeadmin', 'CollegeAdmin'];
    if (value === 'hod') return ['hod', 'deptadmin', 'DeptAdmin'];
    if (value === 'superadmin') return ['admin', 'Admin', 'superadmin', 'super_admin', 'super-admin', 'SuperAdmin'];
    return [];
}

function escapeRegex(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueStrings(values = []) {
    return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function normalizeAcademicKey(value = '') {
    return canonicalizeAcademicName(value).toLowerCase();
}

function getRoleLabel(role = '') {
    const value = normalizeRole(role);
    if (value === 'student') return 'STUDENT';
    if (value === 'hod') return 'HOD';
    if (value === 'dean') return 'DEAN';
    if (value === 'admin') return 'ADMIN';
    if (value === 'employer') return 'PARTNER';
    return String(role || 'USER').toUpperCase();
}

function getRoleBadgeClass(role = '') {
    const value = normalizeRole(role);
    if (value === 'student') return 'bg-sky-50 text-sky-700 border-sky-200';
    if (value === 'hod') return 'bg-violet-50 text-violet-700 border-violet-200';
    if (value === 'dean') return 'bg-amber-50 text-amber-700 border-amber-200';
    if (value === 'admin') return 'bg-slate-900 text-white border-slate-900';
    if (value === 'employer') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
}

function normalizeObjectIds(values = []) {
    return uniqueStrings(values).filter((value) => mongoose.Types.ObjectId.isValid(String(value)));
}

function getCompanyDisplayName(user = {}, companyProfile = null) {
    return String(
        companyProfile?.companyName
        || user.fullName
        || user.name
        || user.email
        || ''
    ).trim();
}

function getCompanyRepresentativeName(user = {}, companyProfile = null) {
    return String(
        companyProfile?.focalPerson?.name
        || companyProfile?.representative?.name
        || user.fullName
        || user.name
        || user.email
        || ''
    ).trim();
}

function getCompanyDisplayEmail(user = {}, companyProfile = null) {
    return String(
        companyProfile?.focalPerson?.email
        || companyProfile?.representative?.email
        || companyProfile?.officialEmail
        || user.email
        || ''
    ).trim();
}

function getCompanyDisplayAvatar(user = {}, companyProfile = null) {
    return String(
        companyProfile?.logoUrl
        || companyProfile?.logo
        || user.avatar
        || user.profileImage
        || ''
    ).trim();
}

function enrichContactUser(user = {}, companyProfile = null) {
    const normalizedRole = normalizeRole(user.role);
    const isEmployer = normalizedRole === 'employer';
    const displayName = isEmployer ? getCompanyDisplayName(user, companyProfile) : String(user.fullName || user.name || user.email || '').trim();
    const representativeName = isEmployer ? getCompanyRepresentativeName(user, companyProfile) : '';
    const displayEmail = isEmployer ? getCompanyDisplayEmail(user, companyProfile) : String(user.email || '').trim();

    return {
        ...user,
        displayName,
        name: displayName,
        fullName: displayName,
        email: displayEmail,
        avatar: isEmployer ? getCompanyDisplayAvatar(user, companyProfile) : user.avatar || user.profileImage || null,
        companyName: companyProfile?.companyName || user.companyName || '',
        representativeName,
        focalPersonName: companyProfile?.focalPerson?.name || '',
        focalPersonEmail: companyProfile?.focalPerson?.email || '',
        focalPersonPhone: companyProfile?.focalPerson?.phone || '',
        role: normalizedRole,
        roleLabel: getRoleLabel(normalizedRole),
        roleBadgeClass: getRoleBadgeClass(normalizedRole)
    };
}

function extractCompanyProfileIds(message = {}) {
    return uniqueStrings([
        String(message?.senderId?._id || message?.senderId || ''),
        String(message?.receiverId?._id || message?.receiverId || '')
    ]).filter(Boolean);
}

async function enrichMessageWithDisplayNames(message = {}, companyProfileMap = new Map()) {
    if (!message) return message;

    const senderId = String(message?.senderId?._id || message?.senderId || '').trim();
    const receiverId = String(message?.receiverId?._id || message?.receiverId || '').trim();
    const senderProfile = companyProfileMap.get(senderId) || null;
    const receiverProfile = companyProfileMap.get(receiverId) || null;

    return {
        ...message,
        senderId: message.senderId && typeof message.senderId === 'object'
            ? enrichContactUser(message.senderId, senderProfile)
            : message.senderId,
        receiverId: message.receiverId && typeof message.receiverId === 'object'
            ? enrichContactUser(message.receiverId, receiverProfile)
            : message.receiverId,
        replyTo: message.replyTo && typeof message.replyTo === 'object'
            ? {
                ...message.replyTo,
                senderName: message.replyTo.senderName || ''
            }
            : message.replyTo
    };
}

async function fetchCompanyContactIdentityMap(companyIds = []) {
    const ids = normalizeObjectIds(companyIds);
    if (!ids.length) return new Map();

    const companyProfiles = await CompanyProfile.find({ user: { $in: ids } })
        .select('user companyName focalPerson representative officialEmail phone logo logoUrl')
        .lean();

    return new Map(companyProfiles.map((profile) => [String(profile.user), profile]));
}

function internshipMatchesAcademicScope(internship = {}, scopeDepartmentKeys = []) {
    const internshipDepartmentKeys = uniqueStrings([
        internship?.department,
        ...(Array.isArray(internship?.targetDepartments) ? internship.targetDepartments : [])
    ]).map(normalizeAcademicKey).filter(Boolean);

    if (!scopeDepartmentKeys.length) return false;
    if (!internshipDepartmentKeys.length) return false;

    return internshipDepartmentKeys.some((departmentKey) => scopeDepartmentKeys.includes(departmentKey));
}

async function resolveEmployerContactScope(userId) {
    const employerId = String(userId || '').trim();
    if (!employerId) return null;

    const internships = await Internship.find({ companyId: employerId })
        .select('_id companyId targetDepartments')
        .lean();

    const internshipIds = internships.map((internship) => internship._id);
    const targetDepartments = uniqueStrings(
        internships.flatMap((internship) => Array.isArray(internship.targetDepartments) ? internship.targetDepartments : [])
    );

    const [applications, departments] = await Promise.all([
        internshipIds.length > 0
            ? Application.find({ internshipId: { $in: internshipIds } })
                .select('studentId internshipId')
                .lean()
            : Promise.resolve([]),
        Department.find({}).select('_id name collegeId headId head college').lean()
    ]);

    const studentIds = uniqueStrings(applications.map((application) => application.studentId));
    const normalizedTargetDepartments = targetDepartments.map(normalizeAcademicKey).filter(Boolean);

    const matchedDepartments = departments.filter((department) => {
        const departmentKey = normalizeAcademicKey(department?.name || '');
        return departmentKey && normalizedTargetDepartments.includes(departmentKey);
    });

    const collegeIds = uniqueStrings(matchedDepartments.map((department) => department.collegeId || department.college));
    const hodIds = uniqueStrings(matchedDepartments.map((department) => department.headId || department.head));

    const colleges = collegeIds.length > 0
        ? await College.find({ _id: { $in: collegeIds } }).select('_id deanId dean name').lean()
        : [];
    const deanIds = uniqueStrings(colleges.map((college) => college.deanId || college.dean));

    const [applicantUsers, hodUsers, deanUsers, superAdmins] = await Promise.all([
        studentIds.length > 0
            ? User.find({ _id: { $in: studentIds }, role: { $in: getRoleVariants('student') } })
                .select('_id name fullName email role department college departmentId collegeId isOnline lastSeen')
                .lean()
            : Promise.resolve([]),
        hodIds.length > 0
            ? User.find({ _id: { $in: hodIds }, role: { $in: getRoleVariants('hod') } })
                .select('_id name fullName email role department college departmentId collegeId isOnline lastSeen')
                .lean()
            : Promise.resolve([]),
        deanIds.length > 0
            ? User.find({ _id: { $in: deanIds }, role: { $in: getRoleVariants('dean') } })
                .select('_id name fullName email role department college departmentId collegeId isOnline lastSeen')
                .lean()
            : Promise.resolve([]),
        User.find({ role: { $in: getRoleVariants('superadmin') } })
            .select('_id name fullName email role department college departmentId collegeId isOnline lastSeen')
            .lean()
    ]);

    const users = [...applicantUsers, ...hodUsers, ...deanUsers, ...superAdmins]
        .filter(Boolean)
        .filter((user) => String(user._id) !== employerId);

    return {
        applicants: applicantUsers,
        hods: hodUsers,
        deans: deanUsers,
        superAdmins,
        users,
        internshipIds,
        collegeIds
    };
}

async function resolveAppliedCompanyIdsForStudent(studentId) {
    const applications = await Application.find({ studentId })
        .select('internshipId')
        .lean();

    const internshipIds = normalizeObjectIds(applications.map((application) => application.internshipId));
    if (!internshipIds.length) return [];

    const internships = await Internship.find({ _id: { $in: internshipIds } })
        .select('companyId')
        .lean();

    return normalizeObjectIds(internships.map((internship) => internship.companyId));
}

async function resolveIndustryPartnerIdsForAcademicScope(scope = {}) {
    const departmentNames = [];

    if (scope.departmentName) {
        departmentNames.push(scope.departmentName);
    }

    if (scope.collegeId) {
        const departmentDocs = await Department.find({ collegeId: asObjectId(scope.collegeId) || scope.collegeId })
            .select('name')
            .lean();
        departmentNames.push(...departmentDocs.map((department) => department.name));
    }

    const scopeDepartmentKeys = uniqueStrings(departmentNames).map(normalizeAcademicKey).filter(Boolean);
    if (!scopeDepartmentKeys.length) return [];

    const internships = await Internship.find({})
        .select('companyId department targetDepartments')
        .lean();

    const companyIds = internships
        .filter((internship) => internshipMatchesAcademicScope(internship, scopeDepartmentKeys))
        .map((internship) => internship.companyId);

    return normalizeObjectIds(companyIds);
}

async function resolveCollegeScope(userId) {
    const actor = await User.findById(userId)
        .select('college collegeId')
        .lean();

    if (!actor) return null;

    if (actor.collegeId && mongoose.Types.ObjectId.isValid(String(actor.collegeId))) {
        const collegeById = await College.findById(actor.collegeId).select('_id name').lean();
        if (collegeById) return collegeById;
    }

    const normalizedCollegeName = canonicalizeAcademicName(actor.college || '');
    if (!normalizedCollegeName) return null;

    const colleges = await College.find({}).select('_id name').lean();
    const candidates = colleges.map((college) => ({
        _id: String(college?._id || ''),
        name: String(college?.name || '')
    }));
    return findBestAcademicMatch(normalizedCollegeName, candidates, 0.8)?.candidate || null;
}

async function resolveStudentScope(userId) {
    const actor = await User.findById(userId)
        .select('college collegeId department departmentId')
        .lean();

    if (!actor) return null;

    const college = await resolveCollegeScope(userId);
    const collegeId = college?._id ? String(college._id) : String(actor.collegeId || '').trim();
    const collegeName = college?.name ? String(college.name).trim() : String(actor.college || '').trim();

    let department = null;
    if (actor.departmentId && mongoose.Types.ObjectId.isValid(String(actor.departmentId))) {
        const departmentById = await require('../models/Department').findById(actor.departmentId).select('_id name college collegeId').lean();
        if (departmentById) department = departmentById;
    }

    if (!department) {
        const departmentName = canonicalizeAcademicName(actor.department || '');
        if (departmentName) {
            const Department = require('../models/Department');
            const departments = await Department.find({}).select('_id name college collegeId').lean();
            const candidates = departments.filter((item) => {
                const candidateCollegeId = String(item?.collegeId || item?.college || '').trim();
                return !collegeId || candidateCollegeId === collegeId;
            }).map((item) => ({
                _id: String(item?._id || ''),
                name: String(item?.name || ''),
                collegeId: String(item?.collegeId || item?.college || '').trim()
            }));
            department = findBestAcademicMatch(departmentName, candidates, 0.8)?.candidate || null;
        }
    }

    return {
        collegeId,
        collegeName,
        departmentId: department?._id ? String(department._id) : String(actor.departmentId || '').trim(),
        departmentName: department?.name ? String(department.name).trim() : String(actor.department || '').trim()
    };
}

async function resolveDepartmentScope(userId) {
    const actor = await User.findById(userId)
        .select('college collegeId department departmentId')
        .lean();

    if (!actor) return null;

    const college = await resolveCollegeScope(userId);
    const collegeId = college?._id ? String(college._id) : String(actor.collegeId || '').trim();
    const collegeName = college?.name ? String(college.name).trim() : String(actor.college || '').trim();

    let department = null;
    if (actor.departmentId && mongoose.Types.ObjectId.isValid(String(actor.departmentId))) {
        department = await require('../models/Department').findById(actor.departmentId).select('_id name college collegeId').lean();
    }

    if (!department) {
        const departmentName = canonicalizeAcademicName(actor.department || '');
        if (departmentName) {
            const Department = require('../models/Department');
            const departments = await Department.find({}).select('_id name college collegeId').lean();
            const candidates = departments.filter((item) => {
                const candidateCollegeId = String(item?.collegeId || item?.college || '').trim();
                return !collegeId || candidateCollegeId === collegeId;
            });
            department = findBestAcademicMatch(departmentName, candidates, 0.8)?.candidate || null;
        }
    }

    return {
        collegeId,
        collegeName,
        departmentId: department?._id ? String(department._id) : String(actor.departmentId || '').trim(),
        departmentName: department?.name ? String(department.name).trim() : String(actor.department || '').trim()
    };
}

function asObjectId(value) {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) return null;
    return new mongoose.Types.ObjectId(value);
}

function emitSocket(io, room, event, payload) {
    if (!io || !room || !event) return;
    io.to(room).emit(event, payload);
}

async function populateMessage(messageId) {
    const message = await Message.findById(messageId)
        .populate('senderId', 'name fullName email role')
        .populate('receiverId', 'name fullName email role')
        .populate('replyTo', 'content senderId createdAt messageType attachment')
        .lean();

    if (!message) return null;

    const companyProfileMap = await fetchCompanyContactIdentityMap(extractCompanyProfileIds(message));
    return enrichMessageWithDisplayNames(message, companyProfileMap);
}

// Lightweight online status endpoint - returns isOnline & lastSeen for given user IDs
router.get('/online-status', auth, async (req, res) => {
    try {
        const ids = String(req.query.ids || '').split(',').filter(id => mongoose.Types.ObjectId.isValid(id.trim()));
        if (!ids.length) return res.json({});
        const users = await User.find({ _id: { $in: ids } }, 'isOnline lastSeen').lean();
        const result = {};
        users.forEach(u => {
            result[String(u._id)] = { isOnline: Boolean(u.isOnline), lastSeen: u.lastSeen || null };
        });
        res.json(result);
    } catch (err) {
        res.status(500).json({ message: 'Failed to get online statuses.' });
    }
});

router.get('/contacts', auth, async (req, res) => {
    try {
        const role = String(req.query.role || 'all').trim().toLowerCase();
        const search = String(req.query.search || '').trim();
        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
        const currentRole = normalizeRole(req.user?.role);
        const currentAdminType = String(req.user?.adminType || '').trim().toLowerCase();
        const currentUserId = asObjectId(req.user.id);
        let companyContactIds = [];

        const filter = { _id: { $ne: currentUserId } };

        if (currentRole === 'employer') {
            const employerScope = await resolveEmployerContactScope(req.user.id);
            if (!employerScope) {
                return res.json([]);
            }

            const searchRegex = search
                ? new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
                : null;

            const items = employerScope.users.filter((user) => {
                if (!searchRegex) return true;
                return [user.name, user.fullName, user.email, user.department, user.college, getRoleLabel(user.role)]
                    .some((value) => searchRegex.test(String(value || '')));
            });

            const itemIds = items.map((item) => item._id);
            const itemObjectIds = itemIds.map((itemId) => asObjectId(itemId)).filter(Boolean);

            const contactDocs = await User.aggregate([
                { $match: { _id: { $in: itemObjectIds } } },
                { $sort: { fullName: 1, name: 1 } },
                {
                    $lookup: {
                        from: 'profiles',
                        localField: '_id',
                        foreignField: 'userId',
                        as: 'profileData'
                    }
                },
                {
                    $lookup: {
                        from: 'companyprofiles',
                        localField: '_id',
                        foreignField: 'user',
                        as: 'companyData'
                    }
                },
                {
                    $lookup: {
                        from: 'messages',
                        let: { contactId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$conversationType', 'direct'] },
                                            { $not: { $in: [asObjectId(req.user.id), { $ifNull: ['$deletedForUsers', []] }] } },
                                            {
                                                $or: [
                                                    { $and: [{ $eq: ['$senderId', '$$contactId'] }, { $eq: ['$receiverId', asObjectId(req.user.id)] }] },
                                                    { $and: [{ $eq: ['$senderId', asObjectId(req.user.id)] }, { $eq: ['$receiverId', '$$contactId'] }] }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            },
                            { $sort: { createdAt: -1 } },
                            { $limit: 1 }
                        ],
                        as: 'lastMsgData'
                    }
                },
                {
                    $lookup: {
                        from: 'messages',
                        let: { contactId: '$_id' },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $and: [
                                            { $eq: ['$conversationType', 'direct'] },
                                            { $eq: ['$senderId', '$$contactId'] },
                                            { $eq: ['$receiverId', asObjectId(req.user.id)] },
                                            { $eq: ['$isRead', false] },
                                            { $not: { $in: [asObjectId(req.user.id), { $ifNull: ['$deletedForUsers', []] }] } }
                                        ]
                                    }
                                }
                            },
                            { $count: 'count' }
                        ],
                        as: 'unreadCountData'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        name: 1,
                        fullName: 1,
                        email: 1,
                        role: 1,
                        department: 1,
                        college: 1,
                        isOnline: 1,
                        lastSeen: 1,
                        avatar: {
                            $cond: [
                                { $gt: [{ $size: '$companyData' }, 0] },
                                { $arrayElemAt: ['$companyData.logo', 0] },
                                {
                                    $cond: [
                                        { $gt: [{ $size: '$profileData' }, 0] },
                                        { $arrayElemAt: ['$profileData.profilePicUrl', 0] },
                                        null
                                    ]
                                }
                            ]
                        },
                        lastMessage: { $arrayElemAt: ['$lastMsgData', 0] },
                        unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadCountData.count', 0] }, 0] }
                    }
                },
                { $sort: { unreadCount: -1, 'lastMessage.createdAt': -1, fullName: 1, name: 1 } },
                { $limit: limit }
            ]);

            const rolePriority = { student: 1, hod: 2, dean: 3, admin: 4 };
            const companyIdentityMap = await fetchCompanyContactIdentityMap(itemIds);
            const result = contactDocs.map((u) => ({
                ...enrichContactUser(u, companyIdentityMap.get(String(u._id))),
                id: String(u._id),
                _id: String(u._id),
                type: 'direct',
                role: normalizeRole(u.role),
                roleLabel: getRoleLabel(u.role),
                roleBadgeClass: getRoleBadgeClass(u.role),
                lastMessage: u.lastMessage ? {
                    content: u.lastMessage.content,
                    createdAt: u.lastMessage.createdAt,
                    senderId: String(u.lastMessage.senderId)
                } : null,
                unreadCount: Number(u.unreadCount || 0),
                categoryRank: rolePriority[normalizeRole(u.role)] || 99
            })).sort((left, right) => {
                if (left.categoryRank !== right.categoryRank) return left.categoryRank - right.categoryRank;
                return String(left.fullName || left.name || '').localeCompare(String(right.fullName || right.name || ''));
            });

            return res.json(result);
        }

        if (currentRole === 'student') {
            const studentScope = await resolveStudentScope(req.user.id);
            if (!studentScope?.collegeId || !studentScope?.departmentId) {
                return res.status(403).json({ message: 'Unable to resolve the student academic scope.' });
            }

            companyContactIds = await resolveAppliedCompanyIdsForStudent(req.user.id);

            const studentCollegeRegex = studentScope.collegeName
                ? new RegExp(`^\\s*${escapeRegex(studentScope.collegeName)}\\s*$`, 'i')
                : null;
            const studentDepartmentRegex = studentScope.departmentName
                ? new RegExp(`^\\s*${escapeRegex(studentScope.departmentName)}\\s*$`, 'i')
                : null;

            filter.$or = [
                {
                    role: { $in: getRoleVariants('student') },
                    departmentId: asObjectId(studentScope.departmentId)
                },
                {
                    role: { $in: getRoleVariants('student') },
                    department: studentDepartmentRegex
                },
                {
                    role: { $in: getRoleVariants('hod') },
                    departmentId: asObjectId(studentScope.departmentId)
                },
                {
                    role: { $in: getRoleVariants('hod') },
                    department: studentDepartmentRegex
                },
                {
                    role: { $in: getRoleVariants('dean') },
                    collegeId: asObjectId(studentScope.collegeId)
                },
                {
                    role: { $in: getRoleVariants('dean') },
                    college: studentCollegeRegex
                },
                {
                    role: { $in: getRoleVariants('superadmin') }
                },
                {
                    role: { $in: getRoleVariants('employer') },
                    _id: { $in: normalizeObjectIds(companyContactIds).map(asObjectId).filter(Boolean) }
                }
            ];

            if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$and = [{
                    $or: [
                        { name: regex },
                        { fullName: regex },
                        { email: regex },
                        { department: regex },
                        { college: regex }
                    ]
                }];
            }
        } else if (currentRole === 'hod' || currentAdminType === 'deptadmin') {
            const hodScope = await resolveDepartmentScope(req.user.id);
            if (!hodScope?.collegeId || !hodScope?.departmentId) {
                return res.status(403).json({ message: 'Unable to resolve the HOD academic scope.' });
            }

            companyContactIds = await resolveIndustryPartnerIdsForAcademicScope(hodScope);

            const hodCollegeRegex = hodScope.collegeName
                ? new RegExp(`^\\s*${escapeRegex(hodScope.collegeName)}\\s*$`, 'i')
                : null;
            const hodDepartmentRegex = hodScope.departmentName
                ? new RegExp(`^\\s*${escapeRegex(hodScope.departmentName)}\\s*$`, 'i')
                : null;

            filter.$or = [
                {
                    role: { $in: getRoleVariants('student') },
                    $and: [
                        {
                            $or: [
                                { departmentId: asObjectId(hodScope.departmentId) },
                                ...(hodDepartmentRegex ? [{ department: hodDepartmentRegex }] : [])
                            ]
                        },
                        {
                            $or: [
                                { collegeId: asObjectId(hodScope.collegeId) },
                                ...(hodCollegeRegex ? [{ college: hodCollegeRegex }] : [])
                            ]
                        }
                    ]
                },
                {
                    role: { $in: getRoleVariants('hod') },
                    _id: { $ne: currentUserId }
                },
                {
                    role: { $in: getRoleVariants('dean') },
                    $and: [
                        {
                            $or: [
                                { collegeId: asObjectId(hodScope.collegeId) },
                                ...(hodCollegeRegex ? [{ college: hodCollegeRegex }] : [])
                            ]
                        }
                    ]
                },
                {
                    role: { $in: getRoleVariants('superadmin') }
                },
                {
                    role: { $in: getRoleVariants('employer') },
                    _id: { $in: normalizeObjectIds(companyContactIds).map(asObjectId).filter(Boolean) }
                }
            ];

            if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$and = [{
                    $or: [
                        { name: regex },
                        { fullName: regex },
                        { email: regex },
                        { department: regex },
                        { college: regex }
                    ]
                }];
            }
        } else if (currentRole === 'dean' || currentAdminType === 'collegeadmin') {
            const deanCollege = await resolveCollegeScope(req.user.id);
            if (!deanCollege) {
                return res.status(403).json({ message: 'Unable to resolve the Dean college scope.' });
            }

            companyContactIds = await resolveIndustryPartnerIdsForAcademicScope({ collegeId: deanCollege._id, collegeName: deanCollege.name });

            const deanCollegeName = String(deanCollege.name || '').trim();
            const deanCollegeRegex = deanCollegeName
                ? new RegExp(`^\\s*${escapeRegex(deanCollegeName)}\\s*$`, 'i')
                : null;

            filter.$or = [
                {
                    role: { $in: getRoleVariants('student') },
                    $or: [
                        { collegeId: deanCollege._id },
                        ...(deanCollegeRegex ? [{ college: deanCollegeRegex }] : [])
                    ]
                },
                {
                    role: { $in: getRoleVariants('hod') },
                    $or: [
                        { collegeId: deanCollege._id },
                        ...(deanCollegeRegex ? [{ college: deanCollegeRegex }] : [])
                    ]
                },
                {
                    role: { $in: getRoleVariants('dean') }
                },
                {
                    role: { $in: getRoleVariants('superadmin') }
                },
                {
                    role: { $in: getRoleVariants('employer') },
                    _id: { $in: normalizeObjectIds(companyContactIds).map(asObjectId).filter(Boolean) }
                }
            ];

            if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$and = [{
                    $or: [
                        { name: regex },
                        { fullName: regex },
                        { email: regex },
                        { department: regex },
                        { college: regex }
                    ]
                }];
            }
        } else {
            const roleVariants = getRoleVariants(role);
            if (role !== 'all' && roleVariants.length > 0) {
                filter.role = { $in: roleVariants };
            }
            if (search) {
                const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
                filter.$or = [{ name: regex }, { fullName: regex }, { email: regex }, { department: regex }, { college: regex }];
            }
        }

        const companyIdentityMap = await fetchCompanyContactIdentityMap(companyContactIds);

        const items = await User.aggregate([
            { $match: filter },
            { $sort: { fullName: 1, name: 1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'profiles',
                    localField: '_id',
                    foreignField: 'userId',
                    as: 'profileData'
                }
            },
            {
                $lookup: {
                    from: 'companyprofiles',
                    localField: '_id',
                    foreignField: 'user',
                    as: 'companyData'
                }
            },
            {
                $lookup: {
                    from: 'messages',
                    let: { contactId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$conversationType', 'direct'] },
                                        { $not: { $in: [asObjectId(req.user.id), { $ifNull: ['$deletedForUsers', []] }] } },
                                        {
                                            $or: [
                                                { $and: [{ $eq: ['$senderId', '$$contactId'] }, { $eq: ['$receiverId', asObjectId(req.user.id)] }] },
                                                { $and: [{ $eq: ['$senderId', asObjectId(req.user.id)] }, { $eq: ['$receiverId', '$$contactId'] }] }
                                            ]
                                        }
                                    ]
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: 'lastMsgData'
                }
            },
            {
                $lookup: {
                    from: 'messages',
                    let: { contactId: '$_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$conversationType', 'direct'] },
                                        { $eq: ['$senderId', '$$contactId'] },
                                        { $eq: ['$receiverId', asObjectId(req.user.id)] },
                                        { $eq: ['$isRead', false] },
                                        { $not: { $in: [asObjectId(req.user.id), { $ifNull: ['$deletedForUsers', []] }] } }
                                    ]
                                }
                            }
                        },
                        { $count: 'count' }
                    ],
                    as: 'unreadCountData'
                }
            },
            {
                $project: {
                    _id: 1,
                    name: 1,
                    fullName: 1,
                    email: 1,
                    role: 1,
                    department: 1,
                    college: 1,
                    isOnline: 1,
                    lastSeen: 1,
                    avatar: {
                        $cond: [
                            { $gt: [{ $size: '$companyData' }, 0] },
                            { $arrayElemAt: ['$companyData.logo', 0] },
                            {
                                $cond: [
                                    { $gt: [{ $size: '$profileData' }, 0] },
                                    { $arrayElemAt: ['$profileData.profilePicUrl', 0] },
                                    null
                                ]
                            }
                        ]
                    },
                    lastMessage: { $arrayElemAt: ['$lastMsgData', 0] },
                    unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadCountData.count', 0] }, 0] }
                }
            },
            { $sort: { unreadCount: -1, 'lastMessage.createdAt': -1, fullName: 1, name: 1 } }
        ]);

        const result = items.map((u) => {
            const companyProfile = companyIdentityMap.get(String(u._id));
            return {
                ...enrichContactUser(u, companyProfile),
                id: String(u._id),
                _id: String(u._id),
                type: 'direct',
                lastMessage: u.lastMessage ? {
                    content: u.lastMessage.content,
                    createdAt: u.lastMessage.createdAt,
                    senderId: String(u.lastMessage.senderId)
                } : null,
                unreadCount: Number(u.unreadCount || 0)
            };
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load chat contacts.' });
    }
});

router.get('/unread-count', auth, async (req, res) => {
    try {
        const userId = asObjectId(req.user.id);
        if (!userId) return res.status(400).json({ message: 'Invalid user ID.' });

        const directUnreadCount = await Message.countDocuments({
            conversationType: 'direct',
            receiverId: userId,
            isRead: false,
            deletedForEveryone: false,
            deletedForUsers: { $nin: [userId] }
        });

        const rooms = await ChatRoom.find({ members: req.user.id }).select('_id').lean();
        const roomIds = rooms.map((room) => room._id).filter(Boolean);

        let roomUnreadCount = 0;
        if (roomIds.length > 0) {
            roomUnreadCount = await Message.countDocuments({
                roomId: { $in: roomIds },
                conversationType: { $in: ['group', 'channel'] },
                senderId: { $ne: userId },
                seenBy: { $nin: [userId] },
                deletedForEveryone: false,
                deletedForUsers: { $nin: [userId] }
            });
        }

        res.json({ unreadCount: directUnreadCount + roomUnreadCount });
    } catch (error) {
        res.status(500).json({ message: 'Failed to load unread message count.' });
    }
});

router.get('/rooms', auth, async (req, res) => {
    try {
        const rooms = await ChatRoom.find({ members: req.user.id })
            .select('name type ownerId members admins mutedBy lastMessageAt')
            .sort({ lastMessageAt: -1 })
            .lean();

        const allMemberIds = [...new Set(rooms.flatMap((room) => Array.isArray(room.members) ? room.members.map((item) => String(item)) : []))];
        const memberProfiles = await User.find({ _id: { $in: allMemberIds } })
            .select('name fullName email role department college')
            .lean();
        const profileById = new Map(memberProfiles.map((item) => [String(item._id), item]));

        const roomIds = rooms.map((room) => room._id);
        const recentMessages = await Message.find({ roomId: { $in: roomIds }, conversationType: { $in: ['group', 'channel'] } })
            .sort({ createdAt: -1 })
            .lean();

        const latestByRoom = new Map();
        for (const message of recentMessages) {
            const key = String(message.roomId || '');
            if (key && !latestByRoom.has(key)) {
                latestByRoom.set(key, message);
            }
        }

        const unreadCounts = await Message.aggregate([
            {
                $match: {
                    roomId: { $in: roomIds },
                    senderId: { $ne: asObjectId(req.user.id) },
                    seenBy: { $nin: [asObjectId(req.user.id)] },
                    deletedForEveryone: false,
                    deletedForUsers: { $nin: [asObjectId(req.user.id)] }
                }
            },
            { $group: { _id: '$roomId', count: { $sum: 1 } } }
        ]).catch(() => []);
        const unreadMap = new Map(unreadCounts.map((item) => [String(item._id), item.count]));

        res.json(rooms.map((room) => ({
            id: String(room._id),
            type: room.type,
            name: room.name,
            ownerId: String(room.ownerId),
            members: Array.isArray(room.members) ? room.members.map((item) => String(item)) : [],
            admins: Array.isArray(room.admins) ? room.admins.map((item) => String(item)) : [],
            memberProfiles: Array.isArray(room.members) ? room.members.map((memberId) => {
                const profile = profileById.get(String(memberId));
                return profile ? {
                    id: String(memberId),
                    name: profile.fullName || profile.name || profile.email,
                    role: normalizeRole(profile.role),
                    department: profile.department || '',
                    college: profile.college || ''
                } : { id: String(memberId), name: String(memberId).slice(0, 8), role: 'student' };
            }) : [],
            membersCount: Array.isArray(room.members) ? room.members.length : 0,
            canPost: room.type !== 'channel' || String(room.ownerId) === String(req.user.id) || (Array.isArray(room.admins) && room.admins.some((item) => String(item) === String(req.user.id))),
            isMuted: Array.isArray(room.mutedBy) ? room.mutedBy.some((item) => String(item) === String(req.user.id)) : false,
            unreadCount: unreadMap.get(String(room._id)) || 0,
            lastMessage: latestByRoom.get(String(room._id)) || null
        })));
    } catch (error) {
        res.status(500).json({ message: 'Failed to load rooms.' });
    }
});

router.post('/rooms', auth, async (req, res) => {
    try {
        const name = String(req.body.name || '').trim();
        const type = String(req.body.type || 'group').trim().toLowerCase();
        const membersInput = Array.isArray(req.body.members) ? req.body.members : [];
        const members = [...new Set(membersInput.map((item) => String(item)).filter(Boolean))];

        if (!name) {
            return res.status(400).json({ message: 'Room name is required.' });
        }
        if (!['group', 'channel'].includes(type)) {
            return res.status(400).json({ message: 'Room type must be group or channel.' });
        }

        const memberSet = new Set(members);
        memberSet.add(String(req.user.id));

        const room = await ChatRoom.create({
            name,
            type,
            ownerId: req.user.id,
            members: [...memberSet],
            admins: [req.user.id],
            mutedBy: [],
            lastMessageAt: new Date()
        });

        res.status(201).json(room);
    } catch (error) {
        res.status(500).json({ message: 'Failed to create room.' });
    }
});

router.post('/rooms/:roomId/members', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.body.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isAdmin = String(room.ownerId) === String(req.user.id) || room.admins.some((item) => String(item) === String(req.user.id));
        if (!isAdmin) return res.status(403).json({ message: 'Only room admins can add members.' });

        if (!memberId) return res.status(400).json({ message: 'memberId is required.' });
        if (!room.members.some((item) => String(item) === memberId)) {
            room.members.push(memberId);
            await room.save();
        }

        res.json({ message: 'Member added.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to add member.' });
    }
});

router.post('/rooms/:roomId/admins', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.body.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isOwner = String(room.ownerId) === String(req.user.id);
        if (!isOwner) return res.status(403).json({ message: 'Only room owner can promote admins.' });

        if (!memberId) return res.status(400).json({ message: 'memberId is required.' });
        const isMember = room.members.some((item) => String(item) === memberId);
        if (!isMember) return res.status(400).json({ message: 'User must be a room member.' });

        if (!room.admins.some((item) => String(item) === memberId)) {
            room.admins.push(memberId);
            await room.save();
        }

        res.json({ message: 'Admin promoted.', admins: room.admins.map((item) => String(item)) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to promote admin.' });
    }
});

router.delete('/rooms/:roomId/admins/:memberId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const memberId = String(req.params.memberId || '').trim();

        const room = await ChatRoom.findById(roomId);
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isOwner = String(room.ownerId) === String(req.user.id);
        if (!isOwner) return res.status(403).json({ message: 'Only room owner can demote admins.' });
        if (String(room.ownerId) === memberId) return res.status(400).json({ message: 'Owner cannot be demoted.' });

        room.admins = room.admins.filter((item) => String(item) !== memberId);
        await room.save();

        res.json({ message: 'Admin demoted.', admins: room.admins.map((item) => String(item)) });
    } catch (error) {
        res.status(500).json({ message: 'Failed to demote admin.' });
    }
});

router.get('/history/direct/:otherUserId', auth, async (req, res) => {
    try {
        const otherUserId = String(req.params.otherUserId || '').trim();
        if (!otherUserId) {
            return res.status(400).json({ message: 'otherUserId is required.' });
        }

        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
        const before = req.query.before ? new Date(req.query.before) : null;
        const query = {
            conversationType: 'direct',
            deletedForUsers: { $nin: [asObjectId(req.user.id)] },
            $or: [
                { senderId: asObjectId(req.user.id), receiverId: asObjectId(otherUserId) },
                { senderId: asObjectId(otherUserId), receiverId: asObjectId(req.user.id) }
            ]
        };

        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('senderId', 'name fullName email role')
            .populate('receiverId', 'name fullName email role')
            .populate('replyTo', 'content senderId createdAt messageType attachment')
            .lean();

        const companyProfileMap = await fetchCompanyContactIdentityMap(messages.flatMap((message) => extractCompanyProfileIds(message)));
        const enrichedMessages = await Promise.all(messages.map((message) => enrichMessageWithDisplayNames(message, companyProfileMap)));

        res.json(enrichedMessages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load direct chat history.' });
    }
});

router.get('/history/room/:roomId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        const room = await ChatRoom.findById(roomId).select('members').lean();
        if (!room) return res.status(404).json({ message: 'Room not found.' });

        const isMember = Array.isArray(room.members) && room.members.some((item) => String(item) === String(req.user.id));
        if (!isMember) return res.status(403).json({ message: 'Not a room member.' });

        const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 300);
        const before = req.query.before ? new Date(req.query.before) : null;
        const query = {
            roomId,
            conversationType: { $in: ['group', 'channel'] },
            deletedForUsers: { $nin: [asObjectId(req.user.id)] }
        };

        if (before && !Number.isNaN(before.getTime())) {
            query.createdAt = { $lt: before };
        }

        const messages = await Message.find(query)
            .sort({ createdAt: 1 })
            .limit(limit)
            .populate('senderId', 'name fullName email role')
            .populate('receiverId', 'name fullName email role')
            .populate('replyTo', 'content senderId createdAt messageType attachment')
            .lean();

        const companyProfileMap = await fetchCompanyContactIdentityMap(messages.flatMap((message) => extractCompanyProfileIds(message)));
        const enrichedMessages = await Promise.all(messages.map((message) => enrichMessageWithDisplayNames(message, companyProfileMap)));

        res.json(enrichedMessages);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load room history.' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const receiverId = String(req.body.receiverId || '').trim();
        const roomId = String(req.body.roomId || '').trim();
        const content = String(req.body.content || '').trim();
        const internshipId = String(req.body.internshipId || '').trim();
        const messageType = String(req.body.messageType || 'text').trim().toLowerCase();
        const callId = String(req.body.callId || '').trim();
        const callMedia = String(req.body.callMedia || '').trim().toLowerCase();
        const signalType = String(req.body.signalType || '').trim().toLowerCase();
        const signalData = req.body.signalData;
        const replyTo = String(req.body.replyTo || '').trim();
        const forwardedFrom = String(req.body.forwardedFrom || '').trim();
        const conversationType = roomId ? (String(req.body.conversationType || 'group').trim().toLowerCase()) : 'direct';
        const attachmentInput = req.body.attachment && typeof req.body.attachment === 'object' ? req.body.attachment : null;
        const attachment = attachmentInput ? {
            name: String(attachmentInput.name || '').trim(),
            type: String(attachmentInput.type || '').trim(),
            size: Number(attachmentInput.size || 0),
            url: String(attachmentInput.url || '').trim()
        } : undefined;

        if (!['text', 'signal', 'system'].includes(messageType)) {
            return res.status(400).json({ message: 'Invalid messageType.' });
        }
        if (!content && !attachment && messageType === 'text') {
            return res.status(400).json({ message: 'content is required.' });
        }

        if (!roomId && !receiverId) {
            return res.status(400).json({ message: 'receiverId or roomId is required.' });
        }

        let room = null;
        if (roomId) {
            room = await ChatRoom.findById(roomId).select('members type ownerId admins').lean();
            if (!room) return res.status(404).json({ message: 'Room not found.' });
            const isMember = Array.isArray(room.members) && room.members.some((item) => String(item) === String(req.user.id));
            if (!isMember) return res.status(403).json({ message: 'Not a room member.' });
            const isChannel = String(room.type) === 'channel';
            const isAdmin = String(room.ownerId) === String(req.user.id) || (Array.isArray(room.admins) && room.admins.some((item) => String(item) === String(req.user.id)));
            if (isChannel && !isAdmin) {
                return res.status(403).json({ message: 'Only channel admins can post messages.' });
            }
        }

        // Handle reply preview creation
        let replyPreview = null;
        if (replyTo) {
            const originalMessage = await Message.findById(replyTo).populate('senderId', 'fullName name');
            if (originalMessage) {
                replyPreview = {
                    content: originalMessage.content.substring(0, 100) + (originalMessage.content.length > 100 ? '...' : ''),
                    senderName: originalMessage.senderId?.fullName || originalMessage.senderId?.name || 'Unknown',
                    attachmentType: originalMessage.attachment?.mimeType || ''
                };
            }
        }

        // Enhanced attachment handling
        let processedAttachment = attachment;
        if (attachment && typeof attachment === 'object') {
            processedAttachment = {
                name: String(attachment.name || '').trim(),
                type: String(attachment.type || '').trim(),
                mimeType: String(attachment.mimeType || '').trim(),
                size: Number(attachment.size || 0),
                url: String(attachment.url || '').trim(),
                thumbnailUrl: String(attachment.thumbnailUrl || '').trim(),
                dimensions: {
                    width: Number(attachment.dimensions?.width || 0),
                    height: Number(attachment.dimensions?.height || 0)
                },
                duration: Number(attachment.duration || 0)
            };
        }

        const payload = {
            senderId: req.user.id,
            receiverId: receiverId || req.user.id,
            roomId: roomId || undefined,
            conversationType: roomId ? room.type : 'direct',
            internshipId: internshipId || undefined,
            content: content || (attachment ? '[attachment]' : '[signal]'),
            messageType,
            callId,
            callMedia,
            signalType,
            signalData,
            attachment: processedAttachment,
            replyTo: replyTo || undefined,
            replyPreview,
            forwardedFrom: forwardedFrom || undefined,
            deliveredTo: [req.user.id],
            seenBy: [req.user.id],
            isRead: false
        };

        const message = await Message.create(payload);

        if (roomId) {
            await ChatRoom.updateOne({ _id: roomId }, { $set: { lastMessageAt: new Date() } }).catch(() => {});
        }

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');

        if (roomId) {
            emitSocket(io, `room:${roomId}`, 'message:new', populated);
        } else {
            emitSocket(io, `user:${receiverId}`, 'message:new', populated);
            emitSocket(io, `user:${req.user.id}`, 'message:new', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to send message.' });
    }
});

router.patch('/mark-as-read', auth, async (req, res) => {
    try {
        const { otherUserId = null, roomId = null } = req.body;
        const userId = asObjectId(req.user.id);

        if (!otherUserId && !roomId) {
            return res.status(400).json({ message: 'otherUserId or roomId is required.' });
        }

        const query = {
            conversationType: otherUserId ? 'direct' : { $in: ['group', 'channel'] },
            senderId: otherUserId ? asObjectId(otherUserId) : { $ne: userId },
            seenBy: { $nin: [userId] }
        };

        if (otherUserId) {
            query.receiverId = userId;
        }

        if (roomId) {
            query.roomId = asObjectId(roomId);
        }

        const updated = await Message.updateMany(
            query,
            {
                $addToSet: { seenBy: userId, deliveredTo: userId },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            }
        );

        res.json({ message: 'Conversation marked as read.', updatedCount: updated.modifiedCount });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark conversation as read.' });
    }
});

router.patch('/:id/edit', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const content = String(req.body.content || '').trim();
        if (!content) return res.status(400).json({ message: 'content is required.' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });
        if (String(message.senderId) !== String(req.user.id)) return res.status(403).json({ message: 'Only sender can edit message.' });
        if (message.deletedForEveryone) return res.status(400).json({ message: 'Cannot edit deleted message.' });

        // Store original content if not already stored
        if (!message.originalContent) {
            message.originalContent = message.content;
        }
        
        message.content = content;
        message.editedAt = new Date();
        message.isEdited = true; // Add isEdited flag
        await message.save();

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');
        
        // Emit enhanced edit event with full edit information
        const editPayload = {
            ...populated,
            isEdited: true,
            editEvent: {
                editedAt: message.editedAt,
                originalContent: message.originalContent,
                newContent: content,
                editedBy: String(req.user.id),
                messageId: String(message._id)
            }
        };
        
        // Broadcast to all relevant participants
        if (message.roomId) {
            emitSocket(io, `room:${message.roomId}`, 'message:edited', editPayload);
        } else {
            emitSocket(io, `user:${message.receiverId}`, 'message:edited', editPayload);
            emitSocket(io, `user:${message.senderId}`, 'message:edited', editPayload);
        }

        res.json({
            ...populated,
            isEdited: true,
            editEvent: editPayload.editEvent
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to edit message.' });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const hardDelete = Boolean(req.query.hardDelete === 'true');

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const isSender = String(message.senderId) === String(req.user.id);
        const isReceiver = String(message.receiverId) === String(req.user.id);
        
        if (!isSender && !isReceiver) {
            return res.status(403).json({ message: 'You can only delete messages in your own conversations.' });
        }

        // COMPLETELY ERASE and REMOVE logic
        const deleteForEveryone = req.query.forEveryone === 'true';
        const io = req.app.get('io');
        const payload = { id: id, messageId: id, deleteForEveryone };

        if (deleteForEveryone) {
            // HARD DELETE for everyone
            await Message.findByIdAndDelete(id);
            
            if (message.roomId) {
                emitSocket(io, `room:${message.roomId}`, 'message:deleted', payload);
            } else {
                emitSocket(io, `user:${message.receiverId}`, 'message:deleted', payload);
                emitSocket(io, `user:${message.senderId}`, 'message:deleted', payload);
            }
            return res.json({ message: 'Message erased for everyone.', data: payload });
        } else {
            // DELETE FOR ME: Add user to deletedForUsers list
            if (!message.deletedForUsers.includes(req.user.id)) {
                message.deletedForUsers.push(req.user.id);
                await message.save();
            }
            
            // Only emit to the person who deleted it
            emitSocket(io, `user:${req.user.id}`, 'message:deleted', payload);
            
            return res.json({ message: 'Message erased for you.', data: payload });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete message.' });
    }
});

router.post('/:id/react', auth, async (req, res) => {
    try {
        const id = String(req.params.id || '').trim();
        const emoji = String(req.body.emoji || '').trim();
        if (!emoji) return res.status(400).json({ message: 'emoji is required.' });

        const message = await Message.findById(id);
        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const existingIndex = message.reactions.findIndex((item) => String(item.userId) === String(req.user.id));
        if (existingIndex >= 0) {
            const existing = message.reactions[existingIndex];
            if (String(existing.emoji) === emoji) {
                message.reactions.splice(existingIndex, 1);
            } else {
                existing.emoji = emoji;
            }
        } else {
            message.reactions.push({ userId: req.user.id, emoji });
        }
        await message.save();

        const populated = await populateMessage(message._id);
        const io = req.app.get('io');
        if (message.roomId) {
            emitSocket(io, `room:${message.roomId}`, 'message:updated', populated);
        } else {
            emitSocket(io, `user:${message.receiverId}`, 'message:updated', populated);
            emitSocket(io, `user:${message.senderId}`, 'message:updated', populated);
        }

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to react to message.' });
    }
});

router.post('/:id/forward', auth, async (req, res) => {
    try {
        const sourceId = String(req.params.id || '').trim();
        const receiverId = String(req.body.receiverId || '').trim();
        const roomId = String(req.body.roomId || '').trim();

        const sourceMessage = await Message.findById(sourceId).lean();
        if (!sourceMessage) return res.status(404).json({ message: 'Source message not found.' });

        if (!receiverId && !roomId) {
            return res.status(400).json({ message: 'receiverId or roomId is required for forward.' });
        }

        let targetRoom = null;
        if (roomId) {
            targetRoom = await ChatRoom.findById(roomId).select('members type ownerId admins').lean();
            if (!targetRoom) return res.status(404).json({ message: 'Room not found.' });
            const isMember = Array.isArray(targetRoom.members) && targetRoom.members.some((item) => String(item) === String(req.user.id));
            if (!isMember) return res.status(403).json({ message: 'Not a room member.' });
            const isChannel = String(targetRoom.type) === 'channel';
            const isAdmin = String(targetRoom.ownerId) === String(req.user.id) || (Array.isArray(targetRoom.admins) && targetRoom.admins.some((item) => String(item) === String(req.user.id)));
            if (isChannel && !isAdmin) {
                return res.status(403).json({ message: 'Only channel admins can forward messages to this channel.' });
            }
        }

        const forwarded = await Message.create({
            senderId: req.user.id,
            receiverId: receiverId || req.user.id,
            roomId: roomId || undefined,
            conversationType: roomId ? String(targetRoom?.type || 'group') : 'direct',
            content: sourceMessage.content,
            messageType: sourceMessage.messageType === 'signal' ? 'text' : sourceMessage.messageType,
            attachment: sourceMessage.attachment,
            forwardedFrom: sourceMessage._id,
            deliveredTo: [req.user.id],
            seenBy: [req.user.id],
            isRead: false
        });

        const populated = await populateMessage(forwarded._id);
        const io = req.app.get('io');
        if (roomId) {
            emitSocket(io, `room:${roomId}`, 'message:new', populated);
        } else {
            emitSocket(io, `user:${receiverId}`, 'message:new', populated);
            emitSocket(io, `user:${req.user.id}`, 'message:new', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        res.status(500).json({ message: 'Failed to forward message.' });
    }
});

router.put('/seen/direct/:otherUserId', auth, async (req, res) => {
    try {
        const otherUserId = String(req.params.otherUserId || '').trim();
        if (!otherUserId) return res.status(400).json({ message: 'otherUserId is required.' });

        await Message.updateMany(
            { conversationType: 'direct', senderId: asObjectId(otherUserId), receiverId: asObjectId(req.user.id), seenBy: { $nin: [asObjectId(req.user.id)] } },
            { $addToSet: { seenBy: asObjectId(req.user.id), deliveredTo: asObjectId(req.user.id) }, $set: { isRead: true } }
        );

        const io = req.app.get('io');
        emitSocket(io, `user:${otherUserId}`, 'message:seen', { byUserId: String(req.user.id), conversationType: 'direct' });
        res.json({ message: 'Direct conversation marked seen.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark seen.' });
    }
});

router.put('/seen/room/:roomId', auth, async (req, res) => {
    try {
        const roomId = String(req.params.roomId || '').trim();
        if (!roomId) return res.status(400).json({ message: 'roomId is required.' });

        const updatedMessages = await Message.updateMany(
            { roomId, conversationType: { $in: ['group', 'channel'] }, seenBy: { $nin: [req.user.id] }, senderId: { $ne: req.user.id } },
            { 
                $addToSet: { seenBy: req.user.id, deliveredTo: req.user.id },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            }
        );

        const io = req.app.get('io');
        emitSocket(io, `room:${roomId}`, 'message:seen', { byUserId: String(req.user.id), roomId, conversationType: 'group' });
        res.json({ message: 'Room conversation marked seen.' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark seen.' });
    }
});

// Enhanced status update endpoints for proper read receipts
router.put('/status/delivered/:messageId', auth, async (req, res) => {
    try {
        const messageId = String(req.params.messageId || '').trim();
        if (!messageId) return res.status(400).json({ message: 'messageId is required.' });

        const message = await Message.findByIdAndUpdate(
            messageId,
            { 
                $addToSet: { deliveredTo: req.user.id },
                $set: { status: 'delivered', deliveredAt: new Date() }
            },
            { new: true }
        ).populate('senderId', 'name fullName email role');

        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const io = req.app.get('io');
        emitSocket(io, `user:${message.senderId._id}`, 'message:delivered', {
            messageId: String(message._id),
            status: 'delivered',
            deliveredAt: message.deliveredAt,
            deliveredBy: String(req.user.id)
        });

        res.json({ message: 'Message marked as delivered.', status: 'delivered' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark as delivered.' });
    }
});

router.put('/status/read/:messageId', auth, async (req, res) => {
    try {
        const messageId = String(req.params.messageId || '').trim();
        if (!messageId) return res.status(400).json({ message: 'messageId is required.' });

        const message = await Message.findByIdAndUpdate(
            messageId,
            { 
                $addToSet: { seenBy: req.user.id, deliveredTo: req.user.id },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            },
            { new: true }
        ).populate('senderId', 'name fullName email role');

        if (!message) return res.status(404).json({ message: 'Message not found.' });

        const io = req.app.get('io');
        emitSocket(io, `user:${message.senderId._id}`, 'message:read', {
            messageId: String(message._id),
            status: 'read',
            readAt: message.readAt,
            readBy: String(req.user.id)
        });

        res.json({ message: 'Message marked as read.', status: 'read' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark as read.' });
    }
});

router.put('/status/batch-read', auth, async (req, res) => {
    try {
        const { messageIds = [], roomId = null, otherUserId = null } = req.body;
        
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ message: 'messageIds array is required.' });
        }

        const updateQuery = {
            _id: { $in: messageIds.map(id => asObjectId(id)) },
            senderId: { $ne: asObjectId(req.user.id) },
            seenBy: { $nin: [asObjectId(req.user.id)] }
        };

        if (roomId) {
            updateQuery.roomId = asObjectId(roomId);
        } else if (otherUserId) {
            updateQuery.conversationType = 'direct';
            updateQuery.receiverId = asObjectId(req.user.id);
            updateQuery.senderId = asObjectId(otherUserId);
        }

        const updatedMessages = await Message.updateMany(
            updateQuery,
            { 
                $addToSet: { seenBy: asObjectId(req.user.id), deliveredTo: asObjectId(req.user.id) },
                $set: { isRead: true, status: 'read', readAt: new Date() }
            }
        );

        // Get the updated messages to emit proper socket events
        const messages = await Message.find({ _id: { $in: messageIds.map(id => asObjectId(id)) } })
            .populate('senderId', 'name fullName email role')
            .lean();

        const io = req.app.get('io');
        const senderIds = [...new Set(messages.map(msg => String(msg.senderId._id)))];
        
        senderIds.forEach(senderId => {
            const senderMessages = messages.filter(msg => String(msg.senderId._id) === senderId);
            emitSocket(io, `user:${senderId}`, 'message:batch-read', {
                messageIds: senderMessages.map(msg => String(msg._id)),
                readBy: String(req.user.id),
                readAt: new Date(),
                roomId,
                otherUserId
            });
        });

        res.json({ 
            message: 'Messages marked as read.', 
            updatedCount: updatedMessages.modifiedCount,
            status: 'read'
        });
    } catch (error) {
        res.status(500).json({ message: 'Failed to mark messages as read.' });
    }
});

router.get('/calls/history', auth, async (req, res) => {
    try {
        const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
        const sessions = await CallSession.find({ participants: req.user.id })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('initiatorId', 'name fullName email role')
            .populate('participants', 'name fullName email role')
            .lean();

        res.json(sessions);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load call history.' });
    }
});

router.post('/calls/start', auth, async (req, res) => {
    try {
        const callId = String(req.body.callId || '').trim();
        const mode = String(req.body.mode || 'audio').trim().toLowerCase();
        const roomId = String(req.body.roomId || '').trim();
        const participantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds.map((item) => String(item)).filter(Boolean) : [];

        if (!callId) return res.status(400).json({ message: 'callId is required.' });
        if (!['audio', 'video'].includes(mode)) return res.status(400).json({ message: 'mode must be audio or video.' });

        const uniqueParticipants = [...new Set([String(req.user.id), ...participantIds])];

        const session = await CallSession.findOneAndUpdate(
            { callId },
            {
                callId,
                roomId: roomId || undefined,
                initiatorId: req.user.id,
                participants: uniqueParticipants,
                mode,
                state: 'ringing',
                startedAt: new Date(),
                endedAt: null,
                durationSeconds: 0
            },
            { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
        );

        const io = req.app.get('io');
        uniqueParticipants.forEach((participantId) => {
            if (String(participantId) !== String(req.user.id)) {
                emitSocket(io, `user:${participantId}`, 'call:ringing', {
                    callId,
                    initiatorId: String(req.user.id),
                    participantIds: uniqueParticipants,
                    mode,
                    roomId: roomId || null
                });
            }
        });

        res.status(201).json(session);
    } catch (error) {
        res.status(500).json({ message: 'Failed to start call session.' });
    }
});

router.put('/calls/:callId/state', auth, async (req, res) => {
    try {
        const callId = String(req.params.callId || '').trim();
        const state = String(req.body.state || '').trim().toLowerCase();
        if (!['ringing', 'active', 'ended', 'missed'].includes(state)) {
            return res.status(400).json({ message: 'Invalid call state.' });
        }

        const session = await CallSession.findOne({ callId });
        if (!session) return res.status(404).json({ message: 'Call session not found.' });

        session.state = state;
        if (state === 'ended' || state === 'missed') {
            session.endedAt = new Date();
            if (session.startedAt) {
                session.durationSeconds = Math.max(0, Math.round((session.endedAt.getTime() - new Date(session.startedAt).getTime()) / 1000));
            }
        }
        await session.save();

        const io = req.app.get('io');
        session.participants.forEach((participantId) => {
            emitSocket(io, `user:${participantId}`, 'call:state', {
                callId,
                state,
                updatedBy: String(req.user.id),
                durationSeconds: session.durationSeconds
            });
        });

        res.json(session);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update call state.' });
    }
});

module.exports = router;
