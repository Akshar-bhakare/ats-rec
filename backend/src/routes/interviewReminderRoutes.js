/**
 * interviewReminderRoutes.js
 *
 * API endpoints for the Interview Reminder & Rescheduling feature.
 *
 * Routes (all prefixed with /api/interview-reminders):
 *
 *   GET  /settings                  – get client's reminder settings (client_admin only)
 *   PUT  /settings                  – update reminder settings (client_admin only)
 *   POST /reschedule/:scheduleId    – candidate/AI requests reschedule (AI interviews → auto, Human → notify recruiter)
 *   POST /trigger/:scheduleId       – manually trigger a reminder call (dev/testing, client_admin only)
 *
 * Console log style: emoji + tree lines, matches the rest of the codebase.
 */

import mongoose from 'mongoose';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import {
    getClientReminderSettings,
    updateClientReminderSettings,
    rescheduleAIInterview,
    notifyRecruiterRescheduleRequest,
    triggerReminderCall,
} from '../services/interviewReminder/interviewReminderService.js';

const LOG_PREFIX = '[InterviewReminderRoutes]';

export default async function interviewReminderRoutes(fastify) {

    // All routes require authentication
    fastify.addHook('preHandler', fastify.authenticate);

    // ─────────────────────────────────────────────────────────
    // GET /settings  — fetch current client's reminder settings
    // ─────────────────────────────────────────────────────────
    fastify.get('/settings', async (req, reply) => {
        const allowedRoles = ['client_admin', 'ultra_admin'];
        if (!allowedRoles.includes(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client_admin can view reminder settings.' });
        }

        console.log(`\n${LOG_PREFIX} GET /settings → user: ${req.user?.email}`);

        try {
            const settings = await getClientReminderSettings(req);

            console.log(`${LOG_PREFIX}   ✅ Returning settings for client=${req.client}`);
            console.log(`${LOG_PREFIX}   ├─ reminderEnabled:       ${settings.reminderEnabled}`);
            console.log(`${LOG_PREFIX}   ├─ reminderCallEnabled:   ${settings.reminderCallEnabled}`);
            console.log(`${LOG_PREFIX}   ├─ reminderEmailEnabled:  ${settings.reminderEmailEnabled}`);
            console.log(`${LOG_PREFIX}   ├─ autoRescheduleEnabled: ${settings.autoRescheduleEnabled}`);
            console.log(`${LOG_PREFIX}   ├─ maxRescheduleDays:     ${settings.maxRescheduleDays}`);
            console.log(`${LOG_PREFIX}   └─ newLinkValidHours:     ${settings.newLinkValidHours}`);

            return reply.send({ ok: true, settings });
        } catch (err) {
            console.log(`${LOG_PREFIX} ❌ GET /settings error:`, err?.message);
            return reply.code(500).send({ error: 'Failed to fetch reminder settings.' });
        }
    });

    // ─────────────────────────────────────────────────────────
    // PUT /settings  — update client's reminder settings
    // ─────────────────────────────────────────────────────────
    fastify.put('/settings', async (req, reply) => {
        const allowedRoles = ['client_admin', 'ultra_admin'];
        if (!allowedRoles.includes(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client_admin can update reminder settings.' });
        }

        const {
            reminderEnabled,
            reminderCallEnabled,
            reminderEmailEnabled,
            autoRescheduleEnabled,
            maxRescheduleDays,
            newLinkValidHours,
        } = req.body || {};

        console.log(`\n${LOG_PREFIX} PUT /settings → user: ${req.user?.email}`);
        console.log(`${LOG_PREFIX}   ├─ reminderEnabled:       ${reminderEnabled}`);
        console.log(`${LOG_PREFIX}   ├─ reminderCallEnabled:   ${reminderCallEnabled}`);
        console.log(`${LOG_PREFIX}   ├─ reminderEmailEnabled:  ${reminderEmailEnabled}`);
        console.log(`${LOG_PREFIX}   ├─ autoRescheduleEnabled: ${autoRescheduleEnabled}`);
        console.log(`${LOG_PREFIX}   ├─ maxRescheduleDays:     ${maxRescheduleDays}`);
        console.log(`${LOG_PREFIX}   └─ newLinkValidHours:     ${newLinkValidHours}`);

        // Validate
        if (maxRescheduleDays !== undefined) {
            const days = Number(maxRescheduleDays);
            if (Number.isNaN(days) || days < 1 || days > 90) {
                return reply.code(400).send({ error: 'maxRescheduleDays must be between 1 and 90.' });
            }
        }
        if (newLinkValidHours !== undefined) {
            const hrs = Number(newLinkValidHours);
            if (Number.isNaN(hrs) || hrs < 1) {
                return reply.code(400).send({ error: 'newLinkValidHours must be at least 1.' });
            }
        }

        try {
            // Merge with existing settings so partial updates are safe
            const existing = await getClientReminderSettings(req);
            const merged = {
                ...existing,
                ...(reminderEnabled !== undefined && { reminderEnabled: Boolean(reminderEnabled) }),
                ...(reminderCallEnabled !== undefined && { reminderCallEnabled: Boolean(reminderCallEnabled) }),
                ...(reminderEmailEnabled !== undefined && { reminderEmailEnabled: Boolean(reminderEmailEnabled) }),
                ...(autoRescheduleEnabled !== undefined && { autoRescheduleEnabled: Boolean(autoRescheduleEnabled) }),
                ...(maxRescheduleDays !== undefined && { maxRescheduleDays: Number(maxRescheduleDays) }),
                ...(newLinkValidHours !== undefined && { newLinkValidHours: Number(newLinkValidHours) }),
            };

            if (merged.reminderEnabled && !merged.reminderCallEnabled && !merged.reminderEmailEnabled) {
                return reply.code(400).send({
                    error: 'Enable at least one reminder option (call or email), or turn off reminders.',
                });
            }

            const saved = await updateClientReminderSettings(req, merged);

            console.log(`${LOG_PREFIX}   ✅ Settings updated for client=${req.client}`);
            return reply.send({ ok: true, settings: saved });
        } catch (err) {
            console.log(`${LOG_PREFIX} ❌ PUT /settings error:`, err?.message);
            return reply.code(500).send({ error: 'Failed to update reminder settings.', details: err?.message });
        }
    });

    // ─────────────────────────────────────────────────────────
    // POST /reschedule/:scheduleId
    //
    // Called when a candidate (via AI call or direct request) wants to reschedule.
    //  - AI interviews    → auto-reschedule + new link emailed
    //  - Human / AI+Human → email notification sent to recruiter, no auto-reschedule
    // ─────────────────────────────────────────────────────────
    fastify.post('/reschedule/:scheduleId', async (req, reply) => {
        const { scheduleId } = req.params;
        const { newDateTime } = req.body || {};

        console.log(`\n${LOG_PREFIX} POST /reschedule/${scheduleId}`);
        console.log(`${LOG_PREFIX}   ├─ newDateTime: ${newDateTime}`);
        console.log(`${LOG_PREFIX}   └─ requestedBy: ${req.user?.email || 'system/AI'}`);

        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return reply.code(400).send({ error: 'Invalid scheduleId format.' });
        }

        try {
            const schedule = await req.conn.models['InterviewSchedule']
                .findById(scheduleId)
                .select('interviewerType isLinkExpired interviewStatus')
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({ error: 'Interview schedule not found.' });
            }

            if (schedule.isLinkExpired || schedule.interviewStatus === 'Rescheduled') {
                return reply.code(409).send({ error: 'This interview has already been rescheduled.' });
            }

            const interviewerType = schedule.interviewerType;
            console.log(`${LOG_PREFIX}   ├─ interviewerType: ${interviewerType}`);

            // ── AI-only interview → auto-reschedule ─────────
            if (interviewerType === 'AI') {
                if (!newDateTime) {
                    return reply.code(400).send({ error: 'newDateTime is required for AI interview rescheduling.' });
                }

                const newSchedule = await rescheduleAIInterview(
                    scheduleId,
                    newDateTime,
                    req.conn,
                    req
                );

                return reply.code(201).send({
                    ok: true,
                    message: 'Interview rescheduled successfully. A new link has been emailed to the candidate.',
                    newScheduleId: newSchedule._id,
                    newStartAt: newSchedule.startAt,
                });
            }

            // ── Human / AI+Human → notify recruiter ─────────
            await notifyRecruiterRescheduleRequest(scheduleId, req.conn, req);

            return reply.send({
                ok: true,
                message: 'Reschedule request received. The recruiter has been notified and will contact you shortly.',
            });

        } catch (err) {
            console.log(`${LOG_PREFIX} ❌ POST /reschedule error:`, err?.message);

            // Known business-rule errors return 422
            const businessErrors = [
                'Auto-rescheduling is disabled',
                'only available for AI-only',
                'must be within',
                'must be in the future',
            ];
            const isBusinessError = businessErrors.some((msg) => err?.message?.includes(msg));

            return reply
                .code(isBusinessError ? 422 : 500)
                .send({ error: err?.message || 'Failed to process reschedule request.' });
        }
    });

    // ─────────────────────────────────────────────────────────
    // POST /trigger/:scheduleId  — manually fire a reminder call
    // (dev/testing or admin override — client_admin only)
    // ─────────────────────────────────────────────────────────
    fastify.post('/trigger/:scheduleId', async (req, reply) => {
        const allowedRoles = ['client_admin', 'ultra_admin'];
        if (!allowedRoles.includes(req.user?.role)) {
            return reply.code(403).send({ error: 'Only client_admin can manually trigger reminders.' });
        }

        const { scheduleId } = req.params;

        console.log(`\n${LOG_PREFIX} POST /trigger/${scheduleId} → user: ${req.user?.email}`);

        if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
            return reply.code(400).send({ error: 'Invalid scheduleId format.' });
        }

        try {
            await triggerReminderCall(scheduleId, req.conn, req);

            console.log(`${LOG_PREFIX}   ✅ Reminder call triggered for ${scheduleId}`);
            return reply.send({
                ok: true,
                message: `Reminder call triggered for schedule ${scheduleId}.`,
            });
        } catch (err) {
            console.log(`${LOG_PREFIX} ❌ POST /trigger error:`, err?.message);
            return reply.code(500).send({ error: err?.message || 'Failed to trigger reminder call.' });
        }
    });
}
