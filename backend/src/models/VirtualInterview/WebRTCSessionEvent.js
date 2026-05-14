import mongoose from "mongoose";

const { Schema, Types } = mongoose;

const WebRTCSessionEventSchema = new Schema(
    {
        client: { type: Types.ObjectId, ref: "User", required: true },
        roomId: { type: String, trim: true, index: true, required: true },
        interviewScheduleId: { type: Types.ObjectId, ref: "InterviewSchedule", default: null },
        candidate: { type: Types.ObjectId, ref: "Candidate", default: null },
        job: { type: Types.ObjectId, ref: "Job", default: null },
        peerId: { type: String, trim: true, default: null },
        eventType: { type: String, trim: true, required: true },
        details: { type: Schema.Types.Mixed, default: null },
        ip: { type: String, trim: true, default: null },
        userAgent: { type: String, trim: true, default: null }
    },
    { timestamps: true }
);

WebRTCSessionEventSchema.index({ client: 1, roomId: 1, createdAt: -1 });
WebRTCSessionEventSchema.index({ client: 1, candidate: 1, job: 1, createdAt: -1 });

export default WebRTCSessionEventSchema;
