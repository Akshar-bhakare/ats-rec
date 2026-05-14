import { z } from "zod";
import { system, tool } from '@openai/agents';

import { createSchedule } from "../../routes/aiCallRoutes.js";
import { withTime } from "./aiCallOrchestrationV2.js";

const getCtxData = (ctx, key) => (ctx?.[key] ?? ctx?.context?.[key] ?? null);

/* ------------------------------ call rescheduling ------------------------------ */
export const getCurrentDateAndTime = tool({
    name: 'get_current_date_and_time',
    description:
        "This tool gives you current time. So whatever timezone, it does not affect your timing decisions.",
    parameters: z.object({}),
    async execute(args, ctx) {
        const now = new Date();
        const utcIso = now.toISOString();
        const istStr = now.toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        });
        return JSON.stringify({
            ok: true,
            code: 200,
            message: `Current time — UTC: ${utcIso} | IST (India): ${istStr} (IST = UTC+5:30). To convert IST→UTC: subtract 5 hours 30 minutes. Example: 10:00 AM IST = 04:30 AM UTC = "T04:30:00.000Z".`,
        });
    },
});

export const rescheduleCallAsPerUserAvailablity = tool({
    name: "reschedule_call_as_per_user_availablity",
    description:
        "Use this tool when the user wants to move, postpone, or change the time of a scheduled call. " +
        "This includes phrases such as 'call me after X minutes', 'tomorrow morning', 'in 2 hours', " +
        "'next Monday 10 AM', or any other relative or specific time instruction. " +
        "You MUST follow this process strictly: " +
        "1. Call the `getCurrentDateAndTime` tool first to obtain the current time. " +
        "2. Compute the new datetime string based on the user's input, must ensure it is within 50 hours of the current server time and not less than current date and time" +
        "3. Call this tool `reschedule_call_as_per_user_availablity` with the computed new ISO 8601 UTC datetime string " +
        "Do not just reply verbally like 'I'll call you later'—always perform the tool call to actually reschedule. " +
        "After execution, inform the user clearly whether the reschedule succeeded or failed, " +
        "and mention the new local date/time if successful.",
    parameters: z.object({
        datetimeString: z
            .string()
            .describe("ISO 8601 UTC string for the new call time (must be within 50 hours of current server time)."),
        note: z
            .string()
            .nullable()
            .optional()
            .describe("Optional note or short reason for rescheduling (e.g., 'user requested evening slot')."),
    }),
    async execute(args, ctx) {

        try {
            const cls = getCtxData(ctx, "clsObj");
            const req = getCtxData(ctx, "req");

            const { datetimeString, note } = args;

            // Perform scheduling via your existing service
            const schRes = await createSchedule(
                [{ _id: cls.candidateId, jobId: cls.jobId }],
                datetimeString,
                req
            );

            console.log("[Reschedule Tool] schedule result:", schRes);

            const { ok, code, message } = schRes;

            cls.classLevelConv.messages.push(withTime(system, message));

            return {
                ok,
                code,
                message,
            };
        } catch (err) {
            console.error("[Reschedule Tool] Error:", err);
            return {
                ok: false,
                code: 500,
                message: "Rescheduling of call failed.",
                meta: { error: String(err?.message || JSON.stringify(err)) },
            };
        }
    },
});

