import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

/**
 * RelevancyRecord
 * One document per (candidate, job, client) combo.
 */
const RelevancyRecordSchema = new Schema(
    {
        client: {
            type: Types.ObjectId,
            ref: 'User',
            index: true,
            default: null
        },

        candidate: {
            type: Types.ObjectId,
            ref: 'Candidate',
            required: true,
            index: true
        },

        job: {
            type: Types.ObjectId,
            ref: 'Job',
            required: true,
            index: true
        },

        // Overall “directional” relevancy
        candidateRelevancyToJob: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        jobRelevancyToCandidate: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        // Sub-dimensions
        experienceRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        skillsRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        responsibilitiesRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        designationRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        communicationRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        // ★ NEW: conversation-based sub-scores
        salaryRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        noticePeriodRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        interestRelevancy: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },

        reason: {
            type: String,
            trim: true,
            default: ''
        },

        isArchived: {
            type: Boolean,
            default: false
        },

        eventIds: [
            {
                type: Types.ObjectId,
                ref: 'Event'
            }
        ]
    },
    { timestamps: true }
);

// Enforce uniqueness per client + candidate + job
RelevancyRecordSchema.index(
    { client: 1, candidate: 1, job: 1 },
    { unique: true }
);

export default RelevancyRecordSchema;
