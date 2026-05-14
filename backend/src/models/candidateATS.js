import mongoose from 'mongoose';
import CRUDService from '../services/crudBase.js';
const { Schema, Types } = mongoose;

export const StageResultSchema = mongoose.Schema({

    stage: {
        type: mongoose.Types.ObjectId,
        ref: 'Stage',
        required: true
    },

    stageStatus: {
        type: String,
        trim: true,
        enum: ['Not Initiated', 'Selected', 'Rejected', 'On Hold', 'Completed', 'Not Applicable'],
        default: 'Not Initiated',
        required: true
    },

    remarkOrFeedback: {
        type: String,
        trim: true,
    },

    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },

    isArchived: {
        type: Boolean,
        default: false
    },

    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }]
});



StageResultSchema.statics.findOrCreate = async function (stage, stageStatus, remarkOrFeedback, req) {
    const svcStageResult = new CRUDService('StageResult');
    let stgRes = await req.conn.models['StageResult'].findOne(
        { stage, stageStatus, remarkOrFeedback, client: req.client },
    ).lean().exec();

    if (!stgRes) {
        stgRes = await svcStageResult.create({ stage, stageStatus, remarkOrFeedback, client: req.client }, req);
    }

    return stgRes;
};


const scheduleSchema = mongoose.Schema({
    scheduleTime: { type: Date, required: true },
    scheduleStatus: { type: String, required: true, enum: ['Scheduled', 'Running', 'Blocked', 'Rescheduled', 'Executed', "Errored"], default: 'Scheduled' },
    errorDetails: { type: Object },
}, {
    _id: false
});


const CandidateATSSchema = mongoose.Schema({
    title: {
        type: String,
        trim: true,
        required: true,
    },
    candidate: {
        type: mongoose.Types.ObjectId,
        ref: 'Candidate',
        required: true
    },
    job: {
        type: mongoose.Types.ObjectId,
        ref: 'Job',
        required: true
    },

    experience: { type: Schema.Types.Mixed, default: null },
    currentCtc: { type: String, default: null },
    expectedCtc: { type: String, default: null },
    noticePeriod: { type: String, default: null },

    currentCompany: { type: String, trim: true, default: null },
    anyOffer: { type: Boolean, default: false },
    location: { type: String, trim: true, default: null },
    interested: { type: String, default: '' },
    communication: { type: String, default: null },
    extraQuestionAnswer: { type: String, default: null },
    aiCallStatus: { type: String, trim: true, default: 'pending' },
    aiCallHangUpCause: { type: String, trim: true },
    aiCallHangUpSource: { type: String, trim: true },
    resumeUrl: { type: String, trim: true, default: null },
    callAudioUrl: { type: String, trim: true, default: null },
    callAudioDuration: { type: String, trim: true, default: null },
    transcript: { type: String, default: null },
    scheduleTimes: {
        type: [scheduleSchema],
        required: false,
        default: []
    },

    stageResults: {
        type: [{
            type: mongoose.Types.ObjectId,
            ref: 'StageResult'
        }],
        required: true,
        validate: {
            validator: arr => Array.isArray(arr) && arr.length > 0,
            message: 'At least one Staging Result is required'
        }
    },

    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        required: true
    },

    isArchived: {
        type: Boolean,
        default: false
    },

    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }]

}, { timestamps: true });

CandidateATSSchema.set('toJSON', {
    transform: (_doc, ret) => {
        if (ret.scheduleTime instanceof Date) {
            ret.scheduleTime = ret.scheduleTime.toISOString();
        }
        return ret;
    }
});


export default CandidateATSSchema;
