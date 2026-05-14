import {
    Users, Search, BrainCircuit, FileSearch, CheckCircle, Code, Video,
    BarChart4, MessageSquare, Phone, Layers, ShieldCheck, Zap,
    Briefcase, GraduationCap, Building2, Stethoscope, Factory, Truck,
    UtensilsCrossed, Globe, LineChart, PieChart, Share2
} from 'lucide-react';

export const WORKFLOW_STEPS = [
    {
        id: 'boolean-generator',
        navLabel: 'Boolean Generator',
        stageLabel: 'Stage 1: Role',
        title: 'Sourcing & Talent Discovery',
        description: 'Convert job descriptions into high-precision search strings instantly. AI-powered Boolean query generation for LinkedIn, Google, and niche talent pools.',
        signalLabel: 'Neural engine active',
        processLabel: 'Processing pipeline...',
        icon: Search,
    },
    {
        id: 'initial-screening',
        navLabel: 'Initial Screening',
        stageLabel: 'Stage 2: Screening',
        title: 'Initial Screening & Candidate Filters',
        description: 'Run AI-first qualification to capture availability, role fit, communication quality, and screening knockout answers before recruiter review.',
        signalLabel: 'Qualification signals live',
        processLabel: 'Candidate fit scoring...',
        icon: MessageSquare,
    },
    {
        id: 'skills-validation',
        navLabel: 'Skills Validation',
        stageLabel: 'Stage 3: Skills',
        title: 'Skills Validation & Match Signals',
        description: 'Layer skill checks, resume evidence, and role-fit scoring into one validation stage so teams can shortlist with more confidence.',
        signalLabel: 'Match signal verified',
        processLabel: 'Capability graph updating...',
        icon: BrainCircuit,
    },
    {
        id: 'skill-assessments',
        navLabel: 'Skill Assessments',
        stageLabel: 'Stage 4: Assessment',
        title: 'Skill Assessments & Practical Proof',
        description: 'Evaluate applied ability with structured assignments, scoring signals, and recruiter-ready summaries that are easy to compare.',
        signalLabel: 'Assessment engine synced',
        processLabel: 'Scoring evidence captured...',
        icon: FileSearch,
    },
    {
        id: 'video-analysis',
        navLabel: 'Video Analysis',
        stageLabel: 'Stage 5: Interview',
        title: 'Video Analysis & Interview Evidence',
        description: 'Capture structured interview responses, communication signals, and behavioral evidence in a format hiring teams can review quickly.',
        signalLabel: 'Interview signals active',
        processLabel: 'Response analysis running...',
        icon: Video,
    },
    {
        id: 'final-coordination',
        navLabel: 'Final Coordination',
        stageLabel: 'Stage 6: Closure',
        title: 'Final Coordination & Decision Flow',
        description: 'Move shortlisted candidates into final scheduling, stakeholder alignment, and decision support without losing momentum or context.',
        signalLabel: 'Stakeholder sync ready',
        processLabel: 'Final handoff preparing...',
        icon: CheckCircle,
    },
    {
        id: 'intelligence-synthesis',
        navLabel: 'Intelligence Synthesis',
        stageLabel: 'Stage 7: Synthesis',
        title: 'Intelligence Synthesis & Decision Readiness',
        description: 'Bring screening data, assessment evidence, interview signals, and recruiter context into one hiring-ready summary with clear recommendations.',
        signalLabel: 'Synthesis model active',
        processLabel: 'Decision narrative building...',
        icon: PieChart,
    },
];

export const FEATURES = [
    {
        title: 'AI-Powered ATS Workflows',
        description: 'Run screening, ranking, and shortlist movement inside a single AI-powered ATS experience instead of stitching together disconnected recruiting tools.',
        icon: FileSearch,
    },
    {
        title: 'Automated Hiring Across Channels',
        description: 'Coordinate voice, email, and messaging touchpoints from one automated hiring workflow built for modern recruiting teams.',
        icon: Share2,
    },
    {
        title: 'Smarter Candidate Ranking',
        description: 'Use AI job matching and structured evaluation signals to prioritize the right candidates faster without losing recruiter control.',
        icon: ShieldCheck,
    },
    {
        title: 'AI Recruitment Software That Fits Your Stack',
        description: 'Layer Hirex REC into your recruitment process as the AI hiring platform that supports sourcing, screening, and recruiter handoff.',
        icon: Layers,
    },
    {
        title: 'Funnel Velocity Analytics',
        description: 'Understand where automated hiring is reducing delays, improving throughput, and helping your team move candidates faster.',
        icon: BarChart4,
    },
    {
        title: 'AI Talent Acquisition Guardrails',
        description: 'Support structured hiring with consistent workflows, clearer candidate context, and better operational visibility across your funnel.',
        icon: Globe,
    },
];

