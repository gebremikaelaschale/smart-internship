const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const path = require('path');
const auth = require('../middleware/authMiddleware');
const universityRoleMiddleware = require('../middleware/universityRoleMiddleware');
const Evaluation = require('../models/Evaluation');
const Application = require('../models/Application');
const Internship = require('../models/Internship');
const Profile = require('../models/Profile');
const User = require('../models/User');
const College = require('../models/College');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const CompanyProfile = require('../models/CompanyProfile');
const PDFDocument = require('pdfkit');
const { getDepartmentContext } = require('../utils/hodContext');
const { emitHodDashboardRefresh } = require('../utils/hodDashboardSync');

function emitNotification(req, notification) {
    const io = req.app.get('io');
    if (io && notification?.userId) {
        io.to(`user:${String(notification.userId)}`).emit('notification:new', notification.toObject ? notification.toObject() : notification);
    }
}

function escapeRegex(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sendStudentEvaluationPdf(res, payload = {}) {
    const {
        generatedAt = new Date(),
        studentName = 'Student',
        studentEmail = 'Not provided',
        studentIdNumber = 'Not provided',
        studentSignatureUrl = '',
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
    doc.text(`ID Number: ${studentIdNumber}`);
    doc.text(`Department: ${studentDepartment}`);
    doc.text(`Year of Study: ${studentYear}`);
    doc.text(`GPA: ${studentGpa}`);

    if (studentSignatureUrl) {
        try {
            const signaturePath = studentSignatureUrl.startsWith('/')
                ? path.join(__dirname, '..', studentSignatureUrl)
                : studentSignatureUrl;
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#0f172a').text('Student Signature:');
            doc.image(signaturePath, { width: 140 });
        } catch (signatureError) {
            // If signature embedding fails, still continue generating the PDF.
        }
    }

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

        // Only return applications that are PLACED for this company's internships.
        // Accept both 'Placed' and uppercase 'PLACED' to match DB variations.
        const acceptedApplications = await Application.find({
            internshipId: { $in: internshipIds },
            status: { $in: ['Accepted', 'Placed', 'PLACED'] }
        })
            .populate('studentId', 'fullName name email department departmentId phone college collegeId profileImage studentIdNumber idNumber id_number studentSignatureUrl studentSignature student_signature signatureData signature_data')
            .populate('internshipId', 'title')
            .sort({ updatedAt: -1 })
            .lean();

        const existingEvaluations = acceptedApplications.length > 0
            ? await Evaluation.find({
                companyId: req.user.id,
                studentId: { $in: acceptedApplications.map((application) => application?.studentId?._id).filter(Boolean) }
            })
                .select('_id studentId evaluationStatus is_submitted score performanceRating comments acceptanceForm criteriaScores supervisorName officialPdf createdAt updatedAt')
                .lean()
            : [];

        const evaluationMap = existingEvaluations.reduce((acc, evaluation) => {
            acc[String(evaluation.studentId)] = evaluation;
            return acc;
        }, {});

        // Fetch profiles for all these students
        const studentIds = acceptedApplications.map(a => a.studentId?._id).filter(Boolean);
        const profiles = await Profile.find({ userId: { $in: studentIds } }).lean();
        const profileMap = profiles.reduce((acc, p) => {
            acc[p.userId] = p;
            return acc;
        }, {});

        const collegeIds = Array.from(new Set(
            acceptedApplications.map((application) => String(
                application?.studentId?.collegeId ||
                profileMap[application?.studentId?._id]?.personalInfo?.collegeId ||
                ''
            ).trim()).filter(Boolean)
        ));
        const departmentIds = Array.from(new Set(
            acceptedApplications.map((application) => String(
                application?.studentId?.departmentId ||
                profileMap[application?.studentId?._id]?.personalInfo?.departmentId ||
                ''
            ).trim()).filter(Boolean)
        ));

        const [colleges, departments] = await Promise.all([
            collegeIds.length > 0 ? College.find({ _id: { $in: collegeIds } }).select('_id name').lean() : [],
            departmentIds.length > 0 ? Department.find({ _id: { $in: departmentIds } }).select('_id name').lean() : []
        ]);

        const collegeMap = colleges.reduce((acc, college) => {
            acc[String(college._id)] = college;
            return acc;
        }, {});
        const departmentMap = departments.reduce((acc, department) => {
            acc[String(department._id)] = department;
            return acc;
        }, {});

        const departmentNames = Array.from(new Set(
            acceptedApplications.map((application) => {
                const studentId = application?.studentId?._id;
                const profile = profileMap[studentId] || {};
                const personalInfo = profile?.personalInfo || {};
                const departmentName = departmentMap[String(application?.studentId?.departmentId || personalInfo?.departmentId || '')]?.name
                    || personalInfo?.department
                    || application?.studentId?.department
                    || '';
                return String(departmentName).trim().toLowerCase();
            }).filter(Boolean)
        ));

        // Debug logging for department matching
        try {
            console.log(`[Evaluation] Found ${acceptedApplications.length} accepted applications with departments: ${Array.from(departmentNames).join(', ') || 'none'}`);
        } catch (e) { /* ignore */ }

        const hodUsers = departmentNames.length > 0
            ? await User.find({
                role: 'hod',
                $or: departmentNames.map((name) => ({ department: { $regex: `^${escapeRegex(name)}$`, $options: 'i' } }))
            }).select('department email fullName name').lean()
            : [];

        // Debug logging for HOD matching
        try {
            console.log(`[Evaluation] Matched ${hodUsers.length} HOD user(s): ${hodUsers.map(h => `${h.fullName || h.name} (${h.department})`).join(', ') || 'none'}`);
        } catch (e) { /* ignore */ }

        const hodMap = hodUsers.reduce((acc, hod) => {
            const key = String(hod.department || '').trim().toLowerCase();
            if (key) acc[key] = hod;
            return acc;
        }, {});

        const targets = acceptedApplications.map((application) => {
            const studentId = application?.studentId?._id;
            const profile = profileMap[studentId] || {};
            const personalInfo = profile?.personalInfo || {};
            const studentCollegeId = String(application?.studentId?.collegeId || personalInfo?.collegeId || '').trim();
            const studentDepartmentId = String(application?.studentId?.departmentId || personalInfo?.departmentId || '').trim();
            const departmentName = String(
                departmentMap[studentDepartmentId]?.name ||
                personalInfo?.department ||
                application?.studentId?.department ||
                ''
            ).trim();
            const collegeName = String(
                collegeMap[studentCollegeId]?.name ||
                personalInfo?.college ||
                application?.studentId?.college ||
                ''
            ).trim();
            const departmentHead = departmentName ? hodMap[departmentName.toLowerCase()] : null;
            const hodFullName = departmentHead?.fullName || departmentHead?.name || '';
            const hodTitle = departmentHead
                ? `Head, Department of ${departmentName || departmentHead.department || 'Department'}`
                : '';
            const universityName = 'University of Gondar';
            
            // Debug logging for each student's HOD
            try {
                const hodStatus = departmentHead 
                    ? `✓ Found HOD: ${hodFullName} (${departmentHead.email})`
                    : `✗ No HOD found for department: ${departmentName}`;
                console.log(`[Evaluation] ${application?.studentId?.fullName || application?.studentId?.name || 'Unknown'} - ${hodStatus}`);
            } catch (e) { /* ignore */ }
            
            // Provide both legacy keys (used by frontend) and the requested explicit keys
            const studentSignature = String(
                application?.studentId?.studentSignature ||
                application?.studentId?.studentSignatureUrl ||
                application?.studentId?.student_signature ||
                application?.studentId?.signatureData ||
                application?.studentId?.signature_data ||
                profile?.studentSignature ||
                profile?.student_signature ||
                profile?.studentSignatureUrl ||
                ''
            ).trim();
            const studentIdNumber = String(
                application?.studentId?.studentIdNumber ||
                application?.studentId?.idNumber ||
                application?.studentId?.id_number ||
                personalInfo?.idNumber ||
                profile?.studentIdNumber ||
                profile?.student_id ||
                ''
            ).trim();

            const legacy = {
                applicationId: application._id,
                studentId: studentId,
                internshipId: application?.internshipId?._id,
                studentName: application?.studentId?.fullName || application?.studentId?.name || 'Unnamed Student',
                studentEmail: application?.studentId?.email || '',
                studentPhone: personalInfo?.phone || application?.studentId?.phone || profile?.contactInfo?.phone || '',
                studentDepartment: departmentName || 'Information Technology',
                studentCollege: collegeName,
                studentCollegeName: collegeName,
                studentDepartmentName: departmentName,
                studentIdNumber: studentIdNumber,
                studentYear: personalInfo?.yearOfStudy || '',
                studentPhoto: profile?.profilePicUrl || application?.studentId?.profileImage || '',
                studentSignatureUrl: studentSignature,
                internshipTitle: application?.internshipId?.title || 'Unknown Internship',
                departmentHeadName: hodFullName,
                departmentHeadEmail: departmentHead?.email || '',
                hod_full_name: hodFullName,
                hod_title: hodTitle,
                university_name: universityName,
                hasEvaluation: Boolean(evaluationMap[String(studentId)]),
                evaluationId: evaluationMap[String(studentId)]?._id || '',
                evaluationStatus: evaluationMap[String(studentId)]?.evaluationStatus || 'Pending',
                isSubmitted: Boolean(evaluationMap[String(studentId)]?.is_submitted),
                evaluationScore: evaluationMap[String(studentId)]?.score ?? '',
                evaluationRating: evaluationMap[String(studentId)]?.performanceRating ?? '',
                evaluationComments: evaluationMap[String(studentId)]?.comments || '',
                evaluationCriteriaScores: evaluationMap[String(studentId)]?.criteriaScores || {},
                evaluationAcceptanceForm: evaluationMap[String(studentId)]?.acceptanceForm || {},
                evaluationSupervisorName: evaluationMap[String(studentId)]?.supervisorName || '',
                officialPdfFileName: evaluationMap[String(studentId)]?.officialPdf?.fileName || ''
            };

            const explicit = {
                id: studentId,
                full_name: legacy.studentName,
                photo: legacy.studentPhoto,
                department: legacy.studentDepartment,
                college: legacy.studentCollege,
                college_name: legacy.studentCollegeName,
                department_name: legacy.studentDepartmentName,
                id_number: legacy.studentIdNumber,
                student_signature: studentSignature,
                student_signature_url: studentSignature
            };

            return Object.assign({}, legacy, explicit);
        });

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
        const supervisorName = String(req.body.supervisorName || '').trim();
        const criteriaScores = (req.body.criteriaScores && typeof req.body.criteriaScores === 'object') ? req.body.criteriaScores : {};
        const acceptanceForm = (req.body.acceptanceForm && typeof req.body.acceptanceForm === 'object') ? req.body.acceptanceForm : {};
        const officialPdfBase64Raw = String(req.body.officialPdfBase64 || '').trim();
        const officialPdfFileName = String(req.body.officialPdfFileName || '').trim();

        if (!applicationId || !studentId || !internshipId || !Number.isInteger(performanceRating) || performanceRating < 1 || performanceRating > 5 || Number.isNaN(score) || score < 0 || score > 100 || !comments) {
            return res.status(400).json({ message: 'Please provide student, internship, rating (1-5), feedback, and score (0-100).' });
        }

        const application = await Application.findById(applicationId);
        if (!application) {
            return res.status(404).json({ message: 'Application not found.' });
        }

        if (String(application.studentId) !== studentId || String(application.internshipId) !== internshipId) {
            return res.status(400).json({ message: 'Evaluation target does not match application data.' });
        }

        const validStatuses = ['accepted', 'placed'];
        if (!validStatuses.includes(String(application.status || '').toLowerCase())) {
            return res.status(400).json({ message: 'Only accepted or placed applications can be evaluated.' });
        }

        const internship = await Internship.findById(internshipId).select('companyId').lean();
        if (!internship || String(internship.companyId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'You can only evaluate students in your internships.' });
        }

        const [student, studentProfile] = await Promise.all([
            User.findById(studentId).select('fullName name email department college departmentId').lean(),
            Profile.findOne({ userId: studentId }).select('personalInfo.department personalInfo.college personalInfo.departmentId').lean()
        ]);

        const studentDepartment = String(student?.department || studentProfile?.personalInfo?.department || '').trim();
        const studentDepartmentId = student?.departmentId || studentProfile?.personalInfo?.departmentId || null;
        const hodQuery = { role: 'hod', $or: [] };
        if (studentDepartmentId && mongoose.Types.ObjectId.isValid(String(studentDepartmentId))) {
            hodQuery.$or.push({ departmentId: studentDepartmentId });
        }
        if (studentDepartment) {
            hodQuery.$or.push({ department: { $regex: `^${escapeRegex(studentDepartment)}$`, $options: 'i' } });
        }

        const hod = hodQuery.$or.length ? await User.findOne(hodQuery).select('_id email fullName name').lean() : null;

        // Mandatory digital identity enforcement (logo + signature saved once in settings/profile).
        const companyIdentity = await CompanyProfile.findOne({ user: req.user.id })
            .select('logo logoUrl digitalSignature.cipherText')
            .lean();
        if (!companyIdentity || !(companyIdentity.logoUrl || companyIdentity.logo) || !companyIdentity?.digitalSignature?.cipherText) {
            return res.status(400).json({ message: 'Please upload your company logo and digital signature in Company Profile/Settings before submitting official forms.' });
        }

        let officialPdf = null;
        if (officialPdfBase64Raw) {
            const dataPrefixMatch = officialPdfBase64Raw.match(/^data:application\/pdf;base64,(.+)$/i);
            const pdfBase64 = dataPrefixMatch ? dataPrefixMatch[1] : officialPdfBase64Raw;
            try {
                const pdfBuffer = Buffer.from(pdfBase64, 'base64');
                if (pdfBuffer.length > 0) {
                    officialPdf = {
                        data: pdfBuffer,
                        contentType: 'application/pdf',
                        fileName: officialPdfFileName || `official-internship-doc-${Date.now()}.pdf`,
                        uploadedAt: new Date()
                    };
                }
            } catch (parseError) {
                return res.status(400).json({ message: 'Invalid official PDF payload.' });
            }
        }

        // Upsert behavior: if an evaluation already exists for this student+company, update it instead of creating a new one.
        const existing = await Evaluation.findOne({ studentId, companyId: internship.companyId });

        if (existing) {
            // Update the existing record with new values
            existing.applicationId = applicationId;
            existing.internshipId = internshipId;
            existing.hodId = hod?._id || existing.hodId || null;
            existing.supervisorId = req.user.id;
            existing.type = 'Supervisor';
            existing.performanceRating = performanceRating;
            existing.score = score;
            existing.comments = comments;
            existing.supervisorName = supervisorName;
            existing.evaluationStatus = 'Submitted';
            existing.is_submitted = true;
            existing.acceptanceForm = {
                companyName: String(acceptanceForm.companyName || '').trim(),
                placeTown: String(acceptanceForm.placeTown || '').trim(),
                contactPerson: String(acceptanceForm.contactPerson || '').trim(),
                companyPhone: String(acceptanceForm.companyPhone || '').trim(),
                companyEmail: String(acceptanceForm.companyEmail || '').trim(),
                representativeName: String(acceptanceForm.representativeName || '').trim(),
                representativeSignature: String(acceptanceForm.representativeSignature || '').trim(),
                representativeDate: String(acceptanceForm.representativeDate || '').trim()
            };
            existing.criteriaScores = criteriaScores;
            if (officialPdf) existing.officialPdf = officialPdf;
            await existing.save();

            if (Array.isArray(application.timeline)) {
                try {
                    application.timeline.push({
                        status: 'Evaluation Updated',
                        date: new Date(),
                        comment: 'Evaluation updated and resubmitted to HOD.'
                    });
                    await application.save();
                } catch (timelineError) {
                    console.warn('Evaluation timeline update failed:', timelineError.message);
                }
            }

            const companyProfile = await CompanyProfile.findOne({ user: req.user.id }).select('companyName logo logoUrl').lean();
            const studentName = student?.fullName || student?.name || 'the student';
            const companyName = String(companyProfile?.companyName || 'the industry partner').trim();

            try {
                const studentNotification = await Notification.create({
                    userId: studentId,
                    receiverRole: 'student',
                    senderId: req.user.id,
                    senderRole: 'employer',
                    title: 'Official Evaluation Updated',
                    message: `Your internship evaluation for ${studentName} has been updated by ${companyName}.`,
                    category: 'general',
                    type: 'success',
                    targetRoute: '/student/notifications',
                    sourceKey: `evaluation:${existing._id}:student`,
                    metadata: { kind: 'evaluation-updated', evaluationId: existing._id, applicationId, internshipId, performanceRating, score }
                });
                emitNotification(req, studentNotification);
            } catch (notificationError) { /* ignore */ }

            if (hod) {
                try {
                    const hodNotification = await Notification.create({
                        userId: hod._id,
                        receiverRole: 'hod',
                        senderId: req.user.id,
                        senderRole: 'employer',
                        title: 'Evaluation Updated',
                        message: `The evaluation for ${studentName} has been updated by the company. Please download the latest version.`,
                        category: 'general',
                        type: 'info',
                        targetRoute: '/hod/evaluations',
                        sourceKey: `evaluation:${existing._id}:hod`,
                        metadata: { kind: 'evaluation-updated', evaluationId: existing._id, applicationId, internshipId, studentId }
                    });
                    emitNotification(req, hodNotification);
                } catch (notificationError) { /* ignore */ }
            }

            emitHodDashboardRefresh(req, {
                reason: 'evaluation-updated',
                evaluationId: String(existing._id || ''),
                studentId: String(studentId || ''),
                internshipId: String(internshipId || '')
            });

            return res.status(200).json({ success: true, message: 'Evaluation updated successfully.', evaluation: existing });
        }

        // Create a new evaluation when none exists
        const evaluation = new Evaluation({
            applicationId,
            studentId,
            internshipId,
            companyId: internship.companyId,
            hodId: hod?._id || null,
            supervisorId: req.user.id,
            type: 'Supervisor',
            performanceRating,
            score,
            comments,
            supervisorName,
            evaluationStatus: 'Submitted',
            is_submitted: true,
            acceptanceForm: {
                companyName: String(acceptanceForm.companyName || '').trim(),
                placeTown: String(acceptanceForm.placeTown || '').trim(),
                contactPerson: String(acceptanceForm.contactPerson || '').trim(),
                companyPhone: String(acceptanceForm.companyPhone || '').trim(),
                companyEmail: String(acceptanceForm.companyEmail || '').trim(),
                representativeName: String(acceptanceForm.representativeName || '').trim(),
                representativeSignature: String(acceptanceForm.representativeSignature || '').trim(),
                representativeDate: String(acceptanceForm.representativeDate || '').trim()
            },
            criteriaScores,
            ...(officialPdf ? { officialPdf } : {})
        });

        await evaluation.save();

        if (Array.isArray(application.timeline)) {
            try {
                application.timeline.push({
                    status: 'Evaluation Completed',
                    date: new Date(),
                    comment: 'Final evaluation submitted to HOD.'
                });
                await application.save();
            } catch (timelineError) {
                console.warn('Evaluation timeline update failed:', timelineError.message);
            }
        }

        const companyProfile = await CompanyProfile.findOne({ user: req.user.id })
            .select('companyName logo logoUrl')
            .lean();

        const studentName = student?.fullName || student?.name || 'the student';
        const companyName = String(companyProfile?.companyName || 'the industry partner').trim();

        try {
            const studentNotification = await Notification.create({
                userId: studentId,
                receiverRole: 'student',
                senderId: req.user.id,
                senderRole: 'employer',
                title: 'Official Evaluation Submitted',
                message: `Your official internship evaluation for ${studentName} has been completed by the industry partner.`,
                category: 'general',
                type: 'success',
                targetRoute: '/student/notifications',
                sourceKey: `evaluation:${evaluation._id}:student`,
                metadata: {
                    kind: 'evaluation-submitted',
                    evaluationId: evaluation._id,
                    applicationId,
                    internshipId,
                    performanceRating,
                    score
                }
            });
            emitNotification(req, studentNotification);
        } catch (notificationError) {
            // Notification delivery must not block evaluation submission.
        }

        if (hod) {
            try {
                const hodNotification = await Notification.create({
                    userId: hod._id,
                    receiverRole: 'hod',
                    senderId: req.user.id,
                    senderRole: 'employer',
                    title: 'Official Internship Documents Ready',
                    message: `New evaluation received for ${studentName} from ${companyName}.`,
                    category: 'general',
                    type: 'info',
                    targetRoute: '/hod/evaluations',
                    sourceKey: `evaluation:${evaluation._id}:hod`,
                    metadata: {
                        kind: 'evaluation-submitted',
                        evaluationId: evaluation._id,
                        applicationId,
                        internshipId,
                        studentId
                    }
                });
                emitNotification(req, hodNotification);
            } catch (notificationError) {
                // Keep the main response successful even if the notification write fails.
            }
        }

        return res.status(201).json({ success: true, message: 'Evaluation submitted successfully.', evaluation });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to submit evaluation.' });
    }
});

