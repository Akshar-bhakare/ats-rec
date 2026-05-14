import React from 'react';
import {
    Box,
    Container,
    Grid,
    Typography,
    Stack,
    Chip,
    useTheme,
    Button,
} from '@mui/material';

import { motion } from 'framer-motion';
import { keyframes, alpha } from '@mui/system';
import bgImage from '../../assets/background.png';
import FakePlivoCall from '../CallSimulation/FakePlivoCall';
import CallScreenMobile from '../CallSimulation/DemoMobileCall';
import Tooltip from "@mui/material/Tooltip";


// NEW: animated background
import LiquidEther from './LiquidEther.jsx';
import TextType from '../../assets/TextType.jsx';
import { Link } from 'react-router-dom';
import EastRoundedIcon from "@mui/icons-material/EastRounded";

const floatY = keyframes`
  0% { transform: translateY(0px) }
  50% { transform: translateY(-12px) }
  100% { transform: translateY(0px) }
`;

const fadeInUp = {
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6 } },
};

const Hero = () => {
    const theme = useTheme();
    const headlineGradient = `linear-gradient(90deg, ${theme.palette.primary.light}, ${theme.palette.primary.main} 60%, ${theme.palette.primary.dark} 100%)`;

    return (
        <Box
            sx={{
                position: 'relative',
                overflow: 'hidden',
                pt: { xs: 10, md: 24 },
                pb: { xs: 10, md: 24 },
                minHeight: { md: 720 },
                // subtle image texture behind the fluid
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: `url(${bgImage})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    opacity: 0.12,
                    zIndex: 0,
                    pointerEvents: 'none',
                },
            }}
        >
            {/* Liquid Ether background */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    pointerEvents: 'none', // clicks still go to your UI; animation uses window events
                    WebkitMaskImage:
                        'radial-gradient(120% 120% at 60% 20%, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 100%)',
                    maskImage:
                        'radial-gradient(120% 120% at 60% 20%, rgba(0,0,0,1) 35%, rgba(0,0,0,0) 100%)',
                }}
            >
                <LiquidEther
                    colors={['#5227FF', '#FF9FFC', '#B19EEF']}
                    mouseForce={20}
                    cursorSize={100}
                    isViscous={false}
                    viscous={30}
                    iterationsViscous={32}
                    iterationsPoisson={32}
                    resolution={0.6}
                    isBounce={false}
                    autoDemo
                    autoSpeed={0.5}
                    autoIntensity={2.2}
                    takeoverDuration={0.25}
                    autoResumeDelay={3000}
                    autoRampDuration={0.6}
                    style={{ width: '100%', height: '100%' }}
                />
            </Box>

            {/* glow orbs for depth */}
            <Box
                sx={{
                    position: 'absolute',
                    width: { xs: 240, sm: 300, md: 340 },
                    height: { xs: 240, sm: 300, md: 340 },
                    top: -60,
                    left: -80,
                    borderRadius: '50%',
                    background: `radial-gradient(closest-side, ${alpha(
                        theme.palette.primary.main,
                        0.35
                    )}, transparent)`,
                    filter: 'blur(20px)',
                    zIndex: 1,
                    pointerEvents: 'none',
                }}
            />

            <Box
                sx={{
                    position: 'absolute',
                    width: { xs: 280, sm: 340, md: 380 },
                    height: { xs: 280, sm: 340, md: 380 },
                    right: -80,
                    top: 120,
                    borderRadius: '50%',
                    background: `radial-gradient(closest-side, ${alpha(
                        theme.palette.primary.light,
                        0.25
                    )}, transparent)`,
                    filter: 'blur(22px)',
                    zIndex: 1,
                    pointerEvents: 'none',
                    animation: `${floatY} 12s ease-in-out infinite`,
                }}
            />

            {/* subtle glass gradient overlay for readability */}
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `linear-gradient(180deg, ${alpha('#0B1020', 0.20)} 0%, ${alpha(
                        theme.palette.background.default,
                        0.04
                    )} 40%, transparent 70%)`,
                    zIndex: 2,
                    pointerEvents: 'none',
                }}
            />

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 3 }}>
                <Grid
                    container
                    spacing={6}
                    alignItems="center"
                    sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' } }}
                >
                    {/* LEFT: Copy */}
                    <Grid
                        item
                        xs={12}
                        sm={8}
                        md={8}
                        lg={8}
                        component={motion.div}
                        variants={fadeInUp}
                        initial="hidden"
                        animate="show"
                        sx={{
                            minWidth: 0,
                            position: 'relative',
                            pr: { md: 4, lg: 8 },
                        }}
                    >
                        <Stack direction="row" spacing={1.2} sx={{ mb: 1.5 }}>
                            <Chip size="small" variant="outlined" color="primary" label="AI SELEKT" sx={{ fontWeight: 700 }} />
                            <Chip size="small" variant="outlined" label="AI Voice" sx={{ borderColor: alpha(theme.palette.primary.main, 0.4) }} />
                            <Chip size="small" variant="outlined" label="ATS Ready" sx={{ borderColor: alpha(theme.palette.primary.main, 0.4) }} />
                        </Stack>

                        <Typography
                            component="h1"
                            sx={{
                                fontSize: { xs: 36, sm: 46, md: 58, lg: 60 },
                                fontWeight: 900,
                                lineHeight: 1.18,
                                letterSpacing: -0.5,
                                backgroundImage: headlineGradient,
                                WebkitBackgroundClip: 'text',
                                color: 'transparent',
                                maxWidth: { xs: '100%', sm: 2000 },
                                mb: 2.5,
                                // display: 'inline-block',
                            }}
                            gutterBottom
                        >
                            <TextType
                                text={[
                                    "From Hello to Hired & Beyond",
                                    "Reduce Your Hiring Cost by 70%",
                                ]}
                                typingSpeed={75}
                                pauseDuration={1500}
                                showCursor={true}
                                cursorCharacter="|"
                                className="hero-headline"
                            />
                        </Typography>

                        <Typography
                            variant="h6"
                            color="text.secondary"
                            sx={{ maxWidth: 900, mb: 3 }}
                            paragraph
                        >
                            Hirex REC is a next-generation AI recruitment platform that automates hiring
                            from screening to selection. Build global teams faster, smarter, and without the chaos.
                        </Typography>

                        <Tooltip title="Free Boolean Search" arrow>
                            <Button
                                size="medium"
                                component={Link}
                                to="/boolean/search/"
                                disableRipple
                                sx={{
                                    width: "50%",
                                    backgroundColor: "#0D1268",
                                    color: "#fff",
                                    borderRadius: "50px",
                                    padding: "10px 28px",
                                    textTransform: "none",
                                    fontWeight: 600,
                                    fontSize: "15px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: "16px",
                                    minHeight: "48px",
                                    transition: "background 0.3s ease",

                                    "&:hover": { backgroundColor: "#0B0F58" },

                                    "& .arrow-box": {
                                        background: "#fff",
                                        padding: "6px 14px",
                                        borderRadius: "40px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        border: "2px solid rgba(255,255,255,0.25)",
                                        transition: "transform 0.3s ease",
                                    },

                                    "&:hover .arrow-box": {
                                        transform: "translateX(5px)",
                                    },

                                    "& .arrow": {
                                        color: "#0D1268",
                                        fontSize: "19px",
                                        opacity: 0.9,
                                        transform: "translateX(0)",
                                        transition: "transform 0.3s ease",
                                    },

                                    "&:hover .arrow": {
                                        transform: "translateX(3px)",
                                    },
                                }}
                            >
                                Boolean Search
                                <Box className="arrow-box">
                                    <EastRoundedIcon className="arrow" />
                                </Box>
                            </Button>
                        </Tooltip>


                    </Grid>

                    {/* RIGHT: Phone demo (no extra box behind) */}
                    <Grid
                        item
                        xs={12}
                        sm={4}
                        md={4}
                        lg={4}
                        component={motion.div}
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        sx={{
                            minWidth: 0,
                            width: '100%',
                            display: 'flex',
                            justifyContent: { xs: 'center', sm: 'center', md: 'flex-end' },
                            position: 'relative',
                            zIndex: 3,
                        }}
                    >
                        <Box sx={{ position: 'relative', zIndex: 2 }}>
                            <FakePlivoCall CallScreen={CallScreenMobile} />
                        </Box>
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default Hero;
