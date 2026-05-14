import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const SettingSchema = new Schema({
    serviceType: {
        type: [String],
        required: true,
        validate: {
            validator: arr => Array.isArray(arr) && arr.length > 0,
            message: 'At least one serviceType is required'
        }
    },
    serviceProvider: {
        type: String,
        required: true,
        trim: true
    },
    configurationName: {
        type: String,
        required: true,
        trim: true,
        unique: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: false
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    configurationDetails: {
        type: Map,
        of: Schema.Types.Mixed,
        default: {}
    },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    isArchived: { type: Boolean, default: false },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }],
}, {
    timestamps: true
});

// Remove any old indexes that included serviceProvider
// and ensure only one on configurationName exists:
// SettingSchema.index({ configurationName: 1 }, { unique: true });

export default SettingSchema;
