const mongoose = require('mongoose');

const UserPreferencesSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        unique: true
    },
    
    // Chat bubble styling preferences
    chatBubble: {
        sentMessage: {
            backgroundColor: { type: String, default: '#2563eb' }, // Blue-600
            textColor: { type: String, default: '#ffffff' },
            borderRadius: { type: String, default: '18px' },
            padding: { type: String, default: '10px 16px' }
        },
        receivedMessage: {
            backgroundColor: { type: String, default: '#f0f2f5' }, // Gray-50
            textColor: { type: String, default: '#1e293b' }, // Slate-800
            borderRadius: { type: String, default: '18px' },
            padding: { type: String, default: '10px 16px' }
        }
    },
    
    // Message display preferences
    messageDisplay: {
        showTimestamps: { type: Boolean, default: true },
        showReadReceipts: { type: Boolean, default: true },
        showSenderInfo: { type: Boolean, default: true },
        compactMode: { type: Boolean, default: false },
        fontSize: { type: String, enum: ['small', 'medium', 'large'], default: 'medium' }
    },
    
    // Notification preferences
    notifications: {
        messageSound: { type: Boolean, default: true },
        messagePreview: { type: Boolean, default: true },
        onlineStatus: { type: Boolean, default: true },
        emailAlerts: { type: Boolean, default: true },
        statusUpdates: { type: Boolean, default: true }
    },
    
    // Theme preferences
    theme: {
        mode: { type: String, enum: ['light', 'dark', 'auto'], default: 'light' },
        accentColor: { type: String, default: '#2563eb' }
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for computed styles
UserPreferencesSchema.virtual('computedStyles').get(function() {
    return {
        sentBubble: {
            backgroundColor: this.chatBubble.sentMessage.backgroundColor,
            color: this.chatBubble.sentMessage.textColor,
            borderRadius: this.chatBubble.sentMessage.borderRadius,
            padding: this.chatBubble.sentMessage.padding,
            fontSize: this.getMessageFontSize()
        },
        receivedBubble: {
            backgroundColor: this.chatBubble.receivedMessage.backgroundColor,
            color: this.chatBubble.receivedMessage.textColor,
            borderRadius: this.chatBubble.receivedMessage.borderRadius,
            padding: this.chatBubble.receivedMessage.padding,
            fontSize: this.getMessageFontSize()
        }
    };
});

// Method to get font size in pixels
UserPreferencesSchema.methods.getMessageFontSize = function() {
    const fontSizes = {
        small: '14px',
        medium: '16px',
        large: '18px'
    };
    return fontSizes[this.messageDisplay.fontSize] || fontSizes.medium;
};

// Static method to get or create preferences
UserPreferencesSchema.statics.getOrCreate = async function(userId) {
    let preferences = await this.findOne({ userId });
    if (!preferences) {
        preferences = await this.create({ userId });
    }
    return preferences;
};

module.exports = mongoose.model('UserPreferences', UserPreferencesSchema);
