const mongoose = require('mongoose');

const companyProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    
    // 1. Basic Info (Extended)
    companyName: { type: String, required: true },
    logo: { type: String },
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
        status: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' }
    },
    
    // 8. Media / Gallery
    gallery: [String],
    
    // 9. Skills They Look For
    requiredSkills: [String],
    preferredTech: [String],
    
    // 10. Company Tags
    tags: [String],
    
    // 13. Profile Completeness
    profileCompleteness: { type: Number, default: 0 },
    
    // 14. Smart Indicators
    responseRate: { type: String, default: "Responds within 24 hours" },
    isActive: { type: Boolean, default: true },
    
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('CompanyProfile', companyProfileSchema);