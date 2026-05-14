import mongoose from 'mongoose';

const { Schema } = mongoose;

/**
 * Stores per-interviewer customizable feedback parameter templates.
 * When an interviewer clicks "Set for Future Use", their skill list is saved here
 * and pre-populated in all future feedback forms.
 */
const InterviewerPreferenceSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true },
        client: { type: Schema.Types.ObjectId, required: true },
        feedbackParameters: [{ type: String }], // ordered list of skill names
    },
    { timestamps: true }
);

InterviewerPreferenceSchema.index({ userId: 1, client: 1 }, { unique: true });

export default InterviewerPreferenceSchema;
