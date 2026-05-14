// File: src/components/landingPage/Footer.jsx
import React from 'react';
import {
    Box,
    Container,
    Grid,
    Stack,
    Typography,
    Divider,
    IconButton,
    Link as MUILink,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import { Link } from 'react-router-dom';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import XIcon from '@mui/icons-material/X';
import GitHubIcon from '@mui/icons-material/GitHub';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import MUIButton from '../MUI/commonUI/MUIButton';

const Footer = () => {
    const year = new Date().getFullYear();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const textOnDark = theme.palette.common.white;
    const radialAccent = alpha(theme.palette.primary.light, isDark ? 0.35 : 0.25);
    const ctaGradient = `radial-gradient(700px 240px at 10% 0%, ${radialAccent}, transparent 60%), linear-gradient(90deg, ${alpha(theme.palette.primary.dark, 0.92)} 0%, ${alpha(theme.palette.primary.main, 0.9)} 100%)`;
    const ctaBorder = `1px solid ${alpha(textOnDark, 0.12)}`;
    const deepStart = isDark ? theme.palette.background.paper : theme.palette.grey[900];
    const deepEnd = isDark ? theme.palette.background.default : theme.palette.grey[900];
    const mainFooterBackground = `linear-gradient(180deg, ${alpha(deepStart, 0.98)} 0%, ${alpha(deepEnd, 0.98)} 100%)`;
    const linkColor = alpha(textOnDark, 0.75);
    const mutedText = alpha(textOnDark, 0.65);
    const socialIconColor = textOnDark;
    // const inputBg = alpha(textOnDark, 0.08);
    // const inputPlaceholder = alpha(textOnDark, 0.55);

    return (
        <Box component="footer" sx={{ mt: { xs: 8, md: 12 } }}>

            {/* CTA BAR */}
            <Box
                sx={{
                    py: { xs: 4, md: 5 },
                    color: textOnDark,
                    background: ctaGradient,
                    borderTop: ctaBorder,
                    borderBottom: ctaBorder,
                }}
            >
                <Container maxWidth="lg">
                    <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" justifyContent="space-between" spacing={2}>
                        <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, maxWidth: 720 }}>
                            Ready to turn every call into outcomes?
                        </Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
                            {/* <MUIButton
                                component={Link}
                                to="/landing-page"
                                size="large"
                                variant="contained"
                                endIcon={<ArrowForwardRoundedIcon />}
                                sx={{
                                    bgcolor: theme.palette.primary.main,
                                    fontWeight: 700,
                                    borderRadius: 2,
                                    px: 3,
                                    py: 1.25,
                                    boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.18)}`,
                                    '&:hover': { bgcolor: theme.palette.primary.dark },
                                }}
                            >
                                Book a demo
                            </MUIButton> */}

                            <Stack direction="row" spacing={1}>
                                <IconButton aria-label="LinkedIn" href="https://www.linkedin.com/company/ai-selekt/" target="_blank" sx={{ color: socialIconColor }}>
                                    <LinkedInIcon />
                                </IconButton>
                                <IconButton aria-label="X" href="https://twitter.com" target="_blank" sx={{ color: socialIconColor }}>
                                    <XIcon />
                                </IconButton>
                                <IconButton aria-label="GitHub" href="https://github.com" target="_blank" sx={{ color: socialIconColor }}>
                                    <GitHubIcon />
                                </IconButton>
                            </Stack>
                        </Stack>
                    </Stack>
                </Container>
            </Box>

            {/* MAIN FOOTER */}
            <Box
                sx={{
                    background: mainFooterBackground,
                    color: textOnDark,
                    pt: { xs: 6, md: 8 },
                    pb: { xs: 6, md: 8 },
                }}
            >
                <Container maxWidth="lg">
                    <Grid container spacing={4}>

                        {/* Brand */}
                        <Grid item xs={12} md={4}>
                            <Typography sx={{ fontWeight: 900, fontSize: 22, mb: 1 }}>Hirex REC</Typography>
                            <Typography variant="body2" sx={{ color: linkColor, mb: 2 }}>
                                End-to-end recruitment platform with AI calling, assessments, SLAs, and ATS integrations.
                            </Typography>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <EmailRoundedIcon sx={{ color: linkColor }} />
                                <Typography variant="body2" sx={{ color: linkColor }}>
                                    info@hirexit.com
                                </Typography>
                            </Stack>
                        </Grid>

                        {/* Categories */}
                        {/* <Grid item xs={12} sm={6} md={2.5}>
                            <SectionTitle>Platform</SectionTitle>
                            <FooterLink to="/landing-page">AI Phone Calls</FooterLink>
                            <FooterLink to="/landing-page">Real-Time Assist</FooterLink>
                            <FooterLink to="/landing-page">Quality Assurance</FooterLink>
                            <FooterLink to="/landing-page">Voice of Customer</FooterLink>
                            <FooterLink to="/landing-page">Agent Coaching</FooterLink>
                            <FooterLink to="/landing-page">LMS</FooterLink>
                        </Grid>

                        <Grid item xs={12} sm={6} md={2.5}>
                            <SectionTitle>Solutions</SectionTitle>
                            <FooterLink to="/landing-page">Hiring Teams</FooterLink>
                            <FooterLink to="/landing-page">Panelists</FooterLink>
                            <FooterLink to="/landing-page">Agencies</FooterLink>
                            <FooterLink to="/landing-page">Client Admins</FooterLink>
                            <FooterLink to="/landing-page">Ultra Admin</FooterLink>
                        </Grid>

                        <Grid item xs={12} sm={6} md={1.5}>
                            <SectionTitle>Resources</SectionTitle>
                            <FooterLink to="/landing-page">Templates</FooterLink>
                            <FooterLink to="/landing-page">Docs & API</FooterLink>
                            <FooterLink to="/landing-page">Security</FooterLink>
                            <FooterLink to="/landing-page">Status</FooterLink>
                        </Grid>

                        <Grid item xs={12} sm={6} md={1.5}>
                            <SectionTitle>Company</SectionTitle>
                            <FooterLink to="/landing-page">About</FooterLink>
                            <FooterLink to="/landing-page">Careers</FooterLink>
                            <FooterLink to="/landing-page">Contact</FooterLink>
                        </Grid> */}
                    </Grid>

                    <Divider sx={{ my: 4, borderColor: alpha(textOnDark, 0.12) }} />

                    {/* BOTTOM BAR */}
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'flex-start', sm: 'center' }}
                        justifyContent="space-between"
                    >
                        <Typography variant="body2" sx={{ color: mutedText }}>
                            © {year} Lakshmi Artiligence Technology Service Private Limited. All rights reserved.
                        </Typography>

                        <Stack direction="row" spacing={2} flexWrap="wrap">
                            {/* UPDATED LINKS */}
                            <MiniLink to="/privacypolicy/"><u>Privacy Policy</u></MiniLink>
                            <MiniLink to="/termscondition/"><u>Terms & Condition</u></MiniLink>
                        </Stack>
                    </Stack>
                </Container>
            </Box>
        </Box>
    );
};

const SectionTitle = ({ children }) => {
    const theme = useTheme();
    return (
        <Typography sx={{ fontWeight: 800, mb: 1.5, color: theme.palette.common.white }}>
            {children}
        </Typography>
    );
};

const FooterLink = ({ to, children }) => {
    const theme = useTheme();
    return (
        <MUILink
            component={Link}
            to={to}
            underline="none"
            sx={{
                display: 'block',
                color: alpha(theme.palette.common.white, 0.75),
                '&:hover': { color: theme.palette.primary.light },
                mb: 0.75,
            }}
        >
            {children}
        </MUILink>
    );
};

const MiniLink = ({ to, children }) => {
    const theme = useTheme();
    return (
        <MUILink
            component={Link}
            to={to}
            underline="hover"
            sx={{
                textDecoration: "none",
                color: alpha(theme.palette.common.white, 0.7),
                '&:hover': { color: theme.palette.primary.light }
            }}
        >
            {children}
        </MUILink>
    );
};

export default Footer;
