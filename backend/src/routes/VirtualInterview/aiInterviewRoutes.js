import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import OpenAI from "openai";
import crypto from "crypto";
import { DeepgramClient } from "@deepgram/sdk";
import aiService from "../../services/VirtualInterview/aiService.js";
import { transcribeAudioWithDeepgram } from "../../utils/deepgramSTTUtils.js";
import InterviewScheduleService from "../../services/VirtualInterview/interviewScheduleService.js";
import { chatCompletionByOpenAI } from "../../utils/aiChatCompletions.js";
import { getDownloadURL, uploadBufferToFirebase } from "../../utils/firebaseUtils.js";
import { extractPdfText } from "../../utils/extractors/pdfTextExtracter.js";
import { getClientDbConn } from "../../utils/clientDbUtils.js";

// Fast OpenAI client for low-latency responses
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Deepgram Live client (for streaming STT over WebSocket)
const deepgramLiveClient = process.env.DEEPGRAM_API_KEY
    ? new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY })
    : null;

// Prefer a small, fast model; can be overridden via env
const FAST_INTERVIEW_MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const MAX_RECORDING_SECONDS = 300;
const MAX_RECORDING_MINUTES = MAX_RECORDING_SECONDS / 60;

const LIVE_FINALIZE_WAIT_MS = parseInt(process.env.DG_LIVE_FINALIZE_WAIT_MS || "450");
const LIVE_AUDIO_CHUNK_BYTES = parseInt(process.env.DG_LIVE_AUDIO_CHUNK_BYTES || "24000");
const DG_LIVE_LANGUAGE_AI = String(process.env.DG_LIVE_LANGUAGE_AI || "en")
    .trim()
    .toLowerCase();
const DG_LIVE_LANGUAGE_HUMAN = String(process.env.DG_LIVE_LANGUAGE_HUMAN || "multi")
    .trim()
    .toLowerCase();
const DG_PRERECORDED_LANGUAGE_AI = String(process.env.DG_PRERECORDED_LANGUAGE_AI || "en")
    .trim()
    .toLowerCase();
const DG_PRERECORDED_LANGUAGE_HUMAN = String(process.env.DG_PRERECORDED_LANGUAGE_HUMAN || "multi")
    .trim()
    .toLowerCase();
const RECORDING_TMP_DIR =
    process.env.WEBRTC_RECORDING_TMP_DIR ||
    path.join(process.cwd(), "tmp", "webrtc-recordings");

