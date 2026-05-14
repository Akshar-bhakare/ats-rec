import mongoose from 'mongoose';

const ProblemSchema = new mongoose.Schema({
    title: { type: String, required: true },

    description: { type: String, required: true }, // markdown
    difficulty: {
        type: String,
        enum: ['easy', 'medium', 'hard']
    },
    constraints: String,

    timeLimit: Number,   // ms
    memoryLimit: Number, // KB

    allowedLanguages: [{
        type: Number
    }],

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    interviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'InterviewSchedule',
        required: true, // every problem belongs to one interview
        index: true
    },

    isActive: { type: Boolean, default: true },

    // === JSON Harness System ===
    // Function signature for deterministic harness generation
    signature: {
        className: { type: String, default: "Solution" },
        functionName: { type: String },  // e.g., "firstIndexQueries"
        params: { type: mongoose.Schema.Types.Mixed },  // Array of {name, type} objects
        returnType: { type: String },    // e.g., "int[]", "string"
        classBased: { type: Boolean, default: true }
    }
}, { timestamps: true });

export default ProblemSchema;
