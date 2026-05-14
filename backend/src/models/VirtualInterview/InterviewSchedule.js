import mongoose from 'mongoose';

const { Schema, Types } = mongoose;

const InterviewScheduleSchema = new Schema({
    candidateATS: { type: Types.ObjectId, ref: 'CandidateATS', required: true },
    candidate: { type: Types.ObjectId, ref: 'Candidate', required: true },
    job: { type: Types.ObjectId, ref: 'Job', required: true },

    interviewMode: {
        type: String,
        enum: ['Onsite', 'Virtual', 'Phone'],
        required: true,
        default: 'Virtual'
    },
    locationAddress: { type: String, trim: true, default: null },
    meetingLink: { type: String, trim: true, default: null },

    // WebRTCAI URL for Virtual interviews
    webrtcLink: { type: String, trim: true, default: null },
    webrtcAccessToken: { type: String, trim: true, default: null },
    webrtcAccessExpiresAt: { type: Date, default: null },
    webrtcAccessUsedAt: { type: Date, default: null },
    attendanceStartedAt: { type: Date, default: null },
    videoCreditConsumedAt: { type: Date, default: null },

    startAt: { type: Date, required: true },
    durationMinutes: {
        type: Number,
        min: 1,
        max: 1440,
        required: true,
        default: 45,
    },

    notes: { type: String, trim: true, default: "" },
    technicalScript: { type: String, trim: true, default: "" },

    // Interview category - only required for Speaking rounds with AI
    interviewType: {
        type: String,
        enum: ["Technical", "HR", "Psychometric", "Non-Technical", "Coding"],
        default: "Technical",
    },

    targetStageId: {
        type: Types.ObjectId,
        ref: 'Stage',
        default: null,
    },

    targetStageTitle: {
        type: String,
        trim: true,
        default: null,
    },

    // Difficulty level - only required for Speaking rounds with AI
    difficultyLevel: {
        type: String,
        enum: ["Easy", "Intermediate", "Advanced"],
        default: "Intermediate",
    },

    interviewerType: {
        type: String,
        enum: ["AI", "Human", "Human+AI"],
        required: true,
        default: "AI",
    },

    // ✅ NEW: Distinguish between Speaking (standard) and Coding rounds
    roundType: {
        type: String,
        enum: ["Speaking", "Coding"],
        required: true,
        default: "Speaking"
    },

    // ✅ NEW: Configuration for Coding rounds
    codingConfig: {
        questionLevel: {
            type: String,
            enum: ["Easy", "Medium", "Hard"],
            default: "Medium"
        },
        averageTestCases: {
            type: Number,
            default: 5
        },
        questionType: {
            type: String,
            default: "DSA" // e.g., 'DSA', 'System Design'
        },
        allowedLanguages: [{ type: Number }]
    },

    interviewers: [{ type: Types.ObjectId, ref: "User" }],

    client: { type: Types.ObjectId, ref: "User", required: true },
    isArchived: { type: Boolean, default: false },

    videoRecordingUrl: { type: String, trim: true, default: null },

    // Recording generation status for chunked recording system
    recordingStatus: {
        type: String,
        enum: ["NOT_GENERATED", "GENERATING", "READY", "FAILED"],
        default: "NOT_GENERATED"
    },

    // ✅ NEW: Persist the parameter blueprint selection used to build the script
    // This is what makes evaluation "parameter-wise" possible.
    selectedBlueprint: {
        type: Schema.Types.Mixed,
        default: [],
    },

    // Human interviewer's manual feedback
    interviewerFeedback: {
        type: Schema.Types.Mixed,
        default: null,
        /*
          {
            rating: 4,              // 1–5
            recommendation: 'Recommend',  // Strongly Recommend | Recommend | Neutral | Not Recommend | Strongly Not Recommend
            strengths: '...',
            improvements: '...',
            overallComment: '...',
            submittedAt: ISODate,
            submittedBy: ObjectId (User)
          }
        */
    },

    // ✅ STRICT parameter-wise evaluation persisted here
    evaluation: {
        type: Schema.Types.Mixed,
        default: null,
        /*
          {
            totalScore: 54,
            overallReason: "...",
            parameters: {
              "Component Architecture Design": { score: 20, reason: "...", weight: 1, group: "React Frontend Development" },
              ...
            },
            breakdown: { ... },
            completedAt: ISODate
          }
        */
    },

    remoteProctoring: {
        type: Schema.Types.Mixed,
        default: null,
    },

    // ✅ Reading passage (communication/fluency check after interview)
    readingPassageText: { type: String, trim: true, default: '' },
    readingPassageDifficulty: {
        type: String,
        enum: ['Easy', 'Intermediate', 'Advanced'],
        default: null,
    },
    readingPassageGeneratedAt: { type: Date, default: null },
    readingPassageAudioUrl: { type: String, trim: true, default: null },
    readingPassageAudioUpdatedAt: { type: Date, default: null },

    // ✅ Identity verification (face detection before interview)
    identityVerification: {
        status: {
            type: String,
            enum: ['NotRequired', 'Pending', 'Completed', 'Rejected'],
            default: 'Pending',
        },
        required: { type: Boolean, default: false },
        mediaType: {
            type: String,
            enum: ['photo', 'video', 'live_photo'],
            default: null,
        },
        mediaUrl: { type: String, trim: true, default: null },
        previewImageUrl: { type: String, trim: true, default: null },
        referenceDescriptor: [{ type: Number }],
        qualityScore: { type: Number, default: null },
        clarityScore: { type: Number, default: null },
        clarityReason: { type: String, trim: true, default: null },
        matchThresholdPercent: { type: Number, default: 70 },
        submittedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        lastMatchScore: { type: Number, default: null },
        lastLiveCheckAt: { type: Date, default: null },
        lastMatchAt: { type: Date, default: null },
        lastMismatchAt: { type: Date, default: null },
        mismatchCount: { type: Number, default: 0 },
        lastLiveFaceCount: { type: Number, default: null },
        lastError: { type: String, trim: true, default: null },
    },

    interviewStatus: {
        type: String,
        default: null,
    },

    endedAt: {
        type: Date,
        default: null,
    },

    // ✅ Reminder & Rescheduling tracking
    reminderSentAt: {
        type: Date,
        default: null,
    },

    reminderCallDispatchStartedAt: {
        type: Date,
        default: null,
    },

    // ✅ Reminder email tracking (parallel to reminderSentAt — set independently)
    reminderEmailSentAt: {
        type: Date,
        default: null,
    },

    // Original startAt (preserved across reschedules for 15-day window check)
    originalStartAt: {
        type: Date,
        default: null,
    },

    // How many times this interview has been rescheduled
    rescheduleCount: {
        type: Number,
        default: 0,
        min: 0,
    },

    // Reference to the previous InterviewSchedule it was rescheduled from
    rescheduledFromId: {
        type: Types.ObjectId,
        ref: 'InterviewSchedule',
        default: null,
    },

    // Whether the webrtc/meeting link has been expired due to reschedule
    isLinkExpired: {
        type: Boolean,
        default: false,
    },

    // Pending recruiter reschedule notification flag (for Human/AI+Human interviews)
    recruiterRescheduleNotifiedAt: {
        type: Date,
        default: null,
    },

    // ✅ NEW: Metadata for synchronization of multi-track recordings
    recordingMetadata: {
        candidateStartMs: { type: Number, default: null },
        candidateTimeline: [{
            seqNo: Number,
            startMs: Number,
            endMs: Number
        }],
        interviewerStartTimes: {
            type: Map,
            of: Number,
            default: {}
        },
        interviewerTimelines: {
            type: Map,
            of: [{
                seqNo: Number,
                startMs: Number,
                endMs: Number
            }],
            default: {}
        }
    },

    // ── Stage 2 Finalization ──────────────────────────────────────────────────
    finalizationStatus: {
        type: String,
        enum: ['not_started', 'queued', 'processing', 'completed', 'failed', 'partial'],
        default: 'not_started',
    },
    finalizationStartedAt: { type: Date, default: null },
    finalizationCompletedAt: { type: Date, default: null },
    finalizationError: { type: String, default: null },

    // Per-track final file metadata. Keys are track names: 'candidate', 'interviewer_<id>'
    trackFinalFiles: {
        type: Map,
        of: new Schema({
            finalUrl: { type: String },
            finalSize: { type: Number },
            finalizedAt: { type: Date },
        }, { _id: false }),
        default: {},
    }
},
    { timestamps: true }
);

