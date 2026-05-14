import mongoose from 'mongoose';
const { Schema, model } = mongoose;

const SalarySchema = new Schema({
    min: { type: Number },
    max: { type: Number },
    currency: { type: String, default: 'INR' }
}, { _id: false });

const ExperienceSchema = new Schema({
    min: { type: Number, required: true },
    max: { type: Number, required: true }
}, { _id: false });

const TimeRangeSchema = new Schema({
    start: { type: String },
    end: { type: String }
}, { _id: false });

const DateRangeSchema = new Schema({
    from: { type: Date },
    to: { type: Date }
}, { _id: false });

const WalkInDetailsSchema = new Schema({
    dateRange: {
        type: DateRangeSchema,
        validate: {
            validator: function (v) {
                return !(this.isWalkIn && (!v?.from || !v?.to));
            },
            message: 'Walk-in jobs must have both from and to dates'
        }
    },
    timeRange: {
        type: TimeRangeSchema,
        validate: {
            validator: function (v) {
                return !(this.isWalkIn && (!v?.start || !v?.end));
            },
            message: 'Walk-in jobs must have both start and end times'
        }
    },
    interviewMode: {
        type: String,
        enum: ['Virtual', 'In-person', 'On-call']
    },
    venue: { type: String }
}, { _id: false });

const EducationDetailSchema = new Schema({
    level: { type: String },
    qualification: { type: [String] },
    streamOrSpecialization: { type: String },
    boardOrInstitute: { type: [String] },
    yearOfCompletion: { type: String },
    gradeType: { type: String },
    gradeValue: { type: String }
}, { _id: false });

const JobSchema = new Schema({
    title: { type: String, required: true },
    internalTitle: { type: String, default: '' },
    jobType: {
        type: String,
        required: true,
        enum: [
            'Full-time',
            'Part-time',
            'Permanent',
            'Fresher',
            'Contractual/Temporary',
            'Internship'
        ]
    },
    locations: {
        type: [String],
        required: true,
        validate: {
            validator: arr => arr.length > 0,
            message: 'At least one location is required'
        }
    },
    salary: { type: SalarySchema, default: () => ({}) },
    experience: {
        type: ExperienceSchema,
        required: true,
        validate: {
            validator: function (v) {
                if (!v) return true;
                const { min, max } = v;
                return min == null || max == null || min <= max;
            },
            message: 'experience.min must be <= experience.max'
        }
    },
    workMode: {
        type: String,
        required: true,
        enum: [
            'On-site(Work From Office)',
            'Hybrid',
            'Remote(Work From Home)',
            'Field-based',
            'Not specified'
        ]
    },
    hybridDetails: {
        type: String,
        validate: {
            validator: function (v) {
                return this.workMode !== 'Hybrid' || (typeof v === 'string' && v.trim().length > 0);
            },
            message: 'When workMode is Hybrid, you must specify WFO/WFH details'
        }
    },

    // REPLACED: new uniform educationDetails
    educationDetails: {
        type: [EducationDetailSchema],
        default: [],
        // validate: {
        //     validator: arr => Array.isArray(arr) && arr.length > 0,
        //     message: 'At least one education entry is required'
        // }
    },

    certifications: { type: [String], default: [] },
    positions: { type: Number, required: true, default: 1 },
    primarySkills: {
        type: [String],
        required: true,
        validate: {
            validator: arr => arr.length >= 3,
            message: 'At least three primary skills are required'
        }
    },
    secondarySkills: { type: [String], default: [] },
    description: { type: String, required: true },
    shortDescription: { type: String },
    recruiterNotes: { type: String },
    enableAICall: { type: Boolean, default: true },
    isWalkIn: { type: Boolean, default: false },
    walkInDetails: { type: WalkInDetailsSchema },
    company: { type: mongoose.Types.ObjectId, ref: 'Company', required: true },
    unit: { type: mongoose.Types.ObjectId, ref: 'Unit' },
    createdBy: { type: mongoose.Types.ObjectId, ref: 'User', required: true },
    status: {
        type: String,
        required: true,
        enum: ['active', 'closed', 'on-hold', 'draft'],
        default: 'active'
    },
    client: {
        type: mongoose.Types.ObjectId,
        ref: 'User',
        index: true,
        required: true
    },
    isArchived: {
        type: Boolean,
        default: false
    },
    eventIds: [{ type: mongoose.Types.ObjectId, ref: 'Event' }],
    interviewParameterBlueprints: {
        type: [
            new Schema(
                {
                    interviewType: { type: String, default: 'Technical' },
                    difficultyLevel: { type: String, default: 'Intermediate' },
                    blueprint: { type: Schema.Types.Mixed, default: null },
                    selectedBlueprint: { type: Schema.Types.Mixed, default: null },
                    updatedAt: { type: Date, default: null },
                    selectedUpdatedAt: { type: Date, default: null }
                },
                { _id: false }
            )
        ],
        default: []
    }
}, {
    timestamps: true
});

// Cross-field validator for salary
JobSchema.pre('validate', function (next) {
    const { min, max } = this.salary;
    if (min != null && max != null && min > max) {
        this.invalidate('salary', 'salary.min must be ≤ salary.max');
    }

    try {
        next?.();
    } catch (err) {
        console.log(
            "Error in next step of job validate: ", (err?.message || err)
        );

    }
});

export default JobSchema;
