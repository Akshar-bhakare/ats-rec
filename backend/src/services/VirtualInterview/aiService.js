// backend/src/services/VirtualInterview/aiService.js
import { chatCompletionByOpenAI } from "../../utils/aiChatCompletions.js";
import universalTextToSpeech from "../../utils/openaiTTS.js";
import { transcribeAudio } from "../../utils/googleTTSAndSTTUtils.js"; // keep ONLY if you still want Google STT here

import mongoose from "mongoose";

function now() { return Date.now(); }
function durMs(start) { return `${(Date.now() - start).toFixed(0)}ms`; }
function safeLen(x) {
    return typeof x === "string" ? x.length : (Buffer.isBuffer(x) ? x.length : 0);
}
function sampleStr(s, n = 180) {
    if (typeof s !== "string") return "(non-string)";
    const trimmed = s.replace(/\s+/g, " ").trim();
    return trimmed.length > n ? trimmed.slice(0, n) + "…" : trimmed;
}

const aiService = {

    async transcribeAudio(audioData) {
        const t0 = now();
        console.log("\n🎧 [STT] ======== Enter transcribeAudio() ========");

        try {
            console.log("🧾 [STT] Input type:", typeof audioData);
            console.log("🔢 [STT] Input length (chars):", safeLen(audioData));

            if (!audioData || typeof audioData !== "string") {
                console.warn("⚠️ [STT] Invalid audioData (missing or non-string)");
                throw new Error("Invalid audioData");
            }

            const hasPrefix = audioData.startsWith("data:audio/");
            console.log("🔎 [STT] Data URI prefix present:", hasPrefix);

            const tCall = now();
            const text = await transcribeAudio(audioData);
            console.log("🕒 [STT] Google STT duration:", durMs(tCall));

            if (!text?.trim()) {
                console.warn("⚠️ [STT] No speech detected or transcription empty");
                return "";
            }

            console.log("📝 [STT] Transcribed text length:", safeLen(text));
            console.log("📝 [STT] Transcribed text:", sampleStr(text));
            console.log("✅ [STT] Exit transcribeAudio() in", durMs(t0));
            return text;
        } catch (err) {
            console.error("❌ [STT] Error during transcription:", err?.message || err);
            console.log("🔚 [STT] Exit transcribeAudio() with error in", durMs(t0));
            throw new Error("Speech-to-Text failed");
        }
    },

    async handleTextMessage(text, req, meta = {}) {
        const t0 = now();
        const traceId =
            (req && (req.id || req.request?.id)) || `trace_${Math.random().toString(36).slice(2, 8)}`;

        console.log("\n🧠 [AI] ======== New Session —", traceId, "========");
        console.log("📥 [AI] Received text length:", safeLen(text));
        console.log("📥 [AI] Text sample:", sampleStr(text));
        console.log("📥 [AI] Meta:", JSON.stringify(meta || {}));

        if (!text || typeof text !== "string" || text.trim() === "") {
            console.warn("⚠️ [AI] Empty text received — aborting handleTextMessage()");
            throw new Error("Text input missing");
        }

        const jobTitle = meta.jobTitle || "";
        const candidateName = meta.candidateName || "";
        const technicalScript = meta.technicalScript || "";
        const jdFactsPromptBlock =
            typeof meta?.jdFactsPromptBlock === "string"
                ? meta.jdFactsPromptBlock.trim()
                : "";

        const jobContextLines = [];
        if (jobTitle) jobContextLines.push(`- Job Title: ${jobTitle}`);
        if (candidateName) jobContextLines.push(`- Candidate Name: ${candidateName}`);
        if (technicalScript) jobContextLines.push(`- Interview Script (STRICT):\n${technicalScript}`);

        const contextBlock = jobContextLines.length
            ? `
You are interviewing for this specific context:
${jobContextLines.join("\n")}

CRITICAL:
- If an Interview Script is provided, you MUST ask questions ONLY from that script.
- You may ask short clarifying follow-ups ONLY about the current script question.
- Do NOT introduce new questions/topics outside the script under any circumstances.
`.trim()
            : "";

        // NEW: Resolve conversation partition key
        let interviewType = meta.interviewType || null;
        let interviewerType = meta.interviewerType || null;
        let interviewScheduleId = meta.interviewScheduleId || null;

        // Load recent conversation so the model knows what it already asked
        let historyChat = [];
        let lastAiMessageText = "";
        try {
            const hasConvModel = req?.conn?.models?.Conversation;
            if (hasConvModel && meta.candidateId && meta.jobId) {
                const Conversation = req.conn.models["Conversation"];
                const candObjId = new mongoose.Types.ObjectId(meta.candidateId);
                const jobObjId = new mongoose.Types.ObjectId(meta.jobId);

                // If interviewType / interviewerType / schedule not provided by caller,
                // infer from latest InterviewSchedule
                if ((!interviewType || !interviewerType || !interviewScheduleId) && req?.conn?.models?.InterviewSchedule) {
                    try {
                        const InterviewSchedule = req.conn.models["InterviewSchedule"];
                        const schedule = await InterviewSchedule.findOne({
                            client: req.client,
                            candidate: candObjId,
                            job: jobObjId,
                            isArchived: false
                        })
                            .sort({ startAt: -1 })
                            .lean()
                            .exec();

                        if (schedule) {
                            interviewType = interviewType || schedule.interviewType || "Technical";
                            interviewerType = interviewerType || schedule.interviewerType || "AI";
                            interviewScheduleId = interviewScheduleId || schedule._id;
                            console.log("🧾 [AI] Resolved schedule for conversation partition:", {
                                scheduleId: String(schedule._id),
                                interviewType,
                                interviewerType
                            });
                        } else {
                            interviewType = interviewType || "Technical";
                            interviewerType = interviewerType || "AI";
                        }
                    } catch (schedErr) {
                        console.warn("⚠️ [AI] Failed to resolve InterviewSchedule:", schedErr?.message || schedErr);
                        interviewType = interviewType || "Technical";
                        interviewerType = interviewerType || "AI";
                    }
                }

                const filter = {
                    candidateId: candObjId,
                    jobId: jobObjId,
                    client: req.client,
                    interviewType: interviewType || "Technical",
                    interviewerType: interviewerType || "AI",
                    isArchived: false
                };
                if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                    filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
                }

                console.log("🔎 [AI] Loading conversation history with key:", {
                    ...filter,
                    interviewScheduleId
                });

                const conv = await Conversation.findOne(filter)
                    .select("messages")
                    .lean()
                    .exec();

                if (conv?.messages?.length) {
                    const lastMessages = conv.messages.slice(-10);

                    for (const m of lastMessages) {
                        if (m.role === "ai") {
                            const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
                            lastAiMessageText = content || "";
                        }
                    }

                    historyChat = lastMessages
                        .map((m) => {
                            const content = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
                            if (m.role === "candidate") return { role: "user", content };
                            if (m.role === "ai") return { role: "assistant", content };
                            return null;
                        })
                        .filter(Boolean);

                    console.log("🧵 [AI] Loaded history messages:", historyChat.length);
                    if (lastAiMessageText) console.log("🧵 [AI] Last AI message:", sampleStr(lastAiMessageText, 200));
                } else {
                    console.log("🧵 [AI] No previous conversation found.");
                }
            } else {
                console.log("🧵 [AI] Conversation model or ids missing, running stateless.");
            }
        } catch (histErr) {
            console.warn("⚠️ [AI] Failed to load conversation history:", histErr?.message || histErr);
        }

        const hasHistory = historyChat.length > 0;

        const interruptionBlock = lastAiMessageText
            ? `
Interruption handling rules
- The last thing you said was:
"""${lastAiMessageText}"""
- Treat the candidate's latest message as priority.
- If it's a clarification/interruption: acknowledge first, then restate the same script question simply.
- Do NOT introduce new questions until interruption is resolved.
`.trim()
            : `
Interruption handling rules
- Treat the candidate's latest message as priority.
- If it's a clarification/interruption: acknowledge first, then restate the same script question simply.
- Do NOT introduce new questions until interruption is resolved.
`.trim();

        try {
            console.log("💬 [AI] Sending to OpenAI...");

            const systemPrompt = `
You are "Hirex REC – Interviewer".

${contextBlock}
${jdFactsPromptBlock ? `\n${jdFactsPromptBlock}` : ""}

Conversation rules
- ALWAYS ask ONE question at a time. Never bundle multiple questions in a single message.
- Use SIMPLE, everyday language. Avoid jargon, technical terms, and complex words unless absolutely necessary for the role.
- Keep each question to ONE plain sentence, max 20–25 words (short and clear).
- Do NOT re-ask questions already asked.
- Use simple, common words that a non-native English speaker would easily understand.

Score/feedback guardrail
- If the candidate asks about their score, result, rating, pass/fail status, or requests feedback/evaluation, DO NOT provide it.
- Politely say scores/feedback are shared after the interview and redirect to the next question.
- Stay concise and neutral; do not hint at performance.

Strict topic control
- If the candidate asks a question unrelated to the interview topic or outside the current script question, do NOT answer it. Politely redirect them back to the interview and restate the current question.
- Exception: If the candidate asks for JD facts (salary, location, work mode, job type, role summary), answer briefly using Known Job Facts only, then continue the interview.
- If the candidate asks for the answer, hints, examples, or solutions to an interview question, refuse to provide any of these. Say only: "If you're unsure about this question, that's okay. Let's move on to the next one." Then ask the next question.
- You may rephrase the current question for clarity ONLY in simple words - do NOT provide hints, suggestions, tips, examples, or any guidance that could point toward the answer. Just restate the question in different words if needed.
${interruptionBlock}

Objectives
- Fetch and use real candidate + job data from the system before starting.
- Ask role-appropriate technical questions mapped to required skills, seniority, and responsibilities.
- Use cross-questions and why/how probes to verify depth, not memorization.
- Continuously assess communication, clarity, and role fit.
- Produce scored, evidence-backed evaluations.

Hard rules
- No hallucinations. Use only provided context, system tools, or what the candidate says.
- One question at a time. Wait for the full answer. Summarize briefly, then follow up.
- Professional, neutral, India-appropriate tone. Mirror candidate language.
- Safety & Compliance: No personal/irrelevant questions. No discriminatory content.
- Timekeeping: Prioritize must-have skills first.
- When all scripted questions are covered (or the candidate says they are done), close with: "We've covered all the questions. Please click the End Interview button to finish." Say this once at the end.

Scoring rubric (0–5 each; no half points)
- Core Skill 1 (name)
- Core Skill 2 (name)
- System Design / Architecture
- Problem-Solving / Debugging
- Code Quality & Testing Mindset
- Security/Performance Awareness
- Communication & Clarity
- Role Fit (per JD)

Guidance for turn-by-turn behaviour
- Start each new question with a question number (e.g., "Question 5:"). Do NOT show the total number of questions—only the current question number.
- If the candidate provides an answer, briefly acknowledge it in one neutral sentence (e.g., "Got it" or "I see"), then ask the next logical question or sub-part from the script.
- The script questions are already split into sub-questions (e.g., Question 5a, 5b, 5c). Ask each sub-question exactly as written — do NOT split further.
- The next question in the script may be a probe/follow-up (e.g., "why" or "how" questions) to verify depth. Ask these scripted probes as written.
- If it was an interruption or clarification request, handle that interruption fully (as per the rules above) before resuming the interview flow.
- Under NO circumstances should you provide feedback, evaluation, hints, examples, suggestions, tips, or guidance about their answer. Just acknowledge neutrally and move to the next scripted question.
- If the candidate asks for hints or help, offer: "If you're unsure, that's okay. We can move on to the next question."
- Do not jump back to earlier sections unless you need a short, specific clarification.

Response length constraints (for speed & clarity)
- Keep each turn very concise: maximum 1–2 sentences.
- Stay under ~40–50 words per response so that speech can be generated and played within 2–3 seconds.
- Always use simple, clear language that a non-native English speaker can easily understand. Only use technical terms if they are necessary for the interview. Avoid unnecessary jargon, complex words, and multi-clause sentences.


Final output guideline
- During the conversation, speak naturally and do not dump JSON.
- At the very end (when explicitly asked), output JSON rubric and a short neutral summary.

Important output rules
- Respond in plain text as if speaking; do not use Markdown formatting.
- Compulsory: Follow all these instructions consistently and do not deviate.
${hasHistory ? "\nRemember: you are in the middle of the interview, so continue from the last question you asked, but always react to the candidate's latest message first." : ""}
`.trim();

            const messages = [
                { role: "system", content: systemPrompt },
                ...historyChat,
                { role: "user", content: text },
            ];

            const tCall = now();
            const completion = await chatCompletionByOpenAI(messages, req);
            console.log("🕒 [AI] OpenAI completion duration:", durMs(tCall));

            const aiResponse = completion?.choices?.[0]?.message?.content || "";
            console.log("🔢 [AI] aiResponse length:", safeLen(aiResponse));
            console.log("🧾 [AI] aiResponse (sample):", sampleStr(aiResponse, 240));

            let finalResponse = aiResponse.trim()
                ? aiResponse.trim()
                : "I didn't quite catch that. Could you please repeat?";

            finalResponse = finalResponse.replace(/^(?:Q\s*\d+\s*[:.)-]\s*)/i, "");
            finalResponse = finalResponse.replace(/^(?:Question\s*\d+\s*[:.)-]\s*)/i, "");

            // ✅ STRICT ENFORCEMENT: FIRST AI TURN MUST START WITH GREETING
            // if (!hasHistory) {
            //     const hasGreetingAlready =
            //         /^\s*(hello|hi|hey|good\s+(morning|afternoon|evening))\b/i.test(finalResponse) ||
            //         /welcome to the interview/i.test(finalResponse);

            //     if (!hasGreetingAlready) {
            //         const name = candidateName || "there";
            //         const role = jobTitle || "role";
            //         finalResponse = `Hello ${name}, welcome to the interview for the ${role}. ${finalResponse}`.trim();
            //     }
            // }

            // Log conversation (UNCHANGED)
            try {
                if (meta.candidateId && meta.jobId && req?.conn?.models?.Conversation) {
                    const Conversation = req.conn.models["Conversation"];
                    const candObjId = new mongoose.Types.ObjectId(meta.candidateId);
                    const jobObjId = new mongoose.Types.ObjectId(meta.jobId);

                    if ((!interviewType || !interviewerType || !interviewScheduleId) && req?.conn?.models?.InterviewSchedule) {
                        try {
                            const InterviewSchedule = req.conn.models["InterviewSchedule"];
                            const schedule = await InterviewSchedule.findOne({
                                client: req.client,
                                candidate: candObjId,
                                job: jobObjId,
                                isArchived: false
                            })
                                .sort({ startAt: -1 })
                                .lean()
                                .exec();

                            if (schedule) {
                                interviewType = interviewType || schedule.interviewType || "Technical";
                                interviewerType = interviewerType || schedule.interviewerType || "AI";
                                interviewScheduleId = interviewScheduleId || schedule._id;
                            } else {
                                interviewType = interviewType || "Technical";
                                interviewerType = interviewerType || "AI";
                            }
                        } catch (schedErr) {
                            console.warn("⚠️ [AI] Failed to resolve InterviewSchedule during logging:", schedErr?.message || schedErr);
                            interviewType = interviewType || "Technical";
                            interviewerType = interviewerType || "AI";
                        }
                    }

                    const filter = {
                        candidateId: candObjId,
                        jobId: jobObjId,
                        client: req.client,
                        interviewType: interviewType || "Technical",
                        interviewerType: interviewerType || "AI",
                        isArchived: false
                    };
                    if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                        filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
                    }

                    const nowTs = new Date();
                    const scheduleKey =
                        interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)
                            ? String(interviewScheduleId)
                            : "";
                    const setOnInsert = {
                        callUUID:
                            meta.callUUID ||
                            `webrtc_${meta.jobId}_${meta.candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`,
                        interviewType: filter.interviewType,
                        interviewerType: filter.interviewerType,
                        interviewScheduleId: interviewScheduleId || null
                    };

                    console.log("🧷 [AI] Logging turn into Conversation with key:", {
                        ...filter,
                        interviewScheduleId: setOnInsert.interviewScheduleId
                    });

                    const updatedConv = await Conversation.findOneAndUpdate(
                        filter,
                        {
                            $setOnInsert: setOnInsert,
                            $push: {
                                messages: {
                                    $each: [
                                        { role: "candidate", content: text, time: nowTs },
                                        { role: "ai", content: finalResponse, time: nowTs }
                                    ]
                                }
                            }
                        },
                        { upsert: true, new: true }
                    ).exec();

                    if (updatedConv) {
                        // console.log("dY· [AI] Conversation updated:", {
                        //     conversationId: String(updatedConv._id),
                        //     messagesCount: updatedConv?.messages?.length || 0,
                        //     interviewScheduleId: updatedConv?.interviewScheduleId || null,
                        //     callUUID: updatedConv?.callUUID || null
                        // });
                    }
                }
            } catch (logErr) {
                console.warn("⚠️ [AI] Failed to log conversation turn:", logErr?.message || logErr);
            }

            console.log(`✅ [AI] Exit handleTextMessage() — ${traceId} — in`, durMs(t0));
            return finalResponse;
        } catch (err) {
            console.error("❌ [AI] Error from OpenAI:", err?.message || err);
            console.log(`🔚 [AI] Exit handleTextMessage() — ${traceId} — with error in`, durMs(t0));
            throw new Error("OpenAI text processing failed");
        }
    },

    // NEW: generate a first technical round script using candidate + job
    async generateTechnicalScript({ candidate, job, roundType }, req) {
        const t0 = now();
        console.log("\n📜 [AI] ======== Enter generateTechnicalScript() ========");
        console.log("📥 [AI] candidate (summary):", candidate ? {
            firstName: candidate.firstName,
            lastName: candidate.lastName,
            email: candidate.email
        } : null);
        console.log("📥 [AI] job (summary):", job ? {
            title: job.title,
            internalTitle: job.internalTitle,
            jobType: job.jobType,
            location: job.location,
            companyName: job.companyName,
            primarySkillsCount: Array.isArray(job.primarySkills) ? job.primarySkills.length : 0
        } : null);
        console.log("📥 [AI] roundType:", roundType);

        const candName = `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || "the candidate";
        const jobTitle = job?.title || job?.internalTitle || "the role";
        const companyName = job?.companyName || "the company";
        const primarySkills = Array.isArray(job?.primarySkills) ? job.primarySkills.join(", ") : "";
        const jobDesc = job?.description || "";

        const systemPrompt = `
You are an experienced senior technical interviewer.
Your task is to design a *first technical screening round* for a software/technology candidate.
You are preparing this script for an AI interviewer that will conduct the round.

Context:
- Candidate name: ${candName}
- Job title: ${jobTitle}
- Company: ${companyName}
- Round type: ${roundType || "First technical screening round"}
- Core skills: ${primarySkills || "Not explicitly provided. Infer reasonable skills based on job title."}
- Job description: ${jobDesc || "Not provided. Assume a typical version of this role."}

Script requirements:
1. Start with a short greeting and expectation-setting (1 short paragraph + 3–5 bullet points).
2. Divide the interview into 4 sections with headings, for example:
   - Background & role fit
   - Core technical skills
   - Problem solving & debugging
   - Collaboration, communication & closing
3. Under each section, write 4–6 concrete questions (numbered).
   - Prefer practical, scenario-based questions tied to the role.
   - Avoid pure theory unless necessary.
   - Add one follow-up question suggestion per main question in brackets like: [Follow-up: ...].
4. Add a short "Evaluation Guide" section at the end.
   - Bullet points describing what *good* answers should typically contain for this specific role/skills.
5. Tone: professional, clear, concise, and India-friendly English.
6. Time budget: design it so it can be completed in 30–40 minutes.

Output rules:
- Return ONLY the interviewer script text with headings, numbered questions and bullet points.
- Do NOT include JSON, metadata, or any out-of-character commentary.
        `.trim();

        const userPrompt = `
Generate the full interviewer script for the first technical screening round using the above instructions.
        `.trim();

        try {
            console.log("💬 [AI] Calling OpenAI for technical script generation...");
            const completion = await chatCompletionByOpenAI(
                [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt },
                ],
                req
            );

            const content = completion?.choices?.[0]?.message?.content || "";
            console.log("📜 [AI] Script length:", safeLen(content));
            console.log("📜 [AI] Script sample:", sampleStr(content, 220));
            console.log("✅ [AI] Exit generateTechnicalScript() in", durMs(t0));
            return content;
        } catch (err) {
            console.error("❌ [AI] Error in generateTechnicalScript:", err?.message || err);
            console.log("🔚 [AI] Exit generateTechnicalScript() with error in", durMs(t0));
            throw err;
        }
    },

    async speakText(text) {
        const t0 = now();
        console.log("\n🔊 [TTS] ======== Enter speakText() ========");
        console.log("🗣️ [TTS] Raw input text length:", safeLen(text));
        console.log("🗣️ [TTS] Raw input preview:", sampleStr(text));

        if (!text || typeof text !== "string" || text.trim() === "") {
            console.warn("⚠️ [TTS] Missing or invalid text for TTS.");
            throw new Error("Missing text input");
        }

        let speakChunk = text.replace(/\s+/g, " ").trim();

        const MAX_TTS_CHARS = 500;
        if (speakChunk.length > MAX_TTS_CHARS) speakChunk = speakChunk.slice(0, MAX_TTS_CHARS);

        console.log("🗣️ [TTS] Final speak chunk length:", speakChunk.length);
        console.log("🗣️ [TTS] Speak chunk preview:", sampleStr(speakChunk));

        try {
            const voice = "en-IN-Chirp-HD-F";
            console.log("🎚️ [TTS] Config → lang=en-IN | gender=FEMALE | voice=%s | enc=MP3 | rate=24000", voice);

            const tCall = now();
            const audioBuffer = await universalTextToSpeech(
                speakChunk,
                "en-IN",
                "FEMALE",
                "nova",
                "MP3",
                24000,
                1.0
            );
            console.log("🕒 [TTS] Google TTS duration:", durMs(tCall));

            const bytes = safeLen(audioBuffer);
            console.log("📦 [TTS] Audio buffer bytes:", bytes);

            if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || bytes === 0) {
                console.warn("⚠️ [TTS] Empty or invalid buffer returned by TTS");
                throw new Error("Text-to-Speech returned empty buffer");
            }

            const fingerprint = audioBuffer.subarray(0, 8).toString("hex");
            console.log("🧪 [TTS] Audio fingerprint (first 8 bytes):", fingerprint);
            console.log("✅ [TTS] Exit speakText() in", durMs(t0));
            return audioBuffer;
        } catch (err) {
            console.error("❌ [TTS] Error during speech synthesis:", err?.message || err);
            console.log("🔚 [TTS] Exit speakText() with error in", durMs(t0));
            throw new Error("Text-to-Speech failed");
        }
    },
};

export default aiService;