InterviewScheduleSchema.pre("validate", function () {
    if (this.interviewMode === "Onsite") {
        if (!this.locationAddress || !this.locationAddress.trim()) {
            throw new Error("locationAddress is required for Onsite interviews");
        }
        this.meetingLink = this.meetingLink || null;
        this.webrtcLink = this.webrtcLink || null;
    } else if (this.interviewMode === "Phone") {
        if (!this.meetingLink || !this.meetingLink.trim()) {
            throw new Error("meetingLink is required for Phone interviews");
        }
        this.locationAddress = this.locationAddress || null;
        this.webrtcLink = this.webrtcLink || null;
    } else if (this.interviewMode === "Virtual") {
        if (
            (!this.meetingLink || !this.meetingLink.trim()) &&
            (!this.webrtcLink || !this.webrtcLink.trim())
        ) {
            throw new Error("webrtcLink/meetingLink is required for Virtual interviews");
        }
        this.locationAddress = this.locationAddress || null;
    }
});

InterviewScheduleSchema.index({ candidateATS: 1, startAt: 1 });
InterviewScheduleSchema.index({ client: 1, startAt: 1 });
InterviewScheduleSchema.index({ client: 1, candidate: 1, job: 1, startAt: -1 });
InterviewScheduleSchema.index({ webrtcAccessToken: 1 });

export default InterviewScheduleSchema;
