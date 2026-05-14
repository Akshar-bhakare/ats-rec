/**
 * interviewReminderScheduler.js
 *
 * On server startup, scans all future InterviewSchedule documents across every
 * active client DB and registers an in-memory setTimeout to fire reminder
 * communication exactly 30 minutes before each interview.
 *
 * Pattern mirrors schedulers.js (aiCallTriggerer-based timeouts).
 *
 * Console log style: emoji + tree lines, matches the rest of the codebase.
 */

import dotenv from 'dotenv';
import { getClientDbConn } from '../src/utils/clientDbUtils.js';
import { getClientReminderSettings, triggerReminderCall } from '../src/services/interviewReminder/interviewReminderService.js';
import { triggerReminderEmail } from '../src/services/interviewReminder/interviewReminderEmailService.js';

dotenv.config();

const LOG_PREFIX = '[InterviewReminderScheduler]';
const REMINDER_BEFORE_MS = 30 * 60 * 1000; // 30 minutes in ms

// ─────────────────────────────────────────────────────────────
// IN-MEMORY TIMEOUT REGISTRY
// key  : `reminder_${interviewScheduleId}`
// value: setTimeout ID
// ─────────────────────────────────────────────────────────────
let reminderTimeouts = {};

export const setReminderTimeout = (key, timeoutId) => {
    reminderTimeouts[key] = timeoutId;
};

export const getReminderTimeout = (key) => reminderTimeouts[key];

export const deleteReminderTimeout = (key) => {
    if (key in reminderTimeouts) {
        try {
            reminderTimeouts[key] && clearTimeout(reminderTimeouts[key]);
        } catch (_) { /* noop */ }
        reminderTimeouts[key] = undefined;
    }
};

// ─────────────────────────────────────────────────────────────
// SCHEDULE A SINGLE REMINDER TIMEOUT
// ─────────────────────────────────────────────────────────────

/**
 * Schedules a single in-memory timeout that will fire `REMINDER_BEFORE_MS`
 * (30 min) before the interview's `startAt`.
 *
 * @param {object} schedule  – lean InterviewSchedule document
 * @param {object} clientDBConn
 * @param {object} req       – fake request context { user, conn, client }
 */
export const scheduleReminderTimeout = (schedule, clientDBConn, req) => {
    const scheduleId = String(schedule._id);
    const key = `reminder_${scheduleId}`;

    if (getReminderTimeout(key)) {
        console.log(`${LOG_PREFIX}   ⏭️  Reminder already registered for schedule ${scheduleId} — skipping`);
        return;
    }

    const fireAt = new Date(schedule.startAt).getTime() - REMINDER_BEFORE_MS;
    const delayMs = fireAt - Date.now();

    if (delayMs <= 0) {
        console.log(`${LOG_PREFIX}   ⏭️  Interview ${scheduleId} starts in < 30 min or already passed — skipping reminder`);
        return;
    }

    console.log(`${LOG_PREFIX}   ⏰ Scheduling reminder for ${scheduleId} in ${Math.round(delayMs / 60000)} min`);

    const timeoutId = setTimeout(async () => {
        console.log(`\n${LOG_PREFIX} 🔔 Firing 30-min reminder for schedule: ${scheduleId}`);
        const settings = await getClientReminderSettings(req).catch(() => ({}));
        const reminderEnabled = settings.reminderEnabled !== false;
        const reminderCallEnabled = settings.reminderCallEnabled !== false;
        const reminderEmailEnabled = settings.reminderEmailEnabled !== false;

        if (!reminderEnabled || (!reminderCallEnabled && !reminderEmailEnabled)) {
            console.log(`${LOG_PREFIX}   ⏭️  Reminder system is disabled at fire time for schedule: ${scheduleId}`);
            deleteReminderTimeout(key);
            return;
        }

        const reminderTasks = [];

        if (reminderCallEnabled) {
            console.log(`${LOG_PREFIX}   ${reminderEmailEnabled ? '├' : '└'}─ 📞 AI call  → triggerReminderCall()`);
            reminderTasks.push({
                label: 'call',
                promise: triggerReminderCall(scheduleId, clientDBConn, req),
            });
        }

        if (reminderEmailEnabled) {
            console.log(`${LOG_PREFIX}   └─ 📧 Email    → triggerReminderEmail()`);
            reminderTasks.push({
                label: 'email',
                promise: triggerReminderEmail(scheduleId, clientDBConn, req),
            });
        }

        const results = await Promise.allSettled(reminderTasks.map((task) => task.promise));

        results.forEach((result, index) => {
            const { label } = reminderTasks[index];
            const labelText = label === 'call' ? 'Reminder call' : 'Reminder email';

            if (result.status === 'rejected') {
                console.log(`${LOG_PREFIX} ❌ ${labelText} failed for ${scheduleId}:`, result.reason?.message || result.reason);
            } else {
                console.log(`${LOG_PREFIX} ✅ ${labelText} completed for ${scheduleId}`);
            }
        });

        deleteReminderTimeout(key);
    }, delayMs);

    setReminderTimeout(key, timeoutId);
};

