import mongoose from "mongoose";



export const DemoLeadsSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true,
        validate: {
            validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format'
        }
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    countryCode: {
        type: String,
        trim: true,
        validate: {
            validator: v => !v || /^\+\d{1,4}$/.test(v),
            message: 'Invalid country code format'
        }
    },
    phoneNumber: {
        type: String,
        trim: true,
        validate: {
            validator: v => !v || /^[0-9]{6,15}$/.test(v),
            message: 'Invalid phone number format'
        }
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    concentToTermsAndConditions: {
        type: Boolean,
        default: true,
    },

    // **New**: map of platform → URL
    socialLinks: {
        type: Map,
        of: String,
        default: {}
    },

    demoOf: {
        type: String,
        required: true,
        index: true,
    },

    verifyEmailOtpHash: { type: String },
    verifyEmailOtpExpiry: { type: Date },
    verifyEmailOtpVerified: { type: Boolean, default: false },
    verifyEmailOtpUsed: { type: Boolean, default: false },


    bolSrhPromptsLimit: {
        type: Number,
        default: 50,
    },
    numOfBolSrhPromptsUsed: {
        type: Number,
        default: 0,
    },


    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }]
}, {
    timestamps: true
});

