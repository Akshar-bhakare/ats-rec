import { Response as plivoResponse } from 'plivo';
import { AiCallManager } from '../services/aiCalling/aiCallOrchestrationV2.js';
import { setupAuthAndOtherDetails } from './candidateFromJobSocialRoutes.js';
import { telnyxRequest } from '../services/aiCalling/providers/telnyxProvider.js';
import { aiCallStatuses, causeExplanations, sourceExplanations } from './aiCallRoutes.js';
import { getClientDbConn } from '../utils/clientDbUtils.js';
import { getClientReminderSettings, buildReminderCallContext } from '../services/interviewReminder/interviewReminderService.js';

// Maps callId → { candidateId, jobId }  (used for hangup lookup)
const inboundCallInstances = {};

// Maps callControlId → Promise<search result>
// Background phone search is kicked off during call.initiated (Telnyx only)
// and awaited during call.answered — by then it's often already done.
const pendingPhoneSearches = {};

// Maps callId → collection session for unknown callers
// Session is active while the AI is asking script questions to collect lead data.
const inboundCollectionSessions = {};

// Maps callControlId → true
// When set, the NEXT call.speak.ended for that call will trigger a hangup instead of a gather.
// Used to let speech finish before hanging up.
const pendingHangups = {};

// ─────────────────────────────────────────────────────────────────────────────
//  Console log helpers
// ─────────────────────────────────────────────────────────────────────────────

const LOG_WIDTH = 78;

const logBox = (title) => {
    const bar = '═'.repeat(LOG_WIDTH);
    const padded = title.padEnd(LOG_WIDTH - 2);
    console.log(`\n╔${bar}╗`);
    console.log(`║  ${padded}║`);
    console.log(`╚${bar}╝`);
};

// ─────────────────────────────────────────────────────────────────────────────
//  Instance helpers
// ─────────────────────────────────────────────────────────────────────────────

const resolveInboundInstance = (candidateId, jobId) =>
    AiCallManager.allInstances?.[`${candidateId}, ${jobId}`] ||
    AiCallManager.allInstances?.[`${candidateId},${jobId}`] ||
    null;

const clearInboundInstance = (candidateId, jobId, callId) => {
    const k1 = `${candidateId}, ${jobId}`;
    const k2 = `${candidateId},${jobId}`;
    AiCallManager.allInstances[k1] = undefined;
    AiCallManager.allInstances[k2] = undefined;
    if (callId) delete inboundCallInstances[callId];
};

// ─────────────────────────────────────────────────────────────────────────────
//  Phone number helpers
// ─────────────────────────────────────────────────────────────────────────────

const phoneVariants = (raw) => {
    const s = String(raw || '').trim();
    if (!s) return [];
    const variants = [s];
    if (s.startsWith('+')) {
        variants.push(s.slice(1));
    } else {
        variants.push('+' + s);
    }
    return variants;
};

// ─────────────────────────────────────────────────────────────────────────────
//  PARALLEL DB HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const findCandidateByPhone = async (fromNumber) => {
    const variants = phoneVariants(fromNumber);

    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
    const allClients = await globalConn.models.ClientAdmin
        .find({}, 'clientCompany')
        .lean()
        .exec();

    const clientsWithDb = allClients.filter(c => c.clientCompany);
    console.log(`[Inbound] 🔍 Searching ${clientsWithDb.length} client DB(s) in parallel for: ${variants.join(' or ')}`);

    return new Promise((resolve) => {
        let pending = clientsWithDb.length;
        if (pending === 0) { resolve(null); return; }

        for (const client of clientsWithDb) {
            const dbName = client.clientCompany;
            getClientDbConn(dbName)
                .then(async (dbConn) => {
                    const candidate = await dbConn.models.Candidate.findOne({
                        $expr: {
                            $in: [{ $concat: ['$countryCode', '$phoneNumber'] }, variants],
                        },
                    }).lean().exec();
                    return candidate ? { candidate, dbConn, dbName } : null;
                })
                .then((result) => {
                    if (result) {
                        console.log(`[Inbound] ✅ Candidate found in DB: ${result.dbName}`);
                        resolve(result);
                    } else if (--pending === 0) {
                        resolve(null);
                    }
                })
                .catch((err) => {
                    console.log(`[Inbound] ⚠️  Error searching DB ${dbName}: ${err?.message || err}`);
                    if (--pending === 0) resolve(null);
                });
        }
    });
};

const findScriptByCalledNumber = async (calledNumber) => {
    if (!calledNumber) return null;

    const variants = phoneVariants(calledNumber);

    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
    const allClients = await globalConn.models.ClientAdmin
        .find({}, 'clientCompany')
        .lean()
        .exec();

    const clientsWithDb = allClients.filter(c => c.clientCompany);

    return new Promise((resolve) => {
        let pending = clientsWithDb.length;
        if (pending === 0) { resolve(null); return; }

        for (const client of clientsWithDb) {
            const dbName = client.clientCompany;
            getClientDbConn(dbName)
                .then(async (dbConn) => {
                    const script = await dbConn.models.InboundCallScript.findOne({
                        isArchived: false,
                        numbers: { $in: variants },
                    }).lean().exec();
                    return script ? { dbConn, dbName, script } : null;
                })
                .then((result) => {
                    if (result) resolve(result);
                    else if (--pending === 0) resolve(null);
                })
                .catch(() => {
                    if (--pending === 0) resolve(null);
                });
        }
    });
};

