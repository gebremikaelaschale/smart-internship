const express = require('express');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const { createCollegeWithDean } = require('../controllers/governanceController');

const router = express.Router();

router.post('/create-college-with-dean', auth, universityRoleMiddleware(['super_admin']), createCollegeWithDean);

module.exports = router;