// ─────────────────────────────────────────────────────────────
// MAIN INIT  — called once on server startup
// ─────────────────────────────────────────────────────────────

/**
 * Scans every active client DB for upcoming interviews and registers
 * 30-minute-before reminder timeouts for each one.
 *
 * Called from bootstrapBackgroundWork() in server.js.
 */
export const initInterviewReminderScheduler = async () => {
    console.log(`\n${LOG_PREFIX} ════════════════════════════════════════════════════`);
    console.log(`${LOG_PREFIX} 📅 Interview Reminder Scheduler — startup scan`);
    console.log(`${LOG_PREFIX} ════════════════════════════════════════════════════`);

    if (!process.env.DEFAULT_DB_NAME) {
        console.log(`${LOG_PREFIX} ❌ DEFAULT_DB_NAME not set — skipping reminder scheduler`);
        return;
    }

    const now = new Date();
    const scanWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000); // scan next 48 h

    console.log(`${LOG_PREFIX}   ├─ Current time:  ${now.toISOString()}`);
    console.log(`${LOG_PREFIX}   └─ Scan window:   next 48 hours (until ${scanWindow.toISOString()})`);

    try {
        const globalDBConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);

        // Only scan clients that are active (not archived)
        const clientAdmins = await globalDBConn.models['ClientAdmin']
            .find({ isArchived: false })
            .select('clientCompany user interviewReminderSettings')
            .lean()
            .exec() || [];

        console.log(`${LOG_PREFIX}   ├─ Active clients found: ${clientAdmins.length}`);

        let totalScheduled = 0;
        let totalSkipped = 0;

        for (const clientAdmin of clientAdmins) {
            const clientDBName = clientAdmin.clientCompany;
            const reminderSettings = clientAdmin.interviewReminderSettings || {};
            const reminderEnabled = reminderSettings.reminderEnabled !== false;
            const reminderCallEnabled = reminderSettings.reminderCallEnabled !== false;
            const reminderEmailEnabled = reminderSettings.reminderEmailEnabled !== false;
            const hasReminderChannel = reminderCallEnabled || reminderEmailEnabled;

            if (!reminderEnabled || !hasReminderChannel) {
                console.log(`${LOG_PREFIX}   ⏭️  Reminder system is disabled for client: ${clientDBName}`);
                totalSkipped++;
                continue;
            }

            let clientDBConn;
            try {
                clientDBConn = await getClientDbConn(clientDBName);
            } catch (connErr) {
                console.log(`${LOG_PREFIX}   ❌ Cannot connect to DB "${clientDBName}":`, connErr?.message);
                continue;
            }

            const reminderPendingFilter = reminderCallEnabled && reminderEmailEnabled
                ? { $or: [{ reminderSentAt: null }, { reminderEmailSentAt: null }] }
                : reminderCallEnabled
                    ? { reminderSentAt: null }
                    : { reminderEmailSentAt: null };

            // Fetch upcoming interviews where at least one enabled reminder channel is still pending
            const upcomingInterviews = await clientDBConn.models['InterviewSchedule']
                .find({
                    startAt: { $gte: new Date(now.getTime() + REMINDER_BEFORE_MS), $lte: scanWindow },
                    ...reminderPendingFilter,
                    isArchived: false,
                    isLinkExpired: { $ne: true },
                    interviewStatus: { $nin: ['Rescheduled', 'Cancelled', 'cancelled'] },
                })
                .select('_id startAt interviewerType candidate job reminderSentAt reminderEmailSentAt')
                .lean()
                .exec() || [];

            console.log(`${LOG_PREFIX}   ├─ [${clientDBName}] upcoming interviews: ${upcomingInterviews.length}`);

            // Build a fake req context for the triggerer
            let reqUser = {};
            try {
                reqUser = await clientDBConn.models['User']
                    .findOne({ _id: clientAdmin.user })
                    .lean()
                    .exec() || {};
            } catch (_) { /* noop */ }

            const req = {
                user: { ...reqUser, sub: reqUser?._id },
                conn: clientDBConn,
                client: reqUser?.clientId || reqUser?.client || reqUser?._id,
                dbName: clientDBName,
                query: {},
            };

            for (const schedule of upcomingInterviews) {
                scheduleReminderTimeout(schedule, clientDBConn, req);
                totalScheduled++;
            }
        }

        console.log(`\n${LOG_PREFIX} ✅ Startup scan complete`);
        console.log(`${LOG_PREFIX}   ├─ Reminders scheduled: ${totalScheduled}`);
        console.log(`${LOG_PREFIX}   └─ Clients skipped:     ${totalSkipped}\n`);

    } catch (err) {
        console.log(`${LOG_PREFIX} ❌ initInterviewReminderScheduler failed:`, err?.message || err);
    }
};

