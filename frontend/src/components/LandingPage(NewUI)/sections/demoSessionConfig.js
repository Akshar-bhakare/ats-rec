const isProductionDemoEnvironment = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const origin = window.location.origin.toLowerCase();
    return origin.includes('aiselekt.com') || origin.includes('hirexit.ai');
};

export const getDemoJobIds = () => {
    const isProduction = isProductionDemoEnvironment();

    return {
        'FullStack Developer': isProduction ? '6927469930c53179d1444afa' : '69275dfb91a7281165e6d268',
        'HR Manager': isProduction ? '692747d730c53179d1444b2b' : '69275f2ece85fcf258c76ac4',
        'Product Manager': isProduction ? '692747d730c53179d1444b2b' : '69275f2ece85fcf258c76ac4',
        'Sales Executive': isProduction ? '692747d730c53179d1444b2b' : '69275f2ece85fcf258c76ac4'
    };
};

export const getDemoCandidateId = () => (
    isProductionDemoEnvironment() ? '69274c0d30c53179d1444b93' : '69275fa0ce85fcf258c76b29'
);

export const getDemoFlowConfig = (flow) => {
    const jobIds = getDemoJobIds();

    const flowConfig = {
        'book-demo': {
            title: 'Book a Product Demo',
            description: 'Register once, verify your business email, and choose the exact slot for your live Hirex REC walkthrough.',
            demoOf: 'Product Demo Booking',
            jobTitle: 'FullStack Developer',
            ctaLabel: 'Verify & Continue'
        },
        'demo-suite': {
            title: 'Start Interactive Demo',
            description: 'Fill the form once, verify OTP, then choose whether to begin with the AI call demo or the AI interview demo.',
            demoOf: 'Interactive Demo Suite',
            jobTitle: 'FullStack Developer',
            ctaLabel: 'Verify & Continue'
        },
        'live-demo': {
            title: 'Book Live Demo',
            description: 'Complete the registration form, verify OTP, and the live AI call will start directly on the card.',
            demoOf: 'AI Screening Call',
            jobTitle: 'FullStack Developer',
            ctaLabel: 'Verify & Start Call'
        },
        'ai-interview': {
            title: 'Start AI Interview Demo',
            description: 'Verify once and launch an HR Manager interview demo directly inside the showcase card.',
            demoOf: 'AI Interview Demo',
            jobTitle: 'HR Manager',
            ctaLabel: 'Verify & Start Interview',
            interviewMeta: {
                companyName: 'Hirex REC',
                location: 'Pune, Maharashtra, India',
                compensation: 'The compensation range for this HR Manager role is 12 to 18 lakh per annum, depending on experience and interview alignment.',
                workMode: 'This role follows a hybrid setup with three days from the Pune office and two remote workdays.',
                department: 'People and Talent',
                team: 'You would work closely with business leaders, hiring managers, and the Head of People Operations.',
                jobSummary: 'This role leads hiring coordination, employee engagement programs, policy rollout, conflict resolution, and people analytics for growing teams.',
                benefits: 'The role includes paid leave, medical insurance, structured growth reviews, and performance-linked progression.'
            }
        },
        dashboard: {
            title: 'Unlock Dashboard Walkthrough',
            description: 'Complete the form once to continue into the product walkthrough from the dashboard card.',
            demoOf: 'Hiring Dashboard Walkthrough',
            jobTitle: 'FullStack Developer',
            ctaLabel: 'Verify & Continue'
        }
    };

    const selectedConfig = flowConfig[flow] || flowConfig['live-demo'];

    return {
        ...selectedConfig,
        jobId: jobIds[selectedConfig.jobTitle]
    };
};
