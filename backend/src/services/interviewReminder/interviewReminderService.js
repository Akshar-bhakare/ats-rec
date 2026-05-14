/**
 * interviewReminderService.js
 *
 * Handles all logic for:
 *  1. AI reminder calls → placed 30 min before any interview (AI / Human / AI+Human)
 *  2. Auto-rescheduling  → only for AI-only interviews when candidate requests it
 *  3. Recruiter notification → for Human / AI+Human reschedule requests
 *
 * Console log style: emoji + tree lines, matches the rest of the codebase.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import { getClientDbConn } from '../../utils/clientDbUtils.js';
import { sendEmail, resolveTemplatePayload, EMAIL_TEMPLATE_KEYS } from '../eMailing/emailService.js';

const LOG_PREFIX = '[InterviewReminderService]';
export const DEFAULT_REMINDER_SETTINGS = {
    reminderEnabled: true,
    reminderCallEnabled: true,
    reminderEmailEnabled: true,
    autoRescheduleEnabled: true,
    maxRescheduleDays: 15,
    newLinkValidHours: 24,
};

// ─────────────────────────────────────────────────────────────
// CONSOLE HELPERS
// ─────────────────────────────────────────────────────────────

const logBox = (title) => {
    const line = '═'.repeat(76);
    console.log(`\n╔${line}╗`);
    console.log(`║  📅 ${title.padEnd(70)} ║`);
    console.log(`╚${line}╝\n`);
};

const logInfo = (msg) => console.log(`${LOG_PREFIX} ℹ️  ${msg}`);
const logSuccess = (msg) => console.log(`${LOG_PREFIX} ✅ ${msg}`);
const logWarn = (msg) => console.log(`${LOG_PREFIX} ⚠️  ${msg}`);
const logError = (msg, err) => {
    console.log(`${LOG_PREFIX} ❌ ${msg}`);
    if (err) console.log(`${LOG_PREFIX}    Cause:`, err?.message || err);
};

const normalizeReminderLookupValue = (value) => {
    if (!value) return null;
    if (value instanceof mongoose.Types.ObjectId) return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed || null;
    }
    if (typeof value === 'number') return String(value);
    return null;
};

const collectReminderLookupCandidates = (source) => {
    if (!source) return [];

    const candidates = new Set();
    const add = (value) => {
        const normalized = normalizeReminderLookupValue(value);
        if (normalized) candidates.add(normalized);
    };

    if (
        source instanceof mongoose.Types.ObjectId ||
        typeof source === 'string' ||
        typeof source === 'number'
    ) {
        add(source);
        return [...candidates];
    }

    add(source?._id);
    add(source?.id);
    add(source?.client);
    add(source?.clientId);
    add(source?.user);
    add(source?.sub);
    add(source?.dbName);
    add(source?.clientCompany);

    const nestedUser = source?.user;
    if (nestedUser && typeof nestedUser === 'object') {
        add(nestedUser?._id);
        add(nestedUser?.id);
        add(nestedUser?.client);
        add(nestedUser?.clientId);
        add(nestedUser?.sub);
    }

    return [...candidates];
};

const describeReminderLookupSource = (source) => {
    const candidates = collectReminderLookupCandidates(source);
    return candidates.length ? candidates.join(', ') : '(empty)';
};

const buildReminderSettingsLookupFilter = (source) => {
    const candidates = collectReminderLookupCandidates(source);
    if (!candidates.length) return null;

    const objectIds = [];
    const clientCompanies = [];

    candidates.forEach((candidate) => {
        if (mongoose.Types.ObjectId.isValid(candidate)) {
            objectIds.push(new mongoose.Types.ObjectId(candidate));
        } else {
            clientCompanies.push(candidate);
        }
    });

    const or = [];

    if (objectIds.length) {
        or.push({ _id: { $in: objectIds } });
        or.push({ client: { $in: objectIds } });
        or.push({ user: { $in: objectIds } });
    }

    if (clientCompanies.length) {
        or.push({ clientCompany: { $in: clientCompanies } });
    }

    return or.length ? { isArchived: false, $or: or } : null;
};

const resolveReminderBaseUrl = (reqContext = {}) => (
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_ORIGIN ||
    process.env.BACKEND_ORIGIN ||
    reqContext?.headers?.['x-frontend-origin'] ||
    'https://hirexit.ai'
).replace(/\/+$/, '');

export const buildInterviewJoinLink = ({
    candidateId,
    jobId,
    interviewerType,
    accessToken,
    scheduleId,
}, reqContext = {}) => {
    const baseUrl = resolveReminderBaseUrl(reqContext);
    const params = new URLSearchParams();

    if (candidateId) params.set('cid', String(candidateId));
    if (jobId) params.set('jid', String(jobId));
    if (scheduleId) params.set('sid', String(scheduleId));
    if (interviewerType) params.set('itype', String(interviewerType));
    if (accessToken) params.set('token', String(accessToken));

    const query = params.toString();
    return `${baseUrl}/webrtcai/${query ? `?${query}` : ''}`;
};

// ─────────────────────────────────────────────────────────────
// SETTINGS HELPERS  (global DB — ClientAdmin model)
// ─────────────────────────────────────────────────────────────

/**
 * Returns the interviewReminderSettings for the given client.
 * Falls back to defaults if no custom settings are stored yet.
 *
 * @param {string|object} clientContext  – client identifier or request-like context
 * @returns {object}
 */
