import mongoose from "mongoose";



export const BooleanSearchFeedbackSchema = new mongoose.Schema({
    userEmail: {
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
    skillPrompt: {
        type: [String],
        required: true,
    },
    aiResponse: {
        type: String,
        required: true,
        trim: true
    },
    feedbackNum: {
        type: Number,
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

