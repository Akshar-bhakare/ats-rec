/* eslint-disable no-unused-vars */
import { useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Card, CardContent, Grid, List, ListItem, ListItemIcon, ListItemText, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { ArrowRight, Brain, Building2, Check, CheckCircle2, ChevronDown, Compass, GitCompareArrows, Hourglass, Layers, Network, RefreshCw, Scale, SearchCheck, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import SeoHead from '../components/ui/SeoHead';
import SectionShell from '../../ui/SectionShell';
import {
    buildFaqSchema,
    buildSoftwareApplicationSchema,
    buildWebPageSchema,
    resolveSiteOrigin,
} from '../lib/seoSchema';

const HERO_HEADLINE_FONT = '"Inter", "Segoe UI", sans-serif';

const toSectionSlug = (value = '') =>
    value
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const HeroSection = ({ page }) => {
    const theme = useTheme();
    const { hero } = page;
    const isAboutPage = page.pathname === '/about';
    const isWhyUsPage = page.pathname === '/why-us';
    const isIndustriesPage = page.pathname === '/industries';
    const whyUsHeroIcons = {
        synthesis: Brain,
        engagement: Network,
        bias: Scale,
        ats: Layers,
        analytics: SearchCheck,
        guardrails: ShieldCheck,
    };

    return (
        <SectionShell
            gradient
            grid
            maxWidth="xl"
            sx={{
                pt: { xs: 14, md: 18 },
                pb: { xs: 10, md: 12 },
                background: `
                    radial-gradient(circle at 50% 18%, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 26%),
                    radial-gradient(circle at 50% 52%, rgba(255, 212, 170, 0.24) 0%, transparent 38%),
                    linear-gradient(180deg, #ffffff 0%, #fffaf3 100%)
                `,
            }}
        >
            {isAboutPage ? (
                <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', lg: '1fr minmax(320px, 420px)' },
                            alignItems: 'center',
                            gap: { xs: 5, md: 6, lg: 8 },
                        }}
                    >
                        <Stack spacing={{ xs: 3.5, md: 4.5 }}>
                            <Box
                                sx={{
                                    width: 'fit-content',
                                    px: { xs: 2, md: 2.4 },
                                    py: { xs: 1, md: 1.05 },
                                    borderRadius: '999px',
                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                }}
                            >
                                <Typography
                                    sx={{
                                        color: 'primary.main',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '0.66rem', md: '0.74rem' },
                                        fontWeight: 800,
                                        letterSpacing: '0.04em',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    {hero.eyebrow}
                                </Typography>
                            </Box>

                            <Typography
                                component="h1"
                                sx={{
                                    maxWidth: 900,
                                    color: '#111111',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontWeight: 800,
                                    letterSpacing: '-0.03em',
                                    lineHeight: 1.12,
                                    fontSize: { xs: '2rem', sm: '2.6rem', md: '3.2rem', lg: '3.6rem' },
                                }}
                            >
                                {hero.title}
                            </Typography>

                            <Typography
                                sx={{
                                    maxWidth: 900,
                                    color: '#4b5b75',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontSize: { xs: '0.84rem', md: '0.9rem', lg: '0.94rem' },
                                    lineHeight: { xs: 1.6, md: 1.56 },
                                }}
                            >
                                {hero.description}
                            </Typography>

                            <Box
                                sx={{
                                    borderTop: `1px solid ${alpha('#182033', 0.12)}`,
                                    pt: { xs: 3, md: 4 },
                                }}
                            >
                                <Stack spacing={0.5} sx={{ maxWidth: 360 }}>
                                    <Typography
                                        sx={{
                                            color: '#111111',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '1.38rem', md: '1.6rem' },
                                            fontWeight: 800,
                                            letterSpacing: '-0.035em',
                                            lineHeight: 1.1,
                                        }}
                                    >
                                        {hero.signatureName}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#94a3b8',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '0.7rem', md: '0.78rem' },
                                            fontWeight: 800,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                            lineHeight: 1.35,
                                        }}
                                    >
                                        {hero.signatureRole}
                                    </Typography>
                                </Stack>
                            </Box>
                        </Stack>

                        {/* Right-side pipeline mock card */}
                        <Box
                            sx={{
                                position: 'relative',
                                width: '100%',
                                maxWidth: { xs: 420, lg: 420 },
                                justifySelf: { xs: 'center', lg: 'end' },
                                pt: { xs: 1, md: 2 },
                                pb: { xs: 7, md: 6 },
                                px: { xs: 0.5, md: 0 },
                            }}
                        >
                            <Box
                                sx={{
                                    position: 'absolute',
                                    inset: { xs: '6% 10% auto 10%', md: '9% 10% auto 10%' },
                                    height: { xs: 180, md: 180 },
                                    borderRadius: '36px',
                                    background: `radial-gradient(circle at center, ${alpha(theme.palette.primary.main, 0.12)} 0%, ${alpha('#ffd7b0', 0.22)} 38%, transparent 72%)`,
                                    filter: 'blur(8px)',
                                }}
                            />
                            <Card
                                sx={{
                                    position: 'relative',
                                    overflow: 'visible',
                                    borderRadius: '18px',
                                    border: `1px solid ${alpha('#d7dfeb', 0.95)}`,
                                    background: 'linear-gradient(180deg, #ffffff 0%, #fdfefe 100%)',
                                    boxShadow: '0 20px 42px -34px rgba(15, 23, 42, 0.32)',
                                }}
                            >
                                <CardContent sx={{ p: { xs: 2, md: 2 }, '&:last-child': { pb: { xs: 2, md: 2 } } }}>
                                    <Stack spacing={{ xs: 1.5, md: 1.4 }}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                            }}
                                        >
                                            <Stack direction="row" spacing={0.8}>
                                                {[0, 1].map((dot) => (
                                                    <Box
                                                        key={dot}
                                                        sx={{
                                                            width: 8,
                                                            height: 8,
                                                            borderRadius: '50%',
                                                            backgroundColor: alpha('#cfd8e6', 0.9),
                                                        }}
                                                    />
                                                ))}
                                            </Stack>
                                            <Box
                                                sx={{
                                                    px: 1.15,
                                                    py: 0.32,
                                                    borderRadius: '999px',
                                                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                                                }}
                                            >
                                                <Typography
                                                    sx={{
                                                        color: 'primary.main',
                                                        fontFamily: HERO_HEADLINE_FONT,
                                                        fontSize: { xs: '0.68rem', md: '0.7rem' },
                                                        fontWeight: 700,
                                                        letterSpacing: '0.01em',
                                                    }}
                                                >
                                                    AI Hiring Pipeline
                                                </Typography>
                                            </Box>
                                            <Box sx={{ width: 20 }} />
                                        </Box>

                                        <Box
                                            sx={{
                                                borderTop: `1px solid ${alpha('#d8e1ee', 0.88)}`,
                                                pt: { xs: 0.8, md: 0.8 },
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                                                    rowGap: 0.6,
                                                    textAlign: 'center',
                                                    mb: { xs: 1.5, md: 2 },
                                                }}
                                            >
                                                {[
                                                    { label: 'Applied', value: '210', color: '#64748b' },
                                                    { label: 'Screening', value: '75', color: theme.palette.primary.main },
                                                    { label: 'Interview', value: '23', color: '#ff7b55' },
                                                    { label: 'Offered', value: '4', color: '#16a34a' },
                                                    { label: 'Hired', value: '89', color: '#1e3a8a' },
                                                ].map((column) => (
                                                    <Box key={column.label}>
                                                        <Typography
                                                            sx={{
                                                                color: column.color,
                                                                fontFamily: HERO_HEADLINE_FONT,
                                                                fontSize: { xs: '0.68rem', md: '0.7rem' },
                                                                fontWeight: 700,
                                                                lineHeight: 1.2,
                                                            }}
                                                        >
                                                            {column.label}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                mt: 0.25,
                                                                color: '#64748b',
                                                                fontFamily: HERO_HEADLINE_FONT,
                                                                fontSize: { xs: '0.62rem', md: '0.64rem' },
                                                                fontWeight: 700,
                                                            }}
                                                        >
                                                            {column.value}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Box>

                                            {[
                                                {
                                                    name: 'Alex',
                                                    role: 'Programmer Analyst',
                                                    accent: 'linear-gradient(135deg, #d8d0ff 0%, #8ec5fc 100%)',
                                                    status: '98% Match',
                                                    statusBg: alpha('#22c55e', 0.14),
                                                    statusColor: '#16a34a',
                                                },
                                                {
                                                    name: 'Max',
                                                    role: 'Full stack developer Interview',
                                                    accent: 'linear-gradient(135deg, #7dd3fc 0%, #2563eb 100%)',
                                                    status: 'Pending',
                                                    statusBg: alpha('#f97316', 0.13),
                                                    statusColor: '#ea580c',
                                                },
                                            ].map((candidate, index, list) => (
                                                <Box
                                                    key={candidate.name}
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: 1,
                                                        py: { xs: 0.85, md: 0.82 },
                                                        borderTop: `1px solid ${alpha('#d8e1ee', index === 0 ? 0 : 0.8)}`,
                                                        borderBottom: index === list.length - 1
                                                            ? `1px solid ${alpha('#d8e1ee', 0.8)}`
                                                            : 'none',
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1.05,
                                                            minWidth: 0,
                                                            flex: 1,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: { xs: 32, md: 34 },
                                                                height: { xs: 32, md: 34 },
                                                                borderRadius: '50%',
                                                                flexShrink: 0,
                                                                background: candidate.accent,
                                                                boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.88)',
                                                            }}
                                                        />
                                                        <Box sx={{ minWidth: 0 }}>
                                                            <Typography
                                                                sx={{
                                                                    color: '#111111',
                                                                    fontFamily: HERO_HEADLINE_FONT,
                                                                    fontSize: { xs: '0.78rem', md: '0.8rem' },
                                                                    fontWeight: 700,
                                                                    lineHeight: 1.2,
                                                                }}
                                                            >
                                                                {candidate.name}
                                                            </Typography>
                                                            <Typography
                                                                sx={{
                                                                    mt: 0.15,
                                                                    color: '#64748b',
                                                                    fontFamily: HERO_HEADLINE_FONT,
                                                                    fontSize: { xs: '0.66rem', md: '0.68rem' },
                                                                    fontWeight: 400,
                                                                    lineHeight: 1.3,
                                                                }}
                                                            >
                                                                {candidate.role}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    <Box
                                                        sx={{
                                                            px: { xs: 1, md: 1 },
                                                            py: 0.5,
                                                            borderRadius: '6px',
                                                            bgcolor: candidate.statusBg,
                                                            color: candidate.statusColor,
                                                            fontFamily: HERO_HEADLINE_FONT,
                                                            fontSize: { xs: '0.62rem', md: '0.64rem' },
                                                            fontWeight: 700,
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {candidate.status}
                                                    </Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Stack>
                                </CardContent>
                            </Card>

                            <Card
                                sx={{
                                    position: 'absolute',
                                    left: { xs: 18, md: -10 },
                                    bottom: { xs: 4, md: 0 },
                                    width: { xs: 148, md: 155 },
                                    borderRadius: '12px',
                                    border: `1px solid ${alpha('#d9e2ef', 0.98)}`,
                                    boxShadow: '0 12px 24px -22px rgba(15, 23, 42, 0.24)',
                                    background: '#ffffff',
                                }}
                            >
                                <CardContent sx={{ p: { xs: 0.82, md: 0.8 } }}>
                                    <Stack spacing={0.38}>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 0.32,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 6,
                                                    height: 6,
                                                    borderRadius: '50%',
                                                    bgcolor: theme.palette.primary.main,
                                                }}
                                            />
                                            <Typography
                                                sx={{
                                                    color: '#64748b',
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '0.58rem', md: '0.6rem' },
                                                    fontWeight: 800,
                                                    letterSpacing: '0.04em',
                                                    textTransform: 'uppercase',
                                                }}
                                            >
                                                Insights
                                            </Typography>
                                        </Box>
                                        <Typography
                                            sx={{
                                                color: '#334155',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '0.62rem', md: '0.64rem' },
                                                lineHeight: 1.4,
                                            }}
                                        >
                                            Bias detected in recent panel review. Adjusting criteria...
                                        </Typography>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    </Box>
                </Box>
            ) : isWhyUsPage ? (
                <Box sx={{ maxWidth: 1120, mx: 'auto', textAlign: 'center' }}>
                    <Stack spacing={{ xs: 2.5, md: 3.1 }} alignItems="center">
                        <Stack spacing={{ xs: 1.1, md: 1.35 }} alignItems="center">
                            {(hero.titleLines || []).map((line, index) => (
                                <Box
                                    key={`${line.text}-${index}`}
                                    sx={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                >
                                    <Typography
                                        component="h1"
                                        sx={{
                                            color: '#182033',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontWeight: 800,
                                            letterSpacing: '-0.05em',
                                            lineHeight: { xs: 1.02, md: 0.98 },
                                            fontSize: { xs: '1.9rem', sm: '2.6rem', md: '3.7rem', lg: '4.05rem' },
                                        }}
                                    >
                                        {line.text}
                                        {!!line.highlight && (
                                            <Box component="span" sx={{ color: 'primary.main' }}>
                                                {line.highlight}
                                            </Box>
                                        )}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>

                        <Typography
                            sx={{
                                maxWidth: 700,
                                color: '#4b5b75',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.92rem', md: '0.98rem' },
                                lineHeight: 1.48,
                            }}
                        >
                            {hero.description}
                        </Typography>

                        {!!hero.cards?.length && (
                            <Box
                                sx={{
                                    pt: { xs: 1.3, md: 2.2 },
                                    width: '100%',
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                                    gap: { xs: 2, md: 2.3 },
                                    alignItems: 'stretch',
                                }}
                            >
                                {hero.cards.map((card) => {
                                    const Icon = whyUsHeroIcons[card.icon] || Brain;

                                    return (
                                        <Card
                                            key={card.title}
                                            sx={{
                                                height: '100%',
                                                minHeight: { xs: 220, md: 206 },
                                                borderRadius: '16px',
                                                border: `1px solid ${alpha('#182033', 0.1)}`,
                                                boxShadow: '0 10px 24px -24px rgba(15, 23, 42, 0.16)',
                                                background: '#ffffff',
                                            }}
                                        >
                                            <CardContent sx={{ p: { xs: 2.35, md: 2.45 } }}>
                                                <Stack spacing={1.8} alignItems="flex-start">
                                                    <Box
                                                        sx={{
                                                            width: 38,
                                                            height: 38,
                                                            borderRadius: '9px',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            bgcolor: alpha(theme.palette.primary.main, 0.09),
                                                            color: 'primary.main',
                                                        }}
                                                    >
                                                        <Icon size={17} strokeWidth={2.05} />
                                                    </Box>
                                                    <Stack spacing={0.9} alignItems="flex-start">
                                                        <Typography
                                                            sx={{
                                                                color: '#182033',
                                                                fontFamily: HERO_HEADLINE_FONT,
                                                                fontSize: { xs: '1rem', md: '1.02rem' },
                                                                fontWeight: 800,
                                                                letterSpacing: '-0.03em',
                                                                lineHeight: 1.22,
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {card.title}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                color: '#4b5b75',
                                                                fontFamily: HERO_HEADLINE_FONT,
                                                                fontSize: { xs: '0.82rem', md: '0.84rem' },
                                                                lineHeight: 1.52,
                                                                textAlign: 'left',
                                                            }}
                                                        >
                                                            {card.description}
                                                        </Typography>
                                                    </Stack>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </Box>
                        )}
                    </Stack>
                </Box>
            ) : isIndustriesPage ? (
                <Box sx={{ maxWidth: 980, mx: 'auto', textAlign: 'center' }}>
                    <Stack spacing={{ xs: 1.1, md: 1.5 }} alignItems="center">
                        <Typography
                            component="h1"
                            sx={{
                                color: '#111111',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 800,
                                letterSpacing: '-0.05em',
                                lineHeight: { xs: 1.04, md: 1.01 },
                                fontSize: { xs: '2rem', sm: '2.55rem', md: '3rem', lg: '3.35rem' },
                            }}
                        >
                            {hero.title}
                        </Typography>
                        <Typography
                            sx={{
                                maxWidth: 620,
                                color: '#4b5b75',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.84rem', md: '0.9rem' },
                                lineHeight: 1.45,
                                fontWeight: 500,
                            }}
                        >
                            {hero.description}
                        </Typography>
                    </Stack>
                </Box>
            ) : (
                <Box sx={{ maxWidth: 1040, mx: 'auto', textAlign: 'center' }}>
                    <Stack spacing={3} alignItems="center">
                        <Typography
                            sx={{
                                color: 'primary.main',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.62rem', md: '0.72rem' },
                                fontWeight: 900,
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {hero.eyebrow}
                        </Typography>
                        <Typography
                            component="h1"
                            sx={{
                                maxWidth: 860,
                                color: '#182033',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 800,
                                letterSpacing: '-0.035em',
                                lineHeight: { xs: 1.12, md: 1.08 },
                                fontSize: { xs: '2.05rem', sm: '2.7rem', md: '3.95rem', lg: '4.35rem' },
                            }}
                        >
                            {hero.title}
                        </Typography>
                        <Typography
                            sx={{
                                maxWidth: 920,
                                color: '#697386',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '1rem', md: '1.08rem' },
                                lineHeight: { xs: 1.72, md: 1.68 },
                            }}
                        >
                            {hero.description}
                        </Typography>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                            <Button
                                component={RouterLink}
                                to={hero.primaryCta.to}
                                variant="contained"
                                sx={{
                                    minWidth: { xs: 200, md: 240 },
                                    py: { xs: 1.45, md: 1.7 },
                                    px: { xs: 4, md: 5.2 },
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontWeight: 850,
                                    fontSize: { xs: '1rem', md: '1.05rem' },
                                    boxShadow: `0 22px 48px -24px ${alpha(theme.palette.primary.main, 0.85)}`,
                                }}
                            >
                                {hero.primaryCta.label}
                            </Button>
                            <Button
                                component={RouterLink}
                                to={hero.secondaryCta.to}
                                variant="outlined"
                                endIcon={<ArrowRight size={18} />}
                                sx={{
                                    minWidth: { xs: 200, md: 240 },
                                    py: { xs: 1.45, md: 1.7 },
                                    px: { xs: 4, md: 5.2 },
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontWeight: 850,
                                    fontSize: { xs: '1rem', md: '1.05rem' },
                                    color: '#182033',
                                    borderColor: alpha('#182033', 0.16),
                                    '&:hover': {
                                        borderColor: alpha(theme.palette.primary.main, 0.34),
                                        bgcolor: alpha(theme.palette.primary.main, 0.04),
                                    },
                                }}
                            >
                                {hero.secondaryCta.label}
                            </Button>
                        </Stack>
                        {!!hero.highlights?.length && (
                            <Grid container spacing={{ xs: 2, md: 2.25 }} sx={{ pt: { xs: 1, md: 2 }, maxWidth: 1120, mx: 'auto' }}>
                                {hero.highlights.map((highlight) => (
                                    <Grid item xs={12} md={4} key={highlight}>
                                        <Card
                                            sx={{
                                                height: '100%',
                                                borderRadius: '20px',
                                                border: `1px solid ${alpha('#182033', 0.1)}`,
                                                boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.2)',
                                                background: '#ffffff',
                                            }}
                                        >
                                            <CardContent sx={{ p: { xs: 2.6, md: 2.8 } }}>
                                                <Stack direction="row" spacing={1.15} alignItems="flex-start">
                                                    <Box sx={{ mt: 0.14, width: 18, height: 18, display: 'grid', placeItems: 'center', color: 'primary.main', flexShrink: 0 }}>
                                                        <Check size={14} strokeWidth={2.8} />
                                                    </Box>
                                                    <Typography
                                                        sx={{
                                                            color: '#465467',
                                                            fontFamily: HERO_HEADLINE_FONT,
                                                            fontSize: { xs: '0.92rem', md: '0.9rem' },
                                                            lineHeight: 1.4,
                                                            fontWeight: 500,
                                                            textAlign: 'left',
                                                        }}
                                                    >
                                                        {highlight}
                                                    </Typography>
                                                </Stack>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                ))}
                            </Grid>
                        )}
                    </Stack>
                </Box>
            )}
        </SectionShell>
    );
};

const IndustriesSpotlightSection = ({ section, pathname }) => {
    const itemAnchors = useMemo(
        () =>
            (section?.items || []).map((item) => ({
                ...item,
                anchorId: item.anchorId || `industry-${toSectionSlug(item.title)}`,
            })),
        [section?.items]
    );
    const tabTargets = useMemo(
        () =>
            (section?.tabs || []).map((tab) => {
                const normalizedTab = toSectionSlug(tab);
                const matchedItem =
                    itemAnchors.find((item) => toSectionSlug(item.title).includes(normalizedTab)) || itemAnchors[0];

                return {
                    label: tab,
                    anchorId: matchedItem.anchorId,
                };
            }),
        [itemAnchors, section?.tabs]
    );
    const [activeAnchorId, setActiveAnchorId] = useState(tabTargets[0]?.anchorId || itemAnchors[0]?.anchorId || '');

    useEffect(() => {
        const syncActiveAnchor = () => {
            const hashAnchor = window.location.hash.replace(/^#/, '');
            const validHash = tabTargets.find((tab) => tab.anchorId === hashAnchor)?.anchorId;

            if (validHash) {
                setActiveAnchorId(validHash);
                return;
            }

            setActiveAnchorId(tabTargets[0]?.anchorId || itemAnchors[0]?.anchorId || '');
        };

        syncActiveAnchor();
        window.addEventListener('hashchange', syncActiveAnchor);

        return () => window.removeEventListener('hashchange', syncActiveAnchor);
    }, [itemAnchors, tabTargets]);

    if (pathname !== '/industries' || !itemAnchors.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 3, md: 4 }, pb: { xs: 7, md: 9 } }}>
            {!!tabTargets.length && (
                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: { xs: 1.2, md: 2.2 },
                        justifyContent: 'center',
                        borderBottom: `1px solid ${alpha('#182033', 0.08)}`,
                        pb: { xs: 1.6, md: 1.9 },
                        mb: { xs: 3, md: 4.2 },
                    }}
                >
                    {tabTargets.map((tab, index) => (
                        <Box
                            key={tab.label}
                            component="a"
                            href={`#${tab.anchorId}`}
                            onClick={() => setActiveAnchorId(tab.anchorId)}
                            sx={{
                                position: 'relative',
                                color: activeAnchorId === tab.anchorId ? '#182033' : '#627089',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.74rem', md: '0.8rem' },
                                lineHeight: 1.3,
                                fontWeight: activeAnchorId === tab.anchorId ? 800 : 700,
                                pb: 0.9,
                                textDecoration: 'none',
                                scrollMarginTop: { xs: '88px', md: '112px' },
                                cursor: 'pointer',
                                transition: 'color 0.2s ease',
                                '&::after': activeAnchorId === tab.anchorId ? {
                                    content: '""',
                                    position: 'absolute',
                                    left: 0,
                                    right: 0,
                                    bottom: -2,
                                    height: '2px',
                                    borderRadius: '999px',
                                    bgcolor: 'primary.main',
                                } : {},
                                '&:hover': {
                                    color: '#182033',
                                },
                            }}
                        >
                            {tab.label}
                        </Box>
                    ))}
                </Box>
            )}

            <Stack spacing={{ xs: 3, md: 4.2 }}>
                {itemAnchors.map((item) => (
                    <Card
                        key={item.title}
                        id={item.anchorId}
                        sx={{
                            overflow: 'hidden',
                            borderRadius: '18px',
                            border: `1px solid ${alpha('#182033', 0.08)}`,
                            boxShadow: '0 16px 34px -30px rgba(15, 23, 42, 0.14)',
                            background: '#ffffff',
                            scrollMarginTop: { xs: '100px', md: '132px' },
                        }}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                            }}
                        >
                            <Box sx={{ order: { xs: 1, md: item.imageLeft ? 1 : 2 } }}>
                                <Box
                                    sx={{
                                        minHeight: { xs: 240, md: 355 },
                                        height: '100%',
                                        backgroundImage: `url(${item.image})`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                    }}
                                />
                            </Box>

                            <Box sx={{ order: { xs: 2, md: item.imageLeft ? 2 : 1 }, display: 'flex' }}>
                                <Box sx={{ p: { xs: 2.3, md: 3.2, lg: 3.6 }, alignSelf: 'center' }}>
                                    <Stack spacing={{ xs: 1.2, md: 1.5 }} alignItems="flex-start">
                                        <Typography
                                            sx={{
                                                color: 'primary.main',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '0.62rem', md: '0.66rem' },
                                                lineHeight: 1.25,
                                                fontWeight: 900,
                                                letterSpacing: '0.12em',
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            {item.eyebrow}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                color: '#182033',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '1.45rem', md: '1.8rem', lg: '2rem' },
                                                lineHeight: 1.08,
                                                fontWeight: 800,
                                                letterSpacing: '-0.04em',
                                            }}
                                        >
                                            {item.title}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                maxWidth: 360,
                                                color: '#4b5b75',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '0.84rem', md: '0.89rem' },
                                                lineHeight: 1.56,
                                            }}
                                        >
                                            {item.description}
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {item.tags?.map((tag) => (
                                                <Box
                                                    key={tag}
                                                    sx={{
                                                        px: 1.2,
                                                        py: 0.65,
                                                        borderRadius: '999px',
                                                        bgcolor: alpha('#f97316', 0.08),
                                                        border: `1px solid ${alpha('#f97316', 0.16)}`,
                                                    }}
                                                >
                                                    <Typography
                                                        sx={{
                                                            color: 'primary.main',
                                                            fontFamily: HERO_HEADLINE_FONT,
                                                            fontSize: { xs: '0.66rem', md: '0.7rem' },
                                                            lineHeight: 1.2,
                                                            fontWeight: 700,
                                                        }}
                                                    >
                                                        {tag}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </Stack>
                                </Box>
                            </Box>
                        </Box>
                    </Card>
                ))}
            </Stack>
        </SectionShell>
    );
};

