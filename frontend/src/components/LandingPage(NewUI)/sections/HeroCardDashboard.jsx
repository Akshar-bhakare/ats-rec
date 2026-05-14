import { Avatar, Box, Chip, Stack, Typography, alpha } from '@mui/material';
import { ArrowUpRight, Briefcase, FileText, Sparkles, Users } from 'lucide-react';

const METRICS = [
    { label: 'Roles', value: '18', delta: '+6', accent: 'orange', icon: Briefcase },
    { label: 'Candidates', value: '348', delta: '+72', accent: 'blue', icon: Users },
    { label: 'AI Interviews', value: '31', delta: 'Live', accent: 'emerald', icon: Sparkles },
    { label: 'Reports', value: '24', delta: 'Ready', accent: 'cyan', icon: FileText }
];

const PIPELINE = [
    { stage: 'Screening', count: 62, fill: 86 },
    { stage: 'Interview', count: 28, fill: 63 },
    { stage: 'Offer', count: 9, fill: 41 }
];

const SHORTLIST = [
    { name: 'Candidate A1', initials: 'A1', role: 'Frontend Engineer', score: 96, note: 'Panel-ready' },
    { name: 'Candidate B2', initials: 'B2', role: 'Growth Manager', score: 91, note: 'Needs review' },
    { name: 'Candidate C3', initials: 'C3', role: 'AI Recruiter', score: 88, note: 'Check availability' }
];

const VELOCITY = [42, 58, 66, 82, 74, 94];
const dashboardFontFamily = "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif";

