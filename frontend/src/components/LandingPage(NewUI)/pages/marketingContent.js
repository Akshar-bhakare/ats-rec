export const marketingPageGroups = {
    commercial: [
        { title: 'Features', description: 'Explore Hirex REC platform capabilities.', to: '/features' },
        { title: 'Industries', description: 'See how Hirex REC adapts to different hiring environments and talent motions.', to: '/industries' },
        { title: 'Pricing', description: 'See how Hirex REC packages deployment and support.', to: '/pricing' },
        { title: 'About', description: 'Understand the Hirex REC mission and platform vision.', to: '/about' },
        { title: 'Why Us', description: 'Understand why teams choose Hirex REC over fragmented hiring tools.', to: '/why-us' },
        { title: 'How It Works', description: 'See the end-to-end AI hiring workflow.', to: '/how-it-works' },
        { title: 'Solutions', description: 'Find the right motion for your hiring environment.', to: '/solutions' },
    ],
    product: [
        { title: 'AI Applicant Tracking System', description: 'Automate screening, ranking, and shortlist decisions.', to: '/ai-applicant-tracking-system' },
        { title: 'Automated Recruitment Platform', description: 'Coordinate hiring automation from sourcing to scheduling.', to: '/automated-recruitment-platform' },
        { title: 'AI Talent Acquisition', description: 'Source, match, and prioritize candidates faster.', to: '/ai-talent-acquisition' },
        { title: 'Smart Hiring Software', description: 'Continuously improve quality-of-hire decisions.', to: '/smart-hiring-software' },
    ],
    blog: [
        { title: 'Future of Tech Hiring', description: 'Six major trends reshaping how IT hiring managers compete for technical talent.', to: '/blog/future-of-tech-hiring' },
        { title: 'The CFO\'s Case for AI Recruitment', description: 'What your hiring process is really costing you across direct spend, productivity loss, and bad-hire risk.', to: '/blog/cfo-case-for-ai-recruitment' },
    ],
};