const StatsSection = ({ stats = [] }) => {
    if (!stats.length) return null;

    return (
        <SectionShell padded={false} sx={{ mt: -3 }}>
            <Grid container spacing={2.5}>
                {stats.map((stat) => (
                    <Grid item xs={12} md={4} key={stat.label}>
                        <Card sx={{ height: '100%', borderRadius: '20px', border: `1px solid ${alpha('#182033', 0.1)}`, boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.2)' }}>
                            <CardContent sx={{ p: { xs: 2.6, md: 2.8 } }}>
                                <Typography sx={{ fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.6rem', md: '1.85rem' }, fontWeight: 800, mb: 1, color: '#182033', letterSpacing: '-0.03em' }}>
                                    {stat.value}
                                </Typography>
                                <Typography sx={{ color: '#566275', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.92rem', md: '0.96rem' }, lineHeight: 1.5 }}>{stat.label}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </SectionShell>
    );
};

const WhyUsTestimonialsSection = ({ section, pathname }) => {
    if (pathname !== '/why-us' || !section?.items?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={{ xs: 1.4, md: 1.8 }} alignItems="center" textAlign="center" sx={{ mb: { xs: 3.2, md: 4.8 } }}>
                <Typography
                    sx={{
                        color: '#111111',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '2rem', md: '2.7rem', lg: '3rem' },
                        lineHeight: { xs: 1.08, md: 1.04 },
                        fontWeight: 800,
                        letterSpacing: '-0.045em',
                        textTransform: 'capitalize',
                    }}
                >
                    {section.title}
                </Typography>
                <Box sx={{ width: 88, height: 3, borderRadius: '999px', bgcolor: 'primary.main' }} />
                <Typography
                    sx={{
                        maxWidth: 760,
                        color: '#4b5b75',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '0.9rem', md: '0.98rem' },
                        lineHeight: 1.5,
                    }}
                >
                    {section.description}
                </Typography>
            </Stack>

            <Stack spacing={{ xs: 2.5, md: 3.2 }}>
                {section.items.map((item) => {
                    const isRightAligned = item.align === 'right';

                    return (
                        <Card
                            key={item.name}
                            sx={{
                                borderRadius: '24px',
                                border: `1px solid ${alpha('#182033', 0.08)}`,
                                boxShadow: '0 14px 34px -28px rgba(15, 23, 42, 0.18)',
                                background: '#f9fbff',
                                maxWidth: { xs: '100%', md: isRightAligned ? 1140 : 1180 },
                                ml: { xs: 0, md: isRightAligned ? 'auto' : 0 },
                            }}
                        >
                            <CardContent sx={{ p: { xs: 2.2, md: 3.2, lg: 3.6 } }}>
                                <Stack
                                    direction={{ xs: 'column', md: isRightAligned ? 'row-reverse' : 'row' }}
                                    spacing={{ xs: 2, md: 3.2 }}
                                    alignItems={{ xs: 'flex-start', md: 'center' }}
                                >
                                    <Stack
                                        spacing={1}
                                        alignItems={{ xs: 'flex-start', md: isRightAligned ? 'flex-end' : 'flex-start' }}
                                        sx={{ minWidth: { md: 170 }, textAlign: { xs: 'left', md: isRightAligned ? 'right' : 'left' } }}
                                    >
                                        <Box
                                            sx={{
                                                width: { xs: 74, md: 86 },
                                                height: { xs: 74, md: 86 },
                                                borderRadius: '50%',
                                                display: 'grid',
                                                placeItems: 'center',
                                                border: '4px solid #ffffff',
                                                boxShadow: '0 10px 28px -20px rgba(15, 23, 42, 0.28)',
                                                background: 'linear-gradient(135deg, #ffd6b0 0%, #f5efe6 100%)',
                                                color: '#182033',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '1.2rem', md: '1.35rem' },
                                                fontWeight: 800,
                                                letterSpacing: '-0.04em',
                                            }}
                                        >
                                            {item.initials}
                                        </Box>
                                        <Box>
                                            <Typography
                                                sx={{
                                                    color: '#182033',
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '1rem', md: '1.08rem' },
                                                    lineHeight: 1.2,
                                                    fontWeight: 800,
                                                    letterSpacing: '-0.03em',
                                                }}
                                            >
                                                {item.name}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    color: '#6b7a92',
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '0.84rem', md: '0.88rem' },
                                                    lineHeight: 1.45,
                                                }}
                                            >
                                                {item.role}
                                            </Typography>
                                        </Box>
                                    </Stack>

                                    <Typography
                                        sx={{
                                            flex: 1,
                                            color: '#41526d',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '1rem', md: '1.16rem', lg: '1.22rem' },
                                            lineHeight: 1.42,
                                            letterSpacing: '-0.02em',
                                            textAlign: { xs: 'left', md: isRightAligned ? 'left' : 'left' },
                                        }}
                                    >
                                        "{item.quote}"
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    );
                })}
            </Stack>
        </SectionShell>
    );
};