// Sentence splitter – same behavior as AiCallManager.sntnsSepRegExWithPauses
const SENTENCE_SEP = /(?<=[.!?;"')\]]+\s+)/g;

const normalizeSttLanguage = (language, fallback = "en") => {
    const normalized = String(language || "")
        .trim()
        .toLowerCase();
    return normalized || fallback || "en";
};

const resolveLiveSttLanguage = ({ disableAI, requestedLanguage } = {}) =>
    normalizeSttLanguage(
        requestedLanguage,
        disableAI ? DG_LIVE_LANGUAGE_HUMAN : DG_LIVE_LANGUAGE_AI
    );

const resolvePrerecordedSttLanguage = ({ isHumanMode, requestedLanguage } = {}) =>
    normalizeSttLanguage(
        requestedLanguage,
        isHumanMode ? DG_PRERECORDED_LANGUAGE_HUMAN : DG_PRERECORDED_LANGUAGE_AI
    );

/**
 * Active TTS streaming sessions for WebRTC AI interviewer.
 * Used to emulate call-like interruption:
 *  - When a new respondAndSpeak request comes for same candidate+job,
 *    the previous audio stream is stopped before starting the new one.
 */
const activeTtsSessions = new Map(); // key: clientId:candidateId:jobId

// Tracks whether the interview has already greeted for this sessionKey
const greetedSessions = new Map(); // key: clientId:candidateId:jobId -> boolean

// Chunked WebRTC recording uploads (server-side assembly)
const recordingUploadSessions = new Map(); // sessionId -> { filePath, mime, ext, candidateId, jobId, interviewScheduleId }

// Recent coding problems cache to avoid duplicates per client/type/difficulty
const recentCodingProblems = new Map(); // key -> { items: [{ fingerprint, title, createdAt }] }
const RECENT_CODING_PROBLEM_MAX = 8;
const RECENT_CODING_PROBLEM_TTL_MS = 1000 * 60 * 60 * 6;


const getSessionKey = (req, meta = {}) => {
    const clientId = req.client || "global";
    const candidateId = meta.candidateId || "noCandidate";
    const jobId = meta.jobId || "noJob";
    return `${clientId}:${candidateId}:${jobId}`;
};

const endTtsSession = (sessionKey, reason = "unknown") => {
    const session = activeTtsSessions.get(sessionKey);
    if (!session) return;

    session.interrupted = true;
    if (!session.ended && session.res) {
        try {
            session.res.end();
        } catch (err) {
            console.warn("[AI] Error ending previous TTS session:", reason, err?.message || err);
        }
        session.ended = true;
    }
    activeTtsSessions.delete(sessionKey);
};

/* ------------------------------
 * Blueprint helpers
 * ------------------------------ */

const clampArray = (arr, n) => (Array.isArray(arr) ? arr.slice(0, n) : []);

const detectMimeAndExt = (dataUriOrBase64, fallbackMime = "video/webm") => {
    const s = String(dataUriOrBase64 || "");
    const m = s.match(/^data:([^;]+);base64,/i);
    const mime = (m && m[1]) ? m[1].toLowerCase() : fallbackMime;
    let ext = "webm";
    if (mime.includes("mp4")) ext = "mp4";
    else if (mime.includes("ogg")) ext = "ogg";
    else if (mime.includes("wav")) ext = "wav";
    else if (mime.includes("webm")) ext = "webm";
    return { mime, ext };
};

const decodeBase64ToBuffer = (raw) => {
    const base64Str = String(raw || "");
    const cleaned = base64Str.replace(/^data:[^,]+,/, "");
    return Buffer.from(cleaned, "base64");
};

const ensureRecordingTmpDir = () => {
    if (!fs.existsSync(RECORDING_TMP_DIR)) {
        fs.mkdirSync(RECORDING_TMP_DIR, { recursive: true });
    }
};

const clampNum = (val, min, max, fallback = 0) => {
    const n = typeof val === "number" && Number.isFinite(val) ? val : fallback;
    return Math.max(min, Math.min(max, n));
};

const toNumberOrNull = (val) =>
    typeof val === "number" && Number.isFinite(val) ? val : null;

const deriveExperienceTier = ({ jobType, minYears, maxYears }) => {
    const type = String(jobType || "").trim().toLowerCase();
    if (type === "fresher" || type === "internship") return "fresher";

    const max = toNumberOrNull(maxYears);
    const min = toNumberOrNull(minYears);
    const bound = max ?? min;

    if (bound === null) return "unspecified";
    if (bound <= 1) return "fresher";
    if (bound <= 3) return "junior";
    if (bound <= 5) return "mid";
    if (bound <= 8) return "senior";
    return "lead";
};

const buildExperienceContext = (job) => {
    const minYears = toNumberOrNull(job?.experience?.min);
    const maxYears = toNumberOrNull(job?.experience?.max);
    const jobType = job?.jobType || null;
    const tier = deriveExperienceTier({ jobType, minYears, maxYears });

    return {
        jobType,
        experienceMinYears: minYears,
        experienceMaxYears: maxYears,
        experienceTier: tier,
    };
};

const safeJsonParse = (raw) => {
    if (!raw || typeof raw !== "string") return null;

    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
    try {
        return JSON.parse(cleaned);
    } catch {
        return null;
    }
};

const normalizePlainText = (val) =>
    String(val || "")
        .replace(/\s+/g, " ")
        .trim();


const normalizeProblemSignature = (val) =>
    String(val || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

const buildProblemFingerprint = (problem) => {
    const title = normalizeProblemSignature(problem?.title).slice(0, 120);
    const description = normalizeProblemSignature(problem?.description).slice(0, 400);
    if (!title && !description) return "";
    return `${title}::${description}`;
};

const getRecentCodingProblemList = (key) => {
    if (!key) return [];
    const entry = recentCodingProblems.get(key);
    if (!entry || !Array.isArray(entry.items)) return [];
    const now = Date.now();
    const fresh = entry.items.filter((item) => now - item.createdAt <= RECENT_CODING_PROBLEM_TTL_MS);
    if (!fresh.length) {
        recentCodingProblems.delete(key);
        return [];
    }
    if (fresh.length !== entry.items.length) {
        recentCodingProblems.set(key, { items: fresh });
    }
    return fresh;
};

const rememberRecentCodingProblem = (key, problem) => {
    if (!key || !problem) return;
    const fingerprint = buildProblemFingerprint(problem);
    if (!fingerprint) return;
    const title = normalizePlainText(problem?.title);
    const now = Date.now();
    const current = getRecentCodingProblemList(key);
    const next = [...current, { fingerprint, title, createdAt: now }];
    const trimmed = next.slice(-RECENT_CODING_PROBLEM_MAX);
    recentCodingProblems.set(key, { items: trimmed });
};

const isRecentCodingProblemDuplicate = (key, problem) => {
    if (!key || !problem) return false;
    const fingerprint = buildProblemFingerprint(problem);
    if (!fingerprint) return false;
    const normalizedTitle = normalizeProblemSignature(problem?.title);
    const recent = getRecentCodingProblemList(key);
    return recent.some((item) => {
        if (item.fingerprint === fingerprint) return true;
        if (normalizedTitle && normalizeProblemSignature(item.title) === normalizedTitle) return true;
        return false;
    });
};

const normalizeMultilineText = (val) =>
    String(val || "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();

const toStringArray = (val) => {
    if (Array.isArray(val)) {
        return val.map((item) => normalizePlainText(item)).filter(Boolean);
    }
    const single = normalizePlainText(val);
    return single ? [single] : [];
};

const normalizeCodingProblem = (raw, { testCaseCount = 4 } = {}) => {
    const title = normalizePlainText(raw?.title);
    const description = normalizeMultilineText(raw?.description);
    const constraints = toStringArray(raw?.constraints);

    // === JSON Harness: Extract signature ===
    const signature = raw?.signature ? {
        className: raw.signature.className || "Solution",
        functionName: raw.signature.functionName || "",
        params: Array.isArray(raw.signature.params) ? raw.signature.params : [],
        returnType: raw.signature.returnType || "void",
        classBased: raw.signature.classBased !== false
    } : null;

    const rawExamples = Array.isArray(raw?.examples)
        ? raw.examples
        : raw?.example
            ? [raw.example]
            : [];

    let examples = rawExamples
        .map((ex) => {
            const input = normalizeMultilineText(ex?.input);
            const output = normalizeMultilineText(ex?.output ?? ex?.expected ?? ex?.expectedOutput);
            const explanation = normalizeMultilineText(ex?.explanation);
            if (!input || !output) return null;
            return { input, output, explanation: explanation || "" };
        })
        .filter(Boolean);

    // === JSON Harness: Handle both legacy and new test case formats ===
    let testCases = Array.isArray(raw?.testCases)
        ? raw.testCases
            .map((tc) => {
                // New format: args and expected
                if (tc.args !== undefined && tc.expected !== undefined) {
                    return {
                        args: tc.args,
                        expected: tc.expected
                    };
                }
                // Legacy format: input and expected (string)
                const input = normalizeMultilineText(tc?.input);
                const expected = normalizeMultilineText(tc?.expected ?? tc?.expectedOutput ?? tc?.output);
                if (!input || !expected) return null;
                return { input, expected };
            })
            .filter(Boolean)
        : [];

    if (!testCases.length && examples.length) {
        testCases = examples.map((ex) => ({ input: ex.input, expected: ex.output }));
    }

    if (testCaseCount && testCases.length > testCaseCount) {
        testCases = testCases.slice(0, testCaseCount);
    }

    if (testCaseCount && testCases.length < testCaseCount) {
        const base =
            testCases[testCases.length - 1] ||
            (examples[0] ? { input: examples[0].input, expected: examples[0].output } : null) ||
            { input: "1", expected: "1" };
        const padCount = testCaseCount - testCases.length;
        testCases = [
            ...testCases,
            ...Array.from({ length: padCount }, () => ({ ...base }))
        ];
    }

    if (!examples.length && testCases.length) {
        const firstTest = testCases[0];
        if (firstTest.args !== undefined) {
            // JSON harness format - create example from args
            examples = [{
                input: JSON.stringify(firstTest.args),
                output: JSON.stringify(firstTest.expected),
                explanation: ""
            }];
        } else {
            // Legacy format
            examples = [{ input: firstTest.input, output: firstTest.expected, explanation: "" }];
        }
    }

    return { title, description, constraints, signature, examples, testCases };
};

const getLanguageCommentPrefix = (languageName = "") => {
    const name = String(languageName || "").toLowerCase();
    if (name.includes("python") || name.includes("ruby") || name.includes("bash") || name.includes("shell")) {
        return "#";
    }
    if (name.includes("sql") || name.includes("lua")) {
        return "--";
    }
    return "//";
};

const buildWriteHerePlaceholder = (languageName = "") => {
    const prefix = getLanguageCommentPrefix(languageName);
    return `${prefix} Write your code here`;
};

const ensureBoilerplatePlaceholder = (code, placeholderLine) => {
    if (!code) return `${placeholderLine}\n`;
    if (/write your code here/i.test(code)) return code;
    return `${code.trimEnd()}\n\n${placeholderLine}\n`;
};

const flattenSelectedBlueprintParameters = (selectedBlueprint = []) => {
    const out = [];
    const groups = Array.isArray(selectedBlueprint) ? selectedBlueprint : [];

    for (const g of groups) {
        const groupName = String(g?.name || "").trim() || "Group";
        const params = Array.isArray(g?.parameters) ? g.parameters : [];
        for (const p of params) {
            const paramName = String(p?.name || "").trim();
            if (!paramName) continue;
            out.push({ group: groupName, parameter: paramName });
        }
    }
    return out;
};

const buildTranscriptForEval = (messages = []) => {
    const normalized = Array.isArray(messages) ? messages : [];
    const last = normalized.slice(-120);

    return last
        .map((m) => {
            const role = String(m.role || "").toLowerCase();
            const label =
                role === "candidate"
                    ? "CANDIDATE"
                    : role === "ai" || role === "assistant"
                        ? "INTERVIEWER"
                        : role.toUpperCase();

            const text = (typeof m.content === "string" ? m.content : JSON.stringify(m.content || ""))
                .replace(/\s+/g, " ")
                .trim();

            if (!text) return null;
            return `${label}: ${text}`;
        })
        .filter(Boolean)
        .join("\n");
};

/* ------------------------------
 * Blueprint generation helpers (unchanged from your file)
 * ------------------------------ */

// Heuristic only. No hardcoded acronym expansions.
const looksLikeAbbreviation = (name) => {
    const s = String(name || "").trim();
    if (!s) return false;

    if (/^[A-Z0-9]{2,6}$/.test(s)) return true;

    const words = s.split(/[\s/_-]+/).filter(Boolean);
    if (words.some((w) => /^[A-Z0-9]{2,6}$/.test(w))) return true;

    if (words.some((w) => w.length <= 6 && /^[A-Z]+$/.test(w) && !/[AEIOU]/.test(w))) return true;

    return false;
};

const looksLikePlaceholder = (name) => {
    const s = String(name || "").trim();
    if (!s) return true;
    if (/^(Group|Parameter|Sub)\s*\d+$/i.test(s)) return true;
    if (/^Sub\s*\d+$/i.test(s)) return true;
    return false;
};

const blueprintNeedsRepair = (json) => {
    const groups = Array.isArray(json?.groups) ? json.groups : [];
    if (groups.length !== 3) return true;

    for (const g of groups) {
        const gName = String(g?.name || "").trim();
        if (!gName || looksLikePlaceholder(gName) || looksLikeAbbreviation(gName)) return true;

        const params = Array.isArray(g?.parameters) ? g.parameters : [];
        if (params.length !== 5) return true;

        for (const p of params) {
            const pName = String(p?.name || "").trim();
            if (!pName || looksLikePlaceholder(pName) || looksLikeAbbreviation(pName)) return true;

            const subs = Array.isArray(p?.subparameters) ? p.subparameters : [];
            if (subs.length !== 5) return true;

            for (const s of subs) {
                const subName = String(s || "").trim();
                if (!subName || looksLikePlaceholder(subName)) return true;
                if (looksLikeAbbreviation(subName)) return true;
            }
        }
    }

    return false;
};

const normalizeBlueprint = (json, { forceGroups = 3, forceParams = 5, forceSubs = 5 } = {}) => {
    const inputGroups = Array.isArray(json?.groups) ? json.groups : [];
    const groups = clampArray(inputGroups, forceGroups).map((g, gi) => {
        const groupName = String(g?.name || g?.skill || `Group ${gi + 1}`).trim() || `Group ${gi + 1}`;
        const params = clampArray(g?.parameters, forceParams).map((p, pi) => {
            const paramName = String(p?.name || `Parameter ${pi + 1}`).trim() || `Parameter ${pi + 1}`;
            const subs = clampArray(p?.subparameters, forceSubs).map((s, si) => {
                const subName = String(s || `Sub ${si + 1}`).trim() || `Sub ${si + 1}`;
                return subName;
            });

            while (subs.length < forceSubs) subs.push(`Sub ${subs.length + 1}`);

            return { name: paramName, subparameters: subs };
        });

        while (params.length < forceParams) {
            params.push({
                name: `Parameter ${params.length + 1}`,
                subparameters: Array.from({ length: forceSubs }, (_, i) => `Sub ${i + 1}`),
            });
        }

        return { name: groupName, parameters: params };
    });

    while (groups.length < forceGroups) {
        groups.push({
            name: `Group ${groups.length + 1}`,
            parameters: Array.from({ length: forceParams }, (_, pi) => ({
                name: `Parameter ${pi + 1}`,
                subparameters: Array.from({ length: forceSubs }, (_, si) => `Sub ${si + 1}`),
            })),
        });
    }

    return { groups };
};

const repairBlueprintWithModel = async ({ draft, interviewType, difficultyLevel, job }, req) => {
    const title = job?.title || job?.internalTitle || "the role";
    const jd = job?.description || "";
    const skills = Array.isArray(job?.primarySkills) ? job.primarySkills : [];
    const topSkills = clampArray(skills, 3);

    const system = `
You are a senior interview designer.
Output MUST be valid JSON only.
Do not include markdown, code fences, commentary, or extra keys beyond the schema.

Schema:
{
  "groups": [
    {
      "name": "string",
      "parameters": [
        {
          "name": "string",
          "subparameters": ["string","string","string","string","string"]
        }
      ]
    }
  ]
}

Hard constraints:
- EXACTLY 3 groups
- EXACTLY 5 parameters per group
- EXACTLY 5 subparameters per parameter

Naming constraints (VERY IMPORTANT):
- Use FULL FORMS only. Expand all acronyms/abbreviations.
  Example: "Object-Oriented Programming" not "OOP".
- Parameters MUST be the MAIN CONCEPTS of that skill area (not tools/framework names, not tiny subtopics).
- Subparameters should be subtopics under that main concept, also in full form (avoid acronyms).
- Avoid placeholders like "Group 1", "Parameter 1", "Sub 1".

Return ONLY JSON that matches the schema.
`.trim();

    const user = `
Context:
- Interview type: ${interviewType}
- Difficulty: ${difficultyLevel}
- Job title: ${title}
- Primary skills (top 3): ${topSkills.length ? topSkills.join(", ") : "(not provided)"}
- Job description:
${jd || "(not provided)"}

Here is the draft blueprint that needs fixing (expand acronyms, replace placeholders, enforce main concepts, keep schema strict):
${JSON.stringify(draft || {}, null, 2)}

Return ONLY the corrected JSON.
`.trim();

    const completion = await chatCompletionByOpenAI(
        [
            { role: "system", content: system },
            { role: "user", content: user },
        ],
        req
    );

    const raw = completion?.choices?.[0]?.message?.content || "";
    return safeJsonParse(raw);
};

const buildParameterPrompt = ({ interviewType, difficultyLevel, job }) => {
    const title = job?.title || job?.internalTitle || "the role";
    const jd = job?.description || "";
    const skills = Array.isArray(job?.primarySkills) ? job.primarySkills : [];
    const topSkills = clampArray(skills, 3);

    const isAdvanced = String(difficultyLevel || "").toLowerCase() === "advanced";

    const system = `
You are a senior interview designer. Output MUST be valid JSON only.
Do not include markdown, code fences, commentary, or extra keys beyond the schema.

Schema:
{
  "groups": [
    {
      "name": "string",
      "parameters": [
        { "name": "string", "subparameters": ["string","string","string","string","string"] }
      ]
    }
  ]
}

Hard constraints:
- EXACTLY 3 groups
- EXACTLY 5 parameters per group
- EXACTLY 5 subparameters per parameter

INTERVIEW TYPE SCOPE (STRICT):

- The selected interview type is: ${interviewType}

- Generate parameters/subparameters ONLY for this interview type.
- Do NOT include topics from other interview types.
- Never mix interview types inside groups.

Definitions:
- Technical → architecture, design, debugging, coding concepts.
- Non-technical / Functional → planning, execution, stakeholder alignment, business decisions, metrics.
- HR → culture fit, communication, feedback, ownership, ethics.
- Psychometric → values, resilience, self-awareness, decision-making under pressure.

If a parameter/subparameter could belong to multiple types, rewrite it so it fits ONLY: ${interviewType}.


Naming rules (STRICT):
- Use FULL FORMS only. Expand ALL acronyms/abbreviations.
- Parameters MUST be MAIN CONCEPTS (not tools/framework names).
- Subparameters are subtopics, also in full form (avoid acronyms).
- Keep names job-relevant and 2 to 6 words.
${isAdvanced ? `
Advanced difficulty rules:
- Make parameters and subparameters "FAANG-style": require reasoning, trade-offs, and measurable outcomes.
- Prefer subparameters like: "Trade-offs and constraints", "Failure modes and mitigation", "Metrics and validation",
  "Stakeholder alignment", "Debugging and root cause analysis", "Security and reliability".
- Avoid hypothetical or company-specific phrasing in parameter names; keep them generic concepts.

` : ""}
`.trim();

    const user = `
Context:
- Interview type: ${interviewType}
- Difficulty: ${difficultyLevel}
- Job title: ${title}
- Primary skills (top 3): ${topSkills.length ? topSkills.join(", ") : "(not provided)"}
- Job description:
${jd || "(not provided)"}

Instructions:
- If interview type is "Technical": groups MUST be the 3 primary skills (or best approximation if missing), in full form.
- If interview type is "HR" / "Psychometric" / "Non-Technical": groups MUST be 3 competency areas derived from the JD, in full form.
- Parameters and subparameters MUST align to the JD and the group meaning.
- Do NOT use acronyms anywhere (expand them).
- Do NOT output placeholders like "Parameter 1".

Return ONLY JSON.
`.trim();

    return { system, user, topSkills };
};

/* ----------------------------------------------------------
 * STRICT EVALUATION HELPERS (NEW)
 * -------------------------------------------------------- */

const MIN_ANSWER_WORDS = 15;
const MIN_ANSWER_CHARS = 40;

const countWords = (text = "") => text.trim().split(/\s+/).filter(Boolean).length;

const classifyCandidateAnswer = (rawText) => {
    const text = (rawText || "").trim();
    if (!text) return { ok: false, reason: "empty", wordCount: 0, charCount: 0 };

    const wordCount = countWords(text);
    const charCount = text.replace(/\s+/g, "").length;

    if (wordCount < MIN_ANSWER_WORDS || charCount < MIN_ANSWER_CHARS) {
        return { ok: false, reason: "too_short", wordCount, charCount };
    }

    const lower = text.toLowerCase();
    const fillerPatterns = [
        "you are audible",
        "i can hear",
        "can you hear me",
        "hello",
        "hi ",
        "good morning",
        "good afternoon",
        "good evening",
        "thank you",
        "thanks",
        "yes i can hear",
        "yes i am able to",
        "yes it is clear",
        "test test",
        "mic check",
    ];

    if (fillerPatterns.some((p) => lower.includes(p))) {
        return { ok: false, reason: "filler", wordCount, charCount };
    }

    return { ok: true, reason: "accepted", wordCount, charCount };
};

const normalizeText = (s) =>
    String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const jaccardSim = (a, b) => {
    const A = new Set(normalizeText(a).split(" ").filter(Boolean));
    const B = new Set(normalizeText(b).split(" ").filter(Boolean));
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const x of A) if (B.has(x)) inter++;
    const union = A.size + B.size - inter;
    return union ? inter / union : 0;
};

const isLikelyQuestion = (text = "") => {
    const raw = String(text || "").trim();
    if (!raw) return false;
    if (raw.length < 6) return false;
    if (raw.includes("?")) return true;

    const lower = raw.toLowerCase();
    const starters = [
        "tell",
        "describe",
        "explain",
        "how",
        "what",
        "why",
        "when",
        "where",
        "which",
        "can you",
        "could you",
        "would you",
        "walk me",
        "share",
    ];
    return starters.some((s) => lower.startsWith(s) || lower.includes(` ${s} `));
};

const getNextCandidateAnswerMeta = (messages, startIdx) => {
    const normalized = Array.isArray(messages) ? messages : [];
    for (let j = startIdx + 1; j < normalized.length; j++) {
        const next = normalized[j] || {};
        const role = String(next.role || "").toLowerCase();
        const nextIsAI = role === "ai" || role === "assistant";
        const nextIsCandidate = role === "candidate";
        if (nextIsAI) break;
        if (nextIsCandidate) {
            const answerText = String(next.content || "");
            const answerMeta = classifyCandidateAnswer(answerText);
            return { answerText, answerMeta };
        }
    }
    return {
        answerText: "",
        answerMeta: { ok: false, reason: "no_candidate_reply", wordCount: 0, charCount: 0 },
    };
};

const buildFallbackMappedQuestions = ({ messages, parameterPairs }) => {
    const normalized = Array.isArray(messages) ? messages : [];
    const params = Array.isArray(parameterPairs) ? parameterPairs : [];
    if (!normalized.length || !params.length) return [];

    const answered = [];
    const questionLike = [];
    const allAi = [];

    for (let i = 0; i < normalized.length; i++) {
        const msg = normalized[i] || {};
        const role = String(msg.role || "").toLowerCase();
        const isAI = role === "ai" || role === "assistant";
        if (!isAI) continue;

        const qText = String(msg.content || "").trim();
        if (!qText) continue;

        allAi.push({ aiIndex: i, questionText: qText });

        const { answerMeta } = getNextCandidateAnswerMeta(normalized, i);
        if (answerMeta?.ok) {
            answered.push({ aiIndex: i, questionText: qText });
            continue;
        }

        if (isLikelyQuestion(qText)) {
            questionLike.push({ aiIndex: i, questionText: qText });
        }
    }

    const source = answered.length ? answered : questionLike.length ? questionLike : allAi;
    if (!source.length) return [];

    const unique = [];
    const seen = new Set();
    source
        .sort((a, b) => a.aiIndex - b.aiIndex)
        .forEach((item) => {
            if (seen.has(item.aiIndex)) return;
            seen.add(item.aiIndex);
            unique.push(item);
        });

    const limited = unique.slice(0, params.length);
    return limited.map((item, idx) => ({
        aiIndex: item.aiIndex,
        questionText: item.questionText,
        parameter: params[idx]?.parameter,
        group: params[idx]?.group || "",
        confidence: 0.25,
        method: "fallback_sequence",
    }));
};

// Parse script lines like:
// [PARAMETER: Foo] [GROUP: Bar] Q1. "Question text"
const parseScriptTaggedQuestions = (script = "") => {
    const lines = String(script || "").split("\n");
    const out = [];

    for (const line of lines) {
        const m = line.match(
            /^\s*\[PARAMETER:\s*(.+?)\]\s*\[GROUP:\s*(.+?)\]\s*((?:Q|Question)\s*\d+[a-z]?\.)\s*"?(.+?)"?\s*$/i
        );
        if (!m) continue;

        out.push({
            parameter: String(m[1] || "").trim(),
            group: String(m[2] || "").trim(),
            questionText: String(m[4] || "").trim(),
        });
    }
    return out;
};

// Map AI questions → parameters using either direct tags in AI output
// or fuzzy match to tagged script questions (preferred).
const mapQuestionsToParameters = ({ messages, taggedScriptQuestions }) => {
    const mapped = [];
    const tq = Array.isArray(taggedScriptQuestions) ? taggedScriptQuestions : [];
    const normalized = Array.isArray(messages) ? messages : [];

    for (let i = 0; i < normalized.length; i++) {
        const msg = normalized[i] || {};
        const role = String(msg.role || "").toLowerCase();
        const isAI = role === "ai" || role === "assistant";
        if (!isAI) continue;

        const qText = String(msg.content || "").trim();
        if (!qText) continue;

        const tagMatch = qText.match(/\[PARAMETER:\s*(.+?)\]\s*\[GROUP:\s*(.+?)\]/i);
        if (tagMatch) {
            mapped.push({
                aiIndex: i,
                questionText: qText,
                parameter: String(tagMatch[1] || "").trim(),
                group: String(tagMatch[2] || "").trim(),
                confidence: 1,
                method: "direct_tag",
            });
            continue;
        }

        if (tq.length) {
            let best = { sim: 0, item: null };
            for (const item of tq) {
                const sim = jaccardSim(qText, item.questionText);
                if (sim > best.sim) best = { sim, item };
            }
            if (best.item && best.sim >= 0.18) {
                mapped.push({
                    aiIndex: i,
                    questionText: qText,
                    parameter: best.item.parameter,
                    group: best.item.group,
                    confidence: best.sim,
                    method: "fuzzy_script_match",
                });
            }
        }
    }

    return mapped;
};

// For each mapped parameter-question chunk, extract candidate evidence until next mapped question.
const buildParameterEvidenceMap = ({ messages, mappedQuestions }) => {
    const normalized = Array.isArray(messages) ? messages : [];
    const mq = Array.isArray(mappedQuestions) ? mappedQuestions : [];
    const byAiIndex = new Map(mq.map((x) => [x.aiIndex, x]));
    const sortedAiIdx = mq.map((x) => x.aiIndex).sort((a, b) => a - b);

    const evidence = {}; // param -> { group, questionSnippets, answerText, answerMeta, evidenceTurns }

    for (let k = 0; k < sortedAiIdx.length; k++) {
        const startIdx = sortedAiIdx[k];
        const endIdx = k + 1 < sortedAiIdx.length ? sortedAiIdx[k + 1] : normalized.length;

        const mqItem = byAiIndex.get(startIdx);
        if (!mqItem?.parameter) continue;

        const paramName = mqItem.parameter;
        const group = mqItem.group || "";

        const chunk = normalized.slice(startIdx + 1, endIdx);
        const candidateTurns = chunk
            .filter((m) => String(m.role || "").toLowerCase() === "candidate")
            .map((m) => String(m.content || "").trim())
            .filter(Boolean);

        const combined = candidateTurns.join("\n").trim();
        const meta = classifyCandidateAnswer(combined);

        if (!evidence[paramName]) {
            evidence[paramName] = {
                group,
                questionSnippets: [],
                answerText: "",
                answerMeta: { ok: false, reason: "empty", wordCount: 0, charCount: 0 },
                evidenceTurns: [],
            };
        }

        evidence[paramName].group = evidence[paramName].group || group;
        evidence[paramName].questionSnippets.push(String(mqItem.questionText || "").slice(0, 220));
        evidence[paramName].evidenceTurns.push(...candidateTurns);

        const cur = evidence[paramName].answerMeta;

        if (!cur.ok && meta.ok) {
            evidence[paramName].answerText = combined;
            evidence[paramName].answerMeta = meta;
        } else if (cur.ok && meta.ok) {
            evidence[paramName].answerText = [evidence[paramName].answerText, combined].filter(Boolean).join("\n");
            evidence[paramName].answerMeta = classifyCandidateAnswer(evidence[paramName].answerText);
        } else if (!cur.ok && !meta.ok) {
            if ((combined || "").length > (evidence[paramName].answerText || "").length) {
                evidence[paramName].answerText = combined;
                evidence[paramName].answerMeta = meta;
            }
        }
    }

    return evidence;
};

const evaluateConversationCoverage = (messages = []) => {
    let totalQuestions = 0;
    let answeredQuestions = 0;

    const normalized = Array.isArray(messages) ? messages : [];

    for (let i = 0; i < normalized.length; i++) {
        const msg = normalized[i] || {};
        const role = String(msg.role || "").toLowerCase();
        const isAI = role === "ai" || role === "assistant";
        if (!isAI) continue;

        totalQuestions += 1;

        let answerText = "";
        let answerMeta = { ok: false, reason: "no_candidate_reply", wordCount: 0, charCount: 0 };

        for (let j = i + 1; j < normalized.length; j++) {
            const next = normalized[j] || {};
            const r = String(next.role || "").toLowerCase();
            const nextIsAI = r === "ai" || r === "assistant";
            const nextIsCandidate = r === "candidate";

            if (nextIsAI) break;

            if (nextIsCandidate) {
                answerText = String(next.content || "");
                answerMeta = classifyCandidateAnswer(answerText);
                break;
            }
        }

        if (answerMeta.ok) answeredQuestions += 1;
    }

    const score = totalQuestions
        ? Math.max(0, Math.min(100, Math.round((answeredQuestions / totalQuestions) * 100)))
        : 0;

    return {
        score,
        breakdown: {
            totalQuestions,
            answeredQuestions,
            minAnswerWords: MIN_ANSWER_WORDS,
            minAnswerChars: MIN_ANSWER_CHARS,
        },
    };
};

const generateStrictParameterEvaluation = async (
    {
        parameterPairs,
        evidenceMap,
        interviewType,
        difficultyLevel,
        coverageScore,
        coverageBreakdown,
        experienceContext,
    },
    req
) => {
    const isAdvanced = String(difficultyLevel || "").toLowerCase() === "advanced";

    const systemPrompt = `
You are a strict interview evaluator.

Return ONLY valid JSON. No markdown. No commentary.

You MUST evaluate each provided parameter ONLY using the provided candidate evidence.
If evidence is missing/empty/too short/filler, you MUST score low.
- IMPORTANT: Do NOT evaluate technical correctness, domain correctness, or personality fit. Only how clearly the candidate communicated.
- Do NOT increase score just because the content sounds advanced. Score structure, clarity, specificity, and responsiveness only.
- Penalize "buzzword stacking" (many terms with little explanation) as low specificity.
- Score MUST be a number (not a string). Use an integer 0 to 100.


Experience calibration rules:
- Use the experienceTier and job experience range to calibrate expectations.
- For fresher/junior roles, do NOT require production-scale depth or leadership; reward clear fundamentals and sound reasoning.
- For mid roles, expect practical depth and some trade-off awareness.
- For senior/lead roles, require deep technical depth, trade-offs, and real-world experience.
- Never inflate scores without evidence; still follow evidenceQuality rules.

SCORING RUBRIC (strict):
- 0-10: No answer, filler, or unusable evidence.
- 11-30: Very vague, generic statements, no concrete implementation details.
- 31-60: Basic understanding, some relevant points, limited specifics, weak trade-offs.
- 61-80: Solid practical answer, clear examples, reasonable trade-offs, technically coherent.
- 81-100: Strong depth, concrete examples, accurate details, good debugging/performance/security awareness.

${isAdvanced ? `
Advanced (FAANG-style) communication expectations:
- Expect answers to be structured (e.g., situation → action → outcome) or step-by-step reasoning.
- Expect explicit trade-offs or constraints to be stated clearly when relevant.
- Reward concise, evidence-backed answers; penalize vague claims, rambling, or repeated filler.
- Do NOT require complex vocabulary; require clarity and structure.
` : ""}

Hard rules:
- If evidenceQuality.ok is false for a parameter, the score MUST be <= 20.
- Do NOT invent parameters. Keys MUST match the provided parameter names EXACTLY.
- Reasons must cite evidence quality (e.g., "no concrete example", "no system design details mentioned", "only high-level").
- Keep reasons 1–2 sentences, professional, neutral.

JSON schema:
{
  "overallReason": "string",
  "parameterEvaluation": {
    "<PARAMETER_NAME>": { "score": number, "reason": "string", "group": "string" }
  }
}
`.trim();

    const userPayload = parameterPairs.map((p) => {
        const param = p.parameter;
        const ev = evidenceMap[param] || {};
        return {
            group: p.group,
            parameter: param,
            evidenceQuality: ev.answerMeta || { ok: false, reason: "missing", wordCount: 0, charCount: 0 },
            interviewerQuestionHints: clampArray(ev.questionSnippets || [], 2),
            candidateEvidence: String(ev.answerText || "").slice(0, 2000),
        };
    });

    const userPrompt = `
Interview context:
- interviewType: ${interviewType || "Technical"}
- difficultyLevel: ${difficultyLevel || "Intermediate"}

Experience context (calibrate expectations to this):
${JSON.stringify(experienceContext || {}, null, 2)}

Coverage signal (supporting metric):
- coverageScore: ${coverageScore}
- coverageBreakdown: ${JSON.stringify(coverageBreakdown || {}, null, 2)}

Evaluate these parameters strictly using only the evidence below:
${JSON.stringify(userPayload, null, 2)}

Return ONLY JSON.
`.trim();

    const completion = await chatCompletionByOpenAI(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        req
    );

    const raw = completion?.choices?.[0]?.message?.content || "";
    return safeJsonParse(raw);
};

const sanitizeStrictParameterEvaluation = ({ llmResult, parameterPairs, evidenceMap }) => {
    const allowedParams = parameterPairs.map((p) => p.parameter);
    const groupByParam = Object.fromEntries(parameterPairs.map((p) => [p.parameter, p.group]));

    const rawPE =
        llmResult?.parameterEvaluation && typeof llmResult.parameterEvaluation === "object"
            ? llmResult.parameterEvaluation
            : {};

    const cleaned = {};
    for (const paramName of allowedParams) {
        const ev = evidenceMap[paramName] || {};
        const quality = ev.answerMeta || { ok: false, reason: "missing", wordCount: 0, charCount: 0 };

        const entry = rawPE?.[paramName] || {};
        let score = clampNum(entry?.score, 0, 100, 0);

        // Default reason, but keep it aligned to evidence quality
        let reason =
            String(entry?.reason || "").trim() ||
            (quality.ok
                ? "Answer contained limited evaluable detail."
                : "Insufficient evidence in transcript (no substantial answer).");

        // ✅ STRICT OVERRIDE: if evidence is not acceptable, score MUST be 0 (not 5, not 20)
        if (!quality.ok) {
            score = 0;
            reason = "Insufficient evidence in transcript (no substantial answer).";
        }

        cleaned[paramName] = {
            score,
            reason,
            group: String(entry?.group || "").trim() || groupByParam[paramName] || "",
            weight: 1,
        };
    }

    const overallReason =
        String(llmResult?.overallReason || "").trim() ||
        "Evaluation based on available transcript evidence and parameter-specific responses.";

    // total score = average of all parameters (base set only; communication is added later)
    const scores = Object.values(cleaned).map((x) => x.score);
    const totalScore = scores.length
        ? clampNum(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 0, 100, 0)
        : 0;

    return { totalScore, overallReason, parameterEvaluation: cleaned };
};

/* ----------------------------------------------------------
 * STRICT COMMUNICATION EVALUATION (NEW)
 * - Auto-added parameter: "Communication & Clarity"
 * - STRICT prompt, not manual
 * - Guardrails enforce low/zero when evidence is weak
 * -------------------------------------------------------- */

const COMMUNICATION_PARAMETER_NAME = "Communication & Clarity";

const buildCommunicationStats = (messages = []) => {
    const normalized = Array.isArray(messages) ? messages : [];
    const candidateTurns = normalized
        .filter((m) => String(m?.role || "").toLowerCase() === "candidate")
        .map((m) => String(m?.content || "").trim())
        .filter(Boolean);

    const stats = {
        totalCandidateTurns: candidateTurns.length,
        okTurns: 0,
        tooShortTurns: 0,
        fillerTurns: 0,
        emptyTurns: 0,
        reasons: { accepted: 0, too_short: 0, filler: 0, empty: 0 },
        examplesGood: [],
        examplesBad: [],
    };

    for (const t of candidateTurns) {
        const meta = classifyCandidateAnswer(t);
        stats.reasons[meta.reason] = (stats.reasons[meta.reason] || 0) + 1;

        if (meta.ok) {
            stats.okTurns += 1;
            if (stats.examplesGood.length < 4) stats.examplesGood.push(String(t).slice(0, 320));
        } else {
            if (meta.reason === "too_short") stats.tooShortTurns += 1;
            else if (meta.reason === "filler") stats.fillerTurns += 1;
            else if (meta.reason === "empty") stats.emptyTurns += 1;

            if (stats.examplesBad.length < 2) stats.examplesBad.push(String(t).slice(0, 240));
        }
    }

    stats.okRatio = stats.totalCandidateTurns
        ? Math.max(0, Math.min(1, stats.okTurns / stats.totalCandidateTurns))
        : 0;

    return stats;
};

const generateStrictCommunicationEvaluation = async (
    { transcript, stats, interviewType, difficultyLevel, experienceContext },
    req
) => {
    const systemPrompt = `
You are a strict communication evaluator for interview transcripts.

Return ONLY valid JSON. No markdown. No commentary.

Evaluate ONLY the candidate's communication using the provided transcript evidence.
Focus on:
- Clarity and structure (logical flow, direct answers)
- Specificity (concrete details vs vague statements)
- Conciseness (avoids rambling, stays on point)
- Responsiveness (answers what was asked, acknowledges constraints)
- Professional tone (neutral, role-appropriate)

Hard rules:
- If okTurns is 0, score MUST be 0.
- If most turns are too short or filler, score MUST be low.
- Do NOT invent evidence.

Experience calibration rules:
- Use experienceTier to set expectations for polish and depth.
- For fresher/junior roles, allow simpler vocabulary if the answers are clear and responsive.
- For senior/lead roles, expect concise, structured communication with precise terminology.

Score rubric (0-100):
- 0-10: No usable communication (empty/filler, cannot evaluate).
- 11-30: Very poor clarity; mostly vague or non-answers.
- 31-60: Basic clarity; mixed structure; limited specifics.
- 61-80: Clear, structured, practical communication.
- 81-100: Exceptionally clear, concise, and evidence-backed communication.

JSON schema:
{ "score": number, "reason": "string" }

Reason rules:
- 1–2 sentences only
- Must directly reference evidence quality (e.g., "answers were often too short", "provided concrete examples", "structured responses").
`.trim();

    const userPrompt = `
Context:
- interviewType: ${interviewType || "Technical"}
- difficultyLevel: ${difficultyLevel || "Intermediate"}

Experience context:
${JSON.stringify(experienceContext || {}, null, 2)}

Candidate turn stats:
${JSON.stringify(stats || {}, null, 2)}

Transcript (most recent turns, labeled):
${String(transcript || "").slice(0, 4500)}

Return ONLY JSON.
`.trim();

    const completion = await chatCompletionByOpenAI(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        req
    );

    const raw = completion?.choices?.[0]?.message?.content || "";
    return safeJsonParse(raw);
};

const sanitizeStrictCommunicationEvaluation = ({ llmResult, stats }) => {
    const s = stats || { totalCandidateTurns: 0, okTurns: 0, okRatio: 0, tooShortTurns: 0, fillerTurns: 0 };

    let score = clampNum(llmResult?.score, 0, 100, 0);
    let reason = String(llmResult?.reason || "").trim() || "Insufficient evidence to assess communication.";

    // Hard guardrails (non-negotiable)
    if (!s.totalCandidateTurns || s.okTurns === 0) {
        return {
            score: 0,
            reason: "Insufficient evidence in transcript to evaluate communication (no substantial answers).",
        };
    }

    // If candidate mostly gives short/filler, keep score capped low
    const weakShare =
        s.totalCandidateTurns
            ? Math.min(1, (Number(s.tooShortTurns || 0) + Number(s.fillerTurns || 0)) / s.totalCandidateTurns)
            : 1;

    if (s.okRatio < 0.25 || weakShare > 0.6) {
        score = Math.min(score, 30);
        if (!reason.toLowerCase().includes("too short") && !reason.toLowerCase().includes("filler")) {
            reason = "Communication evidence is weak: many responses were too short or non-substantive, limiting evaluable clarity and structure.";
        }
    }

    return { score, reason };
};

const recomputeAverageTotalScore = (parameterEvaluation = {}) => {
    const entries = Object.values(parameterEvaluation || {});
    const scores = entries.map((e) => clampNum(e?.score, 0, 100, 0));
    return scores.length ? clampNum(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 0, 100, 0) : 0;
};

// ---------------------------------------------------------------------------
// Human+AI holistic evaluation (no blueprint required).
// Evaluates the candidate across 4 fixed dimensions based purely on the
// conversation transcript.  Used when interviewerType === "Human+AI" and
// no parameter blueprint exists.
// ---------------------------------------------------------------------------
const generateHumanAIHolisticEvaluation = async (
    { transcript, commStats, interviewType, difficultyLevel, experienceContext },
    req
) => {
    const systemPrompt = `
You are an expert interview evaluator.
A human interviewer conducted this interview. Evaluate the CANDIDATE's performance holistically.

Return ONLY valid JSON. No markdown. No extra text.

Evaluate the candidate across EXACTLY these 4 dimensions (score each 0-100):
1. "Communication & Clarity"          — clarity, structure, conciseness of responses
2. "Responsiveness & Engagement"      — how directly and fully the candidate addressed each question
3. "Depth & Demonstrated Knowledge"   — specificity, concrete examples, substance of answers
4. "Professional Conduct"             — tone, confidence, poise, appropriateness

Scoring rubric (0-100):
0-10   : No substantive responses; nothing evaluable.
11-30  : Very vague or minimal; little real engagement.
31-60  : Some substance but shallow; limited specifics.
61-80  : Clear, engaged, thoughtful; good concrete details.
81-100 : Exceptional depth, confidence, and structure.

Hard rules:
- Base scores STRICTLY on CANDIDATE: lines in the transcript — do NOT score the interviewer.
- Do NOT invent evidence or assume context not present in the transcript.
- Each dimension reason must be 2-3 sentences citing specific transcript evidence.
- overallReason must be 3-5 sentences, specific and balanced, referencing actual answers.
- totalScore must equal the integer average of all 4 dimension scores.

JSON schema (return exactly this structure):
{
  "totalScore": <integer 0-100>,
  "overallReason": "<3-5 sentence detailed summary>",
  "parameterEvaluation": {
    "Communication & Clarity":         { "score": <int>, "reason": "<2-3 sentences>", "group": "Holistic" },
    "Responsiveness & Engagement":     { "score": <int>, "reason": "<2-3 sentences>", "group": "Holistic" },
    "Depth & Demonstrated Knowledge":  { "score": <int>, "reason": "<2-3 sentences>", "group": "Holistic" },
    "Professional Conduct":            { "score": <int>, "reason": "<2-3 sentences>", "group": "Holistic" }
  }
}
`.trim();

    const userPrompt = `
Interview context:
- interviewType: ${interviewType || "General"}
- difficultyLevel: ${difficultyLevel || "Intermediate"}

Experience context:
${JSON.stringify(experienceContext || {}, null, 2)}

Candidate communication stats:
${JSON.stringify(commStats || {}, null, 2)}

Full interview transcript (CANDIDATE = candidate, INTERVIEWER = human interviewer):
${String(transcript || "").slice(0, 6000)}

Return ONLY JSON.
`.trim();

    const completion = await chatCompletionByOpenAI(
        [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        req
    );

    const raw = completion?.choices?.[0]?.message?.content || "";
    const parsed = safeJsonParse(raw);

    // Sanitize and clamp scores
    if (parsed && parsed.parameterEvaluation) {
        for (const key of Object.keys(parsed.parameterEvaluation)) {
            const entry = parsed.parameterEvaluation[key];
            if (entry) {
                entry.score = clampNum(entry.score, 0, 100, 0);
                entry.group = entry.group || "Holistic";
                entry.reason = String(entry.reason || "").trim() || "Insufficient evidence to evaluate this dimension.";
            }
        }
        const scores = Object.values(parsed.parameterEvaluation).map((e) => e?.score ?? 0);
        parsed.totalScore = scores.length
            ? clampNum(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 0, 100, 0)
            : clampNum(parsed.totalScore, 0, 100, 0);
        parsed.overallReason = String(parsed.overallReason || "").trim() || "Evaluation generated from conversation transcript.";
    }

    return parsed || null;
};

/* ----------------------------------------------------------
 * Script generation prompt (UPDATED: tagged questions)
 * -------------------------------------------------------- */

const buildScriptFromSelectedBlueprintPrompt = ({
    interviewType,
    difficultyLevel,
    candidate,
    job,
    selectedBlueprint,
    scriptStyle,
    durationMinutes,
    logContext,
}) => {
    const candName =
        `${candidate?.firstName || ""} ${candidate?.lastName || ""}`.trim() || "the candidate";

    const jobTitle = job?.title || job?.internalTitle || "the role";
    const companyName = job?.companyName || job?.company?.name || job?.company || "the company";
    const level = difficultyLevel || "Intermediate";
    const type = interviewType || "Technical";
    const style = scriptStyle === "Detailed" ? "Detailed" : "Compact";
    const totalParams = flattenSelectedBlueprintParameters(selectedBlueprint).length;
    const durationValue = Number(durationMinutes);
    const normalizedDuration =
        Number.isFinite(durationValue) && durationValue > 0
            ? Math.min(Math.round(durationValue), MAX_RECORDING_MINUTES)
            : null;
    const followUpRange =
        normalizedDuration && normalizedDuration <= 15
            ? "0-1"
            : normalizedDuration && normalizedDuration <= 30
                ? "1"
                : "1-2";
    const openingBullets =
        normalizedDuration && normalizedDuration <= 15 ? "2-3" : "3-5";
    const closingQuestions =
        normalizedDuration && normalizedDuration <= 15 ? "1-2" : "2-3";
    const evalGuideBullets =
        normalizedDuration && normalizedDuration <= 15 ? "3-4" : "4-6";
    const perQuestionMinutes =
        normalizedDuration && totalParams ? (normalizedDuration / totalParams).toFixed(1) : null;
    const timeBudgetLine = normalizedDuration
        ? `- Total interview time available: ${normalizedDuration} minutes.`
        : "- Total design should fit 30-40 minutes.";
    const perQuestionLine = perQuestionMinutes
        ? `- Target about ${perQuestionMinutes} minutes per main question, including candidate response.`
        : "- Target about 2-3 minutes per main question, including candidate response.";

    if (logContext?.rid) {
        console.log(`[SCRIPT][${logContext.rid}] Duration tuning:`, {
            durationMinutes: normalizedDuration,
            totalParams,
            perQuestionMinutes,
            followUpRange,
            openingBullets,
            closingQuestions,
            evalGuideBullets,
        });
    }

    const isAdvanced = String(difficultyLevel || "").toLowerCase() === "advanced";

    const system = `
You are a senior interview designer writing an interview script for an AI interviewer.

Hard constraints (NON-NEGOTIABLE):
- You MUST build the interview ONLY from the provided selectedBlueprint.
- Do NOT introduce new groups, parameters, or subparameters not present in selectedBlueprint.
- Use each parameter as exactly ONE main question. Use its subparameters only as follow-up probes.
- If a parameter includes a numeric priority, ask lower priority numbers first.
- Output must be plain text. No JSON. No markdown fences. No meta commentary.

INTERVIEW TYPE SCOPE (STRICT, NON-NEGOTIABLE):

- The selected interview type is: ${type}

- You MUST generate questions ONLY for this interview type.
- You MUST NOT include questions, probes, or evaluation criteria from any other interview type.
- Never produce more than ONE interview type in the output.

Definitions:
- Technical interview → system design, coding concepts, architecture, debugging, technical decision-making.
- Non-technical / Functional interview → planning, execution, stakeholders, metrics, business decisions.
- HR interview → behaviour, culture fit, motivation, feedback, ethics, collaboration.
- Psychometric interview → self-awareness, stress handling, decision-making under pressure, values, resilience.

Rewrite rule:
- If a question could belong to multiple interview types, you MUST rewrite it so it clearly fits ONLY: ${type}
- If unsure, EXCLUDE it and stay within ${type} only.

Final check:
- Before outputting, verify every question matches ONLY ${type}. If any do not, remove or rewrite them.


${isAdvanced ? `
Advanced style (FAANG-level, STRICT):
- Each MAIN question must be based on a real past experience (no opinions or hypotheticals).
- Each MAIN question must explicitly require at least ONE evaluable dimension:
  • a trade-off decision
  • a constraint (time, cost, scale, risk)
  • a measurable outcome or metric
  • a failure/incident and what changed afterward
- If a question does not naturally force one of the above, rewrite it until it does.
- Follow-up probes should deepen the SAME dimension, not introduce a new topic.
- Prefer phrasing patterns:
  "Tell me about a time when…"
  "Walk me through a decision where…"
  "Describe a situation in which…"

EVALUATION GUIDE (ADVANCED / FAANG STYLE):
- In the "Evaluation Guide" section, include a header line exactly:
  FAANG STYLE EVALUATION GUIDE
- Bullets must evaluate: specificity, decision/trade-offs, constraints, measurable impact, and learnings/failure handling.
- Add one bullet exactly:
  FAANG STYLE CHECK: Prefer evidence and outcomes over buzzwords.
` : ""}


CRITICAL OUTPUT FORMAT:
- Every MAIN question line MUST start exactly with:
  [PARAMETER: <parameter name>] [GROUP: <group name>] Question x. "<question text>"
- This is required for downstream evaluation mapping.
- If a parameter covers multiple sub-concepts (e.g., 2-3 ideas), split them into separate sub-questions:
  [PARAMETER: React] [GROUP: Frontend] Question 1a. "<first sub-concept — max 20-25 words>"
  [PARAMETER: React] [GROUP: Frontend] Question 1b. "<second sub-concept — max 20-25 words>"
  [PARAMETER: React] [GROUP: Frontend] Question 1c. "<third sub-concept — max 20-25 words>"
- Each sub-question MUST use the SAME [PARAMETER:] and [GROUP:] tags as the parent.
- Each sub-question MUST be ONE plain sentence, max 20-25 words.
- Never bundle multiple concepts into a single question line.

Context:
- Candidate: ${candName}
- Job title: ${jobTitle}
- Company: ${companyName}
- Interview type: ${type}
- Difficulty level: ${level}
- Script style: ${style}

Script structure requirements:
1) Start with a direct context line (NO greeting words like hello/hi/welcome/thanks):
   - Example pattern: "In this conversation we will focus on your skills for the ${jobTitle} role at ${companyName}, with emphasis on ${type} topics."
   - Follow with 1 short paragraph + ${openingBullets} bullet points (no salutations).
2) For EACH group in selectedBlueprint:
   - Add a heading with the group name.
   - Add numbered questions (one per parameter) using the CRITICAL OUTPUT FORMAT above.
   - For each question, include ${followUpRange} follow-up probes in brackets, derived ONLY from the listed subparameters.
   - If parameters include priority values, the final question order must follow ascending priority even when topics span multiple groups.
3) Add a short Closing section with ${closingQuestions} wrap-up questions.
4) Add an "Evaluation Guide" section at the end with concise bullets (${evalGuideBullets}, role-relevant).

Time budget:
${timeBudgetLine}
${perQuestionLine}
- Keep each question concise and practical.

Tone:
- Professional, clear, India-friendly English.
- One question at a time style (script format is still a list).
`.trim();

    const user = `
Use ONLY this selectedBlueprint to generate the interview script.

selectedBlueprint:
${JSON.stringify(selectedBlueprint || [], null, 2)}

Important:
- Do not invent or add anything outside this blueprint.
- Every parameter becomes one main question.
- Subparameters become follow-up probes in brackets.
- Keep all generated lines suitable for spoken delivery by an AI voice.
- Output ONLY the script text.
`.trim();

    return { system, user };
};

export default async function aiRoutes(fastify) {
    console.log("⚙️ [AI ROUTES] Booting up AI endpoints...");

    const interviewSvc = new InterviewScheduleService();

    const resolveAuthToken = (raw) => {
        const token = String(raw || "").trim();
        if (!token) return null;
        return token.replace(/^Bearer\s+/i, "");
    };

    const resolveBodyAuthToken = (req) => {
        if (!req?.body) return null;
        if (typeof req.body === "string") {
            return resolveAuthToken(safeJsonParse(req.body)?.authToken);
        }
        if (typeof req.body === "object") {
            return resolveAuthToken(req.body.authToken);
        }
        return null;
    };

    const resolveQueryAuthToken = (req) => {
        const q = req?.query || {};
        const direct = resolveAuthToken(q.token || q.t || q.authToken);
        if (direct) return direct;

        const rawUrl = req?.raw?.url || "";
        const qIndex = rawUrl.indexOf("?");
        if (qIndex === -1) return null;

        try {
            const params = new URLSearchParams(rawUrl.slice(qIndex + 1));
            return resolveAuthToken(
                params.get("token") || params.get("t") || params.get("authToken")
            );
        } catch {
            return null;
        }
    };

    const applyAuthFromToken = async (req, rawToken) => {
        const token = resolveAuthToken(rawToken);
        if (!token) throw new Error("Missing token");

        const jwtRes = await fastify.jwt.verify(token);
        if (!jwtRes?.dbName) throw new Error("Invalid token");

        req.dbName = jwtRes.dbName;
        req.conn = await getClientDbConn(jwtRes.dbName);

        const user = await req.conn.models["User"].findById(jwtRes.sub).lean().exec();
        if (!user) throw new Error("User not found");

        req.user = { ...user, ...jwtRes };
        req.client = user?.clientId || user?.client || user?._id;
    };

    // Auth for all routes (allow endInterview token in body for sendBeacon)
    fastify.addHook("preHandler", async (req, reply) => {
        const isEndInterview =
            req.routerPath === "/endInterview" ||
            (req.raw?.url || "").includes("/api/ai/endInterview");

        const isLiveStt =
            req.routerPath === "/transcribe/live" ||
            (req.raw?.url || "").includes("/api/ai/transcribe/live");

        if (isEndInterview) {
            const bodyToken = resolveBodyAuthToken(req);
            if (bodyToken) {
                try {
                    await applyAuthFromToken(req, bodyToken);
                    return;
                } catch (err) {
                    console.warn("[END INTERVIEW] Token auth failed:", err?.message || err);
                    return reply.code(401).send({ error: "Unauthorized" });
                }
            }
        }

        if (isLiveStt) {
            const qsToken = resolveQueryAuthToken(req);
            if (qsToken) {
                try {
                    await applyAuthFromToken(req, qsToken);
                    return;
                } catch (err) {
                    console.warn("[STT-LIVE] Token auth failed:", err?.message || err);
                    return reply.code(401).send({ error: "Unauthorized" });
                }
            }
        }

        return fastify.authenticate(req, reply);
    });

    const logTime = (label, start) => console.log(`🕒 ${label}: ${(Date.now() - start).toFixed(0)} ms`);

    const getText = (content) => {
        if (!content) return "";
        if (typeof content === "string") return content;
        try {
            if (Array.isArray(content) && content[0]?.text) return String(content[0].text);
            if (content?.text) return String(content.text);
            return JSON.stringify(content);
        } catch {
            return "";
        }
    };

    // Guard – AI interviewer is allowed only when latest interview is Virtual + interviewerType === 'AI'
    const ensureAIInterviewEnabled = async (req, candidateId, jobId, interviewScheduleId = null) => {
        try {
            if (!candidateId || !jobId) return true;

            if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) return true;

            const InterviewSchedule = req.conn.models["InterviewSchedule"];
            if (!InterviewSchedule) return true;

            let sched = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                sched = await InterviewSchedule.findOne({
                    _id: new mongoose.Types.ObjectId(interviewScheduleId),
                    client: req.client,
                    candidate: new mongoose.Types.ObjectId(candidateId),
                    job: new mongoose.Types.ObjectId(jobId),
                    isArchived: false,
                })
                    .lean()
                    .exec();
            }

            if (!sched) {
                sched = await InterviewSchedule.findOne({
                    client: req.client,
                    candidate: new mongoose.Types.ObjectId(candidateId),
                    job: new mongoose.Types.ObjectId(jobId),
                    isArchived: false,
                })
                    .sort({ startAt: -1 })
                    .lean()
                    .exec();
            }

            if (!sched) return true;

            const allowed = sched.interviewMode === "Virtual" && (sched.interviewerType === "AI" || sched.interviewerType == null);

            if (!allowed) {
                console.log("[AI ROUTES] AI interviewer disabled for this interview", {
                    candidateId,
                    jobId,
                    mode: sched.interviewMode,
                    interviewerType: sched.interviewerType,
                });
            }

            return allowed;
        } catch (err) {
            console.warn("[AI ROUTES] ensureAIInterviewEnabled – falling back to allow:", err?.message || err);
            return true;
        }
    };

    const normalizeParamValue = (value, fallback) => {
        const str = String(value || "").trim();
        return str || fallback;
    };

    const findParamEntry = (entries, interviewType, difficultyLevel) => {
        const list = Array.isArray(entries) ? entries : [];
        const type = normalizeParamValue(interviewType, "").toLowerCase();
        const level = normalizeParamValue(difficultyLevel, "").toLowerCase();
        if (!type || !level) return null;
        return (
            list.find((entry) => {
                const entryType = normalizeParamValue(entry?.interviewType, "").toLowerCase();
                const entryLevel = normalizeParamValue(entry?.difficultyLevel, "").toLowerCase();
                return entryType === type && entryLevel === level;
            }) || null
        );
    };

    const upsertJobParamEntry = async (
        req,
        { jobId, interviewType, difficultyLevel, blueprint, selectedBlueprint, clearSelected = false }
    ) => {
        if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) return null;
        const Job = req.conn.models["Job"];
        if (!Job) return null;

        const jobDoc = await Job.findOne({
            _id: new mongoose.Types.ObjectId(jobId),
            client: req.client,
            isArchived: false,
        }).exec();

        if (!jobDoc) return null;

        const type = normalizeParamValue(interviewType, "Technical");
        const level = normalizeParamValue(difficultyLevel, "Intermediate");
        const list = Array.isArray(jobDoc.interviewParameterBlueprints)
            ? jobDoc.interviewParameterBlueprints
            : [];

        let entry = findParamEntry(list, type, level);
        if (!entry) {
            entry = {
                interviewType: type,
                difficultyLevel: level,
                blueprint: null,
                selectedBlueprint: null,
                updatedAt: null,
                selectedUpdatedAt: null,
            };
            list.push(entry);
        }

        const now = new Date();
        if (blueprint !== undefined) {
            entry.blueprint = blueprint;
            entry.updatedAt = now;
            if (clearSelected) {
                entry.selectedBlueprint = null;
                entry.selectedUpdatedAt = null;
            }
        }

        if (selectedBlueprint !== undefined) {
            entry.selectedBlueprint = selectedBlueprint;
            entry.selectedUpdatedAt = now;
        }

        jobDoc.interviewParameterBlueprints = list;
        jobDoc.markModified("interviewParameterBlueprints");
        await jobDoc.save();
        console.log("[PARAMS] Persisted blueprint entry", {
            jobId,
            interviewType: type,
            difficultyLevel: level,
            hasBlueprint: !!entry.blueprint,
            hasSelected: Array.isArray(entry.selectedBlueprint) && entry.selectedBlueprint.length > 0,
            updatedAt: entry.updatedAt,
            selectedUpdatedAt: entry.selectedUpdatedAt,
            clearSelected,
        });
        return entry;
    };

    /* =========================================================
     * Load saved interview parameters
     * GET /api/ai/interview-parameters?jobId=...
     * ========================================================= */
    fastify.get("/interview-parameters", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n[PARAMS] ===== /api/ai/interview-parameters =====");

        try {
            const { jobId, interviewType, difficultyLevel } = req.query || {};
            if (!jobId) {
                return reply.code(400).send({ ok: false, error: "jobId is required" });
            }
            if (!mongoose.Types.ObjectId.isValid(jobId)) {
                return reply.code(400).send({ ok: false, error: "Invalid jobId" });
            }

            const type = normalizeParamValue(interviewType, "Technical");
            const level = normalizeParamValue(difficultyLevel, "Intermediate");
            const Job = req.conn.models["Job"];
            if (!Job) {
                return reply.code(500).send({ ok: false, error: "Job model not registered" });
            }

            const jobDoc = await Job.findOne({
                _id: new mongoose.Types.ObjectId(jobId),
                client: req.client,
                isArchived: false,
            })
                .lean()
                .exec();

            if (!jobDoc) {
                return reply.code(404).send({ ok: false, error: "Job not found" });
            }

            const entry = findParamEntry(jobDoc.interviewParameterBlueprints, type, level);
            console.log("[PARAMS] Load result", {
                jobId,
                interviewType: type,
                difficultyLevel: level,
                hasBlueprint: !!entry?.blueprint,
                hasSelected: Array.isArray(entry?.selectedBlueprint) && entry.selectedBlueprint.length > 0,
                updatedAt: entry?.updatedAt,
                selectedUpdatedAt: entry?.selectedUpdatedAt,
            });

            return reply.send({
                ok: true,
                interviewType: type,
                difficultyLevel: level,
                blueprint: entry?.blueprint || null,
                selectedBlueprint: entry?.selectedBlueprint || null,
                updatedAt: entry?.updatedAt || null,
                selectedUpdatedAt: entry?.selectedUpdatedAt || null,
            });
        } catch (err) {
            console.error("[PARAMS] Failed to load parameters:", err?.message || err);
            return reply
                .code(500)
                .send({ ok: false, error: "Failed to load interview parameters" });
        } finally {
            logTime("[PARAMS] load duration", t0);
            console.log("========================================================\n");
        }
    });

    /* =========================================================
     * Save interview parameters
     * POST /api/ai/interview-parameters/save
     * ========================================================= */
    fastify.post("/interview-parameters/save", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n[PARAMS] ===== /api/ai/interview-parameters/save =====");

        try {
            const { jobId, interviewType, difficultyLevel, blueprint, selectedBlueprint } =
                req.body || {};
            console.log("[PARAMS] Save input", {
                jobId,
                interviewType,
                difficultyLevel,
                hasBlueprint: blueprint !== undefined,
                hasSelected: Array.isArray(selectedBlueprint) && selectedBlueprint.length > 0,
            });

            if (!jobId) {
                return reply.code(400).send({ ok: false, error: "jobId is required" });
            }
            if (!mongoose.Types.ObjectId.isValid(jobId)) {
                return reply.code(400).send({ ok: false, error: "Invalid jobId" });
            }
            if (blueprint === undefined && selectedBlueprint === undefined) {
                return reply
                    .code(400)
                    .send({ ok: false, error: "blueprint or selectedBlueprint is required" });
            }

            const entry = await upsertJobParamEntry(req, {
                jobId,
                interviewType,
                difficultyLevel,
                blueprint,
                selectedBlueprint,
            });

            if (!entry) {
                return reply.code(404).send({ ok: false, error: "Job not found" });
            }

            return reply.send({
                ok: true,
                interviewType: normalizeParamValue(interviewType, "Technical"),
                difficultyLevel: normalizeParamValue(difficultyLevel, "Intermediate"),
                blueprint: entry.blueprint || null,
                selectedBlueprint: entry.selectedBlueprint || null,
                updatedAt: entry.updatedAt || null,
                selectedUpdatedAt: entry.selectedUpdatedAt || null,
            });
        } catch (err) {
            console.error("[PARAMS] Failed to save parameters:", err?.message || err);
            return reply
                .code(500)
                .send({ ok: false, error: "Failed to save interview parameters" });
        } finally {
            logTime("[PARAMS] save duration", t0);
            console.log("========================================================\n");
        }
    });

    /* =========================================================
     * Generate interview parameters (3 groups x 5 x 5)
     * POST /api/ai/generateInterviewParameters
     * ========================================================= */
    fastify.post("/generateInterviewParameters", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n🧩 [PARAMS] ===== /api/ai/generateInterviewParameters =====");

        try {
            const { job: jobPayload, jobId, interviewType, difficultyLevel } = req.body || {};
            let resolvedJob = jobPayload;
            let resolvedJobId = jobId || jobPayload?._id;

            if (jobId && mongoose.Types.ObjectId.isValid(jobId)) {
                const Job = req.conn.models["Job"];
                if (Job) {
                    const jobDoc = await Job.findOne({
                        _id: new mongoose.Types.ObjectId(jobId),
                        client: req.client,
                        isArchived: false,
                    })
                        .lean()
                        .exec();
                    if (jobDoc) {
                        resolvedJob = jobDoc;
                        resolvedJobId = jobDoc._id;
                    }
                }
            }

            console.log("[PARAMS] Input:", {
                interviewType,
                difficultyLevel,
                jobId: resolvedJobId,
                jobTitle: resolvedJob?.title || resolvedJob?.internalTitle,
                primarySkills: Array.isArray(resolvedJob?.primarySkills)
                    ? resolvedJob.primarySkills
                    : [],
            });

            const type = normalizeParamValue(interviewType, "Technical");
            const level = normalizeParamValue(difficultyLevel, "Intermediate");

            const { system, user } = buildParameterPrompt({
                interviewType: type,
                difficultyLevel: level,
                job: resolvedJob,
            });

            const completion = await chatCompletionByOpenAI(
                [
                    { role: "system", content: system },
                    { role: "user", content: user },
                ],
                req
            );

            const raw = completion?.choices?.[0]?.message?.content || "";
            console.log("[PARAMS] Raw model output len:", raw.length);

            let parsed = safeJsonParse(raw);

            if (blueprintNeedsRepair(parsed || {})) {
                console.log("[PARAMS] Blueprint needs repair (acronyms/placeholders/shape). Running repair pass...");
                const repaired = await repairBlueprintWithModel(
                    { draft: parsed || {}, interviewType: type, difficultyLevel: level, job: resolvedJob },
                    req
                );

                if (repaired && !blueprintNeedsRepair(repaired)) {
                    parsed = repaired;
                    console.log("[PARAMS] Repair pass succeeded.");
                } else {
                    console.warn("[PARAMS] Repair pass failed or still imperfect; falling back to normalization.");
                }
            }

            const normalized = normalizeBlueprint(parsed || {}, { forceGroups: 3, forceParams: 5, forceSubs: 5 });

            console.log("[PARAMS] Normalized blueprint ready:", {
                groups: normalized.groups.map((g) => g.name),
            });

            let stored = false;
            if (resolvedJobId && mongoose.Types.ObjectId.isValid(resolvedJobId)) {
                try {
                    const entry = await upsertJobParamEntry(req, {
                        jobId: resolvedJobId,
                        interviewType: type,
                        difficultyLevel: level,
                        blueprint: normalized,
                        clearSelected: true,
                    });
                    stored = !!entry;
                } catch (err) {
                    console.warn("[PARAMS] Failed to persist blueprint:", err?.message || err);
                }
            }

            console.log("[PARAMS] Generate stored", {
                jobId: resolvedJobId,
                interviewType: type,
                difficultyLevel: level,
                stored,
            });

            return reply.send({
                ok: true,
                interviewType: type,
                difficultyLevel: level,
                blueprint: normalized,
                stored,
            });
        } catch (err) {
            console.error("❌ [PARAMS] Failed:", err?.message || err);
            return reply.code(500).send({ ok: false, error: "Failed to generate interview parameters" });
        } finally {
            logTime("[PARAMS] duration", t0);
            console.log("========================================================\n");
        }
    });

    fastify.get("/", async (_, reply) => {
        console.log("⚡ [AI ROUTE] GET /api/ai → health check OK");
        reply.send({ message: "✅ AI Voice Backend is running fine." });
    });

    /* ========================================================================
     * Deepgram Live STT over WebSocket (manual Start/Stop)
     * ====================================================================== */
    const wsSafeSend = (socket, payload) => {
        try {
            if (socket?.readyState === 1) {
                socket.send(JSON.stringify(payload));
            }
        } catch (err) {
            console.warn("[STT-LIVE] Failed to send WS payload:", err?.message || err);
        }
    };

    const bufferToBase64 = (buf) =>
        Buffer.isBuffer(buf) ? buf.toString("base64") : Buffer.from(buf).toString("base64");

    fastify.get(
        "/transcribe/live",
        { websocket: true },
        (ws, req) => {
            const socket = ws?.socket || ws;
            const sessionId = crypto.randomUUID?.() || `live_${Date.now()}`;

            const state = {
                sessionId,
                socket,
                dg: null,
                turnId: null,
                meta: {},
                finalParts: [],
                lastInterim: "",
                lastFinalAt: 0,
                stopping: false,
                closed: false,
                disableAI: false,
                sttLanguage: DG_LIVE_LANGUAGE_AI,
            };

            const log = (msg, data) => {
                if (data !== undefined) {
                    console.log(`[STT-LIVE][${sessionId}] ${msg}`, data);
                } else {
                    console.log(`[STT-LIVE][${sessionId}] ${msg}`);
                }
                wsSafeSend(socket, { type: "log", level: "info", message: msg, data });
            };

            const logWarn = (msg, data) => {
                if (data !== undefined) {
                    console.warn(`[STT-LIVE][${sessionId}] ${msg}`, data);
                } else {
                    console.warn(`[STT-LIVE][${sessionId}] ${msg}`);
                }
                wsSafeSend(socket, { type: "log", level: "warn", message: msg, data });
            };

            const logErr = (msg, data) => {
                if (data !== undefined) {
                    console.error(`[STT-LIVE][${sessionId}] ${msg}`, data);
                } else {
                    console.error(`[STT-LIVE][${sessionId}] ${msg}`);
                }
                wsSafeSend(socket, { type: "log", level: "error", message: msg, data });
            };

            const resetTurn = (turnId) => {
                state.turnId = turnId;
                state.finalParts = [];
                state.lastInterim = "";
                state.lastFinalAt = 0;
                state.stopping = false;
            };

            const closeDeepgram = () => {
                try {
                    state.dg?.sendCloseStream?.();
                    state.dg?.close?.();
                } catch {
                    // ignore
                }
                state.dg = null;
            };

            const startDeepgram = async (sampleRate, encoding, language) => {
                if (!deepgramLiveClient) {
                    logErr("DEEPGRAM_API_KEY not configured; cannot start live STT");
                    wsSafeSend(socket, { type: "error", message: "Deepgram Live STT not configured." });
                    return null;
                }

                closeDeepgram();

                const srNum = Number(sampleRate);
                const finalSampleRate = Number.isFinite(srNum) ? srNum : 16000;
                const finalLanguage = normalizeSttLanguage(
                    language,
                    state.disableAI ? DG_LIVE_LANGUAGE_HUMAN : DG_LIVE_LANGUAGE_AI
                );
                state.sttLanguage = finalLanguage;

                const dg = await deepgramLiveClient.listen.v1.connect({
                    model: "nova-3",
                    language: finalLanguage,
                    smart_format: true,
                    interim_results: true,
                    encoding: encoding || "linear16",
                    sample_rate: finalSampleRate,
                    channels: 1,
                    vad_events: true,
                    endpointing: 150,
                });

                dg.on("open", () => {
                    log("Deepgram live connection opened", { language: finalLanguage });
                    wsSafeSend(socket, { type: "stt_open", turnId: state.turnId });
                });

                dg.on('message', (data) => {
                    if (data?.type !== "Results") return;

                    const alt = data?.channel?.alternatives?.[0];
                    const transcript = (alt?.transcript || "").trim();
                    if (!transcript) return;

                    const isFinal = Boolean(data?.is_final || data?.speech_final);

                    if (isFinal) {
                        state.finalParts.push(transcript);
                        state.lastFinalAt = Date.now();
                    } else {
                        state.lastInterim = transcript;
                    }

                    wsSafeSend(socket, {
                        type: "stt",
                        turnId: state.turnId,
                        text: transcript,
                        isFinal,
                    });
                });

                dg.on("utterance_end", async (data) => {
                    log("Deepgram utterance_end", data?.last_word_end);

                    // For Human/Human+AI: auto-persist accumulated finals on every natural
                    // utterance boundary so each sentence is saved in real-time and
                    // finalParts is cleared for the next utterance.
                    if (state.disableAI && state.finalParts.length > 0) {
                        const pendingText = state.finalParts.join(" ").trim();
                        state.finalParts = []; // clear before async call to avoid double-save
                        if (pendingText) {
                            await persistHumanLiveSttTurn(state.meta, pendingText);
                        }
                    }
                });

                dg.on("error", (err) => {
                    logErr("Deepgram live error", err?.message || err);
                    wsSafeSend(socket, {
                        type: "error",
                        turnId: state.turnId,
                        message: err?.message || "Deepgram live error",
                    });
                });

                dg.on('close', () => {
                    log("Deepgram live connection closed");
                });

                state.dg = dg;
                state.dg.connect?.();
                await state.dg.waitForOpen?.();
                return dg;
            };

            const streamTtsAudio = async (aiText, turnId) => {
                const parts = String(aiText || "")
                    .split(SENTENCE_SEP)
                    .map((p) => p.trim())
                    .filter(Boolean);

                if (!parts.length) return;

                wsSafeSend(socket, {
                    type: "audio_start",
                    turnId,
                    contentType: "audio/mpeg",
                });

                let seq = 0;
                for (const sentence of parts) {
                    if (state.closed || state.turnId !== turnId) {
                        log("TTS stream aborted due to new turn/close");
                        break;
                    }

                    try {
                        const audioBuffer = await aiService.speakText(sentence);
                        if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) continue;

                        for (let i = 0; i < audioBuffer.length; i += LIVE_AUDIO_CHUNK_BYTES) {
                            if (state.closed || state.turnId !== turnId) break;
                            const chunk = audioBuffer.subarray(i, i + LIVE_AUDIO_CHUNK_BYTES);
                            wsSafeSend(socket, {
                                type: "audio_chunk",
                                turnId,
                                seq: seq++,
                                audioBase64: bufferToBase64(chunk),
                            });
                        }
                    } catch (err) {
                        logErr("TTS chunk failed", err?.message || err);
                        wsSafeSend(socket, {
                            type: "error",
                            turnId,
                            message: err?.message || "TTS failed",
                        });
                        break;
                    }
                }

                if (!state.closed && state.turnId === turnId) {
                    wsSafeSend(socket, { type: "audio_end", turnId });
                }
            };

            // Persist a completed STT turn to the Conversation model for Human/Human+AI
            // interviews.  Mirrors the chunked-STT persistence block so that the transcript
            // fetch route can find the conversation regardless of which STT path was used.
            const persistHumanLiveSttTurn = async (meta, text) => {
                try {
                    const { candidateId, jobId, interviewScheduleId } = meta || {};
                    const trimmedText = (text || "").trim();
                    if (
                        !trimmedText ||
                        !candidateId ||
                        !jobId ||
                        !mongoose.Types.ObjectId.isValid(candidateId) ||
                        !mongoose.Types.ObjectId.isValid(jobId)
                    ) return;

                    if (!req?.conn?.models?.Conversation || !req?.conn?.models?.InterviewSchedule) return;

                    const candObjId = new mongoose.Types.ObjectId(candidateId);
                    const jobObjId = new mongoose.Types.ObjectId(jobId);
                    const InterviewSchedule = req.conn.models["InterviewSchedule"];

                    let schedule = null;
                    if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                        schedule = await InterviewSchedule.findOne({
                            _id: new mongoose.Types.ObjectId(interviewScheduleId),
                            client: req.client,
                            isArchived: false,
                        }).lean().exec();
                    }
                    if (!schedule) {
                        schedule = await InterviewSchedule.findOne({
                            client: req.client,
                            candidate: candObjId,
                            job: jobObjId,
                            isArchived: false,
                        }).sort({ startAt: -1 }).lean().exec();
                    }
                    if (!schedule) return;

                    const interviewerType = schedule.interviewerType || "AI";
                    const interviewType = schedule.interviewType || "Technical";
                    if (interviewerType !== "Human" && interviewerType !== "Human+AI") return;

                    // Determine speaker role and display name from the authenticated user
                    let messageRole = "candidate";
                    let displayName = "User";
                    if (req?.conn?.models?.User && req.user?._id) {
                        const UserModel = req.conn.models["User"];
                        const currentUser = await UserModel.findOne({
                            _id: req.user._id,
                            client: req.client,
                            isArchived: false,
                        }).select("firstName lastName email role").lean().exec();
                        if (currentUser) {
                            const r = currentUser.role;
                            messageRole = (r === "recruiter" || r === "client_admin" || r === "ultra_admin" || r === "interviewer")
                                ? "assistant"
                                : "candidate";
                            displayName = `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim()
                                || currentUser.email
                                || "User";
                        }
                    }

                    const prefixedText = `[${displayName}] ${trimmedText}`;
                    const scheduleKey = String(schedule._id);
                    const callUUID = `webrtc_${jobId}_${candidateId}_${scheduleKey}`;

                    const filter = {
                        candidateId: candObjId,
                        jobId: jobObjId,
                        client: req.client,
                        interviewType,
                        interviewerType,
                        interviewScheduleId: schedule._id,
                        isArchived: false,
                    };

                    const Conversation = req.conn.models["Conversation"];
                    await Conversation.findOneAndUpdate(
                        filter,
                        {
                            $setOnInsert: { callUUID, interviewType, interviewerType, interviewScheduleId: schedule._id },
                            $push: { messages: { role: messageRole, content: prefixedText, time: new Date() } },
                        },
                        { upsert: true, new: true }
                    ).lean().exec();

                    log(`Live STT turn persisted to Conversation`, { messageRole, interviewerType });
                } catch (err) {
                    console.warn(`[STT-LIVE][${sessionId}] Failed to persist live STT transcript:`, err?.message || err);
                }
            };

            const finalizeTurn = async (turnId) => {
                if (state.closed || state.turnId !== turnId) return;

                const transcript =
                    state.finalParts.join(" ").trim() ||
                    state.lastInterim.trim();

                wsSafeSend(socket, { type: "stt_final", turnId, text: transcript || "" });
                log("Final transcript ready", { turnId, length: transcript.length });

                if (!transcript) {
                    if (state.disableAI) {
                        logWarn("No transcript after finalize; skipping AI response.");
                        state.stopping = false;
                        return;
                    }
                    // AI mode: no speech captured (Deepgram unavailable or user was silent).
                    // Use a neutral starter so the AI can still ask the first question.
                    log("No transcript after finalize; prompting AI to begin.");
                }

                if (state.disableAI) {
                    // Human / Human+AI mode: persist the turn to Conversation and return.
                    if (transcript) await persistHumanLiveSttTurn(state.meta, transcript);
                    state.stopping = false;
                    return;
                }

                try {
                    const aiText = await aiService.handleTextMessage(
                        transcript || "I'm ready",
                        req,
                        state.meta || {}
                    );

                    if (state.closed || state.turnId !== turnId) return;

                    wsSafeSend(socket, { type: "ai_text", turnId, text: aiText || "" });
                    await streamTtsAudio(aiText, turnId);
                } catch (err) {
                    logErr("AI respond failed", err?.message || err);
                    wsSafeSend(socket, {
                        type: "error",
                        turnId,
                        message: err?.message || "AI respond failed",
                    });
                } finally {
                    state.stopping = false;
                }
            };

            log("WebSocket connected");
            wsSafeSend(socket, { type: "ready", sessionId });

            socket.on("message", async (message, isBinary) => {
                if (state.closed) return;

                if (isBinary) {
                    if (!state.dg) {
                        logWarn("Audio received before start; ignoring");
                        return;
                    }
                    try {
                        const buf = Buffer.isBuffer(message)
                            ? message
                            : Buffer.from(message);
                        state.dg.sendMedia(buf);
                    } catch (err) {
                        logErr("Failed to forward audio to Deepgram", err?.message || err);
                    }
                    return;
                }

                const raw =
                    typeof message === "string"
                        ? message
                        : message?.toString?.() || "";
                let payload = null;
                try {
                    payload = JSON.parse(raw);
                } catch (err) {
                    logWarn("Invalid JSON message on live STT socket", raw.slice(0, 120));
                    return;
                }

                const type = payload?.type;
                if (type === "start") {
                    const turnId = payload?.turnId || crypto.randomUUID?.() || `turn_${Date.now()}`;
                    resetTurn(turnId);

                    const candidateId = payload?.candidateId || null;
                    const jobId = payload?.jobId || null;
                    const interviewScheduleId = payload?.interviewScheduleId || null;
                    const disableAI = Boolean(payload?.disableAI || payload?.mode === "transcribe_only");
                    const requestedLanguage = payload?.sttLanguage || payload?.language || null;
                    const sttLanguage = resolveLiveSttLanguage({ disableAI, requestedLanguage });
                    state.disableAI = disableAI;
                    state.sttLanguage = sttLanguage;

                    if (!disableAI) {
                        const aiAllowed = await ensureAIInterviewEnabled(req, candidateId, jobId, interviewScheduleId);
                        if (!aiAllowed) {
                            wsSafeSend(socket, {
                                type: "error",
                                turnId,
                                message: "AI interviewer is not enabled for this interview.",
                            });
                            return;
                        }
                    }

                    state.meta = {
                        candidateId,
                        jobId,
                        interviewScheduleId,
                        jobTitle: payload?.jobTitle,
                        candidateName: payload?.candidateName,
                        technicalScript: payload?.technicalScript,
                    };

                    log("Start received", {
                        turnId,
                        sampleRate: payload?.sampleRate,
                        encoding: payload?.encoding,
                        sttLanguage,
                        candidateId,
                        jobId,
                    });

                    try {
                        await startDeepgram(payload?.sampleRate, payload?.encoding, sttLanguage);
                    } catch (err) {
                        logErr("Failed to start Deepgram; AI will respond on stop anyway", err?.message || err);
                    }
                    return;
                }

                if (type === "audio" && payload?.audioBase64) {
                    if (!state.dg) {
                        logWarn("Audio payload received before start; ignoring");
                        return;
                    }
                    try {
                        const buf = Buffer.from(payload.audioBase64, "base64");
                        state.dg.sendMedia(buf);
                    } catch (err) {
                        logErr("Failed to send base64 audio to Deepgram", err?.message || err);
                    }
                    return;
                }

                if (type === "stop") {
                    if (state.stopping) {
                        logWarn("Stop received but already stopping");
                        return;
                    }
                    if (!state.dg) {
                        // Deepgram never connected (e.g. network error or Deepgram down).
                        // Still finalize the turn so the AI can respond.
                        logWarn("Stop received but no active Deepgram stream; finalizing anyway");
                        if (state.turnId) {
                            finalizeTurn(state.turnId);
                        }
                        return;
                    }
                    state.stopping = true;
                    log("Stop received; finalizing Deepgram stream", { turnId: state.turnId });

                    try {
                        state.dg.sendFinalize?.();
                    } catch {
                        // ignore finalize errors
                    }

                    // Allow Deepgram a short window to emit final transcript.
                    // Capture the current turnId so the timer cannot close a *new* turn's stream.
                    const stoppingTurnId = state.turnId;
                    setTimeout(() => {
                        finalizeTurn(stoppingTurnId);
                        if (state.turnId === stoppingTurnId) {
                            closeDeepgram();
                        }
                    }, LIVE_FINALIZE_WAIT_MS);
                    return;
                }

                if (type === "ping") {
                    wsSafeSend(socket, { type: "pong", sessionId });
                    return;
                }

                logWarn("Unknown message type on live STT socket", type);
            });

            socket.on("close", (code, reason) => {
                // Persist any speech that accumulated before the socket closed.
                // This handles the common case where the interview ends before the
                // RECORDING_DURATION_MS (5-min) timer fires in the frontend, so
                // stopRecording() / finalizeTurn() never had a chance to run.
                if (state.disableAI && state.finalParts.length > 0) {
                    const pendingText = state.finalParts.join(" ").trim();
                    state.finalParts = [];
                    if (pendingText) {
                        persistHumanLiveSttTurn(state.meta, pendingText).catch((err) => {
                            console.warn(`[STT-LIVE][${sessionId}] Failed to persist transcript on socket close:`, err?.message || err);
                        });
                    }
                }
                state.closed = true;
                closeDeepgram();
                log("WebSocket closed", { code, reason: reason?.toString?.() });
            });

            socket.on("error", (err) => {
                logErr("WebSocket error", err?.message || err);
            });
        }
    );

    // 🔊 WebRTC STT → Deepgram
    fastify.post(
        "/transcribe",
        { bodyLimit: 10 * 200 * 1024 * 1024 },
        async (req, reply) => {
            const t0 = Date.now();
            console.log("\n🎧 [STT] ===== /api/ai/transcribe =====");

            try {
                const {
                    audioData,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    sttLanguage: requestedSttLanguage,
                    language: fallbackRequestedLanguage,
                } = req.body || {};
                console.log("📩 [STT] audioData present:", !!audioData);
                console.log("📩 [STT] candidateId:", candidateId || "(none)");
                console.log("📩 [STT] jobId:", jobId || "(none)");

                if (!audioData) {
                    console.warn("⚠️ [STT] Missing audioData in request body");
                    return reply.status(400).send({ error: "Missing audioData" });
                }

                console.log("🧾 [STT] audioData length:", audioData.length);
                console.log("🔍 [STT] Beginning transcription...");

                const hasValidIds =
                    !!candidateId &&
                    !!jobId &&
                    mongoose.Types.ObjectId.isValid(candidateId) &&
                    mongoose.Types.ObjectId.isValid(jobId);

                const candObjId = hasValidIds ? new mongoose.Types.ObjectId(candidateId) : null;
                const jobObjId = hasValidIds ? new mongoose.Types.ObjectId(jobId) : null;
                let schedule = null;

                if (hasValidIds && req?.conn?.models?.InterviewSchedule) {
                    const InterviewSchedule = req.conn.models["InterviewSchedule"];

                    if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                        schedule = await InterviewSchedule.findOne({
                            _id: new mongoose.Types.ObjectId(interviewScheduleId),
                            client: req.client,
                            isArchived: false,
                        })
                            .lean()
                            .exec();
                    }

                    if (!schedule) {
                        schedule = await InterviewSchedule.findOne({
                            client: req.client,
                            candidate: candObjId,
                            job: jobObjId,
                            isArchived: false,
                        })
                            .sort({ startAt: -1 })
                            .lean()
                            .exec();
                    }
                }

                const isHumanMode =
                    schedule?.interviewerType === "Human" ||
                    schedule?.interviewerType === "Human+AI";
                const sttLanguage = resolvePrerecordedSttLanguage({
                    isHumanMode,
                    requestedLanguage: requestedSttLanguage || fallbackRequestedLanguage,
                });

                console.log("🗣️ [STT] Transcription language:", sttLanguage, {
                    interviewerType: schedule?.interviewerType || "unknown",
                });

                const text = await transcribeAudioWithDeepgram(audioData, { language: sttLanguage });

                console.log("📝 [STT] Result:", text || "(empty)");

                // Persist STT transcript into Conversation (Human / Human+AI only)
                try {
                    const trimmedText = (text || "").trim();
                    if (!trimmedText) {
                        console.log("ℹ️ [STT] Transcript empty after trim; skipping Conversation logging.");
                    } else if (!candObjId || !jobObjId) {
                        console.log("ℹ️ [STT] Missing or invalid candidateId/jobId; skipping Conversation logging.", {
                            candidateId,
                            jobId,
                        });
                    } else if (
                        !req?.conn?.models?.Conversation ||
                        !req?.conn?.models?.User
                    ) {
                        console.log("ℹ️ [STT] Required models not found on connection; skipping Conversation logging.");
                    } else {
                        if (!schedule) {
                            console.warn("⚠️ [STT] No InterviewSchedule found for candidate+job; skipping Conversation logging.");
                        } else {
                            const interviewerType = schedule.interviewerType || "AI";
                            const interviewMode = schedule.interviewMode || "Virtual";
                            const interviewType = schedule.interviewType || "Technical";

                            console.log("📅 [STT] InterviewSchedule resolved for STT logging:", {
                                scheduleId: String(schedule._id),
                                interviewerType,
                                interviewMode,
                                interviewType,
                            });

                            if (interviewerType !== "Human" && interviewerType !== "Human+AI") {
                                console.log("ℹ️ [STT] interviewerType is not Human/Human+AI; skipping Conversation logging.", {
                                    interviewerType,
                                });
                            } else {
                                const UserModel = req.conn.models["User"];
                                console.log("👤 [STT] Resolving current user for STT logging...", {
                                    userId: req.user?._id,
                                    client: req.client,
                                });

                                const currentUser = await UserModel.findOne({
                                    _id: req.user._id,
                                    client: req.client,
                                    isArchived: false,
                                })
                                    .select("firstName lastName email role")
                                    .lean()
                                    .exec();

                                if (!currentUser) {
                                    console.warn("⚠️ [STT] Current user not found or inactive; skipping Conversation logging.");
                                } else {
                                    let messageRole = "user";
                                    if (currentUser.role === "candidate") messageRole = "candidate";
                                    else if (currentUser.role === "interviewer") messageRole = "assistant";

                                    const displayName =
                                        `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() ||
                                        currentUser.email ||
                                        "User";

                                    const prefixedText = `[${displayName}] ${trimmedText}`;
                                    console.log("✏️ [STT] Final stored text for Conversation:", prefixedText);

                                    const Conversation = req.conn.models["Conversation"];
                                    const nowTs = new Date();

                                    const scheduleKey = schedule?._id ? String(schedule._id) : "";
                                    const callUUID = schedule.webrtcLink
                                        ? `webrtc_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`
                                        : `manual_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`;

                                    const filter = {
                                        candidateId: candObjId,
                                        jobId: jobObjId,
                                        client: req.client,
                                        interviewType,
                                        interviewerType,
                                        isArchived: false,
                                    };
                                    if (schedule?._id) {
                                        filter.interviewScheduleId = schedule._id;
                                    }

                                    const setOnInsert = {
                                        callUUID,
                                        interviewType,
                                        interviewerType,
                                        interviewScheduleId: schedule._id,
                                    };

                                    console.log("🧷 [STT] Upserting Conversation for STT transcript (Human/Human+AI)...", {
                                        ...filter,
                                        interviewScheduleId: String(schedule._id),
                                    });

                                    const updatedConv = await Conversation.findOneAndUpdate(
                                        filter,
                                        {
                                            $setOnInsert: setOnInsert,
                                            $push: {
                                                messages: {
                                                    role: messageRole,
                                                    content: prefixedText,
                                                    time: nowTs,
                                                },
                                            },
                                        },
                                        { upsert: true, new: true }
                                    )
                                        .lean()
                                        .exec();

                                    console.log("✅ [STT] Conversation updated from STT transcript:", {
                                        conversationId: updatedConv?._id,
                                        messagesCount: updatedConv?.messages?.length,
                                    });
                                }
                            }
                        }
                    }
                } catch (logErr) {
                    console.warn("⚠️ [STT] Error while logging STT transcript into Conversation:", logErr?.message || logErr);
                }

                reply.header("Content-Type", "application/json").send({ text: text || "" });
                console.log("📤 [STT] Response sent ✅");
            } catch (err) {
                console.error("❌ [STT] /transcribe error:", err?.message || err);
                reply.status(500).send({ error: err?.message || "Internal STT error" });
            } finally {
                console.log("========================================================\n");
                logTime("[STT] /transcribe duration", t0);
            }
        }
    );

    // 🧠 AI respond (text-only) + FAST GREETING PATH
    fastify.post("/respond", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n🧠 [AI] ===== /api/ai/respond =====");

        try {
            const { text, ...meta } = req.body || {};
            console.log("📩 [AI] Received text:", text ? `"${String(text).slice(0, 100)}..."` : "(empty)");

            if (!text || typeof text !== "string" || text.trim() === "") {
                console.warn("⚠️ [AI] Invalid text received for /respond");
                return reply.status(400).send({ error: "Text input missing" });
            }

            const candidateId = meta?.candidateId;
            const jobId = meta?.jobId;
            const aiAllowed = await ensureAIInterviewEnabled(req, candidateId, jobId, meta?.interviewScheduleId || null);
            if (!aiAllowed) {
                return reply.status(403).send({
                    error: "AI interviewer is not enabled for this interview. Please use the human interviewer for this virtual interview.",
                });
            }

            // ⚡ FAST-PATH: handle short greetings / mic checks without calling model
            const normalized = String(text || "")
                .toLowerCase()
                .replace(/[^a-z\s]/g, " ")
                .replace(/\s+/g, " ")
                .trim();

            const wordCount = normalized ? normalized.split(" ").length : 0;

            const greetingPhrases = [
                "hello",
                "hi",
                "hey",
                "good morning",
                "good afternoon",
                "good evening",
                "can you hear me",
                "you can hear me",
                "you are audible",
                "i can hear you",
                "i can hear",
                "yes i can hear",
                "yes i am able to hear",
                "yes it is clear",
                "mic check",
                "test test",
            ];

            const isShortGreeting =
                normalized && wordCount > 0 && wordCount <= 6 && greetingPhrases.some((p) => normalized.includes(p));

            // ✅ Only fast-path if this is truly the interview start (no Conversation exists yet)
            let hasExistingConversation = false;
            try {
                if (
                    candidateId &&
                    jobId &&
                    mongoose.Types.ObjectId.isValid(candidateId) &&
                    mongoose.Types.ObjectId.isValid(jobId) &&
                    req?.conn?.models?.Conversation
                ) {
                    const Conversation = req.conn.models["Conversation"];
                    const existing = await Conversation.findOne({
                        client: req.client,
                        candidateId: new mongoose.Types.ObjectId(candidateId),
                        jobId: new mongoose.Types.ObjectId(jobId),
                        isArchived: false,
                    })
                        .select("_id")
                        .lean()
                        .exec();

                    hasExistingConversation = !!existing;
                }
            } catch (e) {
                console.warn("⚠️ [AI] Conversation existence check failed; continuing safely:", e?.message || e);
            }

            if (isShortGreeting && !hasExistingConversation) {
                console.log("⚡ [AI] Short greeting detected AND no existing Conversation: using fast-path without model...");

                // Try to extract Q1 from the technical script, if provided
                let quickResponse = "";
                const script = typeof meta.technicalScript === "string" ? meta.technicalScript : "";

                if (script) {
                    // if tagged script exists, grab first tagged question
                    const tagged = parseScriptTaggedQuestions(script);
                    if (tagged?.length) {
                        quickResponse = tagged[0]?.questionText || "";
                    } else {
                        const m = script.match(/Q1\.[^\n"]*"(.*?)"/);
                        if (m && m[1]) quickResponse = m[1].trim();
                    }
                }

                // ✅ STRICT: ensure greeting is present even if script Q1 doesn't include it
                // const name = meta.candidateName || "there";
                // const role = meta.jobTitle || "this role";
                // const greetingLine = `Hello ${name}, welcome to the interview for the ${role}.`;

                // const alreadyHasGreeting =
                //     /^\s*(hello|hi|hey|good\s+(morning|afternoon|evening))\b/i.test(quickResponse) ||
                //     /welcome to the interview/i.test(quickResponse);

                if (!quickResponse) {
                    quickResponse =
                        // `${greetingLine} ` +
                        `To start, can you briefly walk me through your career so far, focusing on your most recent roles?`;
                    // } else if (!alreadyHasGreeting) {
                    //     quickResponse = `${greetingLine} ${quickResponse}`.trim();
                }

                // Log this turn into Conversation
                try {
                    if (meta.candidateId && meta.jobId && req?.conn?.models?.Conversation) {
                        const candObjId = new mongoose.Types.ObjectId(meta.candidateId);
                        const jobObjId = new mongoose.Types.ObjectId(meta.jobId);

                        let interviewType = meta.interviewType || null;
                        let interviewerType = meta.interviewerType || null;
                        let interviewScheduleId = meta.interviewScheduleId || null;
                        let callUUID = meta.callUUID || null;

                        if ((!interviewType || !interviewerType || !interviewScheduleId || !callUUID) && req?.conn?.models?.InterviewSchedule) {
                            const InterviewSchedule = req.conn.models["InterviewSchedule"];
                            let schedule = null;
                            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                                schedule = await InterviewSchedule.findOne({
                                    _id: new mongoose.Types.ObjectId(interviewScheduleId),
                                    client: req.client,
                                    isArchived: false,
                                })
                                    .lean()
                                    .exec();
                            }

                            if (!schedule) {
                                schedule = await InterviewSchedule.findOne({
                                    client: req.client,
                                    candidate: candObjId,
                                    job: jobObjId,
                                    isArchived: false,
                                })
                                    .sort({ startAt: -1 })
                                    .lean()
                                    .exec();
                            }

                            if (schedule) {
                                interviewType = interviewType || schedule.interviewType || "Technical";
                                interviewerType = interviewerType || schedule.interviewerType || "AI";
                                interviewScheduleId = interviewScheduleId || schedule._id;
                                const scheduleKey = schedule?._id ? String(schedule._id) : "";
                                callUUID =
                                    callUUID ||
                                    (schedule.webrtcLink
                                        ? `webrtc_${meta.jobId}_${meta.candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`
                                        : `manual_${meta.jobId}_${meta.candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`);
                            } else {
                                interviewType = interviewType || "Technical";
                                interviewerType = interviewerType || "AI";
                            }
                        }

                        const Conversation = req.conn.models["Conversation"];
                        const nowTs = new Date();

                        const filter = {
                            candidateId: candObjId,
                            jobId: jobObjId,
                            client: req.client,
                            interviewType: interviewType || "Technical",
                            interviewerType: interviewerType || "AI",
                            isArchived: false,
                        };
                        if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                            filter.interviewScheduleId = new mongoose.Types.ObjectId(interviewScheduleId);
                        }

                        const scheduleKey =
                            interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)
                                ? String(interviewScheduleId)
                                : "";
                        const setOnInsert = {
                            callUUID:
                                callUUID ||
                                `webrtc_${meta.jobId || jobId}_${meta.candidateId || candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`,
                            interviewType: filter.interviewType,
                            interviewerType: filter.interviewerType,
                            interviewScheduleId: interviewScheduleId || null,
                        };

                        console.log("🧷 [AI] Fast-path upsert Conversation with key:", {
                            ...filter,
                            interviewScheduleId: setOnInsert.interviewScheduleId,
                        });

                        await Conversation.findOneAndUpdate(
                            filter,
                            {
                                $setOnInsert: setOnInsert,
                                $push: {
                                    messages: {
                                        $each: [
                                            { role: "candidate", content: text, time: nowTs },
                                            { role: "ai", content: quickResponse, time: nowTs },
                                        ],
                                    },
                                },
                            },
                            { upsert: true, new: true }
                        ).exec();
                    }
                } catch (logErr) {
                    console.warn("⚠️ [AI] Fast-path failed to log conversation turn:", logErr?.message || logErr);
                }

                logTime("[AI] Fast-path greeting response", t0);
                reply.header("Content-Type", "application/json").send({ response: quickResponse || "" });
                console.log("📤 [AI] Fast-path response sent ✅");
                console.log("========================================================\n");
                return;
            }

            // Default path: full AI service
            console.log("💬 [AI] Calling AI service (aiService.handleTextMessage)...");
            const aiResponse = await aiService.handleTextMessage(text, req, meta);

            logTime("[AI] AI responded", t0);
            console.log("🤖 [AI] Preview:", aiResponse?.slice(0, 150) || "(empty)");

            reply.header("Content-Type", "application/json").send({ response: aiResponse || "" });
            console.log("📤 [AI] Response sent ✅");
        } catch (err) {
            console.error("❌ [AI] /respond error:", err?.message || err);
            reply.status(500).send({ error: err?.message || "Internal AI error" });
        } finally {
            logTime("[AI] Total route duration", t0);
            console.log("========================================================\n");
        }
    });

    // 🔊 TTS (legacy)
    fastify.post("/speak", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n🔊 [TTS] ===== /api/ai/speak =====");

        try {
            const { text } = req.body || {};
            console.log("📩 [TTS] Received text:", text ? `"${String(text).slice(0, 80)}..."` : "(empty)");

            if (!text || typeof text !== "string" || text.trim() === "") {
                console.warn("⚠️ [TTS] Missing text in request");
                return reply.status(400).send({ error: "Missing text input" });
            }

            console.log("🎤 [TTS] Generating audio via TTS provider...");
            const audioBuffer = await aiService.speakText(text);

            logTime("[TTS] Audio generated", t0);
            console.log("📦 [TTS] Audio buffer bytes:", audioBuffer?.length || 0);

            if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length === 0) {
                console.warn("⚠️ [TTS] Invalid or empty audio buffer");
                return reply.status(500).send({ error: "TTS returned empty buffer" });
            }

            reply.header("Content-Type", "audio/mpeg").send(audioBuffer);
            console.log("📤 [TTS] Audio sent successfully ✅");
        } catch (err) {
            console.error("❌ [TTS] /speak error:", err?.message || err);
            reply.status(500).send({ error: err?.message || "Internal TTS error" });
        } finally {
            logTime("[TTS] Total route duration", t0);
            console.log("========================================================\n");
        }
    });

    fastify.post("/respondAndSpeak", async (req, reply) => {
        const t0 = Date.now();
        console.log("\n🧠🔊 [AI] ===== /api/ai/respondAndSpeak =====");

        const { text, technicalScript, jobTitle, candidateName, ...meta } = req.body || {};
        const sessionKey = getSessionKey(req, meta);

        try {
            console.log("📩 [AI] Incoming text:", text ? `"${String(text).slice(0, 100)}..."` : "(empty)");

            if (!text || typeof text !== "string" || !text.trim()) {
                console.warn("⚠️ [AI] /respondAndSpeak missing text");
                return reply.code(400).send({ error: "Text input missing" });
            }

            const candidateId = meta?.candidateId;
            const jobId = meta?.jobId;
            const aiAllowed = await ensureAIInterviewEnabled(req, candidateId, jobId, meta?.interviewScheduleId || null);
            if (!aiAllowed) {
                return reply.status(403).send({
                    error: "AI interviewer is not enabled for this interview. Please use the human interviewer for this virtual interview.",
                });
            }

            const jdFactResponse = await aiService.tryBuildJdFactResponse(text, req, {
                ...meta,
                technicalScript,
                jobTitle,
                candidateName,
            });
            if (jdFactResponse) {
                endTtsSession(sessionKey, "preempted_by_jd_fact_response");

                const session = { res: reply.raw, interrupted: false, ended: false };
                activeTtsSessions.set(sessionKey, session);

                reply.raw.writeHead(200, {
                    "Content-Type": "audio/mpeg",
                    "Transfer-Encoding": "chunked",
                });

                // Reuse handleTextMessage so this JD turn gets persisted into Conversation.
                const finalText = await aiService.handleTextMessage(text, req, {
                    ...meta,
                    technicalScript,
                    jobTitle,
                    candidateName,
                    precomputedJdFactResponse: jdFactResponse,
                });

                const audioBuffer = await aiService.speakText(finalText);
                if (
                    audioBuffer &&
                    Buffer.isBuffer(audioBuffer) &&
                    audioBuffer.length > 0 &&
                    !session.interrupted &&
                    !session.ended &&
                    activeTtsSessions.get(sessionKey) === session
                ) {
                    reply.raw.write(audioBuffer);
                }

                if (!session.ended) {
                    try {
                        reply.raw.end();
                    } catch (e) {
                        console.warn("[AI] Error ending JD fact TTS response:", e?.message || e);
                    }
                    session.ended = true;
                }
                activeTtsSessions.delete(sessionKey);

                logTime("[AI] /respondAndSpeak JD fact duration", t0);
                console.log("🧠🔊 [AI] JD fact response streamed ✅\n");
                return;
            }

            endTtsSession(sessionKey, "preempted_by_new_request");

            const session = { res: reply.raw, interrupted: false, ended: false };
            activeTtsSessions.set(sessionKey, session);

            reply.raw.writeHead(200, {
                "Content-Type": "audio/mpeg",
                "Transfer-Encoding": "chunked",
            });

            // ✅ STRICT: greet once per sessionKey, deterministically (not model-dependent)
            const alreadyGreeted = greetedSessions.get(sessionKey) === true;
            if (!alreadyGreeted) {
                const name = candidateName || "there";
                const role = jobTitle || "the role";
                const greetingLine = `Hello ${name}, welcome to the interview for the ${role}.`;

                try {
                    const greetAudio = await aiService.speakText(greetingLine);
                    if (
                        greetAudio &&
                        Buffer.isBuffer(greetAudio) &&
                        greetAudio.length > 0 &&
                        !session.interrupted &&
                        !session.ended &&
                        activeTtsSessions.get(sessionKey) === session
                    ) {
                        reply.raw.write(greetAudio);
                    }
                } catch (e) {
                    console.warn("⚠️ [AI] Greeting TTS failed; continuing without blocking:", e?.message || e);
                }

                greetedSessions.set(sessionKey, true);
            }

            const systemMessages = [];

            // Tell the model not to greet if we've already greeted
            systemMessages.push({
                role: "system",
                content: `You have already greeted the candidate. Do NOT greet again. Ask ONE clear question only.`,
            });

            // Guardrail: never share scores/feedback during the interview
            systemMessages.push({
                role: "system",
                content: `
Score/feedback guardrail:
- If the candidate asks about their score, result, rating, pass/fail status, or requests feedback/evaluation, DO NOT provide it.
- Politely state that scores and feedback are shared after the interview, then continue with the next interview question.
- Stay concise and neutral; do not hint at performance.
                `.trim(),
            });

            if (technicalScript) {
                systemMessages.push({
                    role: "system",
                    content: `
You are an AI interviewer for the role "${jobTitle || "Engineering"}".
Follow this interview script strictly, asking ONE clear question at a time and waiting for the candidate's answer before moving on:
---
${technicalScript}
---
Keep questions concise and aligned with the script. Respond in plain text only (no bullet points, no markdown).
          `.trim(),
                });
            } else {
                systemMessages.push({
                    role: "system",
                    content: `
You are an AI interviewer. Ask ONE clear follow-up question at a time based only on the candidate's last answer.
Keep it short (single sentence) and relevant to ${jobTitle || "the role"}.
Respond in plain text only (no bullet points, no markdown).
          `.trim(),
                });
            }

            systemMessages.push({
                role: "system",
                content: `
Strict topic control:
- If the candidate asks a question unrelated to the interview topic or outside the current script question, do NOT answer it. Politely redirect them back to the interview and restate the current question.
- If the candidate asks for the answer, hints, examples, or solutions to an interview question, refuse to provide any of these. Say only: "If you're unsure about this question, that's okay. Let's move on to the next one." Then ask the next question.
- You may rephrase the current question for clarity ONLY - do NOT provide hints, suggestions, tips, examples, or any guidance that could point toward the answer. Just restate the question in different words if needed.
          `.trim(),
            });

            if (candidateName) {
                systemMessages.push({
                    role: "system",
                    content: `Use the candidate's name "${candidateName}" only when clarifying, not in every question.`,
                });
            }

            const messages = [...systemMessages, { role: "user", content: String(text) }];

            console.log("💬 [AI] Sending streaming request to OpenAI...", { model: FAST_INTERVIEW_MODEL });

            const stream = await openai.responses.stream({
                model: FAST_INTERVIEW_MODEL,
                input: messages,
                max_output_tokens: 120,
                temperature: 0.5,
            });

            const textStream = stream.toTextStream({ compatibleWithNodeStreams: false });

            let buffer = "";

            for await (const chunk of textStream) {
                if (session.interrupted || session.ended || activeTtsSessions.get(sessionKey) !== session) {
                    console.log("⏹️ [AI] Streaming interrupted mid-response for session:", sessionKey);
                    break;
                }

                const token = (chunk || "") + " ";
                if (!token.trim()) continue;

                buffer += token;

                const parts = buffer.split(SENTENCE_SEP);

                while (parts.length > 1) {
                    if (session.interrupted || session.ended || activeTtsSessions.get(sessionKey) !== session) {
                        console.log("⏹️ [AI] Streaming interrupted before TTS chunk for session:", sessionKey);
                        break;
                    }

                    const sentence = parts.shift()?.trim();
                    if (!sentence) continue;

                    const cleaned = sentence.replace(/[\s\.!\?,;:'"()\[\]{}\-–—…]+/g, "");
                    if (!cleaned) continue;

                    if (greetedSessions.get(sessionKey) === true) {
                        const lower = sentence.toLowerCase();
                        if (/(hello|hi|hey|welcome)/.test(lower) && /(interview|joining|welcome)/.test(lower)) {
                            console.log("?? [AI] Skipping duplicate greeting sentence:", sentence);
                            continue;
                        }
                    }

                    console.log("🧩 [AI] Sentence ready for TTS:", sentence);

                    const audioBuffer = await aiService.speakText(sentence);
                    if (
                        !session.interrupted &&
                        !session.ended &&
                        activeTtsSessions.get(sessionKey) === session &&
                        audioBuffer &&
                        Buffer.isBuffer(audioBuffer) &&
                        audioBuffer.length > 0
                    ) {
                        reply.raw.write(audioBuffer);
                    } else {
                        console.log("⏹️ [AI] Skipping audio write due to interruption/end for session:", sessionKey);
                        break;
                    }
                }

                buffer = parts.join("").trim();
            }

            if (!session.interrupted && !session.ended && activeTtsSessions.get(sessionKey) === session) {
                const tail = buffer.trim();
                if (tail) {
                    const cleanedTail = tail.replace(/\s+/g, "");
                    let skipTailGreeting = false;
                    if (greetedSessions.get(sessionKey) === true) {
                        const lower = tail.toLowerCase();
                        if (/(hello|hi|hey|welcome)/.test(lower) && /(interview|joining|welcome)/.test(lower)) {
                            console.log("?? [AI] Skipping duplicate greeting tail:", tail);
                            buffer = "";
                            skipTailGreeting = true;
                        }
                    }
                    if (cleanedTail && !skipTailGreeting) {
                        console.log("🧩 [AI] Tail sentence for TTS:", tail);
                        const audioBuffer = await aiService.speakText(tail);
                        if (
                            audioBuffer &&
                            Buffer.isBuffer(audioBuffer) &&
                            audioBuffer.length > 0 &&
                            !session.interrupted &&
                            !session.ended &&
                            activeTtsSessions.get(sessionKey) === session
                        ) {
                            reply.raw.write(audioBuffer);
                        }
                    }
                }
            }

            if (!session.ended) {
                try {
                    reply.raw.end();
                } catch (e) {
                    console.warn("[AI] Error ending TTS HTTP response:", e?.message || e);
                }
                session.ended = true;
            }
            activeTtsSessions.delete(sessionKey);

            logTime("[AI] /respondAndSpeak total duration", t0);
            console.log("🧠🔊 [AI] ===== /api/ai/respondAndSpeak finished =====\n");
        } catch (err) {
            console.error("❌ [AI] /respondAndSpeak error:", err?.message || err);

            endTtsSession(sessionKey, "error_in_stream");

            try {
                if (!reply.sent) {
                    reply.code(500).send({ error: err?.message || "Internal AI streaming error" });
                } else {
                    try {
                        reply.raw.end();
                    } catch {
                        // ignore
                    }
                }
            } catch {
                // ignore
            }
        }
    });

    // 🎥 Store WebRTC full recording (video+audio) in Firebase and link to InterviewSchedule + Conversation
    fastify.post(
        "/saveRecording",
        { bodyLimit: 10 * 200 * 1024 * 1024 }, // bumped, base64 inflates payload size
        async (req, reply) => {
            const t0 = Date.now();
            console.log("\n🎥 [MEDIA] ===== /api/ai/saveRecording =====");

            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

            try {
                const { candidateId, jobId, recordingData, interviewScheduleId } = req.body || {};

                console.log("📩 [MEDIA] Incoming:", {
                    hasCandidateId: !!candidateId,
                    hasJobId: !!jobId,
                    hasRecordingData: !!recordingData,
                    interviewScheduleId: interviewScheduleId || null,
                });

                if (!candidateId || !jobId || !recordingData) {
                    return reply.code(400).send({
                        ok: false,
                        error: "candidateId, jobId and recordingData are required",
                    });
                }

                if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
                    return reply.code(400).send({ ok: false, error: "Invalid candidateId or jobId" });
                }

                const { mime, ext } = detectMimeAndExt(recordingData);
                const buffer = decodeBase64ToBuffer(recordingData);

                console.log("📦 [MEDIA] Decoded bytes:", buffer?.length || 0, "| mime:", mime, "| ext:", ext);

                if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 1024) {
                    return reply.code(400).send({ ok: false, error: "Decoded recording buffer is empty/too small" });
                }

                const ts = Date.now();
                const rand = Math.random().toString(36).slice(2, 8);
                const clientKey = String(req.client || "global");

                // cleaner pathing makes ops sane
                //const filePath = `webrtcRecordings/${clientKey}/${candidateId}/${jobId}/${ts}_${rand}.${ext}`;
                const filePath = `newRecordings/${clientKey}/${candidateId}/${jobId}/${ts}_${rand}.${ext}`;
                console.log("📡 [MEDIA] Uploading to Firebase:", filePath);

                // 1 retry (because networks are not reliable and neither are we)
                let url = null;
                try {
                    await uploadBufferToFirebase(buffer, filePath, mime);
                    url = await getDownloadURL(filePath);
                } catch (e1) {
                    console.warn("⚠️ [MEDIA] Upload attempt #1 failed:", e1?.message || e1);
                    await sleep(400);
                    await uploadBufferToFirebase(buffer, filePath, mime);
                    url = await getDownloadURL(filePath);
                }

                if (!url) {
                    return reply.code(500).send({ ok: false, error: "Failed to generate recording URL" });
                }

                console.log("🌐 [MEDIA] Recording URL:", url);

                const candObjId = new mongoose.Types.ObjectId(candidateId);
                const jobObjId = new mongoose.Types.ObjectId(jobId);

                // Resolve LATEST schedule (preferred) or explicit scheduleId (if provided)
                const InterviewSchedule = req.conn.models["InterviewSchedule"];
                if (!InterviewSchedule) {
                    return reply.code(500).send({ ok: false, error: "InterviewSchedule model not registered" });
                }

                let latestSchedule = null;

                if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                    latestSchedule = await InterviewSchedule.findOne({
                        _id: new mongoose.Types.ObjectId(interviewScheduleId),
                        client: req.client,
                        isArchived: false,
                    })
                        .lean()
                        .exec();
                }

                if (!latestSchedule) {
                    latestSchedule = await InterviewSchedule.findOne({
                        client: req.client,
                        candidate: candObjId,
                        job: jobObjId,
                        isArchived: false,
                    })
                        .sort({ startAt: -1, createdAt: -1 })
                        .lean()
                        .exec();
                }

                if (!latestSchedule) {
                    // upload succeeded, but there’s no schedule to attach it to.
                    // still return url so frontend can show it.
                    console.warn("⚠️ [MEDIA] No InterviewSchedule found for candidate+job; returning URL only.");
                    return reply.send({ ok: true, url });
                }

                const scheduleId = latestSchedule._id;
                const interviewType = latestSchedule.interviewType || "Technical";
                const interviewerType = latestSchedule.interviewerType || "AI";
                console.log("📝 [MEDIA] Resolved schedule for recording", {
                    scheduleId: String(scheduleId),
                    usedExplicitScheduleId: !!(interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId))
                });

                // Update schedule (LATEST schedule always wins)
                try {
                    await InterviewSchedule.updateOne(
                        { _id: scheduleId, client: req.client },
                        {
                            $set: {
                                videoRecordingUrl: url,
                                videoRecordingUpdatedAt: new Date(),
                            },
                        }
                    ).exec();
                    console.log("📝 [MEDIA] InterviewSchedule updated:", String(scheduleId));
                } catch (e) {
                    console.warn("⚠️ [MEDIA] Failed to update InterviewSchedule.videoRecordingUrl:", e?.message || e);
                }

                // Update/Upsert Conversation with partition key (so report/PDF can recover)
                const Conversation = req.conn.models["Conversation"];
                if (Conversation) {
                    const filter = {
                        client: req.client,
                        candidateId: candObjId,
                        jobId: jobObjId,
                        interviewType,
                        interviewerType,
                        isArchived: false,
                    };
                    if (scheduleId) {
                        filter.interviewScheduleId = scheduleId;
                    }

                    const scheduleKey = scheduleId ? String(scheduleId) : "";
                    const callUUID = latestSchedule.webrtcLink
                        ? `webrtc_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`
                        : `manual_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`;

                    try {
                        await Conversation.findOneAndUpdate(
                            filter,
                            {
                                $setOnInsert: {
                                    callUUID,
                                    interviewType,
                                    interviewerType,
                                    interviewScheduleId: scheduleId,
                                },
                                $set: {
                                    video_url: url,
                                    updatedAt: new Date(),
                                },
                            },
                            { upsert: true, new: true }
                        ).exec();

                        console.log("🧷 [MEDIA] Conversation linked to video_url with key:", {
                            interviewType,
                            interviewerType,
                            scheduleId: String(scheduleId),
                        });
                    } catch (e) {
                        console.warn("⚠️ [MEDIA] Failed to upsert Conversation.video_url:", e?.message || e);
                    }
                } else {
                    console.warn("⚠️ [MEDIA] Conversation model missing, skipping Conversation link");
                }

                return reply.send({ ok: true, url, scheduleId: String(scheduleId) });
            } catch (err) {
                console.error("❌ [MEDIA] /saveRecording error:", err?.message || err);
                return reply.code(500).send({ ok: false, error: err?.message || "Failed to save recording" });
            } finally {
                console.log("🕒 [MEDIA] /saveRecording duration:", (Date.now() - t0).toFixed(0), "ms");
                console.log("========================================================\n");
            }
        }
    );

    // 📼 Stream WebRTC recording chunks to server (server-side assembly + upload)
    fastify.post(
        "/saveRecordingChunk",
        { bodyLimit: 25 * 1024 * 1024 },
        async (req, reply) => {
            const t0 = Date.now();
            let cleanupSessionId = null;
            try {
                const {
                    sessionId,
                    chunkData,
                    chunkIndex,
                    candidateId,
                    jobId,
                    interviewScheduleId,
                    contentType,
                    isFinal
                } = req.body || {};

                if (!sessionId || !candidateId || !jobId) {
                    return reply.code(400).send({
                        ok: false,
                        error: "sessionId, candidateId and jobId are required"
                    });
                }

                if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
                    return reply.code(400).send({ ok: false, error: "Invalid candidateId or jobId" });
                }

                ensureRecordingTmpDir();

                let session = recordingUploadSessions.get(sessionId);
                if (!session) {
                    const metaMime = contentType || "video/webm";
                    const { mime, ext } = detectMimeAndExt(chunkData, metaMime);
                    const filePath = path.join(RECORDING_TMP_DIR, `${sessionId}.${ext}`);
                    session = {
                        filePath,
                        mime,
                        ext,
                        candidateId,
                        jobId,
                        interviewScheduleId: interviewScheduleId || null,
                        createdAt: Date.now(),
                        sizeBytes: 0
                    };
                    recordingUploadSessions.set(sessionId, session);
                }

                if (chunkData) {
                    const buffer = decodeBase64ToBuffer(chunkData);
                    if (buffer && buffer.length > 0) {
                        await fs.promises.appendFile(session.filePath, buffer);
                        session.sizeBytes += buffer.length;
                    }
                }

                if (!isFinal) {
                    return reply.send({ ok: true, sessionId, chunkIndex: chunkIndex ?? null });
                }

                // Finalize upload: read assembled file and upload to Firebase
                if (!fs.existsSync(session.filePath)) {
                    return reply.code(404).send({ ok: false, error: "Recording file not found" });
                }

                const buffer = await fs.promises.readFile(session.filePath);
                if (!buffer || buffer.length < 1024) {
                    return reply.code(400).send({ ok: false, error: "Recording file too small" });
                }

                const ts = Date.now();
                const rand = Math.random().toString(36).slice(2, 8);
                const clientKey = String(req.client || "global");
                //const filePath = `webrtcRecordings/${clientKey}/${candidateId}/${jobId}/${ts}_${rand}.${session.ext}`;
                const filePath = `newRecordings/${clientKey}/${candidateId}/${jobId}/${ts}_${rand}.${session.ext}`;
                await uploadBufferToFirebase(buffer, filePath, session.mime || "video/webm");
                const url = await getDownloadURL(filePath);

                const candObjId = new mongoose.Types.ObjectId(candidateId);
                const jobObjId = new mongoose.Types.ObjectId(jobId);

                const InterviewSchedule = req.conn.models["InterviewSchedule"];
                if (!InterviewSchedule) {
                    return reply.code(500).send({ ok: false, error: "InterviewSchedule model not registered" });
                }

                let latestSchedule = null;
                if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                    latestSchedule = await InterviewSchedule.findOne({
                        _id: new mongoose.Types.ObjectId(interviewScheduleId),
                        client: req.client,
                        isArchived: false
                    })
                        .lean()
                        .exec();
                }

                if (!latestSchedule) {
                    latestSchedule = await InterviewSchedule.findOne({
                        client: req.client,
                        candidate: candObjId,
                        job: jobObjId,
                        isArchived: false
                    })
                        .sort({ startAt: -1, createdAt: -1 })
                        .lean()
                        .exec();
                }

                if (!latestSchedule) {
                    return reply.send({ ok: true, url });
                }

                const scheduleId = latestSchedule._id;
                const interviewType = latestSchedule.interviewType || "Technical";
                const interviewerType = latestSchedule.interviewerType || "AI";

                try {
                    await InterviewSchedule.updateOne(
                        { _id: scheduleId, client: req.client },
                        {
                            $set: {
                                videoRecordingUrl: url,
                                videoRecordingUpdatedAt: new Date()
                            }
                        }
                    ).exec();
                } catch (e) {
                    console.warn("⚠️ [MEDIA] Failed to update InterviewSchedule.videoRecordingUrl:", e?.message || e);
                }

                const Conversation = req.conn.models["Conversation"];
                if (Conversation) {
                    const filter = {
                        client: req.client,
                        candidateId: candObjId,
                        jobId: jobObjId,
                        interviewType,
                        interviewerType,
                        isArchived: false
                    };
                    if (scheduleId) {
                        filter.interviewScheduleId = scheduleId;
                    }

                    const scheduleKey = scheduleId ? String(scheduleId) : "";
                    const callUUID = latestSchedule.webrtcLink
                        ? `webrtc_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`
                        : `manual_${jobId}_${candidateId}${scheduleKey ? `_${scheduleKey}` : ""}`;

                    try {
                        await Conversation.findOneAndUpdate(
                            filter,
                            {
                                $setOnInsert: {
                                    callUUID,
                                    interviewType,
                                    interviewerType,
                                    interviewScheduleId: scheduleId
                                },
                                $set: {
                                    video_url: url,
                                    updatedAt: new Date()
                                }
                            },
                            { upsert: true, new: true }
                        ).exec();
                    } catch (e) {
                        console.warn("⚠️ [MEDIA] Failed to upsert Conversation.video_url:", e?.message || e);
                    }
                }

                cleanupSessionId = sessionId;
                return reply.send({ ok: true, url, scheduleId: String(scheduleId) });
            } catch (err) {
                console.error("❌ [MEDIA] /saveRecordingChunk error:", err?.message || err);
                return reply.code(500).send({ ok: false, error: err?.message || "Failed to save recording chunk" });
            } finally {
                try {
                    if (cleanupSessionId) {
                        const session = recordingUploadSessions.get(cleanupSessionId);
                        if (session?.filePath && fs.existsSync(session.filePath)) {
                            fs.unlinkSync(session.filePath);
                        }
                        recordingUploadSessions.delete(cleanupSessionId);
                    }
                } catch {
                    // ignore cleanup errors
                }
                console.log("🕒 [MEDIA] /saveRecordingChunk duration:", (Date.now() - t0).toFixed(0), "ms");
            }
        }
    );


    /* =========================================================
     * Generate interview script from saved parameters (UPDATED: tagged)
     * POST /api/ai/generateTechnicalScript
     * ========================================================= */
    fastify.post("/generateTechnicalScript", async (req, reply) => {
        const t0 = Date.now();
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\n📜 [SCRIPT][${rid}] ===== /api/ai/generateTechnicalScript =====`);

        try {
            const {
                candidate,
                job,
                roundType,
                interviewType,
                difficultyLevel,
                selectedBlueprint,
                scriptStyle,
                durationMinutes,
            } = req.body || {};

            const type = interviewType || "Technical";
            const level = difficultyLevel || "Intermediate";

            console.log(`[SCRIPT][${rid}] Input:`, {
                type,
                level,
                hasCandidate: !!candidate,
                hasJob: !!job,
                hasSelectedBlueprint: Array.isArray(selectedBlueprint) && selectedBlueprint.length > 0,
                durationMinutes,
                selectedGroups: Array.isArray(selectedBlueprint) ? selectedBlueprint.map((g) => g?.name) : [],
            });

            if (Array.isArray(selectedBlueprint) && selectedBlueprint.length > 0) {
                const { system, user } = buildScriptFromSelectedBlueprintPrompt({
                    interviewType: type,
                    difficultyLevel: level,
                    candidate,
                    job,
                    selectedBlueprint,
                    scriptStyle: scriptStyle || "Compact",
                    durationMinutes,
                    logContext: { rid },
                });

                const completion = await chatCompletionByOpenAI(
                    [
                        { role: "system", content: system },
                        { role: "user", content: user },
                    ],
                    req
                );

                const script = (completion?.choices?.[0]?.message?.content || "").trim();

                if (!script) {
                    return reply.code(500).send({ ok: false, error: "Script generation returned empty output" });
                }

                console.log(`[SCRIPT][${rid}] ✅ Generated tagged script length:`, script.length);
                logTime(`[SCRIPT][${rid}] duration`, t0);

                return reply.send({
                    ok: true,
                    roundType: roundType || "First technical screening round",
                    script,
                });
            }

            // Fallback to templates if no blueprint
            let script;
            if (type === "HR") script = await interviewSvc.buildHRScriptTemplate({ candidate, job });
            else if (type === "Psychometric") script = await interviewSvc.buildPsychometricScriptTemplate({ candidate, job });
            else if (type === "Non-Technical") script = await interviewSvc.buildNonTechnicalScriptTemplate({ candidate, job });
            else script = await interviewSvc.buildTechnicalScriptTemplate({ candidate, job });

            logTime(`[SCRIPT][${rid}] fallback template`, t0);

            return reply.send({
                ok: true,
                roundType: roundType || "First technical screening round",
                script,
            });
        } catch (err) {
            fastify.log.error({ err }, "Failed to generate interview script");
            return reply.code(500).send({ ok: false, error: "Failed to generate interview script" });
        } finally {
            console.log("========================================================\n");
        }
    });

    /**
    * Extract text from PDF for coding problem generation
    * POST /api/ai/extractPdfText
    */
    fastify.post("/extractPdfText", async (req, reply) => {
        const t0 = Date.now();
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\n[PDF][${rid}] ===== /api/ai/extractPdfText =====`);

        try {
            const body = req.body || {};
            const candidate = body.pdf || body.file || body.document || body.upload;
            const fileObj = Array.isArray(candidate) ? candidate[0] : candidate;

            if (!fileObj) {
                return reply.code(400).send({ ok: false, error: "PDF file is required" });
            }

            const filename = String(fileObj?.filename || fileObj?.name || "document.pdf");
            const mimetype = String(fileObj?.mimetype || fileObj?.type || "").toLowerCase();
            const isPdf = mimetype.includes("pdf") || filename.toLowerCase().endsWith(".pdf");
            if (!isPdf) {
                return reply.code(400).send({ ok: false, error: "Only PDF files are supported" });
            }

            let buffer = null;
            if (Buffer.isBuffer(fileObj?._buf)) buffer = fileObj._buf;
            else if (Buffer.isBuffer(fileObj?.buffer)) buffer = fileObj.buffer;
            else if (typeof fileObj?.toBuffer === "function") buffer = await fileObj.toBuffer();
            else if (typeof fileObj?.file?.toBuffer === "function") buffer = await fileObj.file.toBuffer();
            else if (Buffer.isBuffer(fileObj?.file)) buffer = fileObj.file;
            else if (fileObj?.filepath && fs.existsSync(fileObj.filepath)) {
                buffer = fs.readFileSync(fileObj.filepath);
            }

            if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
                return reply.code(400).send({ ok: false, error: "Unable to read PDF buffer" });
            }

            const extracted = await extractPdfText(buffer, filename);
            const cleaned = normalizeMultilineText(extracted)
                .replace(/[ \t]+/g, " ")
                .replace(/\n{3,}/g, "\n\n")
                .trim();

            const maxChars = 15000;
            const clipped = cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;

            logTime(`[PDF][${rid}] duration`, t0);
            return reply.send({
                ok: true,
                text: clipped,
                textLength: clipped.length,
                truncated: cleaned.length > maxChars,
            });
        } catch (err) {
            fastify.log.error({ err }, "Failed to extract PDF text");
            return reply.code(500).send({ ok: false, error: "Failed to extract PDF text" });
        } finally {
            console.log("========================================================\n");
        }
    });

    /**
     * Generate coding problem + test cases
     * POST /api/ai/generateCodingProblem
     */
    fastify.post("/generateCodingProblem", async (req, reply) => {
        const t0 = Date.now();
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\ndY"o [CODING][${rid}] ===== /api/ai/generateCodingProblem =====`);

        try {
            const { questionType, difficultyLevel, testCaseCount, job, pdfText } = req.body || {};

            const count = clampNum(Number(testCaseCount), 1, 10, 4);
            const typeRaw = String(questionType || "DSA").trim();
            const wantsPdf = typeRaw.toLowerCase().includes("pdf");
            const type = wantsPdf
                ? "PDF Based"
                : typeRaw.toLowerCase().includes("scenario")
                    ? "Scenario Based"
                    : "DSA";
            const levelRaw = String(difficultyLevel || "Medium").trim();
            const levelKey = levelRaw.toLowerCase();
            const level =
                levelKey === "easy"
                    ? "Easy"
                    : levelKey === "hard"
                        ? "Hard"
                        : levelKey === "medium" || levelKey === "intermediate"
                            ? "Medium"
                            : "Medium";

            const jobTitle = normalizePlainText(job?.title || job?.internalTitle || "");
            const skills = Array.isArray(job?.primarySkills)
                ? job.primarySkills.map((s) => normalizePlainText(s)).filter(Boolean)
                : [];
            const description = normalizePlainText(job?.description || "");

            const contextLines = [
                jobTitle ? `Job title: ${jobTitle}` : null,
                skills.length ? `Primary skills: ${skills.join(", ")}` : null,
                description ? `Job description: ${description}` : null,
            ].filter(Boolean);

            const pdfRaw = typeof pdfText === "string" ? pdfText : "";
            const hasPdfContext = pdfRaw.trim().length > 0;
            if (wantsPdf && !hasPdfContext) {
                return reply.code(400).send({ ok: false, error: "pdfText is required for Upload PDF" });
            }

            const pdfContext = hasPdfContext
                ? normalizeMultilineText(pdfRaw)
                    .replace(/[ \t]+/g, " ")
                    .replace(/\n{3,}/g, "\n\n")
                    .trim()
                : "";
            const pdfSnippet = pdfContext.length > 6000 ? pdfContext.slice(0, 6000) : pdfContext;

            const system = [
                "You are a coding interview problem generator.",
                "Output ONLY valid JSON. Do not use markdown or code fences.",
                "Use only ASCII characters.",
            ].join(" ");

            const typeRules = wantsPdf
                ? [
                    "- Use the PDF context as inspiration, but do not copy text.",
                    "- The problem must still be solvable as a standalone coding task.",
                ]
                : type === "Scenario Based"
                    ? [
                        "- Use a realistic business or product scenario.",
                        "- The scenario must drive the input/output format and constraints.",
                    ]
                    : [
                        "- Pure algorithmic/DSA problem (arrays/strings/graphs/etc).",
                        "- Avoid business-story framing; focus on algorithmic formulation.",
                    ];

            const difficultyRules = [
                `- Difficulty must strictly match: ${level}.`,
                "- Easy: 1-2 simple steps, small constraints, straightforward solution.",
                "- Medium: moderate constraints, 2-3 steps, non-trivial but common patterns.",
                "- Hard: large constraints or complex logic; requires optimization and careful edge handling.",
                "- Constraints must be chosen to match the difficulty (i.e., they must imply the intended time complexity).",
            ];

            const pdfLines = pdfSnippet
                ? [
                    "Reference PDF text (use as inspiration only; do not copy verbatim):",
                    pdfSnippet,
                    "",
                ]
                : [];
            const clientKey = String(req.client || "global");
            const pdfKey = hasPdfContext
                ? crypto.createHash("sha1").update(pdfSnippet).digest("hex").slice(0, 10)
                : "nopdf";
            const recentKey = `${clientKey}|${type}|${level}|${pdfKey}`;
            const maxAttempts = 3;
            let normalized = null;

            const buildUserPrompt = ({ attempt, variationSeed, avoidTitles }) => {
                const avoidLines = avoidTitles.length
                    ? [
                        "Avoid repeating any of these recently generated problem titles or descriptions:",
                        ...avoidTitles.map((t) => `- ${t}`),
                        "The new problem must be materially different in core task and solution approach.",
                    ]
                    : [];
                const retryLine = attempt > 0
                    ? "Retry: the previous problem matched a recent one. Generate a different problem with a different core task and approach."
                    : null;
                const userLines = [
                    `Generate a ${type} coding problem.`,
                    `Difficulty: ${level} (strict).`,
                    contextLines.length ? `Context:\n${contextLines.join("\n")}` : "Context: generic software role.",
                    ...pdfLines,
                    `Variation seed: ${variationSeed}. Use it to create a different problem.`,
                    retryLine,
                    ...avoidLines,
                    "",
                    "Return a JSON object with EXACT keys:",
                    "title (string), description (string), constraints (array of strings),",
                    "signature (object with functionName, params array, returnType),",
                    "examples (array with 1 object: input, output, explanation),",
                    `testCases (array of ${count} objects: args array, expected value).`,
                    "",
                    "EXAMPLE (you MUST follow this exact structure):",
                    '{"title":"Find Max","description":"...","constraints":["..."],"signature":{"functionName":"findMax","params":[{"name":"arr","type":"int[]"}],"returnType":"int"},"examples":[{"input":"...","output":"...","explanation":"..."}],"testCases":[{"args":[[1,2,3]],"expected":6}]}',
                    "",
                    "CRITICAL: signature object MUST contain functionName, params, and returnType.",
                    "Signature format:",
                    '{ "functionName": "camelCaseName", "params": [{"name": "arr", "type": "int[]"}], "returnType": "int" }',
                    "Supported types: int, string, boolean, int[], string[], int[][], string[][], etc.",
                    "",
                    "TestCase format (use args and expected, NOT input/output):",
                    '{ "args": [[1,2,3], 5], "expected": 2 }',
                    "- args must be an array matching the params in signature",
                    "- expected must be the return value matching returnType",
                    "Do not include any 'Expected Approach'/'Solution'/'Algorithm'/'Hints' sections in any field.",
                    "",
                    "Rules:",
                    ...typeRules,
                    ...difficultyRules,
                    "- description must include clear input/output format.",
                    "- outputFormat must specify exactly what to print and formatting details.",
                    "- examples and testCases must be valid for the described problem.",
                    "- testCases count must match exactly.",
                    "- signature.functionName must be descriptive camelCase (e.g., findMaxSum, firstIndexQueries).",
                    "- signature.params must match the problem inputs.",
                    "- All testCases must use args/expected format (NOT input/output strings).",
                ];
                return userLines.filter((line) => line !== null && line !== undefined).join("\n");
            };

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const recentProblems = getRecentCodingProblemList(recentKey);
                const avoidTitles = recentProblems
                    .map((item) => item.title)
                    .filter(Boolean)
                    .slice(-5);
                const variationSeed = crypto.randomUUID?.() || String(Date.now());
                const user = buildUserPrompt({ attempt, variationSeed, avoidTitles });

                const completion = await chatCompletionByOpenAI(
                    [
                        { role: "system", content: system },
                        { role: "user", content: user },
                    ],
                    req,
                    attempt > 0 ? 0.7 : 0.4
                );

                const raw = normalizePlainText(completion?.choices?.[0]?.message?.content || "");

                //!DEBUG
                console.log(`\n[CODING][${rid}] ========== RAW AI RESPONSE (attempt ${attempt + 1}) ==========`);
                console.log(raw);
                console.log(`[CODING][${rid}] =====================================\n`);

                const parsed = safeJsonParse(raw);
                if (!parsed) {
                    console.warn("[CODING] Failed to parse JSON from model output");
                    return reply.code(500).send({ ok: false, error: "Invalid model output" });
                }

                //!DEBUG
                console.log(`[CODING][${rid}] ========== PARSED JSON (attempt ${attempt + 1}) ==========`);
                console.log(JSON.stringify(parsed, null, 2));
                console.log(`[CODING][${rid}] =================================\n`);

                normalized = normalizeCodingProblem(parsed, { testCaseCount: count });
                //!DEBUG
                console.log(`[CODING][${rid}] ========== NORMALIZED PROBLEM (attempt ${attempt + 1}) ==========`);
                console.log(JSON.stringify(normalized, null, 2));
                console.log(`[CODING][${rid}] ========================================\n`);
                if (!normalized.title || !normalized.description) {
                    return reply.code(500).send({ ok: false, error: "Generated problem missing title or description" });
                }

                if (isRecentCodingProblemDuplicate(recentKey, normalized)) {
                    console.warn(`[CODING][${rid}] Duplicate problem detected; retrying.`);
                    normalized = null;
                    continue;
                }

                // Validate signature (required for JSON harness)
                if (!normalized.signature || !normalized.signature.functionName || !normalized.signature.functionName.trim()) {
                    console.error("[CODING] AI failed to generate signature.functionName:", normalized.signature);
                    return reply.code(500).send({
                        ok: false,
                        error: "AI failed to generate function signature. Please try again.",
                        details: "Missing functionName in signature"
                    });
                }
                if (!Array.isArray(normalized.signature.params)) {
                    console.error("[CODING] AI failed to generate signature.params:", normalized.signature);
                    return reply.code(500).send({
                        ok: false,
                        error: "AI failed to generate function parameters. Please try again.",
                        details: "Missing or invalid params in signature"
                    });
                }
                if (!normalized.signature.returnType || !normalized.signature.returnType.trim()) {
                    console.error("[CODING] AI failed to generate signature.returnType:", normalized.signature);
                    return reply.code(500).send({
                        ok: false,
                        error: "AI failed to generate return type. Please try again.",
                        details: "Missing returnType in signature"
                    });
                }

                // Validate test cases format
                if (!Array.isArray(normalized.testCases) || normalized.testCases.length !== count) {
                    return reply.code(500).send({ ok: false, error: "Generated test case count mismatch" });
                }

                // Ensure all test cases have args and expected (JSON harness format)
                for (let i = 0; i < normalized.testCases.length; i++) {
                    const tc = normalized.testCases[i];
                    if (tc.args === undefined || tc.expected === undefined) {
                        console.error(`[CODING] Test case ${i + 1} missing args/expected:`, tc);
                        return reply.code(500).send({
                            ok: false,
                            error: `AI generated invalid test case format. Test case ${i + 1} must have args and expected fields.`,
                            details: "Test cases must use JSON harness format (args/expected)"
                        });
                    }
                }

                logTime(`[CODING][${rid}] duration`, t0);
                rememberRecentCodingProblem(recentKey, normalized);
                return reply.send({ ok: true, problem: normalized });
            }
            return reply.code(500).send({ ok: false, error: "Failed to generate a unique coding problem" });
        } catch (err) {
            fastify.log.error({ err }, "Failed to generate coding problem");
            return reply.code(500).send({ ok: false, error: "Failed to generate coding problem" });
        } finally {
            console.log("========================================================\n");
        }
    });

    /**
     * Generate boilerplate code for a coding problem + language
     * POST /api/ai/generateCodingBoilerplate
     * 
     * NOW USES DETERMINISTIC TEMPLATES (no AI)
     */
    fastify.post("/generateCodingBoilerplate", async (req, reply) => {
        const t0 = Date.now();
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\n[CODING][${rid}] ===== /api/ai/generateCodingBoilerplate =====`);

        try {
            const { problem, language } = req.body || {};
            const languageName = normalizePlainText(language?.name || language?.label || language || "");

            if (!languageName) {
                return reply.code(400).send({ ok: false, error: "language is required" });
            }
            if (!problem?.signature) {
                return reply.code(400).send({ ok: false, error: "problem signature is required" });
            }

            // Use deterministic template (no AI)
            const { generateBoilerplate } = await import('../../utils/driverTemplates.js');

            const code = generateBoilerplate({
                language: languageName,
                signature: problem.signature,
                className: problem.signature.className || "Solution"
            });

            logTime(`[CODING][${rid}] boilerplate duration`, t0);
            return reply.send({ ok: true, code });
        } catch (err) {
            fastify.log.error({ err }, "Failed to generate coding boilerplate");
            return reply.code(500).send({ ok: false, error: err.message || "Failed to generate coding boilerplate" });
        } finally {
            console.log("========================================================\n");
        }
    });

    /**
     * Store remote proctoring / anti-cheat snapshot for this interview
     * POST /api/ai/saveAntiCheat
     */
    fastify.post("/saveAntiCheat", async (req, reply) => {
        const t0 = Date.now();
        // console.log("\n🛡 [PROCTOR] ===== /api/ai/saveAntiCheat =====");

        try {
            const { candidateId, jobId, antiCheat, interviewScheduleId } = req.body || {};
            // console.log("[PROCTOR] Incoming:", { candidateId, jobId, interviewScheduleId: interviewScheduleId || null, hasAntiCheat: !!antiCheat });

            if (!candidateId || !jobId || !antiCheat) {
                console.warn("⚠️ [PROCTOR] Missing candidateId, jobId or antiCheat payload");
                return reply.code(400).send({ ok: false, error: "candidateId, jobId and antiCheat are required" });
            }

            if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
                console.warn("⚠️ [PROCTOR] Invalid candidateId or jobId format");
                return reply.code(400).send({ ok: false, error: "Invalid candidateId or jobId" });
            }

            const InterviewSchedule = req.conn.models["InterviewSchedule"];
            if (!InterviewSchedule) {
                console.warn("⚠️ [PROCTOR] InterviewSchedule model not registered on connection");
                return reply.code(500).send({ ok: false, error: "InterviewSchedule model not registered" });
            }

            const candObjId = new mongoose.Types.ObjectId(candidateId);
            const jobObjId = new mongoose.Types.ObjectId(jobId);

            const filter = { client: req.client, candidate: candObjId, job: jobObjId, isArchived: false };
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                filter._id = new mongoose.Types.ObjectId(interviewScheduleId);
            }
            const update = {
                $set: {
                    remoteProctoring: {
                        ...(antiCheat || {}),
                        updatedAt: new Date(),
                    },
                },
            };

            const updated = await InterviewSchedule.findOneAndUpdate(filter, update, { new: true, sort: { startAt: -1 } })
                .lean()
                .exec();

            if (!updated) {
                console.warn("⚠️ [PROCTOR] InterviewSchedule not found for candidate+job");
                return reply.code(404).send({ ok: false, error: "InterviewSchedule not found" });
            }

            console.log("[PROCTOR] remoteProctoring snapshot stored on InterviewSchedule", {
                scheduleId: updated._id.toString(),
                usedExplicitScheduleId: !!(interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)),
                remoteProctoring: updated.remoteProctoring,
            });

            return reply.send({ ok: true });
        } catch (err) {
            console.error("❌ [PROCTOR] /saveAntiCheat error:", err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || "Failed to store anti-cheat snapshot" });
        } finally {
            // console.log("🕒 [PROCTOR] /saveAntiCheat duration:", (Date.now() - t0).toFixed(0), "ms");
            // console.log("========================================================\n");
        }
    });

    /**
     * Incremental anti-cheat event (server-side processing)
     * POST /api/ai/antiCheat/event
     */
    fastify.post("/antiCheat/event", async (req, reply) => {
        const t0 = Date.now();
        try {
            const { candidateId, jobId, interviewScheduleId, reason, meta } = req.body || {};

            if (!candidateId || !jobId || !reason) {
                return reply.code(400).send({ ok: false, error: "candidateId, jobId and reason are required" });
            }

            if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
                return reply.code(400).send({ ok: false, error: "Invalid candidateId or jobId" });
            }

            const InterviewSchedule = req.conn.models["InterviewSchedule"];
            if (!InterviewSchedule) {
                return reply.code(500).send({ ok: false, error: "InterviewSchedule model not registered" });
            }

            const candObjId = new mongoose.Types.ObjectId(candidateId);
            const jobObjId = new mongoose.Types.ObjectId(jobId);

            const filter = { client: req.client, candidate: candObjId, job: jobObjId, isArchived: false };
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                filter._id = new mongoose.Types.ObjectId(interviewScheduleId);
            }

            const schedule = await InterviewSchedule.findOne(filter)
                .sort({ startAt: -1, createdAt: -1 })
                .lean()
                .exec();

            if (!schedule) {
                return reply.code(404).send({ ok: false, error: "InterviewSchedule not found" });
            }

            const prev = schedule.remoteProctoring || {};
            const prevReasonCounts = prev.reasonCounts || {};
            const nextReasonCounts = {
                ...prevReasonCounts,
                [reason]: (prevReasonCounts[reason] || 0) + 1
            };

            const isTabRelated = reason === "TAB_HIDDEN" || reason === "WINDOW_BLUR";
            const nextTabSwitchCount = (prev.tabSwitchCount || 0) + (isTabRelated ? 1 : 0);
            const nextViolationCount = (prev.violationCount || 0) + 1;

            const nextState = {
                ...prev,
                tabSwitchCount: nextTabSwitchCount,
                violationCount: nextViolationCount,
                lastViolationReason: reason,
                reasonCounts: nextReasonCounts,
                lastViolationMeta: meta || null,
                updatedAt: new Date()
            };

            const updated = await InterviewSchedule.findOneAndUpdate(
                filter,
                { $set: { remoteProctoring: nextState } },
                { new: true, sort: { startAt: -1, createdAt: -1 } }
            )
                .lean()
                .exec();

            const cfg = updated?.antiCheatConfig || {};
            const tabSwitchLimit = typeof cfg.tabSwitchLimit === "number" ? cfg.tabSwitchLimit : 3;
            const autoEndOnViolation = cfg.autoEndOnViolation === true;
            const shouldEnd =
                autoEndOnViolation &&
                tabSwitchLimit >= 0 &&
                nextTabSwitchCount > tabSwitchLimit;

            return reply.send({
                ok: true,
                state: {
                    tabSwitchCount: nextTabSwitchCount,
                    violationCount: nextViolationCount,
                    lastViolationReason: reason,
                    reasonCounts: nextReasonCounts
                },
                shouldEnd
            });
        } catch (err) {
            console.error("❌ [PROCTOR] /antiCheat/event error:", err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || "Failed to process anti-cheat event" });
        } finally {
            console.log("🕒 [PROCTOR] /antiCheat/event duration:", (Date.now() - t0).toFixed(0), "ms");
        }
    });

    // End interview event - server-side finalize/evaluate
    fastify.post("/endInterview", async (req, reply) => {
        try {
            const { candidateId, jobId, interviewScheduleId } = req.body || {};
            const rid = crypto.randomUUID?.() || String(Date.now());
            // console.log(`[END INTERVIEW][${rid}] Incoming`, {
            //     candidateId,
            //     jobId,
            //     interviewScheduleId: interviewScheduleId || null,
            // });
            const InterviewSchedule = req.conn.models["InterviewSchedule"];
            const Submission = req.conn.models["Submission"];

            if (!InterviewSchedule) {
                console.warn(`[END INTERVIEW][${rid}] InterviewSchedule model not found`);
                return reply.code(500).send({ ok: false, error: "InterviewSchedule model not found" });
            }

            let schedule = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                schedule = await InterviewSchedule.findOne({
                    _id: new mongoose.Types.ObjectId(interviewScheduleId),
                    client: req.client,
                    isArchived: false,
                })
                    .lean()
                    .exec();
            }

            const candidateOk = candidateId && mongoose.Types.ObjectId.isValid(candidateId);
            const jobOk = jobId && mongoose.Types.ObjectId.isValid(jobId);

            if (!schedule && candidateOk && jobOk) {
                schedule = await InterviewSchedule.findOne({
                    client: req.client,
                    candidate: new mongoose.Types.ObjectId(candidateId),
                    job: new mongoose.Types.ObjectId(jobId),
                    isArchived: false,
                })
                    .sort({ startAt: -1 })
                    .lean()
                    .exec();
            }

            if (!schedule) {
                console.warn(`[END INTERVIEW][${rid}] InterviewSchedule not found`, {
                    candidateId,
                    jobId,
                    interviewScheduleId: interviewScheduleId || null,
                });
                return reply.code(404).send({ ok: false, error: "InterviewSchedule not found" });
            }

            const scheduledEndAt = schedule.startAt
                ? new Date(new Date(schedule.startAt).getTime() + (schedule.durationMinutes || 45) * 60000)
                : null;
            const now = new Date();
            const endedAt = schedule.endedAt || (scheduledEndAt && now > scheduledEndAt ? scheduledEndAt : now);
            const computedActualMinutes = schedule.startAt
                ? Math.round((endedAt - new Date(schedule.startAt)) / 60000)
                : null;
            console.log(`[END INTERVIEW][${rid}] Duration audit`, {
                scheduleId: schedule._id?.toString?.() || String(schedule._id || ""),
                startAt: schedule.startAt,
                existingEndedAt: schedule.endedAt,
                scheduledDurationMinutes: schedule.durationMinutes || 45,
                scheduledEndAt,
                nowAtCallTime: now,
                resolvedEndedAt: endedAt,
                computedActualMinutes,
                wasEndedAtAlreadySet: !!schedule.endedAt,
            });
            const rawStatus = String(schedule.interviewStatus || "").toLowerCase();
            const preserveStatus = rawStatus.includes("cancel");
            const interviewStatus = preserveStatus ? schedule.interviewStatus : "Completed";
            // console.log(`[END INTERVIEW][${rid}] Schedule resolved`, {
            //     scheduleId: schedule._id?.toString?.() || String(schedule._id || ""),
            //     roundType: schedule.roundType,
            //     interviewerType: schedule.interviewerType,
            //     hasEvaluation: !!schedule.evaluation,
            // });

            await InterviewSchedule.findOneAndUpdate(
                { _id: schedule._id, client: req.client },
                { $set: { endedAt, interviewStatus } },
                { new: true }
            )
                .lean()
                .exec();

            try {
                await interviewSvc.consumeVideoInterviewCreditIfEligible({
                    scheduleId: schedule._id,
                    clientId: schedule.client,
                    dbName: req.dbName,
                    referenceTime: endedAt
                });
            } catch (creditErr) {
                console.warn(`[END INTERVIEW][${rid}] Failed to finalize video interview credit:`, creditErr?.message || creditErr);
            }

            const scheduleId = schedule._id?.toString?.() || String(schedule._id || "");
            const resolvedCandidateId =
                schedule.candidate?.toString?.() || candidateId || null;
            const resolvedJobId = schedule.job?.toString?.() || jobId || null;
            const bodyAuthToken = resolveBodyAuthToken(req);
            const authHeader = req.headers.authorization || (bodyAuthToken ? `Bearer ${bodyAuthToken}` : undefined);
            const cookieHeader = req.headers.cookie;
            // console.log(`[END INTERVIEW][${rid}] Marked ended`, {
            //     scheduleId,
            //     interviewStatus,
            //     endedAt: endedAt instanceof Date ? endedAt.toISOString() : endedAt,
            // });

            setImmediate(async () => {
                try {
                    if (schedule.roundType === "Coding" && Submission && resolvedCandidateId) {
                        console.log(`[END INTERVIEW][${rid}] Finalizing coding submissions`, {
                            scheduleId,
                            candidateId: resolvedCandidateId,
                        });
                        const candidateObjId = mongoose.Types.ObjectId.isValid(resolvedCandidateId)
                            ? new mongoose.Types.ObjectId(resolvedCandidateId)
                            : null;

                        if (candidateObjId) {
                            const nonTerminalStatuses = ['queued', 'running'];
                            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                            const waitForBestCompletedSubmission = async (maxAttempts = 12, delayMs = 1500) => {
                                for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
                                    const completedBest = await Submission.findOne({
                                        interviewId: schedule._id,
                                        userId: candidateObjId,
                                        status: { $nin: nonTerminalStatuses },
                                    })
                                        .sort({ passedTestCases: -1, createdAt: -1 })
                                        .lean()
                                        .exec();

                                    if (completedBest) {
                                        if (attempt > 1) {
                                            console.log(`[END INTERVIEW][${rid}] Completed submission settled`, {
                                                scheduleId,
                                                attempt,
                                                submissionId: completedBest._id?.toString?.() || String(completedBest._id || ""),
                                            });
                                        }
                                        return completedBest;
                                    }

                                    const pendingCount = await Submission.countDocuments({
                                        interviewId: schedule._id,
                                        userId: candidateObjId,
                                        status: { $in: nonTerminalStatuses },
                                    });

                                    if (pendingCount <= 0) {
                                        return null;
                                    }

                                    if (attempt < maxAttempts) {
                                        await wait(delayMs);
                                    }
                                }

                                return Submission.findOne({
                                    interviewId: schedule._id,
                                    userId: candidateObjId,
                                    status: { $nin: nonTerminalStatuses },
                                })
                                    .sort({ passedTestCases: -1, createdAt: -1 })
                                    .lean()
                                    .exec();
                            };

                            const existingFinal = await Submission.findOne({
                                interviewId: schedule._id,
                                userId: candidateObjId,
                                isFinalSubmission: true,
                            })
                                .lean()
                                .exec();

                            const existingFinalIsTerminal = Boolean(
                                existingFinal && !nonTerminalStatuses.includes(String(existingFinal?.status || '').toLowerCase())
                            );

                            if (!existingFinalIsTerminal) {
                                if (existingFinal) {
                                    console.log(`[END INTERVIEW][${rid}] Existing final submission is non-terminal; recalculating`, {
                                        scheduleId,
                                        finalSubmissionId:
                                            existingFinal._id?.toString?.() || String(existingFinal._id || ""),
                                        status: existingFinal.status,
                                    });
                                }

                                const best = await waitForBestCompletedSubmission();

                                if (best) {
                                    await Submission.updateMany(
                                        {
                                            userId: best.userId,
                                            problemId: best.problemId,
                                            interviewId: best.interviewId,
                                            _id: { $ne: best._id },
                                        },
                                        { isFinalSubmission: false }
                                    );
                                    await Submission.findByIdAndUpdate(
                                        best._id,
                                        { $set: { isFinalSubmission: true } },
                                        { new: true }
                                    );
                                    console.log(`[END INTERVIEW][${rid}] Final submission set`, {
                                        scheduleId,
                                        finalSubmissionId: best._id?.toString?.() || String(best._id || ""),
                                    });
                                } else {
                                    console.log(`[END INTERVIEW][${rid}] No completed submissions found to finalize`, {
                                        scheduleId,
                                    });
                                }
                            } else {
                                console.log(`[END INTERVIEW][${rid}] Final submission already exists`, {
                                    scheduleId,
                                    finalSubmissionId:
                                        existingFinal._id?.toString?.() || String(existingFinal._id || ""),
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error("[END INTERVIEW] Failed to finalize coding submission:", err?.message || err);
                }

                try {
                    if (
                        ((schedule.interviewerType === "AI" && !schedule.evaluation) ||
                            schedule.interviewerType === "Human+AI") &&
                        resolvedCandidateId &&
                        resolvedJobId
                    ) {
                        // console.log(`[END INTERVIEW][${rid}] Triggering evaluation`, {
                        //     scheduleId,
                        //     candidateId: resolvedCandidateId,
                        //     jobId: resolvedJobId,
                        // });
                        const evalRes = await fastify.inject({
                            method: "POST",
                            url: "/api/ai/evaluateInterview",
                            payload: {
                                candidateId: resolvedCandidateId,
                                jobId: resolvedJobId,
                                interviewScheduleId: scheduleId,
                            },
                            headers: {
                                "content-type": "application/json",
                                ...(authHeader ? { authorization: authHeader } : {}),
                                ...(cookieHeader ? { cookie: cookieHeader } : {}),
                            },
                        });
                        console.log(`[END INTERVIEW][${rid}] Evaluation trigger response`, {
                            scheduleId,
                            statusCode: evalRes?.statusCode,
                        });
                    }
                } catch (err) {
                    console.error("[END INTERVIEW] Failed to trigger evaluation:", err?.message || err);
                }
            });

            return reply.send({
                ok: true,
                interviewScheduleId: scheduleId,
                interviewStatus,
                endedAt,
            });
        } catch (err) {
            console.error("[END INTERVIEW] error:", err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || "Failed to end interview" });
        }
    });

    // 📊 Evaluate interview (STRICT PARAMETER-WISE + STRICT COMMUNICATION)
    fastify.post("/evaluateInterview", async (req, reply) => {
        const t0 = Date.now();
        const rid = crypto.randomUUID?.() || String(Date.now());
        console.log(`\n📊 [EVAL][${rid}] ===== /api/ai/evaluateInterview (STRICT PARAMETER-WISE) =====`);

        try {
            const { candidateId, jobId, interviewScheduleId } = req.body || {};
            console.log(`[EVAL][${rid}] Incoming:`, { candidateId, jobId });

            if (!candidateId || !jobId) {
                console.warn(`[EVAL][${rid}] Missing candidateId or jobId`);
                return reply.code(400).send({ ok: false, error: "candidateId and jobId are required" });
            }

            if (!mongoose.Types.ObjectId.isValid(candidateId) || !mongoose.Types.ObjectId.isValid(jobId)) {
                console.warn(`[EVAL][${rid}] Invalid candidateId or jobId format`);
                return reply.code(400).send({ ok: false, error: "Invalid candidateId or jobId" });
            }

            const Conversation = req.conn.models["Conversation"];
            const InterviewSchedule = req.conn.models["InterviewSchedule"];
            if (!Conversation || !InterviewSchedule) {
                console.warn(`[EVAL][${rid}] Required models not found on connection`);
                return reply.code(500).send({ ok: false, error: "Required models not registered" });
            }

            const candObjId = new mongoose.Types.ObjectId(candidateId);
            const jobObjId = new mongoose.Types.ObjectId(jobId);

            // Resolve latest schedule (partition keys + blueprint + script)
            let schedule = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                schedule = await InterviewSchedule.findOne({
                    _id: new mongoose.Types.ObjectId(interviewScheduleId),
                    client: req.client,
                    isArchived: false,
                })
                    .lean()
                    .exec();
            }

            if (!schedule) {
                schedule = await InterviewSchedule.findOne({
                    client: req.client,
                    candidate: candObjId,
                    job: jobObjId,
                    isArchived: false,
                })
                    .sort({ startAt: -1 })
                    .lean()
                    .exec();
            }

            if (!schedule) {
                console.warn(`[EVAL][${rid}] InterviewSchedule not found`);
                return reply.code(404).send({ ok: false, error: "InterviewSchedule not found" });
            }

            const Job = req.conn.models["Job"];
            let jobDoc = null;
            if (Job) {
                jobDoc = await Job.findOne({
                    _id: jobObjId,
                    client: req.client,
                    isArchived: false,
                })
                    .lean()
                    .exec();
            }

            const experienceContext = buildExperienceContext(jobDoc);

            const interviewType = schedule.interviewType || "Technical";
            const interviewerType = schedule.interviewerType || "AI";
            const difficultyLevel = schedule.difficultyLevel || "Intermediate";
            const selectedBlueprint = Array.isArray(schedule.selectedBlueprint) ? schedule.selectedBlueprint : [];
            const technicalScript = String(schedule.technicalScript || "");

            console.log(`[EVAL][${rid}] Schedule resolved:`, {
                scheduleId: String(schedule._id),
                interviewType,
                interviewerType,
                difficultyLevel,
                blueprintGroups: selectedBlueprint.map((g) => g?.name),
                usedExplicitScheduleId: !!(interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)),
            });
            console.log(`[EVAL][${rid}] Experience context:`, experienceContext);

            // Fetch conversation for the right partition
            console.log(`[EVAL][${rid}] Fetching Conversation partition...`);
            const convFilter = {
                client: req.client,
                candidateId: candObjId,
                jobId: jobObjId,
                interviewType,
                interviewerType,
                isArchived: false,
            };
            if (schedule?._id) {
                convFilter.interviewScheduleId = schedule._id;
            }

            const conv = await Conversation.findOne(convFilter)
                .sort({ createdAt: -1 })
                .lean()
                .exec();

            if (!conv || !Array.isArray(conv.messages) || conv.messages.length === 0) {
                console.warn(`[EVAL][${rid}] No conversation messages found`);
                const empty = {
                    totalScore: 0,
                    overallReason: "No conversation messages found for this interview.",
                    parameterEvaluation: {
                        [COMMUNICATION_PARAMETER_NAME]: {
                            score: 0,
                            reason: "Insufficient evidence in transcript to evaluate communication (no messages).",
                            group: "Overall",
                            weight: 1,
                        },
                    },
                };

                const updatedEmpty = await interviewSvc.updateEvaluationFromConversation(
                    {
                        candidateId,
                        jobId,
                        interviewScheduleId: schedule?._id || interviewScheduleId || null,
                        ...empty,
                        breakdown: { totalQuestions: 0, answeredQuestions: 0 }
                    },
                    req
                );

                return reply.send({
                    ok: true,
                    ...empty,
                    score: empty.totalScore,
                    reason: empty.overallReason,
                    interviewScheduleId: updatedEmpty?._id || schedule?._id || null,
                });
            }

            // Normalize messages to plain role/content strings.
            // For Human/Human+AI interviews the STT backend prefixes content with "[Name] " — strip it so
            // the LLM evaluates the actual answer text rather than the speaker annotation.
            const messages = conv.messages.map((m) => {
                let content = getText(m.content);
                content = content.replace(/^\[[^\]]+\]\s*/, "").trim();
                return { role: m.role, content };
            });

            // Coverage is a supporting metric (not the parameter score)
            const coverage = evaluateConversationCoverage(messages);
            console.log(`[EVAL][${rid}] Coverage:`, coverage);

            // Build transcript + communication stats for strict comm evaluation
            const transcript = buildTranscriptForEval(messages);
            const commStats = buildCommunicationStats(messages);

            // Parameter list from blueprint
            const parameterPairs = flattenSelectedBlueprintParameters(selectedBlueprint);

            // Map AI questions to parameters using tagged script (preferred)
            const taggedScriptQuestions = parseScriptTaggedQuestions(technicalScript);
            console.log(`[EVAL][${rid}] Tagged script questions:`, taggedScriptQuestions.length);

            let mappedQuestions = mapQuestionsToParameters({ messages, taggedScriptQuestions });
            console.log(`[EVAL][${rid}] Mapped questions:`, mappedQuestions.length);

            if (!mappedQuestions.length && parameterPairs.length) {
                const fallback = buildFallbackMappedQuestions({ messages, parameterPairs });
                if (fallback.length) {
                    mappedQuestions = fallback;
                    console.log(`[EVAL][${rid}] Fallback mapped questions:`, fallback.length);
                }
            }

            mappedQuestions.slice(0, 12).forEach((mq, i) => {
                console.log(`[EVAL][${rid}] MQ[${i}]`, {
                    aiIndex: mq.aiIndex,
                    parameter: mq.parameter,
                    group: mq.group,
                    method: mq.method,
                    confidence: mq.confidence,
                });
            });

            // Build evidence per parameter
            const evidenceMap = buildParameterEvidenceMap({ messages, mappedQuestions });
            console.log(`[EVAL][${rid}] Evidence map params:`, Object.keys(evidenceMap).length);

            // Strict comm eval (LLM) with sanitization
            const commLlm = await generateStrictCommunicationEvaluation(
                { transcript, stats: commStats, interviewType, difficultyLevel, experienceContext },
                req
            );
            const commSan = sanitizeStrictCommunicationEvaluation({ llmResult: commLlm || {}, stats: commStats });

            // ✅ EARLY EXIT: if no mapped questions or no usable evidence, force 0s without calling parameter LLM
            const hasAnyUsableEvidence = Object.values(evidenceMap || {}).some((ev) => ev?.answerMeta?.ok);

            // ✅ Human+AI holistic path: no blueprint → use LLM holistic evaluation (not forced 0s)
            if (interviewerType === "Human+AI" && !parameterPairs.length) {
                console.log(`[EVAL][${rid}] Human+AI holistic evaluation path (no blueprint)`);
                const holistic = await generateHumanAIHolisticEvaluation(
                    { transcript, commStats, interviewType, difficultyLevel, experienceContext },
                    req
                );

                const holisticEval = holistic?.parameterEvaluation || {};
                const holisticReason = holistic?.overallReason || "Holistic evaluation generated from interview conversation.";
                const holisticScore = holistic?.totalScore ?? recomputeAverageTotalScore(holisticEval);

                const breakdown = {
                    ...coverage.breakdown,
                    coverageScore: coverage.score,
                    scheduleId: String(schedule._id),
                    conversationId: String(conv?._id || ""),
                    holistic: true,
                    communication: {
                        score: commSan.score,
                        reason: commSan.reason,
                        stats: commStats,
                    },
                };

                const updatedSchedule = await interviewSvc.updateEvaluationFromConversation(
                    {
                        candidateId,
                        jobId,
                        interviewScheduleId: schedule?._id || interviewScheduleId || null,
                        overallReason: holisticReason,
                        parameterEvaluation: holisticEval,
                        breakdown,
                    },
                    req
                );

                return reply.send({
                    ok: true,
                    totalScore: holisticScore,
                    overallReason: holisticReason,
                    parameterEvaluation: holisticEval,
                    score: holisticScore,
                    reason: holisticReason,
                    holistic: true,
                    interviewScheduleId: updatedSchedule?._id || schedule?._id || null,
                });
            }

            if (!mappedQuestions.length || !hasAnyUsableEvidence || !parameterPairs.length) {
                const forced = {};
                for (const p of parameterPairs) {
                    forced[p.parameter] = {
                        score: 0,
                        reason: "Insufficient evidence in transcript (no substantial answer).",
                        group: p.group || "",
                        weight: 1,
                    };
                }

                // Add strict communication parameter
                forced[COMMUNICATION_PARAMETER_NAME] = {
                    score: commSan.score,
                    reason: commSan.reason,
                    group: "Overall",
                    weight: 1,
                };

                const breakdown = {
                    ...coverage.breakdown,
                    coverageScore: coverage.score,
                    scheduleId: String(schedule._id),
                    conversationId: String(conv?._id || ""),
                    communication: {
                        score: commSan.score,
                        reason: commSan.reason,
                        stats: commStats,
                    },
                    parameterEvidenceStats: Object.fromEntries(
                        parameterPairs.map((p) => [
                            p.parameter,
                            { ok: false, reason: "missing", wordCount: 0, charCount: 0 },
                        ])
                    ),
                };

                const overallReason =
                    !parameterPairs.length
                        ? "No parameter blueprint found; evaluation includes strict communication and participation signals."
                        : "Insufficient transcript evidence to evaluate parameters; communication evaluated separately where possible.";

                const updatedSchedule = await interviewSvc.updateEvaluationFromConversation(
                    {
                        candidateId,
                        jobId,
                        interviewScheduleId: schedule?._id || interviewScheduleId || null,
                        overallReason,
                        parameterEvaluation: forced,
                        breakdown,
                    },
                    req
                );

                const totalScore = recomputeAverageTotalScore(forced);

                return reply.send({
                    ok: true,
                    totalScore,
                    overallReason,
                    parameterEvaluation: forced,
                    score: totalScore,
                    reason: overallReason,
                    interviewScheduleId: updatedSchedule?._id || schedule?._id || null,
                });
            }

            // Strict LLM scoring using per-parameter evidence only
            const llm = await generateStrictParameterEvaluation(
                {
                    parameterPairs,
                    evidenceMap,
                    interviewType,
                    difficultyLevel,
                    coverageScore: coverage.score,
                    coverageBreakdown: coverage.breakdown,
                    experienceContext,
                },
                req
            );

            const sanitized = sanitizeStrictParameterEvaluation({
                llmResult: llm || {},
                parameterPairs,
                evidenceMap,
            });

            // Add evidence stats to breakdown for auditability
            const parameterEvidenceStats = {};
            for (const p of parameterPairs) {
                const ev = evidenceMap[p.parameter] || {};
                parameterEvidenceStats[p.parameter] = {
                    ok: !!ev?.answerMeta?.ok,
                    reason: ev?.answerMeta?.reason || "missing",
                    wordCount: ev?.answerMeta?.wordCount || 0,
                    charCount: ev?.answerMeta?.charCount || 0,
                };
            }

            // ✅ Inject strict communication parameter into the evaluation (auto, not manual)
            sanitized.parameterEvaluation[COMMUNICATION_PARAMETER_NAME] = {
                score: commSan.score,
                reason: commSan.reason,
                group: "Overall",
                weight: 1,
            };

            // Recompute total score including communication
            sanitized.totalScore = recomputeAverageTotalScore(sanitized.parameterEvaluation);

            const breakdown = {
                ...coverage.breakdown,
                coverageScore: coverage.score,
                scheduleId: String(schedule._id),
                conversationId: String(conv?._id || ""),
                parameterEvidenceStats,
                communication: {
                    score: commSan.score,
                    reason: commSan.reason,
                    stats: commStats,
                },
            };

            console.log(
                `[EVAL][${rid}] Sanitized scores (first 10):`,
                Object.entries(sanitized.parameterEvaluation)
                    .slice(0, 10)
                    .map(([k, v]) => ({
                        k,
                        score: v.score,
                        evidenceOk: parameterEvidenceStats?.[k]?.ok,
                    }))
            );

            const updatedSchedule = await interviewSvc.updateEvaluationFromConversation(
                {
                    candidateId,
                    jobId,
                    interviewScheduleId: schedule?._id || interviewScheduleId || null,
                    overallReason: sanitized.overallReason,
                    parameterEvaluation: sanitized.parameterEvaluation,
                    breakdown,
                },
                req
            );

            return reply.send({
                ok: true,
                totalScore: sanitized.totalScore,
                overallReason: sanitized.overallReason,
                parameterEvaluation: sanitized.parameterEvaluation,
                // Backward-friendly response fields
                score: sanitized.totalScore,
                reason: sanitized.overallReason,
                interviewScheduleId: updatedSchedule?._id || schedule?._id || null,
            });
        } catch (err) {
            console.error(`❌ [EVAL][${rid}] /evaluateInterview error:`, err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || "Failed to evaluate interview" });
        } finally {
            logTime(`[EVAL][${rid}] /evaluateInterview duration`, t0);
            console.log("========================================================\n");
        }
    });

    // ─── Reading Passage Endpoints ────────────────────────────────────────────

    // POST /readingPassage — generate or retrieve a reading passage for communication assessment
    fastify.post('/readingPassage', async (req, reply) => {
        const t0 = Date.now();
        try {
            const { candidateId, jobId, interviewScheduleId, difficultyLevel } = req.body || {};
            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            if (!InterviewSchedule) return reply.code(500).send({ ok: false, error: 'InterviewSchedule model not available' });

            let schedule = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                schedule = await InterviewSchedule.findOne({ _id: new mongoose.Types.ObjectId(interviewScheduleId), client: req.client, isArchived: false }).lean().exec();
            }
            if (!schedule && candidateId && jobId && mongoose.Types.ObjectId.isValid(candidateId) && mongoose.Types.ObjectId.isValid(jobId)) {
                schedule = await InterviewSchedule.findOne({ client: req.client, candidate: new mongoose.Types.ObjectId(candidateId), job: new mongoose.Types.ObjectId(jobId), isArchived: false }).sort({ startAt: -1 }).lean().exec();
            }
            if (!schedule) return reply.code(404).send({ ok: false, error: 'Interview schedule not found' });

            const normalizeLevel = (v) => {
                const r = String(v || '').trim().toLowerCase();
                if (r === 'easy') return 'Easy';
                if (r === 'advanced' || r === 'hard') return 'Advanced';
                return 'Intermediate';
            };
            const level = normalizeLevel(difficultyLevel || schedule?.difficultyLevel || 'Intermediate');

            // Return cached passage if it exists and looks like English
            const existing = String(schedule.readingPassageText || '').trim();
            if (existing && /[a-zA-Z]/.test(existing) && existing.split(/\s+/).length > 20) {
                return reply.send({ ok: true, passage: existing, difficultyLevel: schedule.readingPassageDifficulty || level, audioUrl: schedule.readingPassageAudioUrl || null, scheduleId: String(schedule._id) });
            }

            // Generate new passage via GPT
            const prompt = `Generate a short reading passage (3-4 sentences, ${level} difficulty) for an English communication assessment. The passage should be clear, professional, and suitable for reading aloud in a job interview context. Return only the passage text, no labels or headings.`;
            const completion = await openai.chat.completions.create({
                model: FAST_INTERVIEW_MODEL,
                messages: [{ role: 'user', content: prompt }],
                max_completion_tokens: 200,
                temperature: 0.7,
            });
            const passage = completion.choices?.[0]?.message?.content?.trim() || '';
            if (!passage) return reply.code(500).send({ ok: false, error: 'Failed to generate reading passage' });

            await InterviewSchedule.updateOne(
                { _id: schedule._id, client: req.client },
                { $set: { readingPassageText: passage, readingPassageDifficulty: level, readingPassageGeneratedAt: new Date() } }
            ).exec();

            return reply.send({ ok: true, passage, difficultyLevel: level, audioUrl: schedule.readingPassageAudioUrl || null, scheduleId: String(schedule._id) });
        } catch (err) {
            console.error('❌ [READING] /readingPassage error:', err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || 'Failed to generate reading passage' });
        } finally {
            console.log('🕒 [READING] /readingPassage duration:', (Date.now() - t0).toFixed(0), 'ms');
        }
    });

    // POST /saveReadingPassageAudio — save candidate's audio recording of passage reading
    fastify.post('/saveReadingPassageAudio', { bodyLimit: 25 * 1024 * 1024 }, async (req, reply) => {
        const t0 = Date.now();
        try {
            const { candidateId, jobId, interviewScheduleId, audioData } = req.body || {};
            if (!audioData) return reply.code(400).send({ ok: false, error: 'audioData is required' });

            const InterviewSchedule = req.conn.models['InterviewSchedule'];
            if (!InterviewSchedule) return reply.code(500).send({ ok: false, error: 'InterviewSchedule model not available' });

            let schedule = null;
            if (interviewScheduleId && mongoose.Types.ObjectId.isValid(interviewScheduleId)) {
                schedule = await InterviewSchedule.findOne({ _id: new mongoose.Types.ObjectId(interviewScheduleId), client: req.client, isArchived: false }).lean().exec();
            }
            if (!schedule && candidateId && jobId && mongoose.Types.ObjectId.isValid(candidateId) && mongoose.Types.ObjectId.isValid(jobId)) {
                schedule = await InterviewSchedule.findOne({ client: req.client, candidate: new mongoose.Types.ObjectId(candidateId), job: new mongoose.Types.ObjectId(jobId), isArchived: false }).sort({ startAt: -1 }).lean().exec();
            }
            if (!schedule) return reply.code(404).send({ ok: false, error: 'Interview schedule not found' });

            // Decode base64 audio
            const base64Data = String(audioData).replace(/^data:[^,]+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            if (!buffer || buffer.length < 512) return reply.code(400).send({ ok: false, error: 'Audio buffer too small' });

            const mimeMatch = String(audioData).match(/^data:([^;]+);base64,/);
            const mime = mimeMatch?.[1] || 'audio/webm';
            const ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'mp4' : 'webm';

            const ts = Date.now();
            const rand = Math.random().toString(36).slice(2, 8);
            const filePath = `readingPassages/${String(req.client)}/${String(schedule.candidate || candidateId)}/${String(schedule.job || jobId)}/${String(schedule._id)}/${ts}_${rand}.${ext}`;

            await uploadBufferToFirebase(buffer, filePath, mime);
            const url = await getDownloadURL(filePath);
            if (!url) return reply.code(500).send({ ok: false, error: 'Failed to generate audio URL' });

            await InterviewSchedule.updateOne(
                { _id: schedule._id, client: req.client },
                { $set: { readingPassageAudioUrl: url, readingPassageAudioUpdatedAt: new Date() } }
            ).exec();

            return reply.send({ ok: true, url, scheduleId: String(schedule._id) });
        } catch (err) {
            console.error('❌ [READING] /saveReadingPassageAudio error:', err?.message || err);
            return reply.code(500).send({ ok: false, error: err?.message || 'Failed to save reading audio' });
        } finally {
            console.log('🕒 [READING] /saveReadingPassageAudio duration:', (Date.now() - t0).toFixed(0), 'ms');
        }
    });

    console.log("✅ [AI ROUTES] All AI endpoints registered successfully\n");
}
