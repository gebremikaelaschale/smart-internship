const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const CompanyProfile = require('../models/CompanyProfile');
const User = require('../models/User');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { encryptSignatureDataUrl, decryptSignatureDataUrl } = require('../utils/signatureCrypto');

// Configure Multer for company documents
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/company_docs');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'doc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Configure Multer for business license
const licenseStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/licenses');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'license-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image (JPG/PNG) files are allowed.'));
        }
    }
});

const licenseUpload = multer({
    storage: licenseStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and image (JPG/PNG) files are allowed.'));
        }
    }
});

// Calculate Profile Completeness Score
const calculateCompleteness = (data) => {
    let score = 0;
    if (data.logo) score += 10;
    if (data.coverImage) score += 10;
    if (data.description) score += 10;
    if (data.industryType) score += 10;
    if (data.hqLocation) score += 10;
    if (data.website) score += 5;
    if (data.officialEmail) score += 5;
    if (data.phone) score += 5;
    if (data.representative?.name) score += 5;
    if (data.targetDepartments?.length > 0) score += 10;
    if (data.internshipFacilities?.length > 0) score += 10;
    if (data.requiredSkills?.length > 0) score += 10;
    if (data.verification?.businessLicenseUrl) score += 10;
    if (data.verification?.status === 'Verified') score += 10;
    return Math.min(100, score);
};

// 1. Get Employer Profile
router.get('/', auth, async (req, res) => {
    try {
        let profile = await CompanyProfile.findOne({ user: req.user.id });
        if (!profile) {
            const user = await User.findById(req.user.id).select('fullName name email').lean();
            const defaultCompanyName = String(user?.fullName || user?.name || 'Company').trim() || 'Company';
            profile = await CompanyProfile.create({
                user: req.user.id,
                companyName: defaultCompanyName,
                officialEmail: user?.email || '',
                profileCompleteness: calculateCompleteness({
                    companyName: defaultCompanyName,
                    officialEmail: user?.email || ''
                }),
                verification: { status: 'Pending' }
            });
        }
        const signatureDataUrl = decryptSignatureDataUrl(profile?.digitalSignature || {});
        const safeProfile = profile.toObject ? profile.toObject() : profile;
        safeProfile.logoUrl = safeProfile.logoUrl || safeProfile.logo || '';
        safeProfile.signatureUrl = signatureDataUrl;
        // DEBUG LOG
        console.log(`[EmployerProfile GET] user=${req.user.id} | status=${profile?.verification?.status || 'NONE'}`);
        res.json(safeProfile);
    } catch (err) { 
        console.error('Fetch Error:', err);
        res.status(500).send("Fetch error: " + err.message); 
    }
});

// 1.1 Owner-only identity endpoint (logo + decrypted signature)
router.get('/identity', auth, async (req, res) => {
    try {
        let profile = await CompanyProfile.findOne({ user: req.user.id });
        if (!profile) {
            const user = await User.findById(req.user.id).select('fullName name email').lean();
            const defaultCompanyName = String(user?.fullName || user?.name || 'Company').trim() || 'Company';
            profile = await CompanyProfile.create({
                user: req.user.id,
                companyName: defaultCompanyName,
                officialEmail: user?.email || '',
                profileCompleteness: calculateCompleteness({
                    companyName: defaultCompanyName,
                    officialEmail: user?.email || ''
                }),
                verification: { status: 'Pending' }
            });
        }

        return res.json({
            logoUrl: profile.logoUrl || profile.logo || '',
            signatureUrl: decryptSignatureDataUrl(profile.digitalSignature || {}),
            hasLogo: Boolean(profile.logoUrl || profile.logo),
            hasSignature: Boolean(profile?.digitalSignature?.cipherText)
        });
    } catch (err) {
        return res.status(500).json({ message: 'Failed to load company identity.' });
    }
});

