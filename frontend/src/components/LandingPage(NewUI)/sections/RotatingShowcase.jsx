import { useCallback, useEffect, useState } from 'react';
import { Box, Button, Chip, Container, Dialog, DialogActions, DialogContent, Stack, Typography, alpha, useTheme } from '@mui/material';
import { BarChart3, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, Headphones, Mic, Radio, Sparkles, Users } from 'lucide-react';
import HeroCardDashboard from './HeroCardDashboard';
import HeroInteractiveInterviewDemo from './HeroInteractiveInterviewDemo';
import LiveDemoModal from './LiveDemoModal';
import VoiceDemo from './VoiceDemo';
import { getDemoCandidateId, getDemoFlowConfig } from './demoSessionConfig';
import { clearPublicDemoLeadSession } from '../bookDemo/publicDemoLeadSession';

const ROTATION_INTERVAL_MS = 3000;

const CARDS = [
    { id: 'live-demo', title: 'Live Demo Call', accentKey: 'primary' },
    { id: 'ai-interview', title: 'AI Interview', accentKey: 'secondary' },
    { id: 'dashboard', title: 'Dashboard', accentKey: 'secondary' }
];

const PLACEMENTS = {
    center: {
        top: { xs: '50%', md: 0 },
        left: { xs: '0%', md: '50%' },
        width: { xs: '100%', md: '58%' },
        transform: {
            xs: 'translate3d(0, -50%, 0) scale(1)',
            md: 'translate3d(-50%, 0, 0) scale(1) rotate(0deg)'
        },
        opacity: { xs: 1, md: 1 },
        filter: 'blur(0px)',
        zIndex: 3
    },
    left: {
        top: { xs: '50%', md: 52 },
        left: { xs: '-100%', md: '8%' },
        width: { xs: '100%', md: '41%' },
        transform: {
            xs: 'translate3d(0, -50%, 0) scale(0.98)',
            md: 'translate3d(0, 0, 0) scale(0.9)'
        },
        opacity: { xs: 1, md: 0.62 },
        filter: { xs: 'blur(0px)', md: 'blur(1.2px)' },
        zIndex: 1
    },
    right: {
        top: { xs: '50%', md: 52 },
        left: { xs: '100%', md: '51%' },
        width: { xs: '100%', md: '41%' },
        transform: {
            xs: 'translate3d(0, -50%, 0) scale(0.98)',
            md: 'translate3d(0, 0, 0) scale(0.9)'
        },
        opacity: { xs: 1, md: 0.62 },
        filter: { xs: 'blur(0px)', md: 'blur(1.2px)' },
        zIndex: 1
    }
};

const getPlacement = (index, activeIndex, total) => {
    const offset = (index - activeIndex + total) % total;

    if (offset === 0) {
        return 'center';
    }

    if (offset === 1) {
        return 'right';
    }

    return 'left';
};

