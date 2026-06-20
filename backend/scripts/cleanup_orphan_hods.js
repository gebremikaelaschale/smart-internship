const mongoose = require('mongoose');
const User = require('../models/User');
const Department = require('../models/Department');

async function main() {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
  if (!mongoUri) {
    throw new Error('Missing MONGODB_URI, MONGO_URI, or DB_URI.');
  }

  await mongoose.connect(mongoUri);

  const hodUsers = await User.find({ role: 'hod' }).select('_id email department departmentId college collegeId').lean();
  const departmentIds = hodUsers.map((user) => user.departmentId).filter(Boolean);
  const departments = await Department.find({ _id: { $in: departmentIds } }).select('_id').lean();
  const existingDepartmentIds = new Set(departments.map((department) => String(department._id)));

  const orphanUsers = hodUsers.filter((user) => {
    if (!user.departmentId) return true;
    return !existingDepartmentIds.has(String(user.departmentId));
  });

  let removed = 0;
  for (const user of orphanUsers) {
    const result = await User.deleteOne({ _id: user._id });
    removed += result.deletedCount || 0;
    console.log(`Removed orphan HOD: ${user.email || user._id}`);
  }

  console.log(`Done. Removed ${removed} orphan HOD account(s).`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