const whyUsBlogArt = {
    ai: {
        background: 'radial-gradient(circle at 50% 42%, rgba(130, 255, 221, 0.22) 0%, rgba(18, 34, 40, 0.1) 18%, rgba(17, 43, 46, 0.96) 72%)',
        overlay: (
            <>
                <Box
                    sx={{
                        width: 92,
                        height: 92,
                        borderRadius: '22px',
                        border: '2px solid rgba(192, 255, 238, 0.9)',
                        display: 'grid',
                        placeItems: 'center',
                        color: '#f8fffe',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: '2rem',
                        fontWeight: 800,
                        boxShadow: '0 0 28px rgba(141, 255, 228, 0.25)',
                    }}
                >
                    AI
                </Box>
            </>
        ),
    },
    team: {
        background: 'linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%)',
        overlay: (
            <Stack direction="row" spacing={2.2} alignItems="flex-end">
                {['#d8e1eb', '#cfd9e6', '#dde5ee'].map((tone, index) => (
                    <Stack key={index} spacing={0.8} alignItems="center">
                        <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: tone }} />
                        <Box sx={{ width: 54, height: 44, borderRadius: '20px 20px 14px 14px', bgcolor: tone }} />
                    </Stack>
                ))}
            </Stack>
        ),
    },
    analytics: {
        background: 'linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)',
        overlay: (
            <Box
                sx={{
                    width: 238,
                    maxWidth: '100%',
                    borderRadius: '16px',
                    bgcolor: '#ffffff',
                    border: `1px solid ${alpha('#182033', 0.08)}`,
                    boxShadow: '0 12px 30px -24px rgba(15, 23, 42, 0.28)',
                    p: 1.2,
                }}
            >
                <Stack spacing={1}>
                    <Box sx={{ width: 86, height: 7, borderRadius: '999px', bgcolor: '#e2e8f0' }} />
                    <Box sx={{ width: '100%', height: 84, borderRadius: '12px', bgcolor: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
                        <Box sx={{ position: 'absolute', left: 16, right: 16, bottom: 18, height: 3, bgcolor: '#dbe4ee' }} />
                        <Box sx={{ position: 'absolute', left: 26, right: 26, top: 20, bottom: 26 }}>
                            <svg viewBox="0 0 220 90" width="100%" height="100%" preserveAspectRatio="none">
                                <path d="M0,60 C30,52 42,18 70,20 C102,22 102,64 134,66 C162,68 170,34 220,26" fill="none" stroke="#2f7ed8" strokeWidth="4" strokeLinecap="round" />
                            </svg>
                        </Box>
                    </Box>
                </Stack>
            </Box>
        ),
    },
};

const WhyUsBlogSection = ({ section, pathname }) => {
    if (pathname !== '/why-us' || !section?.items?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 5, md: 7 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={{ xs: 1.4, md: 1.8 }} alignItems="center" textAlign="center" sx={{ mb: { xs: 3.2, md: 4.8 } }}>
                <Typography
                    sx={{
                        color: '#111111',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '2rem', md: '2.7rem', lg: '3rem' },
                        lineHeight: { xs: 1.08, md: 1.04 },
                        fontWeight: 800,
                        letterSpacing: '-0.045em',
                    }}
                >
                    {section.title}
                </Typography>
                <Box sx={{ width: 88, height: 3, borderRadius: '999px', bgcolor: 'primary.main' }} />
            </Stack>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                    gap: { xs: 2.2, md: 2.6 },
                }}
            >
                {section.items.map((item) => {
                    const art = whyUsBlogArt[item.theme] || whyUsBlogArt.ai;

                    return (
                        <Card
                            key={item.title}
                            component={RouterLink}
                            to={item.to}
                            sx={{
                                height: '100%',
                                textDecoration: 'none',
                                color: 'inherit',
                                borderRadius: '20px',
                                border: `1px solid ${alpha('#182033', 0.08)}`,
                                boxShadow: '0 14px 34px -28px rgba(15, 23, 42, 0.18)',
                                background: '#ffffff',
                                overflow: 'hidden',
                            }}
                        >
                            <Box
                                sx={{
                                    height: { xs: 220, md: 236 },
                                    display: 'grid',
                                    placeItems: 'center',
                                    px: 2,
                                    background: art.background,
                                }}
                            >
                                {art.overlay}
                            </Box>
                            <CardContent sx={{ p: { xs: 2.2, md: 2.4 } }}>
                                <Stack spacing={1.2} alignItems="flex-start">
                                    <Typography
                                        sx={{
                                            color: 'primary.main',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '0.72rem', md: '0.76rem' },
                                            lineHeight: 1.3,
                                            fontWeight: 800,
                                            letterSpacing: '0.08em',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        {item.category}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#182033',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '1.1rem', md: '1.18rem' },
                                            lineHeight: 1.2,
                                            fontWeight: 800,
                                            letterSpacing: '-0.03em',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {item.title}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#4b5b75',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '0.84rem', md: '0.88rem' },
                                            lineHeight: 1.52,
                                            textAlign: 'left',
                                        }}
                                    >
                                        {item.description}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#182033',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '0.95rem', md: '0.98rem' },
                                            lineHeight: 1.3,
                                            fontWeight: 800,
                                        }}
                                    >
                                        Read More →
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    );
                })}
            </Box>
        </SectionShell>
    );
};

const AboutOriginSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section) return null;

    return (
        <SectionShell sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 10 }, bgcolor: '#f7f8fa' }}>
            <Grid container spacing={{ xs: 4, md: 6, lg: 8 }} alignItems="start">
                <Grid item xs={12} md={4}>
                    <Stack spacing={1.5} sx={{ position: { md: 'sticky' }, top: { md: 32 } }}>
                        <Typography
                            sx={{
                                color: 'primary.main',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.62rem', md: '0.7rem' },
                                fontWeight: 900,
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                            }}
                        >
                            {section.eyebrow}
                        </Typography>
                        <Typography
                            sx={{
                                maxWidth: 380,
                                color: '#111111',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '1.7rem', md: '2rem', lg: '2.4rem' },
                                lineHeight: { xs: 1.1, md: 1.06 },
                                fontWeight: 800,
                                letterSpacing: '-0.03em',
                            }}
                        >
                            {section.title}
                        </Typography>
                    </Stack>
                </Grid>
                <Grid item xs={12} md={8}>
                    <Stack spacing={{ xs: 2.5, md: 3 }}>
                        <Stack spacing={0.5}>
                            {section.paragraphs?.map((paragraph) => (
                                <Typography
                                    key={paragraph}
                                    sx={{
                                        color: '#4b5b75',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '0.86rem', md: '0.93rem' },
                                        lineHeight: 1.65,
                                    }}
                                >
                                    {paragraph}
                                </Typography>
                            ))}
                        </Stack>

                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'stretch',
                                borderRadius: '12px',
                                border: `1px solid ${alpha('#e2e8f0', 0.9)}`,
                                background: '#ffffff',
                                overflow: 'hidden',
                                boxShadow: '0 2px 12px -4px rgba(15,23,42,0.08)',
                            }}
                        >
                            <Box sx={{ width: 4, bgcolor: 'primary.main', flexShrink: 0 }} />
                            <Box sx={{ p: { xs: 2.4, md: 3, lg: 3.5 } }}>
                                <Typography
                                    sx={{
                                        color: 'primary.main',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '2rem', md: '2.6rem' },
                                        lineHeight: 0.8,
                                        fontWeight: 900,
                                        mb: 1.5,
                                    }}
                                >
                                    99
                                </Typography>
                                <Typography
                                    sx={{
                                        color: '#111111',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '1rem', md: '1.15rem', lg: '1.32rem' },
                                        lineHeight: 1.4,
                                        fontWeight: 800,
                                        letterSpacing: '-0.02em',
                                    }}
                                >
                                    {section.quote}
                                </Typography>
                            </Box>
                        </Box>

                        <Typography
                            sx={{
                                color: '#4b5b75',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '0.86rem', md: '0.93rem' },
                                lineHeight: 1.65,
                            }}
                        >
                            {section.closing}
                        </Typography>
                    </Stack>
                </Grid>
            </Grid>
        </SectionShell>
    );
};