const PreviewHeader = ({ accent, title, status, isDark }) => (
    <Box
        sx={{
            px: { xs: 2.2, md: 2.8 },
            py: { xs: 1.5, md: 1.75 },
            borderBottom: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.08 : 0.92)}`
        }}
    >
        <Stack spacing={0.9} alignItems="center">
            <Typography
                sx={{
                    fontSize: { xs: '0.96rem', md: '1.02rem' },
                    fontWeight: 900,
                    color: 'text.primary',
                    letterSpacing: '-0.01em',
                    textAlign: 'center'
                }}
            >
                {title}
            </Typography>

            <Stack direction="row" spacing={1} alignItems="center" justifyContent="center">
                <Box
                    sx={{
                        width: 9,
                        height: 9,
                        borderRadius: '50%',
                        bgcolor: '#22c55e',
                        boxShadow: '0 0 0 6px rgba(34, 197, 94, 0.12)'
                    }}
                />
                <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, letterSpacing: '0.12em', color: 'text.secondary' }}>
                    {status}
                </Typography>
            </Stack>
        </Stack>
    </Box>
);

const VoiceBars = ({ accent }) => (
    <Stack direction="row" spacing={0.6} alignItems="flex-end" sx={{ height: 44 }}>
        {[20, 36, 28, 42, 26].map((height, index) => (
            <Box
                key={`${height}-${index}`}
                sx={{
                    width: 6,
                    height,
                    borderRadius: 999,
                    bgcolor: alpha(accent, 0.26 + (index * 0.08)),
                    animation: `showcaseVoicePulse 1.1s ${index * 0.08}s ease-in-out infinite`,
                    '@keyframes showcaseVoicePulse': {
                        '0%, 100%': { transform: 'scaleY(0.84)' },
                        '50%': { transform: 'scaleY(1.08)' }
                    }
                }}
            />
        ))}
    </Stack>
);

const CardFrame = ({ children, accent, isDark }) => (
    <Box
        sx={{
            position: 'relative',
            minHeight: { xs: 780, md: 760 },
            borderRadius: { xs: '28px', md: '34px' },
            overflow: 'hidden',
            background: isDark
                ? 'linear-gradient(180deg, rgba(15,23,42,0.98) 0%, rgba(15,23,42,0.94) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.96) 100%)',
            border: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.1 : 0.92)}`,
            boxShadow: isDark
                ? '0 32px 80px -42px rgba(2, 6, 23, 0.85)'
                : '0 30px 70px -38px rgba(15, 23, 42, 0.24)'
        }}
    >
        <Box
            sx={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle at 50% 50%, ${alpha(accent, 0.12)} 0%, transparent 58%)`,
                pointerEvents: 'none'
            }}
        />
        {children}
    </Box>
);

const LiveDemoPreview = ({ accent, isDark, onAction }) => (
    <CardFrame accent={accent} isDark={isDark}>
        <PreviewHeader accent={accent} title="Live Demo Call" status="LIVE ENGINE" isDark={isDark} />
        <Box
            sx={{
                px: { xs: 2, md: 3.4 },
                py: { xs: 2.4, md: 4.1 },
                display: 'grid',
                placeItems: 'center',
                textAlign: 'center',
                background: isDark
                    ? `radial-gradient(circle at 50% 42%, ${alpha(accent, 0.12)} 0%, transparent 34%), linear-gradient(180deg, rgba(15,23,42,0.2) 0%, rgba(15,23,42,0.34) 100%)`
                    : `radial-gradient(circle at 50% 42%, ${alpha(accent, 0.12)} 0%, transparent 36%), linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(248,250,252,0.96) 100%)`
            }}
        >
            <Box>
                <Stack direction="row" spacing={2.2} alignItems="center" justifyContent="center" sx={{ mb: 3.2 }}>
                    <VoiceBars accent={accent} />
                    <Box
                        sx={{
                            width: { xs: 140, md: 194 },
                            height: { xs: 140, md: 194 },
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            background: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(241,245,249,0.98) 100%)' : 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
                            boxShadow: isDark ? '0 22px 60px -34px rgba(15, 23, 42, 0.8)' : '0 26px 60px -34px rgba(15, 23, 42, 0.22)',
                            border: `1px solid ${alpha(isDark ? '#f8fafc' : '#e2e8f0', isDark ? 0.12 : 0.96)}`
                        }}
                    >
                        <Stack spacing={1} alignItems="center">
                            <Headphones size={52} color={accent} strokeWidth={2.2} />
                            <Typography sx={{ fontSize: '0.86rem', fontWeight: 900, letterSpacing: '0.14em', color: 'text.secondary' }}>
                                READY
                            </Typography>
                        </Stack>
                    </Box>
                    <VoiceBars accent={accent} />
                </Stack>

                <Typography sx={{ fontSize: { xs: '2rem', md: '3.05rem' }, lineHeight: 1.02, fontWeight: 900, letterSpacing: '-0.04em' }}>
                    Live Demo
                    <Box component="span" sx={{ display: 'block' }}>Call</Box>
                </Typography>

                <Typography sx={{ mt: 1.8, mx: 'auto', maxWidth: 500, color: 'text.secondary', fontSize: { xs: '0.98rem', md: '1.12rem' }, lineHeight: 1.7 }}>
                    Experience the Hirex REC low-latency voice model with a smooth recruiter-ready call flow.
                </Typography>

                <Button
                    variant="contained"
                    size="large"
                    onClick={(event) => {
                        event.stopPropagation();
                        onAction();
                    }}
                    sx={{ mt: 3.2, minWidth: 220, minHeight: 58, borderRadius: 4, fontWeight: 800, textTransform: 'none', boxShadow: `0 22px 40px -22px ${alpha(accent, 0.7)}` }}
                >
                    Live Demo Now
                </Button>
            </Box>
        </Box>
    </CardFrame>
);

const InterviewPreview = ({ accent, isDark, onAction }) => (
    <CardFrame accent={accent} isDark={isDark}>
        <PreviewHeader accent={accent} title="AI Interview" status="AI INTERVIEWER" isDark={isDark} />
        <Box sx={{ px: { xs: 2, md: 3.2 }, py: { xs: 1.8, md: 3 }, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.02fr 0.98fr' }, gap: { xs: 1.4, md: 2 } }}>
            <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha(accent, isDark ? 0.18 : 0.08), border: `1px solid ${alpha(accent, 0.18)}`, display: 'grid', gap: 1.3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Chip label="INTERVIEW FLOW" size="small" sx={{ fontWeight: 900, letterSpacing: '0.08em', color: accent, bgcolor: alpha(accent, 0.12) }} />
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 800, color: 'text.secondary' }}>Session ID: #4821</Typography>
                </Stack>

                <Box sx={{ p: 2, borderRadius: 3.5, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.74 : 0.94), border: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.08 : 0.92)}` }}>
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.18em', color: accent, mb: 1 }}>TECHNICAL SCREENING</Typography>
                    <Typography sx={{ fontSize: { xs: '1.45rem', md: '1.7rem' }, fontWeight: 900, letterSpacing: '-0.03em' }}>Frontend Engineer</Typography>
                    <Stack direction="row" spacing={1.1} sx={{ mt: 2.1 }}>
                        <Box sx={{ width: 52, height: 52, borderRadius: 3, display: 'grid', placeItems: 'center', bgcolor: alpha(accent, 0.12), color: accent, fontWeight: 900 }}>AB</Box>
                        <Box>
                            <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, color: 'text.secondary', letterSpacing: '0.12em' }}>CANDIDATE</Typography>
                            <Typography sx={{ fontSize: '1.08rem', fontWeight: 850 }}>Alex Brown</Typography>
                            <Typography sx={{ fontSize: '0.9rem', color: 'text.secondary' }}>Ready for question 03</Typography>
                        </Box>
                    </Stack>
                </Box>

                <Box sx={{ p: 1.6, borderRadius: 3.2, bgcolor: alpha(isDark ? '#020617' : '#ffffff', isDark ? 0.74 : 0.94), border: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.08 : 0.92)}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.1 }}>
                        <Chip label="LIVE" size="small" sx={{ bgcolor: '#ef4444', color: '#ffffff', fontWeight: 900 }} />
                        <Stack direction="row" spacing={1}>
                            <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha(accent, 0.12) }}><Mic size={16} /></Box>
                            <Box sx={{ width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: alpha(isDark ? '#f8fafc' : '#0f172a', 0.08) }}><Radio size={16} /></Box>
                        </Stack>
                    </Stack>
                    <Box sx={{ height: 114, borderRadius: 3, background: `linear-gradient(135deg, ${alpha(accent, 0.18)} 0%, ${alpha('#0f172a', isDark ? 0.42 : 0.08)} 100%)`, border: `1px solid ${alpha(accent, 0.12)}`, display: 'grid', placeItems: 'center' }}>
                        <Typography sx={{ fontWeight: 800, fontSize: '0.98rem' }}>Candidate camera preview</Typography>
                    </Box>
                </Box>
            </Box>

            <Box sx={{ display: 'grid', gap: 1.3 }}>
                <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.76 : 0.94), border: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', isDark ? 0.08 : 0.92)}` }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 900, letterSpacing: '0.12em', color: accent, mb: 0.8 }}>CURRENT QUESTION</Typography>
                    <Typography sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.7, fontWeight: 700 }}>
                        How would you structure state in a React app with frequent real-time updates?
                    </Typography>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1.2 }}>
                    {[
                        ['Question', '03 / 05'],
                        ['Confidence', '92%'],
                        ['Bias Check', 'Passed'],
                        ['Summary', 'Ready']
                    ].map(([metricLabel, metricValue], index) => (
                        <Box key={`${metricLabel}-${metricValue}`} sx={{ p: 1.45, borderRadius: 3.2, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.74 : 0.94), border: `1px solid ${alpha(index % 2 === 0 ? accent : '#22c55e', 0.16)}` }}>
                            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mb: 0.35 }}>{metricLabel}</Typography>
                            <Typography sx={{ fontSize: '1.1rem', fontWeight: 850 }}>{metricValue}</Typography>
                        </Box>
                    ))}
                </Box>

                <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.76 : 0.94), border: `1px solid ${alpha(accent, 0.14)}` }}>
                    <Stack spacing={0.9}>
                        {[
                            'Structured follow-ups keep evaluation consistent.',
                            'Realtime summary is prepared before the next round.',
                            'Every candidate gets the same clear question flow.'
                        ].map((item) => (
                            <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                                <CheckCircle2 size={16} color={accent} style={{ marginTop: 2, flexShrink: 0 }} />
                                <Typography sx={{ fontSize: '0.94rem', color: 'text.secondary', lineHeight: 1.6 }}>{item}</Typography>
                            </Stack>
                        ))}
                    </Stack>

                    <Button
                        variant="outlined"
                        size="large"
                        onClick={(event) => {
                            event.stopPropagation();
                            onAction();
                        }}
                        sx={{ mt: 2.1, minWidth: 190, borderRadius: 4, fontWeight: 800, textTransform: 'none' }}
                    >
                        See Interview Flow
                    </Button>
                </Box>
            </Box>
        </Box>
    </CardFrame>
);

