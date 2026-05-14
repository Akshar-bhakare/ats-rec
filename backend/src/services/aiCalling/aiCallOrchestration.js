import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client as PlivoClient, Response as plivoResponse } from "plivo";
import { Agent, run as runOpenAIAgent, system, user, assistant } from '@openai/agents';
import {
    // v1 as sttVersion,
    v1p1beta1 as sttVersion,
    protos,
} from '@google-cloud/speech';
import { DeepgramClient } from '@deepgram/sdk';

import { isAICallCreditsExausted } from "../../utils/aiCallCredits.js";
import { chatCompletionByOpenAI, loadOpenAIConfigFromDB } from "../../utils/aiChatCompletions.js";
import { loadKeysConfigFromDB } from "../../utils/dbUtils.js";
import { isAllowedCallingHourIST } from "../../utils/timeUtils.js";
import { getCurrentDateAndTime, hangup_call, rescheduleCallAsPerUserAvailablity } from "./aiCallAgentTools.js";
// import universalTextToSpeech from "../../utils/googleTTSAndSTTUtils.js";
import universalTextToSpeech from "../../utils/openaiTTS.js";
import { getDownloadURL, uploadBufferToFirebase } from '../../utils/firebaseUtils.js';
import { writeWavHeader } from '../../utils/fileIOUtils.js';
import updateCandidateFromConversation from '../updateCandidateFromConversation.js';
import { tmpMediaDir } from '../../../server.js';
import JobService from '../jobService.js';
import { getClientDbConn } from '../../utils/clientDbUtils.js';
import RelevancyService from '../relevancyService.js';

dotenv.config();



const speechClient = new sttVersion.SpeechClient();
const deepgramClient = new DeepgramClient({
    apiKey: process.env.DEEPGRAM_API_KEY,
});

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