/* ------------------------------ interview reschedule (reminder calls) ------------------------------ */
export const rescheduleInterviewReminder = tool({
    name: 'reschedule_interview_reminder',
    description:
        "Use this tool to reschedule the candidate's upcoming interview when they request it during a reminder call. " +
        "PROCESS: 1. Ask the candidate for their preferred date and time. " +
        "2. Call get_current_date_and_time to get the current time. " +
        "3. Compute the ISO 8601 UTC datetime string for the new interview time. " +
        "4. Call this tool with the computed datetime. " +
        "5. Tell the candidate the reschedule result and that they will receive an email with the new interview link.",
    parameters: z.object({
        datetimeString: z
            .string()
            .describe("ISO 8601 UTC string for the new interview date and time (e.g. '2026-03-18T07:00:00.000Z')."),
    }),
    async execute(args, ctx) {
        try {
            const req = getCtxData(ctx, "req");
            const { datetimeString } = args;

            const scheduleId = req?.reminderCallContext?.interviewScheduleId;
            if (!scheduleId) {
                return { ok: false, code: 400, errorType: 'system', message: "No interview schedule found to reschedule." };
            }

            const clientDBConn = req?.conn;
            if (!clientDBConn) {
                return { ok: false, code: 400, errorType: 'system', message: "No database connection available." };
            }

            const { rescheduleAIInterview } = await import('../interviewReminder/interviewReminderService.js');
            await rescheduleAIInterview(scheduleId, datetimeString, clientDBConn, req);

            return {
                ok: true,
                code: 200,
                message: "Interview rescheduled successfully. The candidate will receive an email with the new interview link.",
            };
        } catch (err) {
            console.error("[reschedule_interview_reminder] Error:", err);

            // Classify the error so the AI knows what to say
            const msg = err?.message || '';
            const isDateRangeError = msg.toLowerCase().includes('days') || msg.toLowerCase().includes('within') || msg.toLowerCase().includes('future');
            const isManualFollowUpError =
                msg.toLowerCase().includes('disabled by the client admin') ||
                msg.toLowerCase().includes('only available for ai-only');
            return {
                ok: false,
                code: isDateRangeError ? 400 : isManualFollowUpError ? 409 : 500,
                errorType: isDateRangeError ? 'date_out_of_range' : isManualFollowUpError ? 'manual_follow_up' : 'system_error',
                message: msg || "Rescheduling failed. Please contact our team for assistance.",
                instruction: isDateRangeError
                    ? "Tell the candidate this exact reason and ask them to choose a different date within the allowed window."
                    : isManualFollowUpError
                        ? "Tell the candidate auto-rescheduling is not available for this interview and they should contact the recruiter by call or email."
                        : "Tell the candidate you were unable to reschedule automatically and they should contact the recruiter by call or email.",
            };
        }
    },
});

/* ------------------------------ AI call hangup ------------------------------ */
export const hangup_call = tool({
    name: 'hangup_call',
    description:
        "Immediately hang up the current AI call.",
    parameters: z.object({}),
    async execute(args, ctx) {
        let cls;
        try {
            console.log(
                "hangup_call tool invoked..."
            );

            cls = getCtxData(ctx, "clsObj") || getCtxData(ctx, "self") || getCtxData(ctx, "this");

            if (!cls || typeof cls !== 'object') {
                return JSON.stringify({ ok: false, code: 404, message: "Ai Call Service's instance not found on context." });
            }

            if (!cls.callUUID) {
                return JSON.stringify({ ok: false, code: 404, message: 'No active callUUID to hang up.' });
            }

            const afterTimeOut = async () => {
                try {
                    if (!cls.callUUID?.includes?.('call_simulation')) {
                        if (typeof cls?.safeHangup === 'function') {
                            await cls.safeHangup();
                        } else {
                            cls.callUUID && await cls?.plivoClient?.calls?.hangup?.(cls.callUUID);
                        }
                    }
                } catch (err) {
                    console.log(
                        "❌ Error in call hangup, after end-condition: ", err
                    );
                }

                try { cls?.ws?.close?.(); } catch (e) { }
                try { await cls?.wsOnClose?.(1000, "hangup_call"); } catch (e) { }
            };

            cls.pendingHangupTimeout && clearTimeout(cls.pendingHangupTimeout);
            cls.pendingHangupTimeout = setTimeout(afterTimeOut.bind(cls), 5_000);

            return JSON.stringify({
                ok: true,
                code: 200,
                message: 'Hangup requested successfully.',
            });

        } catch (err) {
            console.log(`[hangup_call] Provider hangup error for ${cls?.callUUID}:`, err?.message || err);
            return JSON.stringify({
                ok: false,
                code: 500,
                message: 'Failed to hang up call: ' + (err?.message || err)
            });
        }
    }
});
