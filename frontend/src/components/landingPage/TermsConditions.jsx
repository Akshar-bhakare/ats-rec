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
// import { motion, AnimatePresence } from "framer-motion";
import {
    Shield,
    FileText,
    Lock,
    Mail,
    ChevronRight,
    Clock,
    ArrowRight,
    Scale,
    Handshake,
    Key,
    Ban,
    Brain,
    CreditCard,
    XCircle,
    AlertCircle,
    MapPin,
    RefreshCw,
    Info,
    Globe,
    MessageSquare,
    Search,
} from "lucide-react";

const sections = [
    {
        id: "company",
        title: "1. Company Information",
        icon: <Info size={20} />,
        content: `HIREX IT CONSULTANTS L.L.C. S.O.C (Dubai)
Registered Address:
Dubai, United Arab Emirates

📧 info@hirexit.ai
🌐 www.hirexit.ai`
    },
    {
        id: "overview",
        title: "2. Platform Overview",
        icon: <Globe size={20} />,
        content: `Hirex REC is a SaaS-based AI recruitment automation platform offering AI voice interviews, chat screening, and analytics. The platform helps recruiters automate candidate evaluation using AI-driven systems and Google APIs. Users may create accounts for full access, while guests receive limited access.`
    },
    {
        id: "acceptance",
        title: "3. Acceptance of Terms",
        icon: <Handshake size={20} />,
        content: `By using Hirex REC, you:
• Confirm you are 18 years or older or legally authorized.
• Agree to comply with these Terms and our Privacy Policy.
• Acknowledge that we may modify or update these Terms at any time, with continued use indicating acceptance of the latest version.`
    },
    {
        id: "registration",
        title: "4. Account Registration",
        icon: <Key size={20} />,
        content: `• Users must create an account to access premium recruitment automation features.
• You agree to provide accurate and updated information.
• You are responsible for safeguarding your credentials.
• Unauthorized use, false data, or misuse may result in termination.

Guest users may explore limited features but cannot access AI analytics or automation tools.`
    },
    {
        id: "use",
        title: "5. Permitted Use",
        icon: <Ban size={20} />,
        content: `Users agree to use Hirex REC only for lawful and ethical recruitment and business purposes.
You must not:
• Engage in fraudulent or malicious activities.
• Reverse-engineer or duplicate the platform.
• Upload illegal, misleading, or harmful content.
• Use the platform to harass, spam, or discriminate.

Violations may result in immediate account suspension or legal action.`
    },
    {
        id: "ip",
        title: "6. Intellectual Property",
        icon: <Shield size={20} />,
        content: `• All intellectual property rights in Hirex REC belong to HIREX IT CONSULTANTS L.L.C. S.O.C (Dubai).
• The platform uses Google APIs and licensed technologies, but proprietary development is owned solely by the Company.
• Unauthorized copying or modification of any platform materials is strictly prohibited.`
    },
    {
        id: "ai",
        title: "7. AI Content Disclaimer",
        icon: <Brain size={20} />,
        content: `Hirex REC generates automated responses and analytics using AI.
While designed for high accuracy, AI outputs may contain errors.

• AI-generated data is for informational support only.
• The Company is not liable for business decisions based on AI-generated content.`
    },
    {
        id: "liability",
        title: "8. Limitation of Liability",
        icon: <AlertCircle size={20} />,
        content: `To the fullest extent permitted by law:
• The Company is not liable for indirect or consequential damages.
• The platform is provided "as is" with no express or implied warranties.
• Users are responsible for verifying AI outputs before decisions.`
    },
    {
        id: "payment",
        title: "9. Payment & Subscription",
        icon: <CreditCard size={20} />,
        content: `If paid plans are offered:
• Users must pay subscription fees via secure payment providers.
• Fees are non-refundable unless required by law.
• Pricing and features may change with prior notice.`
    },
    {
        id: "termination",
        title: "10. Termination",
        icon: <XCircle size={20} />,
        content: `We may:
• Suspend or terminate accounts violating these Terms.
• Restrict access or discontinue services at any time.

Upon termination, access to all services and data ceases immediately.`
    },
    {
        id: "updates",
        title: "11. Updates & Modifications",
        icon: <RefreshCw size={20} />,
        content: `We may revise these Terms periodically. The latest version will always be available on our website.`
    },
    {
        id: "law",
        title: "12. Governing Law",
        icon: <Scale size={20} />,
        content: `These Terms are governed by the laws of India.
Disputes fall under the jurisdiction of courts in Pune, Maharashtra.`
    },
    {
        id: "dispute",
        title: "13. Dispute Resolution",
        icon: <MapPin size={20} />,
        content: `Disputes shall first be attempted to resolve amicably.
If unresolved, disputes will proceed to binding arbitration under the Arbitration and Conciliation Act, 1996, in Pune, Maharashtra.`
    },
    {
        id: "contact",
        title: "14. Contact Info",
        icon: <Mail size={20} />,
        content: `HIREX IT CONSULTANTS L.L.C. S.O.C (Dubai)
📧 info@hirexit.ai
🌐 www.hirexit.ai`
    }
];

export default function TermsConditions() {
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
                background: theme.palette.mode === 'dark'
                    ? "#0f172a"
                    : "#f8fafc",
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
                        <Typography sx={{ fontSize: "0.85rem", fontWeight: 600, color: "primary.main" }}>Terms & Conditions</Typography>
                    </Breadcrumbs>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>Terms of Service</Typography>
                </Box>
                <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                        LATEST VERSION: FEB 2026
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
                        DOCUMENT SECTIONS
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
                            <MessageSquare size={16} /> Need help?
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary", display: 'block', mb: 1 }}>
                            Contact our legal team for any clarifications.
                        </Typography>
                        <Link href="mailto:info@hirexit.ai" sx={{ fontSize: "0.75rem", fontWeight: 700, textDecoration: "none" }}>info@hirexit.ai</Link>
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
                            {sections.map((sec) => (
                                <Box
                                    key={sec.id}
                                    id={sec.id}
                                    sx={{
                                        scrollMarginTop: "20px"
                                    }}
                                >
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
                                    Last updated: February 18, 2026. This document is subject to periodic updates.
                                </Typography>
                            </Box>
                        </Stack>
                    </Container>
                </Box>
            </Box>
        </Box>
    );
}
