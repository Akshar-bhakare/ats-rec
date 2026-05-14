// backend\src\services\aiCalling\aiCallOrchestrationMultilingual.js
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client as PlivoClient, Response as plivoResponse } from "plivo";
import { Agent, run as runOpenAIAgent, system, user, assistant } from '@openai/agents';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { isAICallCreditsExausted } from "../../utils/aiCallCredits.js";
import { chatCompletionByOpenAI, loadOpenAIConfigFromDB } from "../../utils/aiChatCompletions.js";
import { loadKeysConfigFromDB } from "../../utils/dbUtils.js";
import { isAllowedCallingHourIST } from "../../utils/timeUtils.js";
import { getCurrentDateAndTime, hangup_call, rescheduleCallAsPerUserAvailablity, rescheduleInterviewReminder } from "./aiCallAgentTools.js";
import { getDownloadURL, uploadBufferToFirebase } from '../../utils/firebaseUtils.js';
import { writeWavHeader } from '../../utils/fileIOUtils.js';
import updateCandidateFromConversation from '../updateCandidateFromConversation.js';
import { tmpMediaDir } from '../../../server.js';
import JobService from '../jobService.js';
import { getClientDbConn } from '../../utils/clientDbUtils.js';
import RelevancyService, { enqueuePairRelevancy } from '../relevancyService.js';
// import universalTextToSpeech from "../../utils/googleTTSAndSTTUtils.js";
import universalTextToSpeech from "../../utils/openaiTTS.js";
dotenv.config();
// const deepgramClient = createClient(process.env.DEEPGRAM_API_KEY);
const jobSVC = new JobService();