export const SECTORS = [
    {
        name: 'Technology & SaaS',
        icon: Code,
        image: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=1000', // IT Cubicles Team
        desc: 'Assessing the architects of tomorrow. Deep-dive technical screening for software engineers, AI researchers, and product visionaries.',
        tags: ['Code Evaluation', 'Culture Fit', 'Architect Level'],
        alt: 'Technology recruitment team reviewing software engineering candidates in an AI recruitment platform',
    },
    {
        name: 'Healthcare & Life Sciences',
        icon: Stethoscope,
        image: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=1000', // Hospital interior/staff
        desc: 'Precision screening for frontline heroes. From ICU specialists to medical researchers, handle technical vetting and behavioral fit at 10x speed.',
        tags: ['Compliance-first', 'Skill-gap Analysis', '24/7 Screening'],
        alt: 'Healthcare hiring teams using an AI hiring platform to screen clinical and life sciences candidates',
    },
    {
        name: 'Banking & Financial Services',
        icon: LineChart,
        image: 'https://images.unsplash.com/photo-1501167786227-4cba60f6d58f?auto=format&fit=crop&q=80&w=1000', // Professional Banking Setting
        desc: 'Security-first hiring for the digital age. Screen analysts, relationship managers, and compliance officers with automated regulatory checks.',
        tags: ['Audit-ready', 'Psychometric Tests', 'Global Search'],
        alt: 'Financial services recruitment workflow supported by AI-driven candidate screening and ranking',
    },
    {
        name: 'Advanced Manufacturing',
        icon: Factory,
        image: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1000', // Industrial Plant Setting
        desc: 'Identify and match plant operators, engineers, and supply chain specialists to clearly defined technical and operational requirements.',
        tags: ['Skill-gap Analysis', 'Technical Vetting', 'Shift Optimization'],
        alt: 'Manufacturing recruitment workflow showing AI job matching for technical hiring',
    },
    {
        name: 'Retail & E-commerce',
        icon: UtensilsCrossed,
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&q=80&w=1000', // Retail Shop Interior
        desc: 'Scale your retail operations with high-volume, high-quality hiring. We focus on customer-centricity and operational excellence to find your next leaders.',
        tags: ['High-Volume Hiring', 'Behavioral Assessment'],
        alt: 'Retail hiring teams using automated recruitment workflows for high-volume candidate screening',
    },
    {
        name: 'Logistics & Supply Chain',
        icon: Truck,
        image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1000', // Logistics Distribution Center
        desc: 'Keep operations moving by hiring drivers, warehouse managers, and terminal operators through structured AI-led screening that cross-questions and verifies candidate capability.',
        tags: ['Rapid Onboarding', 'License Check', 'Fleet Management'],
        alt: 'Supply chain recruiting workflow using automated hiring tools for operations roles',
    },
];

export const TESTIMONIALS = [
    {
        quote: 'At Applycup Solutions, we use Hirex REC to make candidate screening faster and more efficient. The AI calls quickly filter relevant candidates, and the interview assessment gives us better clarity to move forward with the right profiles.',
        name: 'Bhushan Varma',
        role: 'Recruitment Delivery Manager',
        company: 'Applycup Hiring Solutions',
        initials: 'BV'
    },
    {
        quote: 'As a candidate, my experience with Hirex IT was smooth and impressive. The AI-driven process made screening quick and relevant to my profile. I felt the job matching was accurate and aligned well with my skills, making hiring faster and more efficient.',
        name: 'Yash Mahamuni',
        role: 'Candidate',
        company: '',
        initials: 'YM'
    },
    {
        quote: 'Hirex REC made our recruitment process more efficient and structured. The AI-driven screening streamlined candidate shortlisting, helped us connect with the most relevant profiles, and supported us in successfully closing roles. I would definitely recommend it to upgrade the recruitment process.',
        name: 'Siddhi Parit',
        role: 'HR Coordinator',
        company: 'Fortune Cloud Technologies',
        initials: 'SP'
    },
    {
        quote: 'As a fresher, this was my first real interview experience and it was smooth, fair, and skill-focused. Loved how the AI adapted to my answers and it felt like a real conversation.',
        name: 'Akshar Bhakare',
        role: 'Candidate',
        company: '',
        initials: 'AB'
    },

];

export const FAQ_ITEMS = [
    {
        question: 'Will AI replace recruiters?',
        answer: 'No. Hirex REC is designed to remove repetitive screening, scheduling, and follow-up work so recruiters can spend more time with qualified candidates, hiring managers, and final decision-making.'
    },
    {
        question: 'How does AI screen candidates?',
        answer: 'The platform combines structured voice or video interviews, role-fit questions, knockout checks, resume context, and workflow signals to generate consistent candidate summaries and recruiter-ready evaluation data.'
    },
    {
        question: 'Can candidates take AI interviews remotely?',
        answer: 'Yes. Candidates can complete AI-led interviews remotely from their own device, while your team receives transcripts, summaries, and interview evidence in a format that is easy to review.'
    },
    {
        question: 'Is my data secure and compliant?',
        answer: 'Yes. Hirex REC is built with secure access controls, interview data protection, and structured workflow handling so recruiting teams can operate with stronger privacy, consistency, and auditability.'
    }
];