export const getClientReminderSettings = async (clientContext) => {
    try {
        const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
        const filter = buildReminderSettingsLookupFilter(clientContext);

        if (!filter) {
            logWarn(`getClientReminderSettings: unable to resolve lookup source (${describeReminderLookupSource(clientContext)}) — using defaults`);
            return DEFAULT_REMINDER_SETTINGS;
        }

        const clientAdmin = await globalConn.models['ClientAdmin']
            .findOne(filter)
            .select('interviewReminderSettings client user clientCompany')
            .lean()
            .exec();

        if (!clientAdmin) {
            logWarn(`getClientReminderSettings: ClientAdmin not found for source=${describeReminderLookupSource(clientContext)}, using defaults`);
            return DEFAULT_REMINDER_SETTINGS;
        }

        return {
            ...DEFAULT_REMINDER_SETTINGS,
            ...(clientAdmin.interviewReminderSettings || {}),
        };
    } catch (err) {
        logError('getClientReminderSettings failed', err);
        return DEFAULT_REMINDER_SETTINGS;
    }
};

/**
 * Persists updated interviewReminderSettings to the ClientAdmin doc.
 *
 * @param {string|object} clientContext
 * @param {object} newSettings  – partial or full settings object
 * @returns {object}  saved settings
 */
export const updateClientReminderSettings = async (clientContext, newSettings = {}) => {
    logInfo(`updateClientReminderSettings → source=${describeReminderLookupSource(clientContext)}`);
    logInfo(`  ├─ reminderEnabled:        ${newSettings.reminderEnabled}`);
    logInfo(`  ├─ reminderCallEnabled:    ${newSettings.reminderCallEnabled}`);
    logInfo(`  ├─ reminderEmailEnabled:   ${newSettings.reminderEmailEnabled}`);
    logInfo(`  ├─ autoRescheduleEnabled:  ${newSettings.autoRescheduleEnabled}`);
    logInfo(`  ├─ maxRescheduleDays:      ${newSettings.maxRescheduleDays}`);
    logInfo(`  └─ newLinkValidHours:      ${newSettings.newLinkValidHours}`);

    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
    const filter = buildReminderSettingsLookupFilter(clientContext);

    if (!filter) {
        throw new Error('Unable to resolve the client admin record for reminder settings.');
    }

    const updated = await globalConn.models['ClientAdmin'].findOneAndUpdate(
        filter,
        { $set: { interviewReminderSettings: newSettings } },
        { new: true, runValidators: true }
    ).lean().exec();

    if (!updated) {
        throw new Error(`ClientAdmin not found for source=${describeReminderLookupSource(clientContext)}`);
    }

    logSuccess(`Settings saved for source=${describeReminderLookupSource(clientContext)}`);
    return updated.interviewReminderSettings;
};