const HeroCardDashboard = ({ isDark, theme, showcaseTitle }) => {
    const orange = theme.palette.primary.main;
    const blue = theme.palette.secondary.main;
    const emerald = '#10b981';
    const cyan = '#0ea5e9';
    const borderColor = isDark ? 'rgba(255,255,255,0.08)' : '#dbe4f0';
    const surface = isDark ? '#0f172a' : '#ffffff';
    const mutedSurface = isDark ? 'rgba(255,255,255,0.04)' : '#f8fafc';
    const shellShadow = `0 28px 60px -45px ${alpha('#0f172a', 0.55)}`;

    const accentMap = {
        orange,
        blue,
        emerald,
        cyan
    };
    const panelTitleSx = {
        fontFamily: dashboardFontFamily,
        fontSize: { xs: '0.86rem', md: '1.02rem' },
        lineHeight: 1.35,
        letterSpacing: '-0.01em',
        fontWeight: 850
    };
    const bodyTextSx = {
        fontFamily: dashboardFontFamily,
        fontSize: { xs: '0.72rem', md: '0.82rem' },
        lineHeight: 1.6,
        color: 'text.secondary'
    };
    const metricValueSx = {
        fontFamily: dashboardFontFamily,
        fontSize: { xs: '1.1rem', md: '1.38rem' },
        lineHeight: 1.12,
        letterSpacing: '-0.02em',
        fontWeight: 850
    };

    return (
        <Box
            sx={{
                fontFamily: dashboardFontFamily,
                '& .MuiTypography-root': {
                    fontFamily: dashboardFontFamily
                },
                '& .MuiChip-root': {
                    fontFamily: dashboardFontFamily
                },
                '& .MuiChip-label': {
                    fontFamily: dashboardFontFamily,
                    letterSpacing: '-0.01em'
                }
            }}
        >
            {showcaseTitle && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mb: { xs: 1.4, md: 1.7 } }}>
                    <Box
                        sx={{
                            px: 2.4,
                            py: 0.85,
                            borderRadius: 999,
                            border: `1px solid ${alpha(orange, 0.16)}`,
                            bgcolor: alpha(orange, 0.08)
                        }}
                    >
                        <Typography
                            sx={{
                                fontFamily: dashboardFontFamily,
                                fontSize: { xs: '0.95rem', md: '1rem' },
                                fontWeight: 900,
                                letterSpacing: '-0.01em',
                                color: 'text.primary'
                            }}
                        >
                            {showcaseTitle}
                        </Typography>
                    </Box>
                </Box>
            )}

            <Box
                sx={{
                    p: { xs: 1, md: 2 },
                    borderRadius: { xs: 3, md: 5 },
                    bgcolor: surface,
                    border: `1px solid ${alpha(orange, 0.35)}`,
                    borderTop: { xs: `3px solid ${orange}`, md: `4px solid ${orange}` },
                    boxShadow: shellShadow,
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Subtle BG Accent */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -100,
                        right: -100,
                        width: 280,
                        height: 280,
                        borderRadius: '50%',
                        background: `radial-gradient(circle, ${alpha(orange, 0.08)} 0%, transparent 70%)`,
                        pointerEvents: 'none'
                    }}
                />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '0.95fr 1.05fr 0.95fr' },
                        gap: { xs: 1, md: 2 },
                        alignItems: 'stretch',
                        position: 'relative'
                    }}
                >
                    <Box
                        sx={{
                            p: { xs: 1.25, md: 1.75 },
                            borderRadius: 3,
                            bgcolor: mutedSurface,
                            border: `1px solid ${borderColor}`,
                            display: 'grid',
                            alignContent: 'start',
                            gap: 1.25
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={panelTitleSx}>Core metrics</Typography>
                            <Chip
                                label="This week"
                                size="small"
                                sx={{
                                    bgcolor: alpha(orange, 0.08),
                                    color: orange,
                                    fontWeight: 900,
                                    fontSize: '0.68rem',
                                    height: 22
                                }}
                            />
                        </Stack>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, 1fr)',
                            gap: { xs: 1.25, md: 1.4 },
                        }}>
                            {METRICS.map((metric) => {
                                const accent = accentMap[metric.accent];

                                return (
                                    <Box
                                        key={metric.label}
                                        sx={{
                                            p: { xs: 0.85, md: 1.4 },
                                            borderRadius: 2.2,
                                            bgcolor: isDark ? 'rgba(30, 41, 59, 0.5)' : '#ffffff',
                                            border: `1px solid ${alpha(accent, 0.16)}`,
                                            boxShadow: isDark ? 'none' : '0 2px 8px -2px rgba(0,0,0,0.02)',
                                            transition: 'transform 0.2s ease',
                                            '&:hover': {
                                                transform: 'translateY(-2px)'
                                            }
                                        }}
                                    >
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                                            <Box sx={{
                                                width: { xs: 28, md: 34 },
                                                height: { xs: 28, md: 34 },
                                                borderRadius: 2,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                bgcolor: alpha(accent, 0.14),
                                                color: accent,
                                                boxShadow: `0 4px 12px ${alpha(accent, 0.15)}`
                                            }}>
                                                <metric.icon size={14} />
                                            </Box>
                                            <Typography sx={{ fontSize: '0.68rem', fontWeight: 900, color: accent }}>
                                                {metric.delta}
                                            </Typography>
                                        </Stack>
                                        <Typography sx={{ ...bodyTextSx, mb: 0.2, color: 'text.secondary' }}>
                                            {metric.label}
                                        </Typography>
                                        <Typography sx={{ ...metricValueSx, fontSize: { xs: '1.1rem', md: '1.45rem' } }}>
                                            {metric.value}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gap: { xs: 1, md: 2 } }}>
                        <Box
                            sx={{
                                p: { xs: 1, md: 2 },
                                borderRadius: 3,
                                bgcolor: mutedSurface,
                                border: `1px solid ${borderColor}`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
                                <Box>
                                    <Typography sx={panelTitleSx}>Hiring velocity</Typography>
                                    <Typography sx={{ ...bodyTextSx, display: { xs: 'none', sm: 'block' }, mt: 0.1 }}>
                                        Faster movement this week.
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography sx={{ fontSize: '0.74rem', fontWeight: 900, color: orange }}>
                                        +24%
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase' }}>
                                        Growth
                                    </Typography>
                                </Box>
                            </Stack>

                            <Stack direction="row" spacing={0.6} alignItems="flex-end" sx={{ height: { xs: 60, md: 140 } }}>
                                {VELOCITY.map((value, index) => (
                                    <Box key={`${value}-${index}`} sx={{ flex: 1, display: 'grid', justifyItems: 'center' }}>
                                        <Box
                                            sx={{
                                                width: '100%',
                                                maxWidth: 42,
                                                height: `${value}%`,
                                                minHeight: { xs: 10, md: 18 },
                                                borderRadius: { xs: '6px 6px 2px 2px', md: '12px 12px 4px 4px' },
                                                bgcolor: index === VELOCITY.length - 1 ? orange : alpha(blue, 0.15 + (index * 0.1)),
                                                transition: 'height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                                                '&:hover': {
                                                    bgcolor: index === VELOCITY.length - 1 ? orange : alpha(blue, 0.4)
                                                }
                                            }}
                                        />
                                    </Box>
                                ))}
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                p: { xs: 1, md: 2 },
                                borderRadius: 3,
                                bgcolor: mutedSurface,
                                border: `1px solid ${borderColor}`
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: { xs: 1, md: 1.75 } }}>
                                <Typography sx={panelTitleSx}>Pipeline motion</Typography>
                                <Chip label="Live queue" size="small" sx={{ bgcolor: alpha(orange, 0.08), color: orange, fontWeight: 900, fontSize: { xs: '0.6rem', md: '0.68rem' }, height: { xs: 18, md: 22 } }} />
                            </Stack>

                            <Stack spacing={{ xs: 0.85, md: 1.25 }}>
                                {PIPELINE.map((stage, index) => {
                                    const accent = index === 0 ? orange : index === 1 ? blue : emerald;

                                    return (
                                        <Box key={stage.stage} sx={{
                                            p: { xs: 0.75, md: 1.25 },
                                            borderRadius: { xs: 2, md: 2.8 },
                                            bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                                            border: `1px solid ${alpha(accent, 0.12)}`,
                                            display: index > 1 ? { xs: 'none', md: 'block' } : 'block',
                                            '&:hover': {
                                                borderColor: alpha(accent, 0.3)
                                            }
                                        }}>
                                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: { xs: 0.5, md: 0.8 } }}>
                                                <Typography sx={{ ...panelTitleSx, fontSize: { xs: '0.78rem', md: '0.9rem' } }}>{stage.stage}</Typography>
                                                <Typography sx={{ ...panelTitleSx, fontSize: { xs: '0.9rem', md: '1rem' }, color: accent }}>{stage.count}</Typography>
                                            </Stack>
                                            <Box sx={{ height: { xs: 5, md: 8 }, borderRadius: 999, bgcolor: alpha(accent, 0.1), overflow: 'hidden' }}>
                                                <Box sx={{
                                                    height: '100%',
                                                    width: `${stage.fill}%`,
                                                    borderRadius: 999,
                                                    background: `linear-gradient(90deg, ${accent} 0%, ${alpha(accent, 0.6)} 100%)`,
                                                    transition: 'width 1s ease-in-out'
                                                }} />
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Box>
                    </Box>

                    <Box sx={{ display: 'grid', gap: { xs: 1, md: 2 } }}>
                        <Box
                            sx={{
                                p: { xs: 1, md: 2 },
                                borderRadius: 3,
                                bgcolor: mutedSurface,
                                border: `1px solid ${borderColor}`
                            }}
                        >
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: { xs: 1, md: 1.75 } }}>
                                <Typography sx={panelTitleSx}>AI shortlist</Typography>
                                <Chip label="Top candidates" size="small" sx={{ bgcolor: alpha(blue, 0.08), color: blue, fontWeight: 900, fontSize: { xs: '0.6rem', md: '0.68rem' }, height: { xs: 18, md: 22 } }} />
                            </Stack>

                            <Stack spacing={{ xs: 0.65, md: 1 }}>
                                {SHORTLIST.map((candidate, index) => (
                                    <Box key={candidate.name} sx={{
                                        p: { xs: 0.65, md: 1.1 },
                                        borderRadius: { xs: 2, md: 2.8 },
                                        bgcolor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#ffffff',
                                        border: `1px solid ${alpha(candidate.score >= 90 ? emerald : blue, 0.1)}`,
                                        display: index > 1 ? { xs: 'none', md: 'block' } : 'block',
                                        '&:hover': {
                                            transform: 'scale(1.02)',
                                            transition: 'transform 0.2s ease'
                                        }
                                    }}>
                                        <Stack direction="row" spacing={1.25} alignItems="center">
                                            <Avatar sx={{
                                                width: { xs: 24, md: 36 },
                                                height: { xs: 24, md: 36 },
                                                bgcolor: alpha(candidate.score >= 90 ? emerald : blue, 0.15),
                                                color: candidate.score >= 90 ? emerald : blue,
                                                fontSize: { xs: '0.65rem', md: '0.85rem' },
                                                fontWeight: 800
                                            }}>
                                                {candidate.initials}
                                            </Avatar>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                                    <Typography sx={{ ...panelTitleSx, fontSize: { xs: '0.8rem', md: '0.92rem' } }} noWrap>
                                                        {candidate.name}
                                                    </Typography>
                                                    <Typography sx={{ ...panelTitleSx, fontSize: { xs: '0.72rem', md: '0.8rem' }, color: candidate.score >= 90 ? emerald : blue }}>
                                                        {candidate.score}%
                                                    </Typography>
                                                </Stack>
                                                <Typography sx={{ ...bodyTextSx, fontSize: { xs: '0.65rem', md: '0.74rem' } }} noWrap>
                                                    {candidate.role}
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>

                        <Box
                            sx={{
                                p: { xs: 1, md: 2 },
                                borderRadius: 3,
                                bgcolor: surface,
                                border: `1px solid ${alpha(orange, 0.25)}`,
                                background: isDark
                                    ? `linear-gradient(145deg, rgba(30, 41, 59, 0.9) 0%, ${alpha(orange, 0.12)} 100%)`
                                    : `linear-gradient(145deg, rgba(255,255,255,1) 0%, ${alpha(orange, 0.05)} 100%)`,
                                position: 'relative',
                                overflow: 'hidden'
                            }}
                        >
                            <Box sx={{ position: 'relative', zIndex: 1 }}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5} sx={{ mb: { xs: 1, md: 1.5 } }}>
                                    <Box>
                                        <Typography sx={{ ...panelTitleSx, color: orange }}>Next recommended action</Typography>
                                        <Typography sx={{ ...bodyTextSx, fontSize: '0.78rem', mt: 0.3, display: { xs: 'none', md: 'block' } }}>
                                            Move the strongest candidate forward.
                                        </Typography>
                                    </Box>
                                    <Box sx={{ p: 0.75, borderRadius: 2, bgcolor: alpha(orange, 0.1), color: orange }}>
                                        <ArrowUpRight size={18} />
                                    </Box>
                                </Stack>

                                <Typography sx={{ ...panelTitleSx, fontSize: { xs: '0.88rem', md: '1.05rem' }, mb: { xs: 0.2, md: 0.5 }, fontWeight: 900 }}>
                                    Candidate A1
                                </Typography>
                                <Typography sx={{ ...bodyTextSx, mb: { xs: 1, md: 1.75 }, fontSize: '0.82rem', color: 'text.secondary', display: { xs: 'none', md: 'block' } }}>
                                    Top-tier performance with a 96 AI score. High cultural fit and deep React expertise.
                                </Typography>

                                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                                    <Chip label="96 AI score" size="small" sx={{ bgcolor: alpha(blue, 0.05), border: `1px solid ${alpha(blue, 0.1)}`, color: blue, fontWeight: 800, fontSize: { xs: '0.58rem', md: '0.68rem' } }} />
                                    <Chip label="Panel-ready" size="small" sx={{ bgcolor: alpha(emerald, 0.05), border: `1px solid ${alpha(emerald, 0.1)}`, color: emerald, fontWeight: 800, fontSize: { xs: '0.58rem', md: '0.68rem' } }} />
                                    <Chip label="High Potential" size="small" sx={{ bgcolor: alpha(orange, 0.05), border: `1px solid ${alpha(orange, 0.1)}`, color: orange, fontWeight: 800, fontSize: { xs: '0.58rem', md: '0.68rem' }, display: { xs: 'none', md: 'inline-flex' } }} />
                                </Stack>
                            </Box>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default HeroCardDashboard;
