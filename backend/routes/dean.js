const express = require('express');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const { createDepartmentAndHod } = require('../controllers/governanceController');

const router = express.Router();

router.post('/create-department-and-hod', auth, universityRoleMiddleware(['dean']), createDepartmentAndHod);

module.exports = router;
