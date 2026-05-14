import mongoose from 'mongoose';
import { getClientDbConn } from '../utils/clientDbUtils.js';

const ClientAdminSchema = new mongoose.Schema({
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true,
    },
    user: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true,
    },
    aiSelektWaId: {
        type: String,
        unique: true,
        null: true,
    },
    clientCompany: {
        type: String,
        required: [true, 'clientCompany is required'],
        match: [/^[a-zA-Z0-9_]+$/, 'clientCompany must be alphanumeric and may include underscores only']
    },
    creditRatePerCall: {
        type: Number,
        required: [true, 'creditRatePerCall is required'],
        min: [0, 'creditRatePerCall must be >= 0']
    },
    totalCredit: {
        type: Number,
        required: true,
        min: [0, 'totalCredit must be >= 0']
    },
    videoInterviewCredit: {
        type: Number,
        default: 10,
        min: [0, 'videoInterviewCredit must be >= 0']
    },
    totalCallCount: {
        type: Number,
        default: 0,
        min: [0, 'totalCallCount must be >= 0']
    },
    videoInterviewCount: {
        type: Number,
        default: 0,
        min: [0, 'videoInterviewCount must be >= 0']
    },
    totalWaMsgCount: {
        type: Number,
        default: 0,
        min: [0, 'totalCallCount must be >= 0']
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }],

    // ✅ Interview Reminder & Rescheduling Settings
    interviewReminderSettings: {
        // Master toggle: enable or disable interview reminders
        reminderEnabled: {
            type: Boolean,
            default: true,
        },
        // Toggle: send AI reminder call 30 min before any interview
        reminderCallEnabled: {
            type: Boolean,
            default: true,
        },
        // Toggle: send reminder email 30 min before any interview
        reminderEmailEnabled: {
            type: Boolean,
            default: true,
        },
        // Auto-reschedule toggle: only applies to AI-only interviews
        autoRescheduleEnabled: {
            type: Boolean,
            default: true,
        },
        // Max days from original interview date the candidate can reschedule to
        maxRescheduleDays: {
            type: Number,
            default: 15,
            min: [1, 'maxRescheduleDays must be at least 1'],
            max: [90, 'maxRescheduleDays cannot exceed 90'],
        },
        // How long the new reschedule link stays valid (hours)
        newLinkValidHours: {
            type: Number,
            default: 24,
            min: [1, 'newLinkValidHours must be at least 1'],
        },
    },
}, {
    timestamps: true
});


ClientAdminSchema.post('save', async (doc) => {

    if (doc?.user) {

        const globalDbConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

        try {
            const dbName = doc?.clientCompany;
            const clientConn = await getClientDbConn(dbName);
            const ClientUsers = clientConn.models['User'];

            let userObj = await globalDbConn.models['User'].findById(doc?.user).lean().exec();
            // console.log(
            //     "userObj: ", userObj
            // );

            // userObj = userObj.toObject({ depopulate: true, versionKey: false }); 

            let clientUsrData = await ClientUsers.findOne({ email: userObj.email, });
            if (!clientUsrData) {
                console.log(
                    "Inserting client in client DB..."
                );

                await ClientUsers.insertMany([{ ...userObj, skipHashing: true }]);

            } else {
                console.log(
                    "Updating client in client DB..."
                );
                clientUsrData.set({ ...userObj, skipHashing: true });
                await clientUsrData.save();

            }

        } catch (err) {
            console.log(
                "❌ Error in when trying to add client-user to client's db: ", err,
            );

        }

    }

});

export default ClientAdminSchema;

