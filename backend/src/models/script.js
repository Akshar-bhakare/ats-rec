import mongoose from 'mongoose';
import { modelExistsOnSameConn } from '../utils/dbUtils.js';
const { Schema } = mongoose;



const ScriptSchema = new Schema(
    {
        jobId: {
            type: mongoose.Types.ObjectId,
            ref: 'Job',
            index: true,
            required: true,
            validate: {
                validator(id) {
                    return modelExistsOnSameConn(this, id);
                },
                message: 'Referenced Job does not exist',
            },
        },
        scriptName: { type: String, required: true },
        scriptType: {
            type: String,
            required: true,
            enum: ['aicall', 'email', 'sms'],
        },
        extraQuestion: String,
        content: { type: String, required: true },
        language: { type: String, required: true },
        gender: {
            type: String,
            required: true,
            enum: ['MALE', 'FEMALE', 'NEUTRAL'],
        },
        voiceModel: { type: String, required: true },
        openaiVoice: { type: String },
        openaiInstructions: { type: String },

        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        isArchived: { type: Boolean, default: false },

        eventIds: [{ type: mongoose.Types.ObjectId, ref: 'Event' }],
    },
    { timestamps: true }
);

export default ScriptSchema;