const DashboardPreview = ({ accent, secondaryAccent, isDark, onAction }) => (
    <CardFrame accent={accent} isDark={isDark}>
        <PreviewHeader accent={accent} title="Dashboard" status="HIRING OS" isDark={isDark} />
        <Box sx={{ px: { xs: 2, md: 3.2 }, py: { xs: 1.8, md: 3.1 }, display: 'grid', gridTemplateRows: 'auto auto 1fr', gap: { xs: 1.2, md: 1.7 } }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    <Chip label="Realtime pipeline" size="small" sx={{ bgcolor: alpha(accent, 0.1), color: accent, fontWeight: 800 }} />
                    <Chip label="AI active" size="small" sx={{ bgcolor: alpha('#22c55e', 0.1), color: '#16a34a', fontWeight: 800 }} />
                </Stack>
                <Button
                    variant="contained"
                    size="small"
                    onClick={(event) => {
                        event.stopPropagation();
                        onAction();
                    }}
                    sx={{ minWidth: 132, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                >
                    Create Job
                </Button>
            </Stack>

            <Box sx={{
                display: { xs: 'flex', md: 'grid' },
                gridTemplateColumns: { md: 'repeat(4, minmax(0, 1fr))' },
                overflowX: { xs: 'auto', md: 'visible' },
                gap: 1.2,
                pb: { xs: 0.5, md: 0 },
                '&::-webkit-scrollbar': { display: 'none' },
                mx: { xs: -0.5, md: 0 },
                px: { xs: 0.5, md: 0 }
            }}>
                {[
                    ['Roles', '12', Briefcase, accent],
                    ['Candidates', '148', Users, secondaryAccent],
                    ['AI Interviews', '31', Sparkles, '#10b981'],
                    ['Reports', '9', BarChart3, '#0ea5e9']
                ].map(([metricLabel, metricValue, Icon, metricAccent]) => (
                    <Box key={metricLabel} sx={{ p: 1.5, minWidth: { xs: 135, md: 'auto' }, flex: { xs: '0 0 auto', md: '1 1 auto' }, borderRadius: 3, bgcolor: isDark ? '#0f172a' : '#ffffff', border: `1px solid ${alpha(metricAccent, 0.16)}` }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.8 }}>
                            <Box sx={{ width: 36, height: 36, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: alpha(metricAccent, 0.14), color: metricAccent }}>
                                <Icon size={16} />
                            </Box>
                            <Typography sx={{ fontSize: '0.76rem', fontWeight: 800, color: metricAccent }}>+12%</Typography>
                        </Stack>
                        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{metricLabel}</Typography>
                        <Typography sx={{ mt: 0.25, fontSize: '1.4rem', fontWeight: 900 }}>{metricValue}</Typography>
                    </Box>
                ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.08fr 0.92fr' }, gap: 1.5 }}>
                <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.76 : 0.94), border: `1px solid ${alpha(accent, 0.16)}` }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.3 }}>
                        <Typography sx={{ fontWeight: 850 }}>Hiring velocity</Typography>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 900, color: accent }}>+24% vs last month</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 146 }}>
                        {[38, 66, 52, 84, 58, 94].map((height, index) => (
                            <Box key={`${height}-${index}`} sx={{ flex: 1, display: 'grid', justifyItems: 'center' }}>
                                <Box sx={{ width: '100%', maxWidth: 44, height: `${height}%`, minHeight: 18, borderRadius: '18px 18px 6px 6px', bgcolor: index === 4 ? accent : alpha(accent, 0.26 + (index * 0.05)) }} />
                            </Box>
                        ))}
                    </Stack>
                </Box>

                <Box sx={{ p: 2, borderRadius: 4, bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.76 : 0.94), border: `1px solid ${alpha(secondaryAccent, 0.16)}` }}>
                    <Typography sx={{ fontWeight: 850, mb: 1.3 }}>Shortlist queue</Typography>
                    <Stack spacing={0.8}>
                        {[ 
                            ['Candidate A1', 'Frontend Lead', 94],
                            ['Candidate B2', 'Product Analyst', 89],
                            ['Candidate C3', 'ML Engineer', 86]
                        ].map(([name, role, score], index) => (
                            <Box key={`${name}-${role}`} sx={{ p: { xs: 0.75, md: 1.15 }, borderRadius: 3, bgcolor: alpha(index === 0 ? accent : secondaryAccent, 0.08), border: `1px solid ${alpha(index === 0 ? accent : secondaryAccent, 0.14)}` }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.2}>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 800 }} noWrap>{name}</Typography>
                                        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }} noWrap>{role}</Typography>
                                    </Box>
                                    <Chip label={score} size="small" sx={{ fontWeight: 900, bgcolor: alpha(score > 90 ? '#10b981' : accent, 0.12), color: score > 90 ? '#059669' : accent }} />
                                </Stack>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            </Box>
        </Box>
    </CardFrame>
);

