/**
 * interviewReminderEmailService.js
 *
 * Sends a 30-minute-before interview reminder EMAIL to the candidate.
 * Runs in parallel with the AI reminder call when both reminder channels are enabled.
 *
 * Uses the client's customizable "Interview 30-Min Reminder (Candidate)" email
 * template (key: interview_reminder_candidate) from the EmailTemplateSetting
 * collection, falling back to the system default if no custom template is set.
 *
 * Console log style: emoji + tree lines, matches the rest of the codebase.
 */

import { sendEmail, resolveTemplatePayload, EMAIL_TEMPLATE_KEYS } from '../eMailing/emailService.js';
import { buildInterviewJoinLink, getClientReminderSettings } from './interviewReminderService.js';

const LOG_PREFIX = '[InterviewReminderEmail]';

// ─────────────────────────────────────────────────────────────
// CONSOLE HELPERS
// ─────────────────────────────────────────────────────────────

const logBox = (title) => {
    const line = '═'.repeat(76);
    console.log(`\n╔${line}╗`);
    console.log(`║  📧 ${title.padEnd(70)} ║`);
    console.log(`╚${line}╝\n`);
};

const logInfo = (msg) => console.log(`${LOG_PREFIX} ℹ️  ${msg}`);
const logSuccess = (msg) => console.log(`${LOG_PREFIX} ✅ ${msg}`);
const logWarn = (msg) => console.log(`${LOG_PREFIX} ⚠️  ${msg}`);
const logError = (msg, err) => {
    console.log(`${LOG_PREFIX} ❌ ${msg}`);
    if (err) console.log(`${LOG_PREFIX}    Cause:`, err?.message || err);
};

// ─────────────────────────────────────────────────────────────
// TRIGGER REMINDER EMAIL  — main export
// ─────────────────────────────────────────────────────────────

/**
 * Sends a 30-minute reminder email to the candidate using the client's
 * customizable email template (interview_reminder_candidate).
 * Idempotent: checks reminderEmailSentAt before sending.
 *
 * @param {string} interviewScheduleId
 * @param {object} clientDBConn  – mongoose connection for the client DB
 * @param {object} req           – request context { user, conn, client }
 */
