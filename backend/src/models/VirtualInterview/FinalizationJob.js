import mongoose from 'mongoose';

const { Schema } = mongoose;

const FinalizationJobSchema = new Schema(
    {
        recordingId: {
            type: Schema.Types.ObjectId,
            ref: 'InterviewSchedule',
            required: true,
            unique: true,
        },
        clientKey: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'claimed', 'processing', 'completed', 'failed', 'retry_wait'],
            default: 'pending',
        },
        attemptCount: { type: Number, default: 0 },
        maxAttempts: {
            type: Number,
            default: () => parseInt(process.env.FINALIZER_MAX_ATTEMPTS || '3', 10),
        },
        claimedBy: { type: String, default: null },
        claimedAt: { type: Date, default: null },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        nextRetryAt: { type: Date, default: null },
        lastError: { type: String, default: null },
    },
    { timestamps: true }
);

// Used by the polling query: find eligible jobs
FinalizationJobSchema.index({ status: 1, nextRetryAt: 1 });

export default FinalizationJobSchema;
