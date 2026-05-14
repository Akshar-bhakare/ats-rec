const TRAILING_SLASHES = /\/+$/;

export const normalizePathname = (pathname = '') => {
    const cleaned = String(pathname || '').trim().replace(TRAILING_SLASHES, '');
    return cleaned || '/';
};

const pathStartsWith = (pathname, prefix) => {
    const current = normalizePathname(pathname);
    const target = normalizePathname(prefix);

    if (target === '/') return current === '/';
    return current === target || current.startsWith(`${target}/`);
};

const valueMatches = (actual, expected) => {
    return String(actual || '').toLowerCase() === String(expected || '').toLowerCase();
};

const queryMatches = (searchParams, query = {}) => {
    return Object.entries(query).every(([key, expected]) => valueMatches(searchParams.get(key), expected));
};

const queryBlocked = (searchParams, queryNot = {}) => {
    return Object.entries(queryNot).some(([key, expected]) => {
        if (expected === '*') return searchParams.has(key);
        return valueMatches(searchParams.get(key), expected);
    });
};

export const JOURNEY_ROLE_ORDER = [
    'client_admin',
    'recruiter',
    'interviewer',
    'candidate',
];

export const JOURNEY_ROUTE_SEGMENTS = {
    client_admin: 'client-admin',
    recruiter: 'recruiter',
    interviewer: 'interviewer',
    candidate: 'candidate',
};

export const JOURNEY_MAP = {
    client_admin: {
        audienceLabel: 'Client-admin',
        goal: 'Set up people, jobs, and process controls for fast high-volume hiring.',
        steps: [
            {
                id: 'dashboard',
                title: 'Review hiring priorities',
                shortLabel: 'Dashboard',
                description: 'Use dashboard signals to identify pending interviews, stuck candidates, and hiring bottlenecks first.',
                to: '/dashboard/',
                matchPaths: ['/dashboard'],
            },
            {
                id: 'settings',
                title: 'Configure client settings and credits',
                shortLabel: 'Settings',
                description: 'Validate account setup, service keys, and credit usage before scaling to bulk campaigns.',
                to: '/settings/',
                matchPaths: ['/settings', '/credits/used'],
            },
            {
                id: 'team_setup',
                title: 'Set up managers and recruiters',
                shortLabel: 'Team Setup',
                description: 'Define ownership by creating managers/recruiters and assigning responsibilities.',
                to: '/managers/',
                matchPaths: ['/managers', '/recruiters'],
            },
            {
                id: 'hiring_assets',
                title: 'Create companies and jobs',
                shortLabel: 'Companies & Jobs',
                description: 'Prepare hiring demand by configuring companies and opening role-wise requisitions.',
                to: '/companies/',
                matchPaths: ['/companies', '/jobs'],
            },
            {
                id: 'stages',
                title: 'Define ATS stages',
                shortLabel: 'Stages',
                description: 'Standardize movement criteria so every recruiter follows the same evaluation flow.',
                to: '/stages/',
                matchPaths: ['/stages'],
            },
            {
                id: 'interviewer_panel',
                title: 'Onboard interviewers',
                shortLabel: 'Interviewers',
                description: 'Set up interviewer profiles and panel coverage for upcoming interview slots.',
                to: '/interviewers',
                matchPaths: ['/interviewers'],
            },
            {
                id: 'candidate_intake',
                title: 'Build candidate pool',
                shortLabel: 'Candidates',
                description: 'Upload/import candidates and align them with open jobs for immediate pipeline action.',
                to: '/candidates/',
                matchPaths: ['/candidates', '/share/upload'],
            },
            {
                id: 'pipeline_progress',
                title: 'Drive ATS and pipeline progression',
                shortLabel: 'Pipeline',
                description: 'Use ATS and hiring pipeline views to move candidates forward and reduce drop-offs.',
                to: '/hiring-pipeline/',
                matchPaths: ['/hiring-pipeline', '/ats'],
            },
            {
                id: 'interview_closure',
                title: 'Schedule and close interview loop',
                shortLabel: 'Interviews',
                description: 'Schedule interviews, review outcomes, and close requisitions with final selections.',
                to: '/interviews',
                matchPaths: ['/interviews'],
            },
        ],
    },
    recruiter: {
        audienceLabel: 'Recruiter',
        goal: 'Move candidates from sourcing to interview decisions with minimal cycle time.',
        steps: [
            {
                id: 'dashboard',
                title: 'Start from recruiter dashboard',
                shortLabel: 'Dashboard',
                description: 'Check assigned workload and prioritize urgent jobs/candidates first.',
                to: '/dashboard/',
                matchPaths: ['/dashboard'],
            },
            {
                id: 'jobs',
                title: 'Review assigned jobs',
                shortLabel: 'Jobs',
                description: 'Confirm role requirements and shortlist criteria before candidate movement.',
                to: '/jobs/',
                matchPaths: ['/jobs'],
            },
            {
                id: 'candidate_pool',
                title: 'Upload and shortlist candidates',
                shortLabel: 'Candidates',
                description: 'Build job-aligned talent pools from uploads, referrals, and existing ATS records.',
                to: '/candidates/',
                matchPaths: ['/candidates'],
            },
            {
                id: 'pipeline',
                title: 'Advance candidates in pipeline',
                shortLabel: 'Pipeline',
                description: 'Keep movement velocity high using ATS status updates and hiring pipeline actions.',
                to: '/hiring-pipeline/',
                matchPaths: ['/hiring-pipeline', '/ats'],
            },
            {
                id: 'schedule_interviews',
                title: 'Schedule interviews',
                shortLabel: 'Schedule',
                description: 'Use scheduling view to lock interview slots quickly for shortlisted candidates.',
                to: '/interviews?view=schedule',
                matchPaths: ['/interviews'],
                query: { view: 'schedule' },
            },
            {
                id: 'review_interviews',
                title: 'Review interview outcomes',
                shortLabel: 'Outcomes',
                description: 'Track interview feedback, update final status, and move to offer/reject decisions.',
                to: '/interviews',
                matchPaths: ['/interviews'],
                queryNot: { view: 'schedule' },
            },
        ],
    },
    interviewer: {
        audienceLabel: 'Interviewer',
        goal: 'Run structured interviews and submit reliable candidate feedback quickly.',
        steps: [
            {
                id: 'queue',
                title: 'Open assigned queue',
                shortLabel: 'My Interviews',
                description: "Begin from My Interviews to see today's assigned candidate schedule.",
                to: '/my-interviews',
                matchPaths: ['/my-interviews'],
            },
            {
                id: 'live_interview',
                title: 'Conduct live interview session',
                shortLabel: 'Live Session',
                description: 'Join interview call and complete the assessment flow without interruptions.',
                to: '/webrtcai/',
                matchPaths: ['/webrtcai'],
            },
            {
                id: 'feedback',
                title: 'Submit structured feedback',
                shortLabel: 'Feedback',
                description: 'Finalize ratings/comments on interview detail page so recruiters can close decisions.',
                to: '/interviews',
                matchPatterns: [/^\/interviews\/[^/]+$/],
            },
        ],
    },
    candidate: {
        audienceLabel: 'Candidate',
        goal: 'Complete profile, screening, and interview steps with zero confusion.',
        steps: [
            {
                id: 'upload',
                title: 'Upload CV and verify details',
                shortLabel: 'Upload',
                description: 'Use the shared secure link to upload your resume and confirm profile accuracy.',
                to: '/share/upload/',
                matchPaths: ['/share/upload'],
            },
            {
                id: 'screening_call',
                title: 'Complete AI screening interview',
                shortLabel: 'Screening',
                description: 'Attend the scheduled call/interview window and finish required assessment prompts.',
                to: '/webrtcai/',
                matchPaths: ['/webrtcai'],
            },
            {
                id: 'follow_up',
                title: 'Wait for recruiter follow-up',
                shortLabel: 'Follow-up',
                description: 'After completion, keep communication channels active for next-round updates.',
                to: '/share/upload/',
            },
        ],
    },
};

