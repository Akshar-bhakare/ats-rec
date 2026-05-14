import mongoose from "mongoose";

export const WhatsAppMessageSchema = new mongoose.Schema({
    waId: { type: String, index: true, required: true }, // user’s WhatsApp number
    systemId: { type: String, index: true, required: true }, // our system’s WhatsApp number
    direction: { type: String, enum: ["outbound", "inbound"], required: true },
    message: { type: String, required: true },
    sentByService: { type: String, index: true, required: true, enum: ["Ai Selekt Auto Reply", "WhatsApp API", "AI Screening Call", "AI Interview"] },
    messageId: { type: String },
    nextActionExpected: { type: String },
    waTimestamp: { type: Date, default: Date.now },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },
}, { timestamps: true });
