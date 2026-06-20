const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const LoginLog = require('../models/LoginLog');
const authMiddleware = require('../middleware/authMiddleware');
const { normalizeRole, normalizeAdminType } = require('../utils/governanceRoles');
const { toDisplayUniversityRole } = require('../utils/universityRoles');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_EMAIL_REGEX = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9.]{4,28}[a-z0-9])@(gmail\.com|googlemail\.com)$/i;
const LOGIN_EMAIL_REGEX = /^(?!.*\.\.)[a-z0-9](?:[a-z0-9.]{1,62}[a-z0-9])@((gmail\.com|googlemail\.com)|(uog\.edu|uog\.edu\.et))$/i;
const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || EMAIL_USER;
const RESET_CODE_EXPIRY_MS = 15 * 60 * 1000;

const mailTransporter = EMAIL_USER && EMAIL_PASS
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS
      }
    })
  : null;

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' }
});

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

function createResetCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashResetCode(code) {
  return crypto.createHash('sha256').update(String(code)).digest('hex');
}

async function logLoginEvent({ email, status, reason, req }) {
  try {
    await LoginLog.create({
      email: String(email || '').toLowerCase().trim() || null,
      status,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch {
    // Login logging should never block authentication.
  }
}

async function sendResetCodeEmail({ to, name, code }) {
  if (!mailTransporter) {
    throw new Error('Email service is not configured.');
  }

  await mailTransporter.sendMail({
    from: EMAIL_FROM,
    to,
    subject: 'Your UOG password reset code',
    html: `
      <div style="font-family: Arial, sans-serif; background:#f8fafc; padding:24px; color:#0f172a;">
        <div style="max-width:560px; margin:0 auto; background:#ffffff; border-radius:20px; padding:32px; border:1px solid #e2e8f0;">
          <p style="font-size:12px; letter-spacing:0.2em; text-transform:uppercase; color:#2563eb; font-weight:700; margin:0 0 12px;">UOG Internship Portal</p>
          <h1 style="font-size:28px; margin:0 0 16px; color:#0f172a;">Reset your password</h1>
          <p style="font-size:16px; line-height:1.6; margin:0 0 24px; color:#475569;">Hello ${name || 'there'},</p>
          <p style="font-size:16px; line-height:1.6; margin:0 0 24px; color:#475569;">Use the verification code below to reset your password. The code expires in 15 minutes.</p>
          <div style="background:#08143a; color:#ffffff; border-radius:16px; text-align:center; padding:18px 20px; font-size:32px; letter-spacing:0.3em; font-weight:700;">${code}</div>
          <p style="font-size:14px; line-height:1.6; margin:24px 0 0; color:#64748b;">If you did not request this, you can ignore this email.</p>
        </div>
      </div>
    `
  });
}

router.post('/register', loginLimiter, async (req, res) => {
  try {
    const { name, fullName, email, password, role, phone } = req.body;
    const cleanName = String(name || fullName || '').trim();
    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();
    const cleanRole = String(role || 'student').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({ message: 'name, email, and password are required.' });
    }

    if (!STRONG_PASSWORD_REGEX.test(cleanPassword)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
    }

    if (!/^[A-Z]/.test(cleanName)) {
      return res.status(400).json({ message: 'Full name must start with a capital letter.' });
    }

    if (!GOOGLE_EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Only valid Google email addresses are allowed.' });
    }

    if (['admin', 'superadmin', 'collegeadmin', 'deptadmin', 'dean', 'hod'].includes(cleanRole)) {
      return res.status(403).json({ message: 'Admin accounts cannot be created from the public register page.' });
    }

    if (cleanRole !== 'student' && cleanRole !== 'employer') {
      return res.status(400).json({ message: 'Role must be either student or employer.' });
    }

    const existing = await User.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const hashedPassword = await bcrypt.hash(cleanPassword, 12);
    const user = await User.create({
      name: cleanName,
      fullName: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      role: cleanRole,
      phone: cleanPhone || '',
      isFirstLogin: true
    });

    const publicRole = toDisplayUniversityRole({ role: cleanRole, adminType: null });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name,
      role: cleanRole
    });

    return res.status(201).json({
      token,
      role: publicRole,
      collegeId: user.collegeId || null,
      departmentId: user.departmentId || null,
      user: {
        id: user._id,
        name: user.name,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone || '',
        role: cleanRole,
        isFirstLogin: user.isFirstLogin,
        isVerified: Boolean(user.isVerified),
        verificationStatus: user.verificationStatus || (user.isVerified ? 'Verified' : 'Not Submitted'),
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create account.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanPassword = String(password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      await logLoginEvent({ email: cleanEmail, status: 'FAILURE', reason: 'Missing email or password.', req });
      return res.status(400).json({ message: 'email and password are required.' });
    }

    if (!LOGIN_EMAIL_REGEX.test(cleanEmail)) {
      await logLoginEvent({ email: cleanEmail, status: 'FAILURE', reason: 'Invalid email format.', req });
      return res.status(400).json({ message: 'Please use a valid Gmail or UOG email address.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.password) {
      await logLoginEvent({ email: cleanEmail, status: 'FAILURE', reason: 'User not found or password missing.', req });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.password);
    if (!isMatch) {
      await logLoginEvent({ email: cleanEmail, status: 'FAILURE', reason: 'Incorrect password.', req });
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const role = normalizeRole(user.role);
    const adminType = ['admin', 'dean', 'hod'].includes(role) ? normalizeAdminType(user.adminType || user.role) : null;
    const publicRole = toDisplayUniversityRole({ role, adminType });
    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      name: user.name || user.fullName,
      role,
      adminType,
      departmentId: user.departmentId || null,
      collegeId: user.collegeId || null
    });

    user.isFirstLogin = false;
    user.lastLoginAt = new Date();
    await user.save();

    await logLoginEvent({
      email: user.email,
      status: 'SUCCESS',
      reason: 'Login successful.',
      req
    });

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name || user.fullName,
        fullName: user.fullName || user.name,
        email: user.email,
        phone: user.phone || '',
        role: publicRole,
        adminType,
        college: user.college || '',
        department: user.department || '',
        collegeId: user.collegeId || null,
        departmentId: user.departmentId || null,
        isVerified: Boolean(user.isVerified),
        verificationStatus: user.verificationStatus || (user.isVerified ? 'Verified' : 'Not Submitted'),
        isFirstLogin: user.isFirstLogin,
          lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Login failed.' });
  }
});

router.post('/forgot-password', loginLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email || '').toLowerCase().trim();

    if (!cleanEmail) {
      return res.status(400).json({ message: 'email is required.' });
    }

    if (!LOGIN_EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please use a valid Gmail or UOG email address.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user) {
      return res.json({ message: 'If the email exists, a reset code has been sent.' });
    }

    const code = createResetCode();
    user.resetPasswordToken = hashResetCode(code);
    user.resetPasswordExpires = Date.now() + RESET_CODE_EXPIRY_MS;
    await user.save();

    try {
      await sendResetCodeEmail({ to: user.email, name: user.name || user.fullName, code });
    } catch (mailError) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Unable to send reset code. Please try again later.' });
    }

    return res.json({ message: 'If the email exists, a reset code has been sent.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', loginLimiter, async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    const cleanEmail = String(email || '').toLowerCase().trim();
    const cleanCode = String(code || '').trim();
    const cleanPassword = String(newPassword || '').trim();

    if (!cleanEmail || !cleanCode || !cleanPassword) {
      return res.status(400).json({ message: 'email, code, and newPassword are required.' });
    }

    if (!LOGIN_EMAIL_REGEX.test(cleanEmail)) {
      return res.status(400).json({ message: 'Please use a valid Gmail or UOG email address.' });
    }

    if (!STRONG_PASSWORD_REGEX.test(cleanPassword)) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findOne({ email: cleanEmail });
    if (!user || !user.resetPasswordToken || !user.resetPasswordExpires) {
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    if (Date.now() > user.resetPasswordExpires) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(400).json({ message: 'Invalid or expired reset code.' });
    }

    if (hashResetCode(cleanCode) !== user.resetPasswordToken) {
      return res.status(400).json({ message: 'Invalid reset code.' });
    }

    user.password = await bcrypt.hash(cleanPassword, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.isFirstLogin = false;
    await user.save();

    return res.json({ message: 'Password reset successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to reset password.' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'currentPassword and newPassword are required.' });
    }

    if (!STRONG_PASSWORD_REGEX.test(String(newPassword).trim())) {
      return res.status(400).json({ message: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
    }

    const user = await User.findById(req.user.id);
    if (!user || !user.password) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const matched = await bcrypt.compare(currentPassword, user.password);
    if (!matched) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.isFirstLogin = false;
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to change password.' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const normalizedRole = normalizeRole(user.role);
    const adminType = ['admin', 'dean', 'hod'].includes(normalizedRole) ? normalizeAdminType(user.adminType || user.role) : null;
    const publicRole = toDisplayUniversityRole({ role: normalizedRole, adminType });

    return res.json({
      role: publicRole,
      collegeId: user.collegeId || null,
      departmentId: user.departmentId || null,
      user: {
        id: user._id,
        name: user.name || user.fullName,
        fullName: user.fullName || user.name,
        email: user.email,
        role: publicRole,
        adminType,
        collegeId: user.collegeId || null,
        departmentId: user.departmentId || null,
        isFirstLogin: user.isFirstLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch profile.' });
  }
});

router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    
    if (!user.password) {
      return res.status(400).json({ message: 'Password is not set for this user.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }
    
    // In our system, some seeded users have weak passwords like "password123".
    // We only enforce strong password on the NEW password.
    if (!STRONG_PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({ message: 'New password must be at least 8 characters and include uppercase, lowercase, number, and special character.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedPassword;
    await user.save();
    
    return res.json({ message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ message: 'Unable to process password change request.' });
  }
});

module.exports = router;
