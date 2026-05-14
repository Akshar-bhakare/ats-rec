import mongoose from 'mongoose';

export const EventNameSchema = new mongoose.Schema({
    userId: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    eventName: {
        type: String,
        enum: ['Created', 'Read', 'Updated', 'Archived', 'Deleted'],
    },
    name: {
        type: String,
        required: true,
        enum: ['Created', 'Read', 'Updated', 'Archived', 'Deleted'],
    },
});

EventNameSchema.statics.findOrCreate = async function (userId, event_name) {
    return this.findOneAndUpdate(
        { userId, name: event_name },
        { $setOnInsert: { userId, name: event_name } },
        { new: true, upsert: true }
    ).exec();
};



const EventSchema = new mongoose.Schema({
    eventName: {
        type: mongoose.Types.ObjectId,
        ref: 'EventName',
        required: true
    },
    eventAt: {
        type: Date,
        required: true,
        set: (value) => {
            const date = new Date(value);
            date.setSeconds(0, 0); // Removes seconds and milliseconds
            return date;
        }
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
    },


});

EventSchema.statics.findOrCreate = async function (eventNameId, eventAt, isArchived, client) {
    return this.findOneAndUpdate(
        { eventName: eventNameId, eventAt, client },
        { $setOnInsert: { eventName: eventNameId, eventAt, isArchived, client } },
        { new: true, upsert: true }
    ).exec();
};


export default EventSchema;
