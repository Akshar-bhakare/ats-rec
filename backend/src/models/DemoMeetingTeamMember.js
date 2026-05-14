import mongoose from 'mongoose';

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeStringList = (values) => {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(
        list
            .map((value) => String(value || '').trim().toLowerCase())
            .filter(Boolean)
    )];
};

const DemoMeetingTeamMemberSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        set: normalizeEmail,
    },
    role: {
        type: String,
        trim: true,
        default: '',
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    byPassFairness: {
        type: Boolean,
        default: false,
    },
    priority: {
        type: Number,
        default: 100,
        min: 0,
    },
    supportedMeetingTypes: {
        type: [String],
        default: [],
        set: normalizeStringList,
    },
    maxMeetingsPerDay: {
        type: Number,
        default: null,
        min: 1,
    },
    lastAssignedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

DemoMeetingTeamMemberSchema.index({ isActive: 1, role: 1, supportedMeetingTypes: 1, priority: 1 });
DemoMeetingTeamMemberSchema.index(
    { byPassFairness: 1 },
    {
        unique: true,
        partialFilterExpression: {
            byPassFairness: true,
        },
    }
);

export default DemoMeetingTeamMemberSchema;
