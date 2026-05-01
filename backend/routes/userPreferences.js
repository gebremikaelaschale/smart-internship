const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');
const UserPreferences = require('../models/UserPreferences');

// Get user preferences
router.get('/', auth, async (req, res) => {
    try {
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to load preferences.' });
    }
});

// Update chat bubble styling
router.put('/chat-bubble', auth, async (req, res) => {
    try {
        const { sentMessage, receivedMessage } = req.body;
        
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        
        if (sentMessage) {
            preferences.chatBubble.sentMessage = {
                ...preferences.chatBubble.sentMessage,
                ...sentMessage
            };
        }
        
        if (receivedMessage) {
            preferences.chatBubble.receivedMessage = {
                ...preferences.chatBubble.receivedMessage,
                ...receivedMessage
            };
        }
        
        await preferences.save();
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update chat bubble preferences.' });
    }
});

// Update message display preferences
router.put('/message-display', auth, async (req, res) => {
    try {
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        preferences.messageDisplay = {
            ...preferences.messageDisplay,
            ...req.body
        };
        await preferences.save();
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update message display preferences.' });
    }
});

// Update theme preferences
router.put('/theme', auth, async (req, res) => {
    try {
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        preferences.theme = {
            ...preferences.theme,
            ...req.body
        };
        await preferences.save();
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update theme preferences.' });
    }
});

// Reset preferences to defaults
router.post('/reset', auth, async (req, res) => {
    try {
        await UserPreferences.deleteOne({ userId: req.user.id });
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to reset preferences.' });
    }
});

// Update notification preferences
router.put('/notifications', auth, async (req, res) => {
    try {
        const preferences = await UserPreferences.getOrCreate(req.user.id);
        preferences.notifications = {
            ...preferences.notifications,
            ...req.body
        };
        await preferences.save();
        res.json(preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update notification preferences.' });
    }
});

// Send Test Email
router.post('/test-email', auth, async (req, res) => {
    try {
        const { sendEmail } = require('../utils/mailer');
        const user = await User.findById(req.user.id);
        
        const sent = await sendEmail({
            to: user.email,
            subject: 'Smart Internship: Test Notification',
            html: `
                <div style="font-family: sans-serif; padding: 20px; color: #333; border: 1px solid #0891b2; border-radius: 20px;">
                    <h2 style="color: #0891b2;">✅ Email System Working!</h2>
                    <p>Hello ${user.name || user.fullName},</p>
                    <p>This is a test email from your <strong>Smart Internship Portal</strong>.</p>
                    <p>If you received this, your email notification system is correctly configured and connected to your account.</p>
                    <p style="font-size: 12px; color: #666; margin-top: 20px;">Timestamp: ${new Date().toLocaleString()}</p>
                </div>
            `
        });

        if (sent) {
            res.json({ message: 'Test email sent successfully! Check your inbox.' });
        } else {
            res.status(500).json({ message: 'Failed to send test email. Check server logs.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Error sending test email.' });
    }
});

module.exports = router;
