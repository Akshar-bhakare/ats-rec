import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import SeoHead from './components/ui/SeoHead';
import {
    buildOrganizationSchema,
    buildSoftwareApplicationSchema,
    buildWebPageSchema,
    buildWebsiteSchema,
    resolveSiteOrigin
} from './lib/seoSchema';
import Hero from "./sections/Hero";
import RotatingShowcase from "./sections/RotatingShowcase";
import Workflow from "./sections/Workflow";
import Features from "./sections/Features";
import Testimonials from "./sections/Testimonials";
import FaqSection from "./sections/FaqSection";
import FinalCtaSection from "./sections/FinalCtaSection";
// import Pricing from "./sections/Pricing";
import EvaluationModal from "./sections/EvaluationModal";
import SecurityTrustBanner from "./sections/SecurityTrustBanner";
import { FAQ_ITEMS } from './lib/constants';
import { buildFaqSchema } from './lib/seoSchema';

const LandingPage = () => {
    const [demoOpen, setDemoOpen] = useState(false);
    const location = useLocation();
    const seoTitle = 'Hirex REC - AI Hiring Platform for Faster, Smarter Recruitment';
    const seoDescription = 'Hirex REC is an AI-powered hiring platform that automates recruitment, screens candidates intelligently, and reduces time-to-hire by up to 80%. Start hiring smarter today.';
    const siteOrigin = resolveSiteOrigin();
    const structuredData = [
        buildOrganizationSchema(siteOrigin),
        buildWebsiteSchema(siteOrigin),
        buildWebPageSchema({
            siteOrigin,
            pathname: '/',
            title: seoTitle,
            description: seoDescription
        }),
        buildSoftwareApplicationSchema({
            siteOrigin,
            title: seoTitle,
            description: seoDescription,
            pathname: '/',
            featureList: [
                'AI screening interviews',
                'Instant recruitment reports',
                'Unified hiring dashboard'
            ]
        }),
        buildFaqSchema(FAQ_ITEMS)
    ];

    useEffect(() => {
        if (!location.hash) return;

        const targetId = decodeURIComponent(location.hash.slice(1));
        const searchParams = new URLSearchParams(location.search);
        const showcaseCardId = searchParams.get('showcase');
        let attempts = 0;

        const scrollToTarget = () => {
            const element = document.getElementById(targetId);
            if (element) {
                if (showcaseCardId) {
                    window.dispatchEvent(new CustomEvent('hirexit:showcase-focus', {
                        detail: { cardId: showcaseCardId }
                    }));
                }

                const appBarOffset = 88;
                const top = element.getBoundingClientRect().top + window.scrollY - appBarOffset;
                window.scrollTo({ top, behavior: 'smooth' });
                return;
            }

            if (attempts < 12) {
                attempts += 1;
                window.setTimeout(scrollToTarget, 100);
            }
        };

        scrollToTarget();
    }, [location.hash, location.search]);

    return (
        <>
            <SeoHead
                title={seoTitle}
                description={seoDescription}
                pathname="/"
                structuredData={structuredData}
            />
            <Hero onOpenDemo={() => setDemoOpen(true)} />
            <SecurityTrustBanner />
            <RotatingShowcase onOpenDemo={() => setDemoOpen(true)} />
            <Workflow />
            <Features />
            <Testimonials />
            <FaqSection />
            <FinalCtaSection />
            {/* <Pricing /> */}

            <EvaluationModal open={demoOpen} onClose={() => setDemoOpen(false)} />
        </>
    );
};

export default LandingPage;
