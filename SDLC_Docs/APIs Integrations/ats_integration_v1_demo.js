/**
 * ATS integration journey runner.
 *
 * Run with:
 *    AI_SELEKT_BASE_URL="http://localhost:8080" \
 *    AI_SELEKT_EMAIL="demo.partner@hirexit.com" \
 *    AI_SELEKT_PASSWORD="Passw0rd!" \
 *    AI_SELEKT_TRIGGER_CALL=true \
 *    AI_SELEKT_SIMULATE_PLIVO=true \
 *    node SDLC_Docs/ats_integration_v1_demo.js
 *
 * The script mirrors the Postman collection so you can smoke-test the flow from Node.js.
 * Customize payloads as needed before using against production data.
 */

const fs = require('fs');
const path = require('path');
let WebSocketClient = null;
try {
    if (typeof WebSocket !== 'undefined') {
        WebSocketClient = WebSocket;
    } else {
        const wsModule = require('ws');
        WebSocketClient = wsModule?.WebSocket || wsModule;
    }
} catch (err) {
    console.warn('ℹ️  WebSocket client unavailable; WS simulation will be skipped.');
}

const config = {
    baseUrl: process.env.AI_SELEKT_BASE_URL || 'http://localhost:8080',
    email: process.env.AI_SELEKT_EMAIL || 'info@aiselekt.com',
    password: process.env.AI_SELEKT_PASSWORD || 'pass123',
    scheduleTimeISO: process.env.AI_SELEKT_SCHEDULE_TIME || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    triggerAiCallNow: process.env.AI_SELEKT_TRIGGER_CALL ? process.env.AI_SELEKT_TRIGGER_CALL === 'true' : true,
    simulatePlivoHooks: process.env.AI_SELEKT_SIMULATE_PLIVO ? process.env.AI_SELEKT_SIMULATE_PLIVO === 'true' : true,
};

const state = {
    token: '',
    companyId: '',
    jobId: '',
    candidateId: '',
    atsId: '',
    scriptId: '',
    callUUID: '',
    wsUrl: '',
    jobDescription: 'a dummy description',
    scriptContent: 'Hello {{candidate_first_name}}, this is the AI recruiter calling from Acme Fintech Labs to discuss the AI Customer Success Manager role.'
};

const MU = 255;
const encodeMulawSample = (sample) => {
    const sign = sample < 0 ? 0x80 : 0;
    const clamped = Math.min(Math.abs(sample), 1);
    const magnitude = Math.log1p(MU * clamped) / Math.log1p(MU);
    const code = (magnitude * 127) | 0;
    return (~(sign | code)) & 0xff;
};

const float32ToMulawBuffer = (float32) => {
    const len = float32.length;
    const buffer = Buffer.alloc(len);
    for (let i = 0; i < len; i++) {
        buffer[i] = encodeMulawSample(float32[i]);
    }
    return buffer;
};

const generateToneChunks = (durationMs = 800, frequency = 440, sampleRate = 8000, chunkSamples = 160) => {
    const totalSamples = Math.floor((sampleRate * durationMs) / 1000);
    const float32 = new Float32Array(totalSamples);
    for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        float32[i] = Math.sin(2 * Math.PI * frequency * t) * 0.3;
    }
    const muLaw = float32ToMulawBuffer(float32);
    const chunks = [];
    for (let i = 0; i < muLaw.length; i += chunkSamples) {
        const frame = muLaw.slice(i, Math.min(i + chunkSamples, muLaw.length));
        chunks.push(frame.toString('base64'));
    }
    return chunks;
};

const recordedAudioPath = process.env.AI_SELEKT_TTS_FILE
    || path.join(__dirname, 'recordedTtsBufHeyHi.raw');
let recordedAudioBuffer = null;

const loadRecordedAudio = () => {
    if (recordedAudioBuffer) return recordedAudioBuffer;
    try {
        recordedAudioBuffer = fs.readFileSync(recordedAudioPath);
    } catch (err) {
        console.warn('Recorded audio not found:', err?.message || err);
        recordedAudioBuffer = null;
    }
    return recordedAudioBuffer;
};

