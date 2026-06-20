const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    
    // 1. Basic Info (Extended)
    companyName: { type: String, required: true },
    logo: { type: String },
    logoUrl: { type: String },
    coverImage: { type: String },
    description: { type: String },
    industryType: { type: String },
    companySize: { type: String, enum: ['1-10', '10-50', '50+'] },
    foundedYear: { type: Number },
    
    // 2. Contact & Location
    hqLocation: { type: String },
    branches: [String],
    website: { type: String },
    officialEmail: { type: String },
    phone: { type: String },
    
    // 3. Company Representative
    representative: {
        name: String,
        position: String,
        email: String,
        phone: String
    },
    
    // 4. Verification System
    verification: {
        businessLicenseUrl: String,
        registrationDocUrl: String,
        status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
        reason: String
    },
    
    // 8. Media / Gallery
    gallery: [String],
    
    // 9. Skills They Look For
    requiredSkills: [String],
    preferredTech: [String],
    
    // 10. Targeting & Facilities
    targetDepartments: [String],
    internshipFacilities: [String],
    
    // 10.1 AI Matching & Placement Preferences
    intakeCapacities: [{ 
        department: String, 
        capacity: Number 
    }],
    internshipPeriod: String, // e.g., "Summer", "All-year"
    internshipDuration: String, // e.g., "2 Months", "4 Months"
    minimumCgpa: Number, // Optional constraint
    expectedTasks: String, // Brief description of what students will do
    focalPerson: { // Person responsible for handling interns directly
        name: String,
        email: String,
        phone: String
    },
    
    // 11. Company Tags
    tags: [String],
    
    // 13. Profile Completeness
    profileCompleteness: { type: Number, default: 0 },
    
    // 14. Smart Indicators
    responseRate: { type: String, default: "Responds within 24 hours" },
    isActive: { type: Boolean, default: true },

    // 15. Digital Identity Assets (signature is encrypted at rest)
    digitalSignature: {
        cipherText: { type: String, default: '' },
        iv: { type: String, default: '' },
        tag: { type: String, default: '' },
        mimeType: { type: String, default: 'image/png' },
        updatedAt: { type: Date, default: null }
    },
    
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);