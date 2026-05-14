import React, { useState, useRef, useEffect } from "react";
import {
    Box,
    Container,
    Grid,
    Stack,
    Typography,
    useTheme,
    alpha,
} from "@mui/material";

import AlternateEmailRoundedIcon from "@mui/icons-material/AlternateEmailRounded";
import BusinessRoundedIcon from "@mui/icons-material/BusinessRounded";
import PhoneInTalkRoundedIcon from "@mui/icons-material/PhoneInTalkRounded";

const ContactRow = ({ icon, title, children }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    return (
        <Stack spacing={2} direction="row" alignItems="flex-start">
            <Box
                sx={{
                    minWidth: 56,
                    minHeight: 56,
                    borderRadius: "50%",
                    bgcolor: isDark
                        ? alpha(theme.palette.primary.main, 0.18)
                        : alpha(theme.palette.primary.light, 0.4),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: theme.palette.primary.main,
                    boxShadow: isDark ? "none" : "0 2px 8px rgba(0,0,0,0.08)",
                    backdropFilter: "blur(6px)",
                }}
            >
                {React.cloneElement(icon, { sx: { fontSize: 28 } })}
            </Box>

            <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 18, mb: 0.6 }}>
                    {title}
                </Typography>
                {children}
            </Box>
        </Stack>
    );
};

const ContactUs = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const sectionRef = useRef(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const obs = new IntersectionObserver(
            ([entry]) => setShow(entry.isIntersecting),
            { threshold: 0.35 }
        );
        if (sectionRef.current) obs.observe(sectionRef.current);
        return () => obs.disconnect();
    }, []);

    return (
        <Box
            ref={sectionRef}
            id="contact"
            sx={{
                py: { xs: 10, md: 18 },
                background: isDark
                    ? `
        radial-gradient(circle at 20% 20%, rgba(60,130,255,0.08), transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(60,130,255,0.05), transparent 65%),
        linear-gradient(135deg, #0A0F15 0%, #0E141C 45%, #101922 100%)
      `
                    : `
        radial-gradient(circle at 10% 20%, rgba(78,162,255,0.18), transparent 55%),
        radial-gradient(circle at 85% 75%, rgba(140,180,255,0.15), transparent 60%),
        linear-gradient(180deg, #F8FBFF 0%, #EEF4FF 45%, #FFFFFF 100%)
      `,
                transition: "background .4s ease",
                overflowX: "clip",
            }}
        >
            <Container maxWidth="lg">
                <Typography
                    className={`fade-up ${show ? "visible" : ""}`}
                    sx={{ fontSize: 14, fontWeight: 600, color: theme.palette.primary.main, mb: 1 }}
                >
                    Contact us
                </Typography>

                <Typography
                    className={`fade-up ${show ? "visible" : ""}`}
                    sx={{ fontSize: { xs: 32, md: 44 }, fontWeight: 800, mb: 2 }}
                >
                    Get in touch
                </Typography>

                <Typography
                    className={`fade-up ${show ? "visible" : ""}`}
                    sx={{ color: theme.palette.text.secondary, mb: 8, maxWidth: 540, lineHeight: 1.7 }}
                >
                    Our friendly team would love to hear from you. Let’s build something meaningful together.
                </Typography>

                <Grid container spacing={6} alignItems="flex-start" sx={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                }}>
                    <Grid
                        item
                        xs={12}
                        md={6}
                        className={`slide-left ${show ? "visible" : ""}`}
                    >
                        <Stack spacing={5} sx={{ py: { xs: 10, md: 10 } }}>
                            <ContactRow icon={<AlternateEmailRoundedIcon />} title="Email">
                                <Typography sx={{ fontWeight: 600, color: "primary.main", mt: 0.5 }}>
                                    nikhilb@hirexit.com
                                </Typography>
                            </ContactRow>

                            <ContactRow icon={<BusinessRoundedIcon />} title="Office">
                                <Typography sx={{ fontWeight: 600, color: "primary.main", mt: 0.5 }}>
                                    4th floor, Vision Flora commercials, <br />
                                    Office Number 419 & 419 A, Kunal Icon Rd, <br />
                                    next to HDFC Bank, Pimple Saudagar, <br />
                                    Pune, Maharashtra 411027
                                </Typography>
                            </ContactRow>

                            <ContactRow icon={<PhoneInTalkRoundedIcon />} title="Phone">
                                <Typography color="text.secondary">
                                    Monday - Friday, 9:30 AM – 6:30 PM IST
                                </Typography>
                                <Typography sx={{ fontWeight: 600, color: "primary.main", mt: 0.5 }}>
                                    +91 96895 91646
                                </Typography>
                            </ContactRow>
                        </Stack>
                    </Grid>

                    <Grid
                        item
                        xs={12}
                        md={6}
                        className={`slide-right ${show ? "visible" : ""}`}
                    >
                        <Box
                            sx={{
                                width: "100%",
                                height: { xs: 300, md: 420 },
                                borderRadius: 3,
                                overflow: "hidden",
                                boxShadow: isDark ? "none" : "0 6px 24px rgba(0,0,0,0.12)",
                                border: isDark ? "1px solid rgba(255,255,255,0.12)" : "none",
                            }}
                        >
                            <iframe
                                title="Office Map"
                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d4126.293873391435!2d73.79751007555753!3d18.59137068251602!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2b9dcc0e4d1e3%3A0xf8cb9d0a328751be!2sLAKSHMI%20ARTILIGENCE%20TECHNOLOGY%20SERVICES%20PRIVATE%20LIMITED!5e1!3m2!1sen!2sin!4v1763015634997!5m2!1sen!2sin"

                                style={{ border: 0, width: "750px", height: "100%" }}
                                allowFullScreen=""
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            ></iframe>
                        </Box>
                    </Grid>
                </Grid>
            </Container>

            {/* Animations */}
            <style>{`
        .fade-up, .slide-left, .slide-right {
          opacity: 0;
          transform: translateY(25px);
          transition: opacity .8s ease, transform .8s ease;
        }
        .slide-left { transform: translateX(-60px); }
        .slide-right { transform: translateX(60px); }

        .visible {
          opacity: 1 !important;
          transform: translateX(0) translateY(0) !important;
        }
      `}</style>
        </Box>
    );
};

export default ContactUs;