// GET existing evaluation for a company (used to populate edit form)
router.get('/company/existing', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only employers can access this resource.' });
        }

        const studentId = String(req.query.studentId || '').trim();
        const internshipId = String(req.query.internshipId || '').trim();

        if (!studentId || !internshipId) return res.status(400).json({ message: 'studentId and internshipId are required.' });

        const internship = await Internship.findById(internshipId).select('companyId').lean();
        if (!internship) return res.status(404).json({ message: 'Internship not found.' });
        if (String(internship.companyId) !== String(req.user.id)) return res.status(403).json({ message: 'You can only access evaluations for your internships.' });

        const evaluation = await Evaluation.findOne({ studentId, companyId: internship.companyId })
            .select('-officialPdf.data')
            .lean();

        if (!evaluation) return res.status(404).json({ message: 'No existing evaluation found.' });
        return res.json({ evaluation });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load existing evaluation.' });
    }
});

router.put('/:id/official-pdf', auth, async (req, res) => {
    try {
        if (String(req.user?.role || '').toLowerCase() !== 'employer') {
            return res.status(403).json({ message: 'Only employers can update official evaluation PDFs.' });
        }

        const evaluationId = String(req.params.id || '').trim();
        const officialPdfBase64Raw = String(req.body.officialPdfBase64 || '').trim();
        const officialPdfFileName = String(req.body.officialPdfFileName || '').trim();

        if (!evaluationId) {
            return res.status(400).json({ message: 'Evaluation ID is required.' });
        }

        const evaluation = await Evaluation.findById(evaluationId);
        if (!evaluation) {
            return res.status(404).json({ message: 'Evaluation not found.' });
        }

        if (String(evaluation.companyId || '') !== String(req.user.id || '')) {
            return res.status(403).json({ message: 'You can only update PDFs for your own evaluations.' });
        }

        if (!officialPdfBase64Raw) {
            return res.status(400).json({ message: 'Official PDF payload is required.' });
        }

        const dataPrefixMatch = officialPdfBase64Raw.match(/^data:application\/pdf;base64,(.+)$/i);
        const pdfBase64 = dataPrefixMatch ? dataPrefixMatch[1] : officialPdfBase64Raw;
        let pdfBuffer;

        try {
            pdfBuffer = Buffer.from(pdfBase64, 'base64');
        } catch (parseError) {
            return res.status(400).json({ message: 'Invalid official PDF payload.' });
        }

        if (!pdfBuffer || pdfBuffer.length === 0) {
            return res.status(400).json({ message: 'Official PDF payload is empty.' });
        }

        evaluation.officialPdf = {
            data: pdfBuffer,
            contentType: 'application/pdf',
            fileName: officialPdfFileName || `official-internship-doc-${Date.now()}.pdf`,
            uploadedAt: new Date()
        };

        await evaluation.save();

        emitHodDashboardRefresh(req, {
            reason: 'evaluation-submitted',
            evaluationId: String(evaluation._id || ''),
            studentId: String(studentId || ''),
            internshipId: String(internshipId || '')
        });

        return res.json({
            message: 'Official PDF updated successfully.',
            evaluation: {
                _id: evaluation._id,
                officialPdf: {
                    fileName: evaluation.officialPdf.fileName,
                    contentType: evaluation.officialPdf.contentType,
                    uploadedAt: evaluation.officialPdf.uploadedAt
                }
            }
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update official PDF.' });
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
            studentIdNumber: studentUser?.studentIdNumber || '',
            studentSignatureUrl: studentUser?.studentSignatureUrl || '',
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

        // Pagination
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const skip = (page - 1) * limit;

        const [total, items] = await Promise.all([
            Evaluation.countDocuments(filter),
            Evaluation.find(filter)
                .select('-officialPdf.data')
                .populate('studentId', 'fullName name email college department departmentId phone profileImage studentIdNumber idNumber id_number studentSignatureUrl studentSignature student_signature studentSignatureUrl')
                .populate('supervisorId', 'fullName name')
                .populate('internshipId', 'title companyId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean()
        ]);

        return res.json({
            items,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.max(Math.ceil(total / limit), 1)
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to load evaluations.' });
    }
});

// ─── HOD: Download Filled Evaluation PDF ────────────────────────────────
router.get('/admin/:id/download-pdf', auth, universityRoleMiddleware(['hod']), async (req, res) => {
    try {
        const context = await getDepartmentContext(req);
        if (!context?.department) {
            return res.status(403).json({ message: 'Your HOD account is not linked to a department.' });
        }

        const evaluation = await Evaluation.findById(req.params.id)
            .populate('studentId', 'fullName name department college departmentId')
            .populate('supervisorId', 'fullName name email')
            .populate('internshipId', 'title companyId')
            .lean();

        if (!evaluation) return res.status(404).json({ message: 'Not found' });

        const requesterDepartmentId = String(context.department._id || '');
        const studentDepartmentId = String(evaluation?.studentId?.departmentId || '');

        if (studentDepartmentId && requesterDepartmentId !== studentDepartmentId) {
            return res.status(403).json({ message: 'Access denied: this document is outside your department.' });
        }

        if (evaluation?.officialPdf?.data) {
            const pdfBuffer = Buffer.isBuffer(evaluation.officialPdf.data)
                ? evaluation.officialPdf.data
                : Buffer.from(evaluation.officialPdf.data?.data || []);

            if (pdfBuffer.length > 0) {
                const fileName = evaluation?.officialPdf?.fileName || `Evaluation_${evaluation.studentId?.fullName || 'Student'}.pdf`;
                res.setHeader('Content-Type', evaluation?.officialPdf?.contentType || 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
                return res.send(pdfBuffer);
            }
        }

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const fileName = `Evaluation_${evaluation.studentId?.fullName || 'Student'}.pdf`;
        
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        
        doc.pipe(res);

        // Styling the PDF
        // Draw border
        doc.rect(20, 20, 555, 800).stroke('#1e293b');

        doc.fontSize(24).font('Helvetica-Bold').fillColor('#0f172a').text('UNIVERSITY OF GONDAR', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(16).text('OFFICIAL INTERNSHIP EVALUATION', { align: 'center', underline: true });
        doc.moveDown(2);

        doc.fontSize(12).font('Helvetica-Bold').text('STUDENT INFORMATION');
        doc.font('Helvetica').fontSize(11).fillColor('#334155');
        doc.text(`Name: ${evaluation.studentId?.fullName || evaluation.studentId?.name || 'N/A'}`);
        doc.text(`College: ${evaluation.studentId?.college || 'N/A'}`);
        doc.text(`Department: ${evaluation.studentId?.department || 'N/A'}`);
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('EMPLOYER & SUPERVISOR');
        doc.font('Helvetica').fontSize(11).fillColor('#334155');
        doc.text(`Supervisor Name: ${evaluation.supervisorId?.fullName || evaluation.supervisorId?.name || 'N/A'}`);
        doc.text(`Internship Title: ${evaluation.internshipId?.title || 'N/A'}`);
        doc.moveDown(1.5);

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('PERFORMANCE RESULTS');
        doc.rect(50, doc.y, 495, 80).fillAndStroke('#f8fafc', '#cbd5e1');
        doc.fillColor('#0f172a').font('Helvetica-Bold').text('TOTAL EVALUATION SCORE:', 70, doc.y - 65);
        doc.fontSize(24).fillColor(evaluation.score >= 80 ? '#15803d' : '#b45309').text(`${evaluation.score}%`, 280, doc.y - 25);
        doc.moveDown(4);

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('SUPERVISOR REMARKS / COMMENTS');
        doc.font('Helvetica-Oblique').fontSize(11).fillColor('#475569');
        doc.text(`"${evaluation.comments || 'No remarks provided.'}"`, { width: 495, align: 'justify' });
        
        doc.moveDown(4);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
        doc.text('Date Evaluated:', 50, 700);
        doc.font('Helvetica').text(new Date(evaluation.createdAt).toLocaleDateString(), 50, 715);

        doc.font('Helvetica-Bold').text('Authorized System Document', 350, 700, { align: 'right' });
        doc.font('Helvetica').text('Industry Partner Portal', 350, 715, { align: 'right' });

        doc.end();
    } catch (err) {
        console.error(err);
        if (!res.headersSent) res.status(500).json({ message: 'Error generating PDF' });
    }
});

module.exports = router;
