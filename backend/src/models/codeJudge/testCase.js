import mongoose from 'mongoose';

const TestCaseSchema = new mongoose.Schema({
    problemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Problem',
        index: true
    },

    // === Legacy fields (kept for safety, not used in new flow) ===
    input: { type: String },
    expectedOutput: { type: String },

    // === JSON Harness System ===
    // Structured test case data
    args: { type: mongoose.Schema.Types.Mixed },      // Array of arguments: [["api","db"], ["api"]]
    expected: { type: mongoose.Schema.Types.Mixed },  // Expected return value: [0, -1]

    isSample: { type: Boolean, default: false }, // visible to candidate
    weight: { type: Number, default: 1 },        // scoring later
    order: Number
});

export default TestCaseSchema;
