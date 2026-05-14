import mongoose from 'mongoose';

const { Schema } = mongoose;

const EmailTemplateContentSchema = new Schema(
    {
        subject: { type: String, trim: true, default: '' },
        html: { type: String, trim: true, default: '' },
        text: { type: String, trim: true, default: '' },
        updatedAt: { type: Date, default: null },
        updatedBy: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            default: null
        }
    },
    { _id: false }
);

const EmailTemplateSettingSchema = new Schema(
    {
        client: {
            type: mongoose.Types.ObjectId,
            ref: 'User',
            index: true,
            unique: true
        },
        templates: {
            type: Map,
            of: EmailTemplateContentSchema,
            default: {}
        }
    },
    { timestamps: true }
);

export default EmailTemplateSettingSchema;
