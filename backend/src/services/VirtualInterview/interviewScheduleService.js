import CRUDService from '../crudBase.js';
import mongoose from 'mongoose';
import crypto from 'crypto';
import {
    sendInterviewScheduledCandidateEmail,
    sendInterviewScheduledInterviewerEmail,
    sendInterviewRescheduledCandidateEmail
} from '../eMailing/emailService.js';
import { getClientDbConn } from '../../utils/clientDbUtils.js';
import { expandLanguages } from '../../utils/supportedLanguages.js';

import {
    DEFAULT_TIMEZONE,
    getRequestTimeZone,
    localDateTimeToUtc,
    normalizeTimeZone
} from '../../utils/timeUtils.js';
import {
    getNotificationPreferences,
    isInAppNotificationEnabled
} from '../../utils/notificationPreferences.js';

const TIMEZONE_PATTERNS = [
    { tz: 'Asia/Dubai', pattern: /(dubai|uae|united arab emirates|abu dhabi|sharjah|ajman)/i },
    { tz: 'Asia/Kolkata', pattern: /(india|ind\b|bangalore|bengaluru|mumbai|delhi|hyderabad|chennai|pune|kolkata|noida|gurgaon|gurugram)/i },
    { tz: 'America/Los_Angeles', pattern: /(pacific|california|ca\b|los angeles|san francisco|seattle|washington\b|oregon|nevada)/i },
    { tz: 'America/Phoenix', pattern: /(arizona|phoenix)/i },
    { tz: 'America/Denver', pattern: /(mountain|colorado|denver|utah|salt lake|new mexico|wyoming|montana|idaho)/i },
    { tz: 'America/Chicago', pattern: /(central|texas|tx\b|dallas|houston|austin|chicago|illinois|wisconsin|minnesota|iowa|kansas|missouri|louisiana|arkansas|oklahoma|tennessee|mississippi|alabama|north dakota|south dakota|nebraska)/i },
    { tz: 'America/New_York', pattern: /(eastern|new york|ny\b|new jersey|nj\b|boston|massachusetts|pennsylvania|philadelphia|washington\s?dc|dc\b|florida|miami|atlanta|georgia|virginia|maryland|delaware|carolina|ohio|michigan|detroit|indiana|kentucky|connecticut|rhode island|vermont|maine|new hampshire)/i },
    { tz: 'America/Anchorage', pattern: /(alaska|anchorage)/i },
    { tz: 'Pacific/Honolulu', pattern: /(hawaii|honolulu)/i },
    { tz: 'America/New_York', pattern: /(united states|usa|u\.s\.|america|\bus\b)/i }
];

const COMMUNICATION_PARAMETER_NAME = 'Communication & Clarity';
const SCORELESS_STATUS_KEYS = new Set(['upcoming', 'unattended']);
const VIDEO_INTERVIEW_CREDIT_DELAY_MS = 5 * 60 * 1000;
const pendingVideoInterviewCreditTimers = new Map();

const coerceValidDate = (value) => {
    if (!value) return null;
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clearPendingVideoInterviewCreditTimer = (scheduleId) => {
    const timerKey = String(scheduleId || '').trim();
    if (!timerKey) return;
    const pendingTimer = pendingVideoInterviewCreditTimers.get(timerKey);
    if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingVideoInterviewCreditTimers.delete(timerKey);
    }
};

export default class InterviewScheduleService extends CRUDService {
    constructor() {
        super('InterviewSchedule');
    }

    #schedulePendingVideoInterviewCredit({ scheduleId, clientId, dbName, attendanceStartedAt }) {
        const timerKey = String(scheduleId || '').trim();
        const startedAt = coerceValidDate(attendanceStartedAt);
        if (!timerKey || !clientId || !dbName || !startedAt) return;

        clearPendingVideoInterviewCreditTimer(timerKey);

        const eligibleAtMs = startedAt.getTime() + VIDEO_INTERVIEW_CREDIT_DELAY_MS;
        const delayMs = Math.max(0, eligibleAtMs - Date.now());
        const timer = setTimeout(async () => {
            clearPendingVideoInterviewCreditTimer(timerKey);
            try {
                await this.consumeVideoInterviewCreditIfEligible({
                    scheduleId: timerKey,
                    clientId,
                    dbName,
                    referenceTime: new Date()
                });
            } catch (err) {
                console.warn('[InterviewScheduleService] Deferred video credit consumption failed:', err?.message || err);
            }
        }, delayMs);

