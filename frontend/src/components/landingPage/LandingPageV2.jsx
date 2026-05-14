import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import FakePlivoCall from "../CallSimulation/FakePlivoCall";
import "./LandingPageV2.css";
import CallScreenMobile from "../CallSimulation/DemoMobileCall";

const faqItems = [
    {
        q: "How is this different from traditional ATS or HR tools?",
        a: "Unlike ATS systems that only manage data, the AI actively works like a digital recruiter—screening candidates, scheduling, engaging, and shortlisting with minimal manual effort."
    },
    {
        q: "Does the platform integrate with existing systems?",
        a: "Yes. It supports API-based integrations with ATS, HRMS, CRM tools, WhatsApp, email providers, and more."
    },
    {
        q: "What AI models power the platform?",
        a: "The system combines LLMs, machine-learning classifiers, semantic search, and NLP-based scoring engines to evaluate candidates across skills, keywords, communication, and fitment."
    },
    {
        q: "How does the AI screen resumes technically?",
        a: "It parses resumes using OCR + NLP, converts them into structured candidate vectors, and matches them against job requirement embeddings for precise scoring."
    },
    {
        q: "Is the system multi-tenant?",
        a: "Yes. The architecture supports scalable, multi-tenant deployment where each client has isolated data while sharing the core AI engine."
    },
    {
        q: "What is the uptime guarantee?",
        a: "The platform is built on an autoscaling cloud infrastructure with a 99.9% uptime SLA."
    },
    {
        q: "How does the system integrate with WhatsApp, email, or ATS tools?",
        a: "Through REST APIs and secure webhooks that allow bi-directional syncing of candidate data, interview status, and communication logs."
    },
    {
        q: "What is the latency for candidate search and shortlisting?",
        a: "With vectorized search and pre-indexed roles, average latency is under 1 second, and shortlist generation is typically under 10 seconds."
    },
    {
        q: "How many roles can the AI handle at once?",
        a: "There’s no limit — the system can manage multiple job openings simultaneously and prioritize them based on urgency and hiring patterns."
    },
    {
        q: "Will recruiters still need to manually review candidates?",
        a: "Recruiters can review final shortlisted profiles, but the AI handles all the repetitive steps earlier in the funnel."
    },
    {
        q: "How does the AI handle duplicate candidates?",
        a: "It automatically identifies duplicate profiles across resumes, databases, referrals, and past applications and informs you."
    },
    {
        q: "Is the platform suitable for agencies as well as in-house HR teams?",
        a: "Yes. It's designed for both — with dedicated features for agency collaboration, client management, and enterprise workflows."
    },
    {
        q: "Does the system offer role-based access?",
        a: "Yes. You can control who sees what — whether it's recruiters, team leads, management, or external stakeholders."
    }
];

const leftSlides = [
    {
        eyebrow: "EVERYTHING YOU NEED",
        titleLine1: "Transform Your Hiring",
        titleLine2: "From Manual to Magical",
        desc: "A unified hiring platform that automates sourcing, screening, assessments, and collaboration — so your team focuses on better decisions, not busywork."
    },
    {
        eyebrow: "COMPLETE HIRING INTELLIGENCE",
        titleLine1: "Modern Recruiting,",
        titleLine2: "Designed for Scale",
        desc: "Streamline every step of your hiring lifecycle with centralized workflows, real-time insights, and automation built for growing teams."
    },
    {
        eyebrow: "STOP WASTING HOURS",
        titleLine1: "Hire Faster.",
        titleLine2: "Hire Smarter.",
        desc: "Automate repetitive tasks. Standardize evaluation. Empower recruiters. Deliver better hires in less time — without chaos."
    }
];

const features = [
    {
        title: "Unified Talent Operating System",
        desc: "A single platform handling screening, interviewing, assessments, and data banking end-to-end."
    },
    {
        title: "AI Voice Screening & Interview Automation",
        desc: "Automated voice-based candidate screening with evaluation scoring to cut recruiter workload by up to 70%."
    },
    {
        title: "Smart ATS with Customizable Hiring Pipelines",
        desc: "Modular workflow stages tailored per job, company, or recruiter."
    },
    {
        title: "Deep Candidate Data Bank + Boolean Search",
        desc: "A continuously growing talent repository with advanced search, enabling instant re-hiring and zero wasted leads."
    },
    {
        title: "End-To-End Assessment Suite",
        desc: "Coding rounds, MCQ tests, psychometric, HR interview, plagiarism detection, scoring analytics, and playback in one place."
    },
    {
        title: "Real-Time Dashboards & Hiring Intelligence",
        desc: "From recruiter performance to conversion ratios — every hiring metric in one dynamic, real-time dashboard."
    },
    {
        title: "Seamless Collaboration & Communication Hub",
        desc: "Calendar sync, automated reminders, feedback scorecards, role-based access for recruiters, HR, interviewers, and clients."
    },
    {
        title: "Plug-and-Play API & Webhook Integrations",
        desc: "Connect effortlessly with HRMS/CRM/Payroll/ATS systems for enterprise onboarding and workforce scalability."
    }
];

