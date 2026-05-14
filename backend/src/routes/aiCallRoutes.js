import { Response as plivoResponse } from 'plivo';
import CandidateATSService from '../services/candidateATSService.js';
import {
    getRequestTimeZone,
    isAllowedCallingHourIST,
    localDateTimeToUtc,
    normalizeTimeZone
} from '../utils/timeUtils.js';
import {
    deleteGlobalSchedule,
    getGlobalSchedulesValue,
    setGlobalSchedules
} from '../../SystemChecksAndInitiators/schedulers.js';
import { isAICallCreditsExausted } from '../utils/aiCallCredits.js';
import { AiCallManager, withTime } from '../services/aiCalling/aiCallOrchestrationV2.js';
import { AiCallManager as MultilingualAiCallManager } from '../services/aiCalling/aiCallOrchestrationMultilingual.js';
import { setupAuthAndOtherDetails } from './candidateFromJobSocialRoutes.js';

const allInstances = {};
const NORMAL_CALL_MODE = "normal";
const MULILINGUE_CALL_MODE = "Multilingual";

const normalizeCallMode = (mode) => {
    const rawMode = String(mode || '').trim().toLowerCase();
    if (["Multilingual", "multilingue", "multilingual"].includes(rawMode)) {
        return MULILINGUE_CALL_MODE;
    }
    return NORMAL_CALL_MODE;
};

const getAiManagerByMode = (mode) =>
    normalizeCallMode(mode) === MULILINGUE_CALL_MODE
        ? MultilingualAiCallManager
        : AiCallManager;

const clearAiCallInstances = (candidateId, jobId) => {
    const keyWithSpace = `${candidateId}, ${jobId}`;
    const keyNoSpace = `${candidateId},${jobId}`;

    allInstances[keyWithSpace] = undefined;
    allInstances[keyNoSpace] = undefined;
    AiCallManager.allInstances[keyWithSpace] = undefined;
    AiCallManager.allInstances[keyNoSpace] = undefined;
    MultilingualAiCallManager.allInstances[keyWithSpace] = undefined;
    MultilingualAiCallManager.allInstances[keyNoSpace] = undefined;
};