// ─────────────────────────────────────────────────────────────
// REGISTER A SINGLE NEW INTERVIEW  (call after scheduling)
// ─────────────────────────────────────────────────────────────

/**
 * Called immediately when a new InterviewSchedule is created, so the
 * reminder is registered without waiting for a server restart.
 *
 * @param {object} schedule      – newly created InterviewSchedule doc (lean or Mongoose)
 * @param {string} clientDBName  – e.g. "acme_corp"
 * @param {object} req           – request context
 */
export const registerNewInterviewReminder = async (schedule, clientDBName, req) => {
    console.log(`\n${LOG_PREFIX} ➕ Registering reminder for new schedule: ${schedule._id}`);

    if (!schedule?.startAt) {
        console.log(`${LOG_PREFIX}   ⚠️  No startAt on schedule — cannot register reminder`);
        return;
    }

    const settings = await (async () => {
        try {
            const globalDBConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
            const ca = await globalDBConn.models['ClientAdmin']
                .findOne({ clientCompany: clientDBName })
                .select('interviewReminderSettings')
                .lean()
                .exec();
            return ca?.interviewReminderSettings || {};
        } catch (_) { return {}; }
    })();

    const reminderEnabled = settings.reminderEnabled !== false;
    const reminderCallEnabled = settings.reminderCallEnabled !== false;
    const reminderEmailEnabled = settings.reminderEmailEnabled !== false;

    if (!reminderEnabled || (!reminderCallEnabled && !reminderEmailEnabled)) {
        console.log(`${LOG_PREFIX}   ⏭️  Reminder system is disabled for client ${clientDBName} — skipping`);
        return;
    }

    try {
        const clientDBConn = await getClientDbConn(clientDBName);
        scheduleReminderTimeout(schedule, clientDBConn, req);
    } catch (err) {
        console.log(`${LOG_PREFIX} ❌ registerNewInterviewReminder failed:`, err?.message);
    }
};