export const marketingPages = {
    features: {
        pathname: '/features',
        seo: {
            title: 'Hirex REC Features - AI Hiring Platform Capabilities',
            description: 'See how Hirex REC combines AI-powered ATS workflows, job matching, candidate screening, and recruitment automation in one hiring platform.',
        },
        hero: {
            eyebrow: 'Platform overview',
            title: 'AI Recruitment Software Built to Run Your Hiring System End to End',
            description:
                'Hirex REC brings AI-powered ATS workflows, AI job matching, automated hiring orchestration, and recruiter-ready insights into one operating layer for modern talent teams.',
            primaryCta: { label: 'Explore pricing', to: '/pricing' },
            secondaryCta: { label: 'See how it works', to: '/how-it-works' },
            highlights: [
                'AI-powered ATS workflows',
                'Automated candidate screening',
                'AI job matching and ranking',
                'Recruiter-ready analytics and follow-up',
            ],
        },
        stats: [
            { value: '1 platform', label: 'for sourcing, screening, ranking, and follow-up' },
            { value: '24/7', label: 'AI screening coverage across channels and time zones' },
            { value: 'Flexible', label: 'deployment for lean teams and enterprise recruiting ops' },
        ],
        sections: [
            {
                title: 'AI Applicant Tracking System',
                description:
                    'Replace fragmented workflows with an AI-powered ATS that keeps hiring data, candidate progress, and recruiter actions in one place.',
                items: [
                    {
                        title: 'AI screening in the workflow',
                        description: 'Launch voice, chat, or form-based qualification from the same pipeline where recruiters review candidates.',
                    },
                    {
                        title: 'Hiring signals in context',
                        description: 'Surface fit, skill, and readiness signals next to role requirements so shortlisting is faster and more consistent.',
                    },
                    {
                        title: 'Actionable recruiter handoff',
                        description: 'Turn AI screening into structured notes, candidate summaries, and next-step recommendations your team can use immediately.',
                    },
                ],
            },
            {
                title: 'AI Job Matching That Prioritizes the Right Candidates',
                description:
                    'Hirex REC helps teams hire with AI by scoring alignment between job requirements, candidate evidence, and workflow signals.',
                items: [
                    {
                        title: 'Skills and requirement mapping',
                        description: 'Compare role expectations against resumes, screening responses, and assessment outputs in one view.',
                    },
                    {
                        title: 'Shortlist-ready ranking',
                        description: 'Rank candidates with explainable fit signals so recruiters can move quickly without losing control.',
                    },
                    {
                        title: 'Volume without chaos',
                        description: 'Keep high-application roles manageable with automated prioritization and stage progression logic.',
                    },
                ],
            },
            {
                title: 'Recruitment Automation That Removes Administrative Drag',
                description:
                    'Automated hiring only works when it reduces repetitive work without blocking recruiter judgment. Hirex REC focuses on that balance.',
                items: [
                    {
                        title: 'Interview and follow-up coordination',
                        description: 'Automate scheduling triggers, reminders, and status updates so recruiters spend more time closing candidates.',
                    },
                    {
                        title: 'Multi-channel engagement',
                        description: 'Reach candidates through the channels they already respond to while keeping communication tied to the pipeline.',
                    },
                    {
                        title: 'Reporting that closes the loop',
                        description: 'Track bottlenecks, throughput, and hiring speed improvements to understand where automation is creating leverage.',
                    },
                ],
            },
        ],
        faq: [
            {
                question: 'Is Hirex REC just another ATS?',
                answer: 'No. Hirex REC is designed as an AI hiring platform that layers recruitment automation, screening, ranking, and workflow intelligence onto the core tracking experience.',
            },
            {
                question: 'Can teams still control hiring decisions?',
                answer: 'Yes. The platform is built to accelerate decision-making, not hide it. Recruiters and hiring managers still control stage movement, feedback, and final selection.',
            },
            {
                question: 'Who uses the features page most?',
                answer: 'Recruiting leaders, talent operations teams, and founders evaluating how to consolidate sourcing, screening, and AI talent acquisition workflows.',
            },
        ],
        cta: {
            title: 'Need an AI hiring platform that fits your workflow?',
            description: 'See which Hirex REC motion fits your team, role volume, and evaluation model.',
            primary: { label: 'View solutions', to: '/solutions' },
            secondary: { label: 'Talk to sales', to: '/pricing' },
        },
        relatedLinks: [
            ...marketingPageGroups.product,
            ...marketingPageGroups.blog.slice(0, 1),
        ],
    },
    pricing: {
        pathname: '/pricing',
        seo: {
            title: 'Hirex REC Pricing - Enterprise AI Hiring Platform',
            description: 'Contact Hirex REC for pricing tailored to your hiring volume, workflow complexity, and deployment needs.',
        },
        hero: {
            eyebrow: 'Pricing',
            title: 'Pricing Built Around Hiring Complexity, Not Cookie-Cutter Seat Plans',
            description:
                'Hirex REC pricing is structured for B2B teams that need AI recruitment software aligned to hiring volume, automation depth, security expectations, and implementation support.',
            primaryCta: { label: 'Contact us for pricing', to: '/about' },
            secondaryCta: { label: 'Review features', to: '/features' },
            highlights: [
                'Enterprise onboarding support',
                'Flexible workflow configuration',
                'Security and compliance alignment',
                'Commercial terms based on usage and scope',
            ],
        },
        sections: [
            {
                title: 'How pricing is scoped',
                description: 'We typically scope pricing around platform scope, automation depth, and operational complexity.',
                items: [
                    {
                        title: 'Hiring volume',
                        description: 'Teams hiring across multiple roles or geographies typically need broader automation and reporting support.',
                    },
                    {
                        title: 'Workflow depth',
                        description: 'Voice screening, job matching, assessments, and scheduling layers change implementation shape and support needs.',
                    },
                    {
                        title: 'Deployment model',
                        description: 'Security reviews, integrations, and internal rollout requirements influence the final package structure.',
                    },
                ],
            },
            {
                title: 'Who this model works best for',
                description: 'Hirex REC is positioned for teams that want business impact, not a bare-bones self-serve widget.',
                items: [
                    {
                        title: 'Growing recruiting teams',
                        description: 'Move from manual coordination to a more scalable operating model without rebuilding your process from scratch.',
                    },
                    {
                        title: 'Multi-role hiring environments',
                        description: 'Standardize screening and prioritization across technical, operational, and customer-facing roles.',
                    },
                    {
                        title: 'Talent leaders under speed pressure',
                        description: 'Reduce time-to-hire with AI talent acquisition workflows while keeping quality bars high.',
                    },
                ],
            },
        ],
        faq: [
            {
                question: 'Do you publish fixed prices?',
                answer: 'Not at this stage. Hirex REC packages are tailored to deployment requirements, workflow scope, and support expectations.',
            },
            {
                question: 'Can small teams use Hirex REC?',
                answer: 'Yes, if the hiring process is complex enough to benefit from automation. The best fit is usually teams with recurring hiring, growing headcount, or meaningful recruiter workload.',
            },
            {
                question: 'What should buyers prepare before a pricing conversation?',
                answer: 'It helps to know hiring volume, typical open roles, current process bottlenecks, and whether you need ATS-style workflow support, AI screening, or both.',
            },
        ],
        cta: {
            title: 'Ready for a tailored pricing conversation?',
            description: 'We can help map the right deployment model based on role volume, workflow complexity, and recruiting goals.',
            primary: { label: 'See how it works', to: '/how-it-works' },
            secondary: { label: 'Explore AI ATS', to: '/ai-applicant-tracking-system' },
        },
        relatedLinks: [
            ...marketingPageGroups.commercial.filter((page) => page.to !== '/pricing'),
            marketingPageGroups.product[1],
        ],
    },
    industries: {
        pathname: '/industries',
        seo: {
            title: 'Hirex REC Industries - AI Hiring Workflows for Different Team Types',
            description: 'See how Hirex REC supports recruiting teams across high-volume operations, enterprise hiring, and specialized talent environments.',
        },
        hero: {
            eyebrow: 'Industries',
            title: 'Industries We Serve',
            description:
                'Tailored recruitment solutions for every sector. Scale your team with industry-specific AI intelligence.',
        },
        spotlightSection: {
            tabs: ['Technology', 'Advanced Manufacturing', 'Banking', 'Retail', 'Logistics', 'Healthcare', 'Real Estate'],
            items: [
                {
                    eyebrow: '-Technology',
                    title: 'Technology',
                    description: 'Assessing the architects of tomorrow. Deep-dive technical screening for software engineers, AI researchers, and product visionaries.',
                    tags: ['Core Evaluation', 'Cultural fit'],
                    image: 'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: true,
                },
                {
                    eyebrow: '-Advance Manufacturing',
                    title: 'Advanced Manufacturing',
                    description: 'Identify and match plant operators, engineers, and supply chain specialists to clearly defined technical and operational requirements.',
                    tags: ['Skill-gap Analysis', 'Technical Vetting', 'Shift Optimization'],
                    image: 'https://images.unsplash.com/photo-1565008447742-97f6f38c985c?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: false,
                },
                {
                    eyebrow: '-Banking & Finance',
                    title: 'Banking & Finance',
                    description: 'Security-first hiring for the digital age. Screen analysts, relationship managers, and compliance officers with automated regulatory checks.',
                    tags: ['Audit Ready', 'Psychometric Tests'],
                    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: true,
                },
                {
                    eyebrow: 'Retail & E-commerce',
                    title: 'Retail & E-commerce',
                    description: 'A structured hiring platform built to manage high-volume screening, seasonal surges, and store manager selection with automated evaluation workflows.',
                    tags: ['Volume Master', 'Brand Alignment', 'Instant Scheduling'],
                    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: false,
                },
                {
                    eyebrow: 'Logistics & Supply Chain',
                    title: 'Logistics & Supply Chain',
                    description: 'Keep operations moving by hiring drivers, warehouse managers, and terminal operators through structured AI-led screening that cross-questions and verifies candidate capability.',
                    tags: ['Rapid Onboarding', ' License Check'],
                    image: 'https://images.unsplash.com/photo-1494412651409-8963ce7935a7?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: true,
                },
                {
                    eyebrow: 'Healthcare & Life Science',
                    title: 'Healthcare & Life Science',
                    description: 'Precision screening for frontline heroes. From ICU specialists to medical researchers, handle technical vetting and behavioral fit at 10x speed.',
                    tags: ['Compliance-First', 'Skill-gap Analysis', '24/7 Screening'],
                    image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80',
                    imageLeft: false,
                },
                {
                    eyebrow: 'Real Estate',
                    title: 'Real Estate',
                    description: 'Optimize real estate hiring with AI recruitment tools designed for high-volume agent and sales hiring. Use intelligent matching, automated interviews, and data-driven insights to identify top-performing candidates.',
                    tags: ['Real Estate Hiring', 'Broker & Agent Screening'],
                    image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=80',
                    imageLeft: true,
                },
            ],
        },
        sections: [
            {
                title: 'Built for high-volume and frontline hiring teams',
                description: 'When recruiting speed matters, Hirex REC helps teams reduce repetitive screening work while keeping candidate movement organized and visible.',
                items: [
                    {
                        title: 'Fast first-touch screening',
                        description: 'Automate first-round qualification and candidate prioritization for roles with heavy inbound volume.',
                    },
                    {
                        title: 'Cleaner recruiter workload',
                        description: 'Reduce the time spent on repetitive coordination, updates, and manual filtering across large applicant pools.',
                    },
                    {
                        title: 'Funnel visibility at scale',
                        description: 'Spot bottlenecks, drop-off points, and throughput issues before they slow down hiring momentum.',
                    },
                ],
            },
            {
                title: 'Designed for technical and specialist recruiting',
                description: 'For roles where fit is harder to evaluate, Hirex REC creates more structured evidence and better recruiter handoff across the evaluation process.',
                items: [
                    {
                        title: 'Requirement-led candidate review',
                        description: 'Connect role expectations to candidate evidence so shortlisting is more consistent across recruiters and managers.',
                    },
                    {
                        title: 'Better interview preparation',
                        description: 'Turn screening outcomes into summaries and next-step context that interviewers can actually use.',
                    },
                    {
                        title: 'Stronger decision support',
                        description: 'Reduce over-reliance on gut feel by keeping scoring signals and recruiter insights in one place.',
                    },
                ],
            },
            {
                title: 'Ready for enterprise recruiting operations',
                description: 'Enterprise teams need standardization, collaboration, and visibility across multiple roles, geographies, and stakeholders. Hirex REC is designed for that reality.',
                items: [
                    {
                        title: 'Standardized hiring workflows',
                        description: 'Create a more repeatable hiring model across business units, recruiters, and hiring managers.',
                    },
                    {
                        title: 'Operational reporting',
                        description: 'Track hiring performance, process delays, and workflow quality with more consistent data inputs.',
                    },
                    {
                        title: 'Scalable process integrity',
                        description: 'Keep structure and compliance stronger as hiring demand grows across different teams and regions.',
                    },
                ],
            },
        ],
        faq: [
            {
                question: 'Is the industries page tied to only one sector?',
                answer: 'No. Hirex REC is designed to support multiple hiring environments, including high-volume, specialist, and enterprise recruiting motions.',
            },
            {
                question: 'Can the workflow vary by team or business unit?',
                answer: 'Yes. The platform is meant to support different hiring motions while keeping core process structure, visibility, and decision support consistent.',
            },
            {
                question: 'Which teams usually explore the industries page?',
                answer: 'Talent leaders, operations teams, and hiring stakeholders evaluating whether Hirex REC fits their specific recruiting environment and scale.',
            },
        ],
        cta: {
            title: 'Need a hiring workflow shaped to your industry motion?',
            description: 'See how Hirex REC can support your recruiting volume, evaluation model, and team structure.',
            primary: { label: 'View pricing', to: '/pricing' },
            secondary: { label: 'Explore features', to: '/features' },
        },
        relatedLinks: [
            marketingPageGroups.commercial.find((page) => page.to === '/features'),
            marketingPageGroups.commercial.find((page) => page.to === '/pricing'),
            marketingPageGroups.commercial.find((page) => page.to === '/solutions'),
            marketingPageGroups.product[2],
        ].filter(Boolean),
    },
    whyUs: {
        pathname: '/why-us',
        seo: {
            title: 'Why Hirex REC Ã¢â‚¬â€ Why Teams Choose Our AI Hiring Platform',
            description: 'See why growing companies and enterprise recruiting teams choose Hirex REC for structured, AI-powered hiring workflows.',
        },
        hero: {
            eyebrow: 'Why Hirex REC',
            title: 'Why Enterprise Teams Choose Hirex REC',
            description:
                'Because we turn hiring into a well-run system without losing the human connection behind every hire.',
            titleLines: [
                { text: 'Why Enterprise Teams' },
                { text: 'Choose ', highlight: 'HIREX REC' },
            ],
            cards: [
                {
                    title: 'AI Synthesis Reports',
                    description: 'A structured intelligence layer that maps candidate capability across soft skills, technical expertise, and culture contribution - statistically aligned with final interview decisions.',
                    icon: 'synthesis',
                },
                {
                    title: 'Multi-Modal Engagement',
                    description: 'Seamless outreach across Voice, WhatsApp, Email, and SMS, powered by state-of-the-art LLMs for human-like conversational persistence.',
                    icon: 'engagement',
                },
                {
                    title: 'Ethical Bias Neutralization',
                    description: 'Proprietary technology that removes identifiable information and evaluates candidates using merit-based data to reduce bias and support diverse hiring outcomes.',
                    icon: 'bias',
                },
                {
                    title: 'Neural ATS Integration',
                    description: 'Zero-config bi-directional sync with Workday, Greenhouse, Lever, and SAP SuccessFactors for a unified recruitment source of truth.',
                    icon: 'ats',
                },
                {
                    title: 'Funnel Velocity Analytics',
                    description: 'Predictive modeling to identify bottlenecks in your hiring lifecycle and forecast time-to-fill with machine-learning accuracy.',
                    icon: 'analytics',
                },
                {
                    title: 'Global Regulatory Guardrails',
                    description: 'Designed with PII safeguards and aligned to GDPR and DPDP frameworks, supported by strong encryption and access controls.',
                    icon: 'guardrails',
                },
            ],
            primaryCta: { label: 'Free demo', to: '/pricing' },
            secondaryCta: { label: 'See how it works', to: '/how-it-works' },
        },
        testimonialsSection: {
            title: 'Candidate testimonials',
            description: 'Discover how Hirex Rec is transforming the application experience for professionals worldwide.',
            items: [
                {
                    name: 'Yash Mahamuni',
                    role: 'Candidate',
                    quote:
                        'As a candidate, my experience with Hirex IT was smooth and impressive. The AI-driven process made screening quick and highly relevant to my profile. I felt the job matching was accurate and aligned well with my skills. It’s a great platform that makes the hiring process faster and more efficient for candidates.',
                    initials: 'YM',
                    align: 'left',
                },
                {
                    name: 'Akshar Bhakare',
                    role: 'Candidate',
                    quote:
                        'As a fresher, this was my first real interview experience and it was smooth, fair, and skill-focused. Loved how the AI adapted to my answers and it felt like a real conversation.',
                    initials: 'AB',
                    align: 'right',
                },
            ],
        },
        blogSection: {
            title: 'Latest from Our Blog',
            items: [
                {
                    category: 'Future Tech',
                    title: 'Future of Tech Hiring',
                    description: 'Six major shifts reshaping how IT hiring managers compete for technical talent in a faster AI-driven market.',
                    to: '/blog/future-of-tech-hiring',
                    theme: 'ai',
                },
                {
                    category: 'ROI & Business Impact',
                    title: 'The CFO\'s Case for AI Recruitment',
                    description: 'What your hiring process is really costing you across direct spend, productivity loss, and bad-hire risk.',
                    to: '/blog/cfo-case-for-ai-recruitment',
                    theme: 'team',
                },
                {
                    category: 'AI in Recruitment',
                    title: 'Why Traditional Recruitment Is Failing You',
                    description: 'How AI resolves the four most damaging pain points in modern hiring without changing the recruiter-first decision process.',
                    to: '/blog/why-traditional-recruitment-is-failing',
                    theme: 'analytics',
                },
            ],
        },
        sections: [
            {
                title: 'Built around how recruiting teams actually work',
                description: 'Hirex REC is not a generic automation layer. It is designed around recruiter workload, hiring-manager alignment, and the operational realities of modern hiring.',
                items: [
                    {
                        title: 'Recruiter-first workflow design',
                        description: 'Every workflow is built to reduce admin load while keeping recruiters in control of stage movement, evaluation, and decision quality.',
                    },
                    {
                        title: 'Structured process by default',
                        description: 'Consistent screening, clearer scorecards, and defined next steps help teams compare candidates fairly and move faster.',
                    },
                    {
                        title: 'One operating layer, not more tool sprawl',
                        description: 'Instead of stitching together point solutions, teams get one place to manage screening, prioritization, and recruiter handoff.',
                    },
                ],
            },
            {
                title: 'Why the platform performs better than manual hiring',
                description: 'The difference is not just automation. It is how automation is applied to create stronger throughput and better visibility.',
                items: [
                    {
                        title: 'AI screening that creates usable evidence',
                        description: 'Screening outputs turn into structured notes, summaries, and signals that recruiters can review quickly instead of starting from scratch.',
                    },
                    {
                        title: 'Shortlisting with more consistency',
                        description: 'Candidate ranking and prioritization are tied to role requirements so hiring decisions feel less subjective and more repeatable.',
                    },
                    {
                        title: 'Workflow momentum across the funnel',
                        description: 'Interview coordination, reminders, and follow-up steps move with less back-and-forth, which keeps the process moving for both teams and candidates.',
                    },
                ],
            },
            {
                title: 'Why enterprise and scaling teams trust Hirex REC',
                description: 'As hiring volume increases, the cost of inconsistency gets higher. Hirex REC is built to help teams scale without losing process integrity.',
                items: [
                    {
                        title: 'Operational clarity at scale',
                        description: 'Leaders get better visibility into funnel movement, delays, and workflow performance across multiple roles and hiring teams.',
                    },
                    {
                        title: 'Cleaner collaboration with hiring managers',
                        description: 'Structured outputs make it easier for recruiters and managers to review the same evidence and move candidates forward with confidence.',
                    },
                    {
                        title: 'A more defensible hiring system',
                        description: 'Teams rely on stronger process structure, clearer data, and more consistent evaluation instead of scattered notes and gut-feel decisions.',
                    },
                ],
            },
        ],
        faq: [
            {
                question: 'Who gets the most value from Hirex REC?',
                answer: 'Growing companies, lean recruiting teams, and enterprise talent functions that need faster hiring throughput without losing process consistency or recruiter control.',
            },
            {
                question: 'Why choose Hirex REC over disconnected recruiting tools?',
                answer: 'Hirex REC combines AI screening, workflow coordination, ranking support, and recruiter-ready summaries in one system so teams do not have to manage fragmented handoffs across multiple products.',
            },
            {
                question: 'Does Hirex REC replace recruiter judgment?',
                answer: 'No. The platform is designed to remove repetitive work and strengthen decision support while keeping recruiters and hiring managers responsible for final evaluation and selection.',
            },
        ],
        cta: {
            title: 'Need a hiring platform your team can actually rely on?',
            description: 'Explore the workflow, review the product capabilities, or talk through the right setup for your hiring motion.',
            primary: { label: 'View features', to: '/features' },
            secondary: { label: 'See pricing', to: '/pricing' },
        },
        relatedLinks: [
            marketingPageGroups.commercial[0],
            marketingPageGroups.commercial[1],
            marketingPageGroups.commercial[4],
            marketingPageGroups.product[2],
        ],
    },
    about: {
        pathname: '/about',
        seo: {
            title: 'About Hirex REC - AI Hiring Platform for Modern Recruiting Teams',
            description: 'Learn how Hirex REC helps teams automate recruiting, reduce coordination drag, and build a smarter hiring operating system.',
        },
        hero: {
            eyebrow: 'Our Story — Why Hirex REC Exists',
            title: 'We built this AI recruitment platform because great talent was getting lost in broken processes.',
            description:
                'After 18+ years of leading hiring across IT and non-IT industries, we had seen every failure mode in recruitment - manual exhaustion, inconsistent interviews, and decisions made on gut feel instead of data. Hirex REC is the platform that should have existed from day one.',
            primaryCta: { label: 'Explore the platform', to: '/features' },
            secondaryCta: { label: 'See solutions', to: '/solutions' },
            signatureName: 'Nikhil Batra',
            signatureRole: 'Founder & CEO, Hirex REC',
            highlights: [
                'Built for modern recruiting operations',
                'Focused on speed without sacrificing judgment',
                'Designed to support structured, scalable hiring',
            ],
        },
        originSection: {
            eyebrow: 'The Origin',
            title: 'The moment that made AI recruitment software inevitable',
            paragraphs: [
                'Picture a typical late evening in a recruitment office. A team is reviewing a pipeline of over 300 applicants for a single mid-level IT role - a task that would take three full days of manual screening.',
                'This scene plays out hundreds of times across the industry. The process itself is the problem. Not the people running it.',
            ],
            quote:
                '"Teams are forced to rely on keyword searches and gut feel because there is simply no time for anything else," reflects our founding team.',
            closing:
                'This is why we built Hirex REC - a complete recruitment automation platform that handles repetitive tasks while giving cleaner data for better decisions.',
        },
        problemSection: {
            title: 'The old recruitment model no longer works',
            description:
                'Four patterns repeated across every organization - and the reason we built Hirex REC.',
            items: [
                {
                    title: 'Manual Exhaustion',
                    description: 'Teams spend 60-70% of time on zero-insight tasks.',
                    number: '01',
                    icon: 'hourglass',
                },
                {
                    title: 'Inconsistent Interviews',
                    description: 'Lack of structure makes comparison impossible and bias inevitable.',
                    number: '02',
                    icon: 'compare',
                },
                {
                    title: 'Fragmented Decisions',
                    description: 'Decisions live in scattered threads; no unified analytics.',
                    number: '03',
                    icon: 'network',
                },
                {
                    title: 'Speed vs. Quality',
                    description: 'The paradox of moving fast and missing talent.',
                    number: '04',
                    icon: 'zap',
                },
            ],
        },
        quoteBannerSection: {
            lines: [
                [
                    { text: '"Recruitment didn\'t need more complexity. It needed ' },
                    { text: 'smarter hiring software', highlight: true },
                ],
                [
                    { text: ' - and the process integrity to back it up."' },
                ],
            ],
        },
        principlesSection: {
            title: 'What guides every feature we build',
            description: 'Our core principles ensure that Hirex REC remains a tool for people, powered by intelligence.',
            items: [
                {
                    title: 'AI should remove repetition, not replace judgment.',
                    description: 'Technology must automate mundane tasks - screening, scheduling, tracking - so recruiters can focus on human nuances.',
                    icon: 'refresh',
                },
                {
                    title: 'Structure creates hiring confidence.',
                    description: 'We leverage real-world expertise to build standardized frameworks that eliminate uncertainty and bias from the process.',
                    icon: 'compass',
                },
                {
                    title: 'Data-driven recruitment improves every outcome.',
                    description: 'When decisions are backed by clear, accessible data rather than intuition, teams build stronger, more resilient organizations.',
                    icon: 'chart',
                },
            ],
        },
        founderNoteSection: {
            eyebrow: 'A note from our founder',
            paragraphs: [
                'For nearly two decades, I\'ve navigated the complexities of recruitment across diverse industries. I\'ve seen first-hand how manual, repetitive tasks can drain the energy and creativity of even the most dedicated hiring teams. We realized that the standard recruitment model wasn\'t just slow it was fundamentally broken, leading to inconsistent outcomes and missed opportunities for both companies and candidates.',
                'Hirex REC wasn\'t born out of a desire to create just another software tool. It was born out of a necessity to fix the entire recruitment workflow. We wanted to build something that restored integrity to the process, ensuring that every candidate is evaluated fairly and every hiring decision is backed by solid, actionable data.',
                'Our work is built on three core convictions: that AI should serve the recruiter, not the other way around; that a structured process is the only way to eliminate bias; and that data is the ultimate truth in hiring. These aren\'t just features; they are the DNA of everything we build.',
                'We are here to empower recruiters to do what they do best: connect great people with great opportunities. By removing the administrative burden, we allow teams to focus on the human element that truly matters in building world-class organizations.',
            ],
        },
        trustSection: {
            title: 'Why teams trust Hirex REC\'s AI-powered recruiting',
            description: 'Modern enterprises require a platform that balances innovation with reliability and responsibility.',
            items: [
                {
                    title: 'Built around real recruitment workflows.',
                    description: 'Engineered by recruiters who understand the daily challenges of the industry.',
                    icon: 'brain',
                },
                {
                    title: 'Designed for clarity, not complexity.',
                    description: 'A clean interface that makes managing thousands of candidates effortless.',
                    icon: 'sparkles',
                },
                {
                    title: 'Responsible AI-powered recruitment.',
                    description: 'Ethical AI frameworks designed to reduce bias and ensure compliance.',
                    icon: 'shield',
                },
                {
                    title: 'Built to earn trust at enterprise scale.',
                    description: 'Secure, scalable, and robust architecture for the world\'s largest teams.',
                    icon: 'building',
                },
            ],
        },
        storyCtaSection: {
            title: 'If this story feels familiar, the platform will too.',
            description: 'Join hundreds of teams who replaced manual hiring complexity with Hirex REC\'s automated recruitment platform.',
            primary: { label: 'Free Demo', to: '/book-demo' },
            secondary: { label: 'Explore the Platform', to: '/?showcase=live-demo#product-walkthrough' },
        },
        sections: [
            {
                title: 'Our point of view',
                description:
                    'Hiring teams do not need more disconnected point solutions. They need one operating layer that helps them source, screen, and move candidates with clarity.',
                items: [
                    {
                        title: 'Automation should remove friction',
                        description: 'The right AI recruitment software takes repetitive work off your team so recruiters can focus on judgment, calibration, and candidate experience.',
                    },
                    {
                        title: 'Speed only matters if quality improves',
                        description: 'Hirex REC is designed to help teams move faster while preserving the signals required for high-quality hiring decisions.',
                    },
                    {
                        title: 'Structure beats ad hoc hiring',
                        description: 'Consistent workflows, stronger data, and clearer scorecards create better outcomes than scattered recruiting operations.',
                    },
                ],
            },
            {
                title: 'How teams typically use Hirex REC',
                description: 'Most customers come to Hirex REC when hiring demand outgrows the process they can run manually.',
                items: [
                    {
                        title: 'Lean teams doing more with fewer recruiters',
                        description: 'Automate first-touch screening, candidate prioritization, and repetitive coordination steps.',
                    },
                    {
                        title: 'Scaling companies standardizing hiring quality',
                        description: 'Create one consistent way to evaluate candidates across roles, managers, and locations.',
                    },
                    {
                        title: 'Talent leaders upgrading the stack',
                        description: 'Layer AI talent acquisition workflows into a more deliberate system for throughput and visibility.',
                    },
                ],
            },
        ],
        cta: {
            title: 'Want to see Hirex REC in action?',
            description: 'Start with the product overview or dive into the workflows that make automated hiring useful in practice.',
            primary: { label: 'View features', to: '/features' },
            secondary: { label: 'Read how it works', to: '/how-it-works' },
        },
        relatedLinks: [
            marketingPageGroups.commercial[0],
            marketingPageGroups.commercial[3],
            marketingPageGroups.product[2],
            marketingPageGroups.blog[1],
        ],
    },
    howItWorks: {
        pathname: '/how-it-works',
        seo: {
            title: 'How Hirex REC Works - AI Hiring Workflow Explained',
            description: 'See how Hirex REC helps teams source, screen, rank, and move candidates through the hiring process with AI-powered automation.',
        },
        hero: {
            eyebrow: 'How it works',
            title: 'From Intake to Shortlist: How Hirex REC Runs a Modern Hiring Workflow',
            description:
                'Hirex REC helps recruiting teams replace manual handoffs with a structured AI hiring workflow for intake, screening, ranking, and interview coordination.',
            primaryCta: { label: 'Explore features', to: '/features' },
            secondaryCta: { label: 'See AI ATS page', to: '/ai-applicant-tracking-system' },
            highlights: [
                'Source and capture role requirements',
                'Automate candidate screening and ranking',
                'Coordinate interviews and next steps',
                'Keep recruiters in control of decisions',
            ],
        },
        sections: [
            {
                title: '1. Define the hiring brief',
                description: 'Start with role context, must-have skills, and the signals that matter for the job.',
                items: [
                    {
                        title: 'Role requirements',
                        description: 'Capture the role, skills, experience, and hiring constraints that should shape evaluation.',
                    },
                    {
                        title: 'Evaluation criteria',
                        description: 'Translate recruiter and hiring-manager expectations into structured screening logic.',
                    },
                ],
            },
            {
                title: '2. Screen at scale with AI',
                description: 'Automated hiring only helps when it turns inbound volume into clear next steps.',
                items: [
                    {
                        title: 'Voice and chat screening',
                        description: 'Run first-round qualification asynchronously while collecting structured evidence.',
                    },
                    {
                        title: 'Ranking and shortlisting',
                        description: 'Use AI job matching and candidate scoring to help recruiters focus on the strongest fits first.',
                    },
                ],
            },
            {
                title: '3. Move candidates forward faster',
                description: 'Once candidates are qualified, Hirex REC keeps momentum high across interviews and follow-up.',
                items: [
                    {
                        title: 'Recruiter handoff',
                        description: 'Summaries and recommendation signals make it easier to decide who advances and why.',
                    },
                    {
                        title: 'Interview coordination',
                        description: 'Automate reminders, scheduling triggers, and workflow progress updates.',
                    },
                ],
            },
            {
                title: '4. Improve the system over time',
                description: 'Use reporting and hiring outcomes to refine how the platform supports your process.',
                items: [
                    {
                        title: 'Pipeline visibility',
                        description: 'See where roles slow down, where screening helps, and where manual work still consumes recruiter time.',
                    },
                    {
                        title: 'Operational consistency',
                        description: 'Build a more repeatable recruiting system as the team and role mix expand.',
                    },
                ],
            },
        ],
        cta: {
            title: 'Want the workflow mapped to your hiring process?',
            description: 'Explore the product-led pages that focus on ATS workflows, automation, and AI talent acquisition.',
            primary: { label: 'AI ATS', to: '/ai-applicant-tracking-system' },
            secondary: { label: 'Automated recruitment', to: '/automated-recruitment-platform' },
        },
        relatedLinks: [
            ...marketingPageGroups.product,
        ],
    },
    solutions: {
        pathname: '/solutions',
        seo: {
            title: 'Hirex REC Solutions - AI Hiring Platform for Growing Teams',
            description: 'Discover how Hirex REC supports high-volume hiring, lean recruiting teams, and structured hiring programs with AI-powered workflows.',
        },
        hero: {
            eyebrow: 'Solutions',
            title: 'Hirex REC Solutions for Teams That Need Better Hiring Throughput',
            description:
                'Whether you are scaling headcount, handling recurring role volume, or tightening hiring quality, Hirex REC helps teams hire with AI in a way that fits real recruiting operations.',
            primaryCta: { label: 'See product features', to: '/features' },
            secondaryCta: { label: 'View pricing', to: '/pricing' },
            highlights: [
                'Scaling teams with lean recruiting staff',
                'High-volume and always-on hiring motions',
                'Structured hiring programs across functions',
            ],
        },
        sections: [
            {
                title: 'For growing companies',
                description: 'When hiring demand increases faster than recruiting capacity, AI recruiting workflows help absorb the pressure.',
                items: [
                    {
                        title: 'Shorter recruiter queues',
                        description: 'Automate first-touch screening and prioritization so recruiters focus on high-potential candidates sooner.',
                    },
                    {
                        title: 'Cleaner process handoffs',
                        description: 'Bring recruiters, coordinators, and hiring managers into one workflow instead of relying on scattered updates.',
                    },
                ],
            },
            {
                title: 'For high-volume hiring',
                description: 'High-application environments need a platform that can distinguish signal from noise quickly.',
                items: [
                    {
                        title: 'AI-powered ATS triage',
                        description: 'Use structured screening and ranking to separate serious candidates from low-fit volume.',
                    },
                    {
                        title: 'Automated follow-up',
                        description: 'Reduce the operational lag between application, screening, and interview scheduling.',
                    },
                ],
            },
            {
                title: 'For quality-focused hiring programs',
                description: 'Smart hiring software should improve consistency, not just speed.',
                items: [
                    {
                        title: 'Standardized evaluation logic',
                        description: 'Create repeatable scoring criteria and candidate summaries that support stronger decision quality.',
                    },
                    {
                        title: 'Role-specific workflows',
                        description: 'Adapt the platform to technical, frontline, operational, or leadership hiring paths without losing structure.',
                    },
                ],
            },
        ],
        cta: {
            title: 'Looking for the right solution path?',
            description: 'Compare the product-led pages to understand where Hirex REC fits best in your stack.',
            primary: { label: 'Smart hiring software', to: '/smart-hiring-software' },
            secondary: { label: 'AI talent acquisition', to: '/ai-talent-acquisition' },
        },
        relatedLinks: [
            marketingPageGroups.product[0],
            marketingPageGroups.product[2],
            marketingPageGroups.product[3],
            marketingPageGroups.blog[0],
        ],
    },
    aiAts: {
        pathname: '/ai-applicant-tracking-system',
        seo: {
            title: 'AI Applicant Tracking System (ATS) - Automate Hiring | Hirex REC',
            description: 'Hirex REC is an AI applicant tracking system that screens, ranks, and shortlists candidates faster for modern recruiting teams.',
        },
        hero: {
            eyebrow: 'AI applicant tracking system',
            title: 'The AI-Powered Applicant Tracking System That Screens, Ranks & Shortlists for You',
            description:
                'Hirex REC is an AI-powered ATS built for teams that need better candidate quality and less manual triage. It combines workflow structure with automated evaluation and recruiter-ready recommendations.',
            primaryCta: { label: 'Explore platform features', to: '/features' },
            secondaryCta: { label: 'See pricing approach', to: '/pricing' },
            highlights: [
                'AI-powered ATS workflow',
                'Screening and ranking in one place',
                'Faster shortlist creation',
                'Designed for AI HR software use cases',
            ],
        },
        sections: [
            {
                title: 'Why legacy ATS platforms slow teams down',
                description: 'Traditional systems track candidates, but they usually leave screening, prioritization, and decision support outside the core workflow.',
                items: [
                    {
                        title: 'Too much manual review',
                        description: 'Recruiters still spend hours sorting applicants before meaningful evaluation begins.',
                    },
                    {
                        title: 'Weak decision support',
                        description: 'Pipelines show status, but not enough evidence about candidate quality or readiness.',
                    },
                    {
                        title: 'Disconnected automation',
                        description: 'Scheduling, assessments, and screening often sit in separate tools that create more admin work.',
                    },
                ],
            },
            {
                title: 'How Hirex REC’s AI ATS works',
                description: 'Hirex REC keeps the applicant tracking workflow intact while layering in AI screening and prioritization.',
                items: [
                    {
                        title: 'Capture candidates centrally',
                        description: 'Track candidate progression in one workflow instead of spreading context across spreadsheets and inboxes.',
                    },
                    {
                        title: 'Screen automatically',
                        description: 'Run AI screening to collect qualification signals before recruiters spend time on manual review.',
                    },
                    {
                        title: 'Rank and shortlist faster',
                        description: 'Use AI job matching and recruiter-ready summaries to move the best-fit candidates forward quickly.',
                    },
                ],
            },
        ],
        comparison: {
            title: 'Hirex REC vs. a traditional ATS',
            rows: [
                ['Candidate tracking', 'Built-in with AI workflow context', 'Usually tracking only'],
                ['Screening automation', 'Native AI screening and candidate summaries', 'Often manual or third-party'],
                ['Shortlist creation', 'AI-ranked shortlist recommendations', 'Recruiter-led manual sorting'],
                ['Hiring velocity', 'Optimized for faster triage and handoffs', 'Depends on extra tooling and manual work'],
            ],
        },
        faq: [
            {
                question: 'Is Hirex REC an ATS replacement or an AI layer?',
                answer: 'It is positioned as an AI-powered ATS experience for teams that want the workflow and the decision-support layer in one system.',
            },
            {
                question: 'What kinds of teams evaluate this page most often?',
                answer: 'Talent leaders and recruiting ops teams looking for AI HR software that moves beyond simple applicant tracking.',
            },
        ],
        cta: {
            title: 'Need an ATS that does more than track candidates?',
            description: 'See how Hirex REC combines applicant tracking, candidate screening, and recruiter decision support.',
            primary: { label: 'How it works', to: '/how-it-works' },
            secondary: { label: 'Automated recruitment platform', to: '/automated-recruitment-platform' },
        },
        relatedLinks: [
            marketingPageGroups.commercial[0],
            marketingPageGroups.product[1],
            marketingPageGroups.product[2],
        ],
    },
    automatedRecruitment: {
        pathname: '/automated-recruitment-platform',
        seo: {
            title: 'Automated Recruitment Platform - AI-Powered Hiring Automation | Hirex REC',
            description: 'Hirex REC is an automated recruitment platform that streamlines sourcing, screening, scheduling, and recruiter follow-up with AI-powered workflows.',
        },
        hero: {
            eyebrow: 'Automated recruitment platform',
            title: 'Automated Recruitment Platform: Hire 5x Faster with AI',
            description:
                'Hirex REC helps teams automate recruiting tasks across intake, screening, scheduling, and follow-up so recruiters can spend more time on decisions and candidate relationships.',
            primaryCta: { label: 'See workflow', to: '/how-it-works' },
            secondaryCta: { label: 'Review pricing', to: '/pricing' },
            highlights: [
                'Recruitment automation software',
                'Automated hiring coordination',
                'Faster scheduling and follow-up',
                'Built for recruiter control',
            ],
        },
        sections: [
            {
                title: 'End-to-end recruitment automation workflow',
                description: 'Hirex REC is designed to automate the repetitive work that sits between recruiter decisions.',
                items: [
                    {
                        title: 'Job intake and workflow setup',
                        description: 'Translate role requirements into structured screening and routing logic.',
                    },
                    {
                        title: 'Candidate screening',
                        description: 'Use AI-driven conversations and structured questions to qualify candidates before recruiter review.',
                    },
                    {
                        title: 'Scheduling and follow-up',
                        description: 'Reduce operational lag with triggered reminders, handoffs, and progression steps.',
                    },
                ],
            },
            {
                title: 'Where teams gain efficiency',
                description: 'The biggest ROI usually comes from reducing manual coordination across repeated hiring motions.',
                items: [
                    {
                        title: 'Less recruiter admin',
                        description: 'Recruiters reclaim time otherwise spent on repetitive outreach, status chasing, and low-value triage.',
                    },
                    {
                        title: 'Faster time to next step',
                        description: 'Candidates move through the process with fewer dead zones and fewer workflow bottlenecks.',
                    },
                    {
                        title: 'Cleaner hiring visibility',
                        description: 'Talent leaders can see whether automation is actually improving throughput and shortlist quality.',
                    },
                ],
            },
        ],
        faq: [
            {
                question: 'What does Hirex REC automate?',
                answer: 'It supports automation across candidate screening, ranking, scheduling triggers, and recruiter follow-up orchestration.',
            },
            {
                question: 'Does automation replace recruiter judgment?',
                answer: 'No. Hirex REC is built to reduce repetitive operational work while keeping recruiters and managers in control of final decisions.',
            },
        ],
        cta: {
            title: 'Want to automate more of the hiring journey?',
            description: 'Compare recruitment automation with Hirex REC’s AI ATS and smart hiring workflows.',
            primary: { label: 'AI applicant tracking system', to: '/ai-applicant-tracking-system' },
            secondary: { label: 'Smart hiring software', to: '/smart-hiring-software' },
        },
        relatedLinks: [
            marketingPageGroups.product[0],
            marketingPageGroups.product[2],
            marketingPageGroups.blog[1],
        ],
    },
    aiTalentAcquisition: {
        pathname: '/ai-talent-acquisition',
        seo: {
            title: 'AI Talent Acquisition Software - Find Top Talent Faster | Hirex REC',
            description: 'Hirex REC helps teams improve AI talent acquisition with sourcing intelligence, job matching, candidate evaluation, and structured hiring workflows.',
        },
        hero: {
            eyebrow: 'AI talent acquisition',
            title: 'AI Talent Acquisition: Source, Evaluate & Hire the Best Candidates Automatically',
            description:
                'Hirex REC helps recruiting teams hire with AI by combining sourcing signals, AI job matching, candidate ranking, and recruiter workflow support in one platform.',
            primaryCta: { label: 'Explore solutions', to: '/solutions' },
            secondaryCta: { label: 'See smart hiring software', to: '/smart-hiring-software' },
            highlights: [
                'AI talent acquisition workflows',
                'AI job matching',
                'Skills-first candidate prioritization',
                'Recruiter and hiring-manager visibility',
            ],
        },
        sections: [
            {
                title: 'Sourcing intelligence',
                description: 'AI talent acquisition starts by making it easier to understand where strong candidates are likely to come from.',
                items: [
                    {
                        title: 'Role-aligned search inputs',
                        description: 'Translate the hiring brief into better sourcing criteria and candidate signals.',
                    },
                    {
                        title: 'Higher-signal candidate review',
                        description: 'Use structured matching and screening data to focus recruiter attention on likely fits sooner.',
                    },
                ],
            },
            {
                title: 'Matching and ranking',
                description: 'Strong matching is not just keyword overlap. It is about evidence, readiness, and job relevance.',
                items: [
                    {
                        title: 'Skills-based alignment',
                        description: 'Prioritize candidates based on job-relevant experience, capabilities, and evaluation outputs.',
                    },
                    {
                        title: 'Recruiter-readable reasoning',
                        description: 'Present rankings in a way that supports decision-making instead of black-box scoring.',
                    },
                ],
            },
            {
                title: 'Bias-aware, structured evaluation',
                description: 'Structured AI hiring workflows can support more consistent candidate review when the process is designed carefully.',
                items: [
                    {
                        title: 'Consistent qualification criteria',
                        description: 'Apply the same logic across candidates to reduce ad hoc decision-making.',
                    },
                    {
                        title: 'Role-relevant scoring context',
                        description: 'Help teams evaluate candidates against role needs rather than relying on impressions alone.',
                    },
                ],
            },
        ],
        cta: {
            title: 'Building a better talent acquisition engine?',
            description: 'Explore the supporting pages for AI ATS, recruitment automation, and solution-specific workflows.',
            primary: { label: 'View features', to: '/features' },
            secondary: { label: 'Automated recruitment platform', to: '/automated-recruitment-platform' },
        },
        relatedLinks: [
            marketingPageGroups.product[0],
            marketingPageGroups.product[1],
            marketingPageGroups.blog[0],
        ],
    },
    smartHiringSoftware: {
        pathname: '/smart-hiring-software',
        seo: {
            title: 'Smart Hiring Software - AI-Driven Recruitment for Modern Teams | Hirex REC',
            description: 'Hirex REC is smart hiring software that helps teams learn from hiring patterns, improve candidate ranking, and make faster recruiting decisions.',
        },
        hero: {
            eyebrow: 'Smart hiring software',
            title: 'Smart Hiring Software That Learns What â€œGreatâ€ Looks Like for Your Team',
            description:
                'Hirex REC helps teams move from reactive recruiting to a smarter system for evaluating, ranking, and progressing candidates with AI-supported hiring workflows.',
            primaryCta: { label: 'See solutions', to: '/solutions' },
            secondaryCta: { label: 'Read AI talent acquisition page', to: '/ai-talent-acquisition' },
            highlights: [
                'Smart hiring software for recruiters',
                'AI hiring platform for better prioritization',
                'Pattern-driven candidate review',
                'Designed to help teams hire with AI',
            ],
        },
        sections: [
            {
                title: 'Why smart hiring beats manual recruiting',
                description: 'Manual recruiting is often slow because teams revisit the same decisions with incomplete context.',
                items: [
                    {
                        title: 'More consistent screening',
                        description: 'Structured evaluation reduces the random variation that appears across recruiters or hiring managers.',
                    },
                    {
                        title: 'Better candidate prioritization',
                        description: 'Smart ranking helps recruiters focus on people who are more likely to deserve human time.',
                    },
                ],
            },
            {
                title: 'How the platform learns from hiring patterns',
                description: 'Hirex REC is designed to help teams tighten workflows and learn which signals matter most to their process.',
                items: [
                    {
                        title: 'Workflow signal capture',
                        description: 'Track candidate progression, evaluation responses, and process outcomes to improve visibility.',
                    },
                    {
                        title: 'Refined recruiter judgment',
                        description: 'Use the platform to support stronger decisions, not to remove recruiters from the loop.',
                    },
                ],
            },
            {
                title: 'Use-case examples',
                description: 'Smart hiring software becomes most useful when role volume or evaluation complexity starts stretching the team.',
                items: [
                    {
                        title: 'Technical hiring',
                        description: 'Support more structured evaluation of role fit and readiness without slowing down the pipeline.',
                    },
                    {
                        title: 'Frontline and operational hiring',
                        description: 'Handle large candidate pools with more consistent screening and faster movement to interviews.',
                    },
                    {
                        title: 'Multi-role scaling',
                        description: 'Create a common hiring operating model even when the team is hiring across different functions.',
                    },
                ],
            },
        ],
        cta: {
            title: 'Want smarter hiring without adding more recruiter overhead?',
            description: 'Explore the product pages that connect smart hiring to automation, ATS workflows, and AI talent acquisition.',
            primary: { label: 'AI ATS', to: '/ai-applicant-tracking-system' },
            secondary: { label: 'AI talent acquisition', to: '/ai-talent-acquisition' },
        },
        relatedLinks: [
            marketingPageGroups.product[0],
            marketingPageGroups.product[1],
            marketingPageGroups.commercial[4],
        ],
    },
};