const parseScheduleTime = (scheduleTime, req) => {
    if (!scheduleTime) return null;
    if (scheduleTime instanceof Date) return scheduleTime;
    if (typeof scheduleTime === 'number') return new Date(scheduleTime);

    const raw = String(scheduleTime || '').trim();
    if (!raw) return null;

    if (/^\d{10,13}$/.test(raw)) {
        return new Date(Number(raw));
    }

    if (/[zZ]|[+-]\d{2}:\d{2}$/.test(raw)) {
        return new Date(raw);
    }

    const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::\d{2})?$/);
    if (match) {
        const timeStr = match[2].length === 5 ? `${match[2]}:00` : match[2];
        const tz = req?.clientTimezone || normalizeTimeZone(getRequestTimeZone(req));
        return localDateTimeToUtc(match[1], timeStr, tz);
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const aiCallStatuses = {
    'in-progress': 'In Progress',
    completed: 'Completed',
    ringing: 'Ringing',
    'no-answer': 'No Answer',
    busy: 'Busy',
    cancel: 'Canceled',
    timeout: 'Timed Out',
    initiated: 'In Progress',
    answered: 'Answered',
    hangup: 'Completed',
    failed: 'Failed',
    no_answer: 'No Answer'
};

export const causeExplanations = {
    NORMAL_CLEARING: 'Call completed',
    USER_BUSY: 'Line busy',
    NO_ANSWER: 'Not answered',
    NO_USER_RESPONSE: 'No response',
    CALL_REJECTED: 'Rejected',
    CANCEL: 'Canceled before answer',
    RESOURCE_UNAVAILABLE: 'No network resource',
    CALL_FAILED: 'Failed to connect',
    UNKNOWN: 'Unknown reason',
    CANCELLED_OUT_OF_CREDITS: 'No credit',
    INVALID_DESTINATION_ADDRESS: 'Invalid number',
    DESTINATION_OUT_OF_SERVICE: 'Number down',
    ENDPOINT_NOT_REGISTERED: 'Endpoint offline',
    DESTINATION_COUNTRY_BARRED: 'Country blocked',
    DESTINATION_NUMBER_BARRED: 'Number blocked',
    NETWORK_ERROR: 'Network error',
    INTERNAL_ERROR: 'Plivo error',
    ROUTING_ERROR: 'Routing issue',
    SCHEDULED_HANGUP: 'Max duration',
    RING_TIMEOUT: 'Rang too long',
    ERROR_ANSWER_URL: 'Answer URL error',
    ERROR_ACTION_URL: 'Action URL error',
    ERROR_TRANSFER_URL: 'Transfer URL error',
    ERROR_REDIRECT_URL: 'Redirect URL error',
    INVALID_ACTION_URL: 'Invalid URL',
    INVALID_TRANSFER_URL: 'Invalid URL',
    INVALID_REDIRECT_URL: 'Invalid URL',
    INVALID_METHOD_ACTION: 'Bad HTTP method',
    INVALID_METHOD_TRANSFER: 'Bad HTTP method',
    INVALID_METHOD_REDIRECT: 'Bad HTTP method',
    // Telnyx causes (call.hangup)
    normal_clearing: 'Call completed',
    user_busy: 'Line busy',
    no_answer: 'Not answered',
    call_rejected: 'Rejected',
    originator_cancel: 'Canceled before answer',
    destination_out_of_order: 'Number down',
    invalid_number: 'Invalid number',
    timeout: 'Timed Out',
    time_limit: 'Max duration',
    network_error: 'Network error',
    server_error: 'Network error'
};

export const sourceExplanations = {
    Caller: 'Hirex REC',
    'Call recipient': 'Candidate',
    Callee: 'Candidate',
    Plivo: 'Plivo',
    Carrier: 'API request',
    'API Request': 'XML Hangup',
    'Answer XML': 'Error',
    Error: 'Unknown',
    Unknown: 'Unknown',
    caller: 'Hirex REC',
    callee: 'Candidate',
    system: 'Telnyx',
    unknown: 'Unknown'
};

export const FALLBACK_CAUSES = [
    "NO_ANSWER",
    "NO_USER_RESPONSE",
    "USER_BUSY",
    "RING_TIMEOUT",
    "RESOURCE_UNAVAILABLE",
    "NETWORK_ERROR",
    "CALL_FAILED",
    "INTERNAL_ERROR",
    "ROUTING_ERROR",
    "ENDPOINT_NOT_REGISTERED",
    "DESTINATION_OUT_OF_SERVICE",
    "CANCEL",
    "UNKNOWN",
    "CANCELLED_OUT_OF_CREDITS",
    "ERROR_ANSWER_URL",
    "ERROR_ACTION_URL",
    "ERROR_TRANSFER_URL",
    "ERROR_REDIRECT_URL",
    "INVALID_ACTION_URL",
    "INVALID_TRANSFER_URL",
    "INVALID_REDIRECT_URL",
    "INVALID_METHOD_ACTION",
    "INVALID_METHOD_TRANSFER",
    "INVALID_METHOD_REDIRECT",
    "SCHEDULED_HANGUP",
    // Telnyx causes
    "no_answer",
    "user_busy",
    "timeout",
    "originator_cancel",
    "destination_out_of_order",
    "network_error",
    "server_error",
    "time_limit"
];

export const STOP_CAUSES = [
    "CALL_REJECTED",
    "INVALID_DESTINATION_ADDRESS",
    "DESTINATION_NUMBER_BARRED",
    "DESTINATION_COUNTRY_BARRED",
    // Telnyx causes
    "call_rejected",
    "invalid_number"
];

export const shouldFallbackToWhatsApp = (cause) => {
    const raw = String(cause || "");
    const upper = raw.toUpperCase();
    const lower = raw.toLowerCase();
    if (STOP_CAUSES.includes(raw) || STOP_CAUSES.includes(upper) || STOP_CAUSES.includes(lower)) return false;
    if (FALLBACK_CAUSES.includes(raw) || FALLBACK_CAUSES.includes(upper) || FALLBACK_CAUSES.includes(lower)) return true;
    return false; // default safe
};

const resolveAiCallInstance = (candidateId, jobId) => {
    return (
        allInstances?.[`${candidateId}, ${jobId}`] ||
        allInstances?.[`${candidateId},${jobId}`] ||
        AiCallManager.allInstances?.[`${candidateId}, ${jobId}`] ||
        AiCallManager.allInstances?.[`${candidateId},${jobId}`] ||
        MultilingualAiCallManager.allInstances?.[`${candidateId}, ${jobId}`] ||
        MultilingualAiCallManager.allInstances?.[`${candidateId},${jobId}`] ||
        null
    );
};

const handleAiCallHangup = async ({
    req,
    reply,
    fastify,
    candidateId,
    jobId,
    CallUUID,
    CallStatus,
    HangupCause,
    HangupSource,
    ProviderError = null,
    provider = "plivo",
}) => {
    const AiCallObj = resolveAiCallInstance(candidateId, jobId);
    if (!AiCallObj) {
        fastify.log.warn({
            provider,
            CallUUID,
            candidateId,
            jobId
        }, "AI call instance not found on hangup.");
        return reply.code(200).send('');
    }

    req.conn = AiCallObj.req.conn;

    fastify.log.info({
        provider,
        CallUUID,
        CallStatus,
        HangupCause,
        HangupSource,
        Error: ProviderError
    }, "📞 On ai call hangup...");

    const accessValidators = {
        isArchived: false
    };

    if (ProviderError) {
        console.log(
            `[${CallUUID}] [${candidateId}/${jobId}] ❌ ProviderError: ${ProviderError}`
        );
    }

    const statusKey = typeof CallStatus === "string" ? CallStatus : String(CallStatus || "");
    const causeKey = typeof HangupCause === "string" ? HangupCause : String(HangupCause || "");
    const sourceKey = typeof HangupSource === "string" ? HangupSource : String(HangupSource || "");

    const statusDesc =
        aiCallStatuses[statusKey] ||
        aiCallStatuses[statusKey.toLowerCase?.()] ||
        statusKey;

    const causeDesc =
        causeExplanations[causeKey] ||
        causeExplanations[causeKey.toLowerCase?.()] ||
        `Hang-up cause: "${causeKey}"`;

    const sourceDesc =
        sourceExplanations[sourceKey] ||
        sourceExplanations[sourceKey.toLowerCase?.()] ||
        `Hang-up by: "${sourceKey}"`;

    try {
        const cand = await req.conn.models.Candidate.findOne({
            ...accessValidators,
            _id: candidateId
        })
            .populate('applications')
            .lean()
            .exec();

        if (!cand) {
            console.log(
                `❌ [${CallUUID}] Candidate not found for hangup update. candidateId=${candidateId}, jobId=${jobId}`
            );

            clearAiCallInstances(candidateId, jobId);
            return reply.code(400).send('');
        }

        const candAts = (cand.applications || []).find(
            val => `${val.job}` === jobId
        );

        if (!candAts) {
            console.log(
                `❌ [${CallUUID}] Candidate ATS not found in applications for candidate=${candidateId}, job=${jobId}`
            );

            clearAiCallInstances(candidateId, jobId);
            return reply.code(400).send('');
        }

        const updated = await req.conn.models.CandidateATS.findOneAndUpdate(
            {
                ...accessValidators,
                _id: candAts._id
            },
            {
                aiCallStatus: statusDesc,
                aiCallHangUpCause: causeDesc,
                aiCallHangUpSource: sourceDesc
            },
            {
                new: true,
                upsert: true
            }
        ).exec();

        console.log(
            `[${CallUUID}] Updated Candidate ATS Id on hangup: `,
            updated?._id
        );
    } catch (err) {
        console.log(
            `❌ [${CallUUID}] Error during updating candidate ATS on call hangup: `,
            err
        );

        clearAiCallInstances(candidateId, jobId);
        return reply.code(400).send('');
    }

    const fallbackToWhatsApp = shouldFallbackToWhatsApp(HangupCause);

    const lastMsgs = (AiCallObj.classLevelConv?.messages || [])
        .filter(ele => ele?.role?.toLowerCase?.() === "assistant")
        .slice(-3);
    let convNotEnded = false;
    for (const msgEle of lastMsgs) {
        let finCont;
        try {
            finCont = msgEle.content?.[0].text;
        } catch {
            finCont = typeof msgEle.content !== "string" ? JSON.stringify(msgEle.content ?? []) : `${msgEle.content}`;
        }

        if (!(finCont || "")?.toLowerCase?.()?.includes?.("goodbye")) {
            convNotEnded = true;
        } else {
            convNotEnded = false;
            break;
        }
    }

    console.log(
        "💬 fallbackToWhatsApp: ", fallbackToWhatsApp || convNotEnded,
    );

    if ((fallbackToWhatsApp || convNotEnded) && AiCallObj?.onWhatsAppMessage) {
        AiCallObj.setFallbackToWhatsApp(true);
        await AiCallObj.onWhatsAppMessage(undefined, true, fastify.whatsapp);
    }
    return reply.code(200).send('');
};


export const aiCallTriggerer = async (candidateId, jobId, req, reply, isWhatsApp = false) => {
    const requestedCallMode = req?.query?.callMode;
    const normalizedCallMode = normalizeCallMode(requestedCallMode);
    const requestedCallModeLower = String(requestedCallMode || "").trim().toLowerCase();
    if (
        requestedCallMode &&
        normalizedCallMode === NORMAL_CALL_MODE &&
        !["normal", ""].includes(requestedCallModeLower)
    ) {
        console.log(
            `[aiCallTriggerer] Unsupported callMode="${requestedCallMode}". Falling back to "${NORMAL_CALL_MODE}".`
        );
    }
    const SelectedAiCallManager = getAiManagerByMode(normalizedCallMode);
    console.log(
        `[aiCallTriggerer] Triggering call for candidate=${candidateId}, job=${jobId}, requestedMode=${requestedCallMode || NORMAL_CALL_MODE}, mode=${normalizedCallMode}, manager=${SelectedAiCallManager?.name || "UnknownAiCallManager"}`
    );

    const AiService = new SelectedAiCallManager();
    AiService.req = req;
    AiService.callMode = normalizedCallMode;
    allInstances[`${candidateId}, ${jobId}`] = AiService;
    allInstances[`${candidateId},${jobId}`] = AiService;

    try {
        const initRes = await AiService.init(candidateId, jobId, req);
        if (!initRes || !initRes?.ok) {
            throw new Error(initRes?.message || 'Initial conversation setup failed...');
        }

        if (isWhatsApp) {
            // const waTriggerRes = await AiService.initWhatsAppConv();
            // if (!waTriggerRes || !waTriggerRes?.ok) {
            //     throw new Error(waTriggerRes?.message || 'WhatsApp initiation failed...');
            // }
            let waTriggerRes = {
                ok: true,
                code: 201,
                message: "WhatsApp conversation initiated successfully...",
            };
            try {
                await AiService.onWhatsAppMessage(undefined, true, req.whatsapp);
            } catch (error) {
                waTriggerRes = {
                    ok: false,
                    code: 400,
                    message: "Something went wrong...",
                    details: {
                        waUUID: this.waUUID,
                    }
                };
            }

            return reply.code(201).send(waTriggerRes);

        } else {
            const triggerRes = await AiService.triggerCall();
            if (!triggerRes || !triggerRes?.ok) {
                throw new Error(triggerRes?.message || 'Call triggerring failed...');
            }
            return reply.code(201).send(triggerRes);
        }
    } catch (err) {
        console.log('Error in initiating call trigger: ', err);
        clearAiCallInstances(candidateId, jobId);

        if ('ok' in (err || {})) {
            return reply.code(err?.code || 400).send(err);
        } else {
            return reply.code(err?.code || 400).send({
                ok: false,
                code: 400,
                message: 'Error in initiating the call: ' + (err?.message || err),
                details: {
                    error: err
                }
            });
        }
    }
};

/* ------------------------- Provider Hangup webhook ------------------------- */

const onAiCallHangUp = async (req, reply, fastify) => {
    const { candidateId, jobId } = req.params;
    const {
        CallUUID,
        CallStatus,
        HangupCause,
        HangupSource,
        Error: PlivoError
    } = req.body;

    return handleAiCallHangup({
        req,
        reply,
        fastify,
        candidateId,
        jobId,
        CallUUID,
        CallStatus,
        HangupCause,
        HangupSource,
        ProviderError: PlivoError,
        provider: "plivo",
    });
};

/* ------------------------- Telnyx Webhook handler ------------------------- */

const onTelnyxEvent = async (req, reply, fastify) => {
    const { candidateId, jobId } = req.params;
    const eventType = req.body?.data?.event_type || req.body?.event_type || null;
    const payload = req.body?.data?.payload || req.body?.payload || {};
    const callControlId = payload?.call_control_id || payload?.callControlId || null;

    fastify.log.info({
        provider: "telnyx",
        eventType,
        callControlId,
        candidateId,
        jobId
    }, "📞 Telnyx webhook received");

    const AiCallObj = resolveAiCallInstance(candidateId, jobId);
    if (!AiCallObj) {
        return reply.code(200).send({ ok: true });
    }

    req.conn = AiCallObj.req.conn;

    if (eventType === "call.answered") {
        if (callControlId) {
            if (AiCallObj.callUUID && AiCallObj.callUUID !== callControlId) {
                console.log(`[Telnyx][${callControlId}] Call UUID mismatch. Local=${AiCallObj.callUUID}`);
            }
            if (!AiCallObj.callUUID) AiCallObj.callUUID = callControlId;
        }

        if (!AiCallObj.telnyxStreamingStarted) {
            try {
                await AiCallObj.startTelnyxStreaming(callControlId);
            } catch (err) {
                console.log(`[Telnyx][${callControlId}] Failed to start media stream:`, err?.message || err);
            }
        }
        return reply.code(200).send({ ok: true });
    }

    if (eventType === "call.hangup") {
        const callStatus = payload?.call_state || payload?.call_status || payload?.state || "hangup";
        const hangupCause = payload?.hangup_cause || payload?.hangupCause || payload?.cause || "unknown";
        const hangupSource = payload?.hangup_source || payload?.hangupSource || "unknown";
        const providerError = payload?.sip_hangup_cause || payload?.sip_reason || payload?.error;

        return handleAiCallHangup({
            req,
            reply,
            fastify,
            candidateId,
            jobId,
            CallUUID: callControlId,
            CallStatus: callStatus,
            HangupCause: hangupCause,
            HangupSource: hangupSource,
            ProviderError: providerError,
            provider: "telnyx",
        });
    }

    if (eventType && eventType.startsWith("streaming.")) {
        console.log(`[Telnyx][${callControlId}] Streaming event: ${eventType}`);
    }

    return reply.code(200).send({ ok: true });
};

/* -------------------- Routes WITHOUT auth (Telephony webhooks) -------------------- */

export function aiCallRoutesWithoutAuth(fastify) {

    fastify.get(
        '/trigger/demo/:candidateId/:jobId/',
        async (req, reply) => {
            await setupAuthAndOtherDetails(req, (process.env.NODE_ENV === "production" ? "support@applycup.com" : "admin@aiselekt.com"));
            const { candidateId, jobId } = req.params;
            await aiCallTriggerer(candidateId, jobId, req, reply);
        }
    );

    // Plivo answer URL
    fastify.post(
        '/answer/plivo/:candidateId/:jobId/',
        { logLevel: 'info' },
        async (req, reply) => {
            const { candidateId, jobId } = req.params;

            if (!candidateId || !jobId) {
                return reply.code(400).send('Missing required parameters');
            }

            // Plivo sometimes posts hangup info to answer URL too
            if ('HangupCause' in req.body) {
                const response = plivoResponse();
                reply.type('text/xml');
                return reply.send(response.toXML());
            }

            // Try all possible field names where Plivo might send the call ID
            const rawCallUUID =
                req.body.CallUUID ||
                req.body.callUUID ||
                req.body.call_uuid ||
                req.body.RequestUUID ||
                req.body.request_uuid ||
                null;

            // Retrieve AiCallManager instance (try a couple of key formats)
            const AiService =
                resolveAiCallInstance(candidateId, jobId);

            if (!AiService) {
                console.log(
                    `[answer][${rawCallUUID}] ❌ AiCallManager instance not found for candidate=${candidateId}, job=${jobId}`
                );
                const response = plivoResponse();
                response.addSpeak(
                    'Sorry, this call cannot be handled at the moment. Goodbye.'
                );
                reply.type('text/xml');
                return reply.send(response.toXML());
            }

            const res_xml = await AiService.answerCall(rawCallUUID);

            reply.type('text/xml');
            return reply.send(res_xml);
        }
    );

    // Plivo <Stream> WebSocket
    fastify.get(
        '/ws/plivo/:candidateId/:jobId/:callUUID/',
        { websocket: true, logLevel: 'info' },
        async (ws, req) => {
            const { candidateId, jobId, callUUID } = req.params;
            console.log(`[${callUUID}] New WS on ${req.url}`);

            let AiService = resolveAiCallInstance(candidateId, jobId);

            if (!AiService) {
                console.log(
                    `❌ [${callUUID}] AiCallManager instance not found on WS connect for candidate=${candidateId}, job=${jobId}`
                );
                ws.close();
                return;
            }

            AiService.aiCallWsInitiator(ws, callUUID, "plivo");
        }
    );

    // Telnyx WebSocket
    fastify.get(
        '/ws/telnyx/:candidateId/:jobId/:callUUID/',
        { websocket: true, logLevel: 'info' },
        async (ws, req) => {
            const { candidateId, jobId, callUUID } = req.params;
            console.log(`[${callUUID}] New WS on ${req.url}`);

            const AiService = resolveAiCallInstance(candidateId, jobId);
            if (!AiService) {
                console.log(
                    `❌ [${callUUID}] AiCallManager instance not found on WS connect for candidate=${candidateId}, job=${jobId}`
                );
                ws.close();
                return;
            }

            AiService.aiCallWsInitiator(ws, callUUID);
        }
    );

    // Telnyx webhook URL
    fastify.post(
        '/events/telnyx/:candidateId/:jobId/',
        { logLevel: 'info' },
        (req, reply) => onTelnyxEvent(req, reply, fastify)
    );

    // Plivo hangup URL
    fastify.post(
        '/hangup/plivo/:candidateId/:jobId/',
        { logLevel: 'info' },
        (req, reply) => onAiCallHangUp(req, reply, fastify)
    );

    // // onAiCallHangUp testing...
    // const req = {
    //     params: {
    //         candidateId: "6917eef9124a88bc7674e1cf",
    //         jobId: "6916bd76542f7dc6e7b9029c",
    //     },
    //     body: {
    //         CallStatus: "completed",
    //         CallUUID: "fc3e7c3d-be6e-46bf-a748-79cf96908dau", // fc3e7c3d-be6e-46bf-a748-79cf96908dac
    //         HangupCause: "NORMAL_CLEARING",
    //         HangupSource: "Callee",
    //     },
    // };

    // req.query = {
    //     callUUID: req.body.CallUUID,
    // }

    // const dummyReply = {
    //     code: (cde) => (console.log("dmyRe:: code: ", cde) || { send: console.log }),
    //     send: console.log,
    // };

    // setupAuthAndOtherDetails(req, "info@aiselekt.com")
    //     .then(() => {
    //         const AiCallObj = new AiCallManager();
    //         AiCallObj.init(req.params.candidateId, req.params.jobId, req)
    //             .then(() => {
    //                 AiCallObj.callUUID = req.query.callUUID;
    //                 AiCallObj.initiateConversation(req.query.callUUID)
    //                     .then(res => {
    //                         AiCallObj.classLevelConv = res;
    //                         allInstances[`${req.params.candidateId}, ${req.params.jobId}`] = AiCallObj;
    //                         AiCallManager.allInstances[`${req.params.candidateId}, ${req.params.jobId}`] = AiCallObj;
    //                         onAiCallHangUp(req, dummyReply, fastify);
    //                     });
    //             });
    //     });

    // // End onAiCallHangUp testing...


}

/* ---------------- Scheduling helpers & routes WITH auth ---------------- */

const candAtsSvc = new CandidateATSService();

export const createSchedule = async (candidates, scheduleTime, req) => {
    const callTimeOutIds = [];
    try {
        const errorsInATS = [];
        const updatedATSs = [];
        const parsedScheduleTime = parseScheduleTime(scheduleTime, req);
        if (!parsedScheduleTime || Number.isNaN(parsedScheduleTime.getTime())) {
            return {
                ok: false,
                code: 400,
                message: 'Invalid schedule time provided.'
            };
        }
        for (const candEle of candidates) {
            const gteCandidateATSs = await candAtsSvc.readFiltered(
                {
                    candidate: candEle?._id,
                    job: candEle?.jobId,
                    scheduleTimes: {
                        $elemMatch: {
                            scheduleTime: { $gte: new Date() },
                            scheduleStatus: 'Scheduled'
                        }
                    }
                },
                req,
                false,
                null,
                false,
                '_id scheduleTimes'
            );

            if ((gteCandidateATSs || [])?.length === 0) {
                const candidateATSs = await candAtsSvc.readFiltered(
                    {
                        candidate: candEle?._id,
                        job: candEle?.jobId
                    },
                    req,
                    false,
                    null,
                    false,
                    '_id candidate job scheduleTimes'
                );

                const callTimeOutSecs = parsedScheduleTime.getTime() - Date.now();

                const isAlreadyExist =
                    getGlobalSchedulesValue(
                        `${candEle?._id}, ${candEle?.jobId}`,
                        'Not found'
                    ) !== 'Not found';

                if (callTimeOutSecs > 0 && !isAlreadyExist) {
                    if (
                        (isAllowedCallingHourIST() ||
                            process?.env?.NODE_ENV === 'development') &&
                        !(await isAICallCreditsExausted(req))
                    ) {
                        let timeoutId = setTimeout(async () => {
                            if (
                                (isAllowedCallingHourIST() ||
                                    process?.env?.NODE_ENV === 'development') &&
                                !(await isAICallCreditsExausted(req))
                            ) {
                                const dummyReply = {
                                    code: code =>
                                        console.log(
                                            '\n[AfterAICallSchedule] ReplyCode: ',
                                            code
                                        ) || {
                                            send: dt =>
                                                console.log(
                                                    '\n[AfterAICallSchedule] ReplyCodeSend: ',
                                                    dt
                                                )
                                        },
                                    send: dt =>
                                        console.log(
                                            '\n[AfterAICallSchedule] ReplySend: ',
                                            dt
                                        )
                                };

                                aiCallTriggerer(
                                    candEle?._id,
                                    candEle?.jobId,
                                    req,
                                    dummyReply
                                )
                                    .then(() => {
                                        candEle?._id &&
                                            candEle?.jobId &&
                                            candidateATSs[0]?._id &&
                                            candAtsSvc.update(
                                                candidateATSs[0]?._id,
                                                {
                                                    $set: {
                                                        'scheduleTimes.$.scheduleStatus':
                                                            'Executed'
                                                    }
                                                },
                                                req,
                                                false,
                                                false,
                                                {
                                                    'scheduleTimes.scheduleTime':
                                                        parsedScheduleTime
                                                }
                                            );

                                        deleteGlobalSchedule(
                                            `${candEle?._id}, ${candEle?.jobId}`
                                        );
                                    })
                                    .catch(err => {
                                        candEle?._id &&
                                            candEle?.jobId &&
                                            candidateATSs[0]?._id &&
                                            candAtsSvc.update(
                                                candidateATSs[0]?._id,
                                                {
                                                    $set: {
                                                        'scheduleTimes.$.scheduleStatus':
                                                            'Errored',
                                                        'scheduleTimes.$.errorDetails':
                                                            err
                                                    }
                                                },
                                                req,
                                                false,
                                                false,
                                                {
                                                    'scheduleTimes.scheduleTime':
                                                        parsedScheduleTime
                                                }
                                            );

                                        deleteGlobalSchedule(
                                            `${candEle?._id}, ${candEle?.jobId}`
                                        );
                                    });
                            } else {
                                console.log(
                                    '❌ Candidate AI Call(' +
                                    candEle?._id +
                                    ') was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: ' +
                                    new Date() +
                                    ' Or may AI Call credits are exausted...'
                                );
                            }
                        }, callTimeOutSecs);

                        setGlobalSchedules({
                            [`${candEle?._id}, ${candEle?.jobId}`]: timeoutId
                        });
                        callTimeOutIds.push(timeoutId);

                        candEle?._id &&
                            candEle?.jobId &&
                            candidateATSs[0]?._id &&
                            (await candAtsSvc.update(
                                candidateATSs[0]?._id,
                                {
                                    $addToSet: {
                                        scheduleTimes: {
                                            scheduleTime: parsedScheduleTime,
                                            scheduleStatus: 'Scheduled'
                                        }
                                    }
                                },
                                req
                            ));
                        updatedATSs.push(candidateATSs[0]?._id);
                    } else {
                        return {
                            ok: false,
                            code: 400,
                            message: 'Error in scheduling calls...',
                            details: {
                                isAllowedCallingHourIST: isAllowedCallingHourIST(),
                                isAICallCreditsExausted:
                                    !(await isAICallCreditsExausted(req))
                            }
                        };
                    }
                } else {
                    errorsInATS?.push({
                        candidateId: candEle?._id,
                        jobId: candEle?.jobId,
                        message: 'Schedule timing are not valid...'
                    });
                }
            } else {
                const schedule_Time = gteCandidateATSs[0].scheduleTimes?.find(
                    ele => ele?.scheduleStatus === 'Scheduled'
                ).scheduleTime;
                errorsInATS?.push({
                    candidateId: candEle?._id,
                    jobId: candEle?.jobId,
                    message:
                        "Another schedule at '" +
                        schedule_Time +
                        "' already Exists, for this Candidate and Job..."
                });
            }
        }

        if (errorsInATS?.length > 0) {
            return {
                ok: false,
                code: 400,
                message: errorsInATS
                    ?.map?.(ele => ele?.message)
                    .join('\n '),
                details: { errorsInATS }
            };
        }

        return {
            ok: true,
            code: 200,
            message: 'Call(s) scheduled successfully...',
            details: { updatedATSs }
        };
    } catch (err) {
        callTimeOutIds.forEach(ele => clearTimeout(ele));
        console.log('Error during Call(s) scheduling: ', err);

        return {
            ok: false,
            code: 400,
            message:
                'Error during Call(s) scheduling ' +
                (err?.message || err) +
                '...',
            details: err?.message || err
        };
    }
};

export function aiCallRoutes(fastify) {
    fastify.addHook('preHandler', fastify.authenticate);

    fastify.get(
        '/trigger/plivo/:candidateId/:jobId/',
        { logLevel: 'info' },
        async (req, reply) => {
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply
                    .code(406)
                    .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
            }

            const { candidateId, jobId } = req.params;
            await aiCallTriggerer(candidateId, jobId, req, reply);
        }
    );

    fastify.get(
        '/trigger/telnyx/:candidateId/:jobId/',
        { logLevel: 'info' },
        async (req, reply) => {
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply
                    .code(406)
                    .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
            }

            const { candidateId, jobId } = req.params;
            await aiCallTriggerer(candidateId, jobId, req, reply);
        }
    );

    fastify.get(
        '/trigger/whatsapp/:candidateId/:jobId/',
        { logLevel: 'info' },
        async (req, reply) => {
            if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
                return reply
                    .code(406)
                    .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
            }

            const { candidateId, jobId } = req.params;
            req.whatsapp = fastify.whatsapp;
            await aiCallTriggerer(candidateId, jobId, req, reply, true);
        }
    );

    fastify.get('/schedule/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { candidate, job } = req.query;
        try {
            const gteCandidateATSs = await candAtsSvc.readFiltered(
                {
                    candidate: candidate,
                    job: job,
                    scheduleTimes: {
                        $elemMatch: {
                            scheduleTime: { $gte: new Date() },
                            scheduleStatus: 'Scheduled'
                        }
                    }
                },
                req,
                false,
                null,
                false,
                '_id candidate job scheduleTimes'
            );

            return reply.code(200).send(gteCandidateATSs);
        } catch (err) {
            return reply.code(400).send({
                message: 'Error in getting schedule details...',
                details: {
                    error: err
                }
            });
        }
    });

    fastify.post('/schedule/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { candidates, scheduleTime } = req.body;
        const schRes = await createSchedule(candidates, scheduleTime, req);
        return reply.code(schRes?.code || 200).send(schRes);
    });

    fastify.put('/schedule/change/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { candidates, scheduleTime, existingScheduleTime } = req.body;
        if (!existingScheduleTime) {
            return reply.code(404).send({
                message:
                    'Existing Schedule Time not found, please schedule it first...'
            });
        }
        const parsedScheduleTime = parseScheduleTime(scheduleTime, req);
        const parsedExistingScheduleTime = parseScheduleTime(existingScheduleTime, req);
        if (
            !parsedScheduleTime ||
            Number.isNaN(parsedScheduleTime.getTime()) ||
            !parsedExistingScheduleTime ||
            Number.isNaN(parsedExistingScheduleTime.getTime())
        ) {
            return reply.code(400).send({
                message: 'Invalid schedule time provided.'
            });
        }
        const callTimeOutIds = [];
        try {
            const errorsInATS = [];
            const updatedATSs = [];
            for (const candEle of candidates) {
                const candidateATSs = await candAtsSvc.readFiltered(
                    {
                        candidate: candEle?._id,
                        job: candEle?.jobId,
                        scheduleTimes: {
                            $elemMatch: {
                                scheduleTime: parsedExistingScheduleTime,
                                scheduleStatus: 'Scheduled'
                            }
                        }
                    },
                    req,
                    false,
                    null,
                    false,
                    '_id candidate job scheduleTimes'
                );

                const callTimeOutSecs = parsedScheduleTime.getTime() - Date.now();

                const existingTimeoutId = getGlobalSchedulesValue(
                    `${candEle?._id}, ${candEle?.jobId}`,
                    'Not found'
                );
                const isAlreadyExist = existingTimeoutId !== 'Not found';

                if (callTimeOutSecs > 0) {
                    if (
                        (isAllowedCallingHourIST() ||
                            process?.env?.NODE_ENV === 'development') &&
                        !(await isAICallCreditsExausted(req))
                    ) {
                        candEle?._id &&
                            candEle?.jobId &&
                            candidateATSs[0]?._id &&
                            (await candAtsSvc.update(
                                candidateATSs[0]?._id,
                                {
                                    $set: {
                                        'scheduleTimes.$.scheduleTime':
                                            parsedScheduleTime
                                    }
                                },
                                req,
                                false,
                                false,
                                {
                                    'scheduleTimes.scheduleTime':
                                        parsedExistingScheduleTime,
                                    'scheduleTimes.scheduleStatus': 'Scheduled'
                                }
                            ));

                        let timeoutId = setTimeout(async () => {
                            if (
                                (isAllowedCallingHourIST() ||
                                    process?.env?.NODE_ENV === 'development') &&
                                !(await isAICallCreditsExausted(req))
                            ) {
                                const dummyReply = {
                                    code: code =>
                                        console.log(
                                            '\n[AfterAICallSchedule] ReplyCode: ',
                                            code
                                        ) || {
                                            send: dt =>
                                                console.log(
                                                    '\n[AfterAICallSchedule] ReplyCodeSend: ',
                                                    dt
                                                )
                                        },
                                    send: dt =>
                                        console.log(
                                            '\n[AfterAICallSchedule] ReplySend: ',
                                            dt
                                        )
                                };

                                aiCallTriggerer(
                                    candEle?._id,
                                    candEle?.jobId,
                                    req,
                                    dummyReply
                                )
                                    .then(() => {
                                        candEle?._id &&
                                            candEle?.jobId &&
                                            candidateATSs[0]?._id &&
                                            candAtsSvc.update(
                                                candidateATSs[0]?._id,
                                                {
                                                    $set: {
                                                        'scheduleTimes.$.scheduleStatus':
                                                            'Executed'
                                                    }
                                                },
                                                req,
                                                false,
                                                false,
                                                {
                                                    'scheduleTimes.scheduleTime':
                                                        parsedScheduleTime
                                                }
                                            );

                                        deleteGlobalSchedule(
                                            `${candEle?._id}, ${candEle?.jobId}`
                                        );
                                    })
                                    .catch(err => {
                                        candEle?._id &&
                                            candEle?.jobId &&
                                            candidateATSs[0]?._id &&
                                            candAtsSvc.update(
                                                candidateATSs[0]?._id,
                                                {
                                                    $set: {
                                                        'scheduleTimes.$.scheduleStatus':
                                                            'Errored',
                                                        'scheduleTimes.$.errorDetails':
                                                            err
                                                    }
                                                },
                                                req,
                                                false,
                                                false,
                                                {
                                                    'scheduleTimes.scheduleTime':
                                                        parsedScheduleTime
                                                }
                                            );

                                        deleteGlobalSchedule(
                                            `${candEle?._id}, ${candEle?.jobId}`
                                        );
                                    });
                            } else {
                                console.log(
                                    '❌ Candidate AI Call(' +
                                    candEle?._id +
                                    ') was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: ' +
                                    new Date() +
                                    ' Or may AI Call credits are exausted...'
                                );
                            }
                        }, callTimeOutSecs);

                        if (isAlreadyExist) {
                            deleteGlobalSchedule(
                                `${candEle?._id}, ${candEle?.jobId}`
                            );
                        }

                        setGlobalSchedules({
                            [`${candEle?._id}, ${candEle?.jobId}`]: timeoutId
                        });
                        callTimeOutIds.push(timeoutId);

                        updatedATSs.push(candidateATSs[0]?._id);
                    } else {
                        return reply.code(400).send({
                            message: 'Error in change call schedule...',
                            details: {
                                isAllowedCallingHourIST: isAllowedCallingHourIST(),
                                isAICallCreditsExausted:
                                    !(await isAICallCreditsExausted(req))
                            }
                        });
                    }
                } else {
                    errorsInATS?.push({
                        candidateId: candEle?._id,
                        jobId: candEle?.jobId,
                        message: 'Schedule timing are not valid...'
                    });
                }
            }

            if (errorsInATS?.length > 0) {
                return reply.code(400).send({
                    message: errorsInATS
                        ?.map?.(ele => ele?.message)
                        .join('\n '),
                    details: { errorsInATS }
                });
            }

            return reply.code(200).send({
                message: 'Call(s) schedule changed successfully...',
                details: { updatedATSs }
            });
        } catch (err) {
            callTimeOutIds.forEach(ele => clearTimeout(ele));
            console.log('Error during Call(s) schedule changing: ', err);

            return reply.code(400).send({
                message:
                    'Error during Call(s) schedule changing ' +
                    (err?.message || err) +
                    '...',
                details: err?.message || err
            });
        }
    });

    fastify.delete('/schedule/clear/', async (req, reply) => {
        if (!['ultra_admin', 'client_admin', 'recruiter'].includes(req.user.role)) {
            return reply
                .code(406)
                .send({ ok: false, code: 406, message: `This service unavailable for this user...` });
        }

        const { candidates } = req.body;
        const callTimeOutIds = [];
        try {
            const errorsInATS = [];
            const updatedATSs = [];
            for (const candEle of candidates) {
                const gteCandidateATSs = await candAtsSvc.readFiltered(
                    {
                        candidate: candEle?._id,
                        job: candEle?.jobId,
                        scheduleTimes: {
                            $elemMatch: {
                                scheduleTime: { $gte: new Date() },
                                scheduleStatus: 'Scheduled'
                            }
                        }
                    },
                    req,
                    false,
                    null,
                    false,
                    '_id candidate job scheduleTimes'
                );

                const existingTimeoutId = getGlobalSchedulesValue(
                    `${candEle?._id}, ${candEle?.jobId}`,
                    'Not found'
                );

                if (existingTimeoutId !== 'Not found') {
                    deleteGlobalSchedule(
                        `${candEle?._id}, ${candEle?.jobId}`
                    );
                }

                if ((gteCandidateATSs || [])?.length > 0) {
                    candEle?._id &&
                        candEle?.jobId &&
                        gteCandidateATSs[0]?._id &&
                        (await candAtsSvc.update(
                            gteCandidateATSs[0]?._id,
                            {
                                $set: {
                                    'scheduleTimes.$.scheduleStatus':
                                        'Blocked'
                                }
                            },
                            req,
                            false,
                            false,
                            {
                                'scheduleTimes.scheduleStatus': 'Scheduled'
                            }
                        ));

                    updatedATSs.push(gteCandidateATSs[0]?._id);
                } else {
                    errorsInATS?.push({
                        ok: false,
                        code: 404,
                        message:
                            'Schedules not found for this candidate and job combinations...',
                        details: {
                            candidate: candEle
                        }
                    });
                }
            }

            if (errorsInATS?.length > 0) {
                return reply.code(400).send({
                    message: errorsInATS
                        ?.map?.(ele => ele?.message)
                        .join('\n '),
                    details: { errorsInATS }
                });
            }

            return reply.code(200).send({
                message: 'Call(s) schedule cleared successfully...',
                details: { updatedATSs }
            });
        } catch (err) {
            callTimeOutIds.forEach(ele => clearTimeout(ele));
            console.log('Error during Call(s) schedule clearing: ', err);

            return reply.code(400).send({
                message:
                    'Error during Call(s) schedule clearing ' +
                    (err?.message || err) +
                    '...',
                details: err?.message || err
            });
        }
    });
}

export default aiCallRoutes;
