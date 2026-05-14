import { useEffect, useMemo, useState } from 'react';
import { Avatar, Box, Container, Stack, Typography, alpha, useMediaQuery, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { TESTIMONIALS } from '../lib/constants';

const ROTATION_INTERVAL_MS = 4200;

const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: (index) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.45,
            delay: index * 0.06,
            ease: 'easeOut'
        }
    })
};

const Testimonials = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);

    useEffect(() => {
        if (isPaused) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % TESTIMONIALS.length);
        }, ROTATION_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [isPaused]);

    const visibleCount = isDesktop ? 3 : 1;

    const visibleTestimonials = useMemo(
        () => Array.from({ length: visibleCount }, (_, offset) => TESTIMONIALS[(activeIndex + offset) % TESTIMONIALS.length]),
        [activeIndex, visibleCount]
    );

    return (
        <Box
            id="testimonials"
            component="section"
            sx={{
                py: { xs: 7, md: 9 },
                position: 'relative',
                overflow: 'hidden',
                bgcolor: isDark ? '#06080d' : '#f7f8fb'
            }}
        >
            <Container sx={{ position: 'relative', zIndex: 1, maxWidth: '1320px !important' }}>
                <Box sx={{ width: 220, height: 1, mx: 'auto', mb: { xs: 4.5, md: 5.5 }, bgcolor: alpha(isDark ? '#f8fafc' : '#cfd8e3', 0.8) }} />

                <Box
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: { xs: 2, md: 2.25 }
                    }}
                >
                    {visibleTestimonials.map((testimonial, index) => (
                        <Box
                            key={`${testimonial.name}-${activeIndex}-${index}`}
                            component={motion.div}
                            custom={index}
                            variants={cardVariants}
                            initial="hidden"
                            animate="visible"
                            sx={{
                                position: 'relative',
                                minHeight: { xs: 220, md: 234 },
                                p: { xs: 2.35, md: 2.55 },
                                borderRadius: '24px',
                                bgcolor: '#1b1b1c',
                                border: `1px solid ${alpha('#ffffff', 0.08)}`,
                                boxShadow: '0 24px 60px -38px rgba(15, 23, 42, 0.5)',
                                overflow: 'hidden'
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: 18,
                                    right: 18,
                                    fontSize: { xs: '4.8rem', md: '5.5rem' },
                                    lineHeight: 0.7,
                                    fontWeight: 900,
                                    color: alpha('#ffffff', 0.08),
                                    letterSpacing: '-0.08em',
                                    pointerEvents: 'none'
                                }}
                            >
                                "
                            </Box>

                            <Stack spacing={2.1} sx={{ position: 'relative', zIndex: 1, height: '100%' }}>
                                <Stack direction="row" spacing={0.45}>
                                    {Array.from({ length: 5 }).map((_, starIndex) => (
                                        <Star
                                            key={`${testimonial.name}-star-${starIndex}`}
                                            size={13}
                                            fill={theme.palette.primary.main}
                                            color={theme.palette.primary.main}
                                            strokeWidth={1.9}
                                        />
                                    ))}
                                </Stack>

                                <Typography
                                    sx={{
                                        flex: 1,
                                        pr: { md: 4 },
                                        fontSize: { xs: '0.79rem', md: '0.82rem' },
                                        lineHeight: 1.68,
                                        color: alpha('#ffffff', 0.86)
                                    }}
                                >
                                    "{testimonial.quote}"
                                </Typography>

                                <Stack direction="row" spacing={1.1} alignItems="center">
                                    <Avatar
                                        sx={{
                                            width: 34,
                                            height: 34,
                                            bgcolor: alpha(theme.palette.primary.main, 0.18),
                                            color: '#ffffff',
                                            border: `1px solid ${alpha(theme.palette.primary.main, 0.38)}`,
                                            fontSize: '0.8rem',
                                            fontWeight: 900
                                        }}
                                    >
                                        {testimonial.initials}
                                    </Avatar>

                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffffff', lineHeight: 1.2 }}>
                                            {testimonial.name}
                                        </Typography>
                                        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: alpha('#ffffff', 0.62), lineHeight: 1.45 }}>
                                            {testimonial.role}, {testimonial.company}
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Stack>
                        </Box>
                    ))}
                </Box>

                <Stack direction="row" spacing={0.8} justifyContent="center" sx={{ mt: { xs: 3, md: 4 } }}>
                    {TESTIMONIALS.map((testimonial, index) => {
                        const isActive = index === activeIndex;

                        return (
                            <Box
                                key={`${testimonial.name}-dot`}
                                onClick={() => setActiveIndex(index)}
                                sx={{
                                    width: isActive ? 18 : 8,
                                    height: 8,
                                    borderRadius: 999,
                                    bgcolor: isActive ? theme.palette.primary.main : alpha('#94a3b8', 0.45),
                                    transition: 'all 0.24s ease',
                                    cursor: 'pointer'
                                }}
                            />
                        );
                    })}
                </Stack>
            </Container>
        </Box>
    );
};

export default Testimonials;