// ─────────────────────────────────────────────────────────────
// REMINDER CALL
// ─────────────────────────────────────────────────────────────

/**
 * Builds the reminderCallContext object shared by outbound reminder calls
 * and inbound callbacks from candidates who missed a reminder call.
 *
 * @param {object} schedule            – lean InterviewSchedule with candidate+job populated
 * @param {object} settings            – client reminder settings (from getClientReminderSettings)
 * @param {string} interviewScheduleId
 * @returns {object}  reminderCallContext
 */
export const buildReminderCallContext = (schedule, settings, interviewScheduleId) => {
    const originalStartAt = schedule.originalStartAt || schedule.startAt;
    const maxAllowedDate = new Date(originalStartAt);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + settings.maxRescheduleDays);
    const ISTOpts = { timeZone: 'Asia/Kolkata' };
    const maxAllowedDateIST = maxAllowedDate.toLocaleDateString('en-IN', {
        ...ISTOpts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    const originalDateIST = new Date(originalStartAt).toLocaleDateString('en-IN', {
        ...ISTOpts, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
    return {
        callPurpose: 'interview_reminder',
        interviewScheduleId,
        jobId: String(schedule.job?._id || schedule.job),  // used to init the right AI session on callback
        scheduleStartAt: schedule.startAt,
        candidateName: `${schedule.candidate?.firstName || ''} ${schedule.candidate?.lastName || ''}`.trim(),
        jobTitle: schedule.job?.title || '',
        interviewerType: schedule.interviewerType,
        autoRescheduleEnabled: settings.autoRescheduleEnabled === true,
        maxRescheduleDays: settings.maxRescheduleDays,
        maxAllowedDateIST,
        originalDateIST,
    };
};

/**
 * Fires the actual 30-minute-before reminder AI call.
 * Imports aiCallTriggerer lazily to avoid circular dep at startup.
 *
 * @param {string} interviewScheduleId
 * @param {object} clientDBConn         – mongoose connection for the client DB
 * @param {object} req                  – fake/real request context  { user, conn, client }
 */
export const triggerReminderCall = async (interviewScheduleId, clientDBConn, req) => {
    logBox(`INTERVIEW REMINDER CALL — ID: ${interviewScheduleId}`);

    const lockAcquiredAt = new Date();
    const staleLockBefore = new Date(Date.now() - 15 * 60 * 1000);

    try {
        const schedule = await clientDBConn.models['InterviewSchedule']
            .findOneAndUpdate(
                {
                    _id: interviewScheduleId,
                    $and: [
                        {
                            $or: [
                                { reminderSentAt: null },
                                { reminderSentAt: { $exists: false } },
                            ],
                        },
                        {
                            $or: [
                                { reminderCallDispatchStartedAt: null },
                                { reminderCallDispatchStartedAt: { $exists: false } },
                                { reminderCallDispatchStartedAt: { $lt: staleLockBefore } },
                            ],
                        },
                    ],
                },
                { $set: { reminderCallDispatchStartedAt: lockAcquiredAt } },
                { new: true }
            )
            .populate('candidate', 'firstName lastName phoneNumber countryCode')
            .populate('job', 'title')
            .lean()
            .exec();

        if (!schedule) {
            logWarn(`triggerReminderCall: InterviewSchedule ${interviewScheduleId} already processed or currently locked`);
            return;
        }

        const candidateId = schedule.candidate?._id || schedule.candidate;
        const jobId = schedule.job?._id || schedule.job;
        const interviewerType = schedule.interviewerType;

        const releaseReminderCallLock = async () => {
            await clientDBConn.models['InterviewSchedule'].findOneAndUpdate(
                {
                    _id: interviewScheduleId,
                    reminderCallDispatchStartedAt: lockAcquiredAt,
                },
                { $unset: { reminderCallDispatchStartedAt: 1 } }
            ).exec();
        };

        // ── Pre-call log: show exactly who is about to be called ─────────
        const ISTOptions = { timeZone: 'Asia/Kolkata' };
        const scheduledTimeIST = new Date(schedule.startAt).toLocaleTimeString('en-IN', {
            ...ISTOptions, hour: '2-digit', minute: '2-digit', hour12: true,
        });
        const scheduledDateIST = new Date(schedule.startAt).toLocaleDateString('en-IN', {
            ...ISTOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const candidatePhone = [schedule.candidate?.countryCode, schedule.candidate?.phoneNumber]
            .filter(Boolean).join('');

        const divider = '─'.repeat(60);
        console.log(`\n${LOG_PREFIX} ┌${divider}┐`);
        console.log(`${LOG_PREFIX} │  📞 OUTGOING REMINDER CALL — ABOUT TO INITIATE              │`);
        console.log(`${LOG_PREFIX} ├${divider}┤`);
        console.log(`${LOG_PREFIX} │  👤 Candidate :  ${(schedule.candidate?.firstName + ' ' + schedule.candidate?.lastName).padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  📱 Phone     :  ${(candidatePhone || '(no phone)').padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  💼 Job       :  ${(schedule.job?.title || '').padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  🤖 Type      :  ${(interviewerType || '').padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  🗓️  Date      :  ${scheduledDateIST.padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  🕐 Time (IST):  ${scheduledTimeIST.padEnd(42)}│`);
        console.log(`${LOG_PREFIX} │  🔑 Schedule  :  ${String(interviewScheduleId).padEnd(42)}│`);
        console.log(`${LOG_PREFIX} ├${divider}┤`);
        console.log(`${LOG_PREFIX} │  🚀 Initiating call NOW...                                  │`);
        console.log(`${LOG_PREFIX} └${divider}┘\n`);

        // Lazy import to avoid circular dependency
        const { aiCallTriggerer } = await import('../../routes/aiCallRoutes.js');

        const dummyReply = {
            code: (code) => ({
                send: (data) => logInfo(`ReminderCall reply [${code}]: ${JSON.stringify(data)}`),
            }),
            send: (data) => logInfo(`ReminderCall reply: ${JSON.stringify(data)}`),
        };

        // Inject reminder context so the orchestration uses a reminder-specific prompt
        const settings = await getClientReminderSettings(req);

        // Guard: respect the reminder master toggle and call toggle
        if (settings.reminderEnabled === false) {
            await releaseReminderCallLock();
            logWarn(`reminderEnabled is OFF for this client — skipping call for schedule ${interviewScheduleId}`);
            return;
        }

        if (settings.reminderCallEnabled === false) {
            await releaseReminderCallLock();
            logWarn(`reminderCallEnabled is OFF for this client — skipping call for schedule ${interviewScheduleId}`);
            return;
        }

        req.callPurpose = 'interview_reminder';
        req.reminderCallContext = buildReminderCallContext(schedule, settings, interviewScheduleId);

        // 5th arg is isWhatsApp — must be boolean false for a phone call
        await aiCallTriggerer(candidateId, jobId, req, dummyReply, false);

        // Mark reminder as sent
        await clientDBConn.models['InterviewSchedule'].findByIdAndUpdate(
            interviewScheduleId,
            {
                $set: { reminderSentAt: new Date() },
                $unset: { reminderCallDispatchStartedAt: 1 },
            }
        );

        logSuccess(`Reminder call sent for schedule ${interviewScheduleId}`);

    } catch (err) {
        try {
            await clientDBConn.models['InterviewSchedule'].findOneAndUpdate(
                {
                    _id: interviewScheduleId,
                    reminderCallDispatchStartedAt: lockAcquiredAt,
                },
                { $unset: { reminderCallDispatchStartedAt: 1 } }
            ).exec();
        } catch (unlockErr) {
            logWarn(`Failed to release reminder call lock for schedule ${interviewScheduleId}: ${unlockErr?.message || unlockErr}`);
        }
        logError(`triggerReminderCall failed for schedule ${interviewScheduleId}`, err);
        throw err;
    }
};

// ─────────────────────────────────────────────────────────────
// AUTO-RESCHEDULE  (AI interviews only)
// ─────────────────────────────────────────────────────────────

/**
 * Handles a candidate's reschedule request detected during an AI reminder call.
 * - Expires the current webrtc/meeting link
 * - Creates a new InterviewSchedule with the requested new date/time
 * - Sends the candidate an email with the new link (valid for `newLinkValidHours`)
 *
 * @param {string}  interviewScheduleId  – current schedule to be replaced
 * @param {Date}    newDateTime          – candidate's requested new date/time
 * @param {object}  clientDBConn         – client mongoose connection
 * @param {object}  req                  – request context
 * @returns {object}  newly created InterviewSchedule (lean)
 */
export const rescheduleAIInterview = async (
    interviewScheduleId,
    newDateTime,
    clientDBConn,
    req
) => {
    logBox(`AUTO-RESCHEDULE AI INTERVIEW — ID: ${interviewScheduleId}`);

    const settings = await getClientReminderSettings(req);

    if (!settings.autoRescheduleEnabled) {
        logWarn(`autoRescheduleEnabled is OFF for this client – reschedule blocked`);
        throw new Error('Auto-rescheduling is disabled by the client admin.');
    }

    // ── Fetch existing schedule ──────────────────────────────
    const existing = await clientDBConn.models['InterviewSchedule']
        .findById(interviewScheduleId)
        .populate('candidate', 'firstName lastName email countryCode phoneNumber')
        .populate('job', 'title')
        .lean()
        .exec();

    if (!existing) {
        throw new Error(`InterviewSchedule ${interviewScheduleId} not found`);
    }

    if (existing.interviewerType !== 'AI') {
        logWarn(`rescheduleAIInterview called for non-AI interview (${existing.interviewerType}) – use notifyRecruiterRescheduleRequest instead`);
        throw new Error('Auto-reschedule is only available for AI-only interviews.');
    }

    // ── Validate new date within allowed window ──────────────
    const originalDate = existing.originalStartAt || existing.startAt;
    const maxAllowedDate = new Date(originalDate);
    maxAllowedDate.setDate(maxAllowedDate.getDate() + settings.maxRescheduleDays);

    const requestedDate = new Date(newDateTime);

    logInfo(`  ├─ Original date:   ${originalDate}`);
    logInfo(`  ├─ Requested date:  ${requestedDate}`);
    logInfo(`  ├─ Max allowed:     ${maxAllowedDate}`);
    logInfo(`  └─ maxRescheduleDays: ${settings.maxRescheduleDays}`);

    if (requestedDate > maxAllowedDate) {
        logWarn(`Requested date ${requestedDate} exceeds max allowed ${maxAllowedDate}`);
        throw new Error(
            `Reschedule date must be within ${settings.maxRescheduleDays} days of the original interview date (${originalDate.toDateString()}).`
        );
    }

    if (requestedDate <= new Date()) {
        throw new Error('Reschedule date must be in the future.');
    }

    // ── Cancel old schedule ───────────────────────────────────
    await clientDBConn.models['InterviewSchedule'].findByIdAndUpdate(
        interviewScheduleId,
        {
            $set: {
                isLinkExpired: true,
                interviewStatus: 'Cancelled',      // clearly cancelled, removed from active view
                webrtcAccessExpiresAt: new Date(), // expire link immediately
            }
        }
    );

    logInfo(`Old schedule cancelled: ${interviewScheduleId}`);

    // ── Generate new access token + expiry ───────────────────
    // Link validity follows the client-configured reminder setting.
    const newAccessToken = crypto.randomBytes(32).toString('hex');
    const normalizedLinkValidHours = Math.max(1, Number(settings.newLinkValidHours) || 24);
    const newLinkExpiresAt = new Date(requestedDate.getTime() + normalizedLinkValidHours * 60 * 60 * 1000);
    const candidateId = existing.candidate?._id || existing.candidate;
    const jobId = existing.job?._id || existing.job;
    const candidateATSId = existing.candidateATS?._id || existing.candidateATS;
    const interviewerIds = Array.isArray(existing.interviewers)
        ? existing.interviewers.map((item) => item?._id || item).filter(Boolean)
        : [];
    const newScheduleId = new mongoose.Types.ObjectId();
    const newJoinLink = buildInterviewJoinLink({
        candidateId,
        jobId,
        interviewerType: existing.interviewerType,
        accessToken: newAccessToken,
        scheduleId: newScheduleId,
    }, req);

    // ── Create new InterviewSchedule ─────────────────────────
    const {
        _id: _removedId,
        createdAt,
        updatedAt,
        reminderSentAt,
        reminderCallDispatchStartedAt,
        reminderEmailSentAt,
        recruiterRescheduleNotifiedAt,
        ...restOfExisting
    } = existing;

    const newScheduleData = {
        ...restOfExisting,
        _id: newScheduleId,
        candidateATS: candidateATSId,
        candidate: candidateId,
        job: jobId,
        interviewers: interviewerIds,
        startAt: requestedDate,
        originalStartAt: originalDate,
        rescheduleCount: (existing.rescheduleCount || 0) + 1,
        rescheduledFromId: existing._id,
        isLinkExpired: false,
        reminderSentAt: null,
        reminderCallDispatchStartedAt: null,
        reminderEmailSentAt: null,
        recruiterRescheduleNotifiedAt: null,
        interviewStatus: null,
        attendanceStartedAt: null,
        videoCreditConsumedAt: null,
        webrtcAccessToken: newAccessToken,
        webrtcAccessExpiresAt: newLinkExpiresAt,
        webrtcAccessUsedAt: null,
        ...(restOfExisting.interviewMode === 'Virtual'
            ? {
                webrtcLink: newJoinLink,
                meetingLink: newJoinLink,
            }
            : {}),
    };
    const rescheduledMeetingLink = restOfExisting.interviewMode === 'Virtual'
        ? newJoinLink
        : (restOfExisting.meetingLink || '');

    const newSchedule = await clientDBConn.models['InterviewSchedule'].create(newScheduleData);

    logSuccess(`New schedule created: ${newSchedule._id}`);
    logInfo(`  ├─ New startAt:    ${newSchedule.startAt}`);
    logInfo(`  ├─ Token expires:  ${newLinkExpiresAt}`);
    logInfo(`  ├─ Link hours:     ${normalizedLinkValidHours}`);
    logInfo(`  └─ Reschedule #:   ${newSchedule.rescheduleCount}`);

    // ── Register in-memory reminder timeout for the new schedule ─────────
    try {
        const { registerNewInterviewReminder } = await import('../../../SystemChecksAndInitiators/interviewReminderScheduler.js');
        const clientDBName = req?.dbName || clientDBConn?.db?.databaseName;
        if (clientDBName) {
            logInfo(`  ├─ Registering reminder for new schedule in DB: ${clientDBName}`);
            registerNewInterviewReminder(
                newSchedule.toObject?.() || newSchedule,
                clientDBName,
                req
            ).catch((err) => logWarn(`Could not register reminder for rescheduled schedule: ${err?.message}`));
        } else {
            logWarn(`dbName not found on req or conn — reminder timeout NOT registered for new schedule ${newSchedule._id}`);
        }
    } catch (reminderErr) {
        logWarn(`Could not register reminder for rescheduled schedule: ${reminderErr?.message}`);
    }

    // ── Send email to candidate ──────────────────────────────
    try {
        const candidate = existing.candidate;
        const job = existing.job;
        const joinLink = rescheduledMeetingLink;

        const dateStr = requestedDate.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const timeStr = requestedDate.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });
        const candidateName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim();
        const jobTitle = job?.title || 'the position';
        const interviewerTypeLabel = existing.interviewerType || 'AI';

        logInfo(`  ├─ Resolving reschedule email template for client (key: ${EMAIL_TEMPLATE_KEYS.INTERVIEW_RESCHEDULED_CANDIDATE})`);

        const emailPayload = await resolveTemplatePayload({
            reqContext: req,
            templateKey: EMAIL_TEMPLATE_KEYS.INTERVIEW_RESCHEDULED_CANDIDATE,
            variables: {
                candidateName,
                jobTitle,
                companyName: '',
                dateStr,
                timeStr,
                durationStr: '',
                mode: 'Virtual',
                placeLabel: 'Join Link',
                place: joinLink,
                interviewerTypeLabel,
                interviewTypeLabel: '',
                verificationLink: '',
                joinLink,
                notes: '',
                loginUrl: '',
                loginEmail: candidate?.email || '',
                loginPassword: '',
                activeWindowHours: String(normalizedLinkValidHours),
            },
        });

        await sendEmail({
            to: candidate?.email,
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
            reqContext: req,
        });

        logSuccess(`Reschedule email sent to ${candidate?.email}`);
    } catch (emailErr) {
        logError('Failed to send reschedule email (schedule was still created)', emailErr);
    }

    return newSchedule.toObject ? newSchedule.toObject() : newSchedule;
};

// ─────────────────────────────────────────────────────────────
// RECRUITER NOTIFICATION  (Human / AI+Human interviews)
// ─────────────────────────────────────────────────────────────

/**
 * Sends an email notification to the recruiter when a candidate requests
 * rescheduling for a Human or AI+Human interview.
 * Auto-rescheduling is NOT performed — the recruiter handles it manually.
 *
 * @param {string}  interviewScheduleId
 * @param {object}  clientDBConn
 * @param {object}  req
 */
export const notifyRecruiterRescheduleRequest = async (
    interviewScheduleId,
    clientDBConn,
    req
) => {
    logBox(`RECRUITER RESCHEDULE NOTIFICATION — ID: ${interviewScheduleId}`);

    try {
        const schedule = await clientDBConn.models['InterviewSchedule']
            .findById(interviewScheduleId)
            .populate('candidate', 'firstName lastName email phoneNumber countryCode')
            .populate('job', 'title')
            .populate('interviewers', 'firstName lastName email')
            .populate('client', 'email firstName lastName')
            .lean()
            .exec();

        if (!schedule) {
            throw new Error(`InterviewSchedule ${interviewScheduleId} not found`);
        }

        if (schedule.recruiterRescheduleNotifiedAt) {
            logWarn(`Recruiter already notified at ${schedule.recruiterRescheduleNotifiedAt} – skipping`);
            return;
        }

        const candidate = schedule.candidate;
        const job = schedule.job;
        const interviewDate = new Date(schedule.startAt);

        const dateStr = interviewDate.toLocaleDateString('en-IN', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        });
        const timeStr = interviewDate.toLocaleTimeString('en-IN', {
            hour: '2-digit', minute: '2-digit', hour12: true,
        });

        logInfo(`  ├─ Candidate:        ${candidate?.firstName} ${candidate?.lastName}`);
        logInfo(`  ├─ Job:              ${job?.title}`);
        logInfo(`  ├─ Interview type:   ${schedule.interviewerType}`);
        logInfo(`  ├─ Scheduled for:    ${dateStr} ${timeStr}`);
        logInfo(`  └─ Notifying recruiter / client admin`);

        // Collect all recruiter / client-admin emails to notify
        const recipientEmails = new Set();

        // Client admin (owner of the interview)
        if (schedule.client?.email) recipientEmails.add(schedule.client.email);

        // Assigned human interviewers
        for (const interviewer of schedule.interviewers || []) {
            if (interviewer?.email) recipientEmails.add(interviewer.email);
        }

        // Fallback: use req.user email if available
        if (req?.user?.email) recipientEmails.add(req.user.email);

        if (recipientEmails.size === 0) {
            logWarn(`No recruiter emails found for schedule ${interviewScheduleId} – cannot send notification`);
            return;
        }

        const emailPromises = [...recipientEmails].map((email) =>
            sendEmail({
                to: email,
                subject: `⚠️ Reschedule Request: ${candidate?.firstName} ${candidate?.lastName} — ${job?.title}`,
                html: buildRecruiterNotificationHtml({
                    recruiterEmail: email,
                    candidateName: `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim(),
                    candidatePhone: `${candidate?.countryCode || ''}${candidate?.phoneNumber || ''}`,
                    jobTitle: job?.title || 'the position',
                    dateStr,
                    timeStr,
                    interviewerType: schedule.interviewerType,
                }),
                text: `A reschedule request has been submitted.\n\nCandidate: ${candidate?.firstName} ${candidate?.lastName}\nPhone: ${candidate?.countryCode}${candidate?.phoneNumber}\nJob: ${job?.title}\nScheduled: ${dateStr} at ${timeStr}\nInterview type: ${schedule.interviewerType}\n\nPlease contact the candidate to arrange a new time.\n\nBest regards,\nThe Hirex REC Team`,
                reqContext: req,
            }).catch((err) => logError(`Failed to notify ${email}`, err))
        );

        await Promise.all(emailPromises);

        // Mark as notified
        await clientDBConn.models['InterviewSchedule'].findByIdAndUpdate(
            interviewScheduleId,
            { $set: { recruiterRescheduleNotifiedAt: new Date() } }
        );

        logSuccess(`Recruiter notification sent to: ${[...recipientEmails].join(', ')}`);

    } catch (err) {
        logError(`notifyRecruiterRescheduleRequest failed for ${interviewScheduleId}`, err);
        throw err;
    }
};

// ─────────────────────────────────────────────────────────────
// EMAIL HTML BUILDERS
// ─────────────────────────────────────────────────────────────

const buildRescheduleEmailHtml = ({
    candidateName,
    jobTitle,
    dateStr,
    timeStr,
    joinLink,
    validHours,
}) => `
<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:600px;">
  <h2 style="color:#1d4ed8;">Interview Rescheduled ✅</h2>
  <p>Hi ${candidateName},</p>
  <p>Your interview for <strong>${jobTitle}</strong> has been successfully rescheduled.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr><td style="padding:8px;font-weight:bold;width:140px;">New Date</td><td style="padding:8px;">${dateStr}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Time</td><td style="padding:8px;">${timeStr}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Join Link</td><td style="padding:8px;"><a href="${joinLink}" style="color:#1d4ed8;">${joinLink}</a></td></tr>
  </table>
  <p style="background:#fef3c7;padding:12px;border-radius:6px;">
    ⏳ <strong>This link is valid for ${validHours} hours only.</strong> Please join before it expires.
  </p>
  <p>Good luck! If you need further assistance, reply to this email.</p>
  <p>Regards,<br/><strong>The Hirex REC Team</strong></p>
</div>`.trim();

const buildRecruiterNotificationHtml = ({
    candidateName,
    candidatePhone,
    jobTitle,
    dateStr,
    timeStr,
    interviewerType,
}) => `
<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.6;max-width:600px;">
  <h2 style="color:#dc2626;">⚠️ Reschedule Request Received</h2>
  <p>A candidate has requested to reschedule their interview. Since this is a <strong>${interviewerType}</strong> interview, <strong>auto-rescheduling is not available</strong>. Please contact the candidate manually.</p>
  <table style="border-collapse:collapse;width:100%;margin:16px 0;">
    <tr><td style="padding:8px;font-weight:bold;width:160px;">Candidate</td><td style="padding:8px;">${candidateName}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Phone</td><td style="padding:8px;">${candidatePhone}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Job Position</td><td style="padding:8px;">${jobTitle}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Scheduled Date</td><td style="padding:8px;">${dateStr}</td></tr>
    <tr><td style="padding:8px;font-weight:bold;">Scheduled Time</td><td style="padding:8px;">${timeStr}</td></tr>
    <tr style="background:#f9fafb;"><td style="padding:8px;font-weight:bold;">Interview Type</td><td style="padding:8px;">${interviewerType}</td></tr>
  </table>
  <p>Please reach out to the candidate or interviewer to arrange a mutually convenient time.</p>
  <p>Regards,<br/><strong>The Hirex REC Team</strong></p>
</div>`.trim();
