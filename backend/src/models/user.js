import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { isHashed } from '../utils/passwordUtils.js';

export const VALID_ROLES = ['ultra_admin', 'client_admin', 'manager', 'recruiter', 'job_seeker', 'interviewer', 'candidate'];

export const UserSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
        validate: {
            validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format'
        }
    },
    password: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    role: {
        type: String,
        index: true,
        required: true,
        enum: VALID_ROLES,
        default: 'job_seeker'
    },
    countryCode: {
        type: String,
        trim: true,
        validate: {
            validator: v => !v || /^\+\d{1,4}$/.test(v),
            message: 'Invalid country code format'
        }
    },
    phoneNumber: {
        type: String,
        trim: true,
        validate: {
            validator: v => !v || /^[0-9]{6,15}$/.test(v),
            message: 'Phone number must be 6 to 15 digits'
        }
    },
    profileUrl: { type: String, trim: true, default: null },

    // **New**: map of platform → URL
    socialLinks: {
        type: Map,
        of: String,
        default: {}
    },

    resetOtpHash: { type: String },
    resetOtpExpiry: { type: Date },
    resetOtpVerified: { type: Boolean, default: false },
    resetOtpUsed: { type: Boolean, default: false },

    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        default: null
    },
    emailUnsubscribed: {
        type: Boolean,
        default: false
    },
    emailUnsubscribedAt: {
        type: Date,
        default: null
    },
    emailUnsubscribeReason: {
        type: String,
        trim: true,
        default: ''
    },
    emailUnsubscribeSource: {
        type: String,
        trim: true,
        default: ''
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    eventIds: [{
        type: mongoose.Types.ObjectId,
        ref: 'Event'
    }],

    // ✅ Interview security feature flags (stored on the client_admin user document)
    interviewSecuritySettings: {
        faceDetectionEnabled: { type: Boolean, default: false },
        readingPassageEnabled: { type: Boolean, default: false },
    },
}, {
    timestamps: true
});

export const UsersClientSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
        validate: {
            validator: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
            message: 'Invalid email format'
        }
    },
    role: {
        type: String,
        lowercase: true,
        trim: true,
        required: true,
        enum: VALID_ROLES,
        default: 'job_seeker'
    },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        default: null
    },
}, {
    timestamps: true
});



UserSchema.pre('save', async function () {
    if (this.role === 'client_admin') {
        this.client = this._id;
    }
    if (isHashed(this.password)) {
        return;
    }

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
        console.log(
            "❌ Error during pre save of user: ", error
        );
    }
});

UserSchema.post('save', async function (doc) {
    try {
        const globalDbConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

        // Define or fetch the global UserInfo model
        const UsersClients = globalDbConn.models.UsersClient || globalDbConn.model('UsersClient', UsersClientSchema);

        // Insert metadata
        let usrLoginData = await UsersClients.findOne({ email: doc.email, });
        if (!usrLoginData) {
            await UsersClients.create({
                email: doc.email,
                role: doc?.role,
                client: doc?.client,
            });

        } else if (
            usrLoginData?.email !== doc.email ||
            usrLoginData?.role !== doc?.role ||
            String(usrLoginData?.client || '') !== String(doc?.client || '')
        ) {
            usrLoginData.email = doc.email;
            usrLoginData.role = doc?.role;
            usrLoginData.client = doc?.client;
            await usrLoginData.save();
        }

    } catch (err) {
        console.log("❌ Error logging user's login info to global DB: ", err);
    }
});


export default UserSchema;