const aboutProblemIcons = {
    hourglass: Hourglass,
    compare: GitCompareArrows,
    network: Network,
    zap: Zap,
};

const aboutPrincipleIcons = {
    refresh: RefreshCw,
    compass: Compass,
    chart: SearchCheck,
};

const aboutTrustIcons = {
    brain: Brain,
    sparkles: Sparkles,
    shield: ShieldCheck,
    building: Building2,
};

const AboutProblemSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section?.items?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 4, md: 6 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={1.6} alignItems="center" textAlign="center" sx={{ mb: { xs: 3.2, md: 4.2 } }}>
                <Typography
                    sx={{
                        maxWidth: 980,
                        color: '#111111',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '2rem', md: '2.8rem', lg: '3.3rem' },
                        lineHeight: { xs: 1.06, md: 1.02 },
                        fontWeight: 800,
                        letterSpacing: '-0.045em',
                    }}
                >
                    {section.title}
                </Typography>
                <Typography
                    sx={{
                        maxWidth: 760,
                        color: '#4b5b75',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '0.88rem', md: '0.96rem', lg: '1rem' },
                        lineHeight: 1.55,
                    }}
                >
                    {section.description}
                </Typography>
            </Stack>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: { xs: 2.2, md: 2.6 },
                }}
            >
                {section.items.map((item) => {
                    const Icon = aboutProblemIcons[item.icon] || Hourglass;

                    return (
                        <Box key={item.number} sx={{ display: 'flex' }}>
                            <Card
                                sx={{
                                    height: '100%',
                                    width: '100%',
                                    minHeight: { xs: 230, md: 285 },
                                    borderRadius: '24px',
                                    border: `1px solid ${alpha('#182033', 0.1)}`,
                                    boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.18)',
                                    background: '#ffffff',
                                }}
                            >
                                <CardContent sx={{ p: { xs: 2.6, md: 3.2, lg: 3.5 }, height: '100%', display: 'flex' }}>
                                    <Stack spacing={{ xs: 3.6, md: 4.8 }} sx={{ height: '100%', width: '100%', justifyContent: 'space-between' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box
                                                sx={{
                                                    width: { xs: 52, md: 60 },
                                                    height: { xs: 52, md: 60 },
                                                    borderRadius: '16px',
                                                    bgcolor: alpha('#f97316', 0.1),
                                                    color: 'primary.main',
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                }}
                                            >
                                                <Icon size={24} strokeWidth={2.1} />
                                            </Box>
                                            <Typography
                                                sx={{
                                                    color: alpha('#f97316', 0.22),
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '2.5rem', md: '3rem', lg: '3.35rem' },
                                                    lineHeight: 0.95,
                                                    fontWeight: 800,
                                                    letterSpacing: '-0.05em',
                                                }}
                                            >
                                                {item.number}
                                            </Typography>
                                        </Box>

                                        <Stack spacing={1.1} sx={{ minHeight: { xs: 76, md: 98 } }}>
                                            <Typography
                                                sx={{
                                                    color: '#111111',
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '1.15rem', md: '1.35rem', lg: '1.55rem' },
                                                    lineHeight: 1.12,
                                                    fontWeight: 800,
                                                    letterSpacing: '-0.03em',
                                                }}
                                            >
                                                {item.title}
                                            </Typography>
                                            <Typography
                                                sx={{
                                                    maxWidth: 520,
                                                    color: '#4b5b75',
                                                    fontFamily: HERO_HEADLINE_FONT,
                                                    fontSize: { xs: '0.84rem', md: '0.9rem', lg: '0.94rem' },
                                                    lineHeight: 1.56,
                                                }}
                                            >
                                                {item.description}
                                            </Typography>
                                        </Stack>
                                    </Stack>
                                </CardContent>
                            </Card>
                        </Box>
                    );
                })}
            </Box>
        </SectionShell>
    );
};

