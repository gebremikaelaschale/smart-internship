const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true, default: '' },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: null },
    role: {
        type: String,
        enum: ['student', 'employer', 'admin', 'super_admin', 'dean', 'hod', 'Student', 'Industry Partner', 'SuperAdmin', 'CollegeAdmin', 'DeptAdmin'],
        default: 'employer'
    },
    isFirstLogin: { type: Boolean, default: true },
    phone: { type: String },
    profileImage: { type: String, default: '' },
    studentIdNumber: { type: String, default: '' },
    idNumber: { type: String, default: '' },
    id_number: { type: String, default: '' },
    bio: { type: String, default: '' },
    studentSignatureUrl: { type: String, default: '' },
    studentSignature: { type: String, default: '' },
    student_signature: { type: String, default: '' },
    signatureData: { type: String, default: '' },
    signature_data: { type: String, default: '' },
    jobTitle: { type: String, default: '' },
    college: { type: String }, 
    department: { type: String },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: 'College', default: null },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    isVerified: { type: Boolean, default: false },
    verificationStatus: {
        type: String,
        enum: ['Not Submitted', 'Submitted', 'Pending', 'Verified', 'Rejected'],
        default: 'Not Submitted'
    },
    verificationRequestedAt: { type: Date, default: null },
    verificationReviewedAt: { type: Date, default: null },
    verificationReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verificationNote: { type: String, default: '' },
    rejectionReason: { type: String, default: '' },
    rejection_reason: { type: String, default: '' },
    adminType: { type: String, default: '' },
    lastLoginAt: { type: Date, default: null },
    
    // Account Management
    status: { type: String, enum: ['Pending', 'Active', 'VERIFIED', 'PLACED', 'Not Submitted', 'Rejected'], default: 'Active' },
    accountStatus: { type: String, enum: ['Active', 'Deactivated'], default: 'Active' },
    language: { type: String, default: 'English' },
    timezone: { type: String, default: 'GMT+3 (East Africa Time)' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
    
    // Notification Matrix
    notificationSettings: {
        channels: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: false },
            inApp: { type: Boolean, default: true }
        },
        events: {
            newApplication: { type: Boolean, default: true },
            internshipUpdates: { type: Boolean, default: true },
            messages: { type: Boolean, default: true },
            systemAlerts: { type: Boolean, default: false }
        },
        frequency: { 
            type: String, 
            enum: ['Instant', 'Daily Summary', 'Weekly Summary'], 
            default: 'Instant' 
        }
    },
    
    // Privacy & Data Governance
    privacySettings: {
        profileVisibility: { type: String, enum: ['Public', 'Private'], default: 'Public' },
        showContactInfo: { type: Boolean, default: true },
        dataSharing: { type: Boolean, default: false }
    },
    
    // Advanced Integrations
    integrations: {
        linkedin: { type: String, default: '' },
        github: { type: String, default: '' },
        apiKey: { type: String, default: () => Math.random().toString(36).substring(2, 15) }
    },

    // User Experience Preferences
    uxPreferences: {
        theme: { type: String, enum: ['Light', 'Dark'], default: 'Light' },
        layout: { type: String, enum: ['Default', 'Compact'], default: 'Default' },
        landingPage: { type: String, default: '/employer-dashboard/overview' }
    },

    // Enterprise Security Matrix
    securitySettings: {
        twoFactor: { type: Boolean, default: false },
        backupEmail: { type: String, default: '' },
        securityQuestion: { type: String, default: '' },
        securityAnswer: { type: String, default: '' }
    },
    
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Number },
    badges: [
        { title: String, date: { type: Date, default: Date.now }, icon: String }
    ],
    skillAnalytics: {
        type: Map,
        of: Number,
        default: {}
    },
    savedInternships: [
        { type: mongoose.Schema.Types.ObjectId, ref: 'Internship' }
    ],
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: false
});

userSchema.pre('validate', function () {
    if (!this.name && this.fullName) {
        this.name = this.fullName;
    }

    if (!this.fullName && this.name) {
        this.fullName = this.name;
    }

    if (this.email) {
        this.email = this.email.toLowerCase().trim();
    }

    if (typeof this.studentIdNumber !== 'undefined') {
        const normalizedId = String(this.studentIdNumber || this.idNumber || this.id_number || '').trim();
        this.studentIdNumber = normalizedId;
        this.idNumber = normalizedId;
        this.id_number = normalizedId;
    }

    if (typeof this.bio !== 'undefined') {
        this.bio = String(this.bio || '').trim();
    }

    if (typeof this.signatureData !== 'undefined' || typeof this.signature_data !== 'undefined') {
        const normalizedSignatureData = String(this.signatureData || this.signature_data || '').trim();
        this.signatureData = normalizedSignatureData;
        this.signature_data = normalizedSignatureData;
    }
});

userSchema.virtual('displayName').get(function () {
    return this.name || this.fullName;
});

module.exports = mongoose.model('User', userSchema);