const ShowcaseCard = ({ card, placement, isActive, accent, secondaryAccent, isDark, theme, liveDemoSession, interviewDemoSession, onActivate, onAction }) => {
    let preview = null;
    const isInteractive = card.id === 'live-demo'
        ? Boolean(liveDemoSession)
        : card.id === 'ai-interview'
            ? Boolean(interviewDemoSession)
            : false;

    if (isActive && card.id === 'live-demo') {
        preview = (
            <Box sx={{ minHeight: { xs: 400, md: 620 }, pointerEvents: isInteractive ? 'auto' : 'none', userSelect: isInteractive ? 'auto' : 'none' }}>
                <VoiceDemo
                    embedded
                    showHeading={false}
                    showcaseTitle="Live Demo Call"
                    demoSession={liveDemoSession}
                    onRequestCapture={() => onAction(card.id)}
                    onDemoEnd={() => onAction('live-demo-end')}
                    sx={{
                        pointerEvents: isInteractive ? 'auto' : 'none',
                        '& .MuiPaper-root': {
                            minHeight: { xs: 390, md: 560 },
                            maxWidth: { md: 980 },
                            mx: 'auto',
                            borderRadius: { xs: '24px', md: '28px' },
                            boxShadow: isDark
                                ? '0 32px 80px -42px rgba(2, 6, 23, 0.85)'
                                : '0 30px 70px -38px rgba(15, 23, 42, 0.24)'
                        }
                    }}
                />
            </Box>
        );
    } else if (isActive && card.id === 'ai-interview') {
        preview = (
            <Box sx={{ minHeight: { xs: 780, md: 760 } }}>
                <HeroInteractiveInterviewDemo
                    isDark={isDark}
                    theme={theme}
                    showcaseTitle="AI Interview"
                    demoSession={interviewDemoSession}
                    onInterviewEnd={() => onAction('ai-interview-end')}
                />
            </Box>
        );
    } else if (isActive) {
        preview = (
            <Box sx={{ minHeight: { xs: 780, md: 760 } }}>
                <HeroCardDashboard isDark={isDark} theme={theme} showcaseTitle="Dashboard" />
            </Box>
        );
    } else if (card.id === 'live-demo') {
        preview = <LiveDemoPreview accent={accent} isDark={isDark} onAction={() => onAction(card.id)} />;
    } else if (card.id === 'ai-interview') {
        preview = <InterviewPreview accent={accent} isDark={isDark} onAction={() => onAction(card.id)} />;
    } else {
        preview = <DashboardPreview accent={accent} secondaryAccent={secondaryAccent} isDark={isDark} onAction={() => onAction(card.id)} />;
    }

    return (
        <Box
            onClick={() => {
                if (!isActive) {
                    onActivate();
                    onAction(card.id);
                    return;
                }

                if (!isInteractive) {
                    onAction(card.id);
                }
            }}
            sx={{
                position: 'absolute',
                ...PLACEMENTS[placement],
                transition: 'left 720ms cubic-bezier(0.22, 1, 0.36, 1), top 720ms cubic-bezier(0.22, 1, 0.36, 1), width 720ms cubic-bezier(0.22, 1, 0.36, 1), transform 720ms cubic-bezier(0.22, 1, 0.36, 1), opacity 720ms cubic-bezier(0.22, 1, 0.36, 1), filter 720ms cubic-bezier(0.22, 1, 0.36, 1)',
                cursor: 'pointer',
                pointerEvents: { xs: isActive ? 'auto' : 'none', md: 'auto' }
            }}
        >
            {preview}

            {!isActive && (
                <Box
                    sx={{
                        position: 'absolute',
                        inset: 0,
                        background: alpha(isDark ? '#020617' : '#ffffff', isDark ? 0.16 : 0.22),
                        backdropFilter: 'blur(1px)',
                        borderRadius: { xs: '28px', md: '34px' },
                        pointerEvents: 'none'
                    }}
                />
            )}
        </Box>
    );
};

