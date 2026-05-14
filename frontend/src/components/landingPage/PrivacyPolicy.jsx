/* eslint-disable no-unused-vars */
import React, { useState, useRef } from "react";
import {
    Box,
    Typography,
    Container,
    Paper,
    Stack,
    List,
    ListItemButton,
    ListItemText,
    ListItemIcon,
    useTheme,
    alpha,
    Breadcrumbs,
    Link,
    Divider,
} from "@mui/material";
import {
    Shield,
    FileText,
    Lock,
    Mail,
    ChevronRight,
    ArrowRight,
    Globe,
    Database,
    UserCheck,
    Cookie,
    Baby,
    RefreshCw,
    MessageSquare,
} from "lucide-react";

const sections = [
    {
        id: "scope",
        title: "1. Scope and Applicability",
        icon: <Globe size={20} />,
        content: `This Privacy Policy governs the collection, use, disclosure, and protection of personal data obtained from users who access, interact with, or register on www.hirexit.ai or related services, including voice AI calls, interviews, analytics, and automation modules.`
    },
    {
        id: "collection",
        title: "2. Information We Collect",
        icon: <Database size={20} />,
        content: `We collect and process the following categories of information:

a. Personal Information
• Name, email, phone number, and designation
• Company or organization details (if applicable)
• Login credentials or authentication data

b. Candidate & Usage Data
• Uploaded resumes, chat logs, AI interview responses
• Browser, device, and network details (IP address, OS type, usage duration, etc.)
• AI interaction data used to optimize platform accuracy and recommendations

c. Analytics & Technical Data
• Activity logs for error diagnosis and service improvement
• Cookies and analytics data (via Google APIs or other services)`
    },
    {
        id: "purpose",
        title: "3. Purpose of Data Processing",
        icon: <UserCheck size={20} />,
        content: `Your data is collected and processed to:
• Deliver and manage Hirex REC services
• Enable recruiters to evaluate candidate performance
• Improve AI algorithms and user experience
• Communicate updates, offers, or support messages
• Comply with legal, regulatory, or contractual obligations

We do not use personal data for automated decision-making without human oversight.`
    },
    {
        id: "storage",
        title: "4. Data Storage and Retention",
        icon: <Lock size={20} />,
        content: `• Data is securely stored on encrypted servers located in India.
• We retain user data only for as long as necessary for service delivery or compliance with legal requirements.
• Upon request or account closure, personal data is deleted or anonymized.`
    },
    {
        id: "security",
        title: "5. Data Security",
        icon: <Shield size={20} />,
        content: `We employ industry-standard measures to protect data, including:
• End-to-end encryption and access control
• Regular vulnerability assessments
• Restricted access to authorized personnel only`
    },
    {
        id: "sharing",
        title: "6. Data Sharing and Disclosure",
        icon: <FileText size={20} />,
        content: `We do not sell, rent, or trade personal information.

Data may be shared only with:
• Verified third-party processors (cloud, analytics, or communication providers)
• Legal or regulatory authorities upon valid request
• Employers or recruiters, with explicit user consent

All third-party vendors are bound by confidentiality and data processing agreements.`
    },
    {
        id: "rights",
        title: "7. User Rights",
        icon: <UserCheck size={20} />,
        content: `Users have the right to:
• Access, correct, or delete personal data
• Withdraw consent or object to specific processing activities
• Request data portability (if applicable)
• File complaints related to misuse or security breaches

Requests may be made via info@hirexit.ai.`
    },
    {
        id: "cookies",
        title: "8. Cookies and Tracking",
        icon: <Cookie size={20} />,
        content: `Hirex REC uses cookies and similar technologies for authentication, analytics, and personalization.
Users can manage or disable cookies through browser settings.`
    },
    {
        id: "children",
        title: "9. Children’s Data",
        icon: <Baby size={20} />,
        content: `Hirex REC is not intended for individuals under 18 years of age.
We do not knowingly collect or process such data.`
    },
    {
        id: "changes",
        title: "10. Changes to This Policy",
        icon: <RefreshCw size={20} />,
        content: `We may update this Privacy Policy periodically.
All updates will be reflected on this page with an updated effective date.`
    },
    {
        id: "contact",
        title: "11. Contact Information",
        icon: <Mail size={20} />,
        content: `For any questions, requests, or complaints related to data privacy, contact:

Data Protection Officer
HIREX IT CONSULTANTS L.L.C. S.O.C (Dubai)

📧 info@hirexit.ai
🌐 www.hirexit.ai`
    }
];

