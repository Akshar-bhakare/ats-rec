import mongoose from 'mongoose';

const StageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true,
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }]
}, {
    timestamps: true
});

StageSchema.index(
    { client: 1, title: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } }
);

StageSchema.statics.findOrCreate = async function (title, description, isArchived, client) {
    return this.findOneAndUpdate(
        { title, client },
        { $setOnInsert: { title, description, isArchived, client } },
        { new: true, upsert: true }
    ).exec();
};

export default StageSchema;
