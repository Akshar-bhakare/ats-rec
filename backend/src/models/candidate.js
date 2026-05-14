import mongoose from 'mongoose';

const SkillSubSchema = new mongoose.Schema({}, { _id: false, strict: false });

const CandidateSchema = new mongoose.Schema({

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
        type: String,
        required: true,
        lowercase: true,
        unique: true,
        trim: true,
        validate: {
            validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format'
        }
    },
    countryCode: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: v => /^\+\d{1,4}$/.test(v),
            message: 'Invalid country code format'
        }
    },
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        validate: {
            validator: v => /^[0-9]{6,15}$/.test(v),
            message: 'Invalid phone number format'
        }
    },
    panCardNumber: {
        type: String,
        trim: true,
        uppercase: true,
        match: [/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'Invalid PAN format (e.g., ABCDE1234F)'],
        default: undefined
    },
    skills: {
        type: [SkillSubSchema],
        default: [],
        validate: {
            validator: arr => Array.isArray(arr) && arr.length > 0,
            message: 'At least one skill is required'
        }
    },
    resumeUrl: { type: String, trim: true, default: null },
    resumeText: { type: String, default: null },
    embedding: {
        type: [Number],
        default: null
    },
    jobs: {
        type: [{ type: mongoose.Types.ObjectId, ref: 'Job' }],
        default: [],
        validate: {
            validator: arr => Array.isArray(arr) && arr.length > 0,
            message: 'At least one job is required'
        }
    },
    applications: {
        type: [{ type: mongoose.Types.ObjectId, ref: 'CandidateATS' }],
        default: [],
        validate: {
            validator: arr => Array.isArray(arr),
            message: "Candidate application(s) must be an array of CandidateATS Id's..."
        }
    },
    sourcePlatform: String,
    sourceExtraInfo: String,
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },
    emailUnsubscribed: {
        type: Boolean,
        default: false
    },
    emailUnsubscribedAt: {
        type: Date,
        default: null
    },
    emailUnsubscribeReason: {
        type: String,
        trim: true,
        default: ''
    },
    emailUnsubscribeSource: {
        type: String,
        trim: true,
        default: ''
    },
    isArchived: { type: Boolean, default: false },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }]
}, { timestamps: true });

export default CandidateSchema;
