import { chatCompletionByOpenAI } from '../utils/aiChatCompletions.js';
import universalTextToSpeech from '../utils/googleTTSAndSTTUtils.js';
import JobService from '../services/jobService.js';
import ScriptService from '../services/scriptService.js';
import CompanyService from '../services/companyService.js';
import mongoose from 'mongoose';

function safeJsonParse(maybeJson) {
    try {
        const m = (maybeJson || '').match(/\{[\s\S]*\}$/);
        return JSON.parse(m ? m[0] : maybeJson);
    } catch { return null; }
}

async function extractAction(messages, req) {
    // USER-only transcript
    const userMsgs = (messages || []).filter(m => m.role === 'user').map(m => m.content);
    const transcript = userMsgs.join('\n').trim();
    const lastUserOnly = userMsgs[userMsgs.length - 1] || '';
    req.log.info({ userOnlyChars: transcript.length }, '[assistant] Using USER-only transcript');

    const system = `
            You are an API action extractor. Return ONLY compact JSON (no prose).

            STRICT RULES:
            - Consider ONLY USER messages (ignore assistant text).
            - NEVER invent values. If the user did not type a title and did not paste a JD that clearly contains one, set job.title="".
            - Do not reuse values from earlier turns unless the user retyped them in a USER message.
            - If the message is just a greeting (e.g., "hi", "hello", "hey", "hii", "good morning"), set intent="none".

            Job intents:
            - "create_job": only when the user explicitly asks to create/post/publish/open/add a job/role/opening/vacancy/position/req, OR when they paste a JD.
            - "provide_job_title": when the user replies with just a title after being asked for the title.
            - "resolve_duplicate_job": when they reply after being told a duplicate exists.
            - "create_company": when they ask to create/add a company.
            - Otherwise "none".

            Return JSON:
            {
            "intent": "create_job" | "provide_job_title" | "resolve_duplicate_job" | "create_company" | "none",
            "job": {
                "title": "string",
                "jobType": "Full-time|Part-time|Permanent|Fresher|Contractual/Temporary|Internship",
                "workMode": "On-site(Work From Office)|Hybrid|Remote(Work From Home)|Field-based|Not specified",
                "locations": ["array","of","strings"],
                "experience": {"min": number, "max": number},
                "salary": {"min": number, "max": number},
                "primarySkills": ["React","..."],
                "positions": number,
                "companyName": "optional string",
                "companyId": "optional string",
                "hybridDetails": "optional string",
                "description": "optional string"
            },
            "script": {
                "scriptName": "string",
                "scriptType": "aicall|email|sms",
                "language": "e.g. en-IN",
                "gender": "MALE|FEMALE|NEUTRAL",
                "voiceModel": "string",
                "extraQuestion": "optional string",
                "content": "optional string",
                "generate": true|false
            },
            "company": {
                "name": "string",
                "industry": "string",
                "size": "string",
                "description": "string",
                "website": "string",
                "logoUrl": "string",
                "about": "string",
                "policyBenefits": "string",
                "faqs": ["array","of","strings"]
            },
            "duplicateResolution": {
                "action": "new_title" | "new_experience" | "ask_title",
                "newTitle": "string",
                "newExperience": {"min": number, "max": number}
            }
            }
        `.trim();

    const ai = await chatCompletionByOpenAI(
        [{ role: 'system', content: system }, { role: 'user', content: transcript }],
        req
    );

    const raw = ai?.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse(raw) || { intent: 'none' };
    req.log.info({ raw, parsed, lastUserOnly }, '[assistant] Extracted action JSON');
    return { parsed, lastUserOnly };
}

// ---------- helpers for unauthorized ----------
const isUnauthorizedError = (e) => {
    const msg = (e?.message || '').toLowerCase();
    return (
        e?.statusCode === 401 ||
        e?.code === 401 ||
        e?.code === 'FAST_JWT_MISSING_AUTHORIZATION_HEADER' ||
        e?.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
        e?.code === 'FST_JWT_NO_AUTHORIZATION_IN_COOKIE' ||
        msg.includes('unauthorized') ||
        msg.includes('jwt') ||
        msg.includes('not authorized')
    );
};

const unauthorizedBody = () => ({
    success: false,
    error: 'unauthorized',
    message: {
        role: 'assistant',
        content: 'You are not signed in. Please log in to continue. Redirecting you to the login page…',
    },
    redirectTo: '/login',
});

// ---------- Validations / prompts ----------
function missingJobFields(job, haveCompany) {
    const missing = [];
    if (!job?.title) missing.push('title');
    if (!job?.jobType) missing.push('jobType');
    if (!Array.isArray(job?.locations) || job.locations.length === 0) missing.push('locations');
    if (!job?.experience || job.experience.min == null || job.experience.max == null) missing.push('experience (min & max)');
    if (!job?.workMode) missing.push('workMode');
    if (!Array.isArray(job?.primarySkills) || job.primarySkills.filter(Boolean).length < 3) missing.push('primarySkills (≥ 3)');
    if (!haveCompany) missing.push('company');
    if (!job?.description) missing.push('description');
    return missing;
}

function missingScriptFields(script) {
    const missing = [];
    if (!script?.scriptName) missing.push('scriptName');
    if (!script?.scriptType) missing.push('scriptType');
    if (!script?.language) missing.push('language');
    if (!script?.gender) missing.push('gender');
    if (!script?.voiceModel) missing.push('voiceModel');
    if (!script?.content && !script?.generate) missing.push('content');
    return missing;
}

