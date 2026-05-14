import mongoose from 'mongoose';

const { Schema } = mongoose;

const InboundCallScriptSchema = new Schema(
    {
        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            required: true,
        },

        name: { type: String, default: 'Default Inbound Script' },

        // What the AI says first to a new (unrecognised) caller
        greeting: {
            type: String,
            default: 'Hello! Thank you for calling. I am an AI recruiter. I will ask you a few quick questions.',
        },

        // Core discovery questions
        jobQuestion: {
            type: String,
            default: 'Which job position are you calling about?',
        },
        companyQuestion: {
            type: String,
            default: 'Which company are you currently working for?',
        },

        // Flexible basic questions (current role, experience, etc.)
        basicQuestions: [{ type: String }],

        // Single open-ended prompt asking candidate for their top 3 skills + years of experience
        skillsPrompt: {
            type: String,
            default: 'Please share your top 3 skills and how many years of experience you have in each.',
        },

        // Telnyx / Plivo phone numbers assigned to this client (e.g. ['+15512345678'])
        // Used to identify WHICH client a new inbound call belongs to (by the "to" number)
        numbers: [{ type: String }],

        isActive: { type: Boolean, default: true },
        isArchived: { type: Boolean, default: false },
    },
    { timestamps: true },
);

export default InboundCallScriptSchema;