import mongoose from 'mongoose';

const SubmissionResultSchema = new mongoose.Schema({
    submissionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Submission',
        index: true
    },

    testCaseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TestCase'
    },

    status: {
        type: String,
        enum: [
            'passed',
            'failed',
            'time_limit_exceeded',
            'runtime_error'
        ]
    },

    executionTime: Number,
    memoryUsed: Number,

    output: String
});

export default SubmissionResultSchema;
