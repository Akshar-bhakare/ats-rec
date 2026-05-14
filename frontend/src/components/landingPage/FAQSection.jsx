import React from "react";
import {
    Box,
    Container,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    useTheme,
    alpha
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const faqs = [
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

export default function FAQSection() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Box sx={{ py: { xs: 10, md: 14 }, background: theme.palette.background.default }}>
            <Container maxWidth="md" sx={{ textAlign: "center" }}>

                {/* SECTION HEADER */}
                <Typography sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.text.secondary, mb: 1 }}>
                    SUPPORT & HELP
                </Typography>

                <Typography sx={{ fontSize: { xs: 32, md: 42 }, fontWeight: 700, lineHeight: 1.2, mb: 2 }}>
                    Frequently Asked Questions
                </Typography>

                <Typography sx={{ maxWidth: 600, mx: "auto", opacity: 0.8, fontSize: 16, mb: 6 }}>
                    Clear answers to common questions about how the platform works and how your team can benefit from it.
                </Typography>

                {/* FAQ LIST */}
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {faqs.map((faq, i) => (
                        <Accordion
                            key={i}
                            sx={{
                                borderRadius: 2,
                                px: 2,
                                background: isDark
                                    ? alpha(theme.palette.grey[800], 0.6)
                                    : alpha(theme.palette.grey[50], 0.8),
                                border: `1px solid ${alpha(theme.palette.text.primary, 0.15)}`,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
                                "&:before": { display: "none" }
                            }}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography sx={{ fontWeight: 600, fontSize: 17 }}>
                                    {faq.q}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Typography sx={{ opacity: 0.85, lineHeight: 1.6, fontSize: 15 }}>
                                    {faq.a}
                                </Typography>
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Box>

            </Container>
        </Box>
    );
}
