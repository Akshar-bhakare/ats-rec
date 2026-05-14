import { Box, Button, Chip, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const HERO_HEADLINE_FONT = '"Inter", "Segoe UI", sans-serif';

const floatingCardSx = (theme, isDark) => ({
    position: 'absolute',
    zIndex: 2,
    borderRadius: { xs: '24px', md: '26px' },
    border: `1px solid ${alpha(isDark ? '#f8fafc' : '#d9e2ec', isDark ? 0.12 : 0.9)}`,
    bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.86 : 0.92),
    boxShadow: isDark
        ? '0 28px 70px -42px rgba(15, 23, 42, 0.85)'
        : '0 24px 60px -38px rgba(15, 23, 42, 0.32)',
    backdropFilter: 'blur(18px)'
});

const floatingMotionSx = (index, rotate = '0deg') => {
    const animationName = `heroFloat${index}`;
    const duration = `${6.2 + (index * 0.55)}s`;
    const delay = `${index * 0.35}s`;
    const restingTransform = `translate3d(0, 0, 0) rotate(${rotate})`;
    const raisedTransform = `translate3d(0, -12px, 0) rotate(${rotate})`;

    return {
        transform: restingTransform,
        transformOrigin: 'center',
        willChange: 'transform',
        animation: `${animationName} ${duration} ease-in-out ${delay} infinite`,
        transition: 'transform 220ms ease, box-shadow 220ms ease',
        [`@keyframes ${animationName}`]: {
            '0%': { transform: restingTransform },
            '50%': { transform: raisedTransform },
            '100%': { transform: restingTransform }
        },
        '&:hover': {
            animationPlayState: 'paused',
            transform: `translate3d(0, -14px, 0) scale(1.02) rotate(${rotate})`
        }
    };
};