const AboutQuoteBannerSection = ({ section, pathname }) => {
    const theme = useTheme();
    if (pathname !== '/about' || !section?.lines?.length) return null;

    return (
        <SectionShell
            maxWidth={false}
            padded={false}
            sx={{ pt: { xs: 2, md: 3 }, pb: { xs: 6, md: 8 } }}
        >
            <Box
                sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    width: '100%',
                    bgcolor: '#121212',
                    borderRadius: { xs: 0, md: 0 },
                    px: { xs: 2.5, sm: 4, md: 6, lg: 8 },
                    py: { xs: 6, md: 8.5, lg: 10 },
                }}
            >
                <Box
                    sx={{
                        position: 'absolute',
                        top: { xs: 16, md: 22 },
                        left: { xs: -50, md: -70 },
                        width: { xs: 220, md: 340 },
                        height: '3px',
                        bgcolor: '#ffffff',
                        transform: 'rotate(-17deg)',
                        opacity: 0.95,
                    }}
                />
                <Box
                    sx={{
                        position: 'absolute',
                        top: { xs: 58, md: 72 },
                        left: { xs: -72, md: -95 },
                        width: { xs: 250, md: 390 },
                        height: '3px',
                        bgcolor: '#ffffff',
                        transform: 'rotate(-17deg)',
                        opacity: 0.95,
                    }}
                />

                <Stack spacing={0.35} sx={{ position: 'relative', zIndex: 1, maxWidth: 1280, mx: 'auto', textAlign: 'center' }}>
                    {section.lines.map((line, index) => (
                        <Typography
                            key={index}
                            sx={{
                                color: '#ffffff',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '1.55rem', sm: '2rem', md: '2.55rem', lg: '3.15rem' },
                                lineHeight: { xs: 1.15, md: 1.1 },
                                fontWeight: 800,
                                letterSpacing: '-0.04em',
                            }}
                        >
                            {line.map((part, partIndex) => (
                                <Box
                                    key={`${index}-${partIndex}`}
                                    component="span"
                                    sx={{
                                        color: part.highlight ? theme.palette.primary.main : '#ffffff',
                                    }}
                                >
                                    {part.text}
                                </Box>
                            ))}
                        </Typography>
                    ))}
                </Stack>
            </Box>
        </SectionShell>
    );
};

const AboutPrinciplesSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section?.items?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 6, md: 7 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={1.4} sx={{ mb: { xs: 3.2, md: 4.4 }, maxWidth: 980 }}>
                <Typography
                    sx={{
                        color: '#111111',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '1.85rem', md: '2.35rem', lg: '2.75rem' },
                        lineHeight: { xs: 1.08, md: 1.05 },
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                    }}
                >
                    {section.title}
                </Typography>
                <Typography
                    sx={{
                        color: '#4b5b75',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '0.88rem', md: '0.96rem', lg: '1rem' },
                        lineHeight: 1.56,
                        maxWidth: 900,
                    }}
                >
                    {section.description}
                </Typography>
            </Stack>

            <Box
                sx={{
                    borderRadius: '28px',
                    border: `1px solid ${alpha('#385072', 0.55)}`,
                    background: '#ffffff',
                    px: { xs: 2, md: 2.6 },
                    py: { xs: 2, md: 2.8 },
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                        gap: { xs: 2.5, md: 3 },
                    }}
                >
                    {section.items.map((item) => {
                        const Icon = aboutPrincipleIcons[item.icon] || RefreshCw;

                        return (
                            <Stack
                                key={item.title}
                                spacing={2.1}
                                sx={{
                                    minHeight: { md: 280 },
                                    px: { xs: 0.4, md: 0.8 },
                                    py: { xs: 0.6, md: 1 },
                                }}
                            >
                                <Box
                                    sx={{
                                        width: { xs: 58, md: 68 },
                                        height: { xs: 58, md: 68 },
                                        borderRadius: '18px',
                                        border: `1px solid ${alpha('#182033', 0.12)}`,
                                        bgcolor: '#f8fafc',
                                        color: 'primary.main',
                                        display: 'grid',
                                        placeItems: 'center',
                                    }}
                                >
                                    <Icon size={26} strokeWidth={2.1} />
                                </Box>

                                <Typography
                                    sx={{
                                        color: '#111111',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '1.08rem', md: '1.26rem', lg: '1.38rem' },
                                        lineHeight: 1.22,
                                        fontWeight: 800,
                                        letterSpacing: '-0.03em',
                                        maxWidth: 360,
                                    }}
                                >
                                    {item.title}
                                </Typography>

                                <Typography
                                    sx={{
                                        color: '#4b5b75',
                                        fontFamily: HERO_HEADLINE_FONT,
                                        fontSize: { xs: '0.84rem', md: '0.9rem', lg: '0.94rem' },
                                        lineHeight: 1.58,
                                        maxWidth: 380,
                                    }}
                                >
                                    {item.description}
                                </Typography>
                            </Stack>
                        );
                    })}
                </Box>
            </Box>
        </SectionShell>
    );
};

const AboutFounderNoteSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section?.paragraphs?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 4, md: 5 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={{ xs: 2.2, md: 2.8 }} sx={{ maxWidth: 1040, mx: 'auto' }}>
                <Typography
                    sx={{
                        color: 'primary.main',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '0.7rem', md: '0.78rem' },
                        fontWeight: 900,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        textAlign: 'center',
                    }}
                >
                    {section.eyebrow}
                </Typography>

                {section.paragraphs.map((paragraph) => (
                    <Typography
                        key={paragraph}
                        sx={{
                            color: '#4b5b75',
                            fontFamily: HERO_HEADLINE_FONT,
                            fontSize: { xs: '0.96rem', md: '1.06rem', lg: '1.08rem' },
                            lineHeight: 1.72,
                            maxWidth: 1100,
                        }}
                    >
                        {paragraph}
                    </Typography>
                ))}
            </Stack>
        </SectionShell>
    );
};

const AboutTrustSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section?.items?.length) return null;

    return (
        <SectionShell sx={{ pt: { xs: 4, md: 5 }, pb: { xs: 6, md: 8 } }}>
            <Stack spacing={1.4} alignItems="center" textAlign="center" sx={{ mb: { xs: 3.4, md: 4.4 } }}>
                <Typography
                    sx={{
                        maxWidth: 1320,
                        color: '#111111',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '1.85rem', md: '2.35rem', lg: '2.75rem' },
                        lineHeight: { xs: 1.08, md: 1.05 },
                        fontWeight: 800,
                        letterSpacing: '-0.04em',
                    }}
                >
                    {section.title}
                </Typography>
                <Typography
                    sx={{
                        maxWidth: 900,
                        color: '#4b5b75',
                        fontFamily: HERO_HEADLINE_FONT,
                        fontSize: { xs: '0.88rem', md: '0.96rem', lg: '1rem' },
                        lineHeight: 1.56,
                    }}
                >
                    {section.description}
                </Typography>
            </Stack>

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' },
                    gap: { xs: 2.2, md: 2.5 },
                }}
            >
                {section.items.map((item) => {
                    const Icon = aboutTrustIcons[item.icon] || Brain;

                    return (
                        <Card
                            key={item.title}
                            sx={{
                                height: '100%',
                                borderRadius: '24px',
                                border: `1px solid ${alpha('#182033', 0.1)}`,
                                boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.18)',
                                background: '#ffffff',
                            }}
                        >
                            <CardContent sx={{ p: { xs: 2.5, md: 2.8 }, height: '100%' }}>
                                <Stack spacing={2} sx={{ height: '100%' }}>
                                    <Box
                                        sx={{
                                            width: { xs: 58, md: 60 },
                                            height: { xs: 58, md: 60 },
                                            borderRadius: '18px',
                                            bgcolor: alpha('#f97316', 0.1),
                                            color: 'primary.main',
                                            display: 'grid',
                                            placeItems: 'center',
                                        }}
                                    >
                                        <Icon size={24} strokeWidth={2.1} />
                                    </Box>
                                    <Typography
                                        sx={{
                                            color: '#111111',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '1.08rem', md: '1.26rem', lg: '1.38rem' },
                                            lineHeight: 1.24,
                                            fontWeight: 800,
                                            letterSpacing: '-0.03em',
                                        }}
                                    >
                                        {item.title}
                                    </Typography>
                                    <Typography
                                        sx={{
                                            color: '#4b5b75',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '0.84rem', md: '0.9rem', lg: '0.94rem' },
                                            lineHeight: 1.58,
                                        }}
                                    >
                                        {item.description}
                                    </Typography>
                                </Stack>
                            </CardContent>
                        </Card>
                    );
                })}
            </Box>
        </SectionShell>
    );
};

const AboutStoryCtaSection = ({ section, pathname }) => {
    if (pathname !== '/about' || !section) return null;

    return (
        <SectionShell sx={{ pt: { xs: 4, md: 5 }, pb: { xs: 7, md: 9 } }}>
            <Box sx={{ maxWidth: 1120, mx: 'auto', textAlign: 'center' }}>
                <Stack spacing={{ xs: 2.4, md: 3 }} alignItems="center">
                    <Typography
                        sx={{
                            maxWidth: 1120,
                            color: '#111111',
                            fontFamily: HERO_HEADLINE_FONT,
                            fontSize: { xs: '2rem', md: '2.65rem', lg: '3.2rem' },
                            lineHeight: { xs: 1.08, md: 1.03 },
                            fontWeight: 800,
                            letterSpacing: '-0.05em',
                        }}
                    >
                        {section.title}
                    </Typography>
                    <Typography
                        sx={{
                            maxWidth: 900,
                            color: '#4b5b75',
                            fontFamily: HERO_HEADLINE_FONT,
                            fontSize: { xs: '0.96rem', md: '1rem', lg: '1.04rem' },
                            lineHeight: 1.6,
                        }}
                    >
                        {section.description}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.1} justifyContent="center" sx={{ pt: 1 }}>
                        <Button
                            component={RouterLink}
                            to={section.primary.to}
                            variant="contained"
                            sx={{
                                minWidth: { xs: 220, md: 208 },
                                py: { xs: 1.3, md: 1.45 },
                                px: { xs: 3.8, md: 4.4 },
                                borderRadius: '18px',
                                textTransform: 'none',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 850,
                                fontSize: { xs: '0.98rem', md: '1rem' },
                                boxShadow: '0 18px 38px -24px rgba(249, 115, 22, 0.75)',
                            }}
                        >
                            {section.primary.label}
                        </Button>
                        <Button
                            component={RouterLink}
                            to={section.secondary.to}
                            variant="outlined"
                            sx={{
                                minWidth: { xs: 220, md: 278 },
                                py: { xs: 1.3, md: 1.45 },
                                px: { xs: 3.8, md: 4.4 },
                                borderRadius: '18px',
                                textTransform: 'none',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 850,
                                fontSize: { xs: '0.98rem', md: '1rem' },
                                color: '#111111',
                                borderColor: alpha('#182033', 0.14),
                                '&:hover': {
                                    borderColor: alpha('#f97316', 0.34),
                                    bgcolor: alpha('#f97316', 0.04),
                                },
                            }}
                        >
                            {section.secondary.label}
                        </Button>
                    </Stack>
                </Stack>
            </Box>
        </SectionShell>
    );
};

