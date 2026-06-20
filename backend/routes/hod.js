const express = require('express');
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');
const Internship = require('../models/Internship');
const Application = require('../models/Application');
const CompanyProfile = require('../models/CompanyProfile');
const Notification = require('../models/Notification');
const Profile = require('../models/Profile');
const Evaluation = require('../models/Evaluation');
const { getDepartmentContext } = require('../utils/hodContext');
const { updateStudentVerificationStatus } = require('../utils/studentVerification');
const { normalizeString } = require('../utils/normalize');
const { getCalculatedMatch } = require('../utils/internshipMatching');

const router = express.Router();

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeDepartmentKey(value = '') {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, '');
}

function buildDepartmentRegex(value = '') {
  const compact = normalizeDepartmentKey(value);
  if (!compact) return null;
  const tokens = String(value || '').trim().split(/\s+/).filter(Boolean).map((part) => escapeRegex(part));
  if (!tokens.length) return null;
  return new RegExp(`^\\s*${tokens.join('\\s*')}\\s*$`, 'i');
}

async function resolveHodScope(req) {
  const context = await getDepartmentContext(req);
  const department = context?.department || null;

  if (!department) {
    const error = new Error('Your HOD account is not linked to a department.');
    error.statusCode = 403;
    throw error;
  }

  const departmentName = String(department.name || '').trim();
  const departmentPattern = buildDepartmentRegex(departmentName);
  const college = department.collegeId
    ? await College.findById(department.collegeId).select('_id name').lean()
    : null;
  const collegeName = String(college?.name || '').trim();
  const collegePattern = buildDepartmentRegex(collegeName);

  const studentFilter = {
    role: { $in: ['student', 'Student'] },
    $and: [
      {
        $or: [
          { departmentId: department._id },
          ...(departmentPattern ? [{ department: departmentPattern }] : []),
          ...(departmentName ? [{ department: new RegExp(`^\\s*${escapeRegex(departmentName)}\\s*$`, 'i') }] : [])
        ]
      },
      {
        $or: [
          ...(department.collegeId ? [{ collegeId: department.collegeId }] : []),
          ...(collegePattern ? [{ college: collegePattern }] : []),
          ...(collegeName ? [{ college: new RegExp(`^\\s*${escapeRegex(collegeName)}\\s*$`, 'i') }] : [])
        ]
      }
    ]
  };

  const students = await User.find(studentFilter)
    .select('name fullName email department college departmentId collegeId verificationStatus verificationReviewedAt verificationNote rejectionReason updatedAt createdAt')
    .lean();

  return {
    context,
    department,
    college,
    departmentName,
    collegeName,
    departmentPattern,
    collegePattern,
    studentFilter,
    students,
    studentIds: students.map((student) => student._id).filter(Boolean)
  };
}

function getStudentDisplayName(student = {}) {
  return student?.fullName || student?.name || 'Student';
}

function getCompanyDisplayName(company = {}) {
  return company?.companyName || company?.fullName || company?.name || 'Company';
}

async function upsertNotificationSafely(payload) {
  try {
    return await Notification.upsertBySourceKey(payload);
  } catch (error) {
    console.error('Notification upsert failed:', error);
    return null;
  }
}