function allFieldsQuestionnaire(jobTitle) {
    return [
        `Great — let's set up "${jobTitle || 'Title'}". Please provide ALL the details below (you can paste in one message):`,
        '',
        'Job',
        '• Company (name or ID)',
        '• Job Type (Full-time | Part-time | Permanent | Fresher | Contractual/Temporary | Internship)',
        '• Work Mode (On-site(Work From Office) | Hybrid | Remote(Work From Home) | Field-based | Not specified)',
        '• If Hybrid: Hybrid details (e.g., "3 days WFO, 2 days WFH")',
        '• Locations (comma-separated)',
        '• Experience range (min–max in years, e.g., 3-5)',
        '• Primary skills (≥ 3, comma-separated)',
        '• Positions (number)',
        '• Salary range (min–max, optional)',
        '• Short description (2–3 lines or say "AI generate")',
        '',
        'Script',
        '• Script Name',
        '• Script Type (aicall | email | sms)',
        '• Extra question(s) (optional)',
        '• Language (e.g., en-IN)',
        '• Gender (MALE | FEMALE | NEUTRAL)',
        '• Voice model (after lang+gender; you can say "suggest")',
        '• Script content OR say "generate" to auto-create from the job',
    ].join('\n');
}

function companyQuestionnaire() {
    return [
        'Sure — to create the company, please provide ALL of the following (you can paste in one message):',
        '',
        'Company',
        '• Name (required)',
        '• About (required) — a few lines about the company',
        '• Industry (optional)',
        '• Size (optional) — e.g., "50–200 employees"',
        '• Description (optional) — short teaser',
        '• Website (optional)',
        '• Logo URL (optional)',
        '• Policy & Benefits (optional)',
        '• FAQs (optional, pipe- or comma-separated)',
    ].join('\n');
}

// ---------- Lookups ----------
async function resolveCompanyId(job, req) {
    const Company = req.conn.models['Company'];
    if (job?.companyId && mongoose.Types.ObjectId.isValid(job.companyId)) {
        const found = await Company.findOne({ _id: job.companyId, client: req.client, isArchived: false }).lean();
        if (found?._id) return `${found._id}`;
    }
    if (job?.companyName) {
        const byName = await Company.findOne({ name: job.companyName, client: req.client, isArchived: false }).lean();
        if (byName?._id) return `${byName._id}`;
    }
    return null;
}