// ─────────────────────────────────────────────────────────────────────────────
//  COLLECTION SESSION HELPERS — unknown caller Q&A
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the ordered list of questions from an InboundCallScript.
 */
const buildQuestions = (script) => {
    const qs = [];
    if (script.jobQuestion?.trim()) qs.push({ type: 'job', text: script.jobQuestion.trim() });
    if (script.companyQuestion?.trim()) qs.push({ type: 'company', text: script.companyQuestion.trim() });
    (script.basicQuestions || []).forEach((q) => {
        if (q?.trim()) qs.push({ type: 'basic', text: q.trim() });
    });
    if (script.skillsPrompt?.trim()) qs.push({ type: 'skills', text: script.skillsPrompt.trim() });
    return qs;
};

/**
 * Create a new collection session for an unknown caller.
 * The session is keyed by callId (callControlId for Telnyx, callUUID for Plivo).
 */
const createCollectionSession = (callId, from, to, script, dbConn) => {
    const session = {
        callId,
        questions: buildQuestions(script),
        questionIndex: 0,
        answers: { jobInterest: null, currentCompany: null, basicAnswers: [], skillsAnswer: null },
        from,
        to,
        script,
        dbConn,
        // 'greeting' → speaks the "not registered" intro first
        // 'question'  → speaks each Q and issues a gather after each
        phase: 'greeting',
    };
    inboundCollectionSessions[callId] = session;
    return session;
};

const incrementUnknownInboundLeadCredit = async (clientUserId) => {
    if (!clientUserId) {
        throw new Error('Missing client user id for inbound lead credit increment');
    }

    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
    const updated = await globalConn.models.ClientAdmin
        .findOneAndUpdate(
            { user: clientUserId, isArchived: false },
            { $inc: { totalCallCount: 1 } },
            { new: true }
        )
        .lean()
        .exec();

    if (!updated) {
        throw new Error(`ClientAdmin not found for inbound lead credit increment. user=${clientUserId}`);
    }

    return updated;
};

/**
 * Record a spoken answer into the session and advance the question index.
 */
const saveAnswer = (session, transcript) => {
    const q = session.questions[session.questionIndex];
    if (!q) return;
    const text = (transcript || '').trim();
    if (q.type === 'job') session.answers.jobInterest = text || null;
    if (q.type === 'company') session.answers.currentCompany = text || null;
    if (q.type === 'basic') session.answers.basicAnswers.push(text);
    if (q.type === 'skills') session.answers.skillsAnswer = text || null;
    session.questionIndex++;
};

/**
 * Persist the collected lead to the client DB.
 */
const persistLead = async (session) => {
    const { callId, from, to, answers, script, dbConn } = session;
    if (!dbConn || !script?.client) return null;

    try {
        const leadDoc = await dbConn.models.InboundLead.create({
            client: script.client,
            callId,
            phone: from,
            calledNumber: to,
            jobInterest: answers.jobInterest,
            currentCompany: answers.currentCompany,
            basicAnswers: answers.basicAnswers,
            skillsAnswer: answers.skillsAnswer,
            callDate: new Date(),
            countedTowardsCredits: false,
        });

        try {
            await incrementUnknownInboundLeadCredit(script.client);
            leadDoc.countedTowardsCredits = true;
            leadDoc.creditCountedAt = new Date();
            await leadDoc.save();
            console.log(`  💳 InboundLead counted toward AI credits: ${from}`);
        } catch (creditErr) {
            console.log(`  ⚠️  InboundLead credit increment failed: ${creditErr?.message || creditErr}`);
        }

        console.log(`  📝 InboundLead saved for unknown caller: ${from}`);
        return leadDoc;
    } catch (e) {
        if (e?.code === 11000 && callId) {
            console.log(`  ℹ️  InboundLead already persisted for callId=${callId}; checking credit status`);
            const existingLead = await dbConn.models.InboundLead
                .findOne({ client: script.client, callId, isArchived: false })
                .exec();

            if (existingLead && !existingLead.countedTowardsCredits) {
                try {
                    await incrementUnknownInboundLeadCredit(script.client);
                    existingLead.countedTowardsCredits = true;
                    existingLead.creditCountedAt = new Date();
                    await existingLead.save();
                    console.log(`  💳 Existing InboundLead backfilled into AI credits: ${from}`);
                } catch (creditErr) {
                    console.log(`  ⚠️  Existing InboundLead credit backfill failed: ${creditErr?.message || creditErr}`);
                }
            }

            return existingLead;
        }
        console.log(`  ⚠️  InboundLead save failed: ${e?.message}`);
        return null;
    }
};

const THANKS_MSG = 'Thank you for sharing your information. Our recruiter will review your details and get back to you soon. Goodbye!';

/**
 * Finish a Telnyx collection session: persist lead, speak thanks, then hangup
 * when call.speak.ended fires (via pendingHangups — no fragile setTimeout).
 */