export const triggerReminderEmail = async (interviewScheduleId, clientDBConn, req) => {
    logBox(`INTERVIEW REMINDER EMAIL — ID: ${interviewScheduleId}`);

    try {
        // ── Fetch schedule with candidate + job ──────────────
        const schedule = await clientDBConn.models['InterviewSchedule']
            .findById(interviewScheduleId)
            .populate('candidate', 'firstName lastName email emailUnsubscribed')
            .populate('job', 'title')
            .lean()
            .exec();

        if (!schedule) {
            logWarn(`InterviewSchedule ${interviewScheduleId} not found — skipping`);
            return;
        }

        // ── Respect reminder master toggle and email toggle ─
        const settings = await getClientReminderSettings(req).catch(() => ({}));
        if (settings.reminderEnabled === false) {
            logWarn(`reminderEnabled is OFF for this client — skipping reminder email for schedule ${interviewScheduleId}`);
            return;
        }

        if (settings.reminderEmailEnabled === false) {
            logWarn(`reminderEmailEnabled is OFF for this client — skipping reminder email for schedule ${interviewScheduleId}`);
            return;
        }

        // ── Duplicate guard ──────────────────────────────────
        if (schedule.reminderEmailSentAt) {
            logWarn(`Reminder email already sent at ${schedule.reminderEmailSentAt} for schedule ${interviewScheduleId} — skipping`);
            return;
        }

        const candidate = schedule.candidate;
        const job = schedule.job;

        if (!candidate?.email) {
            logWarn(`No email on candidate for schedule ${interviewScheduleId} — skipping`);
            return;
        }

        if (candidate.emailUnsubscribed) {
            logWarn(`Candidate ${candidate._id} has unsubscribed — not sending reminder email`);
            // Still mark as sent so we don't retry on every restart
            await clientDBConn.models['InterviewSchedule'].findByIdAndUpdate(
                interviewScheduleId,
                { $set: { reminderEmailSentAt: new Date() } }
            );
            return;
        }

        // ── Format date/time (IST) ───────────────────────────
        const ISTOptions = { timeZone: 'Asia/Kolkata' };
        const scheduledDateIST = new Date(schedule.startAt).toLocaleDateString('en-IN', {
            ...ISTOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        });
        const scheduledTimeIST = new Date(schedule.startAt).toLocaleTimeString('en-IN', {
            ...ISTOptions, hour: '2-digit', minute: '2-digit', hour12: true,
        });

        const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
        const jobTitle = job?.title || 'your upcoming interview';
        const interviewerTypeLabel = schedule.interviewerType || 'AI';

        // ── Build join link (for AI / WebRTC interviews) ─────
        const joinLink = schedule.webrtcAccessToken
            ? buildInterviewJoinLink({
                candidateId: schedule.candidate?._id || schedule.candidate,
                jobId: schedule.job?._id || schedule.job,
                interviewerType: schedule.interviewerType,
                accessToken: schedule.webrtcAccessToken,
                scheduleId: interviewScheduleId,
            }, req)
            : '';

        // ── Pre-send console log ─────────────────────────────
        const divider = '─'.repeat(60);
        console.log(`\n${LOG_PREFIX} ┌${divider}┐`);
        console.log(`${LOG_PREFIX} │  📧 OUTGOING REMINDER EMAIL — ABOUT TO SEND                │`);
        console.log(`${LOG_PREFIX} ├${divider}┤`);
        console.log(`${LOG_PREFIX} │  👤 Candidate  :  ${candidateName.padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  📬 Email      :  ${(candidate.email || '').padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  💼 Job        :  ${jobTitle.padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  🤖 Type       :  ${interviewerTypeLabel.padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  🗓️  Date (IST) :  ${scheduledDateIST.padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  🕐 Time (IST) :  ${scheduledTimeIST.padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  🔑 Schedule   :  ${String(interviewScheduleId).padEnd(41)}│`);
        console.log(`${LOG_PREFIX} │  🔗 Join Link  :  ${(joinLink ? 'Yes' : 'No (non-WebRTC)').padEnd(41)}│`);
        console.log(`${LOG_PREFIX} ├${divider}┤`);
        console.log(`${LOG_PREFIX} │  📋 Resolving client template (${EMAIL_TEMPLATE_KEYS.INTERVIEW_REMINDER_CANDIDATE})${' '.repeat(10)}│`);
        console.log(`${LOG_PREFIX} │  🚀 Sending reminder email NOW...                          │`);
        console.log(`${LOG_PREFIX} └${divider}┘\n`);

        // ── Resolve template (client custom OR system default) ─
        const emailPayload = await resolveTemplatePayload({
            reqContext: req,
            templateKey: EMAIL_TEMPLATE_KEYS.INTERVIEW_REMINDER_CANDIDATE,
            variables: {
                candidateName,
                jobTitle,
                dateStr: scheduledDateIST,
                timeStr: scheduledTimeIST,
                interviewerTypeLabel,
                joinLink,
            },
        });

        // ── Send email ───────────────────────────────────────
        await sendEmail({
            to: candidate.email,
            subject: emailPayload.subject,
            html: emailPayload.html,
            text: emailPayload.text,
            reqContext: req,
        });

        // ── Mark as sent (prevents duplicates on retry/restart) ──
        await clientDBConn.models['InterviewSchedule'].findByIdAndUpdate(
            interviewScheduleId,
            { $set: { reminderEmailSentAt: new Date() } }
        );

        logSuccess(`Reminder email sent → ${candidate.email}  (schedule: ${interviewScheduleId})`);

    } catch (err) {
        // Do NOT re-throw — email failure must never block the AI call
        logError(`triggerReminderEmail failed for schedule ${interviewScheduleId}`, err);
    }
};
