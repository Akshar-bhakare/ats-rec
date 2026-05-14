import mongoose from 'mongoose';

const { Schema } = mongoose;

const ChatFileSchema = new Schema(
    {
        name: { type: String },
        size: { type: Number },
        mimeType: { type: String },
    },
    { _id: false }
);

const ChatMessageSchema = new Schema(
    {
        messageId: { type: String }, // client-generated ID for deduplication
        kind: { type: String, enum: ['text', 'file'], required: true },
        text: { type: String },
        senderName: { type: String },
        senderRole: { type: String, enum: ['interviewer', 'candidate'] },
        file: { type: ChatFileSchema, default: undefined },
        sentAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const InterviewChatSchema = new Schema(
    {
        interviewScheduleId: {
            type: mongoose.Types.ObjectId,
            ref: 'InterviewSchedule',
            required: true,
            index: true,
        },
        candidateId: {
            type: mongoose.Types.ObjectId,
            ref: 'Candidate',
        },
        jobId: {
            type: mongoose.Types.ObjectId,
            ref: 'Job',
        },
        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
        },
        interviewType: { type: String },
        interviewerType: { type: String },
        messages: [ChatMessageSchema],
    },
    { timestamps: true }
);

InterviewChatSchema.index({ client: 1, interviewScheduleId: 1 });

export default InterviewChatSchema;
