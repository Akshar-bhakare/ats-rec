// aiCallTooling.js
import { tool } from '@openai/agents';
import { z } from 'zod';

import { AiCallManager } from '../services/aiCalling/aiCallOrchestrationV2.js';
import CandidateATSService from '../services/candidateATSService.js';
import {
    deleteGlobalSchedule,
    getGlobalSchedulesValue,
} from '../../SystemChecksAndInitiators/schedulers.js';
import { createSchedule } from '../routes/aiCallRoutes.js';

const candAtsSvc = new CandidateATSService();

const getReq = (ctx) => (ctx?.req ?? ctx?.context?.req ?? null);

/* -------------------------------------------------------------------------- */
/*                           trigger_ai_call_now                              */
/* -------------------------------------------------------------------------- */

export const triggerAiCallNow = tool({
    name: 'trigger_ai_call_now',
    description:
        'Trigger an AI screening call to a candidate for a specific job immediately. ' +
        'Use this when the user says things like "call this candidate now", "start AI call", or "trigger the AI call".',
    parameters: z.object({
        candidateId: z
            .string()
            .describe(
                'Internal candidate id (Mongo ObjectId). The agent must obtain this using candidate tools first.'
            ),
        jobId: z
            .string()
            .describe(
                'Internal job id (Mongo ObjectId). The agent must obtain this using job / ATS tools first.'
            ),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const { candidateId, jobId } = args;

        if (!req) {
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Request context not found while trying to trigger AI call.',
            });
        }

        try {
            const aiService = new AiCallManager();

            const initRes = await aiService.init(candidateId, jobId, req);
            if (!initRes?.ok) {
                return JSON.stringify({
                    ok: false,
                    code: initRes?.code || 400,
                    message:
                        initRes?.message ||
                        'Failed to initialise AI call service.',
                    details: initRes?.details || null,
                });
            }

            const triggerRes = await aiService.triggerCall();
            if (!triggerRes?.ok) {
                return JSON.stringify({
                    ok: false,
                    code: triggerRes?.code || 400,
                    message:
                        triggerRes?.message ||
                        'AI call service failed to trigger the call.',
                    details: triggerRes?.details || null,
                });
            }

            return JSON.stringify({
                ok: true,
                code: triggerRes.code || 201,
                message:
                    triggerRes.message ||
                    'AI call has been triggered successfully.',
                details: triggerRes.details || null,
            });
        } catch (err) {
            console.log('[triggerAiCallNow] Error:', err);
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Error while triggering AI call: ' +
                    (err?.message || String(err)),
            });
        }
    },
});

/* -------------------------------------------------------------------------- */
/*                         schedule_ai_call_for_candidate                     */
/* -------------------------------------------------------------------------- */

export const scheduleAiCallForCandidate = tool({
    name: 'schedule_ai_call_for_candidate',
    description:
        'Schedule an AI call for a specific candidate & job at a future time. ' +
        'Use when the user says things like "schedule an AI call for this candidate at <time>" or "schedule the call for tomorrow 11 AM". ' +
        'The agent must convert natural language time into an ISO 8601 datetime string before calling this tool.',
    parameters: z.object({
        candidateId: z
            .string()
            .describe('Internal candidate id (Mongo ObjectId).'),
        jobId: z.string().describe('Internal job id (Mongo ObjectId).'),
        scheduleTime: z
            .string()
            .describe(
                'Datetime string parsable by `Date.parse` on the server. Use ISO 8601 (e.g., "2025-01-15T10:30:00+05:30").'
            ),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const { candidateId, jobId, scheduleTime } = args;

        if (!req) {
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Request context not found while trying to schedule AI call.',
            });
        }

        try {
            const schRes = await createSchedule(
                [{ _id: candidateId, jobId }],
                scheduleTime,
                req
            );

            return JSON.stringify(schRes);
        } catch (err) {
            console.log('[scheduleAiCallForCandidate] Error:', err);
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Error while scheduling AI call: ' +
                    (err?.message || String(err)),
            });
        }
    },
});

/* -------------------------------------------------------------------------- */
/*                  internal helpers: clear schedule for one                  */
/* -------------------------------------------------------------------------- */

