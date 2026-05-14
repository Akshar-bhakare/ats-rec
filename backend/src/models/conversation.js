import mongoose from 'mongoose';
import { modelExistsOnSameConn } from '../utils/dbUtils.js';

const { Schema } = mongoose;

const MessageSchema = new Schema(
    {
        role: {
            type: String,
            required: true,
            enum: ['system', 'assistant', 'user', 'ai', 'candidate'],
        },
        content: { type: Schema.Types.Mixed, required: true },
        time: { type: Date, default: Date.now },
    },
    { _id: false },
);

// Clean post-call transcript (system messages filtered out)
const TranscriptTurnSchema = new Schema(
    {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        text: { type: String, required: true },
        timeSeconds: { type: Number },   // seconds from call start
        language: { type: String },      // detected language code (e.g. 'en', 'hi')
    },
    { _id: false },
);

const ConversationSchema = new Schema(
    {
        callUUID: { type: String, index: true },

        jobId: {
            type: mongoose.Types.ObjectId,
            ref: 'Job',
            validate: { validator: (id) => modelExistsOnSameConn(this, id) },
        },

        candidateId: {
            type: mongoose.Types.ObjectId,
            ref: 'Candidate',
            validate: {
                validator: (id) => modelExistsOnSameConn(this, id, 'Candidate'),
            },
        },

        /**
         * NEW: Partitioning dimensions so that the same candidate+job can have
         * multiple distinct conversations:
         *  - interviewType (Technical / HR / Psychometric / Non-Technical)
         *  - interviewerType (AI / Human / Human+AI)
         *  - interviewScheduleId (specific interview instance)
         */
        interviewType: {
            type: String,
            enum: ['Technical', 'HR', 'Psychometric', 'Non-Technical'],
            default: 'Technical',
            index: true,
        },

        interviewerType: {
            type: String,
            enum: ['AI', 'Human', 'Human+AI'],
            default: 'AI',
            index: true,
        },

        interviewScheduleId: {
            type: mongoose.Types.ObjectId,
            ref: 'InterviewSchedule',
        },

        mobile_num: { type: String },
        calledNumber: { type: String },  // our Telnyx/Plivo number that received the call
        direction: { type: String, enum: ['inbound', 'outbound'], default: 'outbound' },

        // Tracks WHY the call was made / received, so callback calls can pick up the right context
        // 'screening'        – outbound AI screening call
        // 'reminder'         – outbound interview-reminder call (30-min pre-interview)
        // 'inbound_screening' – candidate called back after a missed screening call
        // 'inbound_reminder'  – candidate called back after a missed reminder call
        callType: {
            type: String,
            enum: ['screening', 'reminder', 'inbound_screening', 'inbound_reminder'],
            default: 'screening',
            index: true,
        },
        audio_url: { type: String },

        // full WebRTC recording (video+audio) saved in /api/ai/saveRecording
        video_url: { type: String },

        durationSeconds: { type: Number, default: 0 },
        messages: [MessageSchema],
        transcript: [TranscriptTurnSchema],

        whatsappConvId: {
            type: mongoose.Types.ObjectId,
            ref: "Conversation",
        },

        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
        },

        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

// Legacy index
ConversationSchema.index({ jobId: 1, candidateId: 1 });

// NEW: Stronger composite index aligned with how we now partition conversations
ConversationSchema.index({
    client: 1,
    candidateId: 1,
    jobId: 1,
    interviewType: 1,
    interviewerType: 1,
});

// Inbound callback context lookup: find most recent outbound call for a candidate quickly.
ConversationSchema.index({ candidateId: 1, direction: 1, createdAt: -1 });

// Guard against duplicate call rows for the same candidate+job+callUUID.
ConversationSchema.index(
    { client: 1, candidateId: 1, jobId: 1, callUUID: 1 },
    {
        unique: true,
        partialFilterExpression: {
            callUUID: { $exists: true, $type: 'string', $ne: '' },
        },
    }
);

export default ConversationSchema;
