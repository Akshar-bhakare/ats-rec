import mongoose from 'mongoose';

const NotificationPreferenceSchema = new mongoose.Schema(
    {
        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            unique: true
        },
        channels: {
            email: { type: Boolean, default: true },
            inApp: { type: Boolean, default: true },
            whatsapp: { type: Boolean, default: true }
        },
        hiringActivity: {
            newCandidate: { type: Boolean, default: true },
            candidateStageUpdated: { type: Boolean, default: true },
            interviewScheduled: { type: Boolean, default: true },
            interviewFeedbackSubmitted: { type: Boolean, default: true },
            candidateArchived: { type: Boolean, default: true }
        },
        systemAccount: {
            billingInvoiceUpdates: { type: Boolean, default: true },
            subscriptionChanges: { type: Boolean, default: true }
        }
    },
    { timestamps: true }
);

export default NotificationPreferenceSchema;
