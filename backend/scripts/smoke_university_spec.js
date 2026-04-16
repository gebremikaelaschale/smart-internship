/* eslint-disable no-console */
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');

const base = process.env.SMOKE_BASE_URL || 'http://localhost:5000';
const superEmail = process.env.SMOKE_SUPERADMIN_EMAIL || 'admin@uog.edu';
const superPassword = process.env.SMOKE_SUPERADMIN_PASSWORD || 'AdminPassword123!';

async function post(url, body, token) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`POST ${url} failed (${response.status}): ${JSON.stringify(data)}`);
  }

  return data;
}

async function main() {
  const uniq = Date.now();
  const deanEmail = `dean.spec.${uniq}@uog.edu.et`;
  const hodEmail = `hod.spec.${uniq}@uog.edu.et`;
  const deanPassword = 'DeanTest123!';
  const hodPassword = 'HodTest123!';

  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/smart_internship_program');

  const login = await post(`${base}/auth/login`, {
    email: superEmail,
    password: superPassword
  });

  const collegeResp = await post(`${base}/api/admin/create-college-with-dean`, {
    collegeName: `Spec College ${uniq}`,
    deanName: `Spec Dean ${uniq}`,
    deanEmail
  }, login.token);

  const dean = await User.findOne({ email: deanEmail });
  if (!dean) {
    throw new Error('Dean user was not created.');
  }

  await User.findByIdAndUpdate(dean._id, { password: await bcrypt.hash(deanPassword, 12) });
  const deanLogin = await post(`${base}/auth/login`, {
    email: deanEmail,
    password: deanPassword
  });

  const deptResp = await post(`${base}/api/dean/create-department-and-hod`, {
    departmentName: `Spec Department ${uniq}`,
    hodName: `Spec HOD ${uniq}`,
    hodEmail
  }, deanLogin.token);

  const hod = await User.findOne({ email: hodEmail });
  if (!hod) {
    throw new Error('HOD user was not created.');
  }

  await User.findByIdAndUpdate(hod._id, { password: await bcrypt.hash(hodPassword, 12) });
  const hodLogin = await post(`${base}/auth/login`, {
    email: hodEmail,
    password: hodPassword
  });

  const updatedCollege = await College.findById(collegeResp.college._id).lean();
  const createdDepartment = await Department.findById(deptResp.department._id).lean();

  console.log(JSON.stringify({
    college: {
      id: String(collegeResp.college._id),
      name: collegeResp.college.name,
      deanId: String(updatedCollege?.dean || updatedCollege?.deanId || '')
    },
    dean: {
      role: deanLogin.role,
      collegeId: deanLogin.collegeId || deanLogin.user?.collegeId || null
    },
    department: {
      id: String(deptResp.department._id),
      name: createdDepartment?.name,
      headId: String(createdDepartment?.head || createdDepartment?.headId || '')
    },
    hod: {
      role: hodLogin.role,
      departmentId: hodLogin.departmentId || hodLogin.user?.departmentId || null
    },
    emailSent: {
      dean: Boolean(collegeResp.emailSent),
      hod: Boolean(deptResp.emailSent)
    }
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