// ---------- Route ----------
export default async function assistantRoutes(fastify) {
    // Auth hook that returns a friendly 401 with redirect
    fastify.addHook('preHandler', async (req, reply) => {
        try {
            await fastify.authenticate(req, reply);
        } catch (err) {
            req.log.warn({ err }, '[assistant] unauthorized (preHandler)');
            return reply.code(401).send(unauthorizedBody());
        }
    });

    const jobSvc = new JobService();
    const scriptSvc = new ScriptService();
    const compSvc = new CompanyService();

    // --------------------------
    // HTTP POST (existing)
    // --------------------------
    fastify.post('/chat', async (req, reply) => {
        try {
            const {
                messages = [],
                tts = true,
                language = 'en-IN',
                gender = 'FEMALE',
                voiceModel = 'en-IN-Chirp3-HD-Aoede',
                audioEncoding = 'MP3',
                sampleRateHertz = 24000,
                speakingRate = 1.0,
                debug = false,
            } = req.body || {};

            const steps = [];
            const step = (msg, extra = {}) => {
                const item = { ts: new Date().toISOString(), msg, ...extra };
                steps.push(item);
                req.log.info(item, '[assistant] ' + msg);
            };

            if (!Array.isArray(messages) || messages.length === 0) {
                return reply.code(400).send({ success: false, error: 'messages[] required' });
            }

            // Detect action (USER-only)
            step('Extracting intent from USER-only transcript');
            const { parsed, lastUserOnly } = await extractAction(messages, req);

            // ---- Job-intent gating (prevents title prompt on greetings) ----
            const greetingRe = /^(hi+|hii+|hello+|hey+|hola+|namaste|good\s+(morning|afternoon|evening))\b/i;
            const jobIntentRe = /\b(create|post|publish|add|open|raise|setup|draft|make)\s+(a\s+)?(job|role|opening|vacancy|position|requisition|req)\b/i;
            const jdHintRe = /(job\s*description|^jd\b|responsibilit|requirement|we\s*are\s*looking|about\s*the\s*role|qualification|roles?\s*&\s*responsibilities)/i;

            const isGreetingOnly = greetingRe.test((lastUserOnly || '').trim()) && !jobIntentRe.test(lastUserOnly) && !jdHintRe.test(lastUserOnly);
            const isJobIntent = jobIntentRe.test(lastUserOnly) || jdHintRe.test(lastUserOnly);

            if (!isJobIntent && (parsed.intent === 'create_job' || parsed.intent === 'provide_job_title' || parsed.intent === 'resolve_duplicate_job')) {
                step('Downgrading parsed job intent (no job keywords/JD in last user message)', { lastUserOnly });
                parsed.intent = 'none';
            }

            // Also, never allow a title unless it appears in USER text or JD is present
            if (parsed?.job?.title && !jdHintRe.test(lastUserOnly)) {
                const t = String(parsed.job.title).toLowerCase();
                if (!lastUserOnly.toLowerCase().includes(t)) {
                    parsed.job.title = '';
                    step('Cleared title not present in last USER message (no JD hints).', { clearedTitle: t });
                }
            }

            let assistantContent = '';
            let didAct = false;
            let actionType = 'none';
            let createdJob = null;
            let createdCompany = null;

            // ---------- CREATE COMPANY ----------
            if (parsed.intent === 'create_company') {
                actionType = 'create_company';

                const companyInput = parsed.company || {};
                if (typeof companyInput.faqs === 'string') {
                    companyInput.faqs = companyInput.faqs.split(/[|,]\s*/g).map(s => s.trim()).filter(Boolean);
                }
                if (!Array.isArray(companyInput.faqs)) companyInput.faqs = [];

                const compMissing = [];
                if (!companyInput?.name) compMissing.push('name');
                if (!companyInput?.about) compMissing.push('about');

                if (compMissing.length) {
                    assistantContent = companyQuestionnaire() + `\n\nMissing right now — Company: [${compMissing.join(', ')}].`;
                } else {
                    const dup = await req.conn.models['Company'].findOne({ name: companyInput.name, client: req.client, isArchived: false }).lean();
                    if (dup) {
                        assistantContent = `A company named "${companyInput.name}" already exists.\nExisting Company ID: ${dup._id}\n\nWould you like me to proceed by updating that record instead? (Currently I will only create new.)`;
                    } else {
                        const payload = {
                            name: companyInput.name,
                            industry: companyInput.industry || '',
                            size: companyInput.size || '',
                            description: companyInput.description || '',
                            website: companyInput.website || '',
                            logoUrl: companyInput.logoUrl || '',
                            about: companyInput.about,
                            policyBenefits: companyInput.policyBenefits || '',
                            faqs: Array.isArray(companyInput.faqs) ? companyInput.faqs : [],
                        };
                        try {
                            const created = await compSvc.create(payload, req);
                            createdCompany = created;
                            didAct = true;
                            assistantContent = `Company created: **${created.name}**\nCompany ID: ${created._id}`;
                        } catch (err) {
                            if (isUnauthorizedError(err)) {
                                return reply.code(401).send(unauthorizedBody());
                            }
                            assistantContent = `I tried to create the company but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                        }
                    }
                }
            }

            // ---------- PROVIDE JOB TITLE ----------
            if (!assistantContent && parsed.intent === 'provide_job_title') {
                actionType = 'provide_job_title';
                const title = String(parsed?.job?.title || '').trim();
                assistantContent = title
                    ? allFieldsQuestionnaire(title) +
                    `\n\nMissing right now — Job: [jobType, locations, workMode, primarySkills (≥ 3), company, description]; Script: [scriptName, scriptType, language, gender, voiceModel, content].`
                    : 'Please share the job title (e.g., "Java Developer").';
            }

            // ---------- RESOLVE DUPLICATE JOB ----------
            if (!assistantContent && parsed.intent === 'resolve_duplicate_job') {
                actionType = 'resolve_duplicate_job';

                const extractedJob = parsed.job || {};
                extractedJob.positions = Number(extractedJob.positions || 1);
                const extractedScript = parsed.script || {};
                const reso = parsed.duplicateResolution || {};

                const companyId = await resolveCompanyId(extractedJob, req);
                const haveCompany = Boolean(companyId);

                const needsTitle = (reso?.action === 'ask_title') || !extractedJob?.title || (!reso?.newTitle && reso?.action === 'new_title');

                if (needsTitle) {
                    assistantContent = `Got it — we can create a new job with everything else the same.\nPlease share the **new job title** (only the title). Optionally, you can also share a new experience range (min–max) if you want to change it.`;
                } else {
                    const newTitle = reso?.newTitle ? String(reso.newTitle).trim() : extractedJob.title;
                    const newExperience = reso?.newExperience && reso.newExperience.min != null && reso.newExperience.max != null
                        ? { min: Number(reso.newExperience.min), max: Number(reso.newExperience.max) }
                        : { min: Number(extractedJob.experience?.min || 0), max: Number(extractedJob.experience?.max || 0) };

                    const payload = {
                        title: newTitle,
                        internalTitle: '',
                        company: companyId,
                        positions: extractedJob.positions || 1,
                        jobType: extractedJob.jobType,
                        experience: newExperience,
                        workMode: extractedJob.workMode,
                        hybridDetails: extractedJob.workMode === 'Hybrid' ? (extractedJob.hybridDetails || '3 days WFO, 2 days WFH') : '',
                        locations: (extractedJob.locations || []).map(s => String(s).trim()).filter(Boolean),
                        salary: { min: Number(extractedJob.salary?.min || 0), max: Number(extractedJob.salary?.max || 0), currency: 'INR' },
                        educationDetails: [],
                        primarySkills: (extractedJob.primarySkills || []).map(s => String(s).trim()).filter(Boolean),
                        secondarySkills: [],
                        description: extractedJob.description || `Auto-created via Assistant from request: "${lastUserOnly}"`,
                        recruiterNotes: 'Created by Assistant',
                        enableAICall: true,
                        isWalkIn: false,
                        walkInDetails: {},
                        status: 'active',
                        unit: null,
                    };

                    const dup = await req.conn.models['Job'].findOne({
                        title: payload.title,
                        company: payload.company,
                        'experience.min': payload.experience.min,
                        'experience.max': payload.experience.max
                    }).lean();

                    if (dup) {
                        assistantContent = `A job with that title and experience still exists for this company.\nExisting Job ID: ${dup._id}\n\nPlease provide a **different job title** (everything else can remain the same), or share a new experience range.`;
                    } else {
                        let job;
                        try {
                            job = await jobSvc.create({ ...payload, createdBy: req.user.sub }, req);
                        } catch (err) {
                            if (isUnauthorizedError(err)) {
                                return reply.code(401).send(unauthorizedBody());
                            }
                            assistantContent = `I tried to create the job but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                        }
                        if (job?._id) {
                            createdJob = job; didAct = true;
                            let scriptContent = extractedScript.content;
                            if (!scriptContent && extractedScript.generate) {
                                try {
                                    scriptContent = await scriptSvc.generateScriptFromJob({
                                        job, jobId: job._id, candidateId: '', extraQuestion: extractedScript.extraQuestion || '', req
                                    });
                                } catch { }
                            }
                            const scriptPayload = {
                                jobId: job._id,
                                scriptName: extractedScript.scriptName,
                                scriptType: String(extractedScript.scriptType || '').toLowerCase(),
                                extraQuestion: extractedScript.extraQuestion || '',
                                content: scriptContent || '',
                                language: extractedScript.language,
                                gender: String(extractedScript.gender || '').toUpperCase(),
                                voiceModel: extractedScript.voiceModel,
                            };
                            const stillMissing = missingScriptFields({ ...scriptPayload, generate: !!extractedScript.generate });
                            if (stillMissing.length) {
                                assistantContent = `Job posted • ID: ${job._id}\n\nNow I need Script details (${stillMissing.join(', ')}) before I can create the script.\nReply with: Script Name, Type (aicall|email|sms), Language (e.g., en-IN), Gender (MALE|FEMALE|NEUTRAL), Voice Model, and either "generate" or paste the content.`;
                            } else {
                                const dupScr = await req.conn.models['Script'].findOne({ jobId: job._id }).lean();
                                if (dupScr) await req.conn.models['Script'].findByIdAndUpdate(dupScr._id, scriptPayload);
                                else await scriptSvc.create({ ...scriptPayload, client: req.user.sub }, req);
                                assistantContent = `Posted **${job.title}** (${job.jobType}) for company ${job.company} with ${job.experience?.min}-${job.experience?.max} yrs, ${job.workMode}, locations: ${job.locations?.join(', ') || '—'}.\nJob ID: ${job._id}\nScript saved: ${scriptPayload.scriptName}`;
                            }
                        }
                    }
                }
            }

            // ---------- CREATE JOB ----------
            if (!assistantContent && parsed.intent === 'create_job') {
                actionType = 'create_job';

                const extractedJob = parsed.job || {};
                extractedJob.positions = Number(extractedJob.positions || 1);
                const extractedScript = parsed.script || {};

                const companyId = await resolveCompanyId(extractedJob, req);
                const haveCompany = Boolean(companyId);

                if (!extractedJob.title) {
                    assistantContent = `Sure — what's the **job title**?\nYou can also paste the **full JD**, and I’ll create the job from that.`;
                } else {
                    const jobMissing = missingJobFields(extractedJob, haveCompany);
                    const scriptMissing = missingScriptFields(extractedScript);

                    if (jobMissing.length || scriptMissing.length) {
                        assistantContent = allFieldsQuestionnaire(extractedJob.title) +
                            `\n\nMissing right now — Job: [${jobMissing.join(', ') || 'none'}]; Script: [${scriptMissing.join(', ') || 'none'}].`;
                    } else {
                        const payload = {
                            title: extractedJob.title,
                            internalTitle: '',
                            company: companyId,
                            positions: extractedJob.positions || 1,
                            jobType: extractedJob.jobType,
                            experience: { min: Number(extractedJob.experience?.min || 0), max: Number(extractedJob.experience?.max || 0) },
                            workMode: extractedJob.workMode,
                            hybridDetails: extractedJob.workMode === 'Hybrid' ? (extractedJob.hybridDetails || '3 days WFO, 2 days WFH') : '',
                            locations: (extractedJob.locations || []).map(s => String(s).trim()).filter(Boolean),
                            salary: { min: Number(extractedJob.salary?.min || 0), max: Number(extractedJob.salary?.max || 0), currency: 'INR' },
                            educationDetails: [],
                            primarySkills: (extractedJob.primarySkills || []).map(s => String(s).trim()).filter(Boolean),
                            secondarySkills: [],
                            description: extractedJob.description || `Auto-created via Assistant from request: "${lastUserOnly}"`,
                            recruiterNotes: 'Created by Assistant',
                            enableAICall: true,
                            isWalkIn: false,
                            walkInDetails: {},
                            status: 'active',
                            unit: null,
                        };

                        const dup = await req.conn.models['Job'].findOne({
                            title: payload.title,
                            company: payload.company,
                            'experience.min': payload.experience.min,
                            'experience.max': payload.experience.max
                        }).lean();

                        if (dup) {
                            assistantContent = `A job with the same title and experience already exists for that company.\nExisting Job ID: ${dup._id}\n\nWould you like me to create a **new job** with a *different job title* while keeping everything else the same? If yes, just reply with the **new title**. You can also change the experience range if needed.`;
                        } else {
                            let job;
                            try {
                                job = await jobSvc.create({ ...payload, createdBy: req.user.sub }, req);
                            } catch (err) {
                                if (isUnauthorizedError(err)) {
                                    return reply.code(401).send(unauthorizedBody());
                                }
                                assistantContent = `I tried to create the job but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                            }

                            if (job?._id) {
                                createdJob = job; didAct = true;
                                let scriptContent = extractedScript.content;
                                if (!scriptContent && extractedScript.generate) {
                                    try {
                                        scriptContent = await scriptSvc.generateScriptFromJob({
                                            job, jobId: job._id, candidateId: '', extraQuestion: extractedScript.extraQuestion || '', req
                                        });
                                    } catch { }
                                }
                                const scriptPayload = {
                                    jobId: job._id,
                                    scriptName: extractedScript.scriptName,
                                    scriptType: String(extractedScript.scriptType || '').toLowerCase(),
                                    extraQuestion: extractedScript.extraQuestion || '',
                                    content: scriptContent || '',
                                    language: extractedScript.language,
                                    gender: String(extractedScript.gender || '').toUpperCase(),
                                    voiceModel: extractedScript.voiceModel,
                                };
                                const stillMissing = missingScriptFields({ ...scriptPayload, generate: !!extractedScript.generate });
                                if (stillMissing.length) {
                                    assistantContent = `Job posted • ID: ${job._id}\n\nNow I need Script details (${stillMissing.join(', ')}) before I can create the script.\nReply with: Script Name, Type (aicall|email|sms), Language (e.g., en-IN), Gender (MALE|FEMALE|NEUTRAL), Voice Model, and either "generate" or paste the content.`;
                                } else {
                                    const dupScr = await req.conn.models['Script'].findOne({ jobId: job._id }).lean();
                                    if (dupScr) await req.conn.models['Script'].findByIdAndUpdate(dupScr._id, scriptPayload);
                                    else await scriptSvc.create({ ...scriptPayload, client: req.user.sub }, req);
                                    assistantContent = `Posted **${job.title}** (${job.jobType}) for company ${job.company} with ${job.experience?.min}-${job.experience?.max} yrs, ${job.workMode}, locations: ${job.locations?.join(', ') || '—'}.\nJob ID: ${job._id}\nScript saved: ${scriptPayload.scriptName}`;
                                }
                            }
                        }
                    }
                }
            }

            // Fallback: normal chat (for greetings, smalltalk, etc.)
            if (!assistantContent) {
                const completion = await chatCompletionByOpenAI(messages, req);
                assistantContent = completion?.choices?.[0]?.message?.content?.trim?.() || 'Sorry, I had trouble answering that.';
            }

            // TTS
            let audioBase64 = null;
            if (tts) {
                const audioBuf = await universalTextToSpeech(
                    assistantContent, language, gender, voiceModel, audioEncoding, sampleRateHertz, speakingRate
                );
                audioBase64 = audioBuf?.toString('base64') || null;
            }

            return reply.send({
                success: true,
                message: { role: 'assistant', content: assistantContent },
                audioBase64,
                audioEncoding,
                didAct,
                actionType,
                createdJobId: createdJob?._id || null,
                createdCompanyId: createdCompany?._id || null,
                logs: debug ? steps : undefined,
            });
        } catch (err) {
            if (isUnauthorizedError(err)) {
                req.log.warn({ err }, '[assistant/chat] unauthorized (catch)');
                return reply.code(401).send(unauthorizedBody());
            }
            req.log.error('[assistant/chat] error:', err);
            return reply.code(500).send({ success: false, error: 'Assistant failed' });
        }
    });

    // --------------------------
    // WebSocket WSS (server-native + redirect here)
    // --------------------------
    // Requires fastify-websocket registered globally:
    // fastify.register(import('@fastify/websocket'))
    fastify.get('/chat/ws', { websocket: true }, async (connection, req) => {
        // authenticate on WS connect
        try {
            const fakeReply = { code: () => fakeReply, send: () => { } };
            await fastify.authenticate(req, fakeReply);
        } catch (err) {
            req.log.warn({ err }, '[assistant/ws] unauthorized on connect');
            const body = unauthorizedBody();
            connection.socket.send(JSON.stringify({ event: 'unauthorized', ...body }));
            try { connection.socket.close(); } catch { }
            return;
        }

        const jobSvcWS = new JobService();
        const scriptSvcWS = new ScriptService();
        const compSvcWS = new CompanyService();

        const sendMessage = (payload) => {
            try {
                connection.socket.send(JSON.stringify(payload));
            } catch (e) {
                req.log.error('[assistant/ws] send error', e);
            }
        };

        // redirect detection – server-only
        const detectRedirect = (text) => {
            const lower = String(text || '').toLowerCase();
            if (lower.includes("new candidate")) return "/candidates/new/";
            if (lower.includes("candidate detail")) return "/candidates/1/";
            if (lower.includes("candidate")) return "/candidates/";
            if (lower.includes("new job")) return "/jobs/new/";
            if (lower.includes("job detail")) return "/jobs/1/";
            if (lower.includes("job")) return "/jobs/";
            if (lower.includes("company")) return "/companies/";
            return null;
        };

        connection.socket.on('message', async raw => {
            let data = {};
            try { data = JSON.parse(raw.toString()); } catch { }

            // still support an explicit client "redirect" command if sent
            if (data?.type === 'redirect' && data?.path) {
                sendMessage({ event: 'message', message: { role: 'assistant', content: `Redirecting you to ${data.path}...` } });
                sendMessage({ event: 'redirect', to: data.path });
                return;
            }

            const {
                messages = [],
                tts = true,
                language = 'en-IN',
                gender = 'FEMALE',
                voiceModel = 'en-IN-Chirp3-HD-Aoede',
                audioEncoding = 'MP3',
                sampleRateHertz = 24000,
                speakingRate = 1.0,
                debug = false,
            } = data || {};

            if (!Array.isArray(messages) || messages.length === 0) {
                return sendMessage({ event: 'error', error: 'messages[] required' });
            }

            try {
                const steps = [];
                const step = (msg, extra = {}) => {
                    const item = { ts: new Date().toISOString(), msg, ...extra };
                    steps.push(item);
                    req.log.info(item, `[assistant/ws] ${msg}`);
                };

                step('Extracting intent from USER-only transcript');
                const { parsed, lastUserOnly } = await extractAction(messages, req);

                const greetingRe = /^(hi+|hii+|hello+|hey+|hola+|namaste|good\s+(morning|afternoon|evening))\b/i;
                const jobIntentRe = /\b(create|post|publish|add|open|raise|setup|draft|make)\s+(a\s+)?(job|role|opening|vacancy|position|requisition|req)\b/i;
                const jdHintRe = /(job\s*description|^jd\b|responsibilit|requirement|we\s*are\s*looking|about\s*the\s*role|qualification|roles?\s*&\s*responsibilities)/i;

                const isGreetingOnly = greetingRe.test((lastUserOnly || '').trim()) && !jobIntentRe.test(lastUserOnly) && !jdHintRe.test(lastUserOnly);
                const isJobIntent = jobIntentRe.test(lastUserOnly) || jdHintRe.test(lastUserOnly);

                if (!isJobIntent && (parsed.intent === 'create_job' || parsed.intent === 'provide_job_title' || parsed.intent === 'resolve_duplicate_job')) {
                    step('Downgrading parsed job intent (no job keywords/JD in last user message)', { lastUserOnly });
                    parsed.intent = 'none';
                }

                if (parsed?.job?.title && !jdHintRe.test(lastUserOnly)) {
                    const t = String(parsed.job.title).toLowerCase();
                    if (!lastUserOnly.toLowerCase().includes(t)) {
                        parsed.job.title = '';
                        step('Cleared title not present in last USER message (no JD hints).', { clearedTitle: t });
                    }
                }

                let assistantContent = '';
                let didAct = false;
                let actionType = 'none';
                let createdJob = null;
                let createdCompany = null;

                // server-native redirect on WSS
                const redirectPath = detectRedirect(lastUserOnly);
                if (redirectPath) {
                    sendMessage({ event: 'message', message: { role: 'assistant', content: `Redirecting you to ${redirectPath}...` } });
                    sendMessage({ event: 'redirect', to: redirectPath });
                    return;
                }

                // CREATE COMPANY
                if (parsed.intent === 'create_company') {
                    actionType = 'create_company';
                    const companyInput = parsed.company || {};
                    if (typeof companyInput.faqs === 'string') {
                        companyInput.faqs = companyInput.faqs.split(/[|,]\s*/g).map(s => s.trim()).filter(Boolean);
                    }
                    if (!Array.isArray(companyInput.faqs)) companyInput.faqs = [];

                    const compMissing = [];
                    if (!companyInput?.name) compMissing.push('name');
                    if (!companyInput?.about) compMissing.push('about');

                    if (compMissing.length) {
                        assistantContent = companyQuestionnaire() + `\n\nMissing right now — Company: [${compMissing.join(', ')}].`;
                    } else {
                        const dup = await req.conn.models['Company'].findOne({ name: companyInput.name, client: req.client, isArchived: false }).lean();
                        if (dup) {
                            assistantContent = `A company named "${companyInput.name}" already exists.\nExisting Company ID: ${dup._id}\n\nWould you like me to proceed by updating that record instead? (Currently I will only create new.)`;
                        } else {
                            const payload = {
                                name: companyInput.name,
                                industry: companyInput.industry || '',
                                size: companyInput.size || '',
                                description: companyInput.description || '',
                                website: companyInput.website || '',
                                logoUrl: companyInput.logoUrl || '',
                                about: companyInput.about,
                                policyBenefits: companyInput.policyBenefits || '',
                                faqs: Array.isArray(companyInput.faqs) ? companyInput.faqs : [],
                            };
                            try {
                                const created = await compSvcWS.create(payload, req);
                                createdCompany = created;
                                didAct = true;
                                assistantContent = `Company created: **${created.name}**\nCompany ID: ${created._id}`;
                            } catch (err) {
                                if (isUnauthorizedError(err)) {
                                    const body = unauthorizedBody();
                                    sendMessage({ event: 'unauthorized', ...body });
                                    return;
                                }
                                assistantContent = `I tried to create the company but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                            }
                        }
                    }
                }

                // PROVIDE JOB TITLE
                if (!assistantContent && parsed.intent === 'provide_job_title') {
                    actionType = 'provide_job_title';
                    const title = String(parsed?.job?.title || '').trim();
                    assistantContent = title
                        ? allFieldsQuestionnaire(title) +
                        `\n\nMissing right now — Job: [jobType, locations, workMode, primarySkills (≥ 3), company, description]; Script: [scriptName, scriptType, language, gender, voiceModel, content].`
                        : 'Please share the job title (e.g., "Java Developer").';
                }

                // RESOLVE DUP JOB
                if (!assistantContent && parsed.intent === 'resolve_duplicate_job') {
                    actionType = 'resolve_duplicate_job';
                    const extractedJob = parsed.job || {};
                    extractedJob.positions = Number(extractedJob.positions || 1);
                    const extractedScript = parsed.script || {};
                    const reso = parsed.duplicateResolution || {};

                    const companyId = await resolveCompanyId(extractedJob, req);
                    const haveCompany = Boolean(companyId);
                    const needsTitle = (reso?.action === 'ask_title') || !extractedJob?.title || (!reso?.newTitle && reso?.action === 'new_title');

                    if (needsTitle) {
                        assistantContent = `Got it — we can create a new job with everything else the same.\nPlease share the **new job title** (only the title). Optionally, you can also share a new experience range (min–max) if you want to change it.`;
                    } else {
                        const newTitle = reso?.newTitle ? String(reso.newTitle).trim() : extractedJob.title;
                        const newExperience = reso?.newExperience && reso.newExperience.min != null && reso.newExperience.max != null
                            ? { min: Number(reso.newExperience.min), max: Number(reso.newExperience.max) }
                            : { min: Number(extractedJob.experience?.min || 0), max: Number(extractedJob.experience?.max || 0) };

                        const payload = {
                            title: newTitle,
                            internalTitle: '',
                            company: companyId,
                            positions: extractedJob.positions || 1,
                            jobType: extractedJob.jobType,
                            experience: newExperience,
                            workMode: extractedJob.workMode,
                            hybridDetails: extractedJob.workMode === 'Hybrid' ? (extractedJob.hybridDetails || '3 days WFO, 2 days WFH') : '',
                            locations: (extractedJob.locations || []).map(s => String(s).trim()).filter(Boolean),
                            salary: { min: Number(extractedJob.salary?.min || 0), max: Number(extractedJob.salary?.max || 0), currency: 'INR' },
                            educationDetails: [],
                            primarySkills: (extractedJob.primarySkills || []).map(s => String(s).trim()).filter(Boolean),
                            secondarySkills: [],
                            description: extractedJob.description || `Auto-created via Assistant from request: "${lastUserOnly}"`,
                            recruiterNotes: 'Created by Assistant',
                            enableAICall: true,
                            isWalkIn: false,
                            walkInDetails: {},
                            status: 'active',
                            unit: null,
                        };

                        const dup = await req.conn.models['Job'].findOne({
                            title: payload.title,
                            company: payload.company,
                            'experience.min': payload.experience.min,
                            'experience.max': payload.experience.max
                        }).lean();

                        if (dup) {
                            assistantContent = `A job with that title and experience still exists for this company.\nExisting Job ID: ${dup._id}\n\nPlease provide a **different job title** (everything else can remain the same), or share a new experience range.`;
                        } else {
                            let job;
                            try {
                                job = await jobSvcWS.create({ ...payload, createdBy: req.user.sub }, req);
                            } catch (err) {
                                if (isUnauthorizedError(err)) {
                                    const body = unauthorizedBody();
                                    sendMessage({ event: 'unauthorized', ...body });
                                    return;
                                }
                                assistantContent = `I tried to create the job but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                            }
                            if (job?._id) {
                                createdJob = job; didAct = true;
                                let scriptContent = extractedScript.content;
                                if (!scriptContent && extractedScript.generate) {
                                    try {
                                        scriptContent = await scriptSvcWS.generateScriptFromJob({
                                            job, jobId: job._id, candidateId: '', extraQuestion: extractedScript.extraQuestion || '', req
                                        });
                                    } catch { }
                                }
                                const scriptPayload = {
                                    jobId: job._id,
                                    scriptName: extractedScript.scriptName,
                                    scriptType: String(extractedScript.scriptType || '').toLowerCase(),
                                    extraQuestion: extractedScript.extraQuestion || '',
                                    content: scriptContent || '',
                                    language: extractedScript.language,
                                    gender: String(extractedScript.gender || '').toUpperCase(),
                                    voiceModel: extractedScript.voiceModel,
                                };
                                const stillMissing = missingScriptFields({ ...scriptPayload, generate: !!extractedScript.generate });
                                if (stillMissing.length) {
                                    assistantContent = `Job posted • ID: ${job._id}\n\nNow I need Script details (${stillMissing.join(', ')}) before I can create the script.\nReply with: Script Name, Type (aicall|email|sms), Language (e.g., en-IN), Gender (MALE|FEMALE|NEUTRAL), Voice Model, and either "generate" or paste the content.`;
                                } else {
                                    const dupScr = await req.conn.models['Script'].findOne({ jobId: job._id }).lean();
                                    if (dupScr) await req.conn.models['Script'].findByIdAndUpdate(dupScr._id, scriptPayload);
                                    else await scriptSvcWS.create({ ...scriptPayload, client: req.user.sub }, req);
                                    assistantContent = `Posted **${job.title}** (${job.jobType}) for company ${job.company} with ${job.experience?.min}-${job.experience?.max} yrs, ${job.workMode}, locations: ${job.locations?.join(', ') || '—'}.\nJob ID: ${job._id}\nScript saved: ${scriptPayload.scriptName}`;
                                }
                            }
                        }
                    }
                }

                // CREATE JOB
                if (!assistantContent && parsed.intent === 'create_job') {
                    actionType = 'create_job';
                    const extractedJob = parsed.job || {};
                    extractedJob.positions = Number(extractedJob.positions || 1);
                    const extractedScript = parsed.script || {};

                    const companyId = await resolveCompanyId(extractedJob, req);
                    const haveCompany = Boolean(companyId);

                    if (!extractedJob.title) {
                        assistantContent = `Sure — what's the **job title**?\nYou can also paste the **full JD**, and I’ll create the job from that.`;
                    } else {
                        const jobMissing = missingJobFields(extractedJob, haveCompany);
                        const scriptMissing = missingScriptFields(extractedScript);

                        if (jobMissing.length || scriptMissing.length) {
                            assistantContent = allFieldsQuestionnaire(extractedJob.title) +
                                `\n\nMissing right now — Job: [${jobMissing.join(', ') || 'none'}]; Script: [${scriptMissing.join(', ') || 'none'}].`;
                        } else {
                            const payload = {
                                title: extractedJob.title,
                                internalTitle: '',
                                company: companyId,
                                positions: extractedJob.positions || 1,
                                jobType: extractedJob.jobType,
                                experience: { min: Number(extractedJob.experience?.min || 0), max: Number(extractedJob.experience?.max || 0) },
                                workMode: extractedJob.workMode,
                                hybridDetails: extractedJob.workMode === 'Hybrid' ? (extractedJob.hybridDetails || '3 days WFO, 2 days WFH') : '',
                                locations: (extractedJob.locations || []).map(s => String(s).trim()).filter(Boolean),
                                salary: { min: Number(extractedJob.salary?.min || 0), max: Number(extractedJob.salary?.max || 0), currency: 'INR' },
                                educationDetails: [],
                                primarySkills: (extractedJob.primarySkills || []).map(s => String(s).trim()).filter(Boolean),
                                secondarySkills: [],
                                description: extractedJob.description || `Auto-created via Assistant from request: "${lastUserOnly}"`,
                                recruiterNotes: 'Created by Assistant',
                                enableAICall: true,
                                isWalkIn: false,
                                walkInDetails: {},
                                status: 'active',
                                unit: null,
                            };

                            const dup = await req.conn.models['Job'].findOne({
                                title: payload.title,
                                company: payload.company,
                                'experience.min': payload.experience.min,
                                'experience.max': payload.experience.max
                            }).lean();

                            if (dup) {
                                assistantContent = `A job with the same title and experience already exists for that company.\nExisting Job ID: ${dup._id}\n\nWould you like me to create a **new job** with a *different job title* while keeping everything else the same? If yes, just reply with the **new title**. You can also change the experience range if needed.`;
                            } else {
                                let job;
                                try {
                                    job = await jobSvcWS.create({ ...payload, createdBy: req.user.sub }, req);
                                } catch (err) {
                                    if (isUnauthorizedError(err)) {
                                        const body = unauthorizedBody();
                                        sendMessage({ event: 'unauthorized', ...body });
                                        return;
                                    }
                                    assistantContent = `I tried to create the job but hit an error: ${err?.message || 'Unknown error'}.\nPlease review the details and try again.`;
                                }

                                if (job?._id) {
                                    createdJob = job; didAct = true;
                                    let scriptContent = extractedScript.content;
                                    if (!scriptContent && extractedScript.generate) {
                                        try {
                                            scriptContent = await scriptSvcWS.generateScriptFromJob({
                                                job, jobId: job._id, candidateId: '', extraQuestion: extractedScript.extraQuestion || '', req
                                            });
                                        } catch { }
                                    }
                                    const scriptPayload = {
                                        jobId: job._id,
                                        scriptName: extractedScript.scriptName,
                                        scriptType: String(extractedScript.scriptType || '').toLowerCase(),
                                        extraQuestion: extractedScript.extraQuestion || '',
                                        content: scriptContent || '',
                                        language: extractedScript.language,
                                        gender: String(extractedScript.gender || '').toUpperCase(),
                                        voiceModel: extractedScript.voiceModel,
                                    };
                                    const stillMissing = missingScriptFields({ ...scriptPayload, generate: !!extractedScript.generate });
                                    if (stillMissing.length) {
                                        assistantContent = `Job posted • ID: ${job._id}\n\nNow I need Script details (${stillMissing.join(', ')}) before I can create the script.\nReply with: Script Name, Type (aicall|email|sms), Language (e.g., en-IN), Gender (MALE|FEMALE|NEUTRAL), Voice Model, and either "generate" or paste the content.`;
                                    } else {
                                        const dupScr = await req.conn.models['Script'].findOne({ jobId: job._id }).lean();
                                        if (dupScr) await req.conn.models['Script'].findByIdAndUpdate(dupScr._id, scriptPayload);
                                        else await scriptSvcWS.create({ ...scriptPayload, client: req.user.sub }, req);
                                        assistantContent = `Posted **${job.title}** (${job.jobType}) for company ${job.company} with ${job.experience?.min}-${job.experience?.max} yrs, ${job.workMode}, locations: ${job.locations?.join(', ') || '—'}.\nJob ID: ${job._id}\nScript saved: ${scriptPayload.scriptName}`;
                                    }
                                }
                            }
                        }
                    }
                }

                if (!assistantContent) {
                    const completion = await chatCompletionByOpenAI(messages, req);
                    assistantContent = completion?.choices?.[0]?.message?.content?.trim?.() || 'Sorry, I had trouble answering that.';
                }

                let audioBase64 = null;
                if (tts) {
                    const audioBuf = await universalTextToSpeech(
                        assistantContent, language, gender, voiceModel, audioEncoding, sampleRateHertz, speakingRate
                    );
                    audioBase64 = audioBuf?.toString('base64') || null;
                }

                sendMessage({
                    event: 'message',
                    success: true,
                    message: { role: 'assistant', content: assistantContent },
                    audioBase64,
                    audioEncoding,
                    didAct,
                    actionType,
                    createdJobId: createdJob?._id || null,
                    createdCompanyId: createdCompany?._id || null,
                    logs: debug ? steps : undefined,
                });
            } catch (err) {
                if (isUnauthorizedError(err)) {
                    req.log.warn({ err }, '[assistant/ws] unauthorized during message');
                    const body = unauthorizedBody();
                    sendMessage({ event: 'unauthorized', ...body });
                    try { connection.socket.close(); } catch { }
                    return;
                }
                req.log.error('[assistant/ws] error:', err);
                sendMessage({ event: 'error', error: 'Assistant failed' });
            }
        });

        connection.socket.on('close', () => {
            req.log.info('[assistant/ws] socket closed');
        });
    });
}