export const isJourneyRole = (roleKey) => {
    return Boolean(roleKey && JOURNEY_MAP[roleKey]);
};

export const resolveJourneyRoleFromUserRole = (role) => {
    const normalizedRole = String(role || '').toLowerCase();

    if (normalizedRole === 'interviewer') return 'interviewer';
    if (normalizedRole === 'recruiter') return 'recruiter';
    if (['client_admin', 'manager', 'ultra_admin'].includes(normalizedRole)) {
        return 'client_admin';
    }

    return null;
};

export const getJourneyRouteForRole = (roleKey) => {
    const segment = JOURNEY_ROUTE_SEGMENTS[roleKey] || JOURNEY_ROUTE_SEGMENTS.candidate;
    return `/journey-map/${segment}/`;
};

export const resolveJourneyRoleFromSegment = (segment = '') => {
    const normalized = String(segment || '').trim().toLowerCase();
    return (
        Object.entries(JOURNEY_ROUTE_SEGMENTS).find(([, value]) => value === normalized)?.[0] ||
        null
    );
};

export const resolveJourneyRole = ({ pathname, role, isAuthenticated }) => {
    const roleFromUser = resolveJourneyRoleFromUserRole(role);
    if (roleFromUser) return roleFromUser;

    const normalizedPath = normalizePathname(pathname);
    if (
        pathStartsWith(normalizedPath, '/share/upload') ||
        pathStartsWith(normalizedPath, '/webrtcai')
    ) {
        return 'candidate';
    }

    if (!isAuthenticated) return null;
    return null;
};

const matchesStep = (step, location) => {
    const normalizedPath = normalizePathname(location?.pathname || '');
    const searchParams = new URLSearchParams(location?.search || '');

    const hasPathMatchers =
        (Array.isArray(step.matchPaths) && step.matchPaths.length > 0) ||
        (Array.isArray(step.matchPatterns) && step.matchPatterns.length > 0);

    if (hasPathMatchers) {
        const matchByPath = (step.matchPaths || []).some((prefix) =>
            pathStartsWith(normalizedPath, prefix)
        );
        const matchByPattern = (step.matchPatterns || []).some((pattern) =>
            pattern instanceof RegExp ? pattern.test(normalizedPath) : false
        );

        if (!matchByPath && !matchByPattern) return false;
    }

    if (step.query && !queryMatches(searchParams, step.query)) return false;
    if (step.queryNot && queryBlocked(searchParams, step.queryNot)) return false;

    return true;
};

export const isLocationOnJourneyStep = (step, location) => {
    if (!step) return false;
    return matchesStep(step, location);
};

export const resolveJourneyStepIndex = (journey, location) => {
    if (!journey || !Array.isArray(journey.steps) || !journey.steps.length) return 0;

    const matchedIndex = journey.steps.findIndex((step) => matchesStep(step, location));
    return matchedIndex >= 0 ? matchedIndex : 0;
};

export const getNextJourneyStep = (journey, currentStepIndex) => {
    if (!journey?.steps?.length) return null;
    const boundedIndex = Math.max(0, Math.min(currentStepIndex, journey.steps.length - 1));
    const nextIndex = Math.min(boundedIndex + 1, journey.steps.length - 1);
    return journey.steps[nextIndex] || null;
};