const streamToneOverWs = (ws, chunkIntervalMs = 20) => {
    const chunks = generateToneChunks(3000);
    let seq = 0;
    const openState = (WebSocketClient && WebSocketClient.OPEN) || 1;

    const sendChunk = () => {
        if (ws.readyState !== openState) return;

        if (seq >= chunks.length) {
            const stopEvent = {
                event: 'stop',
                stop: { callId: state.callUUID }
            };
            ws.send(JSON.stringify(stopEvent));
            console.log('>>', stopEvent);
            return;
        }

        const payload = chunks[seq];
        const mediaEvent = {
            event: 'media',
            media: { payload }
        };
        ws.send(JSON.stringify(mediaEvent));
        console.log('>> tone', mediaEvent.media.payload.length);
        seq += 1;
        setTimeout(sendChunk, chunkIntervalMs);
    };

    sendChunk();
};

const streamRecordedAudio = (ws, chunkIntervalMs = 20) => {
    const buffer = loadRecordedAudio();
    if (!buffer) {
        streamToneOverWs(ws, chunkIntervalMs);
        return;
    }

    const frameSize = 160;
    const openState = (WebSocketClient && WebSocketClient.OPEN) || 1;
    let offset = 0;

    const sendFrame = () => {
        if (ws.readyState !== openState) return;

        if (offset >= buffer.length) {
            const stopEvent = {
                event: 'stop',
                stop: { callId: state.callUUID }
            };
            ws.send(JSON.stringify(stopEvent));
            console.log('>>', stopEvent);
            return;
        }

        const frame = buffer.slice(offset, offset + frameSize);
        offset += frameSize;
        const payload = Buffer.from(frame).toString('base64');
        ws.send(JSON.stringify({ event: 'media', media: { payload } }));
        console.log('>> recorded', payload.length);
        setTimeout(sendFrame, chunkIntervalMs);
    };

    sendFrame();
};

const cleanupTasks = [];

const registerCleanup = (label, fn) => {
    cleanupTasks.push({ label, fn });
};

const runCleanup = async () => {
    if (!cleanupTasks.length) return;
    console.log('\n🔄 Running cleanup before exit...');
    for (let i = cleanupTasks.length - 1; i >= 0; i--) {
        const task = cleanupTasks[i];
        try {
            await task.fn();
            console.log(`✔️  Cleaned up ${task.label}`);
        } catch (err) {
            console.error(`⚠️  Failed to clean up ${task.label}: ${err.message}`);
        }
    }
};

const logStep = (title, details) => {
    console.log(`\n=== ${title} ===`);
    if (details) console.log(details);
};

const handleResponse = async (res) => {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const request = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    if (options.body && !headers['Content-Type'] && !(options.headers && options.headers['Content-Type'])) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${config.baseUrl}${path}`, {
        method: 'GET',
        ...options,
        headers
    });

    const parsed = await handleResponse(response);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${JSON.stringify(parsed, null, 2)}`);
    }
    return parsed;
};

const login = async () => {
    logStep('Login');
    const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: config.email, password: config.password })
    });
    state.token = data.token;
    console.log('Token captured, user:', data?.user?.email);
};