const LandingPageV2 = () => {
    const videoRef = useRef(null);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (!video) return;
                if (entry.isIntersecting) {
                    video.play().catch(() => { });
                } else {
                    video.pause();
                }
            },
            { threshold: 0.4 }
        );

        observer.observe(video);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div className="landing-v2">
            <section className="v2-hero">
                <div className="v2-hero-bg" />
                <div className="v2-hero-inner">
                    <div className="v2-hero-left">
                        <span className="v2-pill">AI SELEKT · AI Voice · ATS Ready</span>
                        <h1>
                            <span className="v2-brand">AISELEKT</span>
                            {/* <br />
                        From Hello to Hired & Beyond
                        <br />
                        Reduce Your Hiring Cost by 70% */}
                            <br />
                            <em>Build global teams without the chaos.</em>
                        </h1>
                        <p>
                            Hirex REC is a next-generation AI recruitment platform that automates hiring
                            from screening to selection. Build global teams faster, smarter, and without
                            the chaos.
                        </p>
                        <div className="v2-hero-actions">
                            <Link className="v2-btn v2-btn-primary" to="/boolean/search/">Boolean Search</Link>
                            <Link className="v2-btn v2-btn-outline" to="/auth/register/">Try a Demo</Link>
                        </div>
                    </div>

                    <div className="v2-hero-right">
                        <div className="v2-hero-demo">
                            <FakePlivoCall CallScreen={CallScreenMobile} />
                        </div>
                    </div>
                </div>
            </section>

            <section className="v2-section v2-capabilities">
                <div className="v2-section-header">
                    <span>Everything You Need</span>
                </div>
                <div className="v2-capabilities-grid">
                    <div className="v2-capabilities-copy">
                        <h2>
                            Transform Your Hiring
                            <br />
                            From <span>Manual to Magical</span>
                        </h2>
                        <p>
                            A unified hiring platform that automates sourcing, screening,
                            assessments, and collaboration — so your team focuses on better
                            decisions, not busywork.
                        </p>
                        <ul className="v2-capabilities-list">
                            {features.map((feature) => (
                                <li key={feature.title}>
                                    <span
                                        className="v2-tooltip"
                                        data-tooltip={feature.desc}
                                    >
                                        {feature.title}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="v2-capabilities-visual">
                        {leftSlides.map((slide, idx) => (
                            <div key={slide.eyebrow} className={`v2-stack v2-stack-${idx + 1}`}>
                                <div className="v2-stack-card">
                                    <span className="v2-stack-eyebrow">{slide.eyebrow}</span>
                                    <h4>
                                        {slide.titleLine1}
                                        <br />
                                        {slide.titleLine2}
                                    </h4>
                                    <p>{slide.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="v2-section v2-process">
                <div className="v2-section-header">
                    <span>Our Process</span>
                </div>
                <div className="v2-process-grid">
                    {[
                        { title: "Sourcing", desc: "Find the right talent faster with intelligent search and recommendations." },
                        { title: "AI-Assisted Screening", desc: "Let AI pre-qualify candidates with voice, chat, or video evaluations." },
                        { title: "Automated Scheduling", desc: "Interviews arranged instantly—no back-and-forth needed." },
                        { title: "AI-Driven Evaluation", desc: "Get unbiased candidate insights and scoring powered by machine intelligence." },
                        { title: "Centralized Candidate Management", desc: "Track every applicant from sourcing to selection with ease." },
                        { title: "Faster, Smarter Hiring", desc: "Complete your recruitment cycle effortlessly—from search to hire." }
                    ].map((item, idx) => (
                        <div key={item.title} className={`v2-process-card ${idx === 4 ? "is-highlight" : ""}`}>
                            <span className="v2-step">{String(idx + 1).padStart(2, "0")}</span>
                            <h4>{item.title}</h4>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="v2-section v2-contact">
                <div className="v2-section-header">
                    <span>Contact Us</span>
                </div>
                <div className="v2-contact-grid">
                    <div>
                        <h2>Get in Touch</h2>
                        <p>
                            Our friendly team would love to hear from you. Let’s build
                            something meaningful together.
                        </p>
                        <div className="v2-contact-cards">
                            <div className="v2-contact-card">
                                <h4>Office Location</h4>
                                <p>
                                    4th floor, Vision Flora commercials, Office Number 419 & 419 A,
                                    Kunal Icon Rd, next to HDFC Bank, Pimple Saudagar,
                                    Pune, Maharashtra 411027
                                </p>
                            </div>
                            <div className="v2-contact-card">
                                <h4>Working Hours</h4>
                                <p>Monday - Friday, 9:30 AM – 6:30 PM IST</p>
                            </div>
                            <div className="v2-contact-card">
                                <h4>Contact Details</h4>
                                <p>nikhilb@hirexit.com</p>
                                <p>+91 96895 91646</p>
                            </div>
                        </div>
                    </div>
                    <div className="v2-map">
                        <iframe
                            title="Office Map"
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4126.293873391435!2d73.79751007555753!3d18.59137068251602!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b9dcc0e4d1e3%3A0xf8cb9d0a328751be!2sLAKSHMI%20ARTILIGENCE%20TECHNOLOGY%20SERVICES%20PRIVATE%20LIMITED!5e1!3m2!1sen!2sin!4v1763015634997!5m2!1sen!2sin"
                            style={{ border: 0 }}
                            allowFullScreen=""
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                        ></iframe>
                    </div>
                </div>
            </section>

            <section id="v2-video" className="v2-section v2-projects">
                <div className="v2-section-header">
                    <span>Product Walkthrough</span>
                </div>
                <div className="v2-video-card">
                    <video
                        src="/static/Introducing_AI_SELEKT_HD.mp4"
                        ref={videoRef}
                        muted
                        loop
                        playsInline
                        controls
                    />
                </div>
            </section>

            <section className="v2-section v2-faq">
                <div className="v2-section-header">
                    <span>Frequently Asked Questions</span>
                </div>
                <div className="v2-faq-list">
                    {faqItems.map((item) => (
                        <details key={item.q} className="v2-faq-item">
                            <summary>{item.q}</summary>
                            <p>{item.a}</p>
                        </details>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default LandingPageV2;
