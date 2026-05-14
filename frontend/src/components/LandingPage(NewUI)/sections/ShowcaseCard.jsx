import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Button, Chip, Paper, Stack, Typography, alpha } from '@mui/material';
import { Headphones, LayoutDashboard, Sparkles } from 'lucide-react';

const CARD_CONFIG = [
    {
        id: 'live-demo',
        accentFromTheme: 'primary',
        eyebrow: 'LIVE DEMO',
        title: 'Live Demo Call',
        icon: Headphones,
        chips: ['Real-time voice', 'Multilingual mode', 'Instant summary']
    },
    {
        id: 'setup',
        accentFromTheme: 'secondary',
        eyebrow: '5-MIN INTERVIEW',
        title: 'AI Interview Demo',
        icon: Sparkles,
        chips: ['5-minute flow', 'Demo script', 'Interview preview']
    },
    {
        id: 'dashboard',
        accent: '#0ea5e9',
        eyebrow: 'DASHBOARD',
        title: 'Hiring Dashboard',
        icon: LayoutDashboard,
        chips: ['Pipeline visibility', 'Attention queue', 'Exportable reports']
    }
];

const ShowcaseCardPanel = ({
    active,
    onActivate,
    accent,
    eyebrow,
    Icon,
    title,
    description,
    chips,
    previewTitle,
    previewText,
    isDark,
    cardRef,
    children
}) => {
    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onActivate();
        }
    };

    return (
        <Box
            ref={cardRef}
            sx={{
                flex: { xs: '1 1 auto', lg: active ? '1 1 0%' : '0 0 108px' },
                minWidth: 0,
                maxWidth: { lg: active ? 'none' : 108 },
                transition: 'flex 0.45s ease, max-width 0.45s ease',
                display: 'flex',
                alignSelf: 'stretch'
            }}
        >
            <Paper
                elevation={0}
                sx={{
                    flex: 1,
                    p: { xs: active ? 2.5 : 2, md: active ? 3 : 2.25, lg: active ? 3 : 1.2 },
                    borderRadius: { xs: 4, md: 5 },
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    minHeight: { xs: active ? 'auto' : 150, lg: 740 },
                    border: `1px solid ${active ? alpha(accent, 0.35) : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)')}`,
                    bgcolor: active
                        ? (isDark ? 'rgba(15,23,42,0.92)' : 'rgba(255,255,255,0.96)')
                        : (isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.78)'),
                    backdropFilter: 'blur(16px)',
                    boxShadow: active
                        ? `0 35px 90px -50px ${alpha('#0f172a', 0.7)}`
                        : `0 25px 55px -45px ${alpha('#0f172a', 0.35)}`,
                    justifyContent: { lg: active ? 'flex-start' : 'center' }
                }}
            >
                <Box
                    role="button"
                    tabIndex={0}
                    aria-expanded={active}
                    onClick={onActivate}
                    onKeyDown={handleKeyDown}
                    sx={{
                        cursor: 'pointer',
                        outline: 'none',
                        height: { lg: active ? 'auto' : '100%' },
                        '&:focus-visible': {
                            borderRadius: 3,
                            boxShadow: `0 0 0 3px ${alpha(accent, 0.3)}`
                        }
                    }}
                >
                    <Box sx={{ display: { xs: 'block', lg: active ? 'block' : 'none' } }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                            <Stack direction="row" spacing={1.25} alignItems="center">
                                <Box
                                    sx={{
                                        width: active ? 46 : 40,
                                        height: active ? 46 : 40,
                                        borderRadius: active ? '16px' : '14px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        bgcolor: alpha(accent, isDark ? 0.22 : 0.1),
                                        color: accent
                                    }}
                                >
                                    <Icon size={active ? 20 : 18} />
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.16em', color: accent }}>
                                        {eyebrow}
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, color: 'text.secondary' }}>
                                        Click to expand this card
                                    </Typography>
                                </Box>
                            </Stack>
                            <Chip
                                label={active ? 'Expanded' : 'Closed'}
                                size="small"
                                sx={{ bgcolor: alpha(accent, isDark ? 0.24 : 0.1), color: accent, fontWeight: 800 }}
                            />
                        </Stack>

                        <Typography
                            variant="h4"
                            sx={{
                                mt: active ? 3 : 2.2,
                                mb: 1.1,
                                fontSize: { xs: active ? '1.45rem' : '1.25rem', md: active ? '2rem' : '1.3rem' },
                                fontWeight: 850,
                                letterSpacing: '-0.03em'
                            }}
                        >
                            {title}
                        </Typography>
                        <Typography
                            sx={{
                                color: 'text.secondary',
                                maxWidth: 560,
                                lineHeight: 1.7,
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: active ? 'unset' : 1,
                                overflow: 'hidden'
                            }}
                        >
                            {description}
                        </Typography>

                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: active ? 2.5 : 1.6 }}>
                            {chips.map((chip, index) => (
                                <Chip
                                    key={chip}
                                    label={chip}
                                    size="small"
                                    sx={{
                                        borderRadius: 20,
                                        bgcolor: alpha(accent, isDark ? 0.18 : 0.08),
                                        border: `1px solid ${alpha(accent, 0.14)}`,
                                        color: active ? 'text.primary' : 'text.secondary',
                                        fontWeight: 700,
                                        display: active || index === 0 ? 'inline-flex' : 'none'
                                    }}
                                />
                            ))}
                        </Stack>
                    </Box>

                    <Box
                        sx={{
                            display: { xs: 'none', lg: active ? 'none' : 'flex' },
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <Stack spacing={2} alignItems="center" justifyContent="center">
                            <Box
                                sx={{
                                    width: 46,
                                    height: 46,
                                    borderRadius: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: alpha(accent, isDark ? 0.22 : 0.1),
                                    color: accent
                                }}
                            >
                                <Icon size={20} />
                            </Box>
                            <Typography
                                sx={{
                                    writingMode: 'vertical-rl',
                                    transform: 'rotate(180deg)',
                                    whiteSpace: 'nowrap',
                                    fontSize: '1rem',
                                    fontWeight: 850,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: accent
                                }}
                            >
                                {title}
                            </Typography>
                        </Stack>
                    </Box>
                </Box>

                {active ? (
                    <AnimatePresence initial={false} mode="wait">
                        <motion.div
                            key={`${title}-active`}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.28, ease: 'easeOut' }}
                            style={{ marginTop: 28 }}
                        >
                            {children}
                        </motion.div>
                    </AnimatePresence>
                ) : (
                    <Box sx={{ display: { xs: 'block', lg: 'none' }, mt: 1.75 }}>
                        <Box
                            sx={{
                                px: 1.5,
                                py: 1.15,
                                borderRadius: 3,
                                bgcolor: alpha(accent, isDark ? 0.12 : 0.05),
                                border: `1px solid ${alpha(accent, 0.14)}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1.5
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: accent, mb: 0.45 }}>
                                    {previewTitle}
                                </Typography>
                                <Typography
                                    sx={{
                                        color: 'text.secondary',
                                        lineHeight: 1.6,
                                        display: '-webkit-box',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 1,
                                        overflow: 'hidden',
                                        fontSize: '0.95rem'
                                    }}
                                >
                                    {previewText}
                                </Typography>
                            </Box>
                            <Button
                                variant="text"
                                size="small"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onActivate();
                                }}
                                sx={{ flexShrink: 0, color: accent, fontWeight: 800, textTransform: 'none' }}
                            >
                                Expand
                            </Button>
                        </Box>
                    </Box>
                )}
            </Paper>
        </Box>
    );
};

const HeroShowcaseCards = ({ theme, isDark, bookDemoTrigger, renderCardContent }) => {
    const [activeCard, setActiveCard] = useState('live-demo');
    const liveDemoCardRef = useRef(null);

    useEffect(() => {
        if (bookDemoTrigger < 1) {
            return;
        }

        setActiveCard('live-demo');
        window.requestAnimationFrame(() => {
            liveDemoCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }, [bookDemoTrigger]);

    const cards = CARD_CONFIG.map((card) => ({
        ...card,
        accent: card.accentFromTheme ? theme.palette[card.accentFromTheme].main : card.accent
    }));

    return (
        <Box sx={{ mt: { xs: 6, md: 8 }, display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, alignItems: 'stretch' }}>
            {cards.map((card) => {
                const isActive = activeCard === card.id;

                return (
                    <ShowcaseCardPanel
                        key={card.id}
                        active={isActive}
                        onActivate={() => setActiveCard(card.id)}
                        accent={card.accent}
                        eyebrow={card.eyebrow}
                        title={card.title}
                        description={card.description}
                        Icon={card.icon}
                        chips={card.chips}
                        previewTitle={card.previewTitle}
                        previewText={card.previewText}
                        isDark={isDark}
                        cardRef={card.id === 'live-demo' ? liveDemoCardRef : undefined}
                    >
                        {renderCardContent(card.id, isActive)}
                    </ShowcaseCardPanel>
                );
            })}
        </Box>
    );
};

export default HeroShowcaseCards;