async function getDashboardStats(req, res) {
  try {
    const scope = await resolveHodScope(req);

    const internshipFilter = {
      status: { $in: ['Open', 'open'] },
      $or: [
        ...(scope.departmentPattern ? [{ targetDepartments: scope.departmentPattern }] : []),
        ...(scope.departmentName ? [{ targetDepartments: new RegExp(`^\\s*${escapeRegex(scope.departmentName)}\\s*$`, 'i') }] : [])
      ]
    };

    const companyIds = await Internship.distinct('companyId', internshipFilter);

    const totalStudents = scope.students.length;
    const totalApplications = scope.studentIds.length > 0
      ? await Application.countDocuments({ studentId: { $in: scope.studentIds } })
      : 0;

    const totalInternships = await Internship.countDocuments(internshipFilter);
    const totalIndustryPartners = companyIds.filter(Boolean).length;

    return res.json({
      department: {
        id: scope.department._id,
        name: scope.department.name
      },
      stats: {
        totalStudents: Number(totalStudents || 0),
        totalInternships: Number(totalInternships || 0),
        totalApplications: Number(totalApplications || 0),
        totalIndustryPartners: Number(totalIndustryPartners || 0)
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load HOD dashboard statistics.' });
  }
}

async function getPlacementStats(req, res) {
  try {
    const scope = await resolveHodScope(req);
    const placedStatuses = ['Placed', 'Accepted', 'PLACED'];

    const placedStudentIds = scope.studentIds.length > 0
      ? await Application.distinct('studentId', {
          studentId: { $in: scope.studentIds },
          status: { $in: placedStatuses }
        })
      : [];

    const placed = placedStudentIds.filter(Boolean).length;
    const totalStudents = scope.students.length;
    const unplaced = Math.max(totalStudents - placed, 0);

    return res.json({
      department: {
        id: scope.department._id,
        name: scope.department.name
      },
      stats: {
        placed,
        unplaced,
        totalStudents
      },
      chartData: [
        { name: 'Placed', value: placed },
        { name: 'Unplaced', value: unplaced }
      ]
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({ message: error?.message || 'Failed to load placement statistics.' });
  }
}

async function getRecentActivity(req, res) {
  try {
    const scope = await resolveHodScope(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 8, 5), 10);
    const studentIds = scope.studentIds;

    const [profileUpdates, applicationUpdates, evaluationUpdates] = await Promise.all([
      studentIds.length > 0
        ? Profile.find({ userId: { $in: studentIds } })
            .select('userId profileStrength updatedAt createdAt')
            .populate('userId', 'fullName name email')
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(limit)
            .lean()
        : [],
      studentIds.length > 0
        ? Application.find({
            studentId: { $in: studentIds },
            status: { $in: ['Placed', 'Accepted', 'PLACED'] }
          })
            .select('studentId internshipId status updatedAt createdAt')
            .populate('studentId', 'fullName name email')
            .populate({
              path: 'internshipId',
              select: 'title companyId',
              populate: { path: 'companyId', select: 'fullName name companyName' }
            })
            .sort({ updatedAt: -1, createdAt: -1 })
            .limit(limit)
            .lean()
        : [],
      studentIds.length > 0
        ? Evaluation.find({
            studentId: { $in: studentIds },
            $or: [
              { evaluationStatus: 'Submitted' },
              { evaluationStatus: 'Completed' },
              { is_submitted: true }
            ]
          })
            .select('studentId internshipId companyId evaluationStatus updatedAt createdAt dateEvaluated')
            .populate('studentId', 'fullName name email')
            .populate({
              path: 'internshipId',
              select: 'title companyId',
              populate: { path: 'companyId', select: 'fullName name companyName' }
            })
            .populate('companyId', 'fullName name companyName')
            .sort({ updatedAt: -1, createdAt: -1, dateEvaluated: -1 })
            .limit(limit)
            .lean()
        : []
    ]);

    const items = [];

    for (const profile of profileUpdates) {
      const student = profile?.userId || {};
      const studentName = getStudentDisplayName(student);
      items.push({
        id: `profile:${profile._id}`,
        type: 'profile-updated',
        title: `${studentName} updated their profile.`,
        details: profile?.profileStrength != null ? `Profile strength ${profile.profileStrength}%` : 'Profile information changed.',
        timestamp: profile.updatedAt || profile.createdAt || new Date(),
        studentName
      });
    }

    for (const student of scope.students) {
      if (!student?.verificationReviewedAt) continue;
      const status = String(student.verificationStatus || '').trim();
      const studentName = getStudentDisplayName(student);
      items.push({
        id: `verification:${student._id}`,
        type: 'student-verification',
        title: status === 'Verified'
          ? `HOD verified ${studentName}.`
          : status === 'Rejected'
            ? `HOD rejected ${studentName}'s profile.`
            : `${studentName}'s verification status changed.`,
        details: student.verificationNote || student.rejectionReason || 'Verification reviewed.',
        timestamp: student.verificationReviewedAt || student.updatedAt || student.createdAt || new Date(),
        studentName
      });
    }

    for (const application of applicationUpdates) {
      const student = application?.studentId || {};
      const internship = application?.internshipId || {};
      const company = internship?.companyId || {};
      const studentName = getStudentDisplayName(student);
      const companyName = getCompanyDisplayName(company);
      const internshipTitle = String(internship?.title || 'an internship').trim();

      items.push({
        id: `application:${application._id}`,
        type: 'application-placed',
        title: `${companyName} accepted ${studentName}.`,
        details: internshipTitle,
        timestamp: application.updatedAt || application.createdAt || new Date(),
        studentName,
        companyName,
        internshipTitle
      });
    }

    for (const evaluation of evaluationUpdates) {
      const student = evaluation?.studentId || {};
      const internship = evaluation?.internshipId || {};
      const company = evaluation?.companyId || internship?.companyId || {};
      const studentName = getStudentDisplayName(student);
      const companyName = getCompanyDisplayName(company) || String(evaluation?.acceptanceForm?.companyName || '').trim() || 'Company';
      const internshipTitle = String(internship?.title || 'an internship').trim();

      items.push({
        id: `evaluation:${evaluation._id}`,
        type: 'evaluation-submitted',
        title: `New evaluation submitted by ${companyName}.`,
        details: `${studentName}${internshipTitle ? ` • ${internshipTitle}` : ''}`,
        timestamp: evaluation.updatedAt || evaluation.dateEvaluated || evaluation.createdAt || new Date(),
        studentName,
        companyName,
        internshipTitle
      });
    }

    items.sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp));

    return res.json({
      department: {
        id: scope.department._id,
        name: scope.department.name
      },
      items: items.slice(0, limit)
    });
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({ message: error?.message || 'Failed to load recent activity.' });
  }
}

router.get('/verification-requests', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  try {
    const context = await getDepartmentContext(req);
    if (!context?.department) {
      return res.status(403).json({ message: 'Your HOD account is not linked to a department.' });
    }

    // Build a robust match that prefers exact `departmentId` equality but
    // falls back to a trimmed, case-insensitive department name match for
    // records that don't have departmentId populated.
    const deptNameTrimmed = String(context.department.name || '').trim();
    // Use un-anchored regex for partial matching (e.g., 'Computer' matches 'Computer Science')
    const departmentNamePattern = deptNameTrimmed ? new RegExp(escapeRegex(deptNameTrimmed), 'i') : null;

    const students = await User.find({
      role: { $in: ['student', 'Student'] },
      $or: [
        { departmentId: context.department._id },
        ...(departmentNamePattern ? [{ department: departmentNamePattern }] : [])
      ]
    })
      .select('name fullName email college department collegeId departmentId isVerified verificationStatus verificationRequestedAt verificationReviewedAt verificationNote rejectionReason createdAt')
      .sort({ verificationRequestedAt: -1, createdAt: -1 })
      .lean();

    // Server-side safety: filter again using trimmed, case-insensitive comparison
    // to ensure we only return students that belong to this HOD's department.
    return res.json({
      department: {
        id: context.department._id,
        name: context.department.name
      },
      items: students.filter((student) => {
        const deptIdMatch = String(student.departmentId || '') === String(context.department._id || '');
        if (deptIdMatch) return true;

        const studentDeptName = normalizeString(student.department);
        const hodDeptName = normalizeString(context.department?.name || '');
        if (!studentDeptName || !hodDeptName) return false;

        // Allow partial matches either direction (e.g., "computer" <-> "computer science")
        if (studentDeptName.includes(hodDeptName) || hodDeptName.includes(studentDeptName)) return true;

        // Fallback to regex test if available
        return departmentNamePattern ? departmentNamePattern.test(String(student.department || '').trim()) : false;
      })
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load verification requests.' });
  }
});

router.put('/verification-requests/:studentId', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  try {
    const status = String(req.body?.status || '').trim();
    const note = String(req.body?.note || '').trim();
    const action = status === 'Verified' ? 'verify' : status === 'Rejected' ? 'reject' : status.toLowerCase();

    const result = await updateStudentVerificationStatus(req, {
      studentId: req.params.studentId,
      action,
      reason: note
    });

    return res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      message: error?.message || 'Failed to update student verification.'
    });
  }
});