const ContentSections = ({ sections }) => (
    <>
        {sections.map((section, index) => (
            <SectionShell
                key={section.title}
                tone={index % 2 === 0 ? 'default' : 'surface'}
                sx={{ bgcolor: index % 2 === 0 ? 'transparent' : 'background.paper' }}
            >
                <Stack spacing={1.5} sx={{ mb: { xs: 3.5, md: 4.5 }, maxWidth: 1120 }}>
                    <Typography sx={{ color: 'primary.main', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.62rem', md: '0.72rem' }, fontWeight: 900, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        {section.title}
                    </Typography>
                    <Typography sx={{ maxWidth: 900, fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.85rem', md: '2.55rem', lg: '2.95rem' }, lineHeight: { xs: 1.12, md: 1.06 }, fontWeight: 800, letterSpacing: '-0.035em', color: '#182033' }}>
                        {section.title}
                    </Typography>
                    <Typography sx={{ maxWidth: 980, color: '#697386', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.82rem', md: '0.94rem' }, lineHeight: { xs: 1.55, md: 1.58 } }}>
                        {section.description}
                    </Typography>
                </Stack>
                <Grid container spacing={{ xs: 2.5, md: 2.25, lg: 3 }} alignItems="stretch">
                    {section.items.map((item) => (
                        <Grid item xs={12} md={section.items.length === 2 ? 6 : 4} key={item.title}>
                            <Card sx={{ height: '100%', borderRadius: '20px', border: `1px solid ${alpha('#182033', 0.1)}`, boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.2)', background: '#ffffff' }}>
                                <CardContent sx={{ p: { xs: 3, md: 2.8, lg: 3 } }}>
                                    <Typography sx={{ color: '#182033', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.4rem', md: '1.55rem', lg: '1.8rem' }, lineHeight: 1.14, fontWeight: 800, letterSpacing: '-0.03em', mb: 1.4 }}>
                                        {item.title}
                                    </Typography>
                                    <Typography sx={{ color: '#566275', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.92rem', md: '0.96rem' }, lineHeight: 1.55 }}>
                                        {item.description}
                                    </Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </SectionShell>
        ))}
    </>
);

const ComparisonSection = ({ comparison }) => {
    if (!comparison) return null;

    return (
        <SectionShell sx={{ bgcolor: 'background.paper' }}>
            <Typography sx={{ mb: 3, fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.85rem', md: '2.55rem' }, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: '#182033' }}>
                {comparison.title}
            </Typography>
            <Card sx={{ borderRadius: '20px', border: `1px solid ${alpha('#182033', 0.1)}`, boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.2)', overflowX: 'auto' }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 800 }}>Capability</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Hirex REC</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>Traditional approach</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {comparison.rows.map((row) => (
                            <TableRow key={row[0]}>
                                <TableCell sx={{ fontWeight: 700 }}>{row[0]}</TableCell>
                                <TableCell>{row[1]}</TableCell>
                                <TableCell>{row[2]}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </SectionShell>
    );
};

const FaqSection = ({ faq = [] }) => {
    const theme = useTheme();
    if (!faq.length) return null;

    return (
        <SectionShell>
            <Stack spacing={1.3} alignItems="center" textAlign="center" sx={{ mb: { xs: 3.5, md: 4.5 } }}>
                <Typography sx={{ fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '2rem', md: '2.55rem', lg: '2.95rem' }, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: '#182033' }}>
                    Frequently Asked Questions
                </Typography>
            </Stack>
            <Stack spacing={0} sx={{ maxWidth: 980, mx: 'auto', borderBottom: `1px solid ${alpha('#182033', 0.08)}` }}>
                {faq.map((item) => (
                    <Accordion key={item.question} disableGutters elevation={0} sx={{ borderRadius: '0 !important', borderTop: `1px solid ${alpha('#182033', 0.08)}`, bgcolor: 'transparent', boxShadow: 'none', '&::before': { display: 'none' } }}>
                        <AccordionSummary expandIcon={<ChevronDown size={20} />} sx={{ px: 0, py: { xs: 2.4, md: 2.8 }, '& .MuiAccordionSummary-content': { my: 0 }, '& .MuiAccordionSummary-expandIconWrapper': { color: '#697386' } }}>
                            <Typography sx={{ fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.02rem', md: '1.14rem' }, fontWeight: 800, color: '#182033', letterSpacing: '-0.02em' }}>
                                {item.question}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0, pt: 0, pb: { xs: 2.4, md: 2.8 } }}>
                            <Typography sx={{ maxWidth: 980, color: '#566275', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.98rem', md: '0.96rem', lg: '1rem' }, lineHeight: 1.55 }}>
                                {item.answer}
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Stack>
        </SectionShell>
    );
};

const RelatedLinksSection = ({ relatedLinks = [] }) => {
    if (!relatedLinks.length) return null;

    return (
        <SectionShell sx={{ bgcolor: 'background.paper' }}>
            <Typography sx={{ mb: 3, fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.85rem', md: '2.55rem' }, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: '#182033' }}>
                Continue exploring Hirex REC
            </Typography>
            <Grid container spacing={{ xs: 2.5, md: 2.25, lg: 3 }}>
                {relatedLinks.map((link) => (
                    <Grid item xs={12} md={6} key={link.to}>
                        <Card
                            component={RouterLink}
                            to={link.to}
                            sx={{
                                height: '100%',
                                textDecoration: 'none',
                                color: 'inherit',
                                display: 'block',
                                borderRadius: '20px',
                                border: `1px solid ${alpha('#182033', 0.1)}`,
                                boxShadow: '0 14px 34px -26px rgba(15, 23, 42, 0.2)',
                            }}
                        >
                            <CardContent sx={{ p: { xs: 3, md: 2.8, lg: 3 } }}>
                                <Typography sx={{ mb: 1.25, fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '1.3rem', md: '1.45rem' }, fontWeight: 800, color: '#182033', letterSpacing: '-0.03em' }}>
                                    {link.title}
                                </Typography>
                                <Typography sx={{ color: '#566275', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.92rem', md: '0.96rem' }, lineHeight: 1.55, mb: 2 }}>
                                    {link.description}
                                </Typography>
                                <Typography sx={{ color: 'primary.main', fontFamily: HERO_HEADLINE_FONT, fontWeight: 800 }}>
                                    Learn more
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </SectionShell>
    );
};

const CtaSection = ({ cta }) => {
    if (!cta) return null;

    return (
        <SectionShell gradient grid>
            <Box sx={{ maxWidth: 980, mx: 'auto', textAlign: 'center' }}>
                <Typography sx={{ fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '2rem', md: '2.55rem', lg: '2.95rem' }, lineHeight: 1.08, fontWeight: 800, letterSpacing: '-0.035em', color: '#182033', mb: 2 }}>
                    {cta.title}
                </Typography>
                <Typography sx={{ mb: 4, maxWidth: 760, mx: 'auto', color: '#566275', fontFamily: HERO_HEADLINE_FONT, fontSize: { xs: '0.98rem', md: '1rem' }, lineHeight: 1.55 }}>
                    {cta.description}
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center">
                    <Button
                        component={RouterLink}
                        to={cta.primary.to}
                        variant="contained"
                        sx={{
                            minWidth: { xs: 200, md: 240 },
                            py: { xs: 1.45, md: 1.7 },
                            px: { xs: 4, md: 5.2 },
                            borderRadius: '999px',
                            textTransform: 'none',
                            fontFamily: HERO_HEADLINE_FONT,
                            fontWeight: 850,
                            fontSize: { xs: '1rem', md: '1.05rem' },
                            boxShadow: '0 22px 48px -24px rgba(249, 115, 22, 0.85)',
                        }}
                    >
                        {cta.primary.label}
                    </Button>
                    <Button component={RouterLink} to={cta.secondary.to} variant="outlined" endIcon={<ArrowRight size={18} />} sx={{ minWidth: { xs: 200, md: 240 }, py: { xs: 1.45, md: 1.7 }, px: { xs: 4, md: 5.2 }, borderRadius: '999px', textTransform: 'none', fontFamily: HERO_HEADLINE_FONT, fontWeight: 850, fontSize: { xs: '1rem', md: '1.05rem' }, color: '#182033', borderColor: alpha('#182033', 0.16), '&:hover': { borderColor: alpha('#f97316', 0.34), bgcolor: alpha('#f97316', 0.04) } }}>
                        {cta.secondary.label}
                    </Button>
                </Stack>
            </Box>
        </SectionShell>
    );
};

const MarketingPage = ({ page }) => {
    if (!page) return null;

    const isAboutPage = page.pathname === '/about';
    const isIndustriesPage = page.pathname === '/industries';
    const isWhyUsPage = page.pathname === '/why-us';
    const siteOrigin = resolveSiteOrigin();
    const structuredData = [
        buildWebPageSchema({
            siteOrigin,
            pathname: page.pathname,
            title: page.seo.title,
            description: page.seo.description,
        }),
        buildSoftwareApplicationSchema({
            siteOrigin,
            title: page.seo.title,
            description: page.seo.description,
            pathname: page.pathname,
            featureList: page.hero?.highlights || [],
        }),
        buildFaqSchema(page.faq),
    ].filter(Boolean);

    return (
        <>
            <SeoHead
                title={page.seo.title}
                description={page.seo.description}
                pathname={page.pathname}
                structuredData={structuredData}
            />
            <HeroSection page={page} />
            <StatsSection stats={page.stats} />
            <IndustriesSpotlightSection section={page.spotlightSection} pathname={page.pathname} />
            <WhyUsTestimonialsSection section={page.testimonialsSection} pathname={page.pathname} />
            <WhyUsBlogSection section={page.blogSection} pathname={page.pathname} />
            <AboutOriginSection section={page.originSection} pathname={page.pathname} />
            <AboutProblemSection section={page.problemSection} pathname={page.pathname} />
            <AboutQuoteBannerSection section={page.quoteBannerSection} pathname={page.pathname} />
            <AboutPrinciplesSection section={page.principlesSection} pathname={page.pathname} />
            <AboutFounderNoteSection section={page.founderNoteSection} pathname={page.pathname} />
            <AboutTrustSection section={page.trustSection} pathname={page.pathname} />
            <AboutStoryCtaSection section={page.storyCtaSection} pathname={page.pathname} />
            {!isAboutPage && !isWhyUsPage && !isIndustriesPage && <ContentSections sections={page.sections} />}
            <ComparisonSection comparison={page.comparison} />
            {!isWhyUsPage && !isIndustriesPage && <FaqSection faq={page.faq} />}
            {!isAboutPage && !isWhyUsPage && !isIndustriesPage && <RelatedLinksSection relatedLinks={page.relatedLinks} />}
            {!isAboutPage && !isWhyUsPage && !isIndustriesPage && <CtaSection cta={page.cta} />}
        </>
    );
};

export default MarketingPage;