export default function PrivacyPolicy() {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState(sections[0].id);
    const scrollContainerRef = useRef(null);

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element && scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({
                top: element.offsetTop - 20,
                behavior: "smooth"
            });
            setActiveTab(id);
        }
    };

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const container = scrollContainerRef.current;
        const scrollPosition = container.scrollTop + 100;

        for (const section of sections) {
            const element = document.getElementById(section.id);
            if (element) {
                const { offsetTop, offsetHeight } = element;
                if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
                    setActiveTab(section.id);
                    break;
                }
            }
        }
    };

    return (
        <Box
            sx={{
                width: "100%",
                height: { xs: "auto", md: "calc(100vh - 72px)" },
                overflow: "hidden",
                background: theme.palette.mode === 'dark' ? "#0f172a" : "#f8fafc",
                display: "flex",
                flexDirection: "column"
            }}
        >
            {/* COMPACT BREADCRUMBS & TITLE BAR */}
            <Box
                sx={{
                    px: 4,
                    py: 2,
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    bgcolor: alpha(theme.palette.background.paper, 0.8),
                    backdropFilter: "blur(20px)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    zIndex: 10
                }}
            >
                <Box>
                    <Breadcrumbs separator={<ChevronRight size={14} />} sx={{ mb: 0.5 }}>
                        <Link underline="hover" color="inherit" href="/" sx={{ fontSize: "0.85rem" }}>Home</Link>
                        <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "primary.main" }}>Privacy Policy</Typography>
                    </Breadcrumbs>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Data Protection & Privacy</Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        REVISED: FEB 2026
                    </Typography>
                </Stack>
            </Box>

            {/* PORTAL MAIN CONTENT */}
            <Box sx={{ flexGrow: 1, display: "flex", overflow: "hidden" }}>

                {/* LEFT FIXED SIDEBAR */}
                <Box
                    sx={{
                        display: { xs: "none", md: "block" },
                        width: "320px",
                        flexShrink: 0,
                        borderRight: `1px solid ${theme.palette.divider}`,
                        bgcolor: alpha(theme.palette.background.paper, 0.2),
                        overflowY: "auto",
                        p: 3,
                        '&::-webkit-scrollbar': { width: '4px' },
                        '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.divider, 0.5), borderRadius: '4px' }
                    }}
                >
                    <Typography variant="overline" sx={{ fontWeight: 800, color: "text.secondary", mb: 2, display: "block", letterSpacing: 2 }}>
                        PRIVACY SECTIONS
                    </Typography>
                    <List sx={{ pt: 0 }}>
                        {sections.map((sec) => (
                            <ListItemButton
                                key={sec.id}
                                onClick={() => scrollToSection(sec.id)}
                                sx={{
                                    borderRadius: 2,
                                    mb: 0.5,
                                    transition: "all 0.2s",
                                    backgroundColor: activeTab === sec.id ? alpha(theme.palette.primary.main, 0.08) : "transparent",
                                    color: activeTab === sec.id ? "primary.main" : "text.secondary",
                                    "&:hover": {
                                        backgroundColor: alpha(theme.palette.primary.main, 0.04),
                                        color: "primary.main",
                                    }
                                }}
                            >
                                <ListItemIcon sx={{ minWidth: 32, color: activeTab === sec.id ? "primary.main" : "inherit" }}>
                                    {sec.icon}
                                </ListItemIcon>
                                <ListItemText
                                    primary={sec.title.split('. ')[1]}
                                    primaryTypographyProps={{
                                        fontSize: "0.85rem",
                                        fontWeight: activeTab === sec.id ? 700 : 500
                                    }}
                                />
                                {activeTab === sec.id && <ArrowRight size={14} />}
                            </ListItemButton>
                        ))}
                    </List>

                    <Box sx={{ mt: 4, p: 2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.05), border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}` }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Shield size={16} /> Privacy First
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: 'block', mb: 1 }}>
                            We are committed to protecting your personal data under the DPDP Act and GDPR.
                        </Typography>
                        <Link href="mailto:info@hirexit.ai" sx={{ fontSize: "0.75rem", fontWeight: 700, textDecoration: "none" }}>Contact DPO</Link>
                    </Box>
                </Box>

                {/* RIGHT SCROLLABLE CONTENT */}
                <Box
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    sx={{
                        flexGrow: 1,
                        overflowY: "auto",
                        scrollBehavior: "smooth",
                        height: "100%",
                        position: "relative",
                        p: { xs: 2, md: 5 },
                        '&::-webkit-scrollbar': { width: '8px' },
                        '&::-webkit-scrollbar-thumb': { background: alpha(theme.palette.divider, 0.5), borderRadius: '4px' }
                    }}
                >
                    <Container maxWidth="md">
                        <Stack spacing={3} sx={{ pb: 10 }}>
                            {sections.map((sec, idx) => (
                                <Box key={sec.id} id={sec.id} sx={{ scrollMarginTop: "20px" }}>
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            p: { xs: 3, md: 4 },
                                            borderRadius: 3,
                                            border: `1px solid ${activeTab === sec.id ? alpha(theme.palette.primary.main, 0.3) : theme.palette.divider}`,
                                            background: theme.palette.mode === 'dark' ? alpha(theme.palette.background.paper, 0.4) : "#ffffff",
                                            transition: "all 0.3s",
                                            boxShadow: activeTab === sec.id ? `0 10px 30px ${alpha(theme.palette.primary.main, 0.05)}` : "none"
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                                            <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                                                {sec.icon}
                                            </Box>
                                            <Typography variant="h6" sx={{ fontWeight: 800, color: "text.primary" }}>
                                                {sec.title}
                                            </Typography>
                                        </Box>
                                        <Typography
                                            variant="body1"
                                            sx={{
                                                whiteSpace: "pre-line",
                                                lineHeight: 1.7,
                                                color: "text.secondary",
                                                fontSize: "0.95rem"
                                            }}
                                        >
                                            {sec.content}
                                        </Typography>
                                    </Paper>
                                </Box>
                            ))}

                            <Divider sx={{ my: 4 }} />

                            <Box sx={{ textAlign: 'center', py: 4 }}>
                                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                    Your privacy is our priority. For any data-related queries, email our DPO at info@hirexit.ai.
                                </Typography>
                            </Box>
                        </Stack>
                    </Container>
                </Box>
            </Box>
        </Box>
    );
}