router.get('/dashboard-stats', auth, universityRoleMiddleware(['hod']), getDashboardStats);
router.get('/stats', auth, universityRoleMiddleware(['hod']), getDashboardStats);
router.get('/placement-stats', auth, universityRoleMiddleware(['hod']), getPlacementStats);
router.get('/recent-activity', auth, universityRoleMiddleware(['hod']), getRecentActivity);

// PATCH /reset-assignment/:studentId - undo assignment for a placed student
router.patch('/reset-assignment/:studentId', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  try {
    const studentId = req.params.studentId;
    if (!studentId) return res.status(400).json({ message: 'Student id is required.' });

    const placedStatuses = ['Placed', 'Accepted', 'PLACED'];
    const apps = await Application.find({ studentId, status: { $in: placedStatuses } });

    const updatedCompanies = new Set();
    for (const app of apps) {
      const oldCompany = app.companyId;
      app.status = 'Pending';
      app.companyId = null;
      app.hod_assignment_note = '';
      app.hod_note = '';
      app.is_manual_assignment = false;
      app.placement_source = 'STUDENT_APPLIED';
      app.timeline = app.timeline || [];
      app.timeline.push({ status: 'RESET', date: new Date(), comment: 'Assignment reset by HOD' });
      await app.save();
      if (oldCompany) updatedCompanies.add(String(oldCompany));
    }

    const student = await User.findById(studentId);
    if (student) {
      try {
        student.internshipStatus = 'Verified';
        student.status = 'VERIFIED';
        student.verificationStatus = 'Verified';
        student.isVerified = true;
        await student.save();
      } catch (e) {
        // ignore non-critical save failures
      }
    }

    try {
      const io = req.app.get('io');
      if (io && student) {
        io.to(`user:${student._id}`).emit('application:reset', { studentId: String(student._id) });
      }
    } catch (e) {
      // ignore socket errors
    }

    // create and emit notification to student
    try {
      const note = await upsertNotificationSafely({
        userId: studentId,
        receiverRole: 'student',
        senderId: req.user?.id,
        senderRole: 'hod',
        type: 'info',
        title: 'Assignment Reset',
        message: 'Your placement has been undone by the HOD. You may reapply or await a new placement.',
        targetRoute: '/student/internships',
        sourceKey: `assignment-reset:${studentId}`
      });
      try {
        const io = req.app.get('io');
        if (io && note?.userId) io.to(`user:${String(note.userId)}`).emit('notification:new', note.toObject());
      } catch (e) {
        // ignore socket errors
      }
    } catch (e) {
      // ignore notification creation errors
    }

    return res.json({ message: 'Assignment(s) reset successfully.', item: { _id: studentId, internshipStatus: 'Verified', status: 'VERIFIED' } });
  } catch (err) {
    console.error('Reset assignment error:', err);
    return res.status(500).json({ message: 'Failed to reset assignment.' });
  }
});