const handleIdentityUpdate = async (req, res) => {
    try {
        const logoFile = req.files?.logoFile?.[0];
        const signatureFile = req.files?.signatureFile?.[0];
        const rawLogoUrl = String(req.body.logoUrl || '').trim();
        const rawSignatureDataUrl = String(req.body.signatureDataUrl || '').trim();
        const rawSignatureUrl = String(req.body.signatureUrl || '').trim();

        if (!logoFile && !rawLogoUrl) {
            return res.status(400).json({ message: 'Company logo is required.' });
        }

        if (!signatureFile && !rawSignatureDataUrl && !rawSignatureUrl) {
            return res.status(400).json({ message: 'Digital signature is required.' });
        }

        let finalLogoUrl = rawLogoUrl;
        if (logoFile) {
            finalLogoUrl = `/uploads/company_docs/${logoFile.filename}`;
        }

        let signatureDataUrl = rawSignatureDataUrl || rawSignatureUrl;
        if (signatureFile) {
            const signaturePath = path.join(__dirname, '../uploads/company_docs', signatureFile.filename);
            const fileBuffer = fs.readFileSync(signaturePath);
            signatureDataUrl = `data:${signatureFile.mimetype};base64,${fileBuffer.toString('base64')}`;
        }

        if (!signatureDataUrl || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(signatureDataUrl)) {
            return res.status(400).json({ message: 'Invalid signature format.' });
        }

        const encryptedSignature = encryptSignatureDataUrl(signatureDataUrl);
        if (!encryptedSignature?.cipherText) {
            return res.status(400).json({ message: 'Failed to process signature image.' });
        }

        const updated = await CompanyProfile.findOneAndUpdate(
            { user: req.user.id },
            {
                $set: {
                    logo: finalLogoUrl,
                    logoUrl: finalLogoUrl,
                    digitalSignature: {
                        ...encryptedSignature,
                        mimeType: 'image/png',
                        updatedAt: new Date()
                    },
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after', upsert: true }
        ).lean();

        await User.findByIdAndUpdate(req.user.id, { profileImage: finalLogoUrl });

        return res.json({
            message: 'Digital identity updated successfully.',
            identity: {
                logoUrl: updated.logoUrl || updated.logo || '',
                signatureUrl: decryptSignatureDataUrl(updated.digitalSignature || {}),
                hasLogo: Boolean(updated.logoUrl || updated.logo),
                hasSignature: Boolean(updated?.digitalSignature?.cipherText)
            }
        });
    } catch (err) {
        console.error('Identity Update Error:', err);
        return res.status(500).json({ message: 'Failed to update company identity.' });
    }
};

// 1.2 Owner-only identity update endpoint
router.post('/identity', auth, upload.fields([
    { name: 'logoFile', maxCount: 1 },
    { name: 'signatureFile', maxCount: 1 }
]), handleIdentityUpdate);
router.put('/identity', auth, upload.fields([
    { name: 'logoFile', maxCount: 1 },
    { name: 'signatureFile', maxCount: 1 }
]), handleIdentityUpdate);

// 2. Sync / Update Profile
router.post('/', auth, licenseUpload.fields([
    { name: 'businessLicense', maxCount: 1 }
]), async (req, res) => {
    try {
        console.log('--- Profile Update Request ---');
        console.log('Files:', req.files);
        
        let updateData = { ...req.body };
        
        // 1. Map Representative
        if (req.body.representativeName || req.body.representativePosition) {
            updateData.representative = {
                name: req.body.representativeName || '',
                position: req.body.representativePosition || '',
                email: req.body.officialEmail || '',
                phone: req.body.phone || ''
            };
        }

        // 2. Map Focal Person
        updateData.focalPerson = {
            name: req.body.focalName || '',
            email: req.body.focalEmail || '',
            phone: req.body.focalPhone || ''
        };

        // 3. Map Intake Capacity
        if (req.body.intakeCapacity) {
            updateData.intakeCapacities = [{
                department: "General",
                capacity: Number(req.body.intakeCapacity) || 0
            }];
        }

        // 4. Handle Business License URL and Status
        const existingProfile = await CompanyProfile.findOne({ user: req.user.id }).lean();
        
        // Construct the verification object carefully
        updateData.verification = {
            ...(existingProfile?.verification || {}),
            status: (existingProfile?.verification?.status === 'Verified') ? 'Verified' : 'Pending'
        };

        if (req.files && req.files.businessLicense) {
            updateData.verification.businessLicenseUrl = `/uploads/licenses/${req.files.businessLicense[0].filename}`;
            updateData.verification.status = 'Pending';
        } else if (req.body.businessLicenseUrl) {
            updateData.verification.businessLicenseUrl = req.body.businessLicenseUrl;
        }

        // 5. Clean up flat fields to avoid DB pollution
        const fieldsToDelete = [
            'representativeName', 'representativePosition', 
            'focalName', 'focalEmail', 'focalPhone', 
            'intakeCapacity', 'businessLicenseUrl', 'registrationDocUrl'
        ];
        fieldsToDelete.forEach(f => delete updateData[f]);

        // 6. Handle arrays
        ['targetDepartments', 'internshipFacilities', 'branches', 'requiredSkills'].forEach(field => {
            if (typeof updateData[field] === 'string') {
                updateData[field] = updateData[field].split(',').filter(Boolean);
            }
        });

        // For completeness calculation
        const completenessData = {
            ...updateData,
            logo: updateData.logo || existingProfile?.logo,
            coverImage: updateData.coverImage || existingProfile?.coverImage
        };

        const completeness = calculateCompleteness(completenessData);
        updateData.profileCompleteness = completeness;
        updateData.updatedAt = Date.now();

        console.log('Updating with:', Object.keys(updateData));

        let profile = await CompanyProfile.findOneAndUpdate(
            { user: req.user.id },
            { $set: updateData },
            { returnDocument: 'after', upsert: true }
        );

        const updateFields = {};
        if (updateData.companyName) {
            updateFields.fullName = String(updateData.companyName).trim();
            updateFields.name = String(updateData.companyName).trim();
        }
        if (updateData.logo) {
            updateData.logoUrl = updateData.logo;
            updateFields.profileImage = updateData.logo;
        }

        if (Object.keys(updateFields).length > 0) {
            await User.findByIdAndUpdate(req.user.id, updateFields);
        }

        res.json(profile);
    } catch (err) { 
        console.error('Update Error:', err);
        res.status(500).send(err.message || "Sync failed."); 
    }
});

// 3. Public View (for Students)
router.get('/:id', async (req, res) => {
    try {
        const profile = await CompanyProfile.findById(req.params.id)
            .select('-digitalSignature.cipherText -digitalSignature.iv -digitalSignature.tag');
        res.json(profile);
    } catch (err) { res.status(500).send("Error fetching public profile."); }
});

module.exports = router;
