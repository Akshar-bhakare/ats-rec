/**
 * ATS integration journey runner.
 *
 * Run with:
 *    AI_SELEKT_BASE_URL="http://localhost:8080" \
 *    AI_SELEKT_EMAIL="demo.partner@hirexit.com" \
 *    AI_SELEKT_PASSWORD="Passw0rd!" \
 *    node SDLC_Docs/ats_integration_v1_demo.js
 *
 * The script mirrors the Postman collection so you can smoke-test the flow from Node.js.
 * Customize payloads as needed before using against production data.
 */

const config = {
    baseUrl: process.env.AI_SELEKT_BASE_URL || 'http://localhost:8080',
    email: process.env.AI_SELEKT_EMAIL || 'demo.partner@hirexit.com',
    password: process.env.AI_SELEKT_PASSWORD || 'Passw0rd!',
    scheduleTimeISO: process.env.AI_SELEKT_SCHEDULE_TIME || new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    triggerAiCallNow: process.env.AI_SELEKT_TRIGGER_CALL === 'true'
};

const state = {
    token: '',
    companyId: '',
    jobId: '',
    candidateId: '',
    atsId: '',
    scriptId: '',
    jobDescription: 'a dummy description',
    scriptContent: 'Hello {{candidate_first_name}}, this is the AI recruiter calling from Acme Fintech Labs to discuss the AI Customer Success Manager role.'
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

const request = async (path, options = {}, expectJson = true) => {
    const headers = options.headers || {};
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
    if (options.body && !headers['Content-Type']) {
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
};

const assignCandidateToJob = async () => {
    logStep('Assign candidate to job (build ATS record)');
    await request('/api/candidates/ats/integration/v1/assign-job', {
        method: 'POST',
        body: JSON.stringify({
            candidateIds: [state.candidateId],
            jobIds: [state.jobId]
        })
    });
    console.log('Candidate assigned to job via CandidateATS');
};

const listCandidateATS = async () => {
    logStep('Fetch Candidate ATS list for the candidate');
    const list = await request('/api/candidates/ats', { method: 'GET' });
    const match = list.find((cand) => String(cand._id) === String(state.candidateId));
    state.atsId = match?.applications?.[0]?._id;
    console.log('ATS ID:', state.atsId || 'not found (existing data may not include assignments)');
};

const generateScript = async () => {
    logStep('Generate script via AI helper');
    const payload = {
        jobId: state.jobId,
        candidateId: state.candidateId,
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
        scriptType: 'AI_CALL',
        extraQuestion: 'Why do you enjoy working with AI-first customer teams?',
        content: state.scriptContent,
        language: 'en-US',
        gender: 'female',
        voiceModel: 'en-US-Neural2-F'
    };
    const res = await request('/api/scripts/ats/integration/v1', {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    state.scriptId = res?._id;
    console.log('Script ID:', state.scriptId);
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
        console.log('Skipping immediate AI call trigger (set AI_SELEKT_TRIGGER_CALL=true to enable).');
        return;
    }
    logStep('Trigger AI call now');
    const result = await request(`/api/ai/call/ats/integration/v1/trigger/plivo/${state.candidateId}/${state.jobId}/`, {
        method: 'GET'
    });
    console.log('AI call trigger response:', result);
};

const main = async () => {
    try {
        await login();
        await createCompany();
        await generateJobDescription();
        await createJob();
        await createCandidate();
        await assignCandidateToJob();
        await listCandidateATS();
        await generateScript();
        await createScript();
        await scheduleAiCall();
        await triggerAiCallNow();
        console.log('\n✅ Flow completed successfully.');
        console.log('Summary:', {
            companyId: state.companyId,
            jobId: state.jobId,
            candidateId: state.candidateId,
            atsId: state.atsId,
            scriptId: state.scriptId
        });
    } catch (err) {
        console.error('\n❌ Flow failed:', err.message);
        process.exit(1);
    }
};

main();
