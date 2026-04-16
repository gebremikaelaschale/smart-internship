const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');
const { resolveUniversityRole } = require('../utils/universityRoles');

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;
const FRONTEND_LOGIN_URL = process.env.FRONTEND_LOGIN_URL || process.env.FRONTEND_URL || 'http://localhost:5173/login';

const mailTransporter = EMAIL_USER && EMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    })
  : null;

function generateTemporaryPassword(length = 12) {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += charset[bytes[index] % charset.length];
  }

  return password;
}

async function sendCredentialsEmail({ to, name, role, password }) {
  if (!mailTransporter) {
    return { sent: false, error: 'Email service is not configured.' };
  }

  try {
    await mailTransporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject: 'University Internship Management System login credentials',
      html: `
        <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:24px;color:#0f172a;">
          <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
            <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.2em;text-transform:uppercase;color:#2563eb;font-weight:700;">University Internship Management System</p>
            <h1 style="margin:0 0 16px;font-size:28px;color:#0f172a;">Your ${role} account is ready</h1>
            <p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#475569;">Hello ${name || 'there'},</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#475569;">Use the credentials below to sign in. Change your password after the first login.</p>
            <div style="background:#08143a;color:#fff;border-radius:16px;padding:18px 20px;">
              <p style="margin:0 0 8px;font-size:14px;opacity:0.9;">Email</p>
              <p style="margin:0 0 16px;font-size:18px;font-weight:700;">${to}</p>
              <p style="margin:0 0 8px;font-size:14px;opacity:0.9;">Temporary password</p>
              <p style="margin:0;font-size:20px;letter-spacing:0.15em;font-weight:700;">${password}</p>
            </div>
            <p style="margin:16px 0 0;font-size:14px;color:#64748b;">Login URL: ${FRONTEND_LOGIN_URL}</p>
          </div>
        </div>
      `
    });

    return { sent: true, error: null };
  } catch (error) {
    return { sent: false, error: String(error?.message || 'Unable to send email.') };
  }
}

function buildLoginUserPayload(user) {
  const role = resolveUniversityRole(user);
  return {
    id: user._id,
    name: user.name || user.fullName,
    fullName: user.fullName || user.name,
    email: user.email,
    role,
    collegeId: user.collegeId || null,
    departmentId: user.departmentId || null,
    createdAt: user.createdAt,
    isFirstLogin: user.isFirstLogin,
    adminType: role === 'super_admin' ? 'superadmin' : role === 'dean' ? 'collegeadmin' : role === 'hod' ? 'deptadmin' : null
  };
}

async function createCollegeWithDean(req, res) {
  try {
    const collegeName = String(req.body?.collegeName || req.body?.name || '').trim();
    const deanName = String(req.body?.deanName || req.body?.dean?.name || '').trim();
    const deanEmail = String(req.body?.deanEmail || req.body?.dean?.email || '').toLowerCase().trim();

    if (!collegeName || !deanName || !deanEmail) {
      return res.status(400).json({ message: 'collegeName, deanName, and deanEmail are required.' });
    }

    if (resolveUniversityRole(req.user) !== 'super_admin') {
      return res.status(403).json({ message: 'Only super_admin can create colleges and deans.' });
    }

    const existingCollege = await College.findOne({ name: collegeName }).lean();
    if (existingCollege) {
      return res.status(409).json({ message: 'A college with this name already exists.' });
    }

    const existingDean = await User.findOne({ email: deanEmail }).lean();
    if (existingDean) {
      return res.status(409).json({ message: 'An account with this dean email already exists.' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const deanUser = await User.create({
      name: deanName,
      fullName: deanName,
      email: deanEmail,
      password: hashedPassword,
      role: 'dean',
      college: collegeName,
      collegeId: null,
      departmentId: null,
      isFirstLogin: true
    });

    const college = await College.create({
      name: collegeName,
      dean: deanUser._id,
      deanId: deanUser._id
    });

    await User.findByIdAndUpdate(deanUser._id, {
      $set: {
        college: collegeName,
        collegeId: college._id,
        department: '',
        departmentId: null
      }
    });

    const emailStatus = await sendCredentialsEmail({
      to: deanUser.email,
      name: deanUser.name,
      role: 'dean',
      password: temporaryPassword
    });

    return res.status(201).json({
      message: 'College and dean created successfully.',
      college: {
        _id: college._id,
        name: college.name,
        deanId: deanUser._id,
        dean: deanUser._id
      },
      dean: buildLoginUserPayload({
        ...deanUser.toObject(),
        collegeId: college._id
      }),
      emailSent: emailStatus.sent,
      emailError: emailStatus.error
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create college and dean.' });
  }
}

async function createDepartmentAndHod(req, res) {
  try {
    const departmentName = String(req.body?.departmentName || req.body?.name || '').trim();
    const hodName = String(req.body?.hodName || req.body?.head?.name || '').trim();
    const hodEmail = String(req.body?.hodEmail || req.body?.head?.email || '').toLowerCase().trim();

    if (!departmentName || !hodName || !hodEmail) {
      return res.status(400).json({ message: 'departmentName, hodName, and hodEmail are required.' });
    }

    if (resolveUniversityRole(req.user) !== 'dean') {
      return res.status(403).json({ message: 'Only dean can create departments and HODs.' });
    }

    const deanUser = await User.findById(req.user.id).select('collegeId college department').lean();
    if (!deanUser?.collegeId) {
      return res.status(400).json({ message: 'Dean is not linked to a college.' });
    }

    const college = await College.findById(deanUser.collegeId).lean();
    if (!college) {
      return res.status(404).json({ message: 'College not found for this dean.' });
    }

    const normalizedDepartmentName = departmentName.toLowerCase();
    const departmentExists = await Department.findOne({
      collegeId: college._id,
      name: { $regex: `^${departmentName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    }).lean();
    if (departmentExists) {
      return res.status(409).json({ message: 'A department with this name already exists in the college.' });
    }

    const existingHod = await User.findOne({ email: hodEmail }).lean();
    if (existingHod) {
      return res.status(409).json({ message: 'An account with this HOD email already exists.' });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12);

    const hodUser = await User.create({
      name: hodName,
      fullName: hodName,
      email: hodEmail,
      password: hashedPassword,
      role: 'hod',
      college: college.name,
      collegeId: college._id,
      department: departmentName,
      departmentId: null,
      isFirstLogin: true
    });

    const department = await Department.create({
      name: departmentName,
      college: college._id,
      collegeId: college._id,
      head: hodUser._id,
      headId: hodUser._id
    });

    await User.findByIdAndUpdate(hodUser._id, {
      $set: {
        college: college.name,
        collegeId: college._id,
        department: departmentName,
        departmentId: department._id
      }
    });

    const emailStatus = await sendCredentialsEmail({
      to: hodUser.email,
      name: hodUser.name,
      role: 'hod',
      password: temporaryPassword
    });

    return res.status(201).json({
      message: 'Department and HOD created successfully.',
      department: {
        _id: department._id,
        name: department.name,
        collegeId: college._id,
        headId: hodUser._id,
        head: hodUser._id
      },
      hod: buildLoginUserPayload({
        ...hodUser.toObject(),
        collegeId: college._id,
        departmentId: department._id
      }),
      emailSent: emailStatus.sent,
      emailError: emailStatus.error
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create department and HOD.' });
  }
}

module.exports = {
  createCollegeWithDean,
  createDepartmentAndHod,
  buildLoginUserPayload,
  generateTemporaryPassword,
  sendCredentialsEmail
};