        if (typeof timer?.unref === 'function') timer.unref();
        pendingVideoInterviewCreditTimers.set(timerKey, timer);
    }

    async consumeVideoInterviewCreditIfEligible({ scheduleId, clientId, dbName, referenceTime = new Date() }) {
        const normalizedScheduleId = String(scheduleId || '').trim();
        if (!normalizedScheduleId || !mongoose.Types.ObjectId.isValid(normalizedScheduleId)) {
            return { consumed: false, reason: 'invalid_schedule_id' };
        }

        const normalizedDbName = String(dbName || '').trim();
        if (!normalizedDbName) {
            return { consumed: false, reason: 'missing_db_name' };
        }

        const tenantConn = await getClientDbConn(normalizedDbName);
        const InterviewSchedule = tenantConn.models['InterviewSchedule'];
        if (!InterviewSchedule) {
            return { consumed: false, reason: 'schedule_model_not_found' };
        }

        const baseFilter = {
            _id: new mongoose.Types.ObjectId(normalizedScheduleId),
            isArchived: false
        };
        if (clientId) {
            baseFilter.client = clientId;
        }

        const schedule = await InterviewSchedule.findOne(baseFilter)
            .select('client interviewMode interviewStatus endedAt webrtcAccessUsedAt attendanceStartedAt videoCreditConsumedAt')
            .lean()
            .exec();

        if (!schedule) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'schedule_not_found' };
        }

        if (schedule.interviewMode !== 'Virtual') {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'not_virtual' };
        }

        if (schedule.videoCreditConsumedAt) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'already_consumed' };
        }

        const rawStatus = String(schedule.interviewStatus || '').trim().toLowerCase();
        if (rawStatus.includes('cancel') || rawStatus.includes('reschedule')) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'inactive_status' };
        }

        const startedAt = coerceValidDate(schedule.attendanceStartedAt) || coerceValidDate(schedule.webrtcAccessUsedAt);
        if (!startedAt) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'attendance_not_started' };
        }

        const eligibleAt = new Date(startedAt.getTime() + VIDEO_INTERVIEW_CREDIT_DELAY_MS);
        const resolvedReferenceTime = coerceValidDate(referenceTime) || new Date();
        const endedAt = coerceValidDate(schedule.endedAt);

        if (endedAt && endedAt.getTime() < eligibleAt.getTime()) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'ended_before_threshold' };
        }

        if (resolvedReferenceTime.getTime() < eligibleAt.getTime()) {
            this.#schedulePendingVideoInterviewCredit({
                scheduleId: normalizedScheduleId,
                clientId: schedule.client,
                dbName: normalizedDbName,
                attendanceStartedAt: startedAt
            });
            return { consumed: false, reason: 'threshold_not_reached', eligibleAt };
        }

        const chargedAt = new Date();
        const reservedSchedule = await InterviewSchedule.findOneAndUpdate(
            {
                _id: schedule._id,
                client: schedule.client,
                isArchived: false,
                $or: [
                    { videoCreditConsumedAt: { $exists: false } },
                    { videoCreditConsumedAt: null }
                ]
            },
            { $set: { videoCreditConsumedAt: chargedAt } },
            { new: false }
        )
            .lean()
            .exec();

        if (!reservedSchedule) {
            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: false, reason: 'already_consumed' };
        }

        try {
            const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
            const updateResult = await globalConn.models.ClientAdmin.updateOne(
                { user: schedule.client, isArchived: false },
                { $inc: { videoInterviewCount: 1 } }
            ).exec();

            if (!updateResult?.matchedCount) {
                throw new Error('Client admin not found while incrementing video interview count');
            }

            clearPendingVideoInterviewCreditTimer(normalizedScheduleId);
            return { consumed: true, chargedAt };
        } catch (err) {
            await InterviewSchedule.updateOne(
                {
                    _id: schedule._id,
                    client: schedule.client,
                    videoCreditConsumedAt: chargedAt
                },
                { $set: { videoCreditConsumedAt: null } }
            ).exec().catch((rollbackErr) => {
                console.warn('[InterviewScheduleService] Failed to rollback deferred video credit marker:', rollbackErr?.message || rollbackErr);
            });

            console.warn('[InterviewScheduleService] Failed to increment deferred video interview credit:', err?.message || err);
            return { consumed: false, reason: 'increment_failed', error: err?.message || err };
        }
    }

    #normalizeStageKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    async #syncTargetStageStatus(schedule, nextStageStatus, req) {
        const candidateATSId = String(schedule?.candidateATS || '').trim();
        const targetStageId = String(schedule?.targetStageId || '').trim();
        const nextStatus = String(nextStageStatus || '').trim() || 'Completed';
        if (!candidateATSId || !targetStageId) return;
        if (!mongoose.Types.ObjectId.isValid(candidateATSId) || !mongoose.Types.ObjectId.isValid(targetStageId)) return;

        const CandidateATS = req?.conn?.models?.CandidateATS;
        const StageResult = req?.conn?.models?.StageResult;
        if (!CandidateATS || !StageResult?.findOrCreate) return;

        const atsDoc = await CandidateATS.findOne({
            _id: candidateATSId,
            client: req.client,
            isArchived: false,
        })
            .populate({
                path: 'stageResults',
                model: 'StageResult',
                select: '_id stage stageStatus remarkOrFeedback',
                populate: {
                    path: 'stage',
                    select: 'title',
                    match: { isArchived: false },
                },
            })
            .exec();

        if (!atsDoc) return;

        const stageResults = Array.isArray(atsDoc.stageResults) ? atsDoc.stageResults : [];
        const targetIndex = stageResults.findIndex((stageResult) => (
            String(stageResult?.stage?._id || stageResult?.stage || '') === targetStageId
        ));
        if (targetIndex < 0) return;

        const currentStageResult = stageResults[targetIndex];
        const currentStatus = String(currentStageResult?.stageStatus || '').trim().toLowerCase();
        if (currentStatus === nextStatus.toLowerCase()) return;

        const completedStageResult = await StageResult.findOrCreate(
            currentStageResult?.stage?._id || currentStageResult?.stage,
            nextStatus,
            currentStageResult?.remarkOrFeedback || '',
            req
        );

        if (!completedStageResult?._id) return;

        const nextStageResults = stageResults.map((stageResult) => stageResult?._id);
        nextStageResults[targetIndex] = completedStageResult._id;

        await CandidateATS.updateOne(
            { _id: atsDoc._id, client: req.client },
            { $set: { stageResults: nextStageResults } }
        ).exec();
    }

    #resolveAccessExpiryWindow(startAt, hours = 48) {
        const start = startAt instanceof Date ? startAt : new Date(startAt);
        if (!start || Number.isNaN(start.getTime())) return null;
        const end = new Date(start.getTime() + hours * 60 * 60 * 1000);
        return { startAt: start, endAt: end };
    }

    #resolveTimezoneFromLocation(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        for (const entry of TIMEZONE_PATTERNS) {
            if (entry.pattern.test(raw)) return entry.tz;
        }
        return '';
    }

    #resolveTimezoneFromJob(jobDoc) {
        const locations = [];
        if (jobDoc?.location) locations.push(jobDoc.location);
        if (Array.isArray(jobDoc?.locations)) locations.push(...jobDoc.locations);
        for (const loc of locations) {
            const tz = this.#resolveTimezoneFromLocation(loc);
            if (tz) return tz;
        }
        return '';
    }

    // Helper: format a UTC date to a timezone-aware human string
    #formatWhen(utcDate, minutes, timeZone) {
        const tz = normalizeTimeZone(timeZone, DEFAULT_TIMEZONE);
        if (!(utcDate instanceof Date) || Number.isNaN(utcDate.getTime())) {
            return { dateStr: 'N/A', timeStr: 'N/A', durationStr: `${minutes || 0} min`, timeZone: tz };
        }
        const optsDate = { timeZone: tz, year: 'numeric', month: 'short', day: '2-digit' };
        const optsTime = { timeZone: tz, hour: '2-digit', minute: '2-digit', timeZoneName: 'short' };
        return {
            dateStr: utcDate.toLocaleDateString('en-IN', optsDate),
            timeStr: utcDate.toLocaleTimeString('en-IN', optsTime),
            durationStr: `${minutes || 0} min`,
            timeZone: tz
        };
    }

    #normalizeDurationMinutes(value, fallback = 45) {
        const minutes = Number(value);
        return Number.isFinite(minutes) && minutes > 0 ? minutes : fallback;
    }

    #resolveAccessWindow(startAt, durationMinutes) {
        const start = startAt instanceof Date ? startAt : new Date(startAt);
        if (!start || Number.isNaN(start.getTime())) return null;

        const normalizedDuration = this.#normalizeDurationMinutes(durationMinutes, 45);
        const end = new Date(start.getTime() + normalizedDuration * 60000);

        return { startAt: start, endAt: end, durationMinutes: normalizedDuration };
    }

    #shouldAutoMarkUnattended(item) {
        if (!item) return false;
        if (item.endedAt) return false;
        const rawStatus = String(item.interviewStatus || '').toLowerCase();
        if (
            rawStatus.includes('complete') ||
            rawStatus.includes('cancel') ||
            rawStatus.includes('miss') ||
            rawStatus.includes('unattend')
        ) {
            return false;
        }

        const window = this.#resolveAccessWindow(item.startAt, item.durationMinutes);
        if (!window) return false;
        return Date.now() > window.endAt.getTime();
    }

    async #autoMarkUnattended(req, extraFilter = {}) {
        const InterviewSchedule = req?.conn?.models?.InterviewSchedule;
        if (!InterviewSchedule) return;

        const now = new Date();
        const baseFilter = {
            client: req.client,
            isArchived: false,
            endedAt: null,
            ...extraFilter,
        };

        const statusFilter = {
            $not: /complete|cancel|miss|unattend/i,
        };

        const filter = {
            ...baseFilter,
            interviewStatus: statusFilter,
            startAt: { $ne: null },
            $expr: {
                $lt: [
                    {
                        $add: [
                            '$startAt',
                            {
                                $multiply: [
                                    { $ifNull: ['$durationMinutes', 45] },
                                    60000,
                                ],
                            },
                        ],
                    },
                    now,
                ],
            },
        };

        try {
            await InterviewSchedule.updateMany(filter, {
                $set: { interviewStatus: 'Missed' },
            });
        } catch (err) {
            console.warn('[InterviewScheduleService] Failed to auto-mark unattended interviews', err?.message || err);
        }
    }

    async refreshStatusIfNeeded(item, req) {
        if (!item || !req?.conn?.models?.InterviewSchedule) return item;
        if (!this.#shouldAutoMarkUnattended(item)) return item;

        try {
            await req.conn.models['InterviewSchedule'].updateOne(
                { _id: item._id, client: req.client },
                { $set: { interviewStatus: 'Missed' } }
            );
            return { ...item, interviewStatus: 'Missed' };
        } catch (err) {
            console.warn('[InterviewScheduleService] Failed to refresh interview status', err?.message || err);
            return item;
        }
    }

    #checkAccessWindow(item, req) {
        if (!item) return null;
        if (item.interviewMode && item.interviewMode !== 'Virtual') return null;

        const window = this.#resolveAccessWindow(item.startAt, item.durationMinutes);
        const expiryWindow = this.#resolveAccessExpiryWindow(item.startAt, 48);
        const requestTimezone = req?.clientTimezone || getRequestTimeZone(req);
        const displayTimezone = requestTimezone || item.timezone || DEFAULT_TIMEZONE;
        const startInfo = window
            ? this.#formatWhen(window.startAt, window.durationMinutes, displayTimezone)
            : null;
        const endInfo = expiryWindow
            ? this.#formatWhen(expiryWindow.endAt, window?.durationMinutes || 45, displayTimezone)
            : null;
        const windowText = (() => {
            if (!startInfo || !endInfo) return null;
            if (startInfo.dateStr === 'N/A' || endInfo.dateStr === 'N/A') return null;
            if (startInfo.dateStr === endInfo.dateStr) {
                return `on ${startInfo.dateStr} from ${startInfo.timeStr} to ${endInfo.timeStr}`;
            }
            return `from ${startInfo.dateStr} ${startInfo.timeStr} to ${endInfo.dateStr} ${endInfo.timeStr}`;
        })();

        if (!window || !expiryWindow) {
            return { ok: false, code: 403, message: 'Interview link is not valid' };
        }
        if (new Date() < window.startAt) {
            const message = windowText
                ? `This interview link is not active yet. It will be active ${windowText}.`
                : 'This interview link is not active yet.';
            return { ok: false, code: 403, message };
        }
        if (new Date() > expiryWindow.endAt) {
            const message = windowText
                ? `This interview link has expired. It was active ${windowText}.`
                : 'This interview link has expired.';
            return { ok: false, code: 410, message };
        }
        return null;
    }

    #isAiInterviewerType(item) {
        const type = String(item?.interviewerType || 'AI').trim().toLowerCase();
        return type === 'ai';
    }

    #publicBaseUrl(req) {
        return (
            process.env.PUBLIC_APP_URL ||
            // process.env.FRONTEND_ORIGIN ||
            process.env.BACKEND_ORIGIN ||
            req.headers['x-frontend-origin'] ||
            'https://hirexit.ai'
        ).replace(/\/+$/, '');
    }

    // UPDATED: carry interviewerType into URL as query param
    #buildWebrtcUrl({ candidateId, jobId, interviewerType, accessToken, scheduleId }, req) {
        const base = this.#publicBaseUrl(req);
        const params = new URLSearchParams();
        if (candidateId) params.set('cid', String(candidateId));
        if (jobId) params.set('jid', String(jobId));
        if (scheduleId) params.set('sid', String(scheduleId));
        if (interviewerType) params.set('itype', String(interviewerType));
        if (accessToken) params.set('token', String(accessToken));
        return `${base}/webrtcai?${params.toString()}`;
    }

    // Build concise JD facts + guardrails so the AI can answer common JD questions accurately.
    buildJDQnAGuidelinesWithFacts(job = {}) {
        return [
            `JD Q&A HANDLING`,
            `- If the candidate asks about salary, location, work mode/hybrid, shift/OT, benefits, visa, start date, or related job details, answer briefly using the facts below.`,
            `- If a fact is missing, say you don't have that detail yet and offer to note their preference for the recruiter.`,
            `- Do not negotiate or promise; keep answers under two sentences and non-committal.`,
            `- If the question is unrelated or sensitive, politely redirect to the recruiter.`,
            `- Before starting formal interview questions, invite the candidate to ask any quick JD clarifications (salary, location, work mode, shifts). Answer using the facts below, then proceed to Q1.`,
            ``,
            ...this.buildJobFacts(job),
            ``
        ];
    }

    buildJobFacts(job = {}) {
        const facts = [`JD FACTS (use these when answering questions):`];

        const salary = this.formatSalaryRange(job?.salary);
        facts.push(`- Salary range: ${salary || 'not specified'}`);

        const locations = this.formatLocations(job?.locations);
        facts.push(`- Location(s): ${locations || 'not specified'}`);

        const workMode = this.formatWorkMode(job?.workMode, job?.hybridDetails);
        facts.push(`- Work mode: ${workMode || 'not specified'}`);

        const walkIn = job?.isWalkIn ? 'Walk-in role; onsite presence required.' : 'Not a walk-in.';
        facts.push(`- Walk-in: ${walkIn}`);

        facts.push(`- Overtime/shift policy: not specified; escalate to recruiter if asked.`);
        facts.push(`- Benefits/perks: not specified; offer to note candidate preferences.`);
        facts.push(`- Visa/work authorization: not specified; request recruiter follow-up if asked.`);
        facts.push(`- Start date / notice expectations: not specified; offer to record candidate timeline.`);

        return facts;
    }

    formatSalaryRange(salary = {}) {
        const { min, max, currency } = salary || {};
        const cur = currency || 'INR';
        const hasMin = Number.isFinite(min);
        const hasMax = Number.isFinite(max);
        if (hasMin && hasMax) return `${cur} ${min} – ${max}`;
        if (hasMin) return `from ${cur} ${min}`;
        if (hasMax) return `up to ${cur} ${max}`;
        return '';
    }

    formatLocations(locations) {
        if (Array.isArray(locations) && locations.length) {
            return locations.join(', ');
        }
        return '';
    }

    formatWorkMode(workMode, hybridDetails) {
        if (!workMode) return '';
        if (workMode === 'Hybrid' && hybridDetails) {
            return `${workMode} (${hybridDetails})`;
        }
        return workMode;
    }

    #makeRandomPassword(len = 10) {
        return crypto.randomBytes(16).toString('base64')
            .replace(/[^a-zA-Z0-9]/g, '')
            .slice(0, len) || Math.random().toString(36).slice(-len);
    }

    // Template for WebRTCAI – TECHNICAL
    async buildTechnicalScriptTemplate({ candidate, job }) {
        const candName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
        const title = job?.title || 'the role';
        const company = job?.company?.name || 'our client';
        const primarySkills = Array.isArray(job?.primarySkills) ? job.primarySkills : [];
        const coreSkills = primarySkills.length ? primarySkills.join(', ') : '';

        return [
            ...this.buildJDQnAGuidelinesWithFacts(job),
            `GUIDELINES FOR AI INTERVIEWER`,
            `- Use the candidate's name only in the opening greeting. Do NOT greet them again in later questions.`,
            `- Ask ONE clear question at a time. Do not bundle multiple questions together.`,
            `- Wait for the candidate to finish before asking the next question.`,
            `- Keep follow-up questions short and specific.`,
            ``,
            `ROLE & CONTEXT`,
            `- Role: ${title} at ${company}.`,
            coreSkills
                ? `- Focus areas: ${coreSkills}.`
                : `- Focus on the candidate's core technical and leadership experience.`,
            ``,
            `PRE-START (ASK BEFORE Q1)`,
            `Ask: "Before we begin, do you have any quick questions about the role — salary range, locations, work mode/hybrid, shifts/OT, or anything else?"`,
            ``,
            `INTRO (ASK THIS FIRST)`,
            `Q1. "${candName}, before we dive in, please briefly walk me through your career so far, focusing on your most recent roles."`,
            ``,
            `BACKGROUND & LEADERSHIP`,
            `Q2. "In your most recent role, what was your scope of responsibility as an engineering leader?"`,
            `Q3. "How was your engineering organisation structured, and why did you choose that structure?"`,
            `Q4. "How did you align your engineering roadmap with the overall business strategy?"`,
            ``,
            `DELIVERY & METRICS`,
            `Q5. "What key metrics did you track to measure the health and performance of the engineering team?"`,
            `Q6. "Can you describe one initiative where those metrics clearly improved under your leadership?"`,
            ``,
            coreSkills
                ? `TECHNICAL DEPTH (based on ${coreSkills})`
                : `TECHNICAL DEPTH`,
            `Q7. "Describe a complex technical decision you made that had a major impact on the product or platform."`,
            `Q8. "What trade-offs did you consider, and why did you choose that approach?"`,
            ``,
            `EXECUTION & PROBLEM SOLVING`,
            `Q9. "Tell me about a serious production incident or crisis you handled. What went wrong and how did you respond?"`,
            `Q10. "What changes did you put in place afterwards to prevent similar issues?"`,
            ``,
            `TEAM & CULTURE`,
            `Q11. "How do you build and maintain a strong engineering culture across multiple teams?"`,
            `Q12. "How do you handle disagreements on technical direction with senior engineers or other leaders?"`,
            ``,
            `CLOSING`,
            `Q13. "What are you looking for in your next role as ${title}, and why does ${company} interest you?"`,
            `Q14. "Do you have any questions about the company or this role?"`
        ].join('\n');
    }

    // NEW: HR interview script template
    async buildHRScriptTemplate({ candidate, job }) {
        const candName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
        const title = job?.title || 'the role';
        const company = job?.company?.name || 'our client';

        return [
            `GUIDELINES FOR HR INTERVIEWER`,
            `- Focus on behaviour, communication, stability, and culture fit.`,
            `- Ask ONE clear question at a time and allow time to respond.`,
            `- Avoid personal / discriminatory questions; stay role-relevant.`,
            ``,
            `INTRO (ASK THIS FIRST)`,
            `Q1. "Hello ${candName}, thanks for taking the time today. This round is to understand your background, motivation and overall fit for the ${title} role at ${company}. To begin, can you walk me through your professional journey so far?"`,
            ``,
            `MOTIVATION & CAREER GOALS`,
            `Q2. "What attracted you to apply for this opportunity with ${company}?"`,
            `Q3. "How does this role fit into your medium-term career plans?"`,
            ``,
            `WAYS OF WORKING & VALUES`,
            `Q4. "Describe the kind of work culture where you perform at your best."`,
            `Q5. "Tell me about a time you had a disagreement at work. How did you handle it?"`,
            `Q6. "How do you like to receive feedback from your manager?"`,
            ``,
            `OWNERSHIP & ACCOUNTABILITY`,
            `Q7. "Describe a situation where you took ownership of an outcome beyond your defined responsibilities."`,
            `Q8. "Give an example of a commitment you could not meet. What did you do about it?"`,
            ``,
            `STRESS & ADAPTABILITY`,
            `Q9. "Share a recent situation where you had to work under pressure or tight timelines. How did you manage it?"`,
            `Q10. "Tell me about a time you had to adapt quickly to a major change at work."`,
            ``,
            `CLOSING & EXPECTATIONS`,
            `Q11. "What are your expectations from your next manager and team?"`,
            `Q12. "Do you have any concerns or questions about the role, team or organisation that I can clarify?"`
        ].join('\n');
    }

    // NEW: Psychometric interview script template
    async buildPsychometricScriptTemplate({ candidate, job }) {
        const candName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
        const title = job?.title || 'the role';
        const company = job?.company?.name || 'our client';

        return [
            `GUIDELINES FOR PSYCHOMETRIC INTERVIEWER`,
            `- Focus on decision-making style, problem-solving approach, and interpersonal tendencies.`,
            `- Avoid clinical or diagnostic language; this is not a therapy session.`,
            `- Ask ONE scenario at a time and probe with neutral follow-ups like "What would you do next?"`,
            ``,
            `INTRO`,
            `Q1. "Hi ${candName}, in this discussion I’ll walk you through a few hypothetical situations to understand how you typically think and respond at work, especially for the ${title} role at ${company}. There are no right or wrong answers; please just share what you would naturally do."`,
            ``,
            `DECISION MAKING`,
            `Q2. "Imagine you need to choose between two options: one is safe but slow, the other is risky but could give a big win. How would you decide which to pursue?"`,
            `Q3. "Tell me about a past situation where you had to make a decision with incomplete information. How did you proceed?"`,
            ``,
            `CONFLICT & COLLABORATION`,
            `Q4. "You strongly disagree with a direction the team is taking, but the rest of the team seems aligned. How would you handle this?"`,
            `Q5. "Describe how you typically behave when working with a colleague whose style is very different from yours."`,
            ``,
            `RESILIENCE & STRESS`,
            `Q6. "When you receive unexpected negative feedback, what is your first internal reaction and what do you actually do?"`,
            `Q7. "Think of a time when you faced repeated setbacks on an important task. How did you keep yourself moving forward?"`,
            ``,
            `SELF-AWARENESS`,
            `Q8. "What are two strengths that people can reliably expect from you at work?"`,
            `Q9. "What is one area you consciously work on improving, and how are you going about it?"`,
            ``,
            `CLOSING`,
            `Q10. "Is there anything about how you prefer to work or be managed that you feel is important for us to know for this role?"`
        ].join('\n');
    }

    // NEW: Non-technical (functional / business) interview script template
    async buildNonTechnicalScriptTemplate({ candidate, job }) {
        const candName = `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
        const title = job?.title || 'the role';
        const company = job?.company?.name || 'our client';

        return [
            `GUIDELINES FOR NON-TECHNICAL INTERVIEWER`,
            `- Focus on domain understanding, stakeholder management, communication and execution.`,
            `- Questions should be practical and scenario based.`,
            `- Ask ONE question at a time and keep the tone conversational but professional.`,
            ``,
            `INTRO`,
            `Q1. "Hi ${candName}, thanks for joining. This round is to understand your functional experience and how you operate in your role, specifically for the ${title} position at ${company}. Could you start with a brief overview of your current responsibilities?"`,
            ``,
            `ROLE UNDERSTANDING`,
            `Q2. "How do you define success in your current role on a day-to-day and quarter-to-quarter basis?"`,
            `Q3. "Tell me about one initiative you led recently and the business outcome it drove."`,
            ``,
            `STAKEHOLDER MANAGEMENT`,
            `Q4. "Describe a situation where different stakeholders had conflicting priorities. How did you manage alignment?"`,
            `Q5. "How do you typically communicate progress, risks and decisions to senior stakeholders?"`,
            ``,
            `PLANNING & EXECUTION`,
            `Q6. "Walk me through how you break down a large piece of work into an executable plan."`,
            `Q7. "Share an example where you had to re-plan mid-way due to new information. What changed and what did you do?"`,
            ``,
            `RISK & GOVERNANCE`,
            `Q8. "What kind of risks do you typically track in your work and how do you mitigate them?"`,
            `Q9. "Tell me about a time you had to push back on an unrealistic request."`,
            ``,
            `CLOSING`,
            `Q10. "What type of team and manager do you work best with to be effective in a role like ${title}?"`
        ].join('\n');
    }

    async buildScriptTemplateByInterviewType({ interviewType, candidate, job }) {
        const type = String(interviewType || 'Technical').trim();
        if (type === 'HR') return this.buildHRScriptTemplate({ candidate, job });
        if (type === 'Psychometric') return this.buildPsychometricScriptTemplate({ candidate, job });
        if (type === 'Non-Technical') return this.buildNonTechnicalScriptTemplate({ candidate, job });
        return this.buildTechnicalScriptTemplate({ candidate, job });
    }

    async createWithCombine(payload, req) {
        const {
            candidateATS,
            candidate,
            job,
            targetStageId,
            targetStageTitle,
            interviewMode,
            meetingLink,
            locationAddress,
            interviewDate,
            startTime,
            durationMinutes,
            timezone: incomingTimezone,
            notes,
            interviewers = [],
            selectedBlueprint = [],
            technicalScript: incomingScript = '',
            interviewerType,
            interviewType,        // NEW: comes from frontend form
            difficultyLevel       // NEW: difficulty level from frontend
        } = payload || {};

        if (!candidateATS) return { ok: false, code: 400, message: 'candidateATS is required' };
        if (!interviewDate) return { ok: false, code: 400, message: 'interviewDate is required' };
        if (!startTime) return { ok: false, code: 400, message: 'startTime is required' };

        const atsDoc = await req.conn.models['CandidateATS']
            .findOne({ _id: candidateATS, client: req.client })
            .select('candidate job stageResults')
            .populate({
                path: 'stageResults',
                select: 'stage',
                populate: {
                    path: 'stage',
                    select: 'title',
                    match: { isArchived: false },
                },
            })
            .lean()
            .exec();

        if (!atsDoc) return { ok: false, code: 404, message: 'CandidateATS not found' };

        const candId = candidate || atsDoc.candidate;
        const jobId = job || atsDoc.job;
        const requestedTargetStageId =
            targetStageId && mongoose.Types.ObjectId.isValid(targetStageId)
                ? String(targetStageId)
                : '';
        const requestedTargetStageTitle = String(targetStageTitle || '').trim();
        const atsStages = (atsDoc.stageResults || [])
            .filter((stageResult) => stageResult?.stage)
            .map((stageResult) => ({
                stageId: String(stageResult.stage?._id || ''),
                stageTitle: String(stageResult.stage?.title || '').trim(),
            }));

        let resolvedTargetStage = null;
        if (requestedTargetStageId) {
            resolvedTargetStage = atsStages.find((stage) => stage.stageId === requestedTargetStageId) || null;
        }
        if (!resolvedTargetStage && requestedTargetStageTitle) {
            const requestedTitleKey = this.#normalizeStageKey(requestedTargetStageTitle);
            resolvedTargetStage = atsStages.find((stage) => (
                this.#normalizeStageKey(stage.stageTitle) === requestedTitleKey
            )) || null;
        }

        if ((requestedTargetStageId || requestedTargetStageTitle) && !resolvedTargetStage) {
            return { ok: false, code: 400, message: 'Selected stage is not valid for this application' };
        }

        // Fetch candidate + job for script + email + login
        const m = req.conn.models;
        const [candDoc, jobDoc] = await Promise.all([
            m['Candidate'].findOne({ _id: candId, client: req.client })
                .select('firstName lastName email countryCode phoneNumber')
                .lean().exec(),
            m['Job'].findOne({ _id: jobId, client: req.client })
                .select('title internalTitle jobType status location locations postedOn description company primarySkills')
                .populate({ path: 'company', select: 'name' })
                .lean().exec()
        ]);

        if (!candDoc) return { ok: false, code: 404, message: 'Candidate not found' };
        if (!jobDoc) return { ok: false, code: 404, message: 'Job not found' };

        const requestTimezone = req?.clientTimezone || getRequestTimeZone(req);
        const jobTimezone = this.#resolveTimezoneFromJob(jobDoc);
        const resolvedTimezone = normalizeTimeZone(
            incomingTimezone || jobTimezone || requestTimezone,
            DEFAULT_TIMEZONE
        );

        const startAt = localDateTimeToUtc(
            interviewDate,
            startTime.length === 5 ? `${startTime}:00` : startTime,
            resolvedTimezone
        );
        if (isNaN(startAt.getTime())) return { ok: false, code: 400, message: 'Invalid interviewDate/startTime' };

        // Final interviewer type (default AI if not provided)
        const finalInterviewerType = interviewerType || 'AI';

        if (
            (finalInterviewerType === 'Human' || finalInterviewerType === 'Human+AI') &&
            (!Array.isArray(interviewers) || interviewers.length === 0)
        ) {
            return {
                ok: false,
                code: 400,
                message: 'Select at least one interviewer for Human or Human+AI.'
            };
        }

        // NEW: Final interview type (Technical / HR / Psychometric / Non-Technical)
        const finalInterviewType = interviewType || 'Technical';

        // NEW: Final difficulty level (Easy / Intermediate / Advanced)
        const finalDifficultyLevel = difficultyLevel || 'Intermediate';

        const isVideoInterview = interviewMode === 'Virtual';
        let clientAdminUserId = null;
        let globalConn = null;

        if (isVideoInterview) {
            try {
                const roleForOwnership = req.user?.originalRole || req.user?.role;
                clientAdminUserId =
                    roleForOwnership === 'client_admin'
                        ? (req.user._id || req.user.sub)
                        : req.user.client;
                globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

                const clientAdminDoc = await globalConn.models.ClientAdmin.findOne({
                    user: clientAdminUserId,
                    isArchived: false
                }).lean().exec();

                if (!clientAdminDoc) {
                    return { ok: false, code: 404, message: 'Client admin not found' };
                }

                const usedVideoCredits = clientAdminDoc.videoInterviewCount || 0;
                const totalVideoCredits = clientAdminDoc.videoInterviewCredit ?? 0;
                if (usedVideoCredits >= totalVideoCredits) {
                    return {
                        ok: false,
                        code: 402,
                        message: 'Video interview credits exhausted. Please contact administrator.'
                    };
                }
            } catch (err) {
                console.error('[InterviewScheduleService] Failed to validate video credits:', err);
                return { ok: false, code: 500, message: 'Failed to validate video interview credits' };
            }
        }

        // Phone interviews always require a dial/meeting link
        if (interviewMode === 'Phone') {
            if (!meetingLink || !String(meetingLink).trim()) {
                return {
                    ok: false,
                    code: 400,
                    message: 'meetingLink is required for Phone interviews'
                };
            }
        }

        // Script: only auto-generate for AI interviews; keep optional for Human/Human+AI.
        let technicalScript = typeof incomingScript === 'string' ? incomingScript.trim() : '';
        if (finalInterviewerType === 'AI' && !technicalScript) {
            technicalScript = await this.buildScriptTemplateByInterviewType({
                interviewType: finalInterviewType,
                candidate: candDoc,
                job: jobDoc
            });
        }

        const shouldLockWebrtcLink = interviewMode === 'Virtual';
        const webrtcAccessToken = shouldLockWebrtcLink
            ? crypto.randomBytes(24).toString('hex')
            : null;
        const accessWindow = this.#resolveAccessWindow(startAt, durationMinutes);
        const normalizedDurationMinutes = accessWindow?.durationMinutes ?? 45;
        const expiryWindow = this.#resolveAccessExpiryWindow(startAt, 48);
        const webrtcAccessExpiresAt = interviewMode === 'Virtual'
            ? expiryWindow?.endAt || null
            : null;

        // Build WebRTC URL for virtual interviews
        let effectiveMeetingLink = meetingLink || null;
        let webrtcLink = null;

        // DEBUG: See what values your backend is using
        // console.log("HEADER ORIGIN:", req.headers['x-frontend-origin']);
        // console.log("PUBLIC_APP_URL:", process.env.PUBLIC_APP_URL);
        // console.log("FRONTEND_ORIGIN:", process.env.FRONTEND_ORIGIN);
        // console.log("BACKEND_ORIGIN:", process.env.BACKEND_ORIGIN);

        const scheduleId = new mongoose.Types.ObjectId();

        if (interviewMode === 'Virtual') {
            // Always use WebRTC URL as the meeting link for Virtual interviews,
            // regardless of interviewer type (AI / Human / Human+AI).
            // IMPORTANT: we pass interviewerType so the WebRTC page can disable AI when needed.
            webrtcLink = this.#buildWebrtcUrl(
                {
                    candidateId: candId,
                    jobId,
                    interviewerType: finalInterviewerType,
                    accessToken: webrtcAccessToken,
                    scheduleId
                },
                req
            );
            effectiveMeetingLink = webrtcLink;
        }

        const doc = {
            _id: scheduleId,
            candidateATS,
            candidate: candId,
            job: jobId,
            interviewMode,
            meetingLink: interviewMode === 'Phone' ? (meetingLink || null) : effectiveMeetingLink,
            locationAddress: interviewMode === 'Onsite' ? (locationAddress || null) : null,
            webrtcLink,
            webrtcAccessToken,
            webrtcAccessExpiresAt,
            webrtcAccessUsedAt: null,
            startAt,
            timezone: resolvedTimezone,
            durationMinutes: normalizedDurationMinutes,
            notes: notes || '',
            interviewerType: finalInterviewerType,
            interviewType: finalInterviewType,             // NEW: persist type
            targetStageId: resolvedTargetStage?.stageId || null,
            targetStageTitle: resolvedTargetStage?.stageTitle || requestedTargetStageTitle || null,
            difficultyLevel: finalDifficultyLevel,         // NEW: persist difficulty

            // ✅ NEW: Persist round configuration
            roundType: payload.roundType || 'Speaking',
            codingConfig: payload.codingConfig || {
                questionLevel: payload.codingQuestionLevel || 'Medium',
                averageTestCases: payload.codingTestCases || 5,
                questionType: payload.codingQuestionType || 'DSA'
            },

            interviewers,
            technicalScript,
            selectedBlueprint: Array.isArray(selectedBlueprint) ? selectedBlueprint : [],
            client: req.client
        };

        try {
            const created = await this.create(doc, req);
            try {
                await this.#syncTargetStageStatus(created, 'Selected', req);
            } catch (stageSyncErr) {
                console.warn('[InterviewScheduleService] Failed to mark selected target stage:', stageSyncErr?.message || stageSyncErr);
            }

            // notify + email async
            (async () => {
                const Notification = req.conn.models['Notification'];
                const m = req.conn.models;

                const interviewerDocs = await m['User'].find({
                    _id: { $in: (interviewers || []) },
                    client: req.client
                })
                    .select('firstName lastName email role')
                    .lean()
                    .exec();

                const notificationPrefs = await getNotificationPreferences(req);
                const isTeamRole = (role) =>
                    ['client_admin', 'recruiter'].includes(String(role || '').toLowerCase());
                const allowInAppFor = (role, key) =>
                    !isTeamRole(role) || isInAppNotificationEnabled(notificationPrefs, key);

                const when = this.#formatWhen(
                    created.startAt,
                    created.durationMinutes,
                    created.timezone || resolvedTimezone
                );
                const mode = created.interviewMode;
                const place = mode === 'Onsite' ? (created.locationAddress || 'N/A') : (created.meetingLink || 'N/A');
                const candidateName = `${candDoc?.firstName || ''} ${candDoc?.lastName || ''}`.trim() || 'Candidate';
                const companyName = jobDoc?.company?.name || 'our client';
                const jobTitle = jobDoc?.title || 'Job';

                const recruiterUserId = req?.user?._id || req?.user?.sub || null;
                const recruiterRole = req?.user?.role || '';

                // notifications: interviewer(s)
                const interviewerNotifs = (interviewerDocs || [])
                    .filter((iv) => allowInAppFor(iv?.role, 'hiringActivity.interviewScheduled'))
                    .map(iv => ({
                        client: req.client,
                        user: iv?._id,
                        category: 'Interview',
                        source: 'Scheduler',
                        content: `Interview scheduled with ${candidateName} for ${jobTitle} (${companyName}) on ${when.dateStr} at ${when.timeStr}.`,
                        href: `/interviews`,
                    }));

                // notification: creator
                const creatorNotif =
                    recruiterUserId && allowInAppFor(recruiterRole, 'hiringActivity.interviewScheduled')
                        ? [{
                            client: req.client,
                            user: recruiterUserId,
                            category: 'Interview',
                            source: 'Scheduler',
                            content: `You scheduled an interview for ${candidateName} • ${jobTitle} on ${when.dateStr} at ${when.timeStr}.`,
                            href: `/interviews`
                        }]
                        : [];

                try {
                    const toInsert = [...interviewerNotifs, ...creatorNotif].filter(Boolean);
                    if (toInsert.length) await Notification.insertMany(toInsert, { ordered: false });
                } catch (e) {
                    console.warn('Interview notifications insert failed', e?.message || e);
                }

                // candidate user + email
                const placeLabel = mode === 'Onsite' ? 'Address' : (mode === 'Phone' ? 'Dial/Link' : 'Meeting Link');
                const base = this.#publicBaseUrl(req);

                let loginEmail = null;
                let loginPassword = null;

                if (candDoc?.email) {
                    const UserModel = m['User'];
                    let existingUser = await UserModel.findOne({
                        email: candDoc.email.toLowerCase(),
                        client: req.client
                    }).exec();

                    if (!existingUser) {
                        loginEmail = candDoc.email.toLowerCase();

                        // password = firstName@321
                        const baseFirstName =
                            (candDoc.firstName || 'Candidate').trim() || 'Candidate';
                        loginPassword = `${baseFirstName}@321`;

                        try {
                            const newUser = new UserModel({
                                email: loginEmail,
                                password: loginPassword,
                                firstName: candDoc.firstName || 'Candidate',
                                lastName: candDoc.lastName || '',
                                role: 'candidate',
                                client: req.client,
                                countryCode: candDoc.countryCode || '',
                                phoneNumber: candDoc.phoneNumber || ''
                            });
                            await newUser.save();
                        } catch (e) {
                            console.error('Failed to create candidate user account', e?.message || e);
                            loginEmail = null;
                            loginPassword = null;
                        }
                    } else {
                        loginEmail = existingUser.email;
                        loginPassword = this.#makeRandomPassword();

                        try {
                            existingUser.password = loginPassword;
                            await existingUser.save();
                        } catch (e) {
                            console.error('Failed to reset candidate user password', e?.message || e);
                            loginPassword = null;
                        }
                    }

                    try {
                        await sendInterviewScheduledCandidateEmail({
                            to: candDoc.email,
                            candidateName,
                            jobTitle,
                            companyName,
                            dateStr: when.dateStr,
                            timeStr: when.timeStr,
                            durationStr: when.durationStr,
                            mode,
                            place,
                            notes: created.notes || '',
                            loginEmail,
                            loginPassword,
                            interviewerType: finalInterviewerType,
                            interviewType: finalInterviewType,
                            webrtcLink: created.webrtcLink,
                            urlOrigin: base,
                            reqContext: req,
                        });
                    } catch (e) {
                        // swallow email errors
                    }
                }

                // interviewer emails or notify creator
                const isHumanInterviewerType = ['human', 'human+ai', 'human + ai', 'human & ai'].includes(
                    String(finalInterviewerType || '').trim().toLowerCase()
                );
                for (const iv of (interviewerDocs || [])) {
                    const name = `${iv.firstName || ''} ${iv.lastName || ''}`.trim() || 'Interviewer';
                    if (iv?.email) {
                        let ivLoginEmail = null;
                        let ivLoginPassword = null;

                        if (isHumanInterviewerType) {
                            try {
                                const ivUser = await m['User'].findOne({
                                    _id: iv._id,
                                    client: req.client
                                }).exec();
                                if (ivUser) {
                                    ivLoginEmail = ivUser.email;
                                    ivLoginPassword = this.#makeRandomPassword();
                                    ivUser.password = ivLoginPassword;
                                    await ivUser.save();
                                }
                            } catch (e) {
                                console.error('[InterviewScheduleService] Failed to reset interviewer password', e?.message || e);
                                ivLoginEmail = null;
                                ivLoginPassword = null;
                            }
                        }

                        try {
                            await sendInterviewScheduledInterviewerEmail({
                                to: iv.email,
                                interviewerName: name,
                                candidateName,
                                jobTitle,
                                companyName,
                                dateStr: when.dateStr,
                                timeStr: when.timeStr,
                                durationStr: when.durationStr,
                                mode,
                                place,
                                notes: created.notes || '',
                                loginEmail: ivLoginEmail,
                                loginPassword: ivLoginPassword,
                                interviewerType: finalInterviewerType,
                                interviewType: finalInterviewType,
                                urlOrigin: base,
                                reqContext: req,
                            });
                        } catch (e) {
                            if (recruiterUserId && allowInAppFor(recruiterRole)) {
                                await Notification.create({
                                    client: req.client,
                                    user: recruiterUserId,
                                    category: 'email',
                                    source: 'Scheduler',
                                    content: `Interview email to ${name} failed for ${candidateName} (${jobTitle}).`,
                                    href: `/interviews`
                                });
                            }
                        }
                    } else if (recruiterUserId) {
                        if (allowInAppFor(recruiterRole)) {
                            await Notification.create({
                                client: req.client,
                                user: recruiterUserId,
                                category: 'email',
                                source: 'Scheduler',
                                content: `No email for interviewer ${name}. Share details manually for ${candidateName} (${jobTitle}).`,
                                href: `/interviews`
                            });
                        }
                    }
                }
            })();

            return { ok: true, code: 201, item: created };
        } catch (err) {
            return { ok: false, code: 400, message: err?.message || 'Failed to create interview' };
        }
    }

    #isCodingInterviewSchedule(item) {
        const roundType = String(item?.roundType || '').trim().toLowerCase();
        const interviewType = String(item?.interviewType || '').trim().toLowerCase();
        return roundType.includes('coding') || interviewType.includes('coding');
    }

    #toFiniteNumberOrNull(value) {
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
    }

    #clampScore(value) {
        if (typeof value !== 'number' || Number.isNaN(value)) return null;
        return Math.max(0, Math.min(100, Math.round(value)));
    }

    #normalizeInterviewerTypeKey(value) {
        const raw = String(value || '').trim().toLowerCase();
        if (!raw) return 'ai';
        if (raw === 'human+ai' || raw === 'human + ai' || raw === 'human & ai') return 'human+ai';
        if (raw === 'human') return 'human';
        if (raw === 'ai') return 'ai';
        if (raw.includes('human') && raw.includes('ai')) return 'human+ai';
        return raw;
    }

    #normalizeParamKey(value) {
        return String(value || '').trim().toLowerCase();
    }

    #normalizeParamItem(name, value) {
        const cleanName = typeof name === 'string' ? name.trim() : '';
        if (!cleanName) return null;

        if (typeof value === 'number') {
            return { name: cleanName, score: this.#clampScore(value), reason: null, weight: 1 };
        }

        const scoreVal =
            value?.score ??
            value?.value ??
            value?.percentage ??
            value?.obtainedScore ??
            value?.totalScore ??
            null;

        const weightVal =
            value?.weight ??
            value?.weightage ??
            value?.weightScore ??
            null;

        const reason =
            (typeof value?.reason === 'string' && value.reason.trim()) ||
            (typeof value?.feedback === 'string' && value.feedback.trim()) ||
            (typeof value?.comment === 'string' && value.comment.trim()) ||
            (typeof value?.summary === 'string' && value.summary.trim()) ||
            null;

        const weight =
            typeof weightVal === 'number' && Number.isFinite(weightVal) && weightVal > 0
                ? weightVal
                : 1;

        return {
            name: cleanName,
            score: this.#clampScore(scoreVal),
            reason,
            weight,
        };
    }

    #getParameterWiseScores(row) {
        const raw =
            row?.evaluation?.parameters ||
            row?.evaluationBreakdown?.parameters ||
            row?.evaluationBreakdown?.parameterWiseEvaluation ||
            row?.evaluationBreakdown?.parameterWiseScores ||
            row?.evaluationBreakdown?.parameterWise ||
            row?.parameterWiseEvaluation ||
            row?.evaluation?.parameterWise ||
            row?.evaluation?.parameterWiseScores ||
            null;

        if (!raw) return [];

        if (Array.isArray(raw)) {
            return raw
                .map((entry) => {
                    const name =
                        (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                        (typeof entry?.name === 'string' && entry.name.trim()) ||
                        (typeof entry?.title === 'string' && entry.title.trim()) ||
                        (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                        '';
                    return this.#normalizeParamItem(name, entry);
                })
                .filter(Boolean);
        }

        if (typeof raw === 'object') {
            if (Array.isArray(raw.parameters)) {
                return raw.parameters
                    .map((entry) => {
                        const name =
                            (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                            (typeof entry?.name === 'string' && entry.name.trim()) ||
                            (typeof entry?.title === 'string' && entry.title.trim()) ||
                            (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                            '';
                        return this.#normalizeParamItem(name, entry);
                    })
                    .filter(Boolean);
            }

            if (Array.isArray(raw.scores)) {
                return raw.scores
                    .map((entry) => {
                        const name =
                            (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                            (typeof entry?.name === 'string' && entry.name.trim()) ||
                            (typeof entry?.title === 'string' && entry.title.trim()) ||
                            (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                            '';
                        return this.#normalizeParamItem(name, entry);
                    })
                    .filter(Boolean);
            }

            return Object.entries(raw)
                .map(([key, val]) => this.#normalizeParamItem(key, val))
                .filter(Boolean);
        }

        return [];
    }

    #getCoveredParametersScore(row) {
        const parameterWise = this.#getParameterWiseScores(row);
        if (!parameterWise.length) return null;

        const parameterEvidenceStats =
            row?.evaluationBreakdown?.parameterEvidenceStats ||
            row?.evaluation?.breakdown?.parameterEvidenceStats ||
            row?.evaluationBreakdown?.breakdown?.parameterEvidenceStats ||
            row?.evaluation?.parameterEvidenceStats ||
            row?.parameterEvidenceStats ||
            null;

        const evidenceOkByParam = new Map(
            parameterEvidenceStats && typeof parameterEvidenceStats === 'object'
                ? Object.entries(parameterEvidenceStats).map(([key, val]) => [
                    this.#normalizeParamKey(key),
                    !!val?.ok,
                ])
                : []
        );

        const isParamCovered = (param) => {
            const key = this.#normalizeParamKey(param?.name);
            if (!key) return false;

            const evidenceFlag = evidenceOkByParam.get(key);
            if (typeof evidenceFlag === 'boolean') return evidenceFlag;

            if (key === this.#normalizeParamKey(COMMUNICATION_PARAMETER_NAME)) {
                return typeof param?.score === 'number' && Number.isFinite(param.score);
            }

            if (typeof param?.score !== 'number' || Number.isNaN(param.score)) return false;
            const reason = String(param?.reason || '').toLowerCase();
            if (reason.includes('insufficient evidence') || reason.includes('no substantial answer')) {
                return false;
            }
            return true;
        };

        const getParamWeight = (param) =>
            typeof param?.weight === 'number' && Number.isFinite(param.weight) && param.weight > 0
                ? param.weight
                : 1;

        const scoredParams = parameterWise.filter((param) => typeof param.score === 'number' && !Number.isNaN(param.score));
        const completedParams = scoredParams.filter(isParamCovered);

        const completedWeightSum = completedParams.reduce((acc, param) => acc + getParamWeight(param), 0);
        if (completedWeightSum <= 0) return null;

        const completedWeightedSum = completedParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);
        return this.#clampScore(completedWeightedSum / completedWeightSum);
    }

    #getHolisticInterviewScore(row) {
        return this.#clampScore(
            row?.evaluationScore ??
            row?.evaluation?.totalScore ??
            row?.evaluation?.score ??
            row?.evaluation?.overallScore ??
            row?.evaluationBreakdown?.totalScore ??
            row?.evaluationBreakdown?.evaluationScore ??
            row?.evaluationBreakdown?.score ??
            null
        );
    }

    #shouldHideScoreForStatus(statusLabel) {
        return SCORELESS_STATUS_KEYS.has(String(statusLabel || '').trim().toLowerCase());
    }

    #getDisplayScoreForSort(item) {
        if (this.#shouldHideScoreForStatus(item?.statusLabel)) return null;

        if (this.#isCodingInterviewSchedule(item)) {
            const passed = this.#toFiniteNumberOrNull(item?.codingPassedTestCases);
            const total = this.#toFiniteNumberOrNull(item?.codingTotalTestCases);
            if (passed === null || total === null || total <= 0) return null;
            return this.#clampScore((passed / total) * 100);
        }

        const interviewerTypeKey = this.#normalizeInterviewerTypeKey(item?.interviewerType);
        if (interviewerTypeKey === 'human') return null;

        const holisticInterviewScore = this.#getHolisticInterviewScore(item);
        if (interviewerTypeKey === 'human+ai') {
            return holisticInterviewScore;
        }

        const coveredParametersScore = this.#getCoveredParametersScore(item);
        return coveredParametersScore ?? holisticInterviewScore;
    }

    #sortItemsByDisplayScore(items, sortDir) {
        const dir = sortDir === 1 ? 1 : -1;
        const decorated = (items || []).map((item, index) => ({
            item,
            index,
            score: this.#getDisplayScoreForSort(item),
            idKey: String(item?._id || item?.id || ''),
        }));

        decorated.sort((a, b) => {
            const aHasScore = typeof a.score === 'number' && Number.isFinite(a.score);
            const bHasScore = typeof b.score === 'number' && Number.isFinite(b.score);

            if (aHasScore !== bHasScore) {
                return aHasScore ? -1 : 1;
            }

            if (aHasScore && bHasScore && a.score !== b.score) {
                return dir === 1 ? a.score - b.score : b.score - a.score;
            }

            if (a.idKey !== b.idKey) {
                return a.idKey.localeCompare(b.idKey);
            }
            return a.index - b.index;
        });

        return decorated.map((entry) => entry.item);
    }

    async #attachCodingSubmissionStats(items, req) {
        if (!Array.isArray(items) || !items.length) return items;

        const Submission = req?.conn?.models?.Submission;
        if (!Submission) return items;

        const codingScheduleIds = items
            .filter((item) => this.#isCodingInterviewSchedule(item))
            .map((item) => item?._id || item?.id)
            .filter((value) => mongoose.Types.ObjectId.isValid(value))
            .map((value) => new mongoose.Types.ObjectId(value));

        if (!codingScheduleIds.length) return items;

        let statsByInterviewId = new Map();
        try {
            const bestSubmissionPerInterview = await Submission.aggregate([
                {
                    $match: {
                        interviewId: { $in: codingScheduleIds },
                        status: { $nin: ['queued', 'running'] },
                    },
                },
                {
                    $addFields: {
                        _priorityFinal: { $cond: [{ $eq: ['$isFinalSubmission', true] }, 1, 0] },
                        _passedSort: { $ifNull: ['$passedTestCases', -1] },
                    },
                },
                {
                    $sort: {
                        interviewId: 1,
                        _priorityFinal: -1,
                        _passedSort: -1,
                        createdAt: -1,
                    },
                },
                {
                    $group: {
                        _id: '$interviewId',
                        submission: { $first: '$$ROOT' },
                    },
                },
                {
                    $project: {
                        _id: 1,
                        passedTestCases: '$submission.passedTestCases',
                        totalTestCases: '$submission.totalTestCases',
                        isFinalSubmission: '$submission.isFinalSubmission',
                    },
                },
            ]).exec();

            statsByInterviewId = new Map(
                bestSubmissionPerInterview.map((entry) => [
                    String(entry?._id),
                    {
                        passedTestCases: this.#toFiniteNumberOrNull(entry?.passedTestCases),
                        totalTestCases: this.#toFiniteNumberOrNull(entry?.totalTestCases),
                        isFinalSubmission: Boolean(entry?.isFinalSubmission),
                    },
                ])
            );
        } catch (err) {
            console.warn('[InterviewScheduleService] Failed to load coding submission stats', err?.message || err);
        }

        return items.map((item) => {
            if (!this.#isCodingInterviewSchedule(item)) return item;

            const key = String(item?._id || item?.id || '');
            const stats = statsByInterviewId.get(key);
            const fallbackTotal = this.#toFiniteNumberOrNull(item?.codingConfig?.averageTestCases);
            const totalTestCases = stats?.totalTestCases ?? fallbackTotal;

            return {
                ...item,
                codingPassedTestCases: stats?.passedTestCases ?? null,
                codingTotalTestCases: totalTestCases,
                codingSubmissionIsFinal: stats?.isFinalSubmission ?? false,
            };
        });
    }

    async listByATS(payloadOrAts, req) {
        const payload = (payloadOrAts && typeof payloadOrAts === 'object' && !Array.isArray(payloadOrAts))
            ? payloadOrAts
            : { candidateATS: payloadOrAts };

        const {
            candidateATS = undefined,
            candidateId = undefined,
            jobId = undefined,
            archived = undefined,
            page = undefined,
            pageSize = undefined,
            sortBy = undefined,
            sortOrder = undefined,
            search = undefined,
            filterField = undefined,
            filterValue = undefined,
            dateFrom = undefined,
            dateTo = undefined,
            statusTab = undefined,
        } = payload || {};

        const filter = { client: req.client, isArchived: false };
        if (candidateATS && mongoose.Types.ObjectId.isValid(candidateATS)) {
            filter.candidateATS = new mongoose.Types.ObjectId(candidateATS);
        }
        if (candidateId && mongoose.Types.ObjectId.isValid(candidateId)) {
            filter.candidate = new mongoose.Types.ObjectId(candidateId);
        }
        if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
            filter.job = new mongoose.Types.ObjectId(jobId);
        }

        const archivedValue = archived === undefined || archived === null
            ? null
            : String(archived).trim().toLowerCase();
        if (archivedValue === 'true') {
            filter.isArchived = true;
        } else if (archivedValue !== 'all') {
            filter.isArchived = false;
        }

        const hasServerSide =
            page !== undefined ||
            pageSize !== undefined ||
            sortBy ||
            sortOrder ||
            (search && String(search).trim()) ||
            filterField ||
            filterValue ||
            dateFrom ||
            dateTo ||
            (statusTab && String(statusTab).trim().toLowerCase() !== 'all');

        if (!hasServerSide) {
            if (archivedValue !== 'true') {
                await this.#autoMarkUnattended(req, filter);
            }
            const items = await req.conn.models['InterviewSchedule']
                .find(filter)
                .populate([
                    { path: 'candidate', select: 'firstName lastName email countryCode phoneNumber skills resumeUrl createdAt jobs' },
                    { path: 'job', select: 'title internalTitle jobType status location locations postedOn description company primarySkills', populate: { path: 'company', select: 'name' } },
                    { path: 'interviewers', select: 'firstName lastName email role' },
                    { path: 'client', select: 'firstName lastName email role' }
                ])
                .sort({ startAt: -1 })
                .lean()
                .exec();

            const itemsWithCodingStats = await this.#attachCodingSubmissionStats(items, req);
            return { ok: true, code: 200, items: itemsWithCodingStats };
        }

        const escapeRegex = (value) =>
            String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const buildRegex = (value, exact = false) => {
            const safe = escapeRegex(value);
            return new RegExp(exact ? `^${safe}$` : safe, 'i');
        };

        if (archivedValue !== 'true') {
            await this.#autoMarkUnattended(req, filter);
        }

        const pipeline = [{ $match: filter }];

        const normalizedField = String(filterField || '').trim();
        const normalizedValue = String(filterValue || '').trim();
        const normalizedStatusTab = String(statusTab || '').trim().toLowerCase();

        let pendingFilter = null;

        if (normalizedField === 'startAt' && (dateFrom || dateTo)) {
            const dateMatch = {};
            const fromVal = String(dateFrom || '').trim();
            const toVal = String(dateTo || '').trim();
            if (fromVal) {
                const fromDate = new Date(`${fromVal}T00:00:00.000Z`);
                if (!Number.isNaN(fromDate.getTime())) {
                    dateMatch.$gte = fromDate;
                }
            }
            if (toVal) {
                const toDate = new Date(`${toVal}T23:59:59.999Z`);
                if (!Number.isNaN(toDate.getTime())) {
                    dateMatch.$lte = toDate;
                }
            }
            if (Object.keys(dateMatch).length) {
                pipeline.push({ $match: { startAt: dateMatch } });
            }
        } else if (
            normalizedField &&
            normalizedField !== 'all' &&
            normalizedValue &&
            normalizedValue !== 'all'
        ) {
            const exactRegex = buildRegex(normalizedValue, true);
            pendingFilter = { field: normalizedField, value: exactRegex };
        }

        pipeline.push(
            {
                $lookup: {
                    from: 'candidates',
                    localField: 'candidate',
                    foreignField: '_id',
                    as: 'candidateDoc'
                }
            },
            { $unwind: { path: '$candidateDoc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'jobs',
                    localField: 'job',
                    foreignField: '_id',
                    as: 'jobDoc'
                }
            },
            { $unwind: { path: '$jobDoc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'companies',
                    localField: 'jobDoc.company',
                    foreignField: '_id',
                    as: 'companyDoc'
                }
            },
            { $unwind: { path: '$companyDoc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'interviewers',
                    foreignField: '_id',
                    as: 'interviewersDoc'
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'client',
                    foreignField: '_id',
                    as: 'clientDoc'
                }
            },
            { $unwind: { path: '$clientDoc', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    candidateName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$candidateDoc.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$candidateDoc.lastName', ''] }
                                ]
                            }
                        }
                    },
                    candidateEmail: '$candidateDoc.email',
                    jobTitle: { $ifNull: ['$jobDoc.title', ''] },
                    jobInternalTitle: { $ifNull: ['$jobDoc.internalTitle', ''] },
                    interviewerNames: {
                        $map: {
                            input: '$interviewersDoc',
                            as: 'iv',
                            in: {
                                $trim: {
                                    input: {
                                        $concat: [
                                            { $ifNull: ['$$iv.firstName', ''] },
                                            ' ',
                                            { $ifNull: ['$$iv.lastName', ''] }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    createdByName: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: ['$clientDoc.firstName', ''] },
                                    ' ',
                                    { $ifNull: ['$clientDoc.lastName', ''] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    interviewerNamesStr: {
                        $trim: {
                            input: {
                                $reduce: {
                                    input: '$interviewerNames',
                                    initialValue: '',
                                    in: {
                                        $concat: [
                                            '$$value',
                                            { $cond: [{ $eq: ['$$value', ''] }, '', ', '] },
                                            '$$this'
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    candidate: '$candidateDoc',
                    job: {
                        $mergeObjects: [
                            '$jobDoc',
                            { company: '$companyDoc' }
                        ]
                    },
                    interviewers: '$interviewersDoc',
                    scoreBand: {
                        $let: {
                            vars: {
                                eff: {
                                    $ifNull: [
                                        '$evaluationScore',
                                        { $ifNull: ['$evaluation.totalScore', { $ifNull: ['$evaluation.score', { $ifNull: ['$evaluationBreakdown.totalScore', null] }] }] }
                                    ]
                                }
                            },
                            in: {
                                $cond: {
                                    if: { $eq: ['$$eff', null] },
                                    then: 'N/A',
                                    else: {
                                        $switch: {
                                            branches: [
                                                { case: { $lt: ['$$eff', 33] }, then: 'Low' },
                                                { case: { $lt: ['$$eff', 67] }, then: 'Medium' },
                                            ],
                                            default: 'High'
                                        }
                                    }
                                }
                            }
                        }
                    },
                    effectiveScore: {
                        $convert: {
                            input: {
                                $ifNull: [
                                    '$evaluationScore',
                                    { $ifNull: ['$evaluation.totalScore', { $ifNull: ['$evaluation.score', { $ifNull: ['$evaluationBreakdown.totalScore', null] }] }] }
                                ]
                            },
                            to: 'double',
                            onError: null,
                            onNull: null,
                        }
                    },
                    statusLabel: {
                        $switch: {
                            branches: [
                                {
                                    case: {
                                        $and: [
                                            {
                                                $regexMatch: {
                                                    input: { $toLower: { $ifNull: ['$interviewerType', ''] } },
                                                    regex: 'human'
                                                }
                                            },
                                            {
                                                $eq: [
                                                    { $size: { $ifNull: ['$interviewersDoc', []] } },
                                                    0
                                                ]
                                            }
                                        ]
                                    },
                                    then: 'Unassigned'
                                },
                                {
                                    case: {
                                        $regexMatch: {
                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                            regex: 'complete'
                                        }
                                    },
                                    then: 'Completed'
                                },
                                {
                                    case: {
                                        $regexMatch: {
                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                            regex: 'miss'
                                        }
                                    },
                                    then: 'Unattended'
                                },
                                {
                                    case: {
                                        $regexMatch: {
                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                            regex: 'cancel'
                                        }
                                    },
                                    then: 'Cancelled'
                                },
                                {
                                    case: { $ne: ['$endedAt', null] },
                                    then: 'Completed'
                                },
                                {
                                    case: {
                                        $and: [
                                            { $ne: ['$startAt', null] },
                                            { $eq: ['$endedAt', null] },
                                            { $lt: ['$startAt', '$$NOW'] },
                                            {
                                                $gt: [
                                                    {
                                                        $add: [
                                                            '$startAt',
                                                            {
                                                                $multiply: [
                                                                    { $ifNull: ['$durationMinutes', 45] },
                                                                    60000
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    '$$NOW'
                                                ]
                                            },
                                            {
                                                $or: [
                                                    {
                                                        $regexMatch: {
                                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                                            regex: 'in\\s*progress|ongoing|started'
                                                        }
                                                    },
                                                    {
                                                        $and: [
                                                            {
                                                                $eq: [
                                                                    { $toLower: { $ifNull: ['$interviewMode', ''] } },
                                                                    'virtual'
                                                                ]
                                                            },
                                                            { $ne: ['$webrtcAccessUsedAt', null] }
                                                        ]
                                                    }
                                                ]
                                            },
                                        ]
                                    },
                                    then: 'In Progress'
                                },
                                {
                                    case: {
                                        $regexMatch: {
                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                            regex: 'upcoming'
                                        }
                                    },
                                    then: 'Upcoming'
                                },
                                {
                                    case: {
                                        $and: [
                                            { $ne: ['$startAt', null] },
                                            {
                                                $lt: [
                                                    {
                                                        $add: [
                                                            '$startAt',
                                                            {
                                                                $multiply: [
                                                                    { $ifNull: ['$durationMinutes', 0] },
                                                                    60000
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    '$$NOW'
                                                ]
                                            }
                                        ]
                                    },
                                    then: 'Unattended'
                                }
                            ],
                            default: 'Upcoming'
                        }
                    }
                }
            },
            {
                $addFields: {
                    effectiveScore: {
                        $cond: {
                            if: {
                                $or: [
                                    { $in: ['$statusLabel', ['Upcoming', 'Unattended']] },
                                    {
                                        $eq: [
                                            { $toLower: { $ifNull: ['$interviewerType', ''] } },
                                            'human'
                                        ]
                                    }
                                ]
                            },
                            then: null,
                            else: '$effectiveScore'
                        }
                    }
                }
            },
            {
                $addFields: {
                    scoreBand: {
                        $cond: {
                            if: { $eq: ['$effectiveScore', null] },
                            then: 'N/A',
                            else: {
                                $switch: {
                                    branches: [
                                        { case: { $lt: ['$effectiveScore', 33] }, then: 'Low' },
                                        { case: { $lt: ['$effectiveScore', 67] }, then: 'Medium' },
                                    ],
                                    default: 'High'
                                }
                            }
                        }
                    },
                    scoreSortMissing: {
                        $cond: [{ $eq: ['$effectiveScore', null] }, 1, 0]
                    }
                }
            }
        );

        if (pendingFilter) {
            if (pendingFilter.field === 'candidateName') {
                pipeline.push({ $match: { candidateName: pendingFilter.value } });
            } else if (pendingFilter.field === 'jobTitle') {
                pipeline.push({
                    $match: {
                        $or: [
                            { jobTitle: pendingFilter.value },
                            { jobInternalTitle: pendingFilter.value }
                        ]
                    }
                });
            } else if (pendingFilter.field === 'statusLabel') {
                const statusKey = String(normalizedValue || '').trim().toLowerCase();
                if (statusKey === 'completed') {
                    pipeline.push({
                        $match: {
                            $or: [
                                { interviewStatus: /complete/i },
                                { endedAt: { $ne: null } }
                            ]
                        }
                    });
                } else if (statusKey === 'unattended') {
                    pipeline.push({
                        $match: {
                            $or: [
                                { interviewStatus: /(miss|unattend)/i },
                                {
                                    $expr: {
                                        $and: [
                                            { $ne: ['$startAt', null] },
                                            { $eq: ['$endedAt', null] },
                                            {
                                                $lt: [
                                                    {
                                                        $add: [
                                                            '$startAt',
                                                            {
                                                                $multiply: [
                                                                    { $ifNull: ['$durationMinutes', 45] },
                                                                    60000
                                                                ]
                                                            }
                                                        ]
                                                    },
                                                    '$$NOW'
                                                ]
                                            },
                                            {
                                                $not: [
                                                    {
                                                        $regexMatch: {
                                                            input: { $toLower: { $ifNull: ['$interviewStatus', ''] } },
                                                            regex: 'complete|cancel|miss|unattend'
                                                        }
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                }
                            ]
                        }
                    });
                } else {
                    pipeline.push({ $match: { statusLabel: pendingFilter.value } });
                }
            } else if (pendingFilter.field === 'interviewers') {
                pipeline.push({ $match: { interviewerNamesStr: pendingFilter.value } });
            } else if (pendingFilter.field === 'scoreBand') {
                const bandVal = String(normalizedValue || '').trim();
                if (bandVal && bandVal !== 'all') {
                    pipeline.push({ $match: { scoreBand: new RegExp(`^${bandVal}$`, 'i') } });
                }
            } else {
                pipeline.push({ $match: { [pendingFilter.field]: pendingFilter.value } });
            }
        }

        if (normalizedStatusTab && normalizedStatusTab !== 'all') {
            pipeline.push({
                $match: {
                    statusLabel: buildRegex(normalizedStatusTab, true)
                }
            });
        }

        const searchTerm = String(search || '').trim();
        if (searchTerm) {
            const searchRegex = buildRegex(searchTerm, false);
            pipeline.push({
                $match: {
                    $or: [
                        { candidateName: searchRegex },
                        { candidateEmail: searchRegex },
                        { jobTitle: searchRegex },
                        { jobInternalTitle: searchRegex },
                        { interviewMode: searchRegex },
                        { interviewType: searchRegex },
                        { statusLabel: searchRegex },
                        { interviewerType: searchRegex },
                        { interviewerNamesStr: searchRegex }
                    ]
                }
            });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const pageSizeNum = Math.min(100, parseInt(pageSize, 10) || 10);
        const skip = (pageNum - 1) * pageSizeNum;

        const sortMap = {
            candidateName: 'candidateName',
            jobTitle: 'jobTitle',
            durationMinutes: 'durationMinutes',
            interviewMode: 'interviewMode',
            interviewType: 'interviewType',
            interviewerType: 'interviewerType',
            statusLabel: 'statusLabel',
            interviewers: 'interviewerNamesStr',
            startAt: 'startAt',
            createdAt: 'createdAt',
            id: '_id',
            score: 'effectiveScore'
        };

        const sortField = sortMap[sortBy] || 'startAt';
        const sortDir = String(sortOrder || '').toLowerCase() === 'asc' ? 1 : -1;
        const baseProject = {
            candidateDoc: 0,
            jobDoc: 0,
            companyDoc: 0,
            interviewersDoc: 0,
            clientDoc: 0,
            interviewerNames: 0,
            interviewerNamesStr: 0,
            candidateName: 0,
            candidateEmail: 0,
            jobTitle: 0,
            jobInternalTitle: 0,
            effectiveScore: 0,
            scoreSortMissing: 0
        };

        if (sortField === 'effectiveScore') {
            const [countAgg, rawItems] = await Promise.all([
                req.conn.models['InterviewSchedule']
                    .aggregate([...pipeline, { $count: 'count' }])
                    .exec(),
                req.conn.models['InterviewSchedule']
                    .aggregate([...pipeline, { $project: baseProject }])
                    .exec()
            ]);

            const total = countAgg?.[0]?.count || 0;
            const items = (rawItems || []).map((s) => ({
                ...s,
                id: s._id
            }));

            const itemsWithCodingStats = await this.#attachCodingSubmissionStats(items, req);
            const sortedItems = this.#sortItemsByDisplayScore(itemsWithCodingStats, sortDir);
            const pagedItems = sortedItems.slice(skip, skip + pageSizeNum);

            const meta = {
                total,
                page: pageNum,
                pageSize: pageSizeNum,
                totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
            };

            console.log('[InterviewScheduleService] listByATS server-side', {
                page: pageNum,
                pageSize: pageSizeNum,
                total,
                sortBy: 'displayScore',
                sortOrder: sortDir === 1 ? 'asc' : 'desc',
                search: searchTerm ? 'on' : 'off',
                filterField: normalizedField || null,
                statusTab: normalizedStatusTab || null
            });

            return { ok: true, code: 200, items: pagedItems, meta };
        }

        const sortSpec = { [sortField]: sortDir, _id: 1 };

        pipeline.push({
            $facet: {
                items: [
                    { $sort: sortSpec },
                    { $skip: skip },
                    { $limit: pageSizeNum },
                    {
                        $project: baseProject
                    }
                ],
                totalCount: [{ $count: 'count' }]
            }
        });

        const agg = await req.conn.models['InterviewSchedule'].aggregate(pipeline).exec();
        const rawItems = agg?.[0]?.items || [];
        const total = agg?.[0]?.totalCount?.[0]?.count || 0;

        const items = rawItems.map(s => ({
            ...s,
            id: s._id
        }));
        const itemsWithCodingStats = await this.#attachCodingSubmissionStats(items, req);

        const meta = {
            total,
            page: pageNum,
            pageSize: pageSizeNum,
            totalPages: pageSizeNum ? Math.ceil(total / pageSizeNum) : 1
        };

        console.log('[InterviewScheduleService] listByATS server-side', {
            page: pageNum,
            pageSize: pageSizeNum,
            total,
            sortBy: sortField,
            sortOrder: sortDir === 1 ? 'asc' : 'desc',
            search: searchTerm ? 'on' : 'off',
            filterField: normalizedField || null,
            statusTab: normalizedStatusTab || null
        });

        return { ok: true, code: 200, items: itemsWithCodingStats, meta };
    }

    async getInitView(params, req) {
        const { candidateATS, candidateId, jobId } = params || {};
        const m = req.conn.models;
        const isValidId = (value) => value && mongoose.Types.ObjectId.isValid(value);
        const stagePopulate = {
            path: 'stageResults',
            select: 'stageStatus remarkOrFeedback',
            populate: { path: 'stage', select: 'title description', match: { isArchived: false } }
        };

        let atsDoc = null;
        if (isValidId(candidateATS)) {
            atsDoc = await m['CandidateATS']
                .findOne({ _id: candidateATS, client: req.client, isArchived: false })
                .select('candidate job title stageResults')
                .populate(stagePopulate)
                .lean()
                .exec();
            if (atsDoc) {
                atsDoc.stageResults = (atsDoc.stageResults || []).filter(sr => sr?.stage);
            }
        }

        const canResolveAtsFromCandidate =
            !atsDoc &&
            isValidId(candidateId) &&
            isValidId(jobId);

        if (canResolveAtsFromCandidate) {
            atsDoc = await m['CandidateATS']
                .findOne({
                    candidate: candidateId,
                    job: jobId,
                    client: req.client,
                    isArchived: false,
                })
                .select('candidate job title stageResults')
                .populate(stagePopulate)
                .sort({ createdAt: -1, updatedAt: -1 })
                .lean()
                .exec();
            if (atsDoc) {
                atsDoc.stageResults = (atsDoc.stageResults || []).filter(sr => sr?.stage);
            }
        }

        if (isValidId(candidateATS) && !atsDoc && !canResolveAtsFromCandidate) {
            return { ok: false, code: 404, message: 'CandidateATS not found' };
        }

        const candId = candidateId || atsDoc?.candidate;
        const jbId = jobId || atsDoc?.job;

        const [candidate, job, interviewerUsers, schedules] = await Promise.all([
            candId ? m['Candidate'].findOne({ _id: candId, client: req.client, isArchived: false })
                .select('firstName lastName email countryCode phoneNumber skills resumeUrl createdAt jobs')
                .lean().exec() : null,

            jbId ? m['Job'].findOne({ _id: jbId, client: req.client, isArchived: false })
                .select('title internalTitle jobType status location locations postedOn description company primarySkills')
                .populate({ path: 'company', select: 'name' })
                .lean().exec() : null,

            m['User'].find({ client: req.client, isArchived: false, role: 'interviewer' })
                .select('firstName lastName email role')
                .lean().exec(),

            this.listByATS({ candidateATS, candidateId: candId, jobId: jbId }, req).then(r => r.items || [])
        ]);

        return {
            ok: true,
            code: 200,
            data: {
                ats: atsDoc || null,
                candidate: candidate || null,
                job: job || null,
                interviewers: interviewerUsers || [],
                schedules
            }
        };
    }

    // For WebRTCAI – fetch latest interview script for candidate+job
    // UPDATED: include interviewerType + interviewMode so frontend can disable AI when needed
    async getScriptByCandidateAndJob({ candidateId, jobId, scheduleId, accessToken }, req) {
        const m = req.conn.models;
        if (!candidateId || !jobId) {
            return { ok: false, code: 400, message: 'candidateId and jobId are required' };
        }
        if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
            return { ok: false, code: 400, message: 'Invalid candidateId or jobId' };
        }

        const InterviewSchedule = m['InterviewSchedule'];
        const token = String(accessToken || '').trim();
        let schedule = null;

        if (token) {
            const existing = await InterviewSchedule.findOne({
                client: req.client,
                candidate: candidateId,
                job: jobId,
                isArchived: false,
                webrtcAccessToken: token
            })
                .lean()
                .exec();

            if (!existing) {
                return { ok: false, code: 404, message: 'Interview link is invalid' };
            }
            const INTERVIEWER_ROLES = ['recruiter', 'client_admin', 'ultra_admin', 'interviewer'];
            const isInterviewer = INTERVIEWER_ROLES.includes(req.user?.role);
            const isAiInterviewerLink = this.#isAiInterviewerType(existing);

            // AI interviewer links are strict single-use for everyone.
            // Human/Human+AI keep interviewer bypass for internal review.
            if (existing.webrtcAccessUsedAt && (isAiInterviewerLink || !isInterviewer)) {
                return {
                    ok: false,
                    code: 410,
                    message: 'This interview link has already been used and cannot be opened again.'
                };
            }

            const windowError = this.#checkAccessWindow(existing, req);
            if (windowError) return windowError;

            schedule = existing;
        } else if (scheduleId && mongoose.Types.ObjectId.isValid(scheduleId)) {
            schedule = await InterviewSchedule.findOne({
                _id: scheduleId,
                client: req.client,
                candidate: candidateId,
                job: jobId,
                isArchived: false
            })
                .lean()
                .exec();

            // Fallback if the specific schedule is not found
            if (!schedule) {
                schedule = await InterviewSchedule.findOne({
                    client: req.client,
                    candidate: candidateId,
                    job: jobId,
                    isArchived: false
                })
                    .sort({ startAt: -1 })
                    .lean()
                    .exec();
            }

            if (schedule?.webrtcAccessToken) {
                return { ok: false, code: 403, message: 'Interview link token is required' };
            }

            const windowError = this.#checkAccessWindow(schedule, req);
            if (windowError) return windowError;
        } else {
            schedule = await InterviewSchedule.findOne({
                client: req.client,
                candidate: candidateId,
                job: jobId,
                isArchived: false
            })
                .sort({ startAt: -1 })
                .lean()
                .exec();

            const INTERVIEWER_ROLES = ['recruiter', 'client_admin', 'ultra_admin', 'interviewer'];
            const isInterviewer = INTERVIEWER_ROLES.includes(req.user?.role);
            if (schedule?.webrtcAccessToken && !isInterviewer) {
                return { ok: false, code: 403, message: 'Interview link token is required' };
            }

            const windowError = this.#checkAccessWindow(schedule, req);
            if (windowError) return windowError;
        }

        const candidate = await m['Candidate']
            .findOne({ _id: candidateId, client: req.client, isArchived: false })
            .select('firstName lastName email')
            .lean()
            .exec();

        const job = await m['Job']
            .findOne({ _id: jobId, client: req.client, isArchived: false })
            .select('title internalTitle description company primarySkills')
            .populate({ path: 'company', select: 'name' })
            .lean()
            .exec();

        // console.log(`[InterviewScheduleService] getScript - Schedule ID: ${schedule?._id}, RoundType: ${schedule?.roundType}`);

        if (!schedule) {
            const technicalScript = await this.buildTechnicalScriptTemplate({ candidate, job });
            return {
                ok: true,
                code: 200,
                data: {
                    technicalScript,
                    candidateName: `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate',
                    jobTitle: job?.title || 'Job',
                    jobId,
                    candidateId,
                    interviewerType: 'AI',       // default when no schedule found
                    interviewMode: 'Virtual',
                    difficultyLevel: 'Intermediate',
                    durationMinutes: 45,
                    accessEndsAt: null,
                    roundType: 'Speaking',
                    problem: null,
                    testCases: []
                }
            };
        }

        const accessWindow = this.#resolveAccessWindow(schedule.startAt, schedule.durationMinutes);
        const fallbackDurationMinutes = this.#normalizeDurationMinutes(schedule.durationMinutes, 45);
        const normalizedDurationMinutes =
            accessWindow?.durationMinutes ?? fallbackDurationMinutes;
        const expiryWindow = this.#resolveAccessExpiryWindow(schedule.startAt, 48);
        let accessEndsAt = expiryWindow?.endAt || null;

        let problem = null;
        let testCases = [];
        const normalizeLanguageIds = (langs = []) => {
            const ids = new Set();
            for (const lang of langs || []) {
                const id = lang?._id ?? lang;
                if (id) ids.add(String(id));
            }
            return ids;
        };

        if (schedule?.roundType === 'Coding') {
            try {
                const Problem = m['Problem'];
                const TestCase = m['TestCase'];

                if (Problem && TestCase) {
                    problem = await Problem.findOne({
                        interviewId: schedule._id,
                        isActive: true
                    })
                        .sort({ createdAt: -1 })
                        .lean()
                        .exec();

                    if (problem) {
                        const testCaseQuery = { problemId: problem._id };
                        if (req.user.role === 'candidate' || req.user.role === 'job_seeker') {
                            testCaseQuery.isSample = true;
                        }

                        testCases = await TestCase.find(testCaseQuery)
                            .sort({ order: 1 })
                            .select('-__v')
                            .lean()
                            .exec();
                    }
                }

                // Merge/Filter languages if needed
                if (problem) {
                    const scheduleAllowed = Array.isArray(schedule?.codingConfig?.allowedLanguages)
                        ? schedule.codingConfig.allowedLanguages
                        : [];

                    // If schedule has specific allowed languages, enforce them on the problem
                    // But since both are now just arrays of numbers (Judge0 IDs), we can just intersect or override
                    if (scheduleAllowed.length > 0) {
                        // For now, just override problem's allowed languages with schedule's if present
                        // This allows the interviewer to restrict languages for a specific session
                        problem.allowedLanguages = scheduleAllowed;
                    }

                    // Expand numeric IDs to full language objects for the frontend
                    problem.allowedLanguages = expandLanguages(problem.allowedLanguages);
                }
            } catch (err) {
                console.warn('[InterviewScheduleService] Failed to load coding data', {
                    scheduleId: schedule?._id?.toString(),
                    err: err?.message || err
                });
            }
        }

        // Load client's interview security settings
        let interviewSecuritySettings = { faceDetectionEnabled: false, readingPassageEnabled: false };
        try {
            const User = m['User'];
            if (User && req.client) {
                const clientUser = await User.findOne({ _id: req.client })
                    .select('interviewSecuritySettings')
                    .lean()
                    .exec();
                if (clientUser?.interviewSecuritySettings) {
                    interviewSecuritySettings = {
                        faceDetectionEnabled: clientUser.interviewSecuritySettings.faceDetectionEnabled === true,
                        readingPassageEnabled: clientUser.interviewSecuritySettings.readingPassageEnabled === true,
                    };
                }
            }
        } catch (err) {
            console.warn('[InterviewScheduleService] Failed to load interviewSecuritySettings:', err?.message);
        }

        // Build identityVerification payload for frontend
        const iv = schedule.identityVerification || {};
        const identityVerification = interviewSecuritySettings.faceDetectionEnabled ? {
            status: iv.status || 'Pending',
            required: true,
            referenceDescriptor: Array.isArray(iv.referenceDescriptor) ? iv.referenceDescriptor : [],
            matchThresholdPercent: Number(iv.matchThresholdPercent) > 0 ? Number(iv.matchThresholdPercent) : 70,
            mismatchCount: iv.mismatchCount || 0,
        } : {
            status: 'NotRequired',
            required: false,
            referenceDescriptor: [],
            matchThresholdPercent: 70,
            mismatchCount: 0,
        };

        return {
            ok: true,
            code: 200,
            data: {
                technicalScript: schedule.technicalScript || '',
                candidateName: `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate',
                jobTitle: job?.title || 'Job',
                jobId,
                candidateId,
                interviewId: schedule._id,
                webrtcLink: schedule.webrtcLink || null,
                interviewerType: schedule.interviewerType || 'AI',
                interviewMode: schedule.interviewMode || 'Virtual',
                difficultyLevel: schedule.difficultyLevel || 'Intermediate',
                durationMinutes: normalizedDurationMinutes,
                accessEndsAt,
                roundType: schedule.roundType || 'Speaking',
                problem,
                testCases,
                identityVerification,
                readingPassageEnabled: interviewSecuritySettings.readingPassageEnabled,
            }
        };
    }

    async consumeWebrtcToken({ candidateId, jobId, accessToken }, req) {
        const m = req.conn.models;
        if (!candidateId || !jobId || !accessToken) {
            return { ok: false, code: 400, message: 'candidateId, jobId and accessToken are required' };
        }
        if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
            return { ok: false, code: 400, message: 'Invalid candidateId or jobId' };
        }

        const token = String(accessToken || '').trim();
        if (!token) {
            return { ok: false, code: 400, message: 'Interview link token is required' };
        }

        const InterviewSchedule = m['InterviewSchedule'];
        const existing = await InterviewSchedule.findOne({
            client: req.client,
            candidate: candidateId,
            job: jobId,
            isArchived: false,
            webrtcAccessToken: token
        })
            .lean()
            .exec();

        if (!existing) {
            return { ok: false, code: 404, message: 'Interview link is invalid' };
        }
        const INTERVIEWER_ROLES = ['recruiter', 'client_admin', 'ultra_admin', 'interviewer'];
        const isInterviewer = INTERVIEWER_ROLES.includes(req.user?.role);
        const isAiInterviewerLink = this.#isAiInterviewerType(existing);

        if (existing.webrtcAccessUsedAt) {
            // AI interviewer links are strict single-use for everyone.
            // Human/Human+AI keep interviewer bypass for internal review.
            if (isInterviewer && !isAiInterviewerLink) {
                return { ok: true, code: 200, item: existing };
            }
            return {
                ok: false,
                code: 410,
                message: 'This interview link has already been used and cannot be opened again.'
            };
        }

        const windowError = this.#checkAccessWindow(existing, req);
        if (windowError) return windowError;

        const attendanceStartedAt = new Date();
        const updated = await InterviewSchedule.findOneAndUpdate(
            {
                _id: existing._id,
                client: req.client,
                $or: [
                    { webrtcAccessUsedAt: { $exists: false } },
                    { webrtcAccessUsedAt: null }
                ]
            },
            {
                $set: {
                    webrtcAccessUsedAt: attendanceStartedAt,
                    attendanceStartedAt
                }
            },
            { new: true }
        )
            .lean()
            .exec();

        if (!updated) {
            return {
                ok: false,
                code: 410,
                message: 'This interview link has already been used and cannot be opened again.'
            };
        }

        this.#schedulePendingVideoInterviewCredit({
            scheduleId: updated._id,
            clientId: updated.client,
            dbName: req.dbName,
            attendanceStartedAt
        });

        return { ok: true, code: 200, item: updated };
    }

    async updateEvaluationFromConversation(
        { candidateId, jobId, interviewScheduleId, overallReason, parameterEvaluation, breakdown },
        req
    ) {
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\n📊 [EVAL][${rid}] ===== updateEvaluationFromConversation (STRICT) =====`);

        const m = req.conn.models;

        if (!candidateId || !jobId) {
            console.warn(`[EVAL][${rid}] Missing candidateId or jobId`);
            return null;
        }

        if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
            console.warn(`[EVAL][${rid}] Invalid candidateId or jobId`);
            return null;
        }

        try {
            const InterviewSchedule = m["InterviewSchedule"];
            let schedule = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                schedule = await InterviewSchedule.findOne({
                    _id: new mongoose.Types.ObjectId(interviewScheduleId),
                    client: req.client,
                    isArchived: false,
                }).exec();
            }

            if (!schedule) {
                schedule = await InterviewSchedule.findOne({
                    client: req.client,
                    candidate: new mongoose.Types.ObjectId(candidateId),
                    job: new mongoose.Types.ObjectId(jobId),
                    isArchived: false,
                })
                    .sort({ startAt: -1 })
                    .exec();
            }

            if (!schedule) {
                console.warn(`[EVAL][${rid}] No InterviewSchedule found`);
                return null;
            }

            const usedExplicitScheduleId = !!(
                interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)
            );

            const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
            const isFiniteNum = (n) => typeof n === "number" && Number.isFinite(n);

            const normalized = {};
            const raw = parameterEvaluation && typeof parameterEvaluation === "object" ? parameterEvaluation : {};
            for (const [k, v] of Object.entries(raw)) {
                const key = String(k || "").trim();
                if (!key) continue;

                const score = clamp(Math.round(isFiniteNum(v?.score) ? v.score : 0), 0, 100);
                const reason = String(v?.reason || "").trim() || "Insufficient evidence from transcript.";
                const weight = isFiniteNum(v?.weight) && v.weight > 0 ? v.weight : 1;
                const group = String(v?.group || "").trim() || "";

                normalized[key] = { score, reason, weight, group };
            }

            const scored = Object.values(normalized).filter((p) => isFiniteNum(p.score));
            const totalScore = scored.length
                ? clamp(
                    Math.round(
                        scored.reduce((sum, p) => sum + p.score * (p.weight || 1), 0) /
                        scored.reduce((sum, p) => sum + (p.weight || 1), 0)
                    ),
                    0,
                    100
                )
                : 0;

            schedule.evaluation = {
                totalScore,
                overallReason: String(overallReason || "").trim(),
                parameters: normalized,
                breakdown: breakdown && typeof breakdown === "object" ? breakdown : undefined,
                completedAt: new Date(),
            };

            console.log(`[EVAL][${rid}] Persisting:`, {
                scheduleId: String(schedule._id),
                totalScore,
                paramCount: Object.keys(normalized).length,
                usedExplicitScheduleId,
            });

            await schedule.save();
            await this.#syncTargetStageStatus(schedule, 'Completed', req);

            console.log(`[EVAL][${rid}] ✅ Saved evaluation`);
            return schedule.toObject();
        } catch (err) {
            console.error(`[EVAL][${rid}] ❌ Failed:`, err?.message || err);
            return null;
        }
    }

    async activateWebrtcLink(scheduleId, req) {
        const m = req.conn.models;
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return { ok: false, code: 400, message: 'Invalid interview id' };
        }

        const schedule = await m['InterviewSchedule'].findOne({
            _id: scheduleId,
            client: req.client,
            isArchived: false
        }).lean().exec();

        if (!schedule) return { ok: false, code: 404, message: 'Interview not found' };
        if (schedule.interviewMode !== 'Virtual') {
            return { ok: false, code: 400, message: 'Interview is not virtual' };
        }

        const expiryWindow = this.#resolveAccessExpiryWindow(schedule.startAt, 48);
        if (!expiryWindow) {
            return { ok: false, code: 400, message: 'Invalid interview start time' };
        }

        if (Date.now() > expiryWindow.endAt.getTime()) {
            return { ok: false, code: 410, message: 'Interview link has expired (48 hour window ended)' };
        }

        const token = crypto.randomBytes(24).toString('hex');
        const webrtcLink = this.#buildWebrtcUrl(
            {
                candidateId: schedule.candidate,
                jobId: schedule.job,
                interviewerType: schedule.interviewerType,
                accessToken: token,
                scheduleId: schedule._id
            },
            req
        );

        const updated = await m['InterviewSchedule']
            .findOneAndUpdate(
                { _id: scheduleId, client: req.client },
                {
                    $set: {
                        webrtcAccessToken: token,
                        webrtcAccessUsedAt: null,
                        attendanceStartedAt: null,
                        webrtcAccessExpiresAt: expiryWindow.endAt,
                        webrtcLink,
                        meetingLink: webrtcLink
                    }
                },
                { new: true }
            )
            .lean()
            .exec();

        clearPendingVideoInterviewCreditTimer(scheduleId);
        return { ok: true, code: 200, item: updated };
    }

    async activateAndReshareLink(scheduleId, req, activeWindowHours = 48, scheduleStartAt = null) {
        const m = req.conn.models;
        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return { ok: false, code: 400, message: 'Invalid interview id' };
        }

        const schedule = await m['InterviewSchedule'].findOne({
            _id: scheduleId,
            client: req.client,
            isArchived: false
        }).lean().exec();

        if (!schedule) return { ok: false, code: 404, message: 'Interview not found' };
        if (schedule.interviewMode !== 'Virtual') {
            return { ok: false, code: 400, message: 'Interview is not virtual' };
        }

        const normalizedWindowHours = [24, 48, 72].includes(Number(activeWindowHours))
            ? Number(activeWindowHours)
            : 48;
        const parsedStartAt = scheduleStartAt ? new Date(scheduleStartAt) : null;
        const rescheduleStartAt = (parsedStartAt && !isNaN(parsedStartAt.getTime()))
            ? parsedStartAt
            : new Date(Date.now() + 10 * 60 * 1000);
        const expiryWindow = this.#resolveAccessExpiryWindow(rescheduleStartAt, normalizedWindowHours);
        if (!expiryWindow) {
            return { ok: false, code: 400, message: 'Invalid interview start time' };
        }
        if (Date.now() > expiryWindow.endAt.getTime()) {
            return { ok: false, code: 410, message: 'Interview link has expired (48 hour window ended)' };
        }

        const token = crypto.randomBytes(24).toString('hex');
        const webrtcLink = this.#buildWebrtcUrl(
            {
                candidateId: schedule.candidate,
                jobId: schedule.job,
                interviewerType: schedule.interviewerType,
                accessToken: token,
                scheduleId: schedule._id
            },
            req
        );

        const updated = await m['InterviewSchedule']
            .findOneAndUpdate(
                { _id: scheduleId, client: req.client },
                {
                    $set: {
                        startAt: rescheduleStartAt,
                        interviewStatus: 'Upcoming',
                        endedAt: null,
                        videoCreditConsumedAt: null,
                        recordingStatus: 'NOT_GENERATED',
                        videoRecordingUrl: null,
                        recordingMetadata: {
                            candidateStartMs: null,
                            interviewerStartMs: null,
                        },
                        webrtcAccessToken: token,
                        webrtcAccessUsedAt: null,
                        attendanceStartedAt: null,
                        webrtcAccessExpiresAt: expiryWindow.endAt,
                        webrtcLink,
                        meetingLink: webrtcLink,
                        reminderSentAt: null,       // reset so a new reminder call can fire for the new time
                        reminderCallDispatchStartedAt: null,
                        reminderEmailSentAt: null,  // reset so a new reminder email can fire for the new time
                    }
                },
                { new: true }
            )
            .lean()
            .exec();

        clearPendingVideoInterviewCreditTimer(scheduleId);
        try {
            const [candDoc, jobDoc] = await Promise.all([
                m['Candidate']
                    .findOne({ _id: schedule.candidate, client: req.client })
                    .select('firstName lastName email countryCode phoneNumber')
                    .lean()
                    .exec(),
                m['Job']
                    .findOne({ _id: schedule.job, client: req.client })
                    .select('title internalTitle jobType status location locations postedOn description company primarySkills')
                    .populate({ path: 'company', select: 'name' })
                    .lean()
                    .exec()
            ]);

            if (candDoc?.email) {
                let loginEmail = null;
                let loginPassword = null;
                try {
                    const UserModel = m['User'];
                    const normalizedEmail = candDoc.email.toLowerCase();
                    let existingUser = await UserModel.findOne({
                        email: normalizedEmail,
                        client: req.client
                    }).exec();

                    if (!existingUser) {
                        loginEmail = normalizedEmail;
                        const baseFirstName =
                            (candDoc.firstName || 'Candidate').trim() || 'Candidate';
                        loginPassword = `${baseFirstName}@321`;

                        try {
                            const newUser = new UserModel({
                                email: loginEmail,
                                password: loginPassword,
                                firstName: candDoc.firstName || 'Candidate',
                                lastName: candDoc.lastName || '',
                                role: 'candidate',
                                client: req.client,
                                countryCode: candDoc.countryCode || '',
                                phoneNumber: candDoc.phoneNumber || ''
                            });
                            await newUser.save();
                        } catch (e) {
                            console.error('[InterviewScheduleService] Failed to create candidate user account', e?.message || e);
                            loginEmail = null;
                            loginPassword = null;
                        }
                    } else {
                        loginEmail = existingUser.email;
                        loginPassword = this.#makeRandomPassword();
                        try {
                            existingUser.password = loginPassword;
                            await existingUser.save();
                        } catch (e) {
                            console.error('[InterviewScheduleService] Failed to reset candidate user password', e?.message || e);
                            loginPassword = null;
                        }
                    }
                } catch (err) {
                    console.warn('[InterviewScheduleService] Failed to resolve login credentials', err?.message || err);
                }

                const when = this.#formatWhen(
                    rescheduleStartAt,
                    schedule.durationMinutes,
                    schedule.timezone || req?.clientTimezone || DEFAULT_TIMEZONE
                );
                const mode = schedule.interviewMode || 'Virtual';
                const place = webrtcLink || schedule.meetingLink || 'N/A';
                const candidateName = `${candDoc?.firstName || ''} ${candDoc?.lastName || ''}`.trim() || 'Candidate';
                const companyName = jobDoc?.company?.name || 'our client';
                const jobTitle = jobDoc?.title || 'Job';

                await sendInterviewRescheduledCandidateEmail({
                    to: candDoc.email,
                    candidateName,
                    jobTitle,
                    companyName,
                    dateStr: when.dateStr,
                    timeStr: when.timeStr,
                    durationStr: when.durationStr,
                    mode,
                    place,
                    notes: schedule.notes || '',
                    loginEmail,
                    loginPassword,
                    interviewerType: schedule.interviewerType || 'AI',
                    interviewType: schedule.interviewType || 'Technical',
                    webrtcLink,
                    urlOrigin: this.#publicBaseUrl(req),
                    activeWindowHours: normalizedWindowHours,
                    reqContext: req,
                });
            }
        } catch (err) {
            console.warn('[InterviewScheduleService] Failed to reshare interview email:', err?.message || err);
        }

        return { ok: true, code: 200, item: updated };
    }

}
