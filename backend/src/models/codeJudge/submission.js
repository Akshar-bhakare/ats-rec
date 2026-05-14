import mongoose from 'mongoose';

const SubmissionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },

    problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem',
        index: true
    },

    interviewId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
        index: true
    },

    language: {
        type: Number, // Judge0 ID
        required: true
    },

    sourceCode: { type: String, required: true },

    attemptNumber: { type: Number, required: true },


    // Judge0 async handling
    judge0: {
        batchTokens: [{ type: String, index: true }],
        totalTests: Number,
        completedTests: { type: Number, default: 0 }
    },
    webhookReceived: { type: Boolean, default: false },

    //Verdict normalization
    status: {
        type: String,
        enum: [
            'queued',
            'running',
            'accepted',
            'wrong_answer',
            'time_limit_exceeded',
            'memory_limit_exceeded',
            'runtime_error',
            'compilation_error'
        ],
        default: 'queued'
    },

    executionTime: Number, // ms
    memoryUsed: Number,    // KB

    stdout: String,
    stderr: String,
    compilerOutput: String,

    // Interview analytics
    passedTestCases: Number,
    totalTestCases: Number,

    // Plagiarism detection
    plagiarismHash: String,

    // Meta for recruiters
    score: Number,
    isFinalSubmission: { type: Boolean, default: false },
}, { timestamps: true });

export default SubmissionSchema;
