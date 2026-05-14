import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const isValidHttpUrl = (value = '') => {
    if (!value || typeof value !== 'string') return false;
    try {
        const url = new URL(value.trim());
        const protocolOk = ['http:', 'https:'].includes(url.protocol);
        const hostnameOk = Boolean(url.hostname) && (url.hostname.includes('.') || ['localhost', '127.0.0.1'].includes(url.hostname));
        return protocolOk && hostnameOk;
    } catch (_err) {
        return false;
    }
};

const CompanySchema = new Schema({
    name: { type: String, unique: true, index: true, required: true, },    // Company Name
    industry: { type: String },    // Company Type / Industry
    size: { type: String },                   // e.g. "50–200 employees"
    description: { type: String },                   // Short description
    website: {
        type: String,
        required: true,
        trim: true,
        validate: {
            validator: isValidHttpUrl,
            message: 'Website must be a valid http(s) URL (e.g., https://example.com)'
        }
    },                    // URL
    logoUrl: { type: String },                   // URL to logo image
    about: { type: String, required: true, },                   // Longer “About” text
    policyBenefits: { type: String },                   // Policy & Benefits (rich text blob)
    faqs: [{ type: String }],
    createdBy: { type: mongoose.Types.ObjectId, ref: 'User', index: true },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    isArchived: {
        type: Boolean,
        default: false
    },             // Array of FAQ strings
    eventIds: [{ type: mongoose.Types.ObjectId, ref: 'Event' }]
}, {
    timestamps: true
});

CompanySchema.index({
    name: 'text',
    industry: 'text',
    description: 'text',
    about: 'text',
    policyBenefits: 'text',
    // Arrays are ok; Mongo will index elements
    faqs: 'text',
});

export default CompanySchema;