const finishTelnyxCollection = async (callControlId, req) => {
    const session = inboundCollectionSessions[callControlId];
    if (!session) return;

    // Delete session FIRST so call.speak.ended doesn't re-trigger gather
    delete inboundCollectionSessions[callControlId];

    await persistLead(session);

    // Mark: next speak.ended → hangup
    pendingHangups[callControlId] = true;

    try {
        await telnyxRequest({
            path: `/calls/${callControlId}/actions/speak`,
            method: 'POST',
            data: { payload: THANKS_MSG, voice: 'female', language: 'en-US' },
            req,
        });
    } catch { /* best-effort */ }
};

// ─────────────────────────────────────────────────────────────────────────────
//  CALLBACK CONTEXT LOOKUP
//  When a candidate calls us back after missing an outbound call, we look up
//  their latest outbound Conversation record to know WHY we called them:
//    - callType='screening'  → run a normal AI screening session
//    - callType='reminder'   → reconstruct reminder context and use reminder AI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the most recent outbound Conversation for this candidate, or null.
 * Only looks at calls from the last 24 hours so stale logs don't affect callbacks.
 */
const lookupLastOutboundCall = async (dbConn, candidateId) => {
    try {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours
        const conv = await dbConn.models.Conversation
            .findOne({
                candidateId,
                direction: 'outbound',
                createdAt: { $gte: since },
            })
            .sort({ createdAt: -1 })
            .lean()
            .exec();
        return conv;
    } catch (err) {
        console.log(`[Inbound] ⚠️  lookupLastOutboundCall error: ${err?.message || err}`);
        return null;
    }
};

/**
 * Fetches the InterviewSchedule + client settings in parallel, then builds
 * the reminderCallContext the AI prompt needs for a callback reminder session.
 * Returns null if the schedule can't be found.
 */