export const PRICING_PAGE_CONTENT = {
    hero: {
        eyebrow: 'Pricing',
        title: 'Pay Only for What You Hire',
        description: 'One AI-powered ATS and recruitment automation platform. Every tool to screen, interview, and hire 10x faster, built for teams of every size.',
        primaryCta: { label: 'Book Demo', to: '/book-demo' },
        secondaryCta: { label: 'See Workflow', to: '/#workflow' },
    },
    intro: {
        eyebrow: 'AI Recruitment Software for Every Team Size',
        title: 'AI-Powered Recruitment Platform Built for Every Business',
        description: 'From growing startups to Fortune 500 enterprises, Hirex REC scales with your hiring needs, automating screening, relevancy, and scheduling without forcing you into rigid seat-based pricing.',
    },
    plans: [
        {
            title: 'Growth',
            audience: 'Small & Medium Business',
            description: 'AI hiring software built for growing teams.',
            features: [
                'AI resume screening from day one',
                'Smart hiring software',
                'Automated candidate shortlisting',
                'Cost-effective AI recruitment tools',
            ],
        },
        {
            title: 'Scale',
            audience: 'Mid-Size Business',
            description: 'AI-powered ATS with full automation for established recruiting teams.',
            recommended: true,
            features: [
                'AI applicant tracking system (ATS)',
                'Recruitment automation software',
                'AI job matching and talent ranking',
                'Advanced hiring analytics and reporting',
            ],
        },
        {
            title: 'Enterprise',
            audience: 'Enterprise',
            description: 'Enterprise recruitment software with custom AI model training.',
            features: [
                'Custom AI talent acquisition engine',
                'White-label AI recruiting platform',
                'Volume hiring automation at scale',
                'SSO, MFA and enterprise-grade security',
            ],
        },
    ],
    platform: {
        eyebrow: 'Complete AI Recruitment Platform',
        title: 'Everything Your Hiring Team Needs. No Add-ons.',
        description: 'Hirex REC combines AI screening, automated interview scheduling, an AI-powered ATS, and real-time analytics in one recruitment automation platform. No juggling tools. No extra cost.',
        capabilityGroups: [
            {
                title: 'AI Screening & Automated Interviews',
                items: [
                    'AI voice calling and 24/7 automated candidate screening',
                    'Advanced AI interview software engine',
                    'AI co-recruiter with chat-based hiring',
                    'Multi-voice detection and proctoring',
                ],
            },
            {
                title: 'AI-Powered ATS & Assessment Suite',
                items: [
                    'AI applicant tracking system with custom pipelines',
                    'AI resume screening with automatic shortlist suggestions',
                    'Coding tests and psychometric assessments',
                    'Automated interview scheduling and reminders',
                ],
            },
            {
                title: 'Recruitment Analytics & Security',
                items: [
                    'Real-time talent analytics and hiring intelligence',
                    'Recruiter performance and time-to-hire metrics',
                    'Data-driven recruitment scorecards',
                    'SSO, MFA and enterprise-grade security',
                ],
            },
        ],
    },
    faq: [
        {
            question: 'How long does implementation take?',
            answer: 'Standard setup takes 1-2 weeks, while Enterprise custom workflows typically take 4-6 weeks.',
        },
        {
            question: 'Can we upgrade our plan mid-year?',
            answer: 'Yes, you can upgrade your plan at any time. Pricing will be pro-rated for the remainder of your term.',
        },
        {
            question: 'What kind of training is included?',
            answer: 'All plans include video documentation. Scale and Enterprise plans include live team training sessions.',
        },
        {
            question: 'Do you offer discounts for non-profits?',
            answer: 'We offer specialized pricing for registered non-profit organizations. Contact sales for details.',
        },
    ],
    cta: {
        eyebrow: "Let's Talk",
        title: 'Need a pricing plan shaped around your hiring flow?',
        description: 'Tell us about your hiring volume, automation depth, and security expectations, and we will map the right Hirex REC plan for your team.',
        primaryCta: { label: 'Book Demo', to: '/book-demo' },
        secondaryCta: { label: "Let's Talk", to: '/book-demo' },
    },
};

export const PACKAGES = [
    {
        title: "Free Package",
        features: ["5 AI interviews", "50 AI calls", "1 week free trial"],
        ctaLabel: "Start",
        ctaTo: "/#live-demo-card",
        popular: true,
    }
];

export const TEAM_MEMBERS = [
    {
        name: 'Arjun Mehta',
        role: 'Founder & CEO',
        bio: 'Ex-Talent Lead with 15+ years in enterprise recruitment. Building HIREX to put humanity back into automated systems.',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400',
        linkedin: '#'
    },
    {
        name: 'Dr. Sarah Chen',
        role: 'Chief AI Architect',
        bio: 'PhD in Behavioral AI. Dedicated to building bias-neutral evaluation engines that recognize true potential.',
        image: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=400',
        linkedin: '#'
    },
    {
        name: 'Marcus Thorne',
        role: 'Head of Product',
        bio: 'UX veteran focused on seamless human-AI collaboration. Ensuring HIREX feels like an extension of your team.',
        image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=400',
        linkedin: '#'
    }
];

export const NAV_LINKS = [
    { label: 'Our Story', href: '/about' },
    { label: 'Why us', href: '/why-us' },
    { label: 'Industry', href: '/industries' },
    { label: 'Pricing', href: '/pricing' },
];