async function clearScheduleForOne(candidateId, jobId, req) {
    try {
        const gteCandidateATSs = await candAtsSvc.readFiltered(
            {
                candidate: candidateId,
                job: jobId,
                scheduleTimes: {
                    $elemMatch: {
                        scheduleTime: { $gte: new Date() },
                        scheduleStatus: 'Scheduled',
                    },
                },
            },
            req,
            false,
            null,
            false,
            '_id candidate job scheduleTimes'
        );

        const existingTimeoutId = getGlobalSchedulesValue(
            `${candidateId}, ${jobId}`,
            'Not found'
        );

        if (existingTimeoutId !== 'Not found') {
            deleteGlobalSchedule(`${candidateId}, ${jobId}`);
        }

        if (!gteCandidateATSs || gteCandidateATSs.length === 0) {
            return {
                ok: false,
                code: 404,
                message:
                    'No active future schedules found for this candidate & job.',
            };
        }

        const atsDoc = gteCandidateATSs[0];

        await candAtsSvc.update(
            atsDoc._id,
            {
                $set: {
                    'scheduleTimes.$.scheduleStatus': 'Blocked',
                },
            },
            req,
            false,
            false,
            {
                'scheduleTimes.scheduleStatus': 'Scheduled',
            }
        );

        return {
            ok: true,
            code: 200,
            message: 'Call schedule cleared successfully.',
            details: { candidateId, jobId, atsId: atsDoc._id },
        };
    } catch (err) {
        console.log('[clearScheduleForOne] Error:', err);
        return {
            ok: false,
            code: 500,
            message:
                'Error while clearing AI call schedule: ' +
                (err?.message || String(err)),
        };
    }
}

/* -------------------------------------------------------------------------- */
/*                     reschedule_ai_call_for_candidate                       */
/* -------------------------------------------------------------------------- */

export const rescheduleAiCallForCandidate = tool({
    name: 'reschedule_ai_call_for_candidate',
    description:
        'Reschedule an existing AI call for a candidate & job to a new time. ' +
        'This will clear any existing future schedule for this candidate+job and create a new one. ' +
        'Use when the user says "reschedule the AI call for this candidate to <time>" or similar. ' +
        'The agent must convert natural language time into an ISO 8601 datetime string before calling this tool.',
    parameters: z.object({
        candidateId: z
            .string()
            .describe('Internal candidate id (Mongo ObjectId).'),
        jobId: z.string().describe('Internal job id (Mongo ObjectId).'),
        newScheduleTime: z
            .string()
            .describe(
                'New datetime string parsable by `Date.parse` on the server. Use ISO 8601 (e.g., "2025-01-15T10:30:00+05:30").'
            ),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const { candidateId, jobId, newScheduleTime } = args;

        if (!req) {
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Request context not found while trying to reschedule AI call.',
            });
        }

        try {
            // 1) Clear existing future schedule (if any)
            const clearRes = await clearScheduleForOne(
                candidateId,
                jobId,
                req
            );

            if (!clearRes.ok && clearRes.code !== 404) {
                // 404 = nothing to clear, which is fine for "reschedule"
                return JSON.stringify(clearRes);
            }

            // 2) Create new schedule
            const schRes = await createSchedule(
                [{ _id: candidateId, jobId }],
                newScheduleTime,
                req
            );

            return JSON.stringify({
                ...schRes,
                previousScheduleCleared: clearRes.ok,
            });
        } catch (err) {
            console.log('[rescheduleAiCallForCandidate] Error:', err);
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Error while rescheduling AI call: ' +
                    (err?.message || String(err)),
            });
        }
    },
});

/* -------------------------------------------------------------------------- */
/*                clear_ai_call_schedule_for_candidate                        */
/* -------------------------------------------------------------------------- */

export const clearAiCallScheduleForCandidate = tool({
    name: 'clear_ai_call_schedule_for_candidate',
    description:
        'Clear / cancel any future scheduled AI call for a candidate & job. ' +
        'Use when the user says "cancel the scheduled AI call", "clear the AI call schedule", or similar.',
    parameters: z.object({
        candidateId: z
            .string()
            .describe('Internal candidate id (Mongo ObjectId).'),
        jobId: z.string().describe('Internal job id (Mongo ObjectId).'),
    }),
    async execute(args, ctx) {
        const req = getReq(ctx);
        const { candidateId, jobId } = args;

        if (!req) {
            return JSON.stringify({
                ok: false,
                code: 500,
                message:
                    'Request context not found while trying to clear AI call schedule.',
            });
        }

        const res = await clearScheduleForOne(candidateId, jobId, req);
        return JSON.stringify(res);
    },
});
