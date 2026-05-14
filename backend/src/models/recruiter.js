import mongoose from 'mongoose';

const RecruiterSchema = new mongoose.Schema({
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true,
    },
    accessRestrictions: {
        company: {
            type: Boolean,
            default: false,
        },
        job: {
            type: Boolean,
            default: false,
        },
        profile: {
            type: Boolean,
            default: false,
        },
    },
    isArchived: {
        type: Boolean,
        default: false,
    },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event',
    }],
}, {
    timestamps: true,
});


export default RecruiterSchema;