export const blogPosts = {
    futureOfTechHiring: {
        pathname: '/blog/future-of-tech-hiring',
        seo: {
            title: 'The Tech Talent Revolution: 6 Trends Every IT Hiring Manager Must Prepare For Now',
            description: 'Audience: IT & Tech Hiring Managers | Read time: ~8 minutes | Category: Future of Hiring',
        },
        hero: {
            eyebrow: 'Hirex REC blog',
            title: 'The Tech Talent Revolution: 6 Trends Every IT Hiring Manager Must Prepare For Now',
            description:
                'Audience: IT & Tech Hiring Managers | Read time: ~8 minutes | Category: Future of Hiring',
        },
        intro:
            'Picture this: it is 2026. Your company needs to hire an AI/ML engineer to lead a critical automation initiative. You post the role. Within 48 hours, 163 organisations are competing for the same professional. That engineer - if they are any good - will receive multiple offers within ten days, command a salary north of $170,000, and will choose their next employer based on the quality of your hiring experience as much as anything else. (Source: Robert Half 2026 Technology Salary Guide)',
        keyTakeaways: [],
        sections: [
            {
                title: 'The Battlefield Has Changed',
                paragraphs: [
                    'This is not hypothetical. This is the reality that IT hiring managers are navigating right now. The tech talent market has undergone a fundamental transformation - one that the old playbook of job boards, manual screening, and weeks-long interview loops simply cannot keep up with.',
                    'The organisations that will build the engineering teams of tomorrow are not the ones with the biggest recruitment budgets. They are the ones with the sharpest insight into where the market is heading, the most intelligent infrastructure to move fast, and the vision to see hiring not as a process - but as a strategic competitive weapon.',
                    '"The companies that win in 2026 will be those that recognise recruitment is not a transaction, but a strategic function of business growth. It requires deep industry knowledge, a vast network, and an ability to see where the technological puck is going -- not just where it is." Source: Technology.org, How Tech & AI Recruitment Will Evolve by 2026',
                    'This article maps the six seismic shifts reshaping tech hiring right now - and shows how forward-thinking IT hiring managers are already positioning themselves ahead of each one, powered by AI recruitment technology like HIREXREC.',
                ],
            },
            {
                title: 'The Scale of the Challenge: By the Numbers',
                paragraphs: [
                    'Before we look forward, we need to look clearly at where we stand. The tech talent landscape in 2026 is defined by one overriding reality: demand is vastly outpacing supply - and the gap is widening.',
                    'The macro picture is stark. By 2026, the global IT skills shortage is projected to cost organisations $5.5 trillion in losses - driven by unfilled roles, delayed projects, and missed innovation windows. 59% of enterprises already report that skills shortages are slowing down innovation, and 65% of tech hiring managers say it is harder to find skilled professionals than it was just one year ago. (Source: IDC Survey via TechTarget, 2026 | Scalo, Software Skill Shortage Report 2026)',
                    'And yet, in the same market, 87% of technology leaders feel confident about their business outlook for 2026, and 61% plan to increase permanent headcount in the first half of the year. The ambition is there. The question is whether the hiring infrastructure can match it. (Source: Robert Half, 2026 Technology Hiring Trends)',
                ],
                table: {
                    columns: ['IT Role', '2025 Job Postings Growth', 'Avg. Salary Range (2026)', 'Difficulty to Fill'],
                    rows: [
                        ['AI / ML Engineer', '+163% YoY', '$134K - $193K', 'Very High'],
                        ['Cybersecurity Engineer', '+124% YoY', '$118K - $191K', 'Critical'],
                        ['Data Scientist', '+414% (2025-2035)', '$122K - $183K', 'Very High'],
                        ['DevOps Engineer', 'Market: $10B to $25.5B', '$118K - $174K', 'High'],
                        ['Cloud / Network Engineer', '98% enterprises use cloud', '$110K - $156K', 'High'],
                        ['Software Engineer', '+297% (2025-2035)', '$109K - $176K', 'High'],
                    ],
                },
                bullets: [
                    'Sources: Robert Half 2026 Salary Guide | CompTIA State of the Tech Workforce 2025 | BLS Computer & IT Occupations | Robert Half Demand for Skilled Talent 2026.',
                ],
            },
            {
                title: 'TREND 01 Skills-First Hiring Is Replacing the Degree Filter',
                paragraphs: [
                    'The degree as a hiring filter is dissolving - and for IT roles, it is dissolving fastest of all. The speed of technological change has simply outpaced what formal education can certify. A computer science degree from 2020 says nothing about a candidate\'s fluency in generative AI, Kubernetes orchestration, or LLM fine-tuning.',
                    'The market has already shifted. The number of HR leaders likely to use skills-first hiring has tripled in just two years. In tech specifically, 78% of information and communications technology roles now include AI technical skills as a requirement - a competency that no traditional degree programme systematically produces. (Source: General Assembly, State of Tech Talent 2025 | Cisco AI Workforce Consortium, 2025)',
                    'What this means for IT hiring managers: Your shortlisting criteria needs to evolve from credential-checking to capability-verification. AI recruitment platforms like HIREXREC evaluate candidates on demonstrated skills, portfolio outputs, and verified technical competencies - not just the name of a university on their CV. The result is a deeper, more accurate talent pool that traditional screening would never surface.',
                ],
            },
            {
                title: 'TREND 02 The AI/ML & Cybersecurity War for Talent Is Escalating',
                paragraphs: [
                    'Two hiring battlegrounds are emerging above all others - and both demand a fundamentally different sourcing strategy.',
                    'AI/ML roles saw 163% growth in job postings in 2025 alone, while AI skills requirements in job postings nearly doubled, rising from 5% of all listings in 2024 to over 9% in 2025. For IT hiring managers building or scaling AI teams, this is a structural scarcity problem that speed alone cannot solve. (Source: CIO, The 10 Hottest IT Skills for 2026 | Robert Half, 2026 Technology Job Market)',
                    'Cybersecurity is equally acute. The global cybersecurity workforce gap currently stands at 4.8 million unfilled roles. Cybersecurity job postings doubled - from 2% of all listings in 2024 to over 4% in 2025 - and 90% of cybersecurity teams report skills gaps beyond just raw headcount. (Source: ISC2 Cybersecurity Workforce Study 2025 | Viva USA, The Cybersecurity Talent Cliff 2026)',
                    'What this means for IT hiring managers: In a war for talent this intense, the organisations that win are those who move faster and identify the right candidates before competitors do. AI-powered matching and predictive analytics give you the ability to reach and rank niche talent pools at a speed that manual sourcing simply cannot replicate.',
                ],
            },
            {
                title: 'TREND 03 Agentic AI Is Turning Recruiters Into Strategic Talent Architects',
                paragraphs: [
                    'The AI that recruited for you in 2023 screened resumes. The AI that will recruit for you in 2026 sources candidates autonomously, schedules interviews, pre-qualifies talent, flags retention risks, and forecasts your hiring needs 12-18 months in advance.',
                    'This is the era of agentic AI - systems that do not just assist, but act. AI is projected to handle up to 75% of all hiring tasks by 2030, while agentic systems can already launch job postings, build talent pipelines, and trigger outreach campaigns automatically when signals suggest upcoming skill shortages. (Source: Homans.ai, How AI Is Changing Recruitment in 2026)',
                    'The recruiter\'s role is not disappearing - it is being elevated. As AI absorbs the transactional, IT hiring managers and their talent teams are freed to focus on what artificial intelligence genuinely cannot replicate: reading the room in a leadership interview, sensing cultural misalignment, building trusted relationships with passive candidates, and making nuanced judgement calls about long-term potential.',
                    '"AI doesn\'t replace recruiters; it elevates their role, giving them more influence over talent strategy and making them essential partners in aligning people with business goals." Source: HireBee, AI Recruitment Trends 2025',
                    'What this means for IT hiring managers: The hiring managers who will define the next decade are those who embrace AI as an amplifier of their strategic judgment - not a replacement for it. Platforms like HIREXREC are built on this philosophy: AI handles the volume, velocity, and data; you handle the vision, relationships, and decisions.',
                ],
            },
            {
                title: 'TREND 04 Predictive Workforce Intelligence Is Replacing Reactive Hiring',
                paragraphs: [
                    'The most expensive hiring mistake an IT leader can make is not a bad hire - it is a late hire. Discovering a critical skills gap after it has already stalled a product launch, delayed a cloud migration, or left a security vulnerability unaddressed is a failure of foresight, not execution.',
                    'Next-generation AI recruitment is solving this with predictive workforce intelligence - the ability to forecast talent needs before they become urgent. AI tools can now predict job performance with 78% accuracy and retention likelihood with 83% accuracy, while proactively identifying internal mobility candidates and flagging professionals who are likely to leave before they hand in their notice. (Source: Second Talent, AI in Recruitment Statistics 2025)',
                    'CompTIA\'s 2025 State of the Tech Workforce projects 317,700 annual IT job openings through 2034 - a decade of sustained demand. The organisations that build predictive hiring pipelines today will not be scrambling to fill those roles. They will already have the talent - or know exactly where to find it. (Source: CompTIA, State of the Tech Workforce 2025)',
                    'What this means for IT hiring managers: Shift your mindset from reactive hiring to proactive talent strategy. AI recruitment platforms give you the data to anticipate skills gaps, build pipelines for roles you will need in 6-12 months, and make workforce planning decisions rooted in evidence rather than instinct.',
                ],
            },
            {
                title: 'TREND 05 The Candidate Experience Is Now a Technology Differentiator',
                paragraphs: [
                    'Here is a truth that many IT hiring managers underestimate: the best tech candidates are evaluating your company\'s technology stack before they accept an offer - starting with your hiring process.',
                    'An AI/ML engineer who experiences a slow, opaque, unresponsive recruitment process draws a direct inference about the organisation\'s broader tech culture. In a market where only 26% of applicants trust AI to evaluate them fairly, the way you deploy AI in your hiring process sends a powerful signal about your values and your sophistication. (Source: Gartner, 2026 Hiring Trust Survey via MSH)',
                    'Conversely, a fast, transparent, well-communicated hiring process - with personalised updates, clear timelines, and respectful engagement at every stage - is increasingly a talent acquisition advantage in its own right. 70% of tech leaders now say the AI factor has made them more likely to seek specialist recruitment support that can navigate candidate expectations intelligently. (Source: Robert Half, 2026 Tech Hiring Trends)',
                    'What this means for IT hiring managers: Your candidate experience is not separate from your employer brand - it is your employer brand for every technical professional who applies. AI-powered communication, instant status updates, and structured feedback loops are no longer nice-to-haves. They are the minimum expectation of the talent you most want to hire.',
                ],
            },
            {
                title: 'TREND 06 AI Adoption in Hiring Is No Longer Optional -- It Is Existential',
                paragraphs: [
                    'Let us be direct: the window to gain competitive advantage from AI recruitment is closing. What was a differentiator in 2024 is becoming the baseline in 2026.',
                    '43% of organisations worldwide used AI for HR and recruiting tasks in 2025 - up from just 26% in 2024. Among enterprise companies, 99% of Fortune 500 businesses now use AI-powered recruitment methods. By the end of 2026, forecasts indicate 80% or more of enterprises will be using AI for significant parts of their hiring process. (Source: HeroHunt.ai, AI Adoption in Recruiting 2025 Year in Review | Homans.ai, AI Recruitment Trends 2026)',
                    'For IT hiring managers specifically, this convergence is acute. You are hiring for the people who will build your AI systems - while simultaneously needing AI to find those people. The irony is sharp, but the logic is unavoidable: you cannot credibly recruit world-class AI talent with a manual hiring process.',
                    'Korn Ferry\'s 2026 TA Trends Report captures the stakes with precision: as organisations deploy fewer people augmented by technology, every hire will carry outsized weight. A wrong decision will hit harder than ever. The pressure on talent acquisition to get it right - consistently, at speed, at scale - has never been greater. (Source: Korn Ferry, TA Trends 2026: Human-AI Power Couple)',
                    'What this means for IT hiring managers: This is the moment to build the hiring infrastructure that will define your talent trajectory for the next five years. Not next quarter. Now.',
                ],
            },
            {
                title: 'The Recruiter of 2030: What Are You Building Towards?',
                paragraphs: [
                    'Futurist and Fortune 500 forecaster Tom Cheesewright paints a striking picture of where talent acquisition is heading: by 2036, talent acquisition will not just fill jobs - it will orchestrate ecosystems where employees, contractors, gig workers, and AI agents work side by side. TA will be measured not by headcount, but by how effectively it connects talent and technology into a system that drives growth. (Source: Korn Ferry, TA Trends 2026)',
                    'That future is not distant. Its foundations are being laid right now, in the hiring decisions and infrastructure investments that IT hiring managers are making today. The question is not whether your organisation will get there - it is whether you will arrive as a leader or a latecomer.',
                    'The organisations building the engineering teams of 2030 are not waiting for the market to stabilise. They are deploying AI to source smarter, predict faster, evaluate fairer, and communicate better - right now. HIREXREC exists to give IT hiring managers that infrastructure today.',
                ],
            },
            {
                title: 'Your Next Move',
                paragraphs: [
                    'The six trends outlined in this article are not emerging possibilities. They are present realities, already separating the organisations that will define the tech workforce of tomorrow from those that will spend the next decade playing catch-up.',
                    'The IT talent market in 2026 rewards speed, precision, and vision. It punishes delay, inefficiency, and status quo thinking. The hiring managers who understand this - and act on it - will build the engineering cultures that attract the talent others cannot reach.',
                    'See how HIREXREC AI is already helping IT hiring managers navigate every one of these trends - from skills-first matching and predictive talent pipelines to AI/ML specialist sourcing and real-time candidate communication. Book a tailored demo built around your tech stack, your open roles, and your hiring goals.',
                    'The future of tech hiring is being written right now. The only question is: are you writing it - or reading about it after the fact? Let HIREXREC put you on the right side of that story.',
                ],
            },
        ],
        cta: {
            title: 'See how Hirex REC supports the future of tech hiring',
            description: 'Explore the workflows that help IT hiring teams move faster with better talent matching, clearer signals, and stronger hiring infrastructure.',
            primary: { label: 'Free demo', to: '/book-demo' },
            secondary: { label: 'See how it works', to: '/?showcase=live-demo#product-walkthrough' },
        },
        sources: [
            { label: 'Robert Half -- 2026 Technology Job Market: In-Demand Roles and Hiring Trends', href: 'https://www.roberthalf.com/us/en/insights/research/data-reveals-which-technology-roles-are-in-highest-demand' },
            { label: 'CompTIA -- State of the Tech Workforce 2025', href: 'https://www.google.com/search?q=CompTIA+State+of+the+Tech+Workforce+2025' },
            { label: 'TechTarget -- 2026 Tech Job Market Statistics and Outlook', href: 'https://www.techtarget.com/whatis/feature/Tech-job-market-statistics-and-outlook' },
            { label: 'Scalo -- AI and Cybersecurity Will Be the Most In-Demand IT Skills for 2026', href: 'https://www.scalosoft.com/blog/ai-and-cybersecurity-will-be-the-most-in-demand-it-skills-for-2026-how-can-companies-bridge-the-gap/' },
            { label: 'ISC2 -- 2025 Cybersecurity Workforce Study', href: 'https://www.isc2.org/Insights/2025/12/2025-ISC2-Cybersecurity-Workforce-Study' },
            { label: 'Viva USA -- The Cybersecurity Talent Cliff: Navigating the 4.8 Million Professional Gap in 2026', href: 'https://viva-it.com/insights/the-cybersecurity-talent-cliff-navigating-the-4-8-million-professional-gap-in-2026/' },
            { label: 'CIO -- The 10 Hottest IT Skills for 2026', href: 'https://www.cio.com/article/4096592/the-10-hottest-it-skills-for-2026.html' },
            { label: 'iMocha -- Tech Hiring Trends 2026: Top Skills, AI Roles & Market Shifts', href: 'https://www.imocha.io/blog/tech-hiring-trends' },
            { label: 'Ravio -- Tech Hiring Trends 2026: The 4 Big Shifts Shaping the Market', href: 'https://ravio.com/blog/tech-hiring-trends' },
            { label: 'Korn Ferry -- TA Trends 2026: Human-AI Power Couple (Full Report)', href: 'https://www.kornferry.com/insights/featured-topics/talent-recruitment/ai-in-recruitment-trends' },
            { label: 'HeroHunt.ai -- AI Adoption in Recruiting: 2025 Year in Review', href: 'https://www.herohunt.ai/blog/ai-adoption-in-recruiting-2025-year-in-review' },
            { label: 'HireBee -- AI Recruitment Trends 2025: How AI Is Transforming Hiring', href: 'https://hirebee.ai/blog/ai-recruitment-trends-2025-how-artificial-intelligence-is-transforming-hiring/' },
            { label: 'MSH -- AI Recruitment Trends & Statistics in 2026', href: 'https://www.talentmsh.com/insights/ai-in-recruitment' },
            { label: 'Homans.ai -- How AI Is Changing Recruitment in 2026', href: 'https://homans.ai/blog/how-ai-is-revolutionizing-recruitment-in-2025/' },
            { label: 'Metaview -- Future of Recruiting: 10 Predictions to Redefine AI and Hiring in 2026', href: 'https://www.metaview.ai/resources/blog/future-of-recruiting-predictions' },
            { label: 'Technology.org -- How Tech and AI Recruitment Will Evolve by 2026', href: 'https://www.technology.org/2025/12/15/how-tech-and-ai-recruitment-will-evolve-by-2026/' },
            { label: 'Second Talent -- Top 100+ AI in Recruitment Statistics for 2026', href: 'https://www.secondtalent.com/resources/ai-in-recruitment-statistics/' },
            { label: 'Tecla -- Tech Talent Shortage in 2025: Causes, Impact & Solutions', href: 'https://www.tecla.io/blog/tech-talent-shortage' },
            { label: 'EIN Presswire / Scalo -- AI and Cybersecurity Lead 2026 IT Talent Demands', href: 'https://www.einpresswire.com/article/876171546/ai-and-cybersecurity-lead-2026-it-talent-demands-as-59-of-enterprises-report-innovation-slowdown-due-to-skills-shortage' },
        ],
    },
    remoteTalentAcquisitionJobs: {
        pathname: '/blog/remote-talent-acquisition-jobs',
        seo: {
            title: 'Remote Talent Acquisition Jobs in 2025: Complete Guide',
            description: 'Learn where remote talent acquisition jobs are growing, which skills matter most, and how AI is changing TA careers in 2025.',
        },
        hero: {
            eyebrow: 'Hirex REC blog',
            title: 'Remote Talent Acquisition Jobs: Where to Find Them, What They Pay & How to Stand Out',
            description:
                'A practical guide for recruiters and talent acquisition professionals who want to understand remote TA opportunities, salary drivers, and the skills that matter most in 2025.',
        },
        intro:
            'Remote talent acquisition roles continue to attract recruiters who want location flexibility, broader access to employers, and a more digital-first operating model. But the strongest candidates are not just general recruiters. They are professionals who understand sourcing systems, hiring data, and how AI is reshaping the talent function.',
        keyTakeaways: [
            'Remote TA roles increasingly favor recruiters who can work inside structured hiring systems and modern recruiting software.',
            'Compensation varies widely by geography, role scope, and whether the job focuses on sourcing, full-cycle recruiting, or talent operations.',
            'AI is changing how recruiters source, screen, and prioritize candidates, making workflow fluency more valuable than ever.',
        ],
        sections: [
            {
                title: 'What are remote talent acquisition jobs?',
                paragraphs: [
                    'Remote talent acquisition jobs are recruiting roles performed from anywhere, usually with digital tools for sourcing, outreach, screening, scheduling, and hiring coordination.',
                    'These jobs can span sourcing specialists, full-cycle recruiters, talent partners, recruiting coordinators, and talent operations roles. The more strategic the role, the more it tends to require strong stakeholder management and workflow discipline in addition to candidate-facing experience.',
                ],
            },
            {
                title: 'Top companies hiring remote TA professionals',
                paragraphs: [
                    'Rather than focusing on a short list of brand names, it is often more useful to watch the categories of employers that consistently hire remote TA talent: distributed SaaS companies, staffing and recruiting firms, healthcare organizations, BPO and customer support employers, and global enterprises with multi-region hiring needs.',
                    'Candidates should also watch venture-backed growth companies and talent-heavy industries with ongoing headcount motion, because those employers often need recruiters who can manage remote hiring across many roles and time zones.',
                ],
            },
            {
                title: 'Average salary for remote TA roles',
                paragraphs: [
                    'Remote talent acquisition compensation depends on several factors: whether the role is sourcing-only or full-cycle, the seniority of the recruiter, the complexity of the hiring environment, and the employer’s pay philosophy for remote workers.',
                    'Instead of relying on one number, job seekers should compare data across salary tools, review location-adjusted ranges, and evaluate total compensation together with variable pay, equity, and growth opportunity.',
                ],
                bullets: [
                    'Check salary benchmarks by title and seniority, not just â€œrecruiter.â€',
                    'Compare remote-first employers with location-banded employers.',
                    'Look at hiring volume and role complexity as major pay drivers.',
                ],
            },
            {
                title: 'Skills needed for TA in 2025',
                paragraphs: [
                    'The strongest remote TA candidates combine classic recruiting strengths with systems fluency. Communication, intake discipline, sourcing strategy, and stakeholder management still matter, but they increasingly sit alongside process design, tooling comfort, and data awareness.',
                ],
                bullets: [
                    'Structured sourcing and outreach',
                    'Candidate screening and calibration',
                    'ATS and recruitment workflow fluency',
                    'Hiring analytics and reporting literacy',
                    'Cross-functional communication in distributed teams',
                ],
            },
            {
                title: 'How AI is changing talent acquisition jobs',
                paragraphs: [
                    'AI is shifting recruiter value away from repetitive admin and toward evaluation, stakeholder alignment, and candidate experience. Screening, ranking, scheduling, and workflow follow-up are becoming more automated, which means recruiters who understand how to work with AI tools will be more effective.',
                    'That does not mean recruiters are being replaced. It means the role is evolving. Teams still need humans to define hiring quality, interpret context, and make judgment calls that software should support rather than own.',
                ],
            },
            {
                title: 'Best job boards for remote TA roles',
                paragraphs: [
                    'Use a mix of broad job platforms, remote-first boards, and direct company career pages. The strongest opportunities often appear first on employer sites or recruiter-focused networks before they spread broadly across aggregators.',
                ],
                bullets: [
                    'LinkedIn Jobs and professional network outreach',
                    'Remote-first boards and distributed-work communities',
                    'Company career pages for high-growth SaaS and services firms',
                    'Recruiting and talent operations communities with role-sharing threads',
                ],
            },
        ],
        cta: {
            title: 'Want to see how AI is changing talent acquisition workflows?',
            description: 'Explore Hirex REC’s AI talent acquisition solution to see how sourcing, screening, and candidate prioritization can work together.',
            primary: { label: 'Free demo', to: '/book-demo' },
            secondary: { label: 'Read how it works', to: '/how-it-works' },
        },
    },
    cfoCaseForAiRecruitment: {
        pathname: '/blog/cfo-case-for-ai-recruitment',
        seo: {
            title: 'The CFO\'s Case for AI Recruitment: What Your Hiring Process Is Really Costing You',
            description: 'Audience: CEOs, CFOs, COOs & C-Suite Decision Makers | Read time: ~7 minutes | Category: ROI & Business Impact',
        },
        hero: {
            eyebrow: 'Hirex REC blog',
            title: 'The CFO\'s Case for AI Recruitment: What Your Hiring Process Is Really Costing You',
            description:
                'Audience: CEOs, CFOs, COOs & C-Suite Decision Makers | Read time: ~7 minutes | Category: ROI & Business Impact',
        },
        intro:
            'Recruitment is not a support function. It is a direct driver of EBITDA, competitive positioning, and organisational resilience. Yet most organisations continue to treat talent acquisition as an administrative overhead rather than a strategic lever - and the financial consequences are measurable, significant, and largely avoidable.',
        keyTakeaways: [],
        sections: [
            {
                title: 'Executive Summary',
                paragraphs: [
                    'This briefing presents the business case for AI-powered recruitment in plain financial terms. It quantifies what traditional hiring is costing your organisation right now - across direct spend, productivity loss, and bad-hire risk - and models the return on investment that organisations deploying AI recruitment platforms are achieving. The data is drawn from SHRM, Deloitte, Gallup, BCG, and independent field studies conducted in 2024-2025.',
                    'Bottom line: Organisations using AI in recruitment report an average ROI of 340% within 18 months, a 33% reduction in cost-per-hire, and positions filled up to 50% faster. (Source: Second Talent, 2025 | SelectPrism, 2026)',
                ],
            },
            {
                title: 'What Your Current Hiring Process Is Actually Costing',
                paragraphs: [
                    'Most finance leaders underestimate the true cost of recruitment because the full picture is rarely presented on a single line of a P&L. The costs are distributed - across HR budgets, departmental time, productivity loss, and the compounding expense of poor hiring decisions. Here is the complete picture.',
                ],
            },
            {
                title: '1. Direct Cost Per Hire: $4,700 to $28,329+',
                paragraphs: [
                    'SHRM\'s 2024 Human Capital Benchmarking Report puts the average cost per hire in the US at $4,700 - a figure that includes job board spend, recruiter time, background checks, and assessments. For technical and executive roles, that number rises sharply: IT and tech hires average $6,000-$8,000; healthcare roles reach $9,000-$12,000, and executive searches regularly exceed $28,329 per placement. (Source: Engagedly, Average Cost Per Hire 2025)',
                    'For an organisation making 50 hires per year at even the base average, that is $235,000 in direct recruitment spend annually - before a single salary is paid. For high-volume or specialist hiring, the figure climbs into millions.',
                ],
            },
            {
                title: '2. Productivity Loss: $500 Per Day Per Unfilled Role',
                paragraphs: [
                    'Every day a role sits open; productivity bleeds. Deloitte\'s research benchmarks the cost of an unfilled position at approximately $500 per day in lost output - a figure that compounds across teams covering absent colleagues, delayed projects, and lost client throughput. (Source: SoftwareOasis / Deloitte, 2024)',
                    'With an average time-to-hire of 36-52 days (about 1 month 3 weeks) for general roles and significantly longer for senior positions, a company managing 10 open roles simultaneously could be absorbing $180,000-$260,000 in annual productivity losses from vacancy delays alone. (Source: Recruiterflow, Time to Hire Guide)',
                ],
            },
            {
                title: '3. The Bad Hire Multiplier: Up to $240,000 Per Executive Mis-Hire',
                paragraphs: [
                    'This is the cost centre that most boards never see on a slide, yet it is frequently the largest single recruitment-related expense an organisation incurs.',
                    '74% of employers admit to having made at least one bad hire. The US Department of Labor places the cost of a bad hire at up to 30% of that employee\'s first-year earnings. For a role paying $80,000, that is a $24,000 direct loss - before accounting for management time, team disruption, and rehiring. (Source: HumCap, The True Cost of Bad Hires, 2025)',
                    'At the executive level, the equation is far more severe. A 2024 CareerBuilder study found that the average reported loss per bad hire is $17,000 for standard roles, but for executive-level positions, total costs exceed $240,000 when severance, rehiring, and strategic disruption are factored in. Replacing a C-level executive can cost up to 213% of their annual salary. (Source: INOP, The True Cost of a Bad Hire, 2026 | Applauz, Real Costs of Employee Turnover, 2025)',
                    '"80% of employee turnover is directly attributable to poor hiring decisions." For a 100-person organisation with a 10% annual turnover rate and $70,000 average salaries, the combined cost of bad hires - recruiting, onboarding, lost productivity - can reach $700,000 per year. (Source: HumCap / SHRM)',
                ],
            },
            {
                title: '4. Recruiter Capacity: 23 Hours Wasted Per Hire',
                paragraphs: [
                    'Beyond direct spend, there is an invisible tax on your talent function. Recruiters spend an average of 23 hours screening resumes for a single hire, the majority of which is spent reviewing applications that will never proceed. AI can automate 75% of routine hiring communications and processes - freeing your talent team to focus on what humans do best: building relationships, assessing culture fit, and making judgment calls. (Source: Shortlistd.io, AI Recruiting Statistics)',
                    'HR morning data shows that recruiters save an average of 4.5 hours per week by deploying AI on repetitive tasks - equivalent to reclaiming over 200 productive hours per recruiter annually. At a blended recruiter cost of $50/hour, a 5-person talent team saves $50,000+ per year in labour hours alone.',
                ],
            },
            {
                title: 'The ROI Comparison: Traditional vs. HIREXREC AI',
                paragraphs: [
                    'The table below summarises the measurable impact of AI recruitment across the five financial metrics that matter most to a CFO or CEO.',
                ],
                table: {
                    columns: ['Metric', 'Traditional Hiring', 'With HIREXREC AI', 'Savings / Gain'],
                    rows: [
                        ['Avg. cost per hire', '$4,700+', '~$2,800-$3,300', '30-40% reduction'],
                        ['Time-to-hire', '36-52 days', '~20-25 days', '33-50% faster'],
                        ['Recruiter hours/role', '23 hrs screening', '~4-6 hrs', '75%+ time saved'],
                        ['Bad hire rate', '74% make a bad hire', 'AI-matched quality+', '67% quality uplift'],
                        ['18-month ROI', 'Baseline', '340% average ROI', '3.4x return'],
                    ],
                },
                bullets: [
                    'Sources: Second Talent 2025, SHRM 2024, Deloitte Human Capital 2024, Greenhouse/GoodTime 2025, SelectPrism 2026.',
                ],
            },
            {
                title: 'The Competitive Imperative: Your Competitors Are Already Moving',
                paragraphs: [
                    'AI recruitment adoption is no longer an emerging trend. It is the new baseline. The question for C-suite leaders is not whether to adopt AI in talent acquisition - it is whether to lead the transition or react to it.',
                    '87% of companies now use AI in their hiring process, up from just 30% in early 2024. Among Fortune 500 companies, 99% have adopted AI-powered recruitment methods. BCG\'s January 2025 research found that 70% of all AI experimentation inside companies occurs in HR, with talent acquisition as the single highest-priority use case. (Source: SelectPrism, 2026 | HireTruffle, 2026)',
                    'The market is pricing this in. The global AI recruitment market - valued at $617.5 million in 2024 - is projected to reach $1.35 billion by 2025 and $2.67 billion by 2029, growing at a CAGR of 18.6%. (Source: Shortlistd.io / The Business Research Company, 2025)',
                    '54% of companies plan to increase AI recruitment spending by 40%+ in 2025. TA teams using AI analytics are 2.1 times more likely to meet hiring SLAs than those without it. (Source: Deloitte Human Capital Trends, via HireTruffle 2026)',
                    'The organisations that will win the talent war in 2025 and beyond are those whose hiring infrastructure is faster, fairer, and more analytically rigorous than their competitors\'. Every week of delay is a week in which a rival is shortlisting your best candidate first.',
                ],
            },
            {
                title: 'The HIREXREC ROI Model: What 18 Months Looks Like',
                paragraphs: [
                    'For C-suite leaders evaluating the investment case, the following model illustrates the financial return from deploying the HIREX REC AI Recruitment platform across a mid-size organisation making 100 hires per year.',
                ],
                bullets: [
                    'Year 1 Cost Avoidance (100 hires/year)',
                    'Direct cost-per-hire savings (30% reduction): $4,700 × 100 × 30% = $141,000 saved',
                    'Productivity loss reduction (33% faster fill): $500/day × 44 days avg × 33% improvement × 100 roles = $72,600 saved',
                    'Bad hire reduction (quality uplift, 20% fewer bad hires): $17,000 avg bad hire cost × 20 avoided × 20% = $68,000 saved',
                    'Recruiter time reclaimed (4.5 hrs/week × 5 recruiters × 46 weeks × $50/hr): $51,750 in labour value returned',
                    'Total Year 1 Financial Impact: $333,350 in cost avoidance and productivity recovery -- before factoring in employer brand improvement, reduced agency fees, or long-term retention gains.',
                    'Independent research corroborates this trajectory. A 2025 SSRN field experiment across ~70,000 interviews found that AI-led recruitment processes drove +12% job offer rates and +17% thirty-day retention. At enterprise scale, one provider handling ~296,000 candidate screens saved ~148,000 recruiter hours -- $3.29 million in annual value. (Source: Humanly.io, AI Recruiting ROI Guide 2025)',
                    '18-Month ROI Benchmark',
                    'Across organisations of all sizes, AI in recruitment generates an average ROI of 340% within 18 months. Early-adopter organisations with high hiring volumes report returns as high as 350% when reduced agency fees are included. The payback period is typically within the first year for organisations hiring 50+ roles annually. (Source: Second Talent, 2025 | SelectPrism, 2026)',
                ],
            },
            {
                title: 'Enterprise-Scale Proof Points',
                paragraphs: [
                    'The ROI from AI recruitment is not theoretical. It is being realised at scale across industries:',
                ],
                bullets: [
                    'Hilton Hotels deployed AI in their talent acquisition function and reduced time-to-fill positions by 90%. (Source: Ellow.io, AI in Hiring Statistics)',
                    'A major US home care provider using AI orchestration handled ~296,000 candidate screens, scheduled ~138,000 interviews, and saved ~148,000 recruiter hours - generating $3.29 million in annual value. (Source: Humanly.io, 2025)',
                    'LinkedIn\'s 2025 Future of Recruiting Report found that AI-assisted recruiters are 9% more likely to make a quality hire, with AI-personalised outreach increasing positive candidate response rates by 5-12%. (Source: HeroHunt.ai, AI Adoption in Recruiting 2025)',
                    'A 2025 SSRN field experiment across ~70,000 interviews found AI recruiters processed 35-40% more candidates per week and cut time-to-fill by ~11 days per role. (Source: Humanly.io, 2025)',
                    'BCG\'s 2025 research projects 15-20% efficiency gains in HR when GenAI is embedded into core workflows - with Bain & Company corroborating these projections independently. (Source: Humanly.io, citing BCG/Bain, 2025)',
                ],
            },
            {
                title: 'The Decision in Front of You',
                paragraphs: [
                    'The data does not require interpretation. Organisations that deploy AI in recruitment hire 50% faster, spend 30-40% less per hire, reduce bad hires significantly, and generate average 18-month ROI of 340%. Those that do not are absorbing the full cost of slow, biased, and volume-overwhelmed hiring - at an estimated $500 per unfilled role per day, compounding silently across the P&L.',
                    'For C-suite leaders, the question is straightforward: is your current recruitment infrastructure built for the talent market of 2025 and beyond - or is it costing you more than you realise?',
                    'Request a board-ready ROI analysis from HIREXREC today. We will model the cost of your current hiring process against our AI platform - specific to your industry, hiring volume, and role mix. No assumptions. Just your numbers.',
                    'Because in a market where 99% of Fortune 500 companies are already using AI to hire faster and smarter, standing still is not a neutral position. It is a competitive disadvantage - one that can be quantified, and one that HIREXREC can help you eliminate.',
                ],
            },
        ],
        cta: {
            title: 'Request a board-ready ROI analysis',
            description: 'See the cost of your current hiring process against Hirex REC\'s AI platform, specific to your industry, hiring volume, and role mix.',
            primary: { label: 'Free demo', to: '/book-demo' },
            secondary: { label: 'See how it works', to: '/?showcase=live-demo#product-walkthrough' },
        },
        sources: [
            { label: 'Second Talent -- Top 100+ AI in Recruitment Statistics for 2026', href: 'https://www.secondtalent.com/resources/ai-in-recruitment-statistics/' },
            { label: 'SelectPrism -- AI Recruitment Stats: Why 70% of Companies Are Falling Behind (2026)', href: 'https://selectprism.ai/blogs/from-traditional-to-ai-enabled-recruitment' },
            { label: 'HireTruffle -- 100 AI Recruitment Statistics You Need to Know Heading into 2026', href: 'https://www.hiretruffle.com/blog/best-ai-recruitment-statistics' },
            { label: 'Humanly.io -- AI Recruiting Software: 2025 Guide to ROI & Adoption', href: 'https://www.humanly.io/blog/ai-recruiting-software-2025-guide-to-roi-and-adoption' },
            { label: 'Shortlistd.io -- 50+ AI Recruiting Statistics That Will Transform Your Hiring', href: 'https://www.shortlistd.io/blog/the-ai-recruiting-revolution-50-statistics-that-matter' },
            { label: 'Engagedly -- Average Cost Per Hire: US Data 2025', href: 'https://engagedly.com/blog/average-cost-per-hire-employee/' },
            { label: 'HumCap -- The True Cost of Bad Hires (2025)', href: 'https://humcapinc.com/cost-of-bad-hires-blog/' },
            { label: 'INOP -- The True Cost of a Bad Hire in 2026', href: 'https://inop.ai/the-true-cost-of-a-bad-hire-in-2026/' },
            { label: 'Applauz -- The Real Costs of Employee Turnover in 2025', href: 'https://www.applauz.me/resources/costs-of-employee-turnover' },
            { label: 'Millman Search -- The True Cost of a Bad Executive Hire (2025)', href: 'https://millmansearch.com/insights/search-model-strategies/cost-of-bad-executive-hire/' },
            { label: 'SoftwareOasis -- Time-to-Hire Reductions: Statistics & Benchmarks 2024', href: 'https://softwareoasis.com/time-to-hire-reductions/' },
            { label: 'Recruiterflow -- The Ultimate Guide to Time to Hire', href: 'https://recruiterflow.com/blog/time-to-hire/' },
            { label: 'HeroHunt.ai -- AI Adoption in Recruiting: 2025 Year in Review', href: 'https://www.herohunt.ai/blog/ai-adoption-in-recruiting-2025-year-in-review' },
            { label: 'CIO Dive -- C-Suite Leaders Expect AI to Deliver Cost Savings (BCG Survey, 2024)', href: 'https://www.ciodive.com/news/generative-ai-cost-savings-ROI-investments/704513/' },
            { label: 'Apollo Technical -- 31 Statistics on AI in Recruiting (2025)', href: 'https://www.apollotechnical.com/statistics-on-ai-in-recruiting/' },
            { label: 'Ellow.io -- Top AI in Hiring Statistics 2024', href: 'https://ellow.io/top-ai-in-hiring-statistics/' },
            { label: 'FullView.io -- 200+ AI Statistics & Trends for 2025: The Ultimate Roundup', href: 'https://www.fullview.io/blog/ai-statistics' },
            { label: 'C-Suite Analytics -- Turnover\'s Biggest Price Tag Isn\'t Recruiting -- It\'s Lost Productivity (2025)', href: 'https://c-suiteanalytics.com/price-is-lost-productivity/' },
        ],
    },
    whyTraditionalRecruitmentIsFailing: {
        pathname: '/blog/why-traditional-recruitment-is-failing',
        seo: {
            title: 'Why Traditional Recruitment Is Failing You -- And How AI Changes Everything',
            description: 'Audience: HR Managers & Recruiters | Read time: ~6 minutes | Category: AI in Recruitment',
        },
        hero: {
            eyebrow: 'Hirex REC blog',
            title: 'Why Traditional Recruitment Is Failing You -- And How AI Changes Everything',
            description:
                'Audience: HR Managers & Recruiters | Read time: ~6 minutes | Category: AI in Recruitment',
        },
        intro:
            'You posted the job. The applications flooded in. And now, somewhere in a spreadsheet or an overflowing inbox, your next great hire is waiting -- unnoticed. Here is the uncomfortable truth that every recruiter knows but rarely says out loud: traditional recruitment is broken.',
        keyTakeaways: [],
        sections: [
            {
                title: 'The Hiring Crisis No One Is Talking About',
                paragraphs: [
                    'Consider this: recruiters spend an average of just 23 hours screening resumes for a single hire, yet most of that time yields inconsistent, bias-prone shortlists. At the same time, each unfilled role costs a company approximately $500 per day in lost productivity -- a figure that compounds rapidly for technical and leadership positions. (Source: Deloitte Recruitment Efficiency Report, 2024)',
                    '"The hiring process has taken longer each year for the last four years. Increasing volume, more complex screening requirements, and multiple interview stages have all stretched timelines -- putting top talent at risk of being poached by faster competitors."',
                    'The problem is not a lack of talent. It is a lack of the right tools. At HIREXREC, we built our AI Recruitment platform specifically to solve the four most damaging pain points in modern hiring. This blog walks you through each one -- and shows exactly how AI resolves it.',
                ],
            },
            {
                title: 'The Four Pain Points Costing You Top Talent',
                paragraphs: [],
            },
            {
                title: 'Pain Point 1: Resume Overload -- The Volume Problem',
                paragraphs: [
                    'Each corporate job posting attracts an average of 250 applications. For competitive tech roles, that number soars to 500 or more. At 30-90 seconds per resume, a recruiter needs 8-25 hours to complete initial screening for just 500 applications -- and that is before a single interview is scheduled. (Source: Shortlistd.io, The Shocking Truth About How Recruiters Spend Their Time)',
                    'The result? 80% of CVs never make it past the first screen, and only 11% of applicants are considered suitable for the roles they apply to. That means highly qualified candidates are being filtered out not because they are underqualified, but because there simply is not enough human bandwidth to review them fairly. (Source: StandOut-CV, 2024 Recruiter Study)',
                ],
            },
            {
                title: 'Pain Point 2: Unconscious Bias -- The Hidden Filter',
                paragraphs: [
                    '96% of recruiters acknowledge that unconscious bias is a problem in the hiring process, yet very few have systematic tools to address it. (Source: Agency Central Recruiter Poll)',
                    'Bias is not a character flaw -- it is a cognitive limitation. When humans are processing hundreds of resumes under time pressure, unconscious pattern-matching takes over. The solution is not willpower. It is structured, consistent, data-driven evaluation.',
                ],
                bullets: [
                    '57% of professionals believe their chances of being selected for a role have been reduced due to personal characteristics. (Source: Hays DE&I Report, 2024)',
                    'Male candidates are 1.5 times more likely to enter the initial selection process than equally qualified female candidates. (Source: Gem Recruiting Benchmarks, 2024)',
                    'Only 38% of HR professionals say they actively work to remove bias from their recruitment practices. (Source: OneAdvanced Annual Trends Report)',
                ],
            },
            {
                title: 'Pain Point 3: Slow Time-to-Hire -- The Speed Gap',
                paragraphs: [
                    'According to LinkedIn\'s 2024-2025 Recruitment Report, the average time-to-hire in the U.S. stands at approximately 36 days from application to accepted offer. For technical IT roles, that number frequently stretches to 52 days or beyond. (Source: Recruiterflow, The Ultimate Guide to Time to Hire)',
                    'Here is the competitive reality: top candidates receive multiple offers within just 10 days of beginning their job search. A company with a 45-day hiring cycle is, by definition, losing the talent race. (Source: JoinGenius, Average Time to Hire Statistics 2024)',
                    'And the financial toll of slow hiring is significant. Unfilled roles cost companies an average of $500 per day, with the impact multiplying for high-demand technical positions. For a mid-size company juggling 10-15 open roles simultaneously, this translates to tens of thousands of dollars in lost productivity every single month.',
                ],
            },
            {
                title: 'Pain Point 4: Poor Candidate Experience -- The Brand Damage',
                paragraphs: [
                    'The candidate experience does not just affect whether someone accepts your offer -- it affects whether they ever apply again, and what they tell others about your company.',
                    '64% of candidates who withdraw from a hiring process cite poor communication as the primary reason. Meanwhile, 48% of rejected candidates do not understand why they were rejected, leaving them frustrated and unlikely to re-engage with your brand. (Source: Starred, 2024 Candidate Experience Benchmark Report)',
                    'Perhaps most damaging: 13% of candidates who report a terrible experience are less likely to apply again or refer others -- directly eroding your future talent pipeline. (Source: Skima, Top 60+ Recruitment Statistics 2024)',
                    'The average recruiter in 2024 managed 2,526 applications -- 28% more than in 2023 and 106% more than in 2022. Doing more with less is not a slogan. It is the reality -- and it is unsustainable without AI. (Source: Starred Benchmark Report, 2024)',
                ],
            },
            {
                title: 'Enter HIREXREC: AI Built for Modern Recruiters',
                paragraphs: [
                    'HIREXREC was founded on a single belief: that great hiring decisions should be driven by skills, potential, and data -- not by the speed of human attention spans or the volume of CVs in an inbox.',
                    'Our AI Recruitment platform is purpose-built for HR managers and talent acquisition teams who need to move faster, hire smarter, and build more diverse, high-performing teams. It does not replace the human judgment at the heart of great hiring -- it eliminates the repetitive, error-prone work that gets in the way of it.',
                ],
            },
            {
                title: 'How HireX AI Solves Each Pain Point',
                paragraphs: [],
            },
            {
                title: 'Solution 1: Automated Screening -- From Hours to Seconds',
                paragraphs: [
                    'HireX AI processes thousands of applications simultaneously, applying consistent, skills-first evaluation criteria that do not fatigue, drift, or vary from one resume to the next. Where a human recruiter might spend 23 hours screening for one role, AI-powered screening reduces that time by 70-85%. (Source: BotFriday AI, Resume Screening Research)',
                    'The result is a ranked, pre-qualified shortlist delivered in minutes -- not days. Recruiters spend their time where it matters most: building candidate relationships, conducting meaningful interviews, and making strategic hiring decisions.',
                    'The broader market is validating this shift. 87% of companies now incorporate AI into their recruitment process, and 67% of hiring decision-makers cite time savings as AI\'s primary benefit. (Source: DemandSage, AI Recruitment Statistics 2024)',
                ],
            },
            {
                title: 'Solution 2: Bias-Reduced Matching -- Skills First, Always',
                paragraphs: [
                    'HIREXREC evaluates candidates on defined role competencies and verified skills -- not on name, gender, age, or educational pedigree. By standardising the criteria applied to every single application, the platform eliminates the cognitive shortcuts that produce biased shortlists.',
                    'This is not a marginal improvement. 43% of organisations that have adopted AI in recruitment specifically cite bias reduction as a key benefit, and 68% of recruiters are confident that well-implemented AI will help eliminate unintentional bias from their processes. (Source: HeroHunt.ai, 2024 Recruitment Statistics)',
                    'Companies that embrace diversity and inclusive hiring are 70% more likely to enter new markets and can see revenue per employee increase by up to 30%. Fair hiring is not just ethical -- it is a competitive advantage. (Source: Skima, Recruitment Statistics)',
                ],
            },
            {
                title: 'Solution 3: Intelligent Interview Scheduling -- Cut Coordination Time Dramatically',
                paragraphs: [
                    'One of the most overlooked time sinks in recruitment is interview coordination. Scheduling a single interview round -- across multiple stakeholders with conflicting calendars -- routinely consumes hours of administrative time.',
                    'HIREXREC automates this process end-to-end: from candidate availability matching to calendar invites to automated reminders. The impact is significant. AI-assisted teams report up to 40% faster time-to-shortlist for volume roles, and candidate response times drop from 7 days to under 24 hours when AI chat is deployed. (Source: HireTruffle, 100 AI Recruitment Statistics 2025)',
                    'For companies using AI recruitment tools broadly, positions are filled 3x faster than those relying on manual processes. (Source: BotFriday AI)',
                ],
            },
            {
                title: 'Solution 4: AI-Powered Candidate Communication -- Keep Talent Engaged',
                paragraphs: [
                    'HIREXREC sends personalised, timely status updates to every candidate at every stage of the pipeline -- automatically. No more candidates wondering whether their application was received. No more withdrawals due to radio silence.',
                    '73% of candidates appreciate faster application processing, and 68% value immediate feedback on the status of their application. (Source: Second Talent, AI in Recruitment Statistics)',
                    'The downstream effect on employer brand is profound. Organisations that invest in candidate experience report up to 30% lower employee turnover and a 50% reduction in cost-per-hire through stronger employer branding. (Source: Skima, Top 60+ Recruitment Statistics 2024)',
                ],
            },
            {
                title: 'The Real-World Impact: What the Numbers Show',
                paragraphs: [
                    'The evidence for AI-powered recruitment is no longer anecdotal. It is measurable, consistent, and growing:',
                ],
                bullets: [
                    'AI-powered recruitment processes reduce hiring costs by up to 31% while improving hire success rates by 67%. (Source: Accenture AI Efficiency Research, via Second Talent)',
                    'Advanced predictive analytics predict job performance with 78% accuracy and retention likelihood with 83% accuracy. (Source: Second Talent, 2024)',
                    'Organisations save an average of $4,000 per hire by reducing time-to-hire by just one week. (Source: Deloitte Cost-Per-Hire Benchmark Report, 2024)',
                    'Teams using AI screening report up to 40% faster time-to-shortlist for volume roles. (Source: Eightfold AI Screening Benchmarks, 2025)',
                    'Hilton Hotels used AI to slash its time-to-fill positions by 90%. (Source: Ellow.io, Top AI in Hiring Statistics)',
                    'The global AI recruitment market -- valued at $661.5 million in 2024 -- is projected to reach $1.1 billion by 2030. By that point, 94% of recruitment processes will incorporate AI. The question is not whether AI will reshape hiring. It already is. The question is whether your organisation will lead that shift or be left behind. (Source: SmartRecruiters, 44 Statistics on AI in Recruitment)',
                ],
            },
            {
                title: 'Ready to Hire Smarter?',
                paragraphs: [
                    'If your team is still spending 23 hours screening for every hire -- or losing top candidates to competitors who respond faster -- it is time for a better approach.',
                    'HIREXREC gives you the AI infrastructure to screen faster, hire fairer, and deliver a candidate experience that builds your employer brand -- not damages it.',
                    'Book a free personalised demo with the HIREXREC team today. See exactly how our AI recruitment platform would perform against your current process -- with your roles, your volume, your team.',
                    'Because the best candidate for your next role is already out there. Let HIREXREC AI help you find them first.',
                ],
            },
        ],
        cta: {
            title: 'Book a free personalised demo',
            description: 'See exactly how the HIREXREC AI recruitment platform would perform against your current process with your roles, your volume, and your team.',
            primary: { label: 'Free demo', to: '/book-demo' },
            secondary: { label: 'See how it works', to: '/?showcase=live-demo#product-walkthrough' },
        },
        sources: [
            { label: 'StandOut-CV -- How Long Do Recruiters Spend Looking at a CV? (2024 Study)', href: 'https://standout-cv.com/stats/how-long-recruiters-spend-looking-at-cv' },
            { label: 'Shortlistd.io -- The Shocking Truth About How Recruiters Spend Their Time', href: 'https://www.shortlistd.io/blog/the-shocking-truth-about-how-recruiters-spend-their-time' },
            { label: 'Eddy HR -- Resume Screening: Everything You Need to Know', href: 'https://eddy.com/hr-encyclopedia/resume-screening/' },
            { label: 'Zety -- Top HR Statistics & Trends for 2024', href: 'https://zety.com/blog/hr-statistics' },
            { label: 'Agency Central -- 96% of Recruiters Think Unconscious Bias Is a Problem', href: 'https://www.agencycentral.co.uk/articles/96-of-recruiters-think-unconscious-bias-is-a-problem-but-can-it-be-avoided/' },
            { label: 'Hays -- Overcoming Bias in Hiring: 2024 DE&I Report', href: 'https://www.hays.co.uk/market-insights/article/overcoming-bias-how-to-foster-inclusive-hiring-practices' },
            { label: 'Gem -- Unconscious Bias in Hiring: Top-of-Funnel Disparities', href: 'https://www.gem.com/blog/unconscious-bias-in-hiring' },
            { label: 'Equalture -- What is Unbiased Recruitment?', href: 'https://www.equalture.com/blog/what-is-unbiased-recruitment/' },
            { label: 'JoinGenius -- Average Time to Hire by Industry (2024 Statistics)', href: 'https://joingenius.com/statistics/average-time-to-hire/' },
            { label: 'Recruiterflow -- The Ultimate Guide to Time to Hire', href: 'https://recruiterflow.com/blog/time-to-hire/' },
            { label: 'SoftwareOasis -- Time-to-Hire Reductions: Statistics & Data 2024', href: 'https://softwareoasis.com/time-to-hire-reductions/' },
            { label: 'Starred -- 2024 Candidate Experience Benchmark Report', href: 'https://www.starred.com/blog/candidate-experience-benchmarks' },
            { label: 'DemandSage -- AI Recruitment Statistics 2024', href: 'https://www.demandsage.com/ai-recruitment-statistics/' },
            { label: 'HeroHunt.ai -- 2024 Recruitment Statistics: Hiring and Technology', href: 'https://www.herohunt.ai/blog/2024-recruitment-statistics-hiring-and-technology' },
            { label: 'SmartRecruiters -- 44 Statistics on AI in Recruitment for 2024', href: 'https://www.smartrecruiters.com/blog/44-recruitment-statistics-on-ai-for-2024/' },
            { label: 'Second Talent -- Top 100+ AI in Recruitment Statistics', href: 'https://www.secondtalent.com/resources/ai-in-recruitment-statistics/' },
            { label: 'HireTruffle -- 100 AI Recruitment Statistics for 2025', href: 'https://www.hiretruffle.com/blog/best-ai-recruitment-statistics' },
            { label: 'Skima -- Top 60+ Recruitment Statistics 2024', href: 'https://skima.ai/blog/industry-trends-and-insights/recruitment-statistics' },
            { label: 'Ellow.io -- Top AI in Hiring Statistics in 2024', href: 'https://ellow.io/top-ai-in-hiring-statistics/' },
            { label: 'BotFriday AI -- How Much Time Do You Waste Screening Resumes?', href: 'https://www.botfriday.ai/blog/how-much-time-do-you-waste-screening-resumes-and-how-to-fix-it' },
            { label: 'OneAdvanced -- Unconscious Bias in Hiring: The Invisible Barrier to DE&I', href: 'https://www.oneadvanced.com/resources/unconscious-bias-in-hiring-the-invisible-barrier-to-dei/' },
        ],
    },
    whatIsAJobOutlook: {
        pathname: '/blog/what-is-a-job-outlook',
        seo: {
            title: 'What Is a Job Outlook? How to Research Career Prospects',
            description: 'Understand what a job outlook is, why career projections matter, and how recruiters and employers use labor market signals to plan ahead.',
        },
        hero: {
            eyebrow: 'Hirex REC blog',
            title: 'What Is a Job Outlook? Everything You Need to Know About Career Projections',
            description:
                'A simple guide to job outlook research, labor market signals, and how employers use career projection data to make stronger workforce decisions.',
        },
        intro:
            'Job outlook is one of the most useful concepts in career planning and workforce strategy. For individuals, it helps estimate how demand for a role may change over time. For recruiters and employers, it provides context for planning pipelines, evaluating scarcity, and understanding where hiring competition may increase.',
        keyTakeaways: [
            'Job outlook describes the expected growth, stability, or decline of an occupation over time.',
            'Reliable job outlook research usually combines labor statistics, salary data, and employer hiring behavior.',
            'AI tools can help teams monitor workforce patterns, talent scarcity, and evolving hiring demand.',
        ],
        sections: [
            {
                title: 'Job outlook definition',
                paragraphs: [
                    'Job outlook refers to the expected future demand for a job or occupation. It usually reflects whether a field is projected to grow, remain stable, or contract over a defined period.',
                    'A strong job outlook generally means employers are expected to keep hiring for that role, while a weaker outlook may signal slower demand, structural change, or increased competition for openings.',
                ],
            },
            {
                title: 'Where to find job outlook data',
                paragraphs: [
                    'The best sources are usually official labor statistics, occupational handbooks, and credible labor-market research tools. Industry reports, job boards, and compensation platforms can also add useful context, especially when comparing regional differences or emerging roles.',
                    'For employers, job outlook research works best when combined with internal hiring history and role-level time-to-fill data.',
                ],
            },
            {
                title: 'Why job outlook matters',
                paragraphs: [
                    'Career planning is easier when you understand whether a role is expanding, stabilizing, or becoming more specialized. Strong outlook data helps candidates prioritize skill development and helps employers plan recruiting strategy earlier.',
                    'It also supports better conversations about market difficulty, compensation pressure, and the amount of sourcing effort a role may require.',
                ],
            },
            {
                title: 'How recruiters and employers use outlook data',
                paragraphs: [
                    'Recruiters use outlook data to anticipate talent scarcity, set realistic search plans, and advise hiring managers on timeline expectations.',
                    'Employers use it to decide where to build pipelines, which roles may require more proactive sourcing, and when AI recruitment software or workflow automation can reduce pressure on the team.',
                ],
                bullets: [
                    'Forecast hard-to-fill roles earlier',
                    'Adjust compensation and sourcing strategy',
                    'Plan headcount and recruiting capacity more deliberately',
                ],
            },
            {
                title: 'How AI tools support workforce planning',
                paragraphs: [
                    'AI tools can help recruiting teams connect external labor signals with internal hiring data. That makes it easier to spot where demand is rising, which roles are repeatedly slow to fill, and where structured screening can improve hiring velocity.',
                    'The most valuable AI tools do not guess the future. They help teams respond faster to the trends already visible in the market and in their own workflows.',
                ],
            },
        ],
        cta: {
            title: 'See how Hirex REC supports workforce planning and hiring execution',
            description: 'Explore the platform pages that connect AI hiring workflows with recruiter visibility and process consistency.',
            primary: { label: 'Free demo', to: '/book-demo' },
            secondary: { label: 'See automated recruitment', to: '/automated-recruitment-platform' },
        },
    },
};

export const blogIndexPage = {
    pathname: '/blog',
    seo: {
        title: 'Hirex REC Blog - AI Hiring, Recruiting Operations, and Talent Acquisition',
        description: 'Read Hirex REC insights on AI hiring, recruiting workflows, talent acquisition careers, and workforce planning.',
    },
    hero: {
        eyebrow: 'Hirex REC blog',
        title: 'Practical Content for Recruiting Teams and Talent Operators',
        description:
            'Browse short-form resources focused on AI hiring, recruiting operations, labor market research, and modern talent acquisition workflows.',
    },
    featuredPosts: marketingPageGroups.blog,
};
