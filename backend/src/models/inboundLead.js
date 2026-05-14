import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * InboundLead — created when an UNKNOWN caller rings an inbound number.
 *  The AI conducts a short collection interview using the InboundCallScript
 * questions and stores the answers here for recruiter review.
 *
 * status flow: 'New' → 'Reviewed' → 'Converted' (when recruiter creates a real Candidate)
 */
const InboundLeadSchema = new Schema(
    {
        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            required: true,
        },

        // Caller's phone (from number, E.164)
        phone: { type: String, required: true, index: true },

        // Our Telnyx/Plivo number that received the call
        calledNumber: { type: String, default: null },

        // Provider-side call identifier (Telnyx callControlId / Plivo CallUUID)
        callId: { type: String, index: true },

        // ── Collected answers ──────────────────────────────────────────────────

        // Answer to jobQuestion: "Which job position are you calling about?"
        jobInterest: { type: String, default: null },

        // Answer to companyQuestion: "Which company are you currently working for?"
        currentCompany: { type: String, default: null },

        // Answers to each basicQuestion (array preserves order)
        basicAnswers: [{ type: String }],

        // Answer to skillsPrompt: open-ended skills + experience
        skillsAnswer: { type: String, default: null },

        // ── Matching ──────────────────────────────────────────────────────────

        // If the AI matched a job from jobInterest, store the reference
        matchedJob: {
            type: mongoose.Types.ObjectId,
            ref: 'Job',
            default: null,
        },

        // Linked conversation (if a full AI session was run)
        conversation: {
            type: mongoose.Types.ObjectId,
            ref: 'Conversation',
            default: null,
        },

        // Raw call date (set on creation — createdAt also works, but explicit is clearer)
        callDate: { type: Date, default: Date.now },

        // Tracks whether this unknown inbound lead collection was billed as an AI credit entry
        countedTowardsCredits: { type: Boolean, default: false, index: true },
        creditCountedAt: { type: Date, default: null },
        creditEntryType: {
            type: String,
            default: 'inbound_unknown_lead_collection',
        },

        // Recruiter review status
        status: {
            type: String,
            enum: ['New', 'Reviewed', 'Converted'],
            default: 'New',
        },

        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

InboundLeadSchema.index(
    { client: 1, callId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            callId: { $exists: true, $type: 'string' },
        },
    }
);

export default InboundLeadSchema;