const Hero = ({ onOpenDemo }) => {
    const theme = useTheme();
    const navigate = useNavigate();
    const isDark = theme.palette.mode === 'dark';
    const accent = theme.palette.primary.main;
    const panelBackground = isDark
        ? `
            radial-gradient(circle at 16% 18%, rgba(249, 115, 22, 0.16), transparent 28%),
            radial-gradient(circle at 84% 16%, rgba(59, 130, 246, 0.14), transparent 24%),
            radial-gradient(circle at 78% 78%, rgba(249, 115, 22, 0.12), transparent 26%),
            linear-gradient(180deg, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)
        `
        : `
            radial-gradient(circle at 0% 0%, rgba(251, 146, 60, 0.24), transparent 26%),
            radial-gradient(circle at 100% 100%, rgba(251, 146, 60, 0.22), transparent 28%),
            radial-gradient(circle at 88% 14%, rgba(226, 232, 240, 0.22), transparent 20%),
            radial-gradient(circle at 48% 44%, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0) 38%),
            linear-gradient(180deg, #fffdf9 0%, #fff8ef 100%)
        `;

    const handleBookDemoClick = () => {
        navigate('/book-demo');
    };

    const handleExplorePlatformClick = () => {
        const target = document.getElementById('product-walkthrough');

        window.dispatchEvent(new CustomEvent('hirexit:showcase-focus', {
            detail: { cardId: 'dashboard' }
        }));

        if (target) {
            const appBarOffset = 88;
            const top = target.getBoundingClientRect().top + window.scrollY - appBarOffset;
            window.scrollTo({ top, behavior: 'smooth' });
            return;
        }

        onOpenDemo?.();
    };

    const mobileCards = [
        {
            id: 'match-score',
            content: (
                <>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.4 }}>
                        <Box
                            sx={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                bgcolor: alpha(accent, 0.14),
                                color: theme.palette.secondary.main,
                                fontWeight: 900
                            }}
                        >
                            JD
                        </Box>
                        <Box>
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.2 }}>
                                Match Score
                            </Typography>
                            <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: theme.palette.secondary.main }}>
                                87% Excellent
                            </Typography>
                        </Box>
                    </Stack>
                    <Box
                        sx={{
                            height: 6,
                            borderRadius: 999,
                            bgcolor: alpha(accent, 0.12),
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                width: '87%',
                                height: '100%',
                                borderRadius: 999,
                                background: `linear-gradient(90deg, ${theme.palette.secondary.main} 0%, ${accent} 100%)`
                            }}
                        />
                    </Box>
                </>
            )
        },
        {
            id: 'summary',
            content: (
                <Stack direction="row" spacing={1.2} alignItems="center">
                    <Box
                        sx={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            bgcolor: '#22c55e',
                            boxShadow: '0 0 0 6px rgba(34, 197, 94, 0.12)'
                        }}
                    />
                    <Typography sx={{ fontSize: '1rem', fontWeight: 800, color: 'text.primary' }}>
                        AI Summary Ready
                    </Typography>
                </Stack>
            )
        },
        {
            id: 'interviews',
            content: (
                <>
                    <Typography sx={{ fontSize: '0.86rem', color: 'text.secondary', mb: 1.15 }}>
                        Interviews Today
                    </Typography>
                    <Typography sx={{ fontSize: '2rem', lineHeight: 1, fontWeight: 900, color: 'text.primary', mb: 0.45 }}>
                        24
                    </Typography>
                    <Typography sx={{ fontSize: '0.9rem', color: '#16a34a', fontWeight: 700 }}>
                        12 completed
                    </Typography>
                </>
            )
        },
        {
            id: 'velocity',
            content: (
                <>
                    <Typography sx={{ fontSize: '0.82rem', letterSpacing: '0.08em', color: 'text.secondary', mb: 1.6 }}>
                        HIRING VELOCITY
                    </Typography>
                    <Stack direction="row" spacing={0.8} alignItems="flex-end" sx={{ height: 76, mb: 1.3 }}>
                        {[34, 56, 44, 68, 40].map((height, index) => (
                            <Box
                                key={`${height}-${index}`}
                                sx={{
                                    width: 16,
                                    height,
                                    borderRadius: '4px 4px 0 0',
                                    bgcolor: index === 3 ? accent : alpha(accent, 0.35)
                                }}
                            />
                        ))}
                    </Stack>
                    <Typography sx={{ fontSize: '1.05rem', fontWeight: 850, color: 'text.primary' }}>
                        +24% vs last month
                    </Typography>
                </>
            )
        }
    ];

    return (
        <Box
            component="section"
            sx={{
                pt: { xs: 6, md: 9 },
                pb: { xs: 6, md: 7.5 },
                position: 'relative',
                overflow: 'hidden',
                background: panelBackground
            }}
        >
            <Container sx={{ maxWidth: '1540px !important' }}>
                <Box
                    sx={{
                        position: 'relative',
                        overflow: 'visible',
                        px: { xs: 1.25, md: 0 },
                        py: { xs: 3, md: 4 },
                        minHeight: { md: 600 }
                    }}
                >
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '14%',
                            left: '28%',
                            width: 320,
                            height: 320,
                            borderRadius: '50%',
                            background: alpha(theme.palette.secondary.main, isDark ? 0.08 : 0.04),
                            filter: 'blur(110px)',
                            pointerEvents: 'none'
                        }}
                    />

                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: '10%',
                            right: '18%',
                            width: 260,
                            height: 260,
                            borderRadius: '50%',
                            background: alpha(accent, isDark ? 0.12 : 0.06),
                            filter: 'blur(118px)',
                            pointerEvents: 'none'
                        }}
                    />

                    <Box
                        sx={{
                            ...floatingCardSx(theme, isDark),
                            ...floatingMotionSx(0, '-2deg'),
                            display: { xs: 'none', md: 'block' },
                            top: 48,
                            left: 8,
                            width: 226,
                            px: 2.1,
                            py: 2
                        }}
                    >
                        {mobileCards[0].content}
                    </Box>

                    <Box
                        sx={{
                            ...floatingCardSx(theme, isDark),
                            ...floatingMotionSx(1, '1.5deg'),
                            display: { xs: 'none', md: 'block' },
                            top: 4,
                            right: 28,
                            px: 2,
                            py: 1.55
                        }}
                    >
                        {mobileCards[1].content}
                    </Box>

                    <Box
                        sx={{
                            ...floatingCardSx(theme, isDark),
                            ...floatingMotionSx(2, '-3deg'),
                            display: { xs: 'none', md: 'block' },
                            left: -8,
                            bottom: 28,
                            width: 152,
                            px: 2,
                            py: 2
                        }}
                    >
                        {mobileCards[2].content}
                    </Box>

                    <Box
                        sx={{
                            ...floatingCardSx(theme, isDark),
                            ...floatingMotionSx(3, '2deg'),
                            display: { xs: 'none', md: 'block' },
                            right: 8,
                            bottom: 4,
                            width: 242,
                            px: 2.1,
                            py: 1.95
                        }}
                    >
                        {mobileCards[3].content}
                    </Box>

                    <Stack
                        spacing={{ xs: 2.3, md: 3 }}
                        alignItems="center"
                        textAlign="center"
                        sx={{
                            position: 'relative',
                            zIndex: 1,
                            maxWidth: 860,
                            mx: 'auto',
                            minHeight: { md: 480 },
                            justifyContent: 'center'
                        }}
                    >
                        <Chip
                            label="INTELLIGENT HIRING 2.0"
                            sx={{
                                height: 34,
                                px: 1.25,
                                borderRadius: 999,
                                color: accent,
                                fontWeight: 900,
                                letterSpacing: '0.14em',
                                bgcolor: alpha(accent, 0.06),
                                border: `1px solid ${alpha(accent, 0.22)}`,
                                '& .MuiChip-label': {
                                    px: 0.4
                                }
                            }}
                        />

                        <Typography
                            variant="h1"
                            sx={{
                                maxWidth: 860,
                                color: 'text.primary',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 800,
                                letterSpacing: '-0.035em',
                                lineHeight: { xs: 1.12, md: 1.08 },
                                fontSize: { xs: '2.05rem', sm: '2.7rem', md: '3.95rem', lg: '4.35rem' }
                            }}
                        >
                            The AI Hiring Platform
                            <Box component="span" sx={{ display: 'block', mt: { xs: 0.08, md: 0.1 } }}>
                                for Smarter
                                {' '}
                                <Box component="span" sx={{ color: accent }}>
                                    Talent
                                </Box>
                            </Box>
                            <Box component="span" sx={{ display: 'block', color: accent, mt: { xs: 0.04, md: 0.06 } }}>
                                Acquisition
                            </Box>
                        </Typography>

                        <Typography
                            sx={{
                                maxWidth: 820,
                                color: 'text.secondary',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.96rem', md: '1.04rem' },
                                lineHeight: { xs: 1.72, md: 1.68 },
                                px: { xs: 0.5, md: 0 }
                            }}
                        >
                            Streamline candidate screening, live AI demos, interview workflows,
                            evaluation, and shortlisting in one modern recruitment platform.
                        </Typography>

                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ pt: { xs: 0.4, md: 1.2 } }}>
                            <Button
                                variant="contained"
                                onClick={handleBookDemoClick}
                                sx={{
                                    minWidth: 210,
                                    px: 4.5,
                                    py: 1.7,
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontSize: { xs: '1rem', md: '1.05rem' },
                                    fontWeight: 850,
                                    boxShadow: `0 22px 48px -24px ${alpha(accent, 0.85)}`
                                }}
                            >
                                Free Demo
                            </Button>

                            <Button
                                variant="outlined"
                                endIcon={<ArrowRight size={18} />}
                                onClick={handleExplorePlatformClick}
                                sx={{
                                    minWidth: 230,
                                    px: 4,
                                    py: 1.7,
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontSize: { xs: '1rem', md: '1.05rem' },
                                    fontWeight: 850,
                                    color: 'text.primary',
                                    bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.62 : 0.82),
                                    borderColor: alpha(isDark ? '#e2e8f0' : '#cbd5e1', isDark ? 0.2 : 0.8),
                                    '&:hover': {
                                        borderColor: alpha(accent, 0.42),
                                        bgcolor: alpha(accent, 0.04)
                                    }
                                }}
                            >
                                Explore platform
                            </Button>
                        </Stack>

                        <Box
                            sx={{
                                display: { xs: 'grid', md: 'none' },
                                width: '100%',
                                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                gap: 1.2,
                                pt: 1.2
                            }}
                        >
                            {mobileCards.map((card, index) => (
                                <Box
                                    key={card.id}
                                    sx={{
                                        ...floatingCardSx(theme, isDark),
                                        ...floatingMotionSx(index, '0deg'),
                                        position: 'relative',
                                        width: '100%',
                                        px: 1.4,
                                        py: 1.5,
                                        minHeight: card.id === 'velocity' ? 148 : 'auto'
                                    }}
                                >
                                    {card.content}
                                </Box>
                            ))}
                        </Box>
                    </Stack>
                </Box>
            </Container>
        </Box>
    );
};

export default Hero;
