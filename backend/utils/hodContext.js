const User = require('../models/User');
const Department = require('../models/Department');

async function getDepartmentContext(req) {
  const actor = await User.findById(req.user?.id)
    .select('_id role adminType departmentId')
    .lean();

  if (!actor) return null;

  const departmentId = req.user?.departmentId || actor.departmentId;
  if (!departmentId) return null;

  const department = await Department.findById(departmentId)
    .select('_id name collegeId head headId')
    .lean();

  return { actor, department };
}

module.exports = { getDepartmentContext };