const createCompany = async () => {
    logStep('Create company');
    const payload = {
        name: 'Acme Fintech Labs',
        industry: 'Fintech & AI',
        size: '201-500 employees',
        website: 'https://careers.acme-fintech.example.com',
        description: 'AI-first banking platform simplifying underwriting for SMBs.',
        logoUrl: 'https://cdn.example.com/logos/acme-fintech.png',
        about: 'Acme Fintech Labs builds risk-intelligence products with human-in-the-loop workflows.',
        policyBenefits: 'ESOPs from day one, hybrid allowance, IP buyout.',
        faqs: [
            'What is the default notice period for new hires?',
            'Do you sponsor relocation to Bengaluru?'
        ]
    };
    const res = await request('/api/companies/ats/integration/v1', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    state.companyId = res?.details?.company?._id || res?._id;
    console.log('Company ID:', state.companyId);
    registerCleanup('company', async () => {
        if (!state.companyId) return;
        await request(`/api/companies/ats/integration/v1/${state.companyId}`, { method: 'DELETE' });
    });
};

const generateJobDescription = async () => {
    logStep('Generate job description (AI)');
    const payload = {
        title: 'AI Customer Success Manager',
        skills: ['Customer Success', 'AI Adoption', 'SQL'],
        experience: { min: 5, max: 8 },
        locations: ['Bengaluru'],
        salary: { min: 1500000, max: 2300000, currency: 'INR' },
        workMode: 'Hybrid',
        educationDetails: [
            {
                level: 'Bachelor',
                qualification: ['B.E'],
                streamOrSpecialization: 'Computer Science'
            }
        ]
    };
    const result = await request('/api/jobs/ats/integration/v1/generate-JobDescription', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    const jobDescription = result.jobDescription || result?.details?.jobDescription || '';
    state.jobDescription = formatJobDescription(jobDescription) || state.jobDescription;
    console.log('JD preview:\n', state.jobDescription.slice(0, 200), '...');
};

const formatJobDescription = (jobDescription) => {
    if (!jobDescription) return '';
    if (typeof jobDescription === 'string') return jobDescription;
    const overview = jobDescription.overview || '';
    const responsibilities = Array.isArray(jobDescription.responsibilities) ? jobDescription.responsibilities : [];
    const requirements = Array.isArray(jobDescription.requirements) ? jobDescription.requirements : [];
    const benefits = Array.isArray(jobDescription.benefits) ? jobDescription.benefits : [];

    return [
        overview,
        responsibilities.length ? 'Responsibilities:\n' + responsibilities.join('\n') : '',
        requirements.length ? 'Requirements:\n' + requirements.join('\n') : '',
        benefits.length ? 'Benefits:\n' + benefits.join('\n') : ''
    ]
        .filter(Boolean)
        .join('\n\n');
};

const createJob = async () => {
    logStep('Create job');
    const payload = {
        title: 'AI Customer Success Manager',
        internalTitle: 'CSM-AI-2025',
        jobType: 'Full-time',
        locations: ['Bengaluru', 'Remote'],
        salary: { min: 1500000, max: 2500000, currency: 'INR' },
        experience: { min: 5, max: 8 },
        workMode: 'Hybrid',
        hybridDetails: '3 days in Bengaluru HQ, 2 days remote.',
        educationDetails: [
            { level: 'Bachelor', qualification: ['B.E', 'B.Tech'], streamOrSpecialization: 'Computer Science' }
        ],
        certifications: ['PMP', 'AWS CCP'],
        positions: 2,
        primarySkills: ['B2B SaaS', 'Customer Success', 'AI Adoption'],
        secondarySkills: ['SQL', 'Looker Studio'],
        description: state.jobDescription,
        shortDescription: 'AI-led CS leader role',
        recruiterNotes: 'Prior SaaS onboarding experience is a must.',
        enableAICall: true,
        isWalkIn: false,
        company: state.companyId,
        status: 'active'
    };
    const res = await request('/api/jobs/ats/integration/v1', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    state.jobId = res?._id;
    console.log('Job ID:', state.jobId);
    registerCleanup('job', async () => {
        if (!state.jobId) return;
        await request(`/api/jobs/ats/integration/v1/${state.jobId}`, { method: 'DELETE' });
    });
};

const generateScript = async () => {
    logStep('Generate script via AI helper');
    const payload = {
        jobId: state.jobId,
        extraQuestion: 'Why do you enjoy working with AI-first customer teams?'
    };
    const result = await request('/api/scripts/ats/integration/v1/generate-script', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    if (result?.content) {
        state.scriptContent = result.content;
    }
    console.log('Script content preview:\n', state.scriptContent.slice(0, 200), '...');
};

const createScript = async () => {
    logStep('Create script');
    const payload = {
        jobId: state.jobId,
        scriptName: 'AI Screening Script - CSM',
        scriptType: 'aicall',
        extraQuestion: 'Why do you enjoy working with AI-first customer teams?',
        content: state.scriptContent,
        language: 'en-IN',
        gender: 'FEMALE',
        voiceModel: 'en-IN-Chirp-HD-F'
    };
    const res = await request('/api/scripts/ats/integration/v1', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    state.scriptId = res?._id;
    console.log('Script ID:', state.scriptId);
    registerCleanup('script', async () => {
        if (!state.scriptId) return;
        await request(`/api/scripts/ats/integration/v1/${state.scriptId}`, { method: 'DELETE' });
    });
};

const createCandidate = async () => {
    logStep('Create candidate');
    const payload = {
        firstName: 'Ishita',
        lastName: 'Singh',
        email: `ishita.singh+atsdemo${Date.now()}@samplemail.com`,
        countryCode: '+91',
        phoneNumber: `${Math.floor(9000000000 + Math.random() * 999999999)}`,
        panCardNumber: 'ABCDE1234F',
        skills: [
            { name: 'Customer Success', experience: '6 years' },
            { name: 'AI Implementations', experience: '3 years' }
        ],
        resumeUrl: 'https://cdn.example.com/resumes/ishita-singh.pdf',
        resumeText: 'Customer success lead owning AI rollouts across 40 enterprise accounts.',
        jobs: [state.jobId],
        applications: [],
        sourcePlatform: 'Partner ATS',
        sourceExtraInfo: 'Synced from Demo ATS instance'
    };
    const res = await request('/api/candidates/ats/integration/v1', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    state.candidateId = res?._id;
    console.log('Candidate ID:', state.candidateId);
    registerCleanup('candidate', async () => {
        if (!state.candidateId) return;
        await request(`/api/candidates/ats/integration/v1/${state.candidateId}`, { method: 'DELETE' });
    });
};

const listCandidateATS = async () => {
    logStep('Fetch Candidate ATS list for the candidate');
    const list = await request('/api/candidates/ats', { method: 'GET' });
    const match = list.find((cand) => String(cand._id) === String(state.candidateId));
    state.atsId = match?.applications?.[0]?._id;
    console.log('ATS ID:', state.atsId || 'not found (existing data may not include assignments)');
};

const scheduleAiCall = async () => {
    logStep('Schedule AI call');
    await request('/api/ai/call/ats/integration/v1/schedule/', {
        method: 'POST',
        body: JSON.stringify({
            scheduleTime: config.scheduleTimeISO,
            candidates: [{ _id: state.candidateId, jobId: state.jobId }]
        })
    });
    console.log('Call scheduled for', config.scheduleTimeISO);
};

const triggerAiCallNow = async () => {
    if (!config.triggerAiCallNow) {
        console.log('\nSkipping immediate AI call trigger (set AI_SELEKT_TRIGGER_CALL=true to enable).');
        return null;
    }
    logStep('Trigger AI call now');
    const result = await request(`/api/ai/call/ats/integration/v1/trigger/plivo/${state.candidateId}/${state.jobId}/?callUUID=call_simulation___${Date.now()}`, {
        method: 'GET'
    });
    state.callUUID = result?.details?.callUUID || result?.callUUID || '';
    console.log('AI call trigger response:', result);
    return result;
};

const extractWsUrlFromXml = (xml) => {
    if (typeof xml !== 'string') {
        return '';
    } else {
        let resUrl;
        const bodyMatch = xml.match(/<Stream[^>]*>(.*?)<\/Stream>/i);
        if (bodyMatch && bodyMatch[1].trim()) {
            resUrl = bodyMatch[1].trim();
        } else {
            const attrMatch = xml.match(/<Stream[^>]*url="([^"]+)"/i);
            resUrl = attrMatch ? attrMatch[1] : '';
        }

        resUrl = resUrl.replace("wss://localhost", "ws://localhost").replace("wss://127.0.0.1", "ws://127.0.0.1");

        // if (resUrl?.includes?.("localhost:") || resUrl?.includes?.("127.0.0.1:")) {
        //     resUrl = resUrl.replace("wss:", "ws:");
        //     console.log(
        //         "resUrl: ", resUrl
        //     );
        // }

        return resUrl;
    }
};

const connectToCallWebSocket = async (wsUrl) => {
    if (!WebSocketClient) {
        console.warn('WebSocket client library not available; skipping WS connection.');
        return;
    }

    await new Promise((resolve, reject) => {
        const ws = new WebSocketClient(wsUrl, {
            headers: state.token ? { Authorization: `Bearer ${state.token}` } : undefined
        });

        ws.onopen = () => {
            console.log('🔌 WebSocket connected:', wsUrl);
            const startEvent = {
                event: 'start',
                start: { callId: state.callUUID, streamId: 'demo-sim' }
            };
            ws.send(JSON.stringify(startEvent));
            console.log('>>', startEvent);
            streamRecordedAudio(ws);
        };

        ws.onmessage = (msg) => {
            const text = typeof msg === 'string' ? msg : msg?.data || msg?.toString?.() || '';
            console.log('<<', text?.media?.audioText || text?.media?.payload || text);
        };

        ws.onclose = () => {
            console.log('🔌 WebSocket closed');
            resolve();
        };

        ws.onerror = (err) => {
            console.error('WebSocket error:', err?.message || err);
            reject(err);
        };
    });
};


const simulateAnswerAndWebSocket = async () => {
    if (!config.simulatePlivoHooks) {
        console.log('Skipping Answer/WebSocket simulation (set AI_SELEKT_SIMULATE_PLIVO=true to enable).');
        return;
    }
    if (!state.callUUID) {
        console.warn('callUUID missing; cannot simulate Answer/WebSocket flow.');
        return;
    }

    logStep('Invoke answer webhook with mock Plivo payload');
    const payload = {
        CallUUID: state.callUUID,
        To: state.candidateId,
        From: state.jobId,
        Direction: 'outbound',
        Event: 'Start'
    };
    const answerXml = await request(
        `/api/ai/call/ats/integration/v1/answer/plivo/${state.candidateId}/${state.jobId}/`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }
    );

    if (typeof answerXml === 'string') {
        console.log('Answer XML snippet:\n', answerXml.slice(0, 100), '...');
    } else {
        console.log('Answer response (non-XML):', answerXml);
    }

    const wsUrl = extractWsUrlFromXml(answerXml);
    state.wsUrl = wsUrl;

    if (!wsUrl) {
        console.warn('Could not find Stream URL in answer response; skipping WebSocket test.');
        return;
    }

    console.log('Discovered WebSocket URL:', wsUrl);
    await connectToCallWebSocket(wsUrl);
};

const main = async () => {
    try {
        await login();
        await createCompany();
        // await generateJobDescription();
        await createJob();
        await generateScript();
        await createScript();
        await createCandidate();
        await listCandidateATS();
        // await scheduleAiCall();
        const triggerResult = await triggerAiCallNow();
        if (triggerResult) {
            try {
                await simulateAnswerAndWebSocket();
            } catch (err) {
                console.warn('Answer/WebSocket simulation failed:', err.message);
            }
        }

        setTimeout(() => {
            console.log('\n✅ Flow completed successfully.');
            console.log('Summary:', {
                companyId: state.companyId,
                jobId: state.jobId,
                candidateId: state.candidateId,
                atsId: state.atsId,
                scriptId: state.scriptId,
                callUUID: state.callUUID,
                wsUrl: state.wsUrl
            });
            runCleanup();
        }, 5_000);

    } catch (err) {
        console.error('\n❌ Flow failed:', err.message);
        await runCleanup();
        process.exit(1);
    }
};



main();
