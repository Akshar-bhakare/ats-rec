import mongoose from 'mongoose';

const ACTIVE_SLOT_STATUSES = ['pending_provider', 'scheduled'];

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeEmailList = (values) => {
    const list = Array.isArray(values) ? values : [values];
    return [...new Set(
        list
            .map((value) => normalizeEmail(value))
            .filter(Boolean)
    )];
};

const DemoScheduledMeetingSchema = new mongoose.Schema({
    idempotencyKey: {
        type: String,
        required: true,
        trim: true,
        unique: true,
    },
    demoLeadId: {
        type: mongoose.Types.ObjectId,
        ref: 'DemoLeads',
        default: null,
    },
    candidateName: {
        type: String,
        required: true,
        trim: true,
    },
    candidateEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        set: normalizeEmail,
    },
    assignedMemberName: {
        type: String,
        trim: true,
        default: '',
    },
    assignedMemberEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
        set: (value) => value == null ? null : normalizeEmail(value),
    },
    organizerEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: null,
        set: (value) => value == null ? null : normalizeEmail(value),
    },
    attendeeEmails: {
        type: [String],
        default: [],
        set: normalizeEmailList,
    },
    meetingType: {
        type: String,
        required: true,
        trim: true,
    },
    requestedRole: {
        type: String,
        trim: true,
        default: '',
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: {
        type: Date,
        required: true,
    },
    timezone: {
        type: String,
        required: true,
        trim: true,
    },
    graphEventId: {
        type: String,
        trim: true,
        default: null,
    },
    changeKey: {
        type: String,
        trim: true,
        default: null,
    },
    providerRequestId: {
        type: String,
        trim: true,
        default: null,
    },
    joinUrl: {
        type: String,
        trim: true,
        default: null,
    },
    provider: {
        type: String,
        required: true,
        default: 'microsoft_graph',
        enum: ['microsoft_graph'],
    },
    status: {
        type: String,
        required: true,
        default: 'scheduling',
        enum: ['scheduling', 'pending_provider', 'scheduled', 'provider_failed', 'cancelled'],
    },
    rawProviderResponse: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    providerError: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    slotClaimedAt: {
        type: Date,
        default: null,
    },
    scheduledAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

DemoScheduledMeetingSchema.index(
    { assignedMemberEmail: 1, startTime: 1, endTime: 1 },
    {
        unique: true,
        partialFilterExpression: {
            status: { $in: ACTIVE_SLOT_STATUSES },
            assignedMemberEmail: { $type: 'string' },
        },
    }
);
DemoScheduledMeetingSchema.index({ status: 1, startTime: 1, assignedMemberEmail: 1 });

export default DemoScheduledMeetingSchema;