router.get('/partners/filtered', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  try {
    const scope = await resolveHodScope(req);
    
    // 1. Find Open Internships that match the HOD's department
    const internshipFilter = {
      status: { $in: ['Open', 'open', 'Approved'] },
      $or: [
        ...(scope.departmentPattern ? [{ targetDepartments: scope.departmentPattern }] : []),
        ...(scope.departmentName ? [{ targetDepartments: new RegExp(`^\\s*${escapeRegex(scope.departmentName)}\\s*$`, 'i') }] : [])
      ]
    };

    // 2. Fetch internships and populate company details (including verification status)
    const internships = await Internship.find(internshipFilter)
      .populate({
        path: 'companyId',
        select: 'fullName name companyName isVerified verificationStatus'
      })
      .lean();

    const companyIds = internships
      .map((internship) => internship?.companyId?._id)
      .filter(Boolean);

    const companyProfiles = companyIds.length > 0
      ? await CompanyProfile.find({ user: { $in: companyIds } })
          .select('user companyName logo logoUrl verification isActive')
          .lean()
      : [];

    const companyProfileByUserId = new Map(
      companyProfiles.map((profile) => [String(profile.user), profile])
    );

    const placementCounts = internships.length > 0
      ? await Application.aggregate([
          {
            $match: {
              internshipId: { $in: internships.map((internship) => internship._id) },
              status: { $in: ['Placed', 'PLACED', 'Accepted', 'Confirmed'] }
            }
          },
          {
            $group: {
              _id: '$internshipId',
              count: { $sum: 1 }
            }
          }
        ])
      : [];

    const placementCountByInternshipId = new Map(
      placementCounts.map((entry) => [String(entry._id), Number(entry.count || 0)])
    );
    
    // 3. Filter results to ensure companies are verified and have slots
    const results = [];

    for (const internship of internships) {
      const company = internship.companyId;
      if (!company) continue;

      const companyProfile = companyProfileByUserId.get(String(company._id));

      // Strict Verification Check (Approved by Super Admin)
      const isVerified = Boolean(companyProfile?.verification?.status === 'Verified')
        || Boolean(company.isVerified)
        || String(company.verificationStatus || '').toLowerCase() === 'verified';
      if (!isVerified) continue;

      // Slot Check
      const totalNeeded = Number(internship.studentsNeeded || internship.slots || 1);
      const placed = Number(placementCountByInternshipId.get(String(internship._id)) || 0);
      const slotsLeft = Math.max(totalNeeded - placed, 0);

      if (slotsLeft > 0) {
        const companyName = companyProfile?.companyName || company.companyName || company.fullName || company.name || 'Verified Partner';
        const companyLogo = companyProfile?.logoUrl || companyProfile?.logo || company.logoUrl || company.logo || '';

        results.push({
          id: internship._id,
          internshipId: internship._id,
          title: internship.title,
          companyId: company._id,
          companyName,
          companyLogo,
          companyLogoUrl: companyLogo,
          internshipTitle: internship.title,
          slotsLeft,
          location: internship.location || 'Remote',
          type: internship.workModality || internship.type || 'On-site',
          programType: internship.programType || 'Internship Program'
        });
      }
    }
    
    return res.json({ items: results });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to load filtered partners.' });
  }
});

