const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Evaluation = require('../models/Evaluation');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Profile = require('../models/Profile');
const User = require('../models/User');
const PDFDocument = require('pdfkit');

function sendStudentEvaluationPdf(res, payload = {}) {
    const {
        generatedAt = new Date(),
        studentName = 'Student',
        studentEmail = 'Not provided',
        studentDepartment = 'Not provided',
        studentYear = 'Not provided',
        studentGpa = 'Not provided',
        employerName = 'Employer Supervisor',
        internshipTitle = 'Internship Placement',
        internshipPeriod = 'Not assigned',
        internshipLocation = 'Not specified',
        note = ''
    } = payload;

    const fileName = `student-evaluation-paper-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#0f172a').text('Internship Evaluation Paper');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#475569').text(`Generated: ${generatedAt.toLocaleString()}`);
    doc.text('Use this form for employer supervisor evaluation and signature.');

    if (note) {
        doc.moveDown(0.4);
        doc.fontSize(9).fillColor('#b45309').text(`Note: ${note}`);
    }

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#0f172a').text('Student Information');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#111827');
    doc.text(`Name: ${studentName}`);
    doc.text(`Email: ${studentEmail}`);
    doc.text(`Department: ${studentDepartment}`);
    doc.text(`Year of Study: ${studentYear}`);
    doc.text(`GPA: ${studentGpa}`);

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#0f172a').text('Internship Placement');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#111827');
    doc.text(`Employer: ${employerName}`);
    doc.text(`Internship Title: ${internshipTitle}`);
    doc.text(`Period: ${internshipPeriod}`);
    doc.text(`Location: ${internshipLocation}`);

    doc.moveDown(0.8);
    doc.fontSize(13).fillColor('#0f172a').text('Supervisor Evaluation Section');
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor('#111827');

    const rows = [
        'Professionalism',
        'Technical Skill',
        'Communication',
        'Punctuality',
        'Team Collaboration',
        'Task Completion'
    ];

    let y = doc.y;
    const x = 40;
    const widths = [240, 90, 185];
    const headers = ['Criteria', 'Rating (1-5)', 'Supervisor Comment'];
    headers.forEach((header, index) => {
        const colX = x + widths.slice(0, index).reduce((a, b) => a + b, 0);
        doc.rect(colX, y, widths[index], 22).fillAndStroke('#f1f5f9', '#cbd5e1');
        doc.fillColor('#0f172a').fontSize(9).text(header, colX + 6, y + 7, { width: widths[index] - 12 });
    });
    y += 22;

    rows.forEach((criterion) => {
        const values = [criterion, '', ''];
        values.forEach((value, index) => {
            const colX = x + widths.slice(0, index).reduce((a, b) => a + b, 0);
            doc.rect(colX, y, widths[index], 24).stroke('#e2e8f0');
            doc.fillColor('#334155').fontSize(9).text(value, colX + 6, y + 8, { width: widths[index] - 12 });
        });
        y += 24;
    });

    y += 12;
    doc.rect(40, y, 515, 86).stroke('#cbd5e1');
    doc.fontSize(9).fillColor('#334155').text('Overall Feedback:', 46, y + 8);

    y += 100;
    doc.fontSize(10).fillColor('#111827');
    doc.text('Supervisor Name: ____________________________', 40, y);
    doc.text('Signature: ____________________________', 320, y);
    doc.text('Date: ____________________________', 40, y + 24);

    doc.moveDown(2);
    doc.fontSize(9).fillColor('#64748b').text('This paper can be submitted to employers for structured internship evaluation.');
    doc.end();
}

router.get('/targets', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only employers can access evaluation targets.' });
        }

        const internships = await Internship.find({ companyId: req.user.id }).select('_id title').lean();
        const internshipIds = internships.map((item) => item._id);

        const acceptedApplications = await Application.find({
            internshipId: { $in: internshipIds },
            status: 'Accepted'
        })
            .populate('studentId', 'fullName email')
            .populate('internshipId', 'title')
            .sort({ updatedAt: -1 })
            .lean();

        const targets = acceptedApplications.map((application) => ({
            applicationId: application._id,
            studentId: application?.studentId?._id,
            internshipId: application?.internshipId?._id,
            studentName: application?.studentId?.fullName || 'Unnamed Student',
            internshipTitle: application?.internshipId?.title || 'Unknown Internship'
        }));

        return res.json(targets);
    } catch (error) {
        return res.status(500).json({ message: 'Failed to load evaluation targets.' });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only employers can submit evaluations.' });
        }

        const applicationId = String(req.body.applicationId || '').trim();
        const studentId = String(req.body.studentId || '').trim();
        const internshipId = String(req.body.internshipId || '').trim();
        const performanceRating = Number(req.body.performanceRating);
        const score = Number(req.body.score);
        const comments = String(req.body.comments || '').trim();

        if (!applicationId || !studentId || !internshipId || !Number.isInteger(performanceRating) || performanceRating < 1 || performanceRating > 5 || Number.isNaN(score) || score < 0 || score > 100 || !comments) {
            return res.status(400).json({ message: 'Please provide student, internship, rating (1-5), feedback, and score (0-100).' });
        }

        const application = await Application.findById(applicationId).lean();
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        if (String(application.studentId) !== studentId || String(application.internshipId) !== internshipId) {
            return res.status(400).json({ message: 'Evaluation target does not match application data.' });
        }

        if (String(application.status || '').toLowerCase() !== 'accepted') {
            return res.status(400).json({ message: 'Only accepted applications can be evaluated.' });
        }

        const internship = await Internship.findById(internshipId).select('companyId').lean();
        if (!internship || String(internship.companyId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'You can only evaluate students in your internships.' });
        }

        const evaluation = new Evaluation({
            applicationId,
            studentId,
            internshipId,
            supervisorId: req.user.id,
            type: 'Supervisor',
            performanceRating,
            score,
            comments
        });

        await evaluation.save();
        return res.status(201).json({ message: 'Evaluation submitted successfully.', evaluation });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to submit evaluation.' });
    }
});

// Student downloadable evaluation paper to share with employer supervisors.
router.get('/student/paper', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'student') {
            return res.status(403).json({ message: 'Only students can download evaluation paper.' });
        }

        const studentId = req.user.id;
        const [studentUser, studentProfile] = await Promise.all([
            User.findById(studentId).select('fullName name email college department').lean(),
            Profile.findOne({ userId: studentId }).select('personalInfo academicInfo').lean()
        ]);

        const acceptedApplication = await Application.findOne({ studentId, status: 'Accepted' })
            .populate('internshipId', 'title companyId startDate endDate location')
            .sort({ updatedAt: -1 })
            .lean();

        let employerName = 'Employer Supervisor';
        let internshipTitle = 'Internship Placement';
        let internshipPeriod = 'Not assigned';
        let internshipLocation = 'Not specified';

        if (acceptedApplication?.internshipId) {
            internshipTitle = acceptedApplication.internshipId.title || internshipTitle;
            internshipLocation = acceptedApplication.internshipId.location || internshipLocation;
            const start = acceptedApplication.internshipId.startDate ? new Date(acceptedApplication.internshipId.startDate) : null;
            const end = acceptedApplication.internshipId.endDate ? new Date(acceptedApplication.internshipId.endDate) : null;
            if (start && !Number.isNaN(start.getTime()) && end && !Number.isNaN(end.getTime())) {
                internshipPeriod = `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
            }

            const companyUserId = acceptedApplication?.internshipId?.companyId;
            if (companyUserId && mongoose.Types.ObjectId.isValid(String(companyUserId))) {
                const employerUser = await User.findById(companyUserId)
                    .select('fullName name')
                    .lean();
                if (employerUser) {
                    employerName = employerUser.fullName || employerUser.name || employerName;
                }
            }
        }

        const studentName = studentUser?.fullName || studentUser?.name || 'Student';
        const studentEmail = studentUser?.email || 'Not provided';
        const studentDepartment = studentProfile?.personalInfo?.department || studentUser?.department || 'Not provided';
        const studentYear = studentProfile?.personalInfo?.yearOfStudy || 'Not provided';
        const studentGpa = Number.isFinite(Number(studentProfile?.academicInfo?.gpa))
            ? String(studentProfile.academicInfo.gpa)
            : 'Not provided';

        return sendStudentEvaluationPdf(res, {
            generatedAt: new Date(),
            studentName,
            studentEmail,
            studentDepartment,
            studentYear,
            studentGpa,
            employerName,
            internshipTitle,
            internshipPeriod,
            internshipLocation
        });
    } catch (err) {
        console.error('Error generating evaluation PDF:', err);
        res.status(500).json({ message: 'Failed to generate evaluation PDF.' });
    }
});

