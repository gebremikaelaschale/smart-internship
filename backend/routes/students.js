const express = require('express');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const { updateStudentVerificationStatus } = require('../utils/studentVerification');

const router = express.Router();

router.patch('/:id/status', auth, universityRoleMiddleware(['hod']), async (req, res) => {
  try {
    const action = req.body?.action || req.body?.status;
    const reason = req.body?.reason || req.body?.note || req.body?.rejection_reason || req.body?.rejectionReason || '';

    const result = await updateStudentVerificationStatus(req, {
      studentId: req.params.id,
      action,
      reason
    });

    return res.json(result);
  } catch (error) {
    const statusCode = Number(error?.statusCode) || 500;
    return res.status(statusCode).json({
      message: error?.message || 'Failed to update student verification status.'
    });
  }
});

module.exports = router;