const buildReminderContextFromSchedule = async (dbConn, interviewScheduleId, clientId) => {
    if (!interviewScheduleId) return null;
    try {
        const [schedule, settings] = await Promise.all([
            dbConn.models.InterviewSchedule
                .findById(interviewScheduleId)
                .populate('candidate', 'firstName lastName')
                .populate('job', 'title')
                .lean()
                .exec(),
            getClientReminderSettings({ client: clientId, dbName: dbConn?.db?.databaseName }),
        ]);

        if (!schedule) return null;

        return buildReminderCallContext(schedule, settings, interviewScheduleId);
    } catch (err) {
        console.log(`[Inbound] ⚠️  buildReminderContextFromSchedule error: ${err?.message || err}`);
        return null;
    }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Session init — uses pre-fetched candidate search result
// ─────────────────────────────────────────────────────────────────────────────

const initInboundAiSession = async (req, fromNumber, preFoundResult = null) => {

    // 1. Find candidate — use pre-fetched result if available (saves round-trip)
    const found = preFoundResult ?? await findCandidateByPhone(fromNumber);

    if (!found) {
        console.log(`[Inbound] ❌ Caller not found in any client DB: ${fromNumber}`);
        return { ok: false, reason: 'not_in_db' };
    }

    const { candidate, dbConn } = found;

    // Point req.conn at the client DB where candidate was found
    req.conn = dbConn;

    // Tag candidate as inbound source (once) so recruiters can see where the lead came from
    if (!candidate.sourcePlatform) {
        dbConn.models.Candidate.updateOne(
            { _id: candidate._id },
            { $set: { sourcePlatform: 'inbound', sourceExtraInfo: fromNumber } },
        ).catch(() => { /* best-effort */ });
    }

    // 2. Find most recent pending CandidateATS
    const pendingATS = await req.conn.models.CandidateATS.findOne({
        candidate: candidate._id,
        isArchived: false,
        aiCallStatus: { $nin: ['Completed', 'completed'] },
    })
        .sort({ createdAt: -1 })
        .populate({ path: 'client', model: 'User', select: 'email' })
        .lean()
        .exec();

    let ats = pendingATS;
    let supportMode = false;

    if (!ats) {
        const anyATS = await req.conn.models.CandidateATS.findOne({
            candidate: candidate._id,
            isArchived: false,
        })
            .sort({ createdAt: -1 })
            .populate({ path: 'client', model: 'User', select: 'email' })
            .lean()
            .exec();

        if (!anyATS) {
            console.log(`[Inbound] ❌ No job applications found for candidate: ${fromNumber}`);
            return { ok: false, reason: 'no_ats' };
        }

        ats = anyATS;
        supportMode = true;
    }

    const candidateId = String(candidate._id);
    let jobId = String(ats.job);
    const recruiterEmail = ats?.client?.email;

    if (!recruiterEmail) {
        const msg = `Cannot resolve recruiter account for client ${ats?.client}`;
        console.log(`[Inbound] ❌ ${msg}`);
        return { ok: false, reason: 'no_recruiter', detail: msg };
    }

    // 3. Re-auth + call-log lookup run in parallel — they hit different DBs
    //    setupAuthAndOtherDetails queries the global DB for recruiter auth (sets req.conn, req.client)
    //    lookupLastOutboundCall queries the client DB we already have open
    const [, lastOutbound] = await Promise.all([
        setupAuthAndOtherDetails(req, recruiterEmail),
        lookupLastOutboundCall(dbConn, candidate._id),
    ]);

    // 4. Determine callback context
    if (lastOutbound) {
        console.log(`[Inbound] 📋 Last outbound call type: "${lastOutbound.callType}" (${lastOutbound.createdAt?.toLocaleString()})`);
    } else {
        console.log(`[Inbound] 📋 No recent outbound call found — using screening mode`);
    }

    if (lastOutbound?.callType === 'reminder' && lastOutbound?.interviewScheduleId) {
        console.log(`[Inbound] 🔔 Callback is for a REMINDER call — reconstructing reminder context`);
        const reminderCtx = await buildReminderContextFromSchedule(
            dbConn,
            lastOutbound.interviewScheduleId,
            req.client,  // set by setupAuthAndOtherDetails above
        );

        if (reminderCtx) {
            req.callPurpose = 'interview_reminder';
            req.reminderCallContext = reminderCtx;
            // Override jobId so the AI session uses the job linked to the reminder,
            // not the job from the ATS that happened to be most recent.
            if (reminderCtx.jobId) jobId = reminderCtx.jobId;
            console.log(`[Inbound] ✅ Reminder context injected: job="${reminderCtx.jobTitle}" (${jobId}), schedule=${lastOutbound.interviewScheduleId}`);
        } else {
            console.log(`[Inbound] ⚠️  Could not rebuild reminder context — falling back to screening`);
        }
    }

    // callbackCallType derived from whether reminder context was injected
    const callbackCallType = req.callPurpose === 'interview_reminder' ? 'reminder' : 'screening';

    // 5. Create + init AiCallManager
    const AiService = new AiCallManager();
    AiService.req = req;
    AiService.callMode = 'normal';
    if (supportMode) AiService.postInterviewSupportMode = true;

    const initRes = await AiService.init(candidateId, jobId, req);
    if (!initRes?.ok) {
        return {
            ok: false,
            reason: 'init_failed',
            detail: initRes?.message || 'AiCallManager.init() failed',
        };
    }

    return { ok: true, AiService, candidateId, jobId, candidate, supportMode, callbackCallType };
};

// ─────────────────────────────────────────────────────────────────────────────
//  Common: Update CandidateATS on hangup + clear instance maps
// ─────────────────────────────────────────────────────────────────────────────

const handleInboundHangup = async ({ candidateId, jobId, callId, CallStatus, HangupCause, HangupSource }) => {
    const AiService = resolveInboundInstance(candidateId, jobId);

    if (!AiService) {
        console.log(`[Inbound][Hangup] ⚠️  No AiCallManager found for candidate=${candidateId} job=${jobId}`);
        clearInboundInstance(candidateId, jobId, callId);
        return;
    }

    const req = AiService.req;
    const statusKey = String(CallStatus || '');
    const causeKey = String(HangupCause || '');
    const sourceKey = String(HangupSource || '');

    const statusDesc =
        aiCallStatuses[statusKey] || aiCallStatuses[statusKey.toLowerCase()] || 'Completed';
    const causeDesc =
        causeExplanations[causeKey] || causeExplanations[causeKey.toLowerCase()] || `Hang-up cause: "${causeKey}"`;
    const sourceDesc =
        sourceExplanations[sourceKey] || sourceExplanations[sourceKey.toLowerCase()] || `Hang-up by: "${sourceKey}"`;

    try {
        const cand = await req.conn.models.Candidate.findOne({ _id: candidateId, isArchived: false })
            .populate('applications')
            .lean()
            .exec();

        const candAts = (cand?.applications || []).find((a) => String(a.job) === jobId);

        if (candAts) {
            const updated = await req.conn.models.CandidateATS.findOneAndUpdate(
                { _id: candAts._id, isArchived: false },
                {
                    aiCallStatus: statusDesc,
                    aiCallHangUpCause: causeDesc,
                    aiCallHangUpSource: sourceDesc,
                },
                { new: true }
            ).exec();
            console.log(`[Inbound][Hangup][${callId}] ✅ ATS updated: ${updated?._id}`);
        } else {
            console.log(`[Inbound][Hangup][${callId}] ❌ CandidateATS not found — candidate=${candidateId} job=${jobId}`);
        }
    } catch (err) {
        console.log(`[Inbound][Hangup][${callId}] ❌ Error updating ATS: ${err?.message || err}`);
    }

    clearInboundInstance(candidateId, jobId, callId);
};

// ─────────────────────────────────────────────────────────────────────────────
//  TELNYX — POST /webhooks/telnyx/voice
//
//  PARALLEL HYBRID FLOW (known callers):
//    call.initiated  → auto-answer + START background phone search (cached)
//    call.answered   → find client script → play greeting → await cached search
//                      → if found: init AI + streaming
//                      → if not found but script exists: START COLLECTION SESSION
//    call.speak.ended→ if collection session active: issue gather
//    call.gather.ended→ save answer → ask next Q or finish + save InboundLead
//    call.hangup     → update ATS / save partial lead / clear instances
// ─────────────────────────────────────────────────────────────────────────────

export async function telnyxInboundRoutes(fastify) {

    fastify.post('/voice', { logLevel: 'info' }, async (req, reply) => {

        // ACK Telnyx immediately (Telnyx retries on non-2xx)
        reply.code(200).send({ ok: true });

        const eventType = req.body?.data?.event_type || null;
        const payload = req.body?.data?.payload || {};
        const callControlId = payload?.call_control_id || null;
        const from = payload?.from || null;
        const to = payload?.to || null;
        const direction = payload?.direction || 'inbound';
        const callState = payload?.call_state || '';
        const ts = new Date().toLocaleString();

        // ── call.initiated ────────────────────────────────────────────────────
        if (eventType === 'call.initiated') {
            logBox('📱 TELNYX INCOMING CALL — CALL.INITIATED');
            console.log(`  📞 CALLER INFO:`);
            console.log(`    ├─ From:            ${from || 'Unknown'}`);
            console.log(`    └─ Direction:       ${direction}`);
            console.log(`  📲 CALLED NUMBER:`);
            console.log(`    └─ To:              ${to || 'Unknown'}`);
            console.log(`  📋 CALL DETAILS:`);
            console.log(`    ├─ Call Control ID: ${callControlId}`);
            console.log(`    ├─ Call State:      ${callState}`);
            console.log(`    ├─ Event:           call.initiated`);
            console.log(`    └─ Timestamp:       ${ts}`);

            // Auto-answer
            try {
                await telnyxRequest({
                    path: `/calls/${callControlId}/actions/answer`,
                    method: 'POST',
                    data: {},
                    req,
                });
                console.log(`\n  ✅ Auto-answered call: ${callControlId}`);
            } catch (err) {
                console.log(`\n  ❌ Auto-answer failed (${callControlId}): ${err?.message || err}`);
            }

            // Start background phone search immediately
            if (from) {
                console.log(`  ⚡ Background phone search started for: ${from}`);
                pendingPhoneSearches[callControlId] = findCandidateByPhone(from);
            }

            return;
        }

        // ── call.answered ─────────────────────────────────────────────────────
        if (eventType === 'call.answered') {
            logBox('✅ TELNYX INCOMING CALL — CALL.ANSWERED');
            console.log(`  📞 From:      ${from}`);
            console.log(`  📲 To:        ${to}`);
            console.log(`  📋 ID:        ${callControlId}`);
            console.log(`  🕐 Time:      ${ts}`);

            try {
                // STEP 1: Find InboundCallScript for this called number
                const scriptResult = await findScriptByCalledNumber(to);
                const inboundScript = scriptResult?.script || null;

                // STEP 2: Play greeting (non-blocking — masks search time)
                const greeting = inboundScript?.greeting
                    || 'Hello! Thank you for calling. Please hold on for a moment.';

                telnyxRequest({
                    path: `/calls/${callControlId}/actions/speak`,
                    method: 'POST',
                    data: { payload: greeting, voice: 'female', language: 'en-US' },
                    req,
                }).catch(() => { /* best-effort */ });

                console.log(`  🔊 Playing greeting (${inboundScript ? 'from InboundScript' : 'default'})`);

                // STEP 3: Await pre-started phone search
                let searchResult = null;
                if (pendingPhoneSearches[callControlId]) {
                    console.log(`  ⚡ Awaiting pre-started phone search…`);
                    const t0 = Date.now();
                    searchResult = await pendingPhoneSearches[callControlId];
                    delete pendingPhoneSearches[callControlId];
                    const elapsed = Date.now() - t0;
                    console.log(`  ✅ Phone search resolved in ${elapsed}ms (${searchResult ? 'found' : 'not found'})`);
                } else {
                    console.log(`  🔍 No pre-started search — running fresh search…`);
                    searchResult = await findCandidateByPhone(from);
                }

                // STEP 4: Route call
                if (!searchResult) {
                    console.log(`  ❌ Caller not found in any DB: ${from}`);

                    // ── UNKNOWN CALLER — start collection if script is configured ──
                    if (inboundScript && scriptResult?.dbConn) {
                        const session = createCollectionSession(callControlId, from, to, inboundScript, scriptResult.dbConn);

                        if (session.questions.length > 0) {
                            console.log(`  🎤 Starting collection — ${session.questions.length} question(s)`);
                            // Speak "not registered" intro (phase: 'greeting').
                            // call.speak.ended will then ask Q1 and trigger the gather cycle.
                            const introMsg =
                                'Your number is not registered in our system. ' +
                                'Please contact the recruiter to register your profile. ' +
                                `I will now collect your details so our team can follow up with you.`;
                            telnyxRequest({
                                path: `/calls/${callControlId}/actions/speak`,
                                method: 'POST',
                                data: { payload: introMsg, voice: 'female', language: 'en-US' },
                                req,
                            }).catch(() => { /* best-effort */ });
                            // call.speak.ended (phase='greeting') → ask Q1
                            // call.speak.ended (phase='question') → gather
                        } else {
                            // Script has no questions — save lead + thanks + hangup
                            await persistLead(session);
                            delete inboundCollectionSessions[callControlId];
                            pendingHangups[callControlId] = true;
                            telnyxRequest({
                                path: `/calls/${callControlId}/actions/speak`,
                                method: 'POST',
                                data: { payload: THANKS_MSG, voice: 'female', language: 'en-US' },
                                req,
                            }).catch(() => { /* best-effort */ });
                        }
                    } else {
                        // No script configured — speak "not registered", then hang up
                        // after speech finishes (pendingHangups → call.speak.ended → hangup).
                        const msg =
                            'Sorry, your number is not registered in our system. ' +
                            'Please contact the recruiter directly to register. Goodbye.';
                        console.log(`  📢 Playing not-registered message, will hang up after speech`);
                        pendingHangups[callControlId] = true;
                        telnyxRequest({
                            path: `/calls/${callControlId}/actions/speak`,
                            method: 'POST',
                            data: { payload: msg, voice: 'female', language: 'en-US' },
                            req,
                        }).catch(() => { /* best-effort */ });
                    }
                    return;
                }

                // STEP 5: Known caller — init AI session
                const result = await initInboundAiSession(req, from, searchResult);

                if (!result.ok) {
                    console.log(
                        `  ❌ Session init failed — reason: ${result.reason}` +
                        (result.detail ? ` (${result.detail})` : '')
                    );

                    let msg = 'Sorry, we could not process your call at this time. Goodbye.';
                    if (result.reason === 'no_ats')
                        msg = 'Sorry, you have no active job applications on file. Please contact the recruiter. Goodbye.';
                    if (result.reason === 'no_recruiter')
                        msg = 'Sorry, we could not find your account details. Please contact the recruiter. Goodbye.';

                    // Use pendingHangups so the speech plays fully before hangup
                    pendingHangups[callControlId] = true;
                    telnyxRequest({
                        path: `/calls/${callControlId}/actions/speak`,
                        method: 'POST',
                        data: { payload: msg, voice: 'female', language: 'en-US' },
                        req,
                    }).catch(() => { /* best-effort */ });
                    return;
                }

                const { AiService, candidateId, jobId, candidate, supportMode, callbackCallType } = result;
                const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown';

                console.log(`  👤 Candidate: ${candidateName} (${from})`);
                const modeLabel = supportMode
                    ? 'Post-interview support'
                    : callbackCallType === 'reminder'
                        ? 'Interview reminder callback'
                        : 'Screening callback';
                console.log(`  🎯 Mode: ${modeLabel} — candidateId=${candidateId} jobId=${jobId}`);

                AiService.callUUID = callControlId;
                AiService.inboundCalledNumber = to;
                inboundCallInstances[callControlId] = { candidateId, jobId };

                await AiService.startTelnyxStreaming(callControlId);

                const aiLabel = supportMode
                    ? 'Support'
                    : callbackCallType === 'reminder' ? 'Reminder' : 'Screening';
                console.log(`  🤖 AI ${aiLabel} started: ${candidateName} | Job: ${jobId}\n`);
            } catch (err) {
                console.log(`  ❌ Error in call.answered handler: ${err?.message || err}`);
            }
            return;
        }

        // ── call.speak.ended ──────────────────────────────────────────────────
        if (eventType === 'call.speak.ended') {

            // PRIORITY 1: pending hangup (not-registered / error / thanks messages)
            if (pendingHangups[callControlId]) {
                delete pendingHangups[callControlId];
                console.log(`  📴 [speak.ended] Pending hangup firing for ${callControlId}`);
                telnyxRequest({
                    path: `/calls/${callControlId}/actions/hangup`,
                    method: 'POST',
                    data: {},
                    req,
                }).catch(() => { });
                return;
            }

            const session = inboundCollectionSessions[callControlId];
            if (!session) return; // Normal AI streaming call — not our concern

            // PRIORITY 2: greeting phase → ask first question
            if (session.phase === 'greeting') {
                session.phase = 'question';
                const firstQ = session.questions[0];
                if (firstQ) {
                    console.log(`  🎤 [Collection] Greeting ended → asking Q1: "${firstQ.text}"`);
                    telnyxRequest({
                        path: `/calls/${callControlId}/actions/speak`,
                        method: 'POST',
                        data: { payload: firstQ.text, voice: 'female', language: 'en-US' },
                        req,
                    }).catch(() => { /* best-effort */ });
                    // call.speak.ended (phase='question') will trigger the gather
                }
                return;
            }

            // PRIORITY 3: question phase → issue gather so caller can answer
            console.log(`  🎤 [Collection] Speak ended → starting gather (${callControlId})`);
            try {
                await telnyxRequest({
                    path: `/calls/${callControlId}/actions/gather`,
                    method: 'POST',
                    data: {
                        gather_type: 'speech',
                        minimum_silence_ms: 500,
                        speech_timeout: 15000,
                        speech_end_timeout: 1200,
                        language: 'en-US',
                    },
                    req,
                });
            } catch (err) {
                console.log(`  ⚠️  Gather start failed: ${err?.message}`);
            }
            return;
        }

        // ── call.gather.ended ─────────────────────────────────────────────────
        if (eventType === 'call.gather.ended') {
            const session = inboundCollectionSessions[callControlId];
            if (!session) return;

            const transcript = payload?.speech_result?.[0]?.transcript || '';
            const status = payload?.status || '';
            console.log(`  🎤 [Collection] Gather ended: "${transcript}" (status: ${status})`);

            saveAnswer(session, transcript);

            if (session.questionIndex < session.questions.length) {
                const nextQ = session.questions[session.questionIndex];
                console.log(`  🎤 [Collection] Asking Q${session.questionIndex + 1}: "${nextQ.text}"`);
                telnyxRequest({
                    path: `/calls/${callControlId}/actions/speak`,
                    method: 'POST',
                    data: { payload: nextQ.text, voice: 'female', language: 'en-US' },
                    req,
                }).catch(() => { /* best-effort */ });
                // call.speak.ended will trigger the next gather
            } else {
                // All questions answered
                console.log(`  ✅ [Collection] All questions answered — saving InboundLead`);
                await finishTelnyxCollection(callControlId, req);
            }
            return;
        }

        // ── call.hangup ───────────────────────────────────────────────────────
        if (eventType === 'call.hangup') {
            const hangupCause = payload?.hangup_cause || payload?.cause || 'unknown';
            const hangupSource = payload?.hangup_source || 'unknown';
            const callStatus = payload?.call_state || 'hangup';

            logBox('📴 TELNYX INCOMING CALL — CALL.HANGUP');
            console.log(`  📋 ID:     ${callControlId}`);
            console.log(`  💔 Cause:  ${hangupCause}`);
            console.log(`  👤 Source: ${hangupSource}`);
            console.log(`  🕐 Time:   ${ts}\n`);

            // Clean up all pending state
            delete pendingPhoneSearches[callControlId];
            delete pendingHangups[callControlId];

            // If caller hung up mid-collection — save partial lead
            const collSession = inboundCollectionSessions[callControlId];
            if (collSession) {
                if (collSession.questionIndex > 0) {
                    console.log(`  📝 Saving partial InboundLead (caller hung up after ${collSession.questionIndex} answer(s))`);
                    await persistLead(collSession);
                }
                delete inboundCollectionSessions[callControlId];
                return;
            }

            const instance = inboundCallInstances[callControlId];
            if (instance) {
                const { candidateId, jobId } = instance;
                await handleInboundHangup({
                    candidateId,
                    jobId,
                    callId: callControlId,
                    CallStatus: callStatus,
                    HangupCause: hangupCause,
                    HangupSource: hangupSource,
                });
            } else {
                console.log(`  ⚠️  No inbound instance for callControlId: ${callControlId}`);
            }
            return;
        }

        // ── streaming events (log only) ───────────────────────────────────────
        if (eventType?.startsWith('streaming.')) {
            console.log(`[Telnyx][Inbound][${callControlId}] Streaming event: ${eventType}`);
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
//  PLIVO — Answer URL:  POST /api/ai/call/inbound/plivo/
//          Collect URL: POST /api/ai/call/inbound/plivo/collect/
//          Hangup URL:  POST /api/ai/call/inbound/plivo/hangup/
//
//  UNKNOWN CALLER FLOW:
//    Answer URL → start collection session → respond with GetInput XML (Q1)
//    Collect URL → save answer → respond with next GetInput or thanks+hangup
//    At the last answer: save InboundLead
// ─────────────────────────────────────────────────────────────────────────────

/** Build Plivo GetInput XML that asks a question and collects speech. */
const buildPlivoGetInputXML = (questionText, actionUrl) =>
    `<?xml version="1.0" encoding="UTF-8"?><Response><GetInput action="${actionUrl}" method="POST" inputType="speech" speechTimeout="15" speechEndTimeout="2000" redirect="true"><Speak>${questionText}</Speak></GetInput></Response>`;

export async function plivoInboundRoutes(fastify) {

    // ── Answer URL ─────────────────────────────────────────────────────────────
    fastify.post('/', { logLevel: 'info' }, async (req, reply) => {

        // Plivo sometimes POSTs hangup data to the Answer URL — return empty XML
        if ('HangupCause' in req.body) {
            const r = plivoResponse();
            reply.type('text/xml');
            return reply.send(r.toXML());
        }

        const callUUID =
            req.body.CallUUID ||
            req.body.callUUID ||
            req.body.call_uuid ||
            req.body.RequestUUID ||
            req.body.request_uuid ||
            null;

        const from = req.body.From || req.body.from || null;
        const to = req.body.To || req.body.to || null;
        const ts = new Date().toLocaleString();

        logBox('📱 PLIVO INCOMING CALL — ANSWER');
        console.log(`  📞 From:     ${from}`);
        console.log(`  📲 To:       ${to}`);
        console.log(`  📋 UUID:     ${callUUID}`);
        console.log(`  🕐 Time:     ${ts}`);

        try {
            const [result, scriptResult] = await Promise.all([
                initInboundAiSession(req, from),
                findScriptByCalledNumber(to),
            ]);

            const inboundScript = scriptResult?.script || null;

            if (!result.ok) {
                console.log(
                    `  ❌ Session init failed — reason: ${result.reason}` +
                    (result.detail ? ` (${result.detail})` : '')
                );

                // ── UNKNOWN CALLER — start collection if script is configured ──
                if (result.reason === 'not_in_db' && inboundScript && scriptResult?.dbConn) {
                    const session = createCollectionSession(callUUID, from, to, inboundScript, scriptResult.dbConn);
                    const firstQ = session.questions[0];

                    if (firstQ) {
                        console.log(`  🎤 Starting Plivo collection — ${session.questions.length} question(s)`);
                        const baseUrl = process.env.SERVER_URL || `https://${req.headers.host}`;
                        const collectUrl = `${baseUrl}/api/ai/call/inbound/plivo/collect/`;

                        // Prepend "not registered" intro to the first question so caller understands context
                        const introText =
                            'Your number is not registered in our system. ' +
                            'Please contact the recruiter to register your profile. ' +
                            'I will now collect your details so our team can follow up with you. ' +
                            firstQ.text;

                        reply.type('text/xml');
                        return reply.send(buildPlivoGetInputXML(introText, collectUrl));
                    } else {
                        // No questions — save empty lead and hangup
                        await persistLead(session);
                        delete inboundCollectionSessions[callUUID];
                        reply.type('text/xml');
                        return reply.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${THANKS_MSG}</Speak><Hangup/></Response>`);
                    }
                }

                let msg = 'Sorry, we could not process your call at this time. Goodbye.';
                if (result.reason === 'not_in_db')
                    msg = 'Sorry, your number is not registered in our system. Please contact the recruiter directly to register. Goodbye.';
                if (result.reason === 'no_ats')
                    msg = 'Sorry, you have no active job applications on file. Please contact the recruiter. Goodbye.';
                if (result.reason === 'no_recruiter')
                    msg = 'Sorry, we could not find your account details. Please contact the recruiter. Goodbye.';

                // Include <Hangup/> so Plivo ends the call cleanly after speaking
                reply.type('text/xml');
                return reply.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${msg}</Speak><Hangup/></Response>`);
            }

            const { AiService, candidateId, jobId, candidate, supportMode } = result;
            const candidateName = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || 'Unknown';

            console.log(`  👤 Candidate: ${candidateName} (${from})`);
            if (supportMode) {
                console.log(`  🎯 Post-interview support mode — candidateId=${candidateId} jobId=${jobId}`);
            } else {
                console.log(`  🎯 Pending application — candidateId=${candidateId} jobId=${jobId}`);
            }

            AiService.callUUID = callUUID;
            AiService.inboundCalledNumber = to;
            inboundCallInstances[callUUID] = { candidateId, jobId };

            const xml = AiService.answerPlivoCall(callUUID);

            console.log(
                `  🤖 AI ${supportMode ? 'Support' : 'Interview'} started: ${candidateName} | Job: ${jobId}\n`
            );

            reply.type('text/xml');
            return reply.send(xml);

        } catch (err) {
            console.log(`  ❌ Error in Plivo answer handler: ${err?.message || err}`);
            const r = plivoResponse();
            r.addSpeak('Sorry, an error occurred. Please try again later. Goodbye.');
            reply.type('text/xml');
            return reply.send(r.toXML());
        }
    });

    // ── Collect URL — called by Plivo after each speech gather ────────────────
    fastify.post('/collect/', { logLevel: 'info' }, async (req, reply) => {

        const callUUID =
            req.body.CallUUID ||
            req.body.callUUID ||
            req.body.call_uuid ||
            null;

        const speechResult = req.body.SpeechResult || req.body.Speech || '';

        console.log(`[Plivo][Collect] CallUUID=${callUUID} | Speech="${speechResult}"`);

        const session = inboundCollectionSessions[callUUID];
        if (!session) {
            // Session expired or unknown
            reply.type('text/xml');
            return reply.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>`);
        }

        saveAnswer(session, speechResult);

        if (session.questionIndex < session.questions.length) {
            const nextQ = session.questions[session.questionIndex];
            const baseUrl = process.env.SERVER_URL || `https://${req.headers.host}`;
            const collectUrl = `${baseUrl}/api/ai/call/inbound/plivo/collect/`;
            console.log(`[Plivo][Collect] Next Q${session.questionIndex + 1}: "${nextQ.text}"`);

            reply.type('text/xml');
            return reply.send(buildPlivoGetInputXML(nextQ.text, collectUrl));
        }

        // All questions answered
        console.log(`[Plivo][Collect] ✅ All questions answered — saving InboundLead`);
        await persistLead(session);
        delete inboundCollectionSessions[callUUID];

        reply.type('text/xml');
        return reply.send(
            `<?xml version="1.0" encoding="UTF-8"?><Response><Speak>${THANKS_MSG}</Speak><Hangup/></Response>`
        );
    });

    // ── Hangup URL ─────────────────────────────────────────────────────────────
    fastify.post('/hangup/', { logLevel: 'info' }, async (req, reply) => {

        reply.code(200).send('');

        const callUUID =
            req.body.CallUUID ||
            req.body.callUUID ||
            req.body.call_uuid ||
            null;

        const CallStatus = req.body.CallStatus || req.body.call_status || 'completed';
        const HangupCause = req.body.HangupCause || req.body.hangup_cause || 'NORMAL_CLEARING';
        const HangupSource = req.body.HangupSource || req.body.hangup_source || 'Unknown';
        const ts = new Date().toLocaleString();

        logBox('📴 PLIVO INCOMING CALL — HANGUP');
        console.log(`  📋 UUID:   ${callUUID}`);
        console.log(`  💔 Cause:  ${HangupCause}`);
        console.log(`  👤 Source: ${HangupSource}`);
        console.log(`  🕐 Time:   ${ts}\n`);

        // If caller hung up mid-collection — save partial lead
        const collSession = inboundCollectionSessions[callUUID];
        if (collSession) {
            if (collSession.questionIndex > 0) {
                console.log(`  📝 Saving partial InboundLead (caller hung up after ${collSession.questionIndex} answer(s))`);
                await persistLead(collSession);
            }
            delete inboundCollectionSessions[callUUID];
            return;
        }

        const instance = inboundCallInstances[callUUID];
        if (instance) {
            const { candidateId, jobId } = instance;
            await handleInboundHangup({
                candidateId,
                jobId,
                callId: callUUID,
                CallStatus,
                HangupCause,
                HangupSource,
            });
        } else {
            console.log(`  ⚠️  No inbound instance found for callUUID: ${callUUID}`);
        }
    });
}