router.get('/available-partners', auth, universityRoleMiddleware(['hod']), async (req, res) => {
    // Alias to keep existing code working
    res.redirect(307, '/api/hod/partners/filtered');
});
router.post('/manual-assignment', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { studentIds, studentId, companyId, internshipId, hodNote } = req.body;
    const assignedStudentIds = Array.isArray(studentIds)
      ? studentIds.map((id) => String(id).trim()).filter(Boolean)
      : String(studentId || '').trim()
        ? [String(studentId).trim()]
        : [];

    if (assignedStudentIds.length === 0 || !companyId || !internshipId) {
      return res.status(400).json({ message: 'Missing required studentIds, companyId, or internshipId' });
    }

    const internship = await Internship.findById(internshipId).session(session).populate('companyId');
    const company = await User.findById(companyId).session(session);
    if (!internship || !company) return res.status(404).json({ message: 'Company or Internship not found' });
    if (!company.isVerified) return res.status(400).json({ message: 'Company is not a Verified Industry Partner.' });

    const hodUser = await User.findById(req.user.id);
    const hodName = hodUser?.fullName || hodUser?.name || 'HOD';
    const noteContent = String(hodNote || '').trim() || 'Facilitated by University agreement';

    const Application = require('../models/Application');
    const Evaluation = require('../models/Evaluation');
    const Notification = require('../models/Notification');
    const regularStudentNames = [];
    const universityRecommendationStudentNames = [];
    const updatedStudents = [];

    if (!Number.isInteger(Number(internship.studentsNeeded)) || Number(internship.studentsNeeded) < 1) {
      return res.status(400).json({ message: 'No more slots available' });
    }

    if (Number(internship.studentsNeeded) < assignedStudentIds.length) {
      return res.status(400).json({ message: 'No more slots available' });
    }

    await session.withTransaction(async () => {
      const freshInternship = await Internship.findById(internshipId).session(session);
      if (!freshInternship || Number(freshInternship.studentsNeeded || 0) < assignedStudentIds.length) {
        const error = new Error('No more slots available');
        error.statusCode = 400;
        throw error;
      }

      for (const sId of assignedStudentIds) {
        const student = await User.findById(sId).session(session);
        if (!student) continue;

        let application = await Application.findOne({ studentId: sId, internshipId }).session(session);
        const wasRejectedBySameCompany = Boolean(application)
          && String(application.status || '').trim().toLowerCase() === 'rejected'
          && String(application.companyId || '') === String(companyId);

        if (wasRejectedBySameCompany) {
          universityRecommendationStudentNames.push(student.fullName || student.name);
        } else {
          regularStudentNames.push(student.fullName || student.name);
        }

        const assignmentStatus = wasRejectedBySameCompany ? 'HOD_ASSIGNED' : 'PLACED';

        // Calculate match score at the time of assignment so employer/HOD see same value
        let calculatedScore = 0;
        try {
          const matchResult = await getCalculatedMatch(sId, internshipId);
          calculatedScore = (matchResult && Number(matchResult.score)) ? Number(matchResult.score) : 0;
        } catch (calcErr) {
          console.error('Match calculation failed during assignment for student', sId, calcErr);
        }

        if (!application) {
          application = new Application({
            studentId: sId,
            internshipId,
            companyId,
            status: assignmentStatus,
            assignedBy: hodName,
            is_manual_assignment: true,
            source: 'hod',
            placement_source: 'HOD_ASSIGNED',
            hod_note: noteContent,
            hod_assignment_note: noteContent,
            rejectionVisibleTo: wasRejectedBySameCompany ? 'HOD' : 'STUDENT',
            placed_at: new Date(),
            matchingScore: calculatedScore,
            match_score: calculatedScore
          });
        } else {
          application.status = assignmentStatus;
          application.companyId = companyId;
          application.assignedBy = hodName;
          application.is_manual_assignment = true;
          application.source = 'hod';
          application.placement_source = 'HOD_ASSIGNED';
          application.hod_note = noteContent;
          application.hod_assignment_note = noteContent;
          application.rejectionVisibleTo = wasRejectedBySameCompany ? 'HOD' : 'STUDENT';
          application.placed_at = new Date();
          application.matchingScore = calculatedScore;
          application.match_score = calculatedScore;
        }
        application.timeline = application.timeline || [];
        application.timeline.push({
          status: assignmentStatus,
          date: new Date(),
          comment: noteContent
        });
        await application.save({ session });

        student.internshipStatus = assignmentStatus;
        student.status = assignmentStatus;
        await student.save({ session });
        updatedStudents.push({
          _id: student._id,
          fullName: student.fullName || student.name,
          name: student.name,
          email: student.email,
          internshipStatus: assignmentStatus,
          status: assignmentStatus,
          assignedCompanyId: companyId,
          companyId
        });

        const existingEvaluation = await Evaluation.findOne({ studentId: sId, internshipId }).session(session);
        if (!existingEvaluation) {
          await Evaluation.create({
            studentId: sId,
            internshipId: internshipId,
            companyId: companyId,
            evaluationStatus: 'Pending',
            evaluationType: 'Placement',
            dateEvaluated: new Date()
          }, { session });
        }

        const io = req.app.get('io');
        try {
          if (io) {
            io.to(`user:${student._id}`).emit('application:updated', { id: application._id, status: assignmentStatus });
          }
        } catch (socketError) {
          console.error('Socket notification failed during manual assignment:', socketError);
        }

        const companyName = company.companyName || company.fullName || company.name;
        try {
          const notifyMessage = wasRejectedBySameCompany
            ? `Official Placement Request: HOD ${hodName} has formally assigned ${student.fullName || student.name} to your company. Note: This student was previously rejected, but the University highly recommends them for this position. Reason: ${noteContent}.`
            : `Your HOD has assigned you to ${companyName}. Reason: ${noteContent}. You can now start your internship and log your daily activities.`;

          await upsertNotificationSafely({
            userId: student._id,
            receiverRole: 'student',
            senderId: req.user.id,
            senderRole: 'hod',
            type: wasRejectedBySameCompany ? 'urgent' : 'Assignment',
            title: wasRejectedBySameCompany ? 'University Recommendation' : 'Internship Assigned',
            message: wasRejectedBySameCompany
              ? `You have been assigned by the HOD to ${companyName}. The university strongly recommends you for this position.`
              : `Your HOD has assigned you to ${companyName}. Reason: ${noteContent}. You can now start your internship and log your daily activities.`,
            metadata: { hod_assignment_note: noteContent, university_recommendation: wasRejectedBySameCompany },
            sourceKey: `manual-assignment:${student._id}:${internshipId}`
          });

          if (wasRejectedBySameCompany) {
            await upsertNotificationSafely({
              userId: company._id,
              receiverRole: 'employer',
              senderId: req.user.id,
              senderRole: 'hod',
              type: 'urgent',
              title: 'Official Placement Request',
              message: notifyMessage,
              metadata: {
                studentId: String(student._id),
                internshipId: String(internshipId),
                hodName,
                studentName: student.fullName || student.name,
                reason: noteContent,
                university_recommendation: true
              },
              sourceKey: `manual-assignment:${company._id}:${internshipId}:${student._id}`
            });
          }
        } catch (notifyError) {
          console.error('Student notification failed during manual assignment:', notifyError);
        }
      }

      freshInternship.studentsNeeded = Math.max(Number(freshInternship.studentsNeeded || 0) - assignedStudentIds.length, 0);
      await freshInternship.save({ session });
    });

    if (regularStudentNames.length > 0) {
      const namesStr = regularStudentNames.join(', ');
      try {
        await upsertNotificationSafely({
          userId: company._id,
          receiverRole: 'employer',
          senderId: req.user.id,
          senderRole: 'hod',
          type: 'Assignment',
          title: 'New Assignment',
          message: `HOD ${hodName} has assigned ${namesStr} to your organization. Reason: ${noteContent}.`,
          metadata: { hod_assignment_note: noteContent },
          sourceKey: `manual-assignment:${company._id}:${internshipId}`
        });
      } catch (notifyError) {
        console.error('Employer notification failed during manual assignment:', notifyError);
      }
    } else if (universityRecommendationStudentNames.length > 0) {
      // The urgent per-student notification already covered the recommendation flow.
    }

    return res.status(200).json({
      success: true,
      message: 'Assignment successful',
      item: {
        internshipId,
        companyId,
        studentIds: updatedStudents.map((student) => String(student._id)),
        assignedCount: updatedStudents.length
      },
      items: updatedStudents
    });
  } catch (error) {
      const message = String(error?.message || '').includes('No more slots available')
        ? 'No more slots available'
        : 'Assignment failed';
      return res.status(String(message) === 'No more slots available' ? 400 : 500).json({ message });
    } finally {
      await session.endSession();
  }
});

module.exports = router;
