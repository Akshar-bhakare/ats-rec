import React from "react";
import { Box, Container, Grid, Typography, Stack, useTheme, alpha } from "@mui/material";
import {
    ClipboardList,
    Mic,
    Workflow,
    CalendarSearch,
    Code2,
    BarChart3,
    Users,
    PlugZap
} from "lucide-react";

const features = [
    { icon: <ClipboardList />, title: "Unified Talent Operating System", desc: "A single platform handling screening, interviewing, assessments,  and data banking end-to-end." },
    { icon: <Mic />, title: "AI Voice Screening & Interview Automation", desc: "Automated voice-based candidate screening with evaluation scoring to cut recruiter workload by up to 70%." },
    { icon: <Workflow />, title: "Smart ATS with Customizable Hiring Pipelines", desc: "Modular workflow stages tailored per job, company, or recruiter." },
    { icon: <CalendarSearch />, title: "Deep Candidate Data Bank + Boolean Search", desc: "A continuously growing talent repository with advanced search, enabling instant re-hiring and zero wasted leads." },
    { icon: <Code2 />, title: "End-To-End Assessment Suite", desc: "Coding rounds, MCQ tests, psychometric, HR interview, plagiarism detection, scoring analytics, and playback in one place." },
    { icon: <BarChart3 />, title: "Real-Time Dashboards & Hiring Intelligence", desc: "From recruiter performance to conversion ratios — every hiring metric in one dynamic, real-time dashboard." },
    { icon: <Users />, title: "Seamless Collaboration & Communication Hub", desc: "Calendar sync, automated reminders, feedback scorecards, role-based access for recruiters, HR, interviewers, and clients." },
    { icon: <PlugZap />, title: "Plug-and-Play API & Webhook Integrations", desc: "Connect effortlessly with HRMS/CRM/Payroll/ATS systems for enterprise onboarding and workforce scalability." }
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

export default function FeaturesSection() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [index, setIndex] = React.useState(0);
    const sectionRef = React.useRef(null);
    const [inView, setInView] = React.useState(false);

    React.useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => setInView(entry.isIntersecting),
            { threshold: 0.25 }
        );
        if (sectionRef.current) observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % leftSlides.length);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <Box
            ref={sectionRef}
            sx={{
                py: { xs: 8, md: 14 },
                background: theme.palette.background.default,
                color: theme.palette.text.primary,
                transition: "background 0.3s ease",
                overflowX: "clip",
            }}
        >
            <Container maxWidth="lg">
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: { xs: "column", md: "row" },
                        gap: 10,
                        alignItems: { md: "center" }
                    }}
                >

                    {/* LEFT TEXT WITH SCROLL-IN */}
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: 210,
                            opacity: inView ? 1 : 0,
                            transform: inView ? "translateX(0)" : "translateX(-60px)",
                            transition: "all 0.9s ease"
                        }}
                    >
                        <Box key={index} className="slide-block">
                            <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 2, color: theme.palette.text.secondary }}>
                                {leftSlides[index].eyebrow}
                            </Typography>

                            <Typography sx={{ fontSize: { xs: 34, md: 46 }, fontWeight: 800, lineHeight: 1.2, mb: 2 }}>
                                {leftSlides[index].titleLine1}
                                <br />
                                {leftSlides[index].titleLine2}
                            </Typography>

                            <Typography sx={{ opacity: 0.8, fontSize: 17, maxWidth: 450 }}>
                                {leftSlides[index].desc}
                            </Typography>
                        </Box>
                    </Box>

                    {/* RIGHT FEATURES WITH SCROLL-IN */}
                    <Box
                        sx={{
                            flex: 1,
                            opacity: inView ? 1 : 0,
                            transform: inView ? "translateX(0)" : "translateX(60px)",
                            transition: "all 0.9s ease"
                        }}
                    >
                        <Grid container spacing={4}>
                            {features.map((f, i) => (
                                <Grid item xs={12} sm={6} key={i}>
                                    <Stack direction="row" spacing={2} alignItems="center" sx={{ minHeight: 72 }}>
                                        <Box
                                            sx={{
                                                width: 54,
                                                height: 54,
                                                borderRadius: 2,
                                                background: isDark
                                                    ? alpha(theme.palette.primary.light, 0.14)
                                                    : alpha(theme.palette.primary.light, 0.25),
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                color: theme.palette.primary.main,
                                                flexShrink: 0,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    "& svg": {
                                                        width: "100%",
                                                        height: "100%",
                                                        strokeWidth: 2.2,
                                                    }
                                                }}
                                            >
                                                {f.icon}
                                            </Box>
                                        </Box>


                                        <Stack spacing={0.4}>
                                            <Typography sx={{ fontWeight: 600, fontSize: 16 }}>{f.title}</Typography>
                                            <Typography sx={{ fontSize: 14, opacity: 0.7, lineHeight: 1.4 }}>{f.desc}</Typography>
                                        </Stack>
                                    </Stack>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                </Box>
            </Container>
        </Box>
    );
}