export const saveWavRecording = (buffers, callUUID, sampleRate = 8000) => {
    const outputFile = path.join(tmpMediaDir, `${callUUID}.wav`);
    const pcmLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const wavHeader = writeWavHeader(pcmLength, sampleRate);
    const finalBuffer = Buffer.concat([wavHeader, ...buffers]);
    fs.writeFileSync(outputFile, finalBuffer);
    return outputFile;
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
    static speakingRate = 0.99;
    static modelName = process.env?.OPENAI_MODEL || "gpt-5-nano";
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
        if (!this.callAIAgent) {
            this.callAIAgent = new Agent({
                name: 'Interview Screening Call AI Agent',
                instructions: `You are an **AI Recruiter**(${this.script?.gender?.toLowerCase() === "male" ? 'Named "John", a male' : 'Named "Layla", a female'} ai recruiter) conducting a real-time phone call with an **Indian candidate** about a job opening (as described in the provided script). Follow these instructions strictly to conduct the call.

**Tone and Behavior**
    - Act exactly like a **professional Indian recruiter**.
    - Sound genuinely warm and engaging — use natural conversational fillers such as "I see," "Hmm, alright," "Oh okay," "Great," "That's wonderful to hear," "I understand," "Let's see then…" where appropriate.
    - Listen attentively and encourage the candidate to apply.
    - Do **not** sound robotic; use pauses, acknowledgments, and empathy markers naturally.
    - Always remain polite, conversational, and professional, with a friendly tone that helps the candidate feel comfortable.
    - Use the candidate's name occasionally (mainly at greeting and key moments), but do **not** repeat their name in every question.

**Question Handling**
    - **Strictly** make sure you ask **only one question at a time** to the candidate.
    - Treat the script as a **screening checklist**, not a detailed technical interview.
    - You must treat the "Screening script" content as the **only allowed source of questions**.
        - Every question you ask must clearly map to a specific line or topic already present in the script.
        - You may shorten or simplify the wording into a lighter screening-style question, but you may **not add any new data points or topics** that are not present in the script.
        - If you are unsure whether a question is in the script, do **not** ask it.
    - Convert any long, descriptive, or multi-part questions from the script into **short screening-style questions** that can be answered with:
        - a brief 1-2 line summary, or
        - a simple yes/no, or
        - a short factual or numeric answer (for example, years of experience, notice period, CTC, city, etc.).
    - Do **not** ask for detailed project walkthroughs, case studies, long stories, or "end-to-end" examples **unless that exact intent is explicitly present in the script line itself**. Even then, keep it short and screening-focused.
    - At the start of the call, confirm **once** that you are speaking with the correct candidate based on the provided data. Do **not** re-confirm their name later unless the candidate explicitly indicates confusion or someone else has answered the call.
    - Do **not** move to the next question until you receive an answer to the previous one, but do not repeat an unanswered question more than once; if they seem stuck, gently ask for their answer instead of re-reading the full question again and again.
    - Do **not** continue the conversation if you find that the candidate has no experience in any of the required skills. At least one required skill must be present to proceed. If not, end the conversation and call politely.
    - When you ask for brief answers, allow the user to finish their thought. They may need multiple messages to complete their response.
    - Always confirm the candidate's answer before proceeding to the next question — explicitly mention their response before asking the next.
    - Never repeat a question once the candidate has already answered it.
    - **Very strict rule:** Ask only the questions included in the provided script (possibly simplified into screening form), and cover all topics from it **in order**. Do not introduce unrelated topics and do not invent new follow-up questions beyond what the script already contains.
    - If the candidate asks something outside the script, you can answer briefly, but then you must return to the next question from the script without creating extra off-script questions.
    - Complete the script **in sequence** and keep the overall conversation **short and focused** while still covering all the scripted points.
    - Whenever you mention the job location, **always mention the company name first**.
    - Ask about each skill experience through **separate questions**, but do not ask the same skill or experience question in multiple different ways.
    - When discussing compensation, always refer to it in terms of **"Lakh Per Annum (LPA)"**.

**Call Management**
    - At the beginning of the call (or when resuming after a genuine disconnection), politely check **once** if it is a good time to talk (for example: "Is this a good time to talk?").
    - Do **not** repeatedly ask "Are you free?", "Do you have time?", or other availability questions again and again once the candidate has confirmed they are available.
    - Wait for the candidate's response to each question before proceeding.

    - **Exit intent detection (not interested / not available / goodbye):**
        - Treat any clear "end" or "not interested / not available" signal as an **exit intent**. This includes phrases such as (but not limited to): 
            - "I am not interested", "not interested", "no, I don't want this", 
            - "I'm not available", "I'm busy", "don't call", "stop calling", 
            - "call me later", "maybe later", "not right now", 
            - "bye", "bye Layla", "thank you, that's all", or any similar wording in any language expressing that the candidate wants to end or postpone the call.
        - When you detect an exit intent at any point in the call (including during the closing), you must **not** continue with the long script or ask multiple closing questions.

    - **Single confirmation after exit intent (Reschedule vs Not Interested):**
        - After detecting an exit intent, ask **exactly one** short clarifying question, such as:
            - "Just to confirm, would you like to reschedule this conversation for later, or should I mark you as not interested in this opportunity?"
        - Then:
            - If the candidate clearly chooses **not interested**:
                - Briefly acknowledge their decision.
                - Thank them for their time.
                - Say a short closing sentence that **includes the word "goodbye"**.
                - Use the **hangup_call** tool to end the call.
                - Do **not** ask for preferred times, convenience, or any additional questions after that.
            - If the candidate clearly chooses to **reschedule**:
                - Ask once for their **preferred date and time**.
                - Call the **rescheduleCallAsPerUserAvailablity** tool with that information.
                - Confirm the rescheduled slot in **one short sentence**.
                - Then thank them and close with a short sentence that **includes the word "goodbye"**.
                - Use the **hangup_call** tool to end the call.
            - If the candidate stays vague after the confirmation question (for example, "we'll see", "not now", "later maybe" without a clear reschedule time), treat this conservatively as **not interested**:
                - Politely say you will mark them as not interested.
                - Thank them and close with "goodbye".
                - Use the **hangup_call** tool to end the call.
        - Once this confirmation flow has started, do **not** go back to the main screening script or ask any new screening questions.

    - If the candidate is busy or explicitly asks to reschedule **before** you have asked any serious screening questions:
        - Acknowledge that they are busy.
        - Ask once for a convenient date and time.
        - Call **rescheduleCallAsPerUserAvailablity**.
        - Confirm the new schedule briefly.
        - Close politely with "goodbye" and use **hangup_call** to end the call.
        - Do not continue with the screening script in that call.

    - At the end of the call, give a brief summary of the conversation **only if the candidate has not already triggered the exit intent flow above**.
    - Clearly indicate when the call is ending, and include the word **'goodbye'** in your final message, as this word is required for call-end detection. Regardless of the language being used, always include 'goodbye'.
    - On call-end detection, you must hang up the call by using the appropriate tool.
    - At the end of the call (after completing the script or after any termination condition), give a brief summary of the conversation.

**Interest Checklist**
    - Use the interest-confirmation questions provided in the script.
    - Ask about job interest or job change **once clearly** and do not re-ask the same thing in different words if the candidate has already answered.
    - If the candidate is **not interested**, or if they use any wording that clearly communicates that they want to end the conversation (for example, "I'm not interested", "Bye Layla", "Please don't call me for this role", "I'm not available for this opportunity"), treat it as an **exit intent**:
        - Follow the **Single confirmation after exit intent (Reschedule vs Not Interested)** flow defined in the Call Management section.
        - Do **not** continue the long closing script asking again for convenient time once they have confirmed their choice.
    - If the candidate **is interested**, proceed as per the script (in screening style).
    - If the candidate asks for more details, briefly explain the **job responsibilities or description**, then proceed to screening questions.

**Experience and Range Validation**
    - When the candidate mentions their total experience, compare it with the job's required range (given in the script).
    - If their experience is **over 2 years below or above** the range, inform them and ask if they still wish to proceed.

**Salary and Notice Period Guidelines**
    - If the candidate asks about compensation, state the **maximum budget** given in the script.
    - After learning the candidate's notice period:
        - If it's **30 days or less**, ask why.
        - Otherwise, ask whether it is **negotiable**.

**Conditional Follow-Up Questions**
    Ask **one follow-up question** in each of the following cases:
        - If the candidate's **expected salary increase** exceeds 30% of their current salary, ask them to explain the reason (briefly).
        - If the **notice period** is 30 days or less, ask whether they have already resigned, are on the bench, have written approval for early joining, or any other reason.
        - If the candidate is **serving notice**, ask for their **final working day**.
        - If the candidate has another **active offer**, ask for the offered **compensation and company name**.

**Fallback Handling**
    If the candidate's response is unclear or they ask for clarification:
        - Politely prompt for more details, or
        - Ask them to repeat or rephrase their answer, or
        - Offer to pause briefly while they gather information, or
        - Reassure them that someone will follow up with the next steps.

**General but important Guidelines**
    - Respond in **plain text**, as if speaking. Do **not** use Markdown formatting or any type of emoji.
    - Stay strictly in the **recruiter role**; never respond as the candidate.
    - Use references from previous conversations when available.
    - Do **not** skip any question (including conditional ones) until answered.
    - Skip only those questions that have already been answered in this or a previous conversation, and briefly inform the candidate about what has already been covered.
    - Do **not** repeatedly reconfirm the candidate's name or availability once they have confirmed it.
    - Keep your response summaries and explanations **concise** (aim for around 60-100 words), unless the candidate explicitly asks for more details.
    - Always detect the candidate's language automatically from their replies and switch accordingly.
    - If the user switches to or requests another language, then you must respond in that language.
    - Follow **all instructions consistently**. Do not deviate, restart, or provide off-topic information.

**Tooling Instructions**
    - Use **rescheduleCallAsPerUserAvailablity** whenever the candidate clearly agrees to reschedule and provides a preferred time.
    - Use **hangup_call** whenever:
        - The screening process or conversation is completed, or
        - The call has been rescheduled, or
        - The candidate chooses "not interested", or
        - You detect any final "goodbye" / "end" condition as per the exit-intent rules.
    - In all of these cases, after a short polite closing that includes "goodbye", you must end the call.

**For your Reference:**
    - Screening script:
    \`\`\`${this.script.content}\`\`\`

    - Job Description:
        - In Short:
            \`\`\`${this.job?.shortDescription || "Unavailable at the moment."}\`\`\`

        - After providing the job description, get confirmation that they have understood the information.

    - Company overview:
        \`\`\`${this.company?.name || "(Company Name not available)"}: ${this.company?.description || "Search the internet and must summarize in 1 to 2 lines"}\`\`\`

    - Company's FAQ:
        \`\`\`${this.company?.faq || "Search the internet and must summarize in 1 to 2 lines"}\`\`\`

    - Company's Policy: 
        \`\`\`${this.company?.policy || "Search the internet and must summarize in 1 to 2 lines"}\`\`\`
`,
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
        if (this.callGlobalState === 'listening' && this.areYouThereAudioBuffer) {
            this.classLevelConv.messages.push(withTime(assistant, "Are you still there?"));
            this.recognizeStream?.destroy?.();

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
                        this.callRecordingStreamBuffers.push(this.areYouThereAudioBuffer);
                        this.callGlobalState = 'speaking';

                        const durationSeconds = this.areYouThereAudioBuffer.length / AiCallManager.audioSampleHtz;
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

        this.sendPlivoPlayStop(false);

        pauseMiliSeconds =
            typeof pauseMiliSeconds === 'number' && pauseMiliSeconds > 0
                ? pauseMiliSeconds
                : (audioBuffer.length / AiCallManager.audioSampleHtz) * 1000;

        this.pendingHangupTimeout && clearTimeout(this.pendingHangupTimeout);

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
                    this.callRecordingStreamBuffers.push(audioBuffer);
                    this.callGlobalState = 'speaking';

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

        const MIN_GAP_MS = 60;
        const COMPENSATE_MS = 200;

        const effectiveWaitMs = Math.max(
            MIN_GAP_MS,
            pauseMiliSeconds - COMPENSATE_MS
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

    async init(candidateId, jobId, req) {
        try {
            AiCallManager.installGracefulShutdownHandlers();

            // During deployment drain, do not start NEW production calls.
            if (AiCallManager.isDraining && !(req?.query?.callUUID || "")?.includes?.('call_simulation')) {
                throw new Error(`${AiCallManager.name} is in drain mode (deployment in progress). Please retry shortly.`);
            }

            this.req = req;
            this.jobId = jobId;
            this.candidateId = candidateId;

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

                // Compose candidate phone number
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

                return {
                    ok: true,
                    code: 200,
                    message: "Class initiated successfully...",
                };
            } else {
                throw new Error(AiCallManager.name + " was blocked from initiation as it goes beyond time limit, we can not initiate calls after 08:00 PM, now time: " + new Date() + "...");
            }

        } catch (err) {
            console.log("❌ Error during initiating " + AiCallManager.name + ": ", err);
            return {
                ok: false,
                code: 400,
                message: err?.message || "Class failed to initiate...",
                details: {
                    error: err
                },
            };
        }
    }

    async triggerCall() {
        let finalRes;

        if (AiCallManager.isDraining && !this.req.query?.callUUID?.includes?.('call_simulation')) {
            return {
                ok: false,
                code: 503,
                message: "Service is in deployment/drain mode. Please retry shortly.",
            };
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

        return finalRes;
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

            this.conversation = await this.req.conn.models.Conversation.findOne(this.convUniqueFilter).lean().exec();
            if (!this.conversation) {
                classLevelConv = {
                    candidateId: this.candidateId,
                    jobId: this.jobId,
                    callUUID,
                    mobile_num: this.toNumber,
                    messages: con_msgs,
                    ...this.convUniqueFilter,
                    client: this.req.client,
                };

                this.req.conn.models.Conversation.create(classLevelConv)
                    .then(res => {
                        this.conversation = res;
                        classLevelConv._id = this.conversation._id;

                        if (callUUID?.includes?.('wa_conv_____')) {
                            this.req.conn.models.Conversation
                                .findOneAndUpdate(
                                    { ...this.convUniqueFilter, callUUID: callUUID.replace("wa_conv_____", ""), isArchived: false },
                                    { whatsappConvId: this.conversation._id }
                                )
                                .exec();
                        }
                    });

            } else {
                classLevelConv = { ...this.conversation };
                // ✅ load messages from DB conversation (important after restart)
                classLevelConv.messages = (this.conversation.messages || []).filter?.(ele => Boolean(ele?.content)) || [];
            }

            // ✅ For demo call: only reset messages on first creation, not on reconnect/reload
            if (callUUID?.includes?.('call_simulation') && !this.conversation) {
                classLevelConv.messages = con_msgs;
            }

            // if (classLevelConv.messages.length === 1) {

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


            if (classLevelConv.messages.length > 1) {
                classLevelConv.messages.push(withTime(system, "You're reconnected(SILENTLY) with candidate, and in middle of conversation, now continue the conversation..."));
            }

            if (!(callUUID || {})?.includes("wa_conv_____")) {
                // (async () => {
                let fullAssitantText = "";
                this.firstResponseKey = `${Date.now()}`;
                this.callResState = { [this.firstResponseKey]: [] };

                for await (const assistantText of this.generateOpenAIResponseStream(classLevelConv)) {
                    console.log(`[${this.callUUID}] AI Response chunk: \`${assistantText?.replaceAll?.(".", ". ")}\`... `);
                    if (!(this.firstResponseKey in this.callResState)) {
                        this.callResState = {};
                        break;
                    }

                    if (!assistantText) {
                        console.log(
                            "Continued AI response: ", assistantText,
                        );

                        continue;
                    }

                    if ((assistantText || "")?.trim?.()) {

                        const audioPreparationPromise = (async () => {
                            const ttsStart = Date.now();
                            const audioBuffer = await universalTextToSpeech(
                                assistantText.replaceAll(".", ". "),
                                this.script?.language || 'en-IN',
                                this.script?.gender || 'FEMALE',
                                this.script?.voiceModel || 'en-IN-Chirp-HD-F',
                                AiCallManager.audioEncoding,
                                AiCallManager.audioSampleHtz,
                                AiCallManager.speakingRate,
                            );
                            const ttsEnd = Date.now();
                            const pauseMiliSeconds = (audioBuffer.length / AiCallManager.audioSampleHtz) * 1000;
                            return { audioBuffer, pauseMiliSeconds, ttsStart, ttsEnd };
                        })();

                        this.callResState[this.firstResponseKey].push({ assistantText, audioPromise: audioPreparationPromise });

                        fullAssitantText += " " + (assistantText || "")?.trim();
                    }
                }

                classLevelConv.messages.push(withTime(assistant, fullAssitantText));
                this.req.conn.models.Conversation
                    .findOneAndUpdate(
                        { ...this.convUniqueFilter, isArchived: false },
                        {
                            messages: classLevelConv.messages,
                        }
                    )
                    .exec();
                // })();
            }


            // if (!(callUUID || {})?.includes("wa_conv_____")) {
            //     if (!this.firstMsgAudioBuffer) {
            //         const assistantText = await this.generateOpenAIResponse(classLevelConv);

            //         classLevelConv.messages.push(withTime(assistant, assistantText));

            //         console.log(
            //             "\n this.firstMsgAudioBuffer msg: ", assistantText
            //         );
            //         this.firstMsgAudioBuffer = await universalTextToSpeech(
            //             assistantText || "Please wait, we're processing things.",
            //             this.script.language || 'en-IN',
            //             this.script?.gender?.toUpperCase() || 'FEMALE',
            //             this.script.voiceModel || 'en-IN-Chirp-HD-F',
            //             AiCallManager.audioEncoding,
            //             AiCallManager.audioSampleHtz,
            //             AiCallManager.speakingRate,
            //         );
            //         this.firstMsgAudioText = assistantText;
            //     }
            // }

            // }

            // // ✅ FIX: After server restart, in-memory firstMsgAudioBuffer is lost.
            // // If conversation already exists, rebuild it from the last assistant message
            // // so WS connect immediately plays audio (no need to wait for user speech).
            // if (!this.firstMsgAudioBuffer && !(callUUID || {})?.includes("wa_conv_____")) {
            //     try {
            //         classLevelConv.messages.push(withTime(system, "You're reconnected(SILENTLY) with candidate, and in middle of conversation, now continue the conversation..."));

            //         const assistantText = await this.generateOpenAIResponse(classLevelConv);

            //         classLevelConv.messages.push(withTime(assistant, assistantText));


            //         let replayText = assistantText;

            //         // let replayText = lastAssistantMsg
            //         //     ? (Array.isArray(lastAssistantMsg.content) ? lastAssistantMsg.content?.[0]?.text : lastAssistantMsg.content)
            //         //     : null;

            //         // Avoid replaying goodbye which can trigger hangup flows.
            //         if (replayText?.toLowerCase?.().includes?.("goodbye")) replayText = null;

            //         if (replayText) {
            //             this.firstMsgAudioText = replayText;
            //             this.firstMsgAudioBuffer = await universalTextToSpeech(
            //                 replayText || "Please wait, we're processing things.",
            //                 this.script.language || "en-IN",
            //                 this.script?.gender?.toUpperCase() || "FEMALE",
            //                 this.script.voiceModel || "en-IN-Chirp-HD-F",
            //                 AiCallManager.audioEncoding,
            //                 AiCallManager.audioSampleHtz,
            //                 AiCallManager.speakingRate
            //             );
            //         }
            //     } catch (e) {
            //         console.log(
            //             `[${AiCallManager.name}][${this.initiateConversation.name}] Failed to rebuild firstMsgAudioBuffer:`,
            //             e?.message || e
            //         );
            //     }
            // }


            (async () => {
                if (!this.areYouThereAudioBuffer && !(callUUID || {})?.includes("wa_conv_____")) {
                    this.areYouThereAudioBuffer = await universalTextToSpeech(
                        "Are you still there?",
                        this.script.language || 'en-IN',
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


    async answerCall(callUUID) {
        if (!callUUID || this.callUUID !== callUUID) {
            return '<?xml version="1.0" encoding="UTF-8"?><Response><Speak>Invalid call information. Goodbye.</Speak></Response>';
        }

        if (!this.callUUID || this.callUUID !== callUUID) {
            console.log(
                `[AiCallManager.answerCall] Syncing callUUID. Old: ${this.callUUID}, New (Plivo): ${callUUID}`
            );
            this.callUUID = callUUID;
        }

        this.recognizeStreamCreator()
            .then(() => {
                this.recognizeStream?.pause?.();
                this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
            });

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

        let pauseMiliSeconds;

        // If it's the very first message, send a greeting / AI-start
        if (this.firstMsgAudioBuffer) {
            pauseMiliSeconds = (this.firstMsgAudioBuffer.length / AiCallManager.audioSampleHtz) * 1000;

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
                        this.callRecordingStreamBuffers.push(this.firstMsgAudioBuffer);
                        this.callGlobalState = 'speaking';

                        this.callListenerTimeOut && clearTimeout(this.callListenerTimeOut);
                        this.callListenerTimeOut = setTimeout(() => {
                            this.checkUserWithUs();
                        }, pauseMiliSeconds + AiCallManager.userOnCallCheckTimeMs);
                        const resKey = Date();
                        this.callResState = { [resKey]: [] };
                    }
                }
            );

            console.log(
                "pauseMiliSeconds: ", pauseMiliSeconds,
            );

        } else if (this.firstResponseKey) {
            if (this.respondSequentiallyRunning === false && this.firstResponseKey in this.callResState) {
                this.respondSequentially(this.firstResponseKey);
            }

        }

        if (pauseMiliSeconds) {
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

                if (pcm.length) {
                    this.userStreamBuffers.push(pcm);
                    this.callRecordingStreamBuffers.push(pcm);
                }

            } catch (err) {
                console.log(`[${this.callUUID}] ❌ Error writing to recognize stream:`, err);
                throw new Error(`[${this.callUUID}] ❌ Error writing to recognize stream...`);
            }
        }
    }

    async recognizeStreamCreator(lastPCMMediaIndex = null) {
        try {
            try {
                if (!this.recognizeStream) {
                    this.recognizeStream = await deepgramClient.listen.v1.connect({
                        model: "nova-3",
                        language: "multi",
                        smart_format: true,
                        interim_results: true,
                        encoding: AiCallManager.audioEncoding?.toLowerCase(),
                        sample_rate: AiCallManager.audioSampleHtz,
                    });

                    this.recognizeStream.on('message', (data) => {
                        if (data?.type !== 'Results' || !data.channel?.alternatives?.[0]) return;
                        if (!data.channel?.alternatives[0]) return;
                        const transcript = data.channel.alternatives[0].transcript.trim();
                        if (!transcript) return;

                        this.isFinalSpeech = data?.speech_final;

                        console.log(
                            "\n transcript: ", transcript,
                            "\n data?.is_final: ", data?.is_final,
                            "\n data?.speech_final: ", data?.speech_final,
                        );

                        this.lastIsFinalTranscr = transcript;

                        if (data?.is_final && !data?.speech_final) {
                            if (!this.lastIsFinalAt) {
                                this.lastIsFinalAt = Date.now();

                                this.lastIsFinalAtTimeout && clearTimeout(this.lastIsFinalAtTimeout);
                                this.lastIsFinalAtTimeout = setTimeout(() => {
                                    this.onTranscript(this.lastIsFinalTranscr, true);
                                    this.lastIsFinalAt = undefined;
                                    this.isFinalSpeech = false;
                                    console.log(
                                        "Proceeding with is_final result as " + (this.isFinalSWaitTimeout + 200) + " ms passed..."
                                    );

                                }, this.isFinalSWaitTimeout + 200);

                            } else if ((Date.now() - this.lastIsFinalAt) > this.isFinalSWaitTimeout) {
                                this.isFinalSpeech = true;
                                this.lastIsFinalAt = undefined;
                                this.lastIsFinalAtTimeout && clearTimeout(this.lastIsFinalAtTimeout);
                            }
                        }

                        if (this.isFinalSpeech) {
                            this.lastIsFinalAt = undefined;
                            this.lastIsFinalAtTimeout && clearTimeout(this.lastIsFinalAtTimeout);
                            this.isFinalSpeech = false;
                            this.onTranscript(transcript, true);
                        }
                    });

                    this.recognizeStream.write = (audioBuffer) => {
                        this.recognizeStream.sendMedia(audioBuffer);
                    };
                    this.recognizeStream.end = () => {
                        this.recognizeStream?.close?.();
                    };
                    this.recognizeStream.destroy = () => {
                        this.recognizeStream?.close?.();
                    };
                    this.recognizeStream.connect?.();
                    await this.recognizeStream.waitForOpen?.();
                }
            } catch (error) {
                console.log(
                    "STT stream creation fallback to Google STT..."
                );

                this.recognizeStream = speechClient
                    .streamingRecognize({
                        config: {
                            encoding: protos?.google?.cloud?.speech?.[sttVersion]?.RecognitionConfig?.AudioEncoding?.[AiCallManager.audioEncoding] || AiCallManager.audioEncoding,
                            sampleRateHertz: AiCallManager.audioSampleHtz,
                            languageCode: 'en-IN',
                            model: 'telephony_short',
                        },
                        interimResults: true,
                        singleUtterance: true,
                    });

                this.recognizeStream
                    .on('data', async (data) => {
                        if (!data.results[0]?.alternatives[0]) return;
                        const transcript = data.results[0].alternatives[0].transcript.trim();
                        if (!transcript) return;

                        const isFinal = data.results[0].isFinal || data.results[0].stability === 0;
                        this.onTranscript(transcript, isFinal);
                    });
            }

            this.recognizeStreamCreatedAt = new Date().getTime();

            this.recognizeStreamTimeout && clearTimeout(this.recognizeStreamTimeout);
            this.recognizeStreamTimeout = setTimeout(() => {
                this.recognizeStream?.destroy?.();
            }, this.streamTimeoutMs);

            this.recognizeStream.on('metadata', metadata => {
                console.log('📡 Stream opened with metadata: ', metadata);
            });

            this.recognizeStream
                .on('error', error => {
                    if (!error?.message?.includes?.("Audio Timeout Error:")) {
                        console.log(`[${this.callUUID}] ❌ Recognize stream error:`, error.message);
                    }
                })
                .on('end', (res = null) => {
                    console.log(`[${this.callUUID}] Recognize stream ended`);
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
        if (this.recognizeStreamTimeout) {
            clearTimeout(this.recognizeStreamTimeout);
        }

        if (this.pendingHangupTimeout) {
            clearTimeout(this.pendingHangupTimeout);
            delete this.pendingHangupTimeout;
        }

        if (this.callGlobalState === 'speaking') {
            this.stateTimeOut && clearTimeout(this.stateTimeOut);
            this.sendPlivoPlayStop();
            this.classLevelConv.messages.push(withTime(system, "For your information: Your previous response sent to candidate, was interrupted by candidate. May they want to ask something else."));
            this.callGlobalState = 'interrupted';
            this.callResState = {};
        }

        if (isFinal && transcript) {

            this.recognizeStream?.destroy?.();

            if (this.callGlobalState !== 'interrupted') this.callGlobalState = 'listening';

            if (this.callListenerTimeOut) {
                clearTimeout(this.callListenerTimeOut);
                delete this.callListenerTimeOut;
            }

            this.callGlobalState = 'processing';

            try {
                this.classLevelConv.messages.push(withTime(user, transcript));
            } catch (err) {
                console.log(
                    "Error in saving user message: ", err
                );
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

                for await (const assistantText of this.generateOpenAIResponseStream(this.classLevelConv)) {
                    console.log(`[${this.callUUID}] AI Response chunk: \`${assistantText.replaceAll(".", ". ")}\`... `);
                    if (!(responseKey in this.callResState)) {
                        this.callResState = {};
                        break;
                    }

                    if ((assistantText || "")?.trim()) {

                        const audioPreparationPromise = (async () => {
                            const ttsStart = Date.now();
                            const audioBuffer = await universalTextToSpeech(
                                assistantText.replaceAll(".", ". "),
                                this.script?.language || 'en-IN',
                                this.script?.gender || 'FEMALE',
                                this.script?.voiceModel || 'en-IN-Chirp-HD-F',
                                AiCallManager.audioEncoding,
                                AiCallManager.audioSampleHtz,
                                AiCallManager.speakingRate,
                            );
                            const ttsEnd = Date.now();
                            const pauseMiliSeconds = (audioBuffer.length / AiCallManager.audioSampleHtz) * 1000;
                            return { audioBuffer, pauseMiliSeconds, ttsStart, ttsEnd };
                        })();

                        this.callResState[responseKey].push({ assistantText, audioPromise: audioPreparationPromise });

                        fullAssitantText += " " + (assistantText || "")?.trim();

                        if (resCnt === 0 || (this.respondSequentiallyRunning === false && responseKey in this.callResState)) {
                            this.respondSequentially(responseKey);
                            ++resCnt;
                        }
                    }
                }

                this.classLevelConv.messages.push(withTime(assistant, fullAssitantText));
                this.req.conn.models.Conversation
                    .findOneAndUpdate(
                        { ...this.convUniqueFilter, isArchived: false },
                        {
                            messages: this.classLevelConv.messages,
                        }
                    )
                    .exec();
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

        let audioBuffer;
        try {
            const localWavPath = saveWavRecording(this.callRecordingStreamBuffers, this.callUUID, AiCallManager.audioSampleHtz);
            audioBuffer = fs.readFileSync(localWavPath);

            if (audioBuffer?.length) {
                const firebasePath = `aiCallAudios/${this.callUUID}.wav`;
                await uploadBufferToFirebase(audioBuffer, firebasePath, AiCallManager.audioContentType || 'audio/wav');
                const url = await getDownloadURL(firebasePath);

                const header = audioBuffer.subarray(0, 44);
                const sampleRate = header.readUInt32LE(24);
                const byteRate = header.readUInt32LE(28);
                const dataChunkSize = header.readUInt32LE(40);
                if (!sampleRate || !byteRate || !dataChunkSize) throw new Error('Invalid WAV header');
                this.wholeCallDurationSeconds = dataChunkSize / byteRate;

                if (url) {
                    const conv = await this.req.conn.models.Conversation
                        .findOneAndUpdate(
                            { ...this.convUniqueFilter, isArchived: false },
                            {
                                audio_url: url,
                                messages: this.classLevelConv.messages,
                                durationSeconds: this.wholeCallDurationSeconds,
                            }
                        )
                        .exec();

                    console.log(
                        "Conversation updated successfully... \n", conv?._id, "\n"
                    );
                }

                try { fs.unlinkSync(localWavPath); } catch (err) {
                    console.log("❌ Error during delete audio temp file of call: ", err);
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

                // Ensure a base relevancy record exists before applying conversation updates
                const relSvc = new RelevancyService();
                await relSvc.ensurePairRelevancy({
                    client: this.req.client,
                    candidateId: this.candidateId,
                    jobId: this.jobId,
                    conn: this.req.conn,
                    user: this.req.user
                });

                // ★ Conversation-based relevancy update using Conversation DB
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