// ─── Admin: Get all evaluations (with scope) ────────────────────────────────
router.get('/admin/all', auth, async (req, res) => {
    try {
        const role = String(req.user?.role || req.user?.adminType || '').toLowerCase();
        const isGovernance = ['admin', 'superadmin', 'dean', 'hod', 'collegeadmin', 'deptadmin'].includes(role);

        if (!isGovernance) {
            return res.status(403).json({ message: 'Unauthorized. Governance access required.' });
        }

        const filter = {};
        
        // Apply scope if not superadmin
        if (role !== 'superadmin' && role !== 'admin') {
            const user = await User.findById(req.user.id).select('college department').lean();
            if (user?.college) {
                // We need to filter evaluations by students in that college
                const studentIds = await User.find({ college: user.college }).distinct('_id');
                filter.studentId = { $in: studentIds };
                
                if (role.includes('dept') || role === 'hod') {
                    if (user?.department) {
                        const deptStudentIds = await User.find({ college: user.college, department: user.department }).distinct('_id');
                        filter.studentId = { $in: deptStudentIds };
                    }
                }
            }
        }

        const evaluations = await Evaluation.find(filter)
            .populate('studentId', 'fullName name email college department')
            .populate('supervisorId', 'fullName name')
            .populate('internshipId', 'title companyId')
            .sort({ createdAt: -1 })
            .lean();

        res.json(evaluations);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load evaluations.' });
    }
});

module.exports = router;