export function toSentenceCase(str) {
    if (typeof str !== 'string' || str.length === 0) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export const niceLabel = (role) =>
    role === 'assistant' || role === 'ai'
        ? 'Recruiter'
        : role === 'user' || role === 'candidate'
            ? 'Candidate'
            : toSentenceCase(role);

export const withTime = (msgFn, text) => ({
    ...msgFn(text),
    time: new Date(),
});

// Simple language detection helper using OpenAI chat; returns { code, name } or null.
async function detectLanguage(text, req) {
    if (!text?.trim?.()) return null;
    try {
        const prompt = [
            {
                role: "system",
                content: "Detect the language of the user text. Reply ONLY with strict JSON: {\"code\":\"<bcp47>\",\"name\":\"<English name>\"}. Use lowercase BCP‑47 like en, es, fr, hi, zh, ar. If unsure, set code to \"unknown\"."
            },
            { role: "user", content: text.slice(0, 400) },
        ];
        const res = await chatCompletionByOpenAI(prompt, req);
        const raw = res?.choices?.[0]?.message?.content || "";
        const parsed = JSON.parse(raw);
        if (parsed?.code) return { code: parsed.code.toLowerCase(), name: parsed.name || parsed.code };
    } catch (err) {
        console.log("[detectLanguage] fallback, err:", err?.message || err);
    }
    return null;
}

const languageNameToCode = {
    english: "en",
    hindi: "hi",
    marathi: "mr",
    tamil: "ta",
    telugu: "te",
    kannada: "kn",
    malayalam: "ml",
    punjabi: "pa",
    bengali: "bn",
    gujarati: "gu",
    urdu: "ur",
    spanish: "es",
    french: "fr",
    german: "de",
    italian: "it",
    portuguese: "pt",
    russian: "ru",
    japanese: "ja",
    korean: "ko",
    turkish: "tr",
    vietnamese: "vi",
    indonesian: "id",
    thai: "th",
    arabic: "ar",
};

function extractRequestedLanguage(text = "") {
    const lowered = text.toLowerCase();
    const directMatch = lowered.match(/\b(?:speak|talk|respond|reply|answer|continue|switch)\s+(?:in|using|with|to)?\s*([a-z]+)\b/);
    if (directMatch && languageNameToCode[directMatch[1]]) {
        return { code: languageNameToCode[directMatch[1]], name: directMatch[1] };
    }
    const inLangMatch = lowered.match(/\bin\s+([a-z]+)\b/);
    if (inLangMatch && languageNameToCode[inLangMatch[1]]) {
        return { code: languageNameToCode[inLangMatch[1]], name: inLangMatch[1] };
    }
    return null;
}
export const saveWavRecording = (buffers, callUUID, sampleRate = 8000) => {
    const outputFile = path.join(tmpMediaDir, `${callUUID}.wav`);
    const pcmLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const wavHeader = writeWavHeader(pcmLength, sampleRate);
    const finalBuffer = Buffer.concat([wavHeader, ...buffers]);
    fs.writeFileSync(outputFile, finalBuffer);
    return outputFile;
};

const MULAW_SILENCE = 0xFF;
const MULAW_BIAS = 0x84;

const writeMulawWavHeader = (bufferLength, sampleRate = 8000, channels = 1) => {
    const bitDepth = 8;
    const audioFormat = 7; // μ-law
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const dataSize = bufferLength;
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(audioFormat, 20);
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    return buffer;
};

const mulawToPcm16Sample = (uVal) => {
    const mu = (~uVal) & 0xff;
    const sign = mu & 0x80;
    const exponent = (mu >> 4) & 0x07;
    const mantissa = mu & 0x0f;
    let sample = ((mantissa << 3) + MULAW_BIAS) << exponent;
    sample -= MULAW_BIAS;
    return sign ? -sample : sample;
};

const writePcmWavHeader = (dataBytes, sampleRate = 8000, channels = 1, bitDepth = 16) => {
    const byteRate = sampleRate * channels * (bitDepth / 8);
    const blockAlign = channels * (bitDepth / 8);
    const dataSize = dataBytes;
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(channels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitDepth, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);
    return buffer;
};

const getMaxSampleEnd = (segments = []) => {
    let maxEnd = 0;
    for (const seg of segments || []) {
        const start = Math.max(0, seg?.sampleIndex || 0);
        const len = seg?.buf?.length || 0;
        if (!len) continue;
        const end = start + len;
        if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
};

const renderTrackFromSegments = (segments = [], totalSamples = 0) => {
    const track = new Int16Array(totalSamples);
    for (const seg of segments || []) {
        const buf = seg?.buf;
        if (!buf?.length) continue;
        const offset = Math.max(0, seg.sampleIndex || 0);
        for (let i = 0; i < buf.length && (offset + i) < totalSamples; i++) {
            track[offset + i] = mulawToPcm16Sample(buf[i]);
        }
    }
    return track;
};

const buildStereoPcmTracks = (inboundSegments = [], outboundSegments = [], sampleRate = 8000) => {
    const inboundEnd = getMaxSampleEnd(inboundSegments);
    const outboundEnd = getMaxSampleEnd(outboundSegments);
    const totalSamples = Math.max(1, inboundEnd, outboundEnd);
    const inboundTrack = renderTrackFromSegments(inboundSegments, totalSamples);
    const outboundTrack = renderTrackFromSegments(outboundSegments, totalSamples);
    return { inboundTrack, outboundTrack, totalSamples };
};

const mixToMonoTrack = (inboundTrack, outboundTrack, totalSamples) => {
    const mono = new Int16Array(totalSamples);
    const GAIN_IN_BASE = 1.25;
    const GAIN_OUT = 0.9;
    for (let i = 0; i < totalSamples; i++) {
        const outVal = outboundTrack[i];
        const inboundGain = Math.abs(outVal) > 6000 ? 0.85 : GAIN_IN_BASE;
        const mixed = (inboundTrack[i] * inboundGain) + (outVal * GAIN_OUT);
        mono[i] = Math.max(-32768, Math.min(32767, Math.round(mixed)));
    }
    return mono;
};

const encodePcmWav = (pcmTrack, sampleRate = 8000, channels = 1) => {
    const pcmBuffer = Buffer.from(pcmTrack.buffer);
    const header = writePcmWavHeader(pcmBuffer.length, sampleRate, channels, 16);
    return Buffer.concat([header, pcmBuffer]);
};

function waitForPrevResponseEnds(ms, clsObj, resKey) {
    let msExecuted = 0;

    return new Promise(resolve => {
        const interval = setInterval(() => {
            const callResState = clsObj?.callResState || {};
            if (!(resKey in callResState) || msExecuted >= ms) {
                clearInterval(interval);
                resolve();
            }
            msExecuted += 50;
        }, 50);
    });
};



export class AiCallManager {
    static allInstances = {
        // 'candidateId, jobId': classObject
    };
    static roundRobinLastIndex = 0;
    // static audioEncoding = "LINEAR16";
    // static audioContentType = "audio/x-l16";
    static audioEncoding = "MULAW";
    static audioContentType = "audio/x-mulaw";
    static audioSampleHtz = 8000;
    static speakingRate = Number.isFinite(Number(process.env?.AI_CALL_SPEAKING_RATE))
        ? Number(process.env.AI_CALL_SPEAKING_RATE)
        : 1.0;
    static modelName = process.env?.OPENAI_MODEL || "gpt-5-nano";
    static realtimeModelName = process.env?.OPENAI_REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
    static realtimeVoice = process.env?.OPENAI_REALTIME_VOICE || "shimmer";
    static realtimeTranscribeModel = process.env?.OPENAI_REALTIME_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe";
    static realtimeAudioFormat = process.env?.OPENAI_REALTIME_AUDIO_FORMAT || "g711_ulaw";
    static realtimeChunkMs = parseInt(process.env?.OPENAI_REALTIME_CHUNK_MS || "240");
    static realtimeFlushMs = parseInt(process.env?.OPENAI_REALTIME_FLUSH_MS || "120");
    static realtimeInitialBufferMs = parseInt(process.env?.OPENAI_REALTIME_INITIAL_BUFFER_MS || "480");
    static realtimeRebufferMs = parseInt(process.env?.OPENAI_REALTIME_REBUFFER_MS || "720");
    static bargeInMinMs = parseInt(process.env?.AI_CALL_BARGE_IN_MIN_MS || "900");
    static bargeInMinWords = parseInt(process.env?.AI_CALL_BARGE_IN_MIN_WORDS || "3");
    static echoMinChars = parseInt(process.env?.AI_CALL_ECHO_MIN_CHARS || "12");
    static audioGlitchLogMinMs = parseInt(process.env?.AI_CALL_AUDIO_GLITCH_LOG_MIN_MS || "2000");
    static audioPipeline = (process.env?.AI_CALL_AUDIO_PIPELINE || "realtime").toLowerCase();
    static plivoClient;
    static sntnsSepRegExWithPauses = /(?<=[.,!?:;"')\]]+\s+)/g; // for dashes include => \s*[--—]\s*
    static userOnCallCheckTimeMs = 20_000;

    /* ---------------------- deploy-safe graceful shutdown ---------------------- */
    static isDraining = false;
    static activeCallUUIDs = new Set();
    static _hooksInstalled = false;
    static _exitScheduled = false;
    static gracefulShutdownTimeoutMs = parseInt(process?.env?.AI_CALL_GRACEFUL_SHUTDOWN_TIMEOUT_MS || "240000"); // default: 4 minutes

    static markCallActive(callUUID) {
        if (!callUUID) return;
        try { AiCallManager.activeCallUUIDs.add(callUUID); } catch (e) { }
    }

    static markCallInactive(callUUID) {
        if (!callUUID) return;
        try { AiCallManager.activeCallUUIDs.delete(callUUID); } catch (e) { }
        if (AiCallManager.isDraining && AiCallManager.activeCallUUIDs.size === 0) {
            AiCallManager._attemptProcessExit?.();
        }
    }

    static _attemptProcessExit() {
        if (AiCallManager._exitScheduled) return;
        AiCallManager._exitScheduled = true;
        setTimeout(() => {
            try { process.exit(0); } catch (e) { }
        }, 250);
    }

    static installGracefulShutdownHandlers() {
        if (AiCallManager._hooksInstalled) return;
        AiCallManager._hooksInstalled = true;

        const beginDrain = (signalOrReason = "SIGTERM", err = null) => {
            if (AiCallManager.isDraining) return;
            AiCallManager.isDraining = true;

            try {
                console.log(
                    `[${AiCallManager.name}] Drain mode enabled due to: ${signalOrReason}. Active calls: ${AiCallManager.activeCallUUIDs.size}`
                );
                if (err) console.log(`[${AiCallManager.name}] Drain trigger error:`, err?.message || err);
            } catch (e) { }

            const checkInterval = setInterval(() => {
                try {
                    if (AiCallManager.activeCallUUIDs.size === 0) {
                        clearInterval(checkInterval);
                        AiCallManager._attemptProcessExit();
                    }
                } catch (e) { }
            }, 1000);
            try { checkInterval.unref?.(); } catch (e) { }

            // Hard stop safety: after timeout, force end remaining production calls so deployment can complete.
            // ✅ CHANGE: If ONLY demo/web calls (call_simulation) are active, do NOT force-exit.
            const hardStop = setTimeout(async () => {
                let hasDemoCall = false;
                try {
                    for (const id of (AiCallManager.activeCallUUIDs || [])) {
                        if ((id || "").includes("call_simulation")) {
                            hasDemoCall = true;
                            break;
                        }
                    }
                } catch (e) { }

                try {
                    console.log(
                        `[${AiCallManager.name}] Drain timeout reached. Active calls: ${AiCallManager.activeCallUUIDs.size}. DemoActive=${hasDemoCall}`
                    );
                } catch (e) { }

                // ✅ If demo call is active, keep the process alive (so the web call doesn't hang up mid-demo).
                if (hasDemoCall) {
                    try {
                        console.log(
                            `[${AiCallManager.name}] Skipping forced shutdown because a demo (call_simulation) call is active.`
                        );
                    } catch (e) { }
                    return;
                }

                try {
                    const instances = Object.values(AiCallManager.allInstances || {});
                    for (const inst of instances) {
                        try {
                            inst.closingWs = true;
                            inst.callListenerTimeOut && clearTimeout(inst.callListenerTimeOut);
                            inst.pendingHangupTimeout && clearTimeout(inst.pendingHangupTimeout);
                            inst.recognizeStream?.destroy?.();

                            if (inst.callUUID && !inst.callUUID?.includes?.('call_simulation')) {
                                await AiCallManager.plivoClient?.calls?.hangup?.(inst.callUUID);
                            }
                        } catch (e) { }

                        try { inst.ws?.close?.(); } catch (e) { }
                    }
                } catch (e) { }

                AiCallManager._attemptProcessExit();
            }, AiCallManager.gracefulShutdownTimeoutMs);

            try { hardStop.unref?.(); } catch (e) { }
        };

        process.once("SIGTERM", () => beginDrain("SIGTERM"));
        process.once("SIGINT", () => beginDrain("SIGINT"));

        process.once("uncaughtException", (err) => beginDrain("uncaughtException", err));
        process.once("unhandledRejection", (err) => beginDrain("unhandledRejection", err));
    }

    accessValidators = { isArchived: false };
    callGlobalState = "listening"; // listening | speaking | interrupted | processing | Closed
    callResState = {};
    useRealtimeAudio = AiCallManager.audioPipeline === "realtime";
    realtimeSession = null;
    realtimeAgent = null;
    realtimeStartTriggered = false;
    realtimeUserItemIds = new Set();
    realtimeAssistantItemIds = new Set();
    realtimePendingHangup = false;
    realtimeLastAssistantText = "";
    realtimeAudioQueue = [];
    realtimeAudioPlaying = false;
    realtimeAudioDone = false;
    realtimeAudioTimer = null;
    realtimePendingChunks = [];
    realtimePendingBytes = 0;
    realtimeQueueBytes = 0;
    realtimePendingFlushTimer = null;
    realtimePlaybackStarted = false;
    realtimeAudioChunksInResponse = 0;
    realtimeAudioBytesInResponse = 0;
    realtimeLastAudioLogAt = 0;
    realtimeSkipPresenceCheck = false;
    realtimeNeedRebuffer = false;
    realtimeUnderflowCount = 0;
    realtimeLastChunkSentAt = 0;
    realtimeLastChunkDurationMs = 0;
    audioGlitchLogAt = 0;
    lastAssistantAudioStartAt = 0;
    lastAssistantAudioText = "";
    lastUserTranscriptAt = 0;
    callStartAtMs = null;
    detectedLanguageCode = null;
    detectedLanguageName = null;
    detectedLanguageAt = 0;
    languageHintCode = null;
    languageHintRealtimeCode = null;
    inboundSampleCursor = 0;
    outboundSampleCursor = 0;
    inboundSegments = [];
    outboundSegments = [];
    inboundLogLastAt = 0;
    outboundLogLastAt = 0;
    inboundBytesTotal = 0;
    outboundBytesTotal = 0;
    callRecordingStreamBuffers = [];
    userStreamBuffers = [];
    streamTimeoutMs = 5000;
    transcriptRec = {};
    respondSequentiallyRunning = false;
    // responseMeta = {}; // timing metadata per responseKey
    isFinalSWaitTimeout = 500;

    // Utility methods for class

    // For later use...
    setFallbackToWhatsApp(final = false) {
        this.wsOnClose();
        this.fallbackToWhatsApp = final;
    }

    async loadPlivoAPIKeys(req) {
        let cfg = await loadKeysConfigFromDB('Telephony', 'Plivo', req);

        if (cfg?.configurationDetails?.authId && cfg.configurationDetails?.authToken) {
            const { authId, authToken } = cfg.configurationDetails;
            return { authId, authToken };
        }

        if (process.env.PLIVO_AUTH_ID && process.env.PLIVO_AUTH_TOKEN) {
            return {
                authId: process.env.PLIVO_AUTH_ID,
                authToken: process.env.PLIVO_AUTH_TOKEN
            };
        }

        throw new Error(
            "No Plivo keys found in database or environment variables"
        );
    }


    getOrCreateAiAgent() {
        const voiceInstructions = `
Voice: Clear, authoritative, and composed, projecting confidence and professionalism.
Tone: Neutral and informative, maintaining a balance between formality and approachability.
Punctuation: Structured with commas and pauses for clarity, ensuring information is digestible and well-paced.
Delivery: Steady and measured, with slight emphasis on key figures and deadlines to highlight critical points.
`;

        if (!this.callAIAgent) {
            if (this.req?.callPurpose === 'interview_reminder') {
                const rCtx = this.req?.reminderCallContext || {};
                const candidateName = rCtx.candidateName || 'there';
                const jobTitle = rCtx.jobTitle || 'the position';
                const ISTOptions = { timeZone: 'Asia/Kolkata' };
                const interviewTime = rCtx.scheduleStartAt
                    ? new Date(rCtx.scheduleStartAt).toLocaleTimeString('en-IN', { ...ISTOptions, hour: '2-digit', minute: '2-digit', hour12: true })
                    : 'shortly';
                const interviewDate = rCtx.scheduleStartAt
                    ? new Date(rCtx.scheduleStartAt).toLocaleDateString('en-IN', { ...ISTOptions, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
                    : 'today';
                const interviewerType = rCtx.interviewerType || 'AI';
                const isAIInterview = interviewerType === 'AI';
                const canAutoReschedule = isAIInterview && rCtx.autoRescheduleEnabled === true;
                const maxRescheduleDays = rCtx.maxRescheduleDays || 15;
                const maxAllowedDateIST = rCtx.maxAllowedDateIST || `within ${maxRescheduleDays} days`;
                const originalDateIST = rCtx.originalDateIST || 'the original interview date';

                const rescheduleInstructions = canAutoReschedule
                    ? `RESCHEDULE FLOW (only enter this if the candidate asks to reschedule or says they cannot attend):
    WINDOW RULE (STRICT):
    - Can ONLY reschedule within ${maxRescheduleDays} days of the original interview date (${originalDateIST}).
    - Latest allowed date: ${maxAllowedDateIST} (IST).
    - If they ask for a date beyond this window, explain the limit and ask for a valid date within the window.

    STEPS once a valid date and time are confirmed:
    1. Confirm the requested IST date and time once.
    2. Call get_current_date_and_time to get current UTC and IST.
    3. Convert the candidate's IST time to UTC by subtracting 5 hours 30 minutes.
    4. Call reschedule_interview_reminder with the UTC ISO string.
    5. If ok=true, confirm the new IST date and time, mention the updated link, say goodbye, then use hangup_call.
    6. If the date is outside the allowed window, relay the exact reason and ask for another valid date.
    7. If any other error happens, say the team will follow up, say goodbye, then use hangup_call.`
                    : `RESCHEDULE FLOW (only enter this if the candidate asks to reschedule or says they cannot attend):
    - Do NOT ask for a preferred date or time.
    - Do NOT collect availability.
    - Do NOT promise an automatic reschedule.
    - Say exactly once: "I understand. Auto-rescheduling is not available for this interview. If you have any query, please contact the recruiter by call or email. Goodbye."
    - Then use hangup_call immediately.`;

                const reminderInstructions = `You are ${this.script?.gender?.toLowerCase() === 'male' ? '"John", a male' : '"Layla", a female'} AI Recruiter assistant making a pre-interview reminder call.

YOUR GOAL:
Deliver a short reminder that the candidate has an interview in 30 minutes and they should be ready.
This is NOT a screening call. Do NOT ask any interview or screening questions.

LANGUAGE RULES:
- Reply in the same language the candidate uses.
- If the candidate speaks English, use English.
- Keep every response short and suitable for a live phone call.

CALL FLOW:
Step 1 — Opening (say this exactly, in the candidate's language if they are already speaking another language):
"Hi, is this ${candidateName}? This is a reminder call — your interview for ${jobTitle} is scheduled on ${interviewDate} at ${interviewTime}, which is in about 30 minutes. Please be ready."

Step 2 — Listen to response:
- If they confirm or say they will attend:
  Say: "Great! Best of luck with your interview. Goodbye." → use hangup_call.

- If they say they cannot attend or ask to reschedule:
  Enter the RESCHEDULE FLOW below.

- If they ask about the interview link or joining details:
  Say: "You should have received the link already. If not, our team will send it shortly. Best of luck! Goodbye." → use hangup_call.

- If the response is unclear:
  Say once: "Just calling to remind you about your interview in 30 minutes. Please be ready. Goodbye." → use hangup_call.

${rescheduleInstructions}

HARD RULES:
- Do NOT ask screening questions, salary, experience, or anything interview-related.
- Do NOT ask "will you be able to join?" proactively.
- Do NOT mention, suggest, or offer rescheduling on your own.
- If the candidate says nothing clear, only repeat the reminder and end the call. Do NOT bring up rescheduling.
- Keep every response to 1–2 sentences.
- Always end the call with "goodbye" and use hangup_call.`;

                const reminderTools = canAutoReschedule
                    ? [getCurrentDateAndTime, rescheduleInterviewReminder, hangup_call]
                    : [hangup_call];

                this.agentInstructions = reminderInstructions;
                this.callAIAgent = new Agent({
                    name: "Interview Reminder Call AI Agent",
                    instructions: reminderInstructions,
                    model: AiCallManager.modelName,
                    tools: reminderTools,
                });
                return this.callAIAgent;
            }

            const instructions = `You are an AI Recruiter (${this.script?.gender?.toLowerCase() === "male" ? 'Named "John", a male' : 'Named "Layla", a female'}) conducting a real-time phone call with an Indian candidate about a job opening described in the provided screening script.

IMPORTANT: Speak like a real recruiter on a phone call—warm, natural, and professional. Keep it short and screening-focused.

------------------------------------------------------------
1) STRICT IDENTITY + DISCLOSURE RULES (NON-NEGOTIABLE)
------------------------------------------------------------
- Stay strictly in recruiter role. Never respond as the candidate.
- If the candidate asks for the "company name" or "organization name", respond ONLY with the job's company name from Company overview / Company Name.
- Never reveal or mention any client name, vendor name, platform name, or your own product/company name.

INTERNAL CALL STATE (DO NOT SPEAK THIS OUT LOUD):
- Maintain and update a compact state object in your head:
- current_script_question_index (integer)
- current_question_text (string)
- awaiting_answer (true/false)
- collected_fields (only what the script asks)
- last_user_answer_raw (string)

Never advance index unless the current question has a valid answer per the Number Capture Rules.
Address / location rules:
- By default, mention location in SHORT format only:
  "<Company Name>, <Area/Locality>, <State>"
- Only provide FULL address (street/building/landmark/pincode, etc.) if the candidate explicitly asks for it using phrases like:
  "full address", "exact address", "complete address", "share address details", "landmark", "pincode", "pin code", "map location".
- Never use the word "client" in any form (including "client name").
- If asked for company/organization name, respond with ONLY: ${this.company?.name || "(Company Name not available)"}.
- Do not mention any other names (vendor/platform/partner/internal product names).

Language mirroring (mandatory):
- Detect the candidate's language from their most recent speech/text and respond in the same language.
- Do not switch languages unless the candidate switches first.
- This applies even in real-time audio (OpenAI STT) mode.

Call-end detection:
- Regardless of language, your final closing line MUST include the word "goodbye".
- When the call should end, use the hangup_call tool.

------------------------------------------------------------
2) HUMAN PHONE-CALL STYLE (SOUND REAL)
------------------------------------------------------------
- Use small natural acknowledgments: “Okay”, “Sure”, “Got it”, “Understood”, “Right”, “Makes sense”, “Thanks for sharing”.
- Use light fillers sparingly: “Hmm”, “Alright”, “Let me quickly check”.
- Be polite and non-judgmental, especially for salary/notice period.
- Don't overuse the candidate's name—use it mainly at greeting + 1 to 2 key moments.
- CRITICAL: Respond ONLY in plain spoken text. NEVER use markdown or formatting symbols (asterisks, underscores, backticks, hashes, bullets, numbered lists). Speak naturally as if on a phone call - use only plain conversational language with no written formatting whatsoever.


------------------------------------------------------------
3) CALL OPENING (DO THIS ONCE)
------------------------------------------------------------
At the start of the call (or after a genuine reconnection), follow this flow:

A) Confirm correct candidate:
- Ask: “Hi, am I speaking with <Candidate Name>?”
- If they confirm: continue.
- If wrong person: apologize once and end the call politely (include "goodbye"), then use hangup_call.

B) Quick permission:
- Ask once: “Is this a good time to talk?”
- If yes: continue and ask candidate to move to a quiet place for better clarity.
- If no / busy: immediately follow the reschedule flow (Section 7).

C) Set context (short):
- Say you're calling about the role mentioned in the script and you'll ask a few quick screening questions.

------------------------------------------------------------
4) QUESTIONS (VERY STRICT SCRIPT-ONLY RULE)
------------------------------------------------------------
- Treat the "Screening script" as the ONLY allowed source of questions.
- Ask questions in the same order as the script topics.
- Ask EXACTLY one question at a time.
- You may shorten/simplify script lines into screening-style questions, but you MUST NOT introduce new topics/data points.
- If you are unsure whether something is in the script, do not ask it.
- Do not mention anything about "screening script" to the candidate.

------------------------------------------------------------
5) ANSWER HANDLING (STREAMING-SAFE, TYPE-AWARE, GUIDED):
------------------------------------------------------------
For every question, silently determine the expected answer type:
- NUMBER
- YES_NO
- TEXT_SHORT
- DATE / ENUM

WAIT-FOR-COMPLETION (MANDATORY):
- Do NOT assume the answer is complete while the candidate is still thinking or speaking.
- Treat the answer as incomplete if you hear fillers or continuations such as:
  “uh”, “umm”, “actually”, “so”, “wait”, “let me think”, “maybe…”
- If incomplete, wait briefly or acknowledge with “Okay” / “Mm-hmm”.
- Do NOT confirm, do NOT apply guidance, and do NOT move on until the thought clearly ends.
- Clear completion signals: finished sentence, explicit confirmation (“that’s it”), or silence after completion.

VALID ANSWER RULES:

1) NUMBER:
- A valid answer MUST contain an explicit number (digits or number words).
- “yes / ok / correct / haan / right” is NOT a number.
- If unclear or missing:
  - Prompt once: “Sorry, could you tell me the number?”
  - If still missing, ask once: “What number should I note?”
- If no number after that:
  - Mark as “unknown” and continue ONLY if the script allows;
  - Otherwise close politely with “goodbye” and use hangup_call.
  
  EXPERIENCE UNIT RULE (MANDATORY):
- For all experience questions (total YOE and skill-specific), always capture and store the value in YEARS.
- If the candidate answers in months/weeks:
  - Convert to years (months/12, weeks/52) and state the converted years.
  - Confirm the converted value once.
- Never ask for "months of experience" unless the script explicitly asks for months.

2) YES_NO:
- Accept clear yes or no (including language equivalents).
- If ambiguous, ask once: “So should I take that as a yes or a no?”

3) TEXT_SHORT (designation, company, location, degree, skills):
- Accept short descriptive phrases.
- Never convert text into numbers.
- If unclear or empty, prompt once: “Could you please repeat that?”
- Do not add follow-up questions beyond the script.

4) DATE / ENUM (final working day, notice status, negotiable, resigned/serving):
- Accept clear dates or category values.
- If ambiguous, ask exactly one clarification.
- If still unclear, mark as “unknown” and proceed only if the script allows.

CONSTITUTION GUIDANCE (RESTRICTED – NUMBER ONLY):
- Used ONLY when the current question expects a NUMBER.
- Guidance must contain an explicit numeric value.
- You MUST restate that exact number aloud before accepting it.
- A generic “yes” only confirms guidance if the number was restated in the same turn.
- If rejected, ask once for the candidate’s number.
- Never invent or infer values.
- Never apply guidance to TEXT, YES_NO, DATE, or ENUM answers.

AFTER A VALID, COMPLETE ANSWER (WITH CORRECTION WINDOW):

- Confirm in one short line by restating what was captured:
  NUMBER → repeat the number and unit
  YES_NO → restate the choice
  TEXT_SHORT → restate the key phrase
  DATE / ENUM → restate the value

- Example:
  “Noted 2 years of Python experience.”

MANDATORY CORRECTION PAUSE:
- After confirming, pause briefly and wait before proceeding.
- Do NOT ask the next question immediately.
- During this pause, listen for corrections such as:
  “No”, “Not that”, “Actually”, “Sorry”, “It’s 3 years”, “I meant…”
- If the candidate corrects the value:
  - Accept the corrected value immediately.
  - Reconfirm once with the corrected value.
  - Do NOT treat the earlier value as valid.
- If there is silence or a simple confirmation after the pause:
  - Treat the confirmed value as final.

- Only after the correction window closes may you proceed to the next scripted question.



Skill gate (strict):
- Do not continue if the candidate has no experience in any required skill.
- At least one required skill must be present to proceed; otherwise end politely with "goodbye" and hang up.

Compensation wording:
- Always refer to salary as "Lakh Per Annum (LPA)".

------------------------------------------------------------
5) EXPERIENCE RANGE + CONDITIONAL FOLLOW-UPS (ONLY IF PRESENT IN SCRIPT)
------------------------------------------------------------
Experience range validation:
- When the candidate shares total experience, compare it to the required range mentioned in the script.
- If they are more than 2 years below OR above the range, inform them and ask if they still want to proceed.

Experience consistency + skill gate (STRICT):
- If total experience is inconsistent with skill-specific experience (e.g., total 3 years, React 5 years), treat it as inconsistent.
- In that case, ask exactly ONE clarification question:
  - “Just to confirm, your total experience is X years, so for React would it be X years or less? What should I note?”
- If they still give an invalid number, end the call politely with "goodbye" and hang up.


No-negative / no-impossible values:
    If the candidate gives negative years, extremely large years (e.g., 40 for a 3 to 6 role), or non-numeric responses, ask once to restate as a number.

Conditional follow-ups:
- Only ask conditional follow-ups if that topic/condition exists in the script.
- Ask only ONE follow-up for each condition:
  - If expected salary increase exceeds 30% of current salary, ask for a brief reason.
  - After notice period:
      - If 30 days or less, ask a brief reason-check (resigned/bench/early release/other).
      - Otherwise ask if negotiable.
  - If serving notice, ask final working day.
  - If they have an active offer, ask offered compensation and company name.

------------------------------------------------------------
6) HANDLING CANDIDATE QUESTIONS (OFF-SCRIPT)
------------------------------------------------------------
- If the candidate asks something outside the script:
  - Answer briefly and helpfully without adding extra probing questions.
  - Then immediately return to the next script question.

Job description:
- If the candidate asks for more details, share the job short description briefly.
- After providing job description, ask for confirmation ONLY if that confirmation step exists in the script.
  (If the script does not include it, do not add it.)

Missing company info:
- If company description/FAQ/policy is not available, do not invent details. Keep it generic: “That information isn’t available with me right now.”

------------------------------------------------------------
7) EXIT INTENT + RESCHEDULING (VERY STRICT)
------------------------------------------------------------
Exit intent detection:
- Treat any clear "end" or "not interested / not available / goodbye" as exit intent.
- When exit intent is detected at any point, STOP the main script immediately.

Single confirmation after exit intent (Reschedule vs Not Interested):
- After detecting exit intent, ask exactly ONE short question:
  “Just to confirm, would you like to reschedule for later, or should I mark you as not interested in this opportunity?”

Then:
A) If NOT INTERESTED:
- Acknowledge briefly, thank them, close with a line containing "goodbye", then use hangup_call.
- Do not ask anything else.

B) If RESCHEDULE:
- Ask once for their preferred date and time.
- Call rescheduleCallAsPerUserAvailablity with that info.
- Confirm the slot in one short sentence.
- Thank them, close with a line containing "goodbye", then use hangup_call.

C) If still vague:
- Treat as not interested, thank them, say "goodbye", then hang up.
- Do not return to the main screening script.

Busy before screening starts:
- If they are busy before meaningful screening starts, ask once for a convenient time, reschedule, confirm, say "goodbye", hang up.

------------------------------------------------------------
8) END OF CALL (NORMAL COMPLETION)
------------------------------------------------------------
If the script is completed and no exit intent happened:
- Give a brief 60 to 100 word summary (experience, key skills, notice period, salary expectation, interest, next steps).
- Close politely with a final line that includes "goodbye".
- Use hangup_call.

------------------------------------------------------------
9) TOOLING
------------------------------------------------------------
- Use rescheduleCallAsPerUserAvailablity only when the candidate agrees to reschedule and provides a preferred time.
- Use hangup_call when the screening is completed, rescheduled, or the candidate is not interested / wants to end.

------------------------------------------------------------
10) VOICE & SPEAKING STYLE (REAL-TIME AUDIO)
------------------------------------------------------------
${voiceInstructions}

------------------------------------------------------------
FOR YOUR REFERENCE (DO NOT READ VERBATIM TO CANDIDATE)
------------------------------------------------------------
Screening script:
\`\`\`
${this.script?.content || "Screening script not available."}
\`\`\`

Job Description (Short):
\`\`\`
${this.job?.shortDescription || "Unavailable at the moment."}
\`\`\`

Company overview (AUTHORITATIVE company name for ALL mentions):
Company Name: ${this.company?.name || "(Company Name not available)"}
Company Description: ${this.company?.description || "Not available at the moment."}

Company's FAQ:
${this.company?.faq || "Not available at the moment."}

Company's Policy:
${this.company?.policy || "Not available at the moment."}
`;

            this.agentInstructions = instructions;

            this.callAIAgent = new Agent({
                name: "Interview Screening Call AI Agent",
                instructions,
                model: AiCallManager.modelName,
                tools: [
                    getCurrentDateAndTime,
                    rescheduleCallAsPerUserAvailablity,
                    hangup_call,
                ],
            });
        }

        return this.callAIAgent;
    }

    getOrCreateRealtimeAgent() {
        if (!this.realtimeAgent) {
            if (!this.agentInstructions) {
                this.getOrCreateAiAgent();
            }
            this.realtimeAgent = new RealtimeAgent({
                name: 'Interview Screening Call AI Agent',
                instructions: this.agentInstructions,
                tools: [
                    getCurrentDateAndTime,
                    rescheduleCallAsPerUserAvailablity,
                    hangup_call,
                ],
                voice: AiCallManager.realtimeVoice,
            });
        }

        return this.realtimeAgent;
    }

    getRealtimeModelName() {
        const cfgModel = (this.openAIConfig?.model || "").toString().toLowerCase();
        if (cfgModel.includes("realtime")) return this.openAIConfig.model;
        return AiCallManager.realtimeModelName;
    }

    getRealtimeSessionConfig() {
        const outputSpeed = Number.isFinite(Number(process.env?.OPENAI_REALTIME_OUTPUT_SPEED))
            ? Number(process.env.OPENAI_REALTIME_OUTPUT_SPEED)
            : 1.0;
        const vadThreshold = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_THRESHOLD))
            ? Number(process.env.AI_CALL_REALTIME_VAD_THRESHOLD)
            : 0.75;
        const vadSilenceMs = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_SILENCE_MS))
            ? Number(process.env.AI_CALL_REALTIME_VAD_SILENCE_MS)
            : 800;
        const vadPrefixMs = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_PREFIX_MS))
            ? Number(process.env.AI_CALL_REALTIME_VAD_PREFIX_MS)
            : 250;

        return {
            outputModalities: ['audio'],
            audio: {
                input: {
                    format: AiCallManager.realtimeAudioFormat,
                    transcription: { model: AiCallManager.realtimeTranscribeModel },
                    turnDetection: {
                        type: 'server_vad',
                        interruptResponse: true,
                        silenceDurationMs: vadSilenceMs,
                        prefixPaddingMs: vadPrefixMs,
                        threshold: vadThreshold,
                        createResponse: true,
                    },
                    noiseReduction: { type: 'near_field' },
                },
                output: {
                    format: AiCallManager.realtimeAudioFormat,
                    voice: AiCallManager.realtimeVoice,
                    speed: outputSpeed,
                },
            },
        };
    }

    async ensureRealtimeSession() {
        if (!this.useRealtimeAudio) return null;
        if (this.realtimeSession) return this.realtimeSession;

        const apiKey = this.openAIConfig?.apiKey || process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("No OpenAI API key found for Realtime session.");

        const realtimeAgent = this.getOrCreateRealtimeAgent();
        const realtimeModel = this.getRealtimeModelName();

        const session = new RealtimeSession(realtimeAgent, {
            apiKey,
            transport: 'websocket',
            model: realtimeModel,
            context: { req: this.req, ws: this.ws, clsObj: this },
            config: this.getRealtimeSessionConfig(),
        });

        this.realtimeSession = session;

        session.on('audio', this.handleRealtimeAudio.bind(this));
        session.on('audio_interrupted', () => {
            const recentUserSpeech = (Date.now() - (this.lastUserTranscriptAt || 0)) < 1200;
            if (recentUserSpeech) {
                this.logAudioGlitch("audio_interrupted", {
                    recent_ms: Date.now() - (this.lastUserTranscriptAt || 0),
                });
                this.clearRealtimePlayback("audio_interrupted", true);
                this.callGlobalState = 'interrupted';
                this.realtimeAudioDone = true;
                this.realtimeSkipPresenceCheck = true;
                if (this.realtimePendingHangup) {
                    this.realtimePendingHangup = false;
                    this.scheduleRealtimeHangup();
                }
            } else {
                console.log(`[${this.callUUID}] Realtime audio_interrupted ignored (no recent user speech).`);
            }
        });
        session.on('audio_start', () => {
            this.clearRealtimePlayback("audio_start", true); // ✅ STOP Plivo audio immediately
            this.realtimeAudioDone = false;
            this.resetRealtimeAudioCounters();
            this.realtimePlaybackStarted = false;
            this.callGlobalState = 'speaking';
            this.lastAssistantAudioStartAt = Date.now();
            this.lastAssistantAudioText = this.realtimeLastAssistantText || this.lastAssistantAudioText;
            if (this.outboundSampleCursor < this.inboundSampleCursor) {
                this.outboundSampleCursor = this.inboundSampleCursor;
            }
            console.log(
                `[${this.callUUID}] Outbound align on audio_start: inboundCursor=${this.inboundSampleCursor}, outboundCursor=${this.outboundSampleCursor}`
            );
            if (this.callListenerTimeOut) {
                clearTimeout(this.callListenerTimeOut);
                delete this.callListenerTimeOut;
            }
            if (this.pendingHangupTimeout) {
                clearTimeout(this.pendingHangupTimeout);
                delete this.pendingHangupTimeout;
            }
        });
        session.on('audio_stopped', () => {
            this.realtimeAudioDone = true;
            const approxMs = this.estimateAudioMsFromBytes(this.realtimeAudioBytesInResponse);
            console.log(
                `[${this.callUUID}] Realtime TTS done: chunks=${this.realtimeAudioChunksInResponse}, bytes=${this.realtimeAudioBytesInResponse}, approx_ms=${approxMs}`
            );
            this.flushRealtimePendingBuffer();
            this.processRealtimeAudioQueue();
        });
        session.on('transport_event', this.handleRealtimeTransportEvent.bind(this));
        session.on('error', (err) => {
            console.log(`[${this.callUUID}] Realtime session error:`, err?.error || err);
        });
        await session.connect({ apiKey, model: realtimeModel });
        if (this.detectedLanguageCode) {
            this.sendRealtimeLanguageHint(this.detectedLanguageCode, this.detectedLanguageName, `User language detected as ${this.detectedLanguageName || this.detectedLanguageCode}. Respond only in ${this.detectedLanguageCode}.`);
        }
        this.triggerRealtimeGreeting();

        return session;
    }

    triggerRealtimeGreeting() {
        if (!this.realtimeSession || this.realtimeStartTriggered) return;

        const msgs = this.classLevelConv?.messages || [];
        const hasAssistant = msgs.some(m => m?.role === "assistant" && Boolean(
            (Array.isArray(m?.content) ? m?.content?.[0]?.text : m?.content)?.trim?.()
        ));

        if (hasAssistant) return;
        this.realtimeStartTriggered = true;

        try {
            this.realtimeSession?.transport?.sendEvent?.({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'system',
                    content: [{ type: 'input_text', text: 'Call connected. Begin the conversation now.' }],
                },
            });
            this.realtimeSession?.transport?.sendEvent?.({ type: 'response.create' });
        } catch (err) {
            console.log(`[${this.callUUID}] Failed to trigger Realtime greeting:`, err?.message || err);
        }
    }

    handleRealtimeAudio(event) {
        if (this.closingWs || !event?.data) return;

        const audioBuffer = Buffer.from(event.data);
        if (!audioBuffer?.length) return;

        this.realtimeAudioChunksInResponse += 1;
        this.realtimeAudioBytesInResponse += audioBuffer.length;

        const now = Date.now();
        if (this.realtimeAudioChunksInResponse === 1 || (now - this.realtimeLastAudioLogAt) > 1000) {
            const approxMs = this.estimateAudioMsFromBytes(this.realtimeAudioBytesInResponse);
            const bufferedMs = this.estimateAudioMsFromBytes(this.getRealtimeBufferedBytes());
            console.log(
                `[${this.callUUID}] Realtime TTS streaming: chunks=${this.realtimeAudioChunksInResponse}, bytes=${this.realtimeAudioBytesInResponse}, approx_ms=${approxMs}, buffered_ms=${bufferedMs}`
            );
            this.realtimeLastAudioLogAt = now;
        }

        this.bufferRealtimeAudio(audioBuffer);
    }

    handleRealtimeTransportEvent(event) {
        if (!event?.type) return;

        if (event.type === 'conversation.item.input_audio_transcription.completed') {
            const transcript = event.transcript?.trim?.();
            if (transcript) {
                this.handleLanguagePreference(transcript);
                const ignoreMeta = this.getBargeInIgnoreMeta(transcript);
                if (ignoreMeta) {
                    this.logAudioGlitch("stt_ignored", {
                        mode: "realtime",
                        reason: ignoreMeta.reason,
                        words: ignoreMeta.words,
                        since_ms: ignoreMeta.sinceStart,
                    });
                    return;
                }
                console.log(`[${this.callUUID}] Realtime STT: "${transcript}"`);
                this.lastUserTranscriptAt = Date.now();
                void this.updateDetectedLanguage(transcript);
                if (event.item_id && this.realtimeUserItemIds.has(event.item_id)) return;
                if (event.item_id) this.realtimeUserItemIds.add(event.item_id);
                if (this.callListenerTimeOut) {
                    clearTimeout(this.callListenerTimeOut);
                    delete this.callListenerTimeOut;
                }
                if (this.pendingHangupTimeout) {
                    clearTimeout(this.pendingHangupTimeout);
                    delete this.pendingHangupTimeout;
                }
                void this.appendRealtimeMessage('user', transcript);
            }
            return;
        }

        if (event.type === 'response.output_audio_transcript.done' || event.type === 'response.output_text.done') {
            const transcript = event.transcript?.trim?.() || event.text?.trim?.();
            if (transcript) {
                console.log(`[${this.callUUID}] Realtime TTS text: "${transcript}"`);
                if (event.item_id && this.realtimeAssistantItemIds.has(event.item_id)) return;
                if (event.item_id) this.realtimeAssistantItemIds.add(event.item_id);
                this.realtimeLastAssistantText = transcript;
                this.lastAssistantAudioText = transcript;
                if (transcript.toLowerCase().includes("goodbye")) {
                    this.realtimePendingHangup = true;
                }
                void this.appendRealtimeMessage('assistant', transcript);
            }
        }
    }

    resetRealtimeAudioCounters() {
        this.realtimeAudioChunksInResponse = 0;
        this.realtimeAudioBytesInResponse = 0;
        this.realtimeLastAudioLogAt = 0;
        this.realtimeUnderflowCount = 0;
        this.realtimeNeedRebuffer = false;
        this.realtimeLastChunkSentAt = 0;
        this.realtimeLastChunkDurationMs = 0;
    }

    getAudioBytesPerSecond() {
        const sampleRate = AiCallManager.audioSampleHtz || 8000;
        const enc = (AiCallManager.audioEncoding || "MULAW").toString().toUpperCase();
        const bytesPerSample = enc === "LINEAR16" ? 2 : 1;
        return Math.max(1, sampleRate * bytesPerSample);
    }

    getRealtimeMinBufferMs() {
        const initial = Number.isFinite(AiCallManager.realtimeInitialBufferMs)
            ? AiCallManager.realtimeInitialBufferMs
            : 700;
        const rebuffer = Number.isFinite(AiCallManager.realtimeRebufferMs)
            ? AiCallManager.realtimeRebufferMs
            : initial;
        return this.realtimeNeedRebuffer ? Math.max(initial, rebuffer) : initial;
    }

    getRealtimeChunkTargetBytes() {
        const ms = Number.isFinite(AiCallManager.realtimeChunkMs) ? AiCallManager.realtimeChunkMs : 240;
        const bytesPerSecond = this.getAudioBytesPerSecond();
        const targetBytes = Math.round((bytesPerSecond * ms) / 1000);
        return Math.max(800, targetBytes);
    }

    getRealtimeBufferedBytes() {
        const queuedBytes = Number.isFinite(this.realtimeQueueBytes)
            ? this.realtimeQueueBytes
            : this.realtimeAudioQueue.reduce((sum, buf) => sum + (buf?.length || 0), 0);
        const pendingBytes = Number.isFinite(this.realtimePendingBytes)
            ? this.realtimePendingBytes
            : 0;
        return queuedBytes + pendingBytes;
    }

    estimateAudioMsFromBytes(byteLength) {
        const bytesPerSecond = this.getAudioBytesPerSecond();
        return Math.max(1, Math.round((byteLength / bytesPerSecond) * 1000));
    }

    countWords(text = "") {
        const trimmed = text.trim();
        if (!trimmed) return 0;
        return trimmed.split(/\s+/).length;
    }

    normalizeForEcho(text = "") {
        const trimmed = text.toLowerCase().trim();
        if (!trimmed) return "";
        return trimmed.replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
    }

    async updateDetectedLanguage(text) {
        const now = Date.now();
        if (!text?.trim?.()) return;
        // Avoid hammering detection on rapid interim transcripts.
        if (now - (this.detectedLanguageAt || 0) < 2000) return;

        try {
            const detected = await detectLanguage(text, this.req);
            if (detected?.code && detected.code !== "unknown") {
                console.log(`[${this.callUUID}] Language detected from text: "${text.substring(0, 50)}..." => ${detected.code} (${detected.name})`);
                this.applyDetectedLanguage(detected.code, detected.name, now);
            } else {
                console.log(`[${this.callUUID}] Language detection inconclusive or unknown`);
            }
        } catch (err) {
            console.error(`[${this.callUUID}] Error during language detection:`, err?.message || err);
        }
    }

    getTtsLanguageCode() {
        // Prefer runtime detection; fall back to script language only if nothing detected yet.
        const code = this.detectedLanguageCode || this.script?.language || process.env?.AI_CALL_FALLBACK_LANG || "en";
        console.log(`[${this.callUUID}] getTtsLanguageCode: detected=${this.detectedLanguageCode}, script=${this.script?.language}, fallback=${process.env?.AI_CALL_FALLBACK_LANG}, final=${code}`);
        return code;
    }

    ensureLanguageHint() {
        const code = this.detectedLanguageCode;
        const name = this.detectedLanguageName;
        if (!code || code === this.languageHintCode) return;

        const hint = `User language detected as ${name || code}. From now on respond ONLY in that language (${code}) and mirror any switch the user makes.`;

        // Inject system message into text convo
        try {
            if (this.classLevelConv?.messages) {
                this.classLevelConv.messages.push(withTime(system, hint));
                this.req?.conn?.models?.Conversation
                    ?.findOneAndUpdate(
                        { ...this.convUniqueFilter, isArchived: false },
                        { messages: this.classLevelConv.messages }
                    )
                    ?.exec();
            }
        } catch (e) {
            console.log(`[${this.callUUID}] Failed to persist language hint message:`, e?.message || e);
        }

        // Send a system item into realtime session so the agent switches language
        this.sendRealtimeLanguageHint(code, name, hint);

        this.languageHintCode = code;
    }

    applyDetectedLanguage(code, name = null, at = Date.now()) {
        if (!code) return;
        const normalized = code.toLowerCase();
        if (this.detectedLanguageCode === normalized) return;
        this.detectedLanguageCode = normalized;
        this.detectedLanguageName = name || normalized;
        this.detectedLanguageAt = at;
        console.log(`[${this.callUUID}] Language detected: ${normalized} (${this.detectedLanguageName})`);
        this.ensureLanguageHint();
    }

    handleLanguagePreference(text) {
        const req = extractRequestedLanguage(text);
        if (req?.code) {
            this.applyDetectedLanguage(req.code, req.name);
        }
    }

    sendRealtimeLanguageHint(code, name, hintText) {
        if (!this.useRealtimeAudio) return;
        if (!this.realtimeSession) return;
        if (this.languageHintRealtimeCode === code) return;

        try {
            this.realtimeSession?.transport?.sendEvent?.({
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'system',
                    content: [{ type: 'input_text', text: hintText || `Switch to ${name || code}.` }],
                },
            });
            this.languageHintRealtimeCode = code;
        } catch (e) {
            console.log(`[${this.callUUID}] Failed to send realtime language hint:`, e?.message || e);
        }
    }

    isLikelyEchoTranscript(transcript = "", assistantText = "") {
        const minChars = Number.isFinite(AiCallManager.echoMinChars)
            ? AiCallManager.echoMinChars
            : 12;
        const a = this.normalizeForEcho(transcript);
        const b = this.normalizeForEcho(assistantText);
        if (a.length < minChars || b.length < minChars) return false;
        return a.includes(b) || b.includes(a);
    }

    getBargeInIgnoreMeta(transcript = "") {
        if (this.callGlobalState !== "speaking") return null;
        const words = this.countWords(transcript);
        const sinceStart = Date.now() - (this.lastAssistantAudioStartAt || 0);
        const assistantText = this.lastAssistantAudioText || this.realtimeLastAssistantText;

        if (assistantText && this.isLikelyEchoTranscript(transcript, assistantText)) {
            return { reason: "echo", words, sinceStart };
        }

        const minMs = Number.isFinite(AiCallManager.bargeInMinMs)
            ? AiCallManager.bargeInMinMs
            : 700;
        const minWords = Number.isFinite(AiCallManager.bargeInMinWords)
            ? AiCallManager.bargeInMinWords
            : 2;

        if (sinceStart < minMs && words < minWords) {
            return { reason: "early_short", words, sinceStart };
        }

        return null;
    }

    logAudioGlitch(type, details = {}) {
        const now = Date.now();
        const minMs = Number.isFinite(AiCallManager.audioGlitchLogMinMs)
            ? AiCallManager.audioGlitchLogMinMs
            : 2000;
        if (now - (this.audioGlitchLogAt || 0) < minMs) return;
        this.audioGlitchLogAt = now;
        const extra = Object.entries(details)
            .map(([key, value]) => `${key}=${value}`)
            .join(" ");
        console.log(
            `[${this.callUUID}] audio_glitch:${type}${extra ? " " + extra : ""}`
        );
    }

    clearRealtimePlayback(reason = "", stopAudio = false) {
        if (this.realtimeAudioTimer) {
            clearTimeout(this.realtimeAudioTimer);
            this.realtimeAudioTimer = null;
        }
        if (this.realtimePendingFlushTimer) {
            clearTimeout(this.realtimePendingFlushTimer);
            this.realtimePendingFlushTimer = null;
        }
        this.realtimePendingChunks = [];
        this.realtimePendingBytes = 0;
        this.realtimeAudioQueue = [];
        this.realtimeQueueBytes = 0;
        this.realtimeAudioPlaying = false;
        this.realtimePlaybackStarted = false;
        if (stopAudio) this.sendPlivoPlayStop(false);
        if (reason) {
            console.log(`[${this.callUUID}] Realtime playback cleared: ${reason}`);
        }
    }

    bufferRealtimeAudio(audioBuffer) {
        if (!audioBuffer?.length) return;
        this.realtimePendingChunks.push(audioBuffer);
        this.realtimePendingBytes += audioBuffer.length;

        const targetBytes = this.getRealtimeChunkTargetBytes();
        if (this.realtimePendingBytes >= targetBytes) {
            this.flushRealtimePendingBuffer();
            return;
        }

        if (!this.realtimePendingFlushTimer) {
            const flushDelayMs = Number.isFinite(AiCallManager.realtimeFlushMs) ? AiCallManager.realtimeFlushMs : 160;
            this.realtimePendingFlushTimer = setTimeout(() => {
                this.realtimePendingFlushTimer = null;
                this.flushRealtimePendingBuffer();
            }, flushDelayMs);
        }
    }

    flushRealtimePendingBuffer() {
        if (!this.realtimePendingChunks.length || !this.realtimePendingBytes) return;
        const buffer = this.realtimePendingChunks.length === 1
            ? this.realtimePendingChunks[0]
            : Buffer.concat(this.realtimePendingChunks, this.realtimePendingBytes);
        this.realtimePendingChunks = [];
        this.realtimePendingBytes = 0;
        if (this.realtimePendingFlushTimer) {
            clearTimeout(this.realtimePendingFlushTimer);
            this.realtimePendingFlushTimer = null;
        }
        this.realtimeAudioQueue.push(buffer);
        this.realtimeQueueBytes += buffer.length;
        this.processRealtimeAudioQueue();
    }

    processRealtimeAudioQueue() {
        if (this.realtimeAudioPlaying) return;

        if (!this.realtimePlaybackStarted) {
            const bufferedBytes = this.getRealtimeBufferedBytes();
            const bufferedMs = this.estimateAudioMsFromBytes(bufferedBytes);
            const minBufferMs = this.getRealtimeMinBufferMs();

            if (!this.realtimeAudioDone && bufferedMs < minBufferMs) {
                if (this.realtimeNeedRebuffer) {
                    this.logAudioGlitch("rebuffer_wait", {
                        buffered_ms: bufferedMs,
                        min_ms: minBufferMs,
                    });
                }
                return;
            }
            this.realtimePlaybackStarted = true;
            this.realtimeNeedRebuffer = false;
        }

        const nextChunk = this.realtimeAudioQueue.shift();
        if (!nextChunk) {
            if (this.realtimeAudioDone) {
                this.onRealtimePlaybackComplete();
            } else {
                const bufferedMs = this.estimateAudioMsFromBytes(this.getRealtimeBufferedBytes());
                this.realtimeUnderflowCount += 1;
                this.realtimeNeedRebuffer = true;
                this.realtimePlaybackStarted = false;
                this.realtimeAudioPlaying = false;
                this.logAudioGlitch("underflow", {
                    buffered_ms: bufferedMs,
                    chunks: this.realtimeAudioQueue.length,
                    count: this.realtimeUnderflowCount,
                });
            }
            return;
        }
        this.realtimeQueueBytes = Math.max(0, (this.realtimeQueueBytes || 0) - nextChunk.length);

        const durationMs = this.estimateAudioMsFromBytes(nextChunk.length);
        const now = Date.now();
        if (this.realtimeLastChunkSentAt && this.realtimeLastChunkDurationMs) {
            const expectedNextAt = this.realtimeLastChunkSentAt + this.realtimeLastChunkDurationMs;
            const lagMs = now - expectedNextAt;
            if (lagMs > 80) {
                this.logAudioGlitch("gap", {
                    lag_ms: lagMs,
                    prev_ms: this.realtimeLastChunkDurationMs,
                });
            }
        }
        this.realtimeLastChunkSentAt = now;
        this.realtimeLastChunkDurationMs = durationMs;

        this.realtimeAudioPlaying = true;

        this.sendRealtimeAudioChunk(nextChunk);

        const MIN_GAP_MS = 5;
        const COMPENSATE_MS = Math.min(20, Math.round(durationMs * 0.08));
        const waitMs = Math.max(MIN_GAP_MS, durationMs - COMPENSATE_MS);

        this.realtimeAudioTimer = setTimeout(() => {
            this.realtimeAudioPlaying = false;
            this.processRealtimeAudioQueue();
        }, waitMs);
    }

    sendRealtimeAudioChunk(audioBuffer) {
        const contMedia = {
            contentType: AiCallManager.audioContentType,
            sampleRate: AiCallManager.audioSampleHtz,
            track: 'outbound',
            payload: audioBuffer.toString('base64'),
        };

        if (this.callUUID?.includes("call_simulation") && this.realtimeLastAssistantText) {
            contMedia["audioText"] = this.realtimeLastAssistantText;
        }

        this.wsSend(
            JSON.stringify({
                event: 'playAudio',
                media: contMedia,
            }),
            err => {
                if (err) {
                    console.log(`[${this.callUUID}] Failed to send Realtime audio:`, err);
                } else {
                    this.recordOutboundAudio(audioBuffer);
                    this.callRecordingStreamBuffers.push(audioBuffer);
                }
            }
        );
    }

    onRealtimePlaybackComplete() {
        if (this.callGlobalState !== 'Closed') {
            this.callGlobalState = 'listening';
        }

        if (this.realtimeSkipPresenceCheck) {
            this.realtimeSkipPresenceCheck = false;
        } else {
            this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
            this.callListenerTimeOut = setTimeout(() => {
                this.checkUserWithUs();
            }, AiCallManager.userOnCallCheckTimeMs);
        }

        if (this.realtimePendingHangup) {
            this.realtimePendingHangup = false;
            this.scheduleRealtimeHangup();
        }
    }

    async appendRealtimeMessage(role, text) {
        if (!text?.trim?.()) return;

        try {
            if (!this.classLevelConv || !this.classLevelConv?.messages) {
                this.classLevelConv = await this.initiateConversation(this.callUUID);
            }

            const msgFn = role === 'assistant' ? assistant : user;
            this.classLevelConv.messages.push(withTime(msgFn, text));

            this.req.conn.models.Conversation
                .findOneAndUpdate(
                    { ...this.convUniqueFilter, isArchived: false },
                    { messages: this.classLevelConv.messages }
                )
                .exec();
        } catch (err) {
            console.log(`[${this.callUUID}] Failed to append ${role} message from Realtime:`, err?.message || err);
        }
    }

    scheduleRealtimeHangup() {
        if (this.pendingHangupTimeout) {
            clearTimeout(this.pendingHangupTimeout);
        }

        this.pendingHangupTimeout = setTimeout(async () => {
            try {
                if (!this.callUUID?.includes?.('call_simulation')) {
                    this.callUUID && await AiCallManager.plivoClient.calls?.hangup(this.callUUID);
                }
            } catch (err) {
                console.log("? Error in call hangup, after end-condition: ", err);
            }
            try { this.ws?.close?.(); } catch (e) { }
        }, 5_000);
    }

    async generateOpenAIResponse(conversation) {
        const lastMsg = conversation.messages[conversation.messages.length - 1] || {};
        if (lastMsg.role !== 'assistant') {
            const start = Date.now();
            const ai = await runOpenAIAgent(this.callAIAgent, conversation.messages, {
                stream: false,
                context: { req: this.req, ws: this.ws, clsObj: this }
            });
            const end = Date.now();
            return ai.finalOutput || '';
        } else {
            let res = lastMsg.content || '';
            return res;
        }
    }

    async *generateOpenAIResponseStream(conversation) {
        const lastMsg = conversation.messages[conversation.messages.length - 1] || {};
        if (lastMsg.role === "assistant") {
            yield lastMsg.content || "";
            return;
        }

        const openAIStart = Date.now();
        const aiResStream = await runOpenAIAgent(this.callAIAgent, conversation.messages, {
            stream: true,
            context: { req: this.req, ws: this.ws, clsObj: this },
        });
        const textStream = aiResStream.toTextStream({ compatibleWithNodeStreams: false });

        const SENTENCE_SEP = AiCallManager.sntnsSepRegExWithPauses;
        let buffer = "";

        for await (const chunk of textStream) {
            const token = chunk || "";
            if (!token?.trim?.()) continue;

            buffer += token + " ";

            const parts = buffer.split(SENTENCE_SEP);

            while (parts.length > 1) {
                const sentence = parts.shift().trim();
                if (sentence) yield sentence;
            }

            // Keep remainder for next tokens
            buffer = parts.join(" ").trim();
        }

        // Flush any leftover partial sentence
        const tail = buffer.trim();
        if (tail) yield tail;
    }

    wsSend(data, onErr = (err) => { console.log("[" + AiCallManager.name + "] ❌ Error in sending message via ws: ", err); }) {
        // readyState 1 === OPEN
        if (this.ws.readyState !== 1) {
            const stateNames = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
            const errMsg = `[wsSend] WebSocket not open (state=${stateNames[this.ws.readyState] || this.ws.readyState}).`;
            console.warn(errMsg);
            onErr?.(errMsg);
            return;
        } else {
            this.ws.send(data, onErr);
        }
    }

    async checkUserWithUs(lastCall = false) {
        if (this.useRealtimeAudio) {
            if (!this.realtimeSession) return;

            const promptText = "Are you still there?";
            try {
                this.realtimeSession?.transport?.sendEvent?.({
                    type: 'conversation.item.create',
                    item: {
                        type: 'message',
                        role: 'system',
                        content: [{ type: 'input_text', text: `Say exactly: "${promptText}"` }],
                    },
                });
                this.realtimeSession?.transport?.sendEvent?.({ type: 'response.create' });
            } catch (err) {
                console.log(`[${this.callUUID}] Failed to send Realtime presence check:`, err?.message || err);
            }

            if (lastCall) {
                this.pendingHangupTimeout && clearTimeout(this.pendingHangupTimeout);
                this.pendingHangupTimeout = setTimeout(async () => {
                    try {
                        if (!this.callUUID?.includes?.('call_simulation')) {
                            this.callUUID && await AiCallManager.plivoClient?.calls?.hangup?.(this.callUUID);
                        }
                    } catch (err) {
                        console.log("? Error in call hangup, after end-condition: ", err);
                    }
                    try { this.ws?.close?.(); } catch (e) { }
                }, AiCallManager.userOnCallCheckTimeMs + 5_000);
            } else {
                this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
                this.callListenerTimeOut = setTimeout(() => {
                    this.checkUserWithUs(true);
                }, AiCallManager.userOnCallCheckTimeMs);
            }
            return;
        }
        if (this.callGlobalState === 'listening' && this.areYouThereAudioBuffer) {
            this.classLevelConv.messages.push(withTime(assistant, "Are you still there?"));
            this.recognizeStream?.destroy?.();

            if (this.outboundSampleCursor < this.inboundSampleCursor) {
                this.outboundSampleCursor = this.inboundSampleCursor;
            }
            console.log(
                `[${this.callUUID}] Outbound align before presence check: inboundCursor=${this.inboundSampleCursor}, outboundCursor=${this.outboundSampleCursor}`
            );

            const contMedia = {
                contentType: AiCallManager.audioContentType,
                sampleRate: AiCallManager.audioSampleHtz,
                track: 'outbound',
                payload: this.areYouThereAudioBuffer.toString('base64'),
            };

            if (this.callUUID?.includes("call_simulation")) {
                contMedia["audioText"] = "Are you still there?";
            }

            this.wsSend(
                JSON.stringify({
                    event: 'playAudio',
                    media: contMedia,
                }),
                err => {
                    if (err) console.log(`[${this.callUUID}] Failed to send TTS audio:`, err);
                    else {
                        this.recordOutboundAudio(this.areYouThereAudioBuffer);
                        this.callRecordingStreamBuffers.push(this.areYouThereAudioBuffer);
                        this.callGlobalState = 'speaking';
                        this.lastAssistantAudioStartAt = Date.now();
                        this.lastAssistantAudioText = "Are you still there?";

                        const durationSeconds = this.areYouThereAudioBuffer.length / this.getAudioBytesPerSecond();
                        const pauseMiliSeconds = (durationSeconds > 3 ? durationSeconds - 1 : durationSeconds) * 1000;
                        this.stateTimeOut && clearTimeout(this.stateTimeOut);
                        this.stateTimeOut = setTimeout(() => {
                            if (this.callGlobalState === 'speaking') this.callGlobalState = 'listening';
                        }, pauseMiliSeconds);

                        if (lastCall) {
                            this.pendingHangupTimeout = setTimeout(async () => {
                                try {
                                    if (!this.callUUID?.includes?.('call_simulation')) {
                                        this.callUUID && await AiCallManager.plivoClient.calls?.hangup(this.callUUID);
                                    }
                                } catch (err) {
                                    console.log(
                                        "❌ Error in call hangup, after end-condition: ", err
                                    );
                                }
                                this.classLevelConv.recording = Buffer.concat(this.callRecordingStreamBuffers).toString('base64');
                                this.ws.close();
                            }, pauseMiliSeconds + AiCallManager.userOnCallCheckTimeMs);

                        } else {
                            this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
                            this.callListenerTimeOut = setTimeout(() => {
                                this.checkUserWithUs(true);
                            }, pauseMiliSeconds + AiCallManager.userOnCallCheckTimeMs);
                        }
                    }
                }
            );
        }
    }

    sendPlivoPlayStop(infoLog = true) {
        const stopMsg = JSON.stringify({
            event: 'clearAudio',
            callId: this.callUUID,
        });

        this.wsSend(
            stopMsg,
            err => {
                if (err) console.log(`[${this.callUUID}] Failed to send play stop signal:`, err);
                else if (infoLog) {
                    console.log(`[${this.callUUID}] play stop signal sent successfully...`);
                }
            }
        );
    }

    async respondSequentially(resKey) {
        this.respondSequentiallyRunning = true;

        const queue = this.callResState?.[resKey];
        if (!Array.isArray(queue) || queue.length === 0) {
            this.callGlobalState = 'listening';
            this.respondSequentiallyRunning = false;
            return;
        }

        const queuedItem = queue.shift();
        if (!queuedItem) {
            this.respondSequentiallyRunning = false;
            return;
        }

        const { assistantText } = queuedItem;
        let audioBuffer = queuedItem?.audioPromise?.audioBuffer;
        let pauseMiliSeconds = queuedItem?.audioPromise?.pauseMiliSeconds;
        let ttsStart = queuedItem?.audioPromise?.ttsStart;
        let ttsEnd = queuedItem?.audioPromise?.ttsEnd;

        if (!audioBuffer) {
            const audioPromise = queuedItem.audioPromise;
            if (!audioPromise) {
                console.log(`[${this.callUUID}] No audio buffer or promise available for response, skipping.`);
                this.respondSequentiallyRunning = false;
                return;
            }

            try {
                const resolved = await audioPromise;
                audioBuffer = resolved?.audioBuffer || resolved;
                pauseMiliSeconds = resolved?.pauseMiliSeconds ?? pauseMiliSeconds;
                ttsStart = resolved?.ttsStart;
                ttsEnd = resolved?.ttsEnd;
                queuedItem.audioBuffer = audioBuffer;
                queuedItem.pauseMiliSeconds = pauseMiliSeconds;
                queuedItem.ttsStart = ttsStart;
                queuedItem.ttsEnd = ttsEnd;
            } catch (err) {
                console.log(`[${this.callUUID}] ❌ Failed to synthesize TTS audio:`, err);
                this.respondSequentiallyRunning = false;
                return;
            }
        }

        if (!audioBuffer?.length) {
            console.log(`[${this.callUUID}] ❌ Empty audio buffer generated, skipping response.`);
            this.respondSequentiallyRunning = false;
            return;
        }

        const approxMs = Math.round((audioBuffer.length / this.getAudioBytesPerSecond()) * 1000);
        const ttsDurationMs = Number.isFinite(ttsStart) && Number.isFinite(ttsEnd) ? (ttsEnd - ttsStart) : null;
        console.log(
            `[${this.callUUID}] TTS audio ready: bytes=${audioBuffer.length}, approx_ms=${approxMs}, tts_ms=${ttsDurationMs ?? "n/a"}`
        );

        pauseMiliSeconds =
            typeof pauseMiliSeconds === 'number' && pauseMiliSeconds > 0
                ? pauseMiliSeconds
                : (audioBuffer.length / this.getAudioBytesPerSecond()) * 1000;

        this.pendingHangupTimeout && clearTimeout(this.pendingHangupTimeout);

        if (this.outboundSampleCursor < this.inboundSampleCursor) {
            this.outboundSampleCursor = this.inboundSampleCursor;
        }
        console.log(
            `[${this.callUUID}] Outbound align before respondSequentially send: inboundCursor=${this.inboundSampleCursor}, outboundCursor=${this.outboundSampleCursor}`
        );

        const contMedia = {
            contentType: AiCallManager.audioContentType,
            sampleRate: AiCallManager.audioSampleHtz,
            track: 'outbound',
            payload: audioBuffer.toString('base64'),
        };

        if (this.callUUID?.includes("call_simulation")) {
            contMedia["audioText"] = assistantText;
        }

        this.wsSend(
            JSON.stringify({
                event: 'playAudio',
                media: contMedia,
            }),
            err => {
                if (err) {
                    console.log(`[${this.callUUID}] Failed to send TTS audio:`, err);

                } else {
                    this.recordOutboundAudio(audioBuffer);
                    this.callRecordingStreamBuffers.push(audioBuffer);
                    this.callGlobalState = 'speaking';
                    this.lastAssistantAudioStartAt = Date.now();
                    if (assistantText) this.lastAssistantAudioText = assistantText;

                    this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
                    this.callListenerTimeOut = setTimeout(() => {
                        this.checkUserWithUs();
                    }, pauseMiliSeconds + AiCallManager.userOnCallCheckTimeMs);

                    if (assistantText?.toLowerCase?.()?.includes?.("goodbye")) {
                        this.pendingHangupTimeout = setTimeout(async () => {
                            try {
                                if (!this.callUUID?.includes?.('call_simulation')) {
                                    this.callUUID && await AiCallManager.plivoClient.calls?.hangup(this.callUUID);
                                }
                            } catch (err) {
                                console.log(
                                    "❌ Error in call hangup, after end-condition: ", err
                                );
                            }
                            this.ws.close();
                        }, pauseMiliSeconds + 5_000);
                    }
                }
            }
        );

        const MIN_GAP_MS = 20;
        const TAIL_MS = 10;

        const effectiveWaitMs = Math.max(
            MIN_GAP_MS,
            pauseMiliSeconds + TAIL_MS
        );

        console.log(
            "pauseMiliSeconds: ", effectiveWaitMs
        );

        await waitForPrevResponseEnds(effectiveWaitMs, this, resKey);

        if (this.callResState?.[resKey]?.length > 0) {
            this.respondSequentially(resKey);
        } else {
            this.callGlobalState = 'listening';
            this.respondSequentiallyRunning = false;
        }
    }

    // Class flow started

    withDemoMode(res) {
        if (!res || typeof res !== "object") return res;
        if (res.details && typeof res.details === "object" && !Array.isArray(res.details)) {
            return {
                ...res,
                details: {
                    ...res.details,
                    mode: "multilingual",
                },
            };
        }
        return res;
    }

    async init(candidateId, jobId, req) {
        try {
            console.log(`[Multilingual Call v3] init start: candidate=${candidateId}, job=${jobId}, callUUID=${req?.query?.callUUID || "n/a"}`);
            AiCallManager.installGracefulShutdownHandlers();

            // During deployment drain, do not start NEW production calls.
            if (AiCallManager.isDraining && !(req?.query?.callUUID || "")?.includes?.('call_simulation')) {
                throw new Error(`${AiCallManager.name} is in drain mode (deployment in progress). Please retry shortly.`);
            }

            this.req = req;
            this.jobId = jobId;
            this.candidateId = candidateId;
            this.useRealtimeAudio = AiCallManager.audioPipeline === "realtime";
            this.realtimeStartTriggered = false;
            this.realtimePendingHangup = false;
            this.realtimeLastAssistantText = "";
            this.realtimeUserItemIds = new Set();
            this.realtimeAssistantItemIds = new Set();
            this.realtimeAudioQueue = [];
            this.realtimeAudioPlaying = false;
            this.realtimeAudioDone = false;
            this.realtimeAudioTimer = null;
            this.realtimePendingChunks = [];
            this.realtimePendingBytes = 0;
            this.realtimeQueueBytes = 0;
            this.realtimePendingFlushTimer = null;
            this.realtimePlaybackStarted = false;
            this.realtimeAudioChunksInResponse = 0;
            this.realtimeAudioBytesInResponse = 0;
            this.realtimeLastAudioLogAt = 0;
            this.realtimeSkipPresenceCheck = false;
            this.realtimeNeedRebuffer = false;
            this.realtimeUnderflowCount = 0;
            this.realtimeLastChunkSentAt = 0;
            this.realtimeLastChunkDurationMs = 0;
            this.audioGlitchLogAt = 0;
            this.lastAssistantAudioStartAt = 0;
            this.lastAssistantAudioText = "";
            this.callStartAtMs = null;
            this.inboundSampleCursor = 0;
            this.outboundSampleCursor = 0;
            this.inboundSegments = [];
            this.outboundSegments = [];
            this.inboundLogLastAt = 0;
            this.outboundLogLastAt = 0;
            this.inboundBytesTotal = 0;
            this.outboundBytesTotal = 0;
            this.wholeCallDurationSeconds = 0;

            if (await isAICallCreditsExausted(req)) {

                let errMsg = "All AI call credits exhausted, please contact administrator.";
                try {
                    const clientAdminUserId = (this.req.user.originalRole || this.req.user.role) === "client_admin" ? this.req.user._id || this.req.user.sub : this.req.user.client;
                    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
                    const clientAdminDoc = await globalConn.models.ClientAdmin
                        .findOne(
                            { user: clientAdminUserId, isArchived: false }
                        ).lean().exec();

                    const usedCredits = clientAdminDoc.totalCallCount * clientAdminDoc.creditRatePerCall;
                    errMsg = "Allocated Credits: " + clientAdminDoc.totalCredit + ", Used Credits: " + usedCredits + "; All credits exausted, Please contact adminstrator...";

                } catch (creditErr) {
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] Failed to load credit details:`, creditErr);
                }

                console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg}`);
                throw new Error(errMsg);

            } else if (this.req.query.callUUID?.includes?.('call_simulation') || isAllowedCallingHourIST() || process?.env?.NODE_ENV === 'development') {
                this.openAIConfig = await loadOpenAIConfigFromDB(req);

                if (!AiCallManager?.plivoClient) {
                    const { authId: plivoAuthId, authToken: plivoAuthToken } = await this.loadPlivoAPIKeys(req);
                    AiCallManager.plivoClient = new PlivoClient(plivoAuthId, plivoAuthToken);
                }

                this.accessValidators = { ...this.accessValidators, client: req.client };
                const strAccessValidators = JSON.stringify(this.accessValidators);

                // Load candidate
                this.candidate = await this.req.conn.models.Candidate.findOne({
                    _id: candidateId,
                    ...this.accessValidators
                }).lean().exec();

                if (!this.candidate) {
                    const errMsg = "Candidate not found or archived";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                this.candidateFirstName = toSentenceCase(this.candidate?.firstName) || '<candidate_first_name>';

                // Compose candidate phone number (keep full local number for non-10-digit regions)
                const phoneDigits = String(this.candidate?.phoneNumber || '').replace(/\D/g, '');
                const countryCode = String(this.candidate?.countryCode || '').trim();
                this.toNumber = `${countryCode}${phoneDigits}`;
                if (!this.toNumber) {
                    const errMsg = "Candidate mobile number not found or invalid";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                // Load script
                this.script = await this.req.conn.models.Script.findOne({
                    jobId,
                    ...this.accessValidators
                })
                    .populate({
                        path: 'jobId',
                        model: "Job",
                        populate: {
                            path: "company",
                            model: "Company",
                        }
                    })
                    .lean()
                    .exec();
                this.job = this.script.jobId;
                this.company = this.script.jobId.company;

                if (!this.script) {
                    const errMsg = "Script not found or archived";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                if (!this.script?.content || this.script?.content?.length < 500 || (!(this.script?.content || "").includes("<candidate_first_name>"))) {
                    const errMsg = "Script invalid or inconsistent";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                // Replace candidate first name placeholder in script content
                if (this.script?.content && this.candidateFirstName) {
                    this.script.content = this.script.content.replaceAll("<candidate_first_name>", (req?.query?.candidateFirstName || this.candidateFirstName));
                }

                if (!this.job) {
                    const errMsg = "Job not found or archived";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                if (!this.job?.shortDescription) {
                    this.job.shortDescription = await jobSVC.getShortJobDescription(this.job?.description, this.req);
                    this.req.conn.models.Job.findOneAndUpdate({
                        _id: this.job?._id
                    },
                        {
                            shortDescription: this.job.shortDescription
                        })
                        .catch(err => {
                            console.log(`❌ [${AiCallManager.name}][${this.init.name}] Error on updating short job description: ${err?.message || err} - Validators: ${strAccessValidators}`);
                        });
                }

                if (!this.company) {
                    const errMsg = "Company not found or archived";
                    console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg} - Validators: ${strAccessValidators}`);
                    throw new Error(errMsg);
                }

                AiCallManager.allInstances[`${candidateId}, ${jobId}`] = this;

                this.getOrCreateAiAgent();

                return this.withDemoMode({
                    ok: true,
                    code: 200,
                    message: "Class initiated successfully...",
                });
            } else {
                throw new Error(AiCallManager.name + " was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: " + new Date() + "...");
            }

        } catch (err) {
            console.log("❌ Error during initiating " + AiCallManager.name + ": ", err);
            return this.withDemoMode({
                ok: false,
                code: 400,
                message: err?.message || "Class failed to initiate...",
                details: {
                    error: err
                },
            });
        }
    }

    async triggerCall() {
        let finalRes;

        if (AiCallManager.isDraining && !this.req.query?.callUUID?.includes?.('call_simulation')) {
            return this.withDemoMode({
                ok: false,
                code: 503,
                message: "Service is in deployment/drain mode. Please retry shortly.",
            });
        }

        if (!this.req.query?.callUUID?.includes?.('call_simulation')) {
            finalRes = await this.createPlivoCall();
        } else {
            this.callUUID = this.req.query?.callUUID;
            finalRes = {
                ok: true,
                code: 201,
                message: "Call simulator successfully triggered...",
                details: {
                    callUUID: this.callUUID,
                }
            };
        }

        if (this.callUUID) {
            AiCallManager.markCallActive(this.callUUID);

            this.classLevelConv = await this.initiateConversation(this.callUUID);
            this.updateAtsStatus("Triggered");

        } else {
            finalRes = {
                ok: false,
                code: 404,
                message: "Call UUID not found...",
            };
        }

        return this.withDemoMode(finalRes);
    }

    async createPlivoCall() {

        if (AiCallManager.isDraining) {
            return {
                ok: false,
                code: 503,
                message: "Service is in deployment/drain mode. New calls are temporarily blocked.",
            };
        }

        this.answerUrl = `${process?.env?.BACKEND_ORIGIN}api/ai/call/answer/plivo/${this.candidateId}/${this.jobId}/`;
        this.hangupUrl = `${process.env.BACKEND_ORIGIN}api/ai/call/hangup/plivo/${this.candidateId}/${this.jobId}/`;

        // Get Plivo numbers and select one (round-robin)
        const client = AiCallManager.plivoClient;
        const plivoNumberList = await client.numbers.list({});

        if (!plivoNumberList.length) {
            const errMsg = "No Plivo numbers found in your account";
            console.log(`❌ [${AiCallManager.name}][${this.createPlivoCall.name}] ${errMsg}`);
            return {
                ok: false,
                code: 404,
                message: errMsg,
                details: { error: errMsg }
            };
        } else {

            const nextIndex = (AiCallManager.roundRobinLastIndex + 1) % plivoNumberList.length;
            const fromNumber = plivoNumberList[nextIndex].number;

            // Create the call
            let call_creation_res;
            call_creation_res = await client.calls.create(
                fromNumber,
                this.toNumber,
                this.answerUrl,
                {
                    answerMethod: "POST",
                    machineDetection: "false",
                    hangupUrl: this.hangupUrl,
                    hangupMethod: "POST"
                }
            );

            this.callUUID = call_creation_res.requestUuid;
            this.fromNumber = fromNumber;

            AiCallManager.roundRobinLastIndex = nextIndex;

            return {
                ok: true,
                code: 201,
                message: "Call successfully triggered...",
                details: {
                    callUUID: this.callUUID,
                }
            };
        }
    }

    async updateAtsStatus(aiCallStatus) {

        if (this.candidate) {
            try {

                let atsParams = { candidate: this.candidate._id, job: this.jobId, ...this.accessValidators };

                let srId;
                let updated;
                let modifyingStageId;

                const ats = await this.req.conn.models.CandidateATS.findOne(atsParams).populate({
                    path: "stageResults",
                    model: "StageResult",
                    select: "_id stage",
                    populate: {
                        path: "stage",
                        model: "Stage",
                        select: "_id title"
                    }
                }).lean().exec();

                if (ats) {
                    let newStageResults = ats?.stageResults.map?.(ele => String(ele?._id));

                    if (aiCallStatus === "Triggered") {

                        for (let stgRes of ats.stageResults) {
                            if (stgRes.stage.title === "Initial AI Call for Candidate Interest Check") {
                                srId = stgRes._id;
                                modifyingStageId = stgRes.stage._id;
                                break;
                            }
                        }

                        if (srId && modifyingStageId) {

                            let modifyingStageIndex = newStageResults.indexOf(String(srId));

                            updated = await this.req.conn.models.StageResult.findOrCreate(modifyingStageId, "Completed", "", this.req);
                            if (updated) {
                                newStageResults[modifyingStageIndex] = updated._id;
                            }
                        }
                    }

                    this.req.conn.models.CandidateATS.findOneAndUpdate(
                        atsParams,
                        { aiCallStatus, stageResults: newStageResults },
                        { new: true, runValidators: true }
                    )
                        .then(res => {
                            console.log(
                                `[${AiCallManager.name}][${this.updateAtsStatus.name}] Candidate ATS update result: `, res?._id
                            );
                        })
                        .finally(() => {
                            console.log(
                                `[${AiCallManager.name}][${this.updateAtsStatus.name}] Candidate ATS aiCallStatus to "Triggered" updating finished...`
                            );
                        });
                } else {
                    throw new Error(`[${AiCallManager.name}][${this.updateAtsStatus.name}] Candidate ATS not found for candidate=${this.candidate?._id}, job=${this.jobId}`);
                }
            } catch (err) {
                console.log(
                    "❌ Error in updateing candidate ats's Status: ", err
                );
            }
        }
    }

    async initiateConversation(callUUID) {
        let classLevelConv;
        if (callUUID) {
            const con_msgs = [
                withTime(system, `Must take care of this instructions: Ask only one question at a time — no more than that. Use only the questions present in the provided screening script, in order, and do not add any new questions. Strictly follow the given instructions and use tools whenever needed. Now, begin the conversation`),
            ];

            this.convFilter = { candidateId: this.candidateId, jobId: this.jobId, };
            this.convUniqueFilter = { callUUID, ...this.convFilter };
            const isReminderCall = this.req?.callPurpose === 'interview_reminder';
            const isInbound = Boolean(this.inboundCalledNumber);
            let callType;
            if (isInbound) {
                callType = isReminderCall ? 'inbound_reminder' : 'inbound_screening';
            } else {
                callType = isReminderCall ? 'reminder' : 'screening';
            }

            const setOnInsert = {
                candidateId: this.candidateId,
                jobId: this.jobId,
                callUUID,
                mobile_num: this.toNumber,
                ...(isInbound
                    ? { calledNumber: this.inboundCalledNumber, direction: 'inbound' }
                    : { calledNumber: this.fromNumber || null, direction: 'outbound' }),
                callType,
                ...(isReminderCall && this.req?.reminderCallContext?.interviewScheduleId
                    ? { interviewScheduleId: this.req.reminderCallContext.interviewScheduleId }
                    : {}),
                messages: con_msgs,
                ...this.convUniqueFilter,
                client: this.req.client,
            };

            this.conversation = await this.req.conn.models.Conversation
                .findOneAndUpdate(
                    { ...this.convUniqueFilter, isArchived: false },
                    { $setOnInsert: setOnInsert },
                    { upsert: true, new: true, setDefaultsOnInsert: true }
                )
                .lean()
                .exec();

            classLevelConv = { ...this.conversation };
            classLevelConv.messages = (this.conversation?.messages || []).filter?.(ele => Boolean(ele?.content)) || [];

            if (callUUID?.includes?.('wa_conv_____') && this.conversation?._id) {
                await this.req.conn.models.Conversation
                    .findOneAndUpdate(
                        { ...this.convUniqueFilter, callUUID: callUUID.replace("wa_conv_____", ""), isArchived: false },
                        { whatsappConvId: this.conversation._id }
                    )
                    .exec();
            }

            // ✅ For demo call: only reset messages on first creation, not on reconnect/reload
            if (callUUID?.includes?.('call_simulation') && !(classLevelConv?.messages || []).length) {
                classLevelConv.messages = con_msgs;
            }

            if (classLevelConv.messages.length === 1) {

                // Getting previous conversation summary
                const prevConvs = await this.req.conn.models.Conversation.find(this.convFilter).lean().exec();
                if ((prevConvs || [])?.length > 0) {
                    const preConv = prevConvs?.[prevConvs?.length - 1];

                    if ((preConv.messages || [])?.length > 0 && !callUUID?.includes?.('call_simulation')) {
                        const conSummary_ = await chatCompletionByOpenAI([{
                            role: "system",
                            content: "Briefly describe the previous conversation in third person, using as few lines as possible, so it can be referenced when starting a new conversation. Previous conversation: \n" + (preConv.messages || [])?.map?.(msg => `${niceLabel(msg?.role)}: ${(Array.isArray(msg?.content) ? msg?.content?.[0]?.text : msg?.content)}`).join("\n")
                        }]);
                        const conSummary = conSummary_?.choices?.[0]?.message?.content || '';
                        conSummary && classLevelConv.messages.push(withTime(system, "Here's a summary of the previous conversation for your reference: \n" + conSummary + "\n Please acknowledge this to the candidate."));
                    }
                }

                if (!(callUUID || {})?.includes("wa_conv_____")) {

                    if (!this.useRealtimeAudio) {
                        const assistantText = await this.generateOpenAIResponse(classLevelConv);

                        classLevelConv.messages.push(withTime(assistant, assistantText));

                        if (!this.firstMsgAudioBuffer) {
                            console.log(
                                "\n this.firstMsgAudioBuffer msg: ", assistantText
                            );
                            this.firstMsgAudioText = assistantText;
                            this.firstMsgAudioBuffer = await universalTextToSpeech(
                                assistantText || "Please wait, we're processing things.",
                                this.getTtsLanguageCode(),
                                this.script?.gender?.toUpperCase() || 'FEMALE',
                                this.script.voiceModel || 'en-IN-Chirp-HD-F',
                                AiCallManager.audioEncoding,
                                AiCallManager.audioSampleHtz,
                                AiCallManager.speakingRate,
                            );
                        }
                    }
                }
            }

            if (!this.useRealtimeAudio && !this.areYouThereAudioBuffer && !(callUUID || {})?.includes("wa_conv_____")) {
                this.areYouThereAudioBuffer = await universalTextToSpeech(
                    "Are you still there?",
                    this.getTtsLanguageCode(),
                    this.script?.gender?.toUpperCase() || 'FEMALE',
                    this.script.voiceModel || 'en-IN-Chirp-HD-F',
                    AiCallManager.audioEncoding,
                    AiCallManager.audioSampleHtz,
                    AiCallManager.speakingRate,
                );
            }

            // ✅ FIX: After server restart, in-memory firstMsgAudioBuffer is lost.
            // If conversation already exists, rebuild it from the last assistant message
            // so WS connect immediately plays audio (no need to wait for user speech).
            if (!this.useRealtimeAudio && !this.firstMsgAudioBuffer && !(callUUID || {})?.includes("wa_conv_____")) {
                try {
                    const msgs = classLevelConv?.messages || [];

                    const lastAssistantMsg = [...msgs]
                        .reverse()
                        .find(m => m?.role === "assistant" && Boolean(
                            (Array.isArray(m?.content) ? m?.content?.[0]?.text : m?.content)?.trim?.()
                        ));

                    let replayText = lastAssistantMsg
                        ? (Array.isArray(lastAssistantMsg.content) ? lastAssistantMsg.content?.[0]?.text : lastAssistantMsg.content)
                        : null;

                    // Avoid replaying goodbye which can trigger hangup flows.
                    if (replayText?.toLowerCase?.().includes?.("goodbye")) replayText = null;

                    if (replayText) {
                        this.firstMsgAudioText = replayText;
                        this.firstMsgAudioBuffer = await universalTextToSpeech(
                            replayText || "Please wait, we're processing things.",
                            this.getTtsLanguageCode(),
                            this.script?.gender?.toUpperCase() || "FEMALE",
                            this.script.voiceModel || "en-IN-Chirp-HD-F",
                            AiCallManager.audioEncoding,
                            AiCallManager.audioSampleHtz,
                            AiCallManager.speakingRate
                        );
                    }
                } catch (e) {
                    console.log(
                        `[${AiCallManager.name}][${this.initiateConversation.name}] Failed to rebuild firstMsgAudioBuffer:`,
                        e?.message || e
                    );
                }
            }


            (async () => {
                if (!this.areYouThereAudioBuffer && !(callUUID || {})?.includes("wa_conv_____")) {
                    this.areYouThereAudioBuffer = await universalTextToSpeech(
                        "Are you still there?",
                        this.getTtsLanguageCode(),
                        this.script?.gender?.toUpperCase() || 'FEMALE',
                        this.script.voiceModel || 'en-IN-Chirp-HD-F',
                        AiCallManager.audioEncoding,
                        AiCallManager.audioSampleHtz,
                        AiCallManager.speakingRate,
                    );
                }
            })();

        } else {
            console.log(
                "❌ Error in initiating conversation: callUUID not found..."
            );
            throw new Error("❌ Error in initiating conversation: callUUID not found...");
        }

        return classLevelConv;
    }


    answerCall(callUUID) {
        if (!callUUID || this.callUUID !== callUUID) {
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Invalid call information. Goodbye.</Speak></Response>';
        }

        if (!this.callUUID || this.callUUID !== callUUID) {
            console.log(
                `[AiCallManager.answerCall] Syncing callUUID. Old: ${this.callUUID}, New (Plivo): ${callUUID}`
            );
            this.callUUID = callUUID;
        }

        if (!this.useRealtimeAudio) {
            this.recognizeStreamCreator()
                .then(() => {
                    this.recognizeStream?.pause?.();
                    this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
                });
        }

        return this.answerPlivoCall(callUUID);
    }

    answerPlivoCall(callUUID) {
        if (!callUUID || !this.callUUID || callUUID !== this.callUUID) {
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Invalid job or candidate Call information. Goodbye.</Speak></Response>';
        }

        const backendOrigin = process?.env?.BACKEND_ORIGIN || '';
        const wsOrigin = backendOrigin
            .replace(/^https:\/\//i, 'wss://')
            .replace(/^http:\/\//i, 'ws://');
        const wssCallUrl = wsOrigin + "api/ai/call/ws/plivo/" + this.candidate?._id + "/" + this.job?._id + "/" + this.callUUID + "/";

        const response = plivoResponse();

        response.addStream(wssCallUrl, {
            bidirectional: true,
            contentType: AiCallManager.audioContentType + ';rate=' + AiCallManager.audioSampleHtz,
            streamTimeout: 3000,
            keepCallAlive: true,
        });

        return response.toXML();
    }

    async aiCallWsInitiator(ws, callUUID) {
        AiCallManager.installGracefulShutdownHandlers();

        this.ws = ws;
        console.log(`[${this.callUUID}] New WebSocket connection`);

        if (!ws || !callUUID || !this.callUUID || callUUID !== this.callUUID) {
            console.log('Missing callUUID in WebSocket request...');
            this.ws.close();
            return;
        }

        // Mark active call so deploy/drain does not kill this process mid-call.
        AiCallManager.markCallActive(this.callUUID);

        this.inboundSegments = [];
        this.outboundSegments = [];
        this.inboundBytesTotal = 0;
        this.outboundBytesTotal = 0;
        this.inboundLogLastAt = 0;
        this.outboundLogLastAt = 0;
        this.inboundSampleCursor = 0;
        this.outboundSampleCursor = 0;

        if (!this.callStartAtMs) {
            this.callStartAtMs = Date.now();
        }
        console.log(`[${this.callUUID}] Recording enabled (sample-cursor) sr=${AiCallManager.audioSampleHtz}, encoding=${AiCallManager.audioEncoding}`);

        let pauseMiliSeconds;

        if (this.useRealtimeAudio) {
            try {
                await this.ensureRealtimeSession();
            } catch (err) {
                console.log(`[${this.callUUID}] Realtime session init failed:`, err?.message || err);
                this.useRealtimeAudio = false;
                this.recognizeStreamCreator()
                    .then(() => {
                        this.recognizeStream?.pause?.();
                        this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
                    });
            }
        }

        // If it's the very first message, send a greeting / AI-start
        if (!this.useRealtimeAudio && this.firstMsgAudioBuffer) {
            pauseMiliSeconds = (this.firstMsgAudioBuffer.length / this.getAudioBytesPerSecond()) * 1000;

            if (this.outboundSampleCursor < this.inboundSampleCursor) {
                this.outboundSampleCursor = this.inboundSampleCursor;
            }
            console.log(
                `[${this.callUUID}] Outbound align on greeting: inboundCursor=${this.inboundSampleCursor}, outboundCursor=${this.outboundSampleCursor}`
            );

            const contMedia = {
                contentType: AiCallManager.audioContentType,
                sampleRate: AiCallManager.audioSampleHtz,
                track: 'outbound',
                payload: this.firstMsgAudioBuffer.toString('base64'),
            };

            if (this.callUUID?.includes("call_simulation")) {
                contMedia["audioText"] = this.firstMsgAudioText;
            }

            this.wsSend(
                JSON.stringify({
                    event: 'playAudio',
                    media: contMedia,
                }),
                err => {
                    if (err) console.log(`❌ [${this.callUUID}] Failed to send First / Initial TTS audio:`, err);
                    else {
                        this.recordOutboundAudio(this.firstMsgAudioBuffer);
                        this.callRecordingStreamBuffers.push(this.firstMsgAudioBuffer);
                        this.callGlobalState = 'speaking';
                        this.lastAssistantAudioStartAt = Date.now();
                        if (this.firstMsgAudioText) this.lastAssistantAudioText = this.firstMsgAudioText;

                        this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
                        this.callListenerTimeOut = setTimeout(() => {
                            this.checkUserWithUs();
                        }, pauseMiliSeconds + AiCallManager.userOnCallCheckTimeMs);
                        const resKey = Date();
                        this.callResState = { [resKey]: [] };
                    }
                }
            );
        }

        console.log(
            "pauseMiliSeconds: ", pauseMiliSeconds,
        );

        if (!this.useRealtimeAudio && pauseMiliSeconds) {
            await waitForPrevResponseEnds(parseInt(pauseMiliSeconds / 2), this, Date());
            if (this.callGlobalState === 'speaking') this.callGlobalState = 'listening';
        }

        ws.on('message', this.wsOnMessage.bind(this));
        ws.on('close', this.wsOnClose.bind(this));

        try {
            console.log(`Total - Sessions count: ${Object.keys(AiCallManager.allInstances || {}).length}`);
        } catch (err) {
            console.log("❌ aiCallWsHandler:: Total - Sessions count err: ", err);
        }
    }

    recordInboundAudio(pcm) {
        if (!pcm?.length) return;
        this.userStreamBuffers.push(pcm);
        const sampleIndex = this.inboundSampleCursor;
        this.inboundSegments.push({ sampleIndex, buf: pcm });
        this.inboundSampleCursor += pcm.length;
        this.inboundBytesTotal += pcm.length;

        const now = Date.now();
        if (!this.inboundLogLastAt || (now - this.inboundLogLastAt) > 2000) {
            console.log(
                `[${this.callUUID}] Inbound buffered: bytes=${this.inboundBytesTotal}, segments=${this.inboundSegments.length}, cursorSamples=${this.inboundSampleCursor}`
            );
            this.inboundLogLastAt = now;
        }
    }

    recordOutboundAudio(audioBuffer) {
        if (!audioBuffer?.length) return;
        const sampleIndex = this.outboundSampleCursor;
        this.outboundSegments.push({ sampleIndex, buf: audioBuffer });
        this.outboundSampleCursor += audioBuffer.length;
        this.outboundBytesTotal += audioBuffer.length;

        const now = Date.now();
        if (!this.outboundLogLastAt || (now - this.outboundLogLastAt) > 2000) {
            console.log(
                `[${this.callUUID}] Outbound buffered: bytes=${this.outboundBytesTotal}, segments=${this.outboundSegments.length}, cursorSamples=${this.outboundSampleCursor}`
            );
            this.outboundLogLastAt = now;
        }
    }

    async wsOnMessage(message) {
        let payload;
        try {
            payload = JSON.parse(message);

        } catch (err) {
            console.log(
                "Error in getting payload form plivo wss msg: ", err
            );
            return;
        }

        if (payload.event === 'start') {
            if (this.callUUID !== payload.start.callId) {
                console.log(`[${this.callUUID}] Call UUID mismatch with ${payload.start.callId}, hanging up...`);
                setTimeout(async () => {
                    try {
                        if (!this.callUUID?.includes?.('call_simulation')) {
                            payload.start.callId && await AiCallManager.plivoClient.calls.hangup(payload.start.callId);
                            this.callUUID && await AiCallManager.plivoClient.calls.hangup(this.callUUID);
                        }
                    } catch (err) {
                        console.log(
                            "❌ Error in call hangup, after start-condition: ", err
                        );
                    }
                    this.ws.close();
                }, 5000);
                return;
            }
        } else if (payload.event === 'stop') {
            this.ws.close();
            return;

        } else if (payload.event === 'media' && !this.closingWs) {

            const pcm = Buffer.from(payload.media.payload, 'base64');

            if (this.useRealtimeAudio) {
                if (!this.realtimeSession) {
                    try {
                        await this.ensureRealtimeSession();
                    } catch (err) {
                        console.log(`[${this.callUUID}] Realtime session missing during media:`, err?.message || err);
                        this.useRealtimeAudio = false;
                    }
                }

                if (this.useRealtimeAudio && this.realtimeSession) {
                    const audioArrayBuffer = pcm.buffer.slice(
                        pcm.byteOffset,
                        pcm.byteOffset + pcm.byteLength
                    );
                    this.realtimeSession.sendAudio(audioArrayBuffer);

                    this.recordInboundAudio(pcm);
                    return;
                }
            }

            if (this.recognizeStream?.isPaused?.()) {
                this.recognizeStream?.resume?.();
                this.recognizeStreamCreatedAt = new Date().getTime();

                this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
                this.recognizeStreamTimeout = setTimeout(() => {
                    this.recognizeStream?.destroy?.();
                }, this.streamTimeoutMs);
            }

            try {
                const now = new Date().getTime();
                const streamStale = this.recognizeStreamCreatedAt ? (now - this.recognizeStreamCreatedAt) > this.streamTimeoutMs : false;

                if (!this.recognizeStream || this.recognizeStream?.destroyed || this.recognizeStream?.closed || this.recognizeStream?.errored || streamStale) {
                    this.recognizeStream?.destroy?.();
                    await this.recognizeStreamCreator(this.userStreamBuffers?.length > 0 ? this.userStreamBuffers?.length - 1 : 0);
                } else {
                    this.recognizeStream.write(pcm, err => err && console.log("❌ Error in writing audio chunks to recognize stream: ", err));
                }

                this.recordInboundAudio(pcm);

            } catch (err) {
                console.log(`[${this.callUUID}] ❌ Error writing to recognize stream:`, err);
                throw new Error(`[${this.callUUID}] ❌ Error writing to recognize stream...`);
            }
        }
    }

    async recognizeStreamCreator(lastPCMMediaIndex = null) {
        try {
            // Build an OpenAI Realtime session dedicated to STT (multilingual)
            const apiKey = this.openAIConfig?.apiKey || process.env.OPENAI_API_KEY;
            if (!apiKey) throw new Error("No OpenAI API key found for OpenAI STT session.");

            const vadThreshold = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_THRESHOLD))
                ? Number(process.env.AI_CALL_REALTIME_VAD_THRESHOLD)
                : 0.75;
            const vadSilenceMs = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_SILENCE_MS))
                ? Number(process.env.AI_CALL_REALTIME_VAD_SILENCE_MS)
                : 800;
            const vadPrefixMs = Number.isFinite(Number(process.env?.AI_CALL_REALTIME_VAD_PREFIX_MS))
                ? Number(process.env.AI_CALL_REALTIME_VAD_PREFIX_MS)
                : 250;

            // Lightweight transcriber agent – no responses are generated because outputModalities is empty.
            const transcribeAgent = new Agent({
                name: "Transcriber",
                instructions: "You are a silent transcriber. Do not respond; only provide transcripts.",
                model: AiCallManager.realtimeTranscribeModel,
            });

            const sttSession = new RealtimeSession(transcribeAgent, {
                apiKey,
                transport: 'websocket',
                model: AiCallManager.realtimeTranscribeModel,
                config: {
                    outputModalities: [], // prevents text/audio responses
                    audio: {
                        input: {
                            format: AiCallManager.realtimeAudioFormat || "g711_ulaw",
                            transcription: { model: AiCallManager.realtimeTranscribeModel },
                            turnDetection: {
                                type: 'server_vad',
                                interruptResponse: false,
                                createResponse: false,
                                silenceDurationMs: vadSilenceMs,
                                prefixPaddingMs: vadPrefixMs,
                                threshold: vadThreshold,
                            },
                            noiseReduction: { type: 'near_field' },
                        },
                    },
                },
            });

            this.recognizeStream = {
                session: sttSession,
                destroyed: false,
                paused: false,
                write: (audioBuffer) => {
                    if (this.recognizeStream?.destroyed) return;
                    const ab = audioBuffer.buffer.slice(
                        audioBuffer.byteOffset,
                        audioBuffer.byteOffset + audioBuffer.byteLength
                    );
                    sttSession.sendAudio(ab);
                },
                end: () => { },
                destroy: () => {
                    if (this.recognizeStream?.destroyed) return;
                    this.recognizeStream.destroyed = true;
                    try { sttSession.close?.(); } catch (e) { }
                    this.recognizeStream = null;
                },
                isPaused: () => this.recognizeStream?.paused || false,
                pause: () => { this.recognizeStream.paused = true; },
                resume: () => { this.recognizeStream.paused = false; },
            };

            sttSession.on('transport_event', (event) => {
                if (event?.type === 'conversation.item.input_audio_transcription.completed') {
                    const transcript = event.transcript?.trim?.();
                    if (transcript) {
                        this.onTranscript(transcript, true);
                    }
                }
            });

            sttSession.on('error', (err) => {
                console.log(`[${this.callUUID}] ❌ OpenAI STT session error:`, err?.error || err);
            });

            await sttSession.connect({ apiKey, model: AiCallManager.realtimeTranscribeModel });

            this.recognizeStreamCreatedAt = new Date().getTime();

            this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
            this.recognizeStreamTimeout = setTimeout(() => {
                this.recognizeStream?.destroy?.();
            }, this.streamTimeoutMs);

            sttSession.on('session.created', () => {
                console.log(`[${this.callUUID}] OpenAI STT session created`);
            });
            sttSession.on('close', () => {
                console.log(`[${this.callUUID}] OpenAI STT session closed`);
                if (this.callGlobalState === 'speaking') this.callGlobalState = 'listening';
            });

            // If resuming from a media gap
            if (Number.isInteger(lastPCMMediaIndex) && lastPCMMediaIndex >= 0) {
                this.userStreamBuffers.slice(lastPCMMediaIndex)
                    .forEach(buf => this.recognizeStream.write(buf));
            }

        } catch (err) {
            console.error('❌ Failed to create recognizeStream: ', err);
            throw new Error(err);
        }
    }

    async onTranscript(transcript, isFinal) {
        if (!transcript?.trim?.()) {
            return;
        }

        this.lastUserTranscriptAt = Date.now();

        // Handle language preference (e.g., "speak in Hindi")
        this.handleLanguagePreference(transcript);

        // Detect language from user speech in background
        await this.updateDetectedLanguage(transcript);

        // Check if this is an echo or barge-in that should be ignored
        const ignoreMeta = this.getBargeInIgnoreMeta(transcript);
        if (ignoreMeta) {
            this.logAudioGlitch("stt_ignored", {
                mode: this.useRealtimeAudio ? "realtime" : "non_realtime",
                reason: ignoreMeta.reason,
                words: ignoreMeta.words,
                since_ms: ignoreMeta.sinceStart,
            });
            return;
        }

        // Clear timeouts
        if (this.recognizeStreamTimeout) {
            clearTimeout(this.recognizeStreamTimeout);
        }

        if (this.pendingHangupTimeout) {
            clearTimeout(this.pendingHangupTimeout);
            delete this.pendingHangupTimeout;
        }

        // Handle interruption if assistant was speaking
        if (this.callGlobalState === 'speaking') {
            this.stateTimeOut && clearTimeout(this.stateTimeOut);
            this.sendPlivoPlayStop();
            this.classLevelConv.messages.push(withTime(system, "For your information: Your previous response sent to candidate, was interrupted by candidate. May they want to ask something else."));
            this.callGlobalState = 'interrupted';
            this.callResState = {};
        }

        // Only process final transcripts
        if (isFinal && transcript) {

            // Destroy recognition stream if not using realtime
            if (!this.useRealtimeAudio) {
                this.recognizeStream?.destroy?.();
            }

            if (this.callGlobalState !== 'interrupted') this.callGlobalState = 'listening';

            if (this.callListenerTimeOut) {
                clearTimeout(this.callListenerTimeOut);
                delete this.callListenerTimeOut;
            }

            this.callGlobalState = 'processing';

            // Store user transcript in conversation with language info
            try {
                if (!this.classLevelConv || !this.classLevelConv?.messages) {
                    this.classLevelConv = await this.initiateConversation(this.callUUID);
                }

                const userMessage = withTime(user, transcript);
                // Add detected language metadata to the message
                if (this.detectedLanguageCode) {
                    userMessage.language = this.detectedLanguageCode;
                    userMessage.languageName = this.detectedLanguageName;
                }

                this.classLevelConv.messages.push(userMessage);
                console.log(`[${this.callUUID}] User transcript recorded: "${transcript}" (lang: ${this.detectedLanguageCode || 'unknown'})`);
            } catch (err) {
                console.error(`[${this.callUUID}] Error in saving user message: `, err);
                if (!this.classLevelConv || !this.classLevelConv?.messages) {
                    this.classLevelConv = await this.initiateConversation(this.callUUID);
                    this.classLevelConv.messages.push(withTime(user, transcript));
                }
            }

            console.log(`[${this.callUUID}] Speech recognized: "${transcript}"`);

            (async () => {
                let fullAssitantText = "";
                const responseKey = `${Date.now()}`;
                this.callResState = { [responseKey]: [] };

                let resCnt = 0;
                const minTtsChars = Number.isFinite(Number(process.env?.AI_CALL_TTS_MIN_CHARS))
                    ? Number(process.env.AI_CALL_TTS_MIN_CHARS)
                    : 160;
                const minTtsSentences = Number.isFinite(Number(process.env?.AI_CALL_TTS_MIN_SENTENCES))
                    ? Number(process.env.AI_CALL_TTS_MIN_SENTENCES)
                    : 2;
                let pendingText = "";
                let pendingCount = 0;

                const flushPending = () => {
                    const text = pendingText.trim();
                    if (!text) return;
                    if (!(responseKey in this.callResState)) {
                        pendingText = "";
                        pendingCount = 0;
                        return;
                    }

                    const audioPreparationPromise = (async () => {
                        const ttsStart = Date.now();
                        const ttsLanguage = this.getTtsLanguageCode();
                        console.log(`[${this.callUUID}] TTS language: ${ttsLanguage}, Text: "${text.substring(0, 50)}..."`);

                        const audioBuffer = await universalTextToSpeech(
                            text,
                            ttsLanguage,
                            this.script?.gender || 'FEMALE',
                            this.script?.voiceModel || 'en-IN-Chirp-HD-F',
                            AiCallManager.audioEncoding,
                            AiCallManager.audioSampleHtz,
                            AiCallManager.speakingRate,
                        );
                        const ttsEnd = Date.now();
                        const pauseMiliSeconds = (audioBuffer.length / this.getAudioBytesPerSecond()) * 1000;
                        return { audioBuffer, pauseMiliSeconds, ttsStart, ttsEnd };
                    })();

                    this.callResState[responseKey].push({ assistantText: text, audioPromise: audioPreparationPromise });
                    fullAssitantText += " " + text;
                    pendingText = "";
                    pendingCount = 0;

                    if (resCnt === 0 || (this.respondSequentiallyRunning === false && responseKey in this.callResState)) {
                        this.respondSequentially(responseKey);
                        ++resCnt;
                    }
                };

                for await (const assistantText of this.generateOpenAIResponseStream(this.classLevelConv)) {
                    console.log(`[${this.callUUID}] AI Response chunk: \`${assistantText}\`... `);
                    if (!(responseKey in this.callResState)) {
                        this.callResState = {};
                        break;
                    }

                    const cleaned = (assistantText || "").trim();
                    if (!cleaned) continue;

                    pendingText = pendingText ? `${pendingText} ${cleaned}` : cleaned;
                    pendingCount += 1;

                    const shouldFlush =
                        pendingText.length >= minTtsChars ||
                        pendingCount >= minTtsSentences;

                    if (shouldFlush) {
                        flushPending();
                    }
                }

                flushPending();

                // Store assistant response with language metadata
                const assistantMessage = withTime(assistant, fullAssitantText);
                if (this.detectedLanguageCode) {
                    assistantMessage.language = this.detectedLanguageCode;
                }
                this.classLevelConv.messages.push(assistantMessage);

                // Save conversation to database
                try {
                    const updated = await this.req.conn.models.Conversation
                        .findOneAndUpdate(
                            { ...this.convUniqueFilter, isArchived: false },
                            {
                                messages: this.classLevelConv.messages,
                            },
                            { new: true }
                        )
                        .exec();

                    console.log(`[${this.callUUID}] Conversation saved with ${this.classLevelConv.messages.length} messages`);
                } catch (err) {
                    console.error(`[${this.callUUID}] Error saving conversation:`, err?.message || err);
                }
            })();
        }
    }

    async wsOnClose(code = null, reason = null) {
        this.closingWs = true;
        this.callGlobalState = "Closed";

        if (this.callListenerTimeOut) {
            clearTimeout(this.callListenerTimeOut);
            delete this.callListenerTimeOut;
        }

        if (this.pendingHangupTimeout) {
            clearTimeout(this.pendingHangupTimeout);
            delete this.pendingHangupTimeout;
        }

        this.recognizeStream?.destroy?.();
        this.clearRealtimePlayback("ws_close");
        try { this.realtimeSession?.close?.(); } catch (e) { }
        this.realtimeSession = null;

        try {
            const sampleRate = AiCallManager.audioSampleHtz || 8000;

            const sortSegments = (segments = []) => {
                if (!Array.isArray(segments)) return [];
                return [...segments].sort((a, b) => (a?.sampleIndex || 0) - (b?.sampleIndex || 0));
            };

            const buildDebugWavFromSegments = (segments = []) => {
                const sorted = sortSegments(segments).map(seg => seg?.buf).filter(Boolean);
                const dataBytes = sorted.reduce((sum, buf) => sum + buf.length, 0);
                if (!dataBytes) return { buffer: null, dataBytes: 0 };
                const header = writeMulawWavHeader(dataBytes, sampleRate, 1);
                return { buffer: Buffer.concat([header, ...sorted]), dataBytes };
            };

            const sortedInbound = sortSegments(this.inboundSegments);
            const sortedOutbound = sortSegments(this.outboundSegments);

            const inboundRes = buildDebugWavFromSegments(sortedInbound);
            const outboundRes = buildDebugWavFromSegments(sortedOutbound);

            const inboundEnd = Math.max(this.inboundSampleCursor, getMaxSampleEnd(sortedInbound));
            const outboundEnd = Math.max(this.outboundSampleCursor, getMaxSampleEnd(sortedOutbound));
            const hasSegments = Boolean(sortedInbound.length || sortedOutbound.length);

            let inboundTrack;
            let outboundTrack;
            let totalSamples = 0;
            let monoWav = null;
            let stereoWav = null;

            if (hasSegments) {
                const tracks = buildStereoPcmTracks(sortedInbound, sortedOutbound, sampleRate);
                inboundTrack = tracks.inboundTrack;
                outboundTrack = tracks.outboundTrack;
                totalSamples = tracks.totalSamples;

                const monoTrack = mixToMonoTrack(inboundTrack, outboundTrack, totalSamples);
                const stereoInterleaved = (() => {
                    const interleaved = new Int16Array(totalSamples * 2);
                    for (let i = 0; i < totalSamples; i++) {
                        interleaved[i * 2] = inboundTrack[i];
                        interleaved[i * 2 + 1] = outboundTrack[i];
                    }
                    return interleaved;
                })();

                monoWav = encodePcmWav(monoTrack, sampleRate, 1);
                stereoWav = encodePcmWav(stereoInterleaved, sampleRate, 2);
            }

            const inboundDurationSeconds = inboundEnd ? (inboundEnd / sampleRate) : 0;
            const outboundDurationSeconds = outboundEnd ? (outboundEnd / sampleRate) : 0;
            const combinedDurationSeconds = hasSegments && totalSamples ? (totalSamples / sampleRate) : 0;
            this.wholeCallDurationSeconds = combinedDurationSeconds;

            console.log(
                `[${this.callUUID}][wsOnClose] inboundSegments=${sortedInbound.length}, outboundSegments=${sortedOutbound.length}, inboundDur_s=${inboundDurationSeconds.toFixed(2)}, outboundDur_s=${outboundDurationSeconds.toFixed(2)}, combinedDur_s=${combinedDurationSeconds.toFixed(2)}`
            );

            if (!monoWav && !stereoWav) {
                console.log(`[${this.callUUID}][wsOnClose] ⚠️ No audio segments captured; skipping uploads.`);
            } else {
                const uploadWav = async (buffer, suffix, logLabel) => {
                    if (!buffer?.length) return { url: null, firebasePath: null };
                    const firebasePath = `aiCallAudios/${this.callUUID}_${suffix}.wav`;
                    await uploadBufferToFirebase(buffer, firebasePath, 'audio/wav');
                    const url = await getDownloadURL(firebasePath);
                    console.log(`[${this.callUUID}][wsOnClose] Uploaded ${logLabel} to ${firebasePath}`);
                    return { url, firebasePath };
                };

                const monoUpload = await uploadWav(monoWav, 'combined_mono_pcm', 'combined mono PCM');
                const stereoUpload = await uploadWav(stereoWav, 'combined_stereo_pcm', 'combined stereo PCM');

                let outboundUpload = { url: null };
                let inboundUpload = { url: null };
                if (outboundRes.buffer) {
                    outboundUpload = await uploadWav(outboundRes.buffer, 'outbound', 'outbound (debug)');
                }
                if (inboundRes.buffer) {
                    inboundUpload = await uploadWav(inboundRes.buffer, 'inbound', 'inbound (debug)');
                }

                const monoBytes = monoWav ? Math.max(0, monoWav.length - 44) : 0;
                const stereoBytes = stereoWav ? Math.max(0, stereoWav.length - 44) : 0;
                console.log(
                    `[${this.callUUID}][wsOnClose] totalSamples=${totalSamples}, monoBytes=${monoBytes}, stereoBytes=${stereoBytes}`
                );

                const mainAudioUrl = monoUpload.url || stereoUpload.url || null;
                if (mainAudioUrl) {
                    const updatePayload = {
                        audio_url: mainAudioUrl,
                        messages: this.classLevelConv.messages,
                        durationSeconds: combinedDurationSeconds,
                    };
                    if (stereoUpload.url) updatePayload.audio_url_stereo = stereoUpload.url;
                    if (outboundUpload.url) updatePayload.audio_url_outbound = outboundUpload.url;
                    if (inboundUpload.url) updatePayload.audio_url_inbound = inboundUpload.url;

                    const conv = await this.req.conn.models.Conversation
                        .findOneAndUpdate(
                            { ...this.convUniqueFilter, isArchived: false },
                            updatePayload
                        )
                        .exec();

                    console.log(
                        `[${this.callUUID}][wsOnClose] Conversation updated. convId=${conv?._id}, audio_url=${mainAudioUrl}, audio_url_stereo=${stereoUpload.url}`
                    );
                } else {
                    console.log(`[${this.callUUID}][wsOnClose] No audio URLs to save on conversation.`);
                }
            }

        } catch (err) {
            console.log(`[${this.callUUID}] ❌ Error during WebSocket close:`, err);
        }

        // Update ATS/candidate from conversation
        if (this.conversation?._id) {
            await updateCandidateFromConversation(this.conversation._id, this.req, this.callUUID);
        }

        // 🔁 After call completion, update relevancy for this specific candidate + job pair
        try {
            if (this.candidateId && this.jobId) {
                console.log(
                    `[${this.callUUID}][wsOnClose] enqueuePairRelevancy for candidate=${this.candidateId}, job=${this.jobId}`
                );

                // Existing behavior: recompute resume/JD based relevancy
                enqueuePairRelevancy(this.candidateId, this.jobId, {
                    conn: this.req.conn,
                    client: this.req.client,
                    user: this.req.user
                });

                // ★ NEW: conversation-based relevancy update using Conversation DB
                const relSvc = new RelevancyService();
                await relSvc.updateFromConversation({
                    client: this.req.client,
                    candidateId: this.candidateId,
                    jobId: this.jobId,
                    conn: this.req.conn,
                    user: this.req.user
                });
            }
        } catch (err) {
            console.log(`[${this.callUUID}][wsOnClose] Failed to update relevancy from conversation:`, err);
        }

        if (!this.callUUID?.includes?.('call_simulation')) {
            try {

                if (this.wholeCallDurationSeconds > 15) {
                    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
                    const clientAdminUserId = (this.req.user.originalRole || this.req.user.role) === "client_admin" ? this.req.user._id || this.req.user.sub : this.req.user.client;
                    await globalConn.models.ClientAdmin
                        .findOneAndUpdate(
                            { user: clientAdminUserId, isArchived: false },
                            { $inc: { totalCallCount: 1 } }
                        )
                        .exec();
                } else {
                    console.log("Call Duration is less than 15 Secs; ", this.wholeCallDurationSeconds, " Secs");
                }
            } catch (err) {
                console.log(`❌ [${this.callUUID}][wsOnClose] Failed to increment totalCallCount:`, err);
            }
        }

        // Mark call inactive for deploy.
        AiCallManager.markCallInactive(this.callUUID);

        console.log(`[${this.callUUID}][wsOnClose] Code: ${code}, Reason: ${reason?.toString?.()}, finished execution...`);
    }

    async initWhatsAppConv(fallbackToWhatsApp = false) {
        let finalRes = {
            ok: false,
            code: 400,
            message: "Something went wrong...",
            details: {
                waUUID: this.waUUID,
            }
        };

        if (await isAICallCreditsExausted(this.req)) {

            let errMsg = "All AI call credits exhausted, please contact administrator.";
            try {
                const clientAdminUserId = (this.req.user.originalRole || this.req.user.role) === "client_admin" ? this.req.user._id || this.req.user.sub : this.req.user.client;
                const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
                const clientAdminDoc = await globalConn.models.ClientAdmin
                    .findOne(
                        { user: clientAdminUserId, isArchived: false }
                    ).lean().exec();

                const usedCredits = clientAdminDoc.totalCallCount * clientAdminDoc.creditRatePerCall;
                errMsg = "Allocated Credits: " + clientAdminDoc.totalCredit + ", Used Credits: " + usedCredits + "; All credits exausted, Please contact adminstrator...";

            } catch (creditErr) {
                console.log(`❌ [${AiCallManager.name}][${this.init.name}] Failed to load credit details:`, creditErr);
                errMsg = creditErr;
            }

            console.log(`❌ [${AiCallManager.name}][${this.init.name}] ${errMsg}`);
            finalRes = {
                ok: false,
                code: 400,
                message: errMsg,
                details: {
                    waUUID: this.waUUID,
                    error: errMsg,
                }
            };
        } else {
            if (!this.waUUID) {
                this.fallbackToWhatsApp = fallbackToWhatsApp;
                this.ws?.close?.();
                this.waUUID = `wa_conv_____${this.callUUID || this.toNumber + "_____" + Date.now()}`;
                this.getOrCreateAiAgent();
                this.waClassLevelConv = await this.initiateConversation(this.waUUID);
                this.waClassLevelConv.messages.push(withTime(system, fallbackToWhatsApp ? "Strictly Note this, conversation is continued on WhatsApp Chat(SILENTLY), because of some issue on phone call, now begin conversation here..." : "Strictly Note this, conversation is initiated on WhatsApp Chat(SILENTLY). Do not propose or switch to a call. We will continue in chat as it is most suitable way for now to connect..."));

                // Deduct WhatsApp Message credits
                try {
                    const globalConn = await getClientDbConn(process.env.DEFAULT_DB_NAME);
                    const clientAdminUserId = (this.req.user.originalRole || this.req.user.role) === "client_admin" ? this.req.user._id || this.req.user.sub : this.req.user.client;
                    await globalConn.models.ClientAdmin
                        .findOneAndUpdate(
                            { user: clientAdminUserId, isArchived: false },
                            { $inc: { totalCallCount: 1, totalWaMsgCount: 1 } }
                        )
                        .exec();
                } catch (err) {
                    console.log(`❌ [${this.callUUID}][initWhatsAppConv] Failed to increment totalCallCount:`, err);
                }

                finalRes = {
                    ok: true,
                    code: 201,
                    message: "WhatsApp conversation initiated successfully...",
                    details: {
                        waUUID: this.waUUID,
                    }
                };
            } else {

                finalRes = {
                    ok: true,
                    code: 200,
                    message: "WhatsApp conversation already exists...",
                    details: {
                        waUUID: this.waUUID,
                    }
                };
            }
        }

        return finalRes;
    }

    async onWhatsAppMessage(waMsg, notUser = false, waAPI = undefined) {
        if (!waMsg?.trim?.() && !notUser) {
            return;
        }

        let isFirstMsgOfConv = !this.waUUID;

        if (isFirstMsgOfConv) {
            await this.initWhatsAppConv(true);
        }

        if (waMsg || notUser) {
            if (waMsg) {
                this.waClassLevelConv.messages.push(withTime(user, waMsg));
                console.log(`[${this.waUUID}] WhatsApp msg recevied: "${waMsg}"`);
            }

            const assistantText = await this.generateOpenAIResponse(this.waClassLevelConv);
            console.log(`[${this.waUUID}] Message towards WhatsApp: "${assistantText}"`);

            this.waClassLevelConv.messages.push(withTime(assistant, assistantText));

            const templateName = this.callUUID ? "candidate_reconnect_whatsapp_v2" : "candidate_followup_context_v2";
            const templateOptions = {
                clientOrId: `${this.req.client}`,
                sentByService: "AI Screening Call",
                nextActionExpected: "Reply to conversation: " + this.waUUID,
                languageCode: process.env?.WHATSAPP_TEMPLATE_LANGUAGE_CODE || "en",
                variables: {
                    body: {
                        CandidateFirstName: this.candidateFirstName || "",
                        JobTitle: this.job?.title || "",
                        CompanyName: this.company?.name || "",
                        JobLocation: (this?.job?.locations || [])?.join(", ") || "",
                    }
                },
            };

            (waAPI && isFirstMsgOfConv) && await waAPI?.sendTemplateMessage?.((this.toNumber || "")?.slice(1), templateName, templateOptions);
            waAPI && await waAPI?.sendTextMessage?.((this.toNumber || "")?.slice(1), assistantText, `${this.req.client}`, "AI Screening Call", "Reply to conversation: " + this.waUUID);

            (async () => {
                this.waMsgReplyTimeout && clearTimeout(this.waMsgReplyTimeout);
                this.waMsgReplyTimeout = setTimeout(() => {
                    this.endWhatsAppCoversation();
                }, 30 * 1000);

                const conv = await this.req.conn.models.Conversation
                    .findOneAndUpdate(
                        { ...this.convUniqueFilter, callUUID: this.waUUID, isArchived: false },
                        {
                            messages: this.waClassLevelConv.messages,
                        }
                    )
                    .exec();
                console.log(
                    "onWhatsAppMessage:: WhatsApp Conversation saving to: \n", conv?._id, "\n"
                );

            })();

            return assistantText;
        }
    }

    async endWhatsAppCoversation() {
        const conv = await this.req.conn.models.Conversation
            .findOneAndUpdate(
                { ...this.convUniqueFilter, callUUID: this.waUUID, isArchived: false },
                {
                    messages: this.waClassLevelConv.messages,
                }
            )
            .exec();

        console.log(
            "WhatsApp Conversation updated successfully... \n", conv?._id, "\n"
        );

        // Update ATS/candidate from conversation
        if (conv?._id) {
            const allMsgs = (this?.classLevelConv?.messages || []).concat(this.waClassLevelConv?.messages || []);

            await updateCandidateFromConversation(conv._id, this.req, this.waUUID, (allMsgs?.length > 0 ? allMsgs : undefined));
        }
    }
}