const RotatingShowcase = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [activeIndex, setActiveIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [demoModalOpen, setDemoModalOpen] = useState(false);
    const [verifiedLeadSession, setVerifiedLeadSession] = useState(null);
    const [liveDemoSession, setLiveDemoSession] = useState(null);
    const [interviewDemoSession, setInterviewDemoSession] = useState(null);
    const [startChoiceOpen, setStartChoiceOpen] = useState(false);
    const [demoSequence, setDemoSequence] = useState([]);
    const [completedFlows, setCompletedFlows] = useState([]);
    const [followUpPrompt, setFollowUpPrompt] = useState(null);
    const isRotationPaused = isPaused || demoModalOpen || startChoiceOpen || Boolean(followUpPrompt) || Boolean(liveDemoSession) || Boolean(interviewDemoSession);

    const buildDemoSession = useCallback((flow, baseSession) => {
        const flowConfig = getDemoFlowConfig(flow);
        const verifiedLead = baseSession?.verifiedLead;
        const leadForm = baseSession?.leadForm || verifiedLead?.leadForm || {};
        const candidateEmail = verifiedLead?.candidateEmail || leadForm.email || '';
        const baseUuid = flow === 'live-demo'
            ? `call_simulation_____${Date.now()}`
            : `interview_demo_____${Date.now()}`;

        return {
            flow,
            mode: 'normal',
            demoOf: flowConfig.demoOf,
            jobTitle: flowConfig.jobTitle,
            jobId: flowConfig.jobId,
            candidateId: baseSession?.candidateId || getDemoCandidateId(),
            callUUID: candidateEmail ? `${baseUuid} ${candidateEmail}` : baseUuid,
            interviewMeta: flowConfig.interviewMeta || null,
            leadForm,
            verifiedLead,
            sessionKey: `${flow}-${Date.now()}`
        };
    }, []);

    const launchDemo = useCallback((flow, baseSession) => {
        const nextSession = buildDemoSession(flow, baseSession);

        if (flow === 'live-demo') {
            setActiveIndex(CARDS.findIndex((card) => card.id === 'live-demo'));
            setLiveDemoSession(nextSession);
            return;
        }

        if (flow === 'ai-interview') {
            setActiveIndex(CARDS.findIndex((card) => card.id === 'ai-interview'));
            setInterviewDemoSession(nextSession);
        }
    }, [buildDemoSession]);

    const beginDemoSequence = useCallback((firstFlow) => {
        if (!verifiedLeadSession) {
            setStartChoiceOpen(false);
            setDemoModalOpen(true);
            return;
        }

        const secondFlow = firstFlow === 'live-demo' ? 'ai-interview' : 'live-demo';

        setLiveDemoSession(null);
        setInterviewDemoSession(null);
        setCompletedFlows([]);
        setFollowUpPrompt(null);
        setDemoSequence([firstFlow, secondFlow]);
        setStartChoiceOpen(false);
        launchDemo(firstFlow, verifiedLeadSession);
    }, [launchDemo, verifiedLeadSession]);

    const handleDemoCompleted = useCallback((completedFlow) => {
        setCompletedFlows((current) => {
            if (current.includes(completedFlow)) {
                return current;
            }

            const nextCompleted = [...current, completedFlow];
            const nextFlow = demoSequence.find((flow) => flow !== completedFlow && !nextCompleted.includes(flow));

            if (nextFlow) {
                setFollowUpPrompt({ completedFlow, nextFlow });
            } else {
                setVerifiedLeadSession(null);
                setDemoSequence([]);
                clearPublicDemoLeadSession();
            }

            return nextCompleted;
        });
    }, [demoSequence]);

    const handlePrevCard = () => {
        setIsPaused(true);
        setActiveIndex((currentIndex) => (currentIndex - 1 + CARDS.length) % CARDS.length);
    };

    const handleNextCard = () => {
        setIsPaused(true);
        setActiveIndex((currentIndex) => (currentIndex + 1) % CARDS.length);
    };

    useEffect(() => {
        if (isRotationPaused) {
            return undefined;
        }

        const intervalId = window.setInterval(() => {
            setActiveIndex((currentIndex) => (currentIndex + 1) % CARDS.length);
        }, ROTATION_INTERVAL_MS);

        return () => window.clearInterval(intervalId);
    }, [isRotationPaused]);

    useEffect(() => {
        const handleShowcaseFocus = (event) => {
            const cardId = event?.detail?.cardId;
            if (!cardId) return;

            const nextIndex = CARDS.findIndex((card) => card.id === cardId);
            if (nextIndex >= 0) {
                setActiveIndex(nextIndex);
            }
        };

        window.addEventListener('hirexit:showcase-focus', handleShowcaseFocus);
        return () => window.removeEventListener('hirexit:showcase-focus', handleShowcaseFocus);
    }, []);

    const handleCardAction = (flowId) => {
        if (flowId === 'live-demo-end' || flowId === 'ai-interview-end') {
            handleDemoCompleted(flowId === 'live-demo-end' ? 'live-demo' : 'ai-interview');
            return;
        }

        if (verifiedLeadSession) {
            setStartChoiceOpen(true);
            return;
        }

        setFollowUpPrompt(null);
        setStartChoiceOpen(false);
        setDemoModalOpen(true);
    };

    const handleVerifiedSession = (session) => {
        setDemoModalOpen(false);
        setVerifiedLeadSession(session);
        setStartChoiceOpen(true);
    };

    return (
        <Box
            id="product-walkthrough"
            component="section"
            sx={{
                py: { xs: 5, md: 8 },
                position: 'relative',
                overflow: 'hidden',
                bgcolor: isDark ? '#1f2937' : '#f3f4f6'
            }}
        >
            <Container sx={{ maxWidth: '1540px !important', position: 'relative', zIndex: 1 }}>
                {/* <Stack spacing={1.6} alignItems="center" textAlign="center" sx={{ mb: { xs: 4.5, md: 6 } }}>
                    <Chip
                        label="PRODUCT WALKTHROUGH"
                        sx={{
                            height: 38,
                            px: 1.3,
                            borderRadius: 999,
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                            color: 'primary.main',
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                            fontWeight: 900,
                            letterSpacing: '0.12em'
                        }}
                    />

                    <Typography sx={{ maxWidth: 820, fontSize: { xs: '1.9rem', md: '3rem' }, lineHeight: { xs: 1.12, md: 1.06 }, fontWeight: 900, letterSpacing: '-0.045em', color: 'text.primary' }}>
                        Product previews for live demo calls, AI interviews,     and dashboard visibility
                    </Typography>

                    <Typography sx={{ maxWidth: 760, color: 'text.secondary', fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.75 }}>
                        The center card rotates every 3 seconds so visitors can quickly understand the platform without opening a separate flow.
                    </Typography>
                </Stack> */}

                <Box
                    onMouseEnter={() => setIsPaused(true)}
                    onMouseLeave={() => setIsPaused(false)}
                    sx={{ position: 'relative', minHeight: { xs: 840, md: 860 }, maxWidth: 1400, mx: 'auto' }}
                >
                    <Button
                        type="button"
                        onClick={handlePrevCard}
                        aria-label="Show previous preview"
                        sx={{
                            position: 'absolute',
                            left: { xs: '32%', md: -22 },
                            top: { xs: 'auto', md: '50%' },
                            bottom: { xs: 32, md: 'auto' },
                            minWidth: 0,
                            width: { xs: 40, md: 54 },
                            height: { xs: 40, md: 54 },
                            borderRadius: '50%',
                            transform: { xs: 'translateX(-50%)', md: 'translateY(-50%)' },
                            zIndex: 10,
                            p: 0,
                            color: 'text.primary',
                            bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.88 : 0.94),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            boxShadow: isDark
                                ? '0 20px 36px -28px rgba(2, 6, 23, 0.92)'
                                : '0 18px 34px -24px rgba(15, 23, 42, 0.24)',
                            '&:hover': {
                                bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.96 : 1),
                                borderColor: alpha(theme.palette.primary.main, 0.32)
                            }
                        }}
                    >
                        <ChevronLeft size={22} />
                    </Button>

                    <Button
                        type="button"
                        onClick={handleNextCard}
                        aria-label="Show next preview"
                        sx={{
                            position: 'absolute',
                            right: { xs: '32%', md: -22 },
                            top: { xs: 'auto', md: '50%' },
                            bottom: { xs: 32, md: 'auto' },
                            minWidth: 0,
                            width: { xs: 40, md: 54 },
                            height: { xs: 40, md: 54 },
                            borderRadius: '50%',
                            transform: { xs: 'translateX(50%)', md: 'translateY(-50%)' },
                            zIndex: 10,
                            p: 0,
                            color: 'text.primary',
                            bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.88 : 0.94),
                            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
                            boxShadow: isDark
                                ? '0 20px 36px -28px rgba(2, 6, 23, 0.92)'
                                : '0 18px 34px -24px rgba(15, 23, 42, 0.24)',
                            '&:hover': {
                                bgcolor: alpha(isDark ? '#0f172a' : '#ffffff', isDark ? 0.96 : 1),
                                borderColor: alpha(theme.palette.primary.main, 0.32)
                            }
                        }}
                    >
                        <ChevronRight size={22} />
                    </Button>

                    {CARDS.map((card, index) => {
                        const accent = theme.palette[card.accentKey].main;
                        const placement = getPlacement(index, activeIndex, CARDS.length);
                        const isActive = index === activeIndex;

                        return (
                            <ShowcaseCard
                                key={card.id}
                                card={card}
                                placement={placement}
                                isActive={isActive}
                                accent={accent}
                                secondaryAccent={theme.palette.secondary.main}
                                isDark={isDark}
                                theme={theme}
                                liveDemoSession={liveDemoSession}
                                interviewDemoSession={interviewDemoSession}
                                onActivate={() => setActiveIndex(index)}
                                onAction={handleCardAction}
                            />
                        );
                    })}
                </Box>

            </Container>

            <LiveDemoModal
                open={demoModalOpen}
                flow="demo-suite"
                onClose={() => setDemoModalOpen(false)}
                onVerified={handleVerifiedSession}
            />

            <Dialog
                open={startChoiceOpen}
                onClose={() => setStartChoiceOpen(false)}
                fullWidth
                maxWidth="xs"
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        bgcolor: isDark ? '#0f172a' : '#ffffff',
                        backgroundImage: 'none'
                    }
                }}
            >
                <DialogContent sx={{ pt: 3.5 }}>
                    <Stack spacing={1.2} textAlign="center">
                        <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: 'text.primary' }}>
                            Which demo should start first?
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                            Your form is already verified. Choose whether to begin with the AI call demo or the AI interview demo.
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0, display: 'grid', gridTemplateColumns: '1fr', gap: 1.25 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => beginDemoSequence('live-demo')}
                        sx={{ minHeight: 50, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        Start AI Call First
                    </Button>
                    <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => beginDemoSequence('ai-interview')}
                        sx={{ minHeight: 50, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        Start AI Interview First
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={Boolean(followUpPrompt)}
                onClose={() => setFollowUpPrompt(null)}
                fullWidth
                maxWidth="xs"
                PaperProps={{
                    sx: {
                        borderRadius: 4,
                        bgcolor: isDark ? '#0f172a' : '#ffffff',
                        backgroundImage: 'none'
                    }
                }}
            >
                <DialogContent sx={{ pt: 3.5 }}>
                    <Stack spacing={1.2} textAlign="center">
                        <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: 'text.primary' }}>
                            {followUpPrompt?.nextFlow === 'ai-interview' ? 'Take the AI Interview Demo next?' : 'Take the AI Call Demo next?'}
                        </Typography>
                        <Typography sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                            {followUpPrompt?.nextFlow === 'ai-interview'
                                ? 'The AI call demo is complete. You can continue directly into the AI interview demo now.'
                                : 'The AI interview demo is complete. You can continue directly into the AI call demo now.'}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3, pt: 0, justifyContent: 'center', gap: 1.25 }}>
                    <Button
                        variant="outlined"
                        onClick={() => {
                            setFollowUpPrompt(null);
                            setDemoSequence([]);
                        }}
                        sx={{ minWidth: 120, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        No
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (followUpPrompt?.nextFlow) {
                                launchDemo(followUpPrompt.nextFlow, verifiedLeadSession);
                            }
                            setFollowUpPrompt(null);
                        }}
                        sx={{ minWidth: 120, borderRadius: 3, fontWeight: 800, textTransform: 'none' }}
                    >
                        Yes
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default RotatingShowcase;
