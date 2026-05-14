import { useEffect, useRef, useState } from 'react';
import { Box, Chip, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

const HIRING_INSIGHTS = [
    {
        value: 85,
        suffix: '%',
        description: 'of employers say AI boosts hiring efficiency'
    },
    {
        value: 64,
        suffix: '%',
        description: 'more roles are filled with AI-driven recruitment'
    },
    {
        value: 70,
        suffix: '%',
        description: 'of recruiters see better-quality candidates with AI tools'
    }
];

const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: (index) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.55,
            ease: 'easeOut',
            delay: index * 0.08
        }
    })
};

const InsightMetric = ({ stat, index, isVisible, isDark }) => {
    const theme = useTheme();
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
        if (!isVisible) {
            return undefined;
        }

        let frameId;
        const duration = 1400;
        const startTime = performance.now();

        const animate = (timestamp) => {
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(Math.round(stat.value * easedProgress));

            if (progress < 1) {
                frameId = window.requestAnimationFrame(animate);
            }
        };

        frameId = window.requestAnimationFrame(animate);

        return () => window.cancelAnimationFrame(frameId);
    }, [isVisible, stat.value]);

    return (
        <Box
            component={motion.div}
            custom={index}
            variants={cardVariants}
            initial="hidden"
            animate={isVisible ? 'visible' : 'hidden'}
            sx={{
                position: 'relative',
                px: { xs: 2.4, md: 2.8 },
                py: { xs: 2.2, md: 2.6 },
                borderRadius: '28px',
                bgcolor: isDark ? alpha('#0f172a', 0.76) : '#ffffff',
                border: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.08 : 0.92)}`,
                boxShadow: isDark
                    ? '0 18px 48px -32px rgba(2, 6, 23, 0.85)'
                    : '0 24px 56px -36px rgba(15, 23, 42, 0.18)',
                overflow: 'hidden'
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `radial-gradient(circle at 50% 0%, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 58%)`,
                    pointerEvents: 'none'
                }}
            />

            <Stack spacing={1.2} sx={{ position: 'relative', zIndex: 1 }}>
                <Typography
                    sx={{
                        fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                        fontSize: { xs: '2.2rem', md: '3.1rem' },
                        lineHeight: 0.98,
                        letterSpacing: '-0.06em',
                        fontWeight: 900,
                        color: theme.palette.primary.main
                    }}
                >
                    {displayValue}
                    {stat.suffix}
                </Typography>

                <Typography
                    sx={{
                        maxWidth: 280,
                        fontSize: { xs: '0.9rem', md: '0.96rem' },
                        lineHeight: 1.55,
                        color: isDark ? alpha('#f8fafc', 0.82) : '#1f2a3d',
                        fontWeight: 600
                    }}
                >
                    {stat.description}
                </Typography>
            </Stack>
        </Box>
    );
};

const Features = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const sectionRef = useRef(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const sectionNode = sectionRef.current;

        if (!sectionNode) {
            return undefined;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            {
                threshold: 0.35
            }
        );

        observer.observe(sectionNode);

        return () => observer.disconnect();
    }, []);

    return (
        <Box
            id="features"
            ref={sectionRef}
            component="section"
            sx={{
                py: { xs: 7, md: 9 },
                position: 'relative',
                overflow: 'hidden',
                bgcolor: isDark ? '#05070b' : '#f7f8fb'
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        radial-gradient(circle at 18% 22%, ${alpha(theme.palette.primary.main, 0.07)} 0%, transparent 24%),
                        radial-gradient(circle at 82% 74%, ${alpha(theme.palette.secondary.main, 0.06)} 0%, transparent 24%)
                    `,
                    pointerEvents: 'none'
                }}
            />

            <Container sx={{ position: 'relative', zIndex: 1, maxWidth: '1320px !important' }}>
                <Stack spacing={1.4} alignItems="center" textAlign="center" sx={{ mb: { xs: 4.5, md: 6 } }}>
                    {/* <Chip
                        label="HIRING INSIGHTS"
                        sx={{
                            height: 36,
                            px: 1.15,
                            borderRadius: 999,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            color: 'primary.main',
                            fontWeight: 900,
                            letterSpacing: '0.12em'
                        }}
                    /> */}

                    <Typography
                        sx={{
                            fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                            fontSize: { xs: '2.2rem', md: '3.3rem' },
                            lineHeight: { xs: 1.08, md: 1.02 },
                            letterSpacing: '-0.05em',
                            fontWeight: 900,
                            color: 'text.primary'
                        }}
                    >
                        Hiring Insights
                    </Typography>

                    {/* <Typography
                        sx={{
                            maxWidth: 760,
                            color: 'text.secondary',
                            fontSize: { xs: '0.98rem', md: '1.08rem' },
                            lineHeight: 1.75
                        }}
                    >
                        The numbers below animate as the section enters view and highlight how AI-supported recruiting is improving speed, fill rates, and candidate quality.
                    </Typography> */}
                </Stack>

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: { xs: 2, md: 2.5 }
                    }}
                >
                    {HIRING_INSIGHTS.map((stat, index) => (
                        <InsightMetric
                            key={stat.description}
                            stat={stat}
                            index={index}
                            isVisible={isVisible}
                            isDark={isDark}
                        />
                    ))}
                </Box>
            </Container>
        </Box>
    );
};

export default Features;
