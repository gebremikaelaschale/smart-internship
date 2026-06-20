const User = require('../models/User');
const Notification = require('../models/Notification');
const { getDepartmentContext } = require('./hodContext');
const { emitHodDashboardRefresh } = require('./hodDashboardSync');

function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeVerificationAction(rawAction) {
  const value = String(rawAction || '').trim().toLowerCase();
  const map = {
    verify: 'Verified',
    verified: 'Verified',
    reject: 'Rejected',
    rejected: 'Rejected',
    reset: 'Pending',
    pending: 'Pending'
  };
  return map[value] || '';
}

function emitVerificationUpdate(req, student) {
  const io = req.app.get('io');
  if (!io || !student?._id) return;

  const payload = {
    studentId: String(student._id),
    verificationStatus: student.verificationStatus,
    status: student.verificationStatus,
    verification_status: student.verificationStatus,
    isVerified: Boolean(student.isVerified),
    verificationNote: student.verificationNote || '',
    rejectionReason: student.rejectionReason || '',
    rejection_reason: student.rejectionReason || '',
    verificationReviewedAt: student.verificationReviewedAt || null
  };

  io.to(`user:${student._id}`).emit('student:verification-updated', payload);
}

function emitNotification(req, notification) {
  const io = req.app.get('io');
  if (io && notification?.userId) {
    io.to(`user:${notification.userId}`).emit('notification:new', notification);
  }
}

function buildStudentVerificationSourceKey(studentId, status) {
  return `student-verification:${studentId}:${String(status || '').toLowerCase()}`;
}

async function upsertNotificationSafely(payload) {
  try {
    return await Notification.upsertBySourceKey(payload);
  } catch (error) {
    console.error('Notification upsert failed:', error);
    return null;
  }
}

async function findScopedStudent(req, studentId) {
  const context = await getDepartmentContext(req);
  if (!context?.department) {
    const error = new Error('Your HOD account is not linked to a department.');
    error.statusCode = 403;
    throw error;
  }

  const deptNameTrimmed = String(context.department.name || '').trim();
  const deptNamePattern = deptNameTrimmed ? new RegExp(escapeRegex(deptNameTrimmed), 'i') : null;

  let student = await User.findOne({
    _id: studentId,
    role: { $in: ['student', 'Student'] },
    $or: [
      { departmentId: context.department._id },
      ...(deptNamePattern ? [{ department: deptNamePattern }] : [])
    ]
  });

  if (!student) {
    student = await User.findById(studentId);
  }

  if (!student || !['student', 'Student'].includes(String(student.role || '').trim())) {
    const error = new Error('Student verification request not found.');
    error.statusCode = 404;
    throw error;
  }

  return { student, context };
}

async function updateStudentVerificationStatus(req, { studentId, action, reason = '' }) {
  const status = normalizeVerificationAction(action);
  const note = String(reason || '').trim();

  if (!status) {
    const error = new Error('action must be verify, reject, or reset.');
    error.statusCode = 400;
    throw error;
  }

  if (status === 'Rejected' && !note) {
    const error = new Error('A reason is required when rejecting a profile.');
    error.statusCode = 400;
    throw error;
  }

  const { student } = await findScopedStudent(req, studentId);

  if (status === 'Pending') {
    student.isVerified = false;
    student.verificationStatus = 'Pending';
    student.verificationRequestedAt = new Date();
    student.verificationReviewedAt = null;
    student.verificationReviewedBy = null;
    student.verificationNote = '';
    student.rejectionReason = '';
    student.rejection_reason = '';
  } else if (status === 'Verified') {
    student.isVerified = true;
    student.verificationStatus = 'Verified';
    student.verificationReviewedAt = new Date();
    student.verificationReviewedBy = req.user?.id || null;
    student.verificationNote = note || '';
    student.rejectionReason = '';
    student.rejection_reason = '';
    student.verificationRequestedAt = student.verificationRequestedAt || new Date();
  } else if (status === 'Rejected') {
    student.isVerified = false;
    student.verificationStatus = 'Rejected';
    student.verificationReviewedAt = new Date();
    student.verificationReviewedBy = req.user?.id || null;
    student.verificationNote = note;
    student.rejectionReason = note;
    student.rejection_reason = note;
  }

  await student.save();

  const statusUpdateMessage = 'Your verification status has been updated. Please check your profile for any required changes.';

  let notification = null;
  if (status === 'Verified') {
    notification = await upsertNotificationSafely({
      userId: student._id,
      receiverRole: 'student',
      senderId: req.user?.id || null,
      senderRole: 'hod',
      title: 'Profile Verified',
      message: 'Your profile has been approved by your HOD. You can now browse and apply for internships.',
      type: 'success',
      targetRoute: '/student/internships',
      category: 'general',
      sourceKey: buildStudentVerificationSourceKey(student._id, status),
      metadata: {
        kind: 'student-verification',
        verificationStatus: status,
        rejectionReason: '',
        reviewedAt: student.verificationReviewedAt,
        reviewedBy: req.user?.id || null
      }
    });
  } else if (status === 'Rejected') {
    notification = await upsertNotificationSafely({
      userId: student._id,
      receiverRole: 'student',
      senderId: req.user?.id || null,
      senderRole: 'hod',
      title: 'Action Required: Verification Rejected',
      message: `Your profile was rejected by your HOD for the following reason: ${note}. Please update your profile and resubmit.`,
      type: 'warning',
      targetRoute: '/student/profile',
      category: 'general',
      sourceKey: buildStudentVerificationSourceKey(student._id, status),
      metadata: {
        kind: 'student-verification',
        verificationStatus: status,
        rejectionReason: note,
        reviewedAt: student.verificationReviewedAt,
        reviewedBy: req.user?.id || null
      }
    });
  } else {
    notification = await upsertNotificationSafely({
      userId: student._id,
      receiverRole: 'student',
      senderId: req.user?.id || null,
      senderRole: 'hod',
      title: 'Verification update',
      message: statusUpdateMessage,
      type: 'info',
      targetRoute: '/student/profile',
      category: 'general',
      sourceKey: buildStudentVerificationSourceKey(student._id, status),
      metadata: {
        kind: 'student-verification',
        verificationStatus: status,
        rejectionReason: '',
        reviewedAt: null,
        reviewedBy: req.user?.id || null
      }
    });
  }

  emitNotification(req, notification?.toObject ? notification.toObject() : notification);

  emitVerificationUpdate(req, student);
  emitHodDashboardRefresh(req, { reason: 'student-verification-updated', studentId: String(student._id) });

  return {
    message: status === 'Pending'
      ? 'Student verification reset to pending.'
      : `Student verification ${status.toLowerCase()} successfully.`,
    item: {
      _id: student._id,
      fullName: student.fullName || student.name,
      email: student.email,
      verificationStatus: student.verificationStatus,
      status: student.verificationStatus,
      verification_status: student.verificationStatus,
      isVerified: student.isVerified,
      verificationNote: student.verificationNote,
      rejectionReason: student.rejectionReason,
      rejection_reason: student.rejectionReason,
      verificationReviewedAt: student.verificationReviewedAt
    }
  };
}

module.exports = {
  normalizeVerificationAction,
  updateStudentVerificationStatus
};
