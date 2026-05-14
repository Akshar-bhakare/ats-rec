import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    Container,
    Stack,
    Typography,
    alpha,
    useTheme,
} from '@mui/material';
import { Check, Sparkles } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';
import SeoHead from '../components/ui/SeoHead';
import { PRICING_PAGE_CONTENT } from '../lib/constants';
import {
    buildSoftwareApplicationSchema,
    buildWebPageSchema,
    resolveSiteOrigin,
} from '../lib/seoSchema';

const HERO_HEADLINE_FONT = '"Inter", "Segoe UI", sans-serif';

const PricingPage = () => {
    const theme = useTheme();
    const siteOrigin = resolveSiteOrigin();
    const structuredData = [
        buildWebPageSchema({
            siteOrigin,
            pathname: '/pricing',
            title: 'Hirex REC Pricing | AI Recruitment Software for Every Team Size',
            description: PRICING_PAGE_CONTENT.hero.description,
        }),
        buildSoftwareApplicationSchema({
            siteOrigin,
            title: 'Hirex REC Pricing',
            description: PRICING_PAGE_CONTENT.hero.description,
            pathname: '/pricing',
            featureList: PRICING_PAGE_CONTENT.platform.capabilityGroups.flatMap((group) => group.items),
        }),
    ];

    return (
        <>
            <SeoHead
                title="Hirex REC Pricing | AI Recruitment Software for Every Team Size"
                description={PRICING_PAGE_CONTENT.hero.description}
                pathname="/pricing"
                structuredData={structuredData}
            />

            <Box
                sx={{
                    bgcolor: '#fffdf9',
                    backgroundImage: `
                        radial-gradient(circle at 50% 22%, ${alpha(theme.palette.primary.main, 0.14)} 0%, transparent 26%),
                        radial-gradient(circle at 50% 52%, rgba(255, 212, 170, 0.28) 0%, transparent 38%),
                        linear-gradient(180deg, #ffffff 0%, #fffaf3 100%)
                    `,
                }}
            >
                <Container maxWidth="xl" sx={{ px: { xs: 2, md: 4 }, pt: { xs: 7, md: 9 }, pb: { xs: 9, md: 12 } }}>
                    <Box
                        sx={{
                            maxWidth: 1040,
                            mx: 'auto',
                            textAlign: 'center',
                            mb: { xs: 8, md: 10 },
                            py: { xs: 6, md: 8 },
                        }}
                    >
                        <Typography
                            component="h1"
                            sx={{
                                maxWidth: 860,
                                mx: 'auto',
                                color: '#111827',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontWeight: 800,
                                letterSpacing: '-0.035em',
                                lineHeight: { xs: 1.12, md: 1.08 },
                                fontSize: { xs: '2.05rem', sm: '2.7rem', md: '3.95rem', lg: '4.35rem' },
                                mb: 2.8,
                            }}
                        >
                            Pay Only for
                            <Box component="span" sx={{ display: 'block', color: 'primary.main' }}>
                                What You Hire
                            </Box>
                        </Typography>
                        <Typography
                            sx={{
                                maxWidth: 920,
                                mx: 'auto',
                                color: 'text.secondary',
                                fontFamily: HERO_HEADLINE_FONT,
                                fontSize: { xs: '1rem', md: '1.08rem' },
                                lineHeight: { xs: 1.72, md: 1.68 },
                                mb: 4.2,
                            }}
                        >
                            {PRICING_PAGE_CONTENT.hero.description}
                        </Typography>
                        <Stack direction="row" justifyContent="center">
                            <Button
                                component={RouterLink}
                                to={PRICING_PAGE_CONTENT.hero.primaryCta.to}
                                variant="contained"
                                sx={{
                                    minWidth: { xs: 200, md: 272 },
                                    py: { xs: 1.45, md: 1.7 },
                                    px: { xs: 4, md: 5.5 },
                                    borderRadius: '999px',
                                    textTransform: 'none',
                                    fontWeight: 850,
                                    fontSize: { xs: '1rem', md: '1.05rem' },
                                    boxShadow: `0 22px 48px -24px ${alpha(theme.palette.primary.main, 0.85)}`,
                                }}
                            >
                                {PRICING_PAGE_CONTENT.hero.primaryCta.label}
                            </Button>
                        </Stack>
                    </Box>

                    <Box sx={{ maxWidth: 1280, mx: 'auto', mb: { xs: 7, md: 9 } }}>
                        <Stack spacing={1.5} sx={{ mb: { xs: 4, md: 5.5 }, maxWidth: 1120 }}>
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
                                {PRICING_PAGE_CONTENT.intro.eyebrow}
                            </Typography>
                            <Typography
                                sx={{
                                    maxWidth: 760,
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontSize: { xs: '1.85rem', md: '2.55rem', lg: '2.95rem' },
                                    lineHeight: { xs: 1.12, md: 1.06 },
                                    fontWeight: 800,
                                    letterSpacing: '-0.035em',
                                    color: '#182033',
                                }}
                            >
                                {PRICING_PAGE_CONTENT.intro.title}
                            </Typography>
                            <Typography
                                sx={{
                                    maxWidth: 980,
                                    color: '#697386',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontSize: { xs: '0.82rem', md: '0.94rem' },
                                    lineHeight: { xs: 1.55, md: 1.58 },
                                }}
                            >
                                {PRICING_PAGE_CONTENT.intro.description}
                            </Typography>
                        </Stack>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                            gap: { xs: 2.5, md: 2.25, lg: 3 },
                        }}>
                            {PRICING_PAGE_CONTENT.plans.map((plan) => (
                                <Card
                                    key={plan.title}
                                    sx={{
                                        position: 'relative',
                                        borderRadius: '20px',
                                        border: `1px solid ${plan.recommended ? alpha(theme.palette.primary.main, 0.08) : alpha('#182033', 0.1)}`,
                                        boxShadow: plan.recommended
                                            ? '0 26px 52px -28px rgba(15, 23, 42, 0.18)'
                                            : '0 14px 34px -26px rgba(15, 23, 42, 0.2)',
                                        background: '#ffffff',
                                        overflow: 'visible',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    {plan.recommended && (
                                        <Chip
                                            icon={<Sparkles size={14} />}
                                            label="Recommended"
                                            sx={{
                                                position: 'absolute',
                                                top: -14,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                height: 32,
                                                borderRadius: 999,
                                                bgcolor: 'primary.main',
                                                color: '#ffffff',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: '0.72rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.05em',
                                                textTransform: 'uppercase',
                                                boxShadow: `0 18px 32px -18px ${alpha(theme.palette.primary.main, 0.8)}`,
                                                '& .MuiChip-icon': { color: 'inherit' },
                                            }}
                                        />
                                    )}
                                    <CardContent sx={{
                                        p: { xs: 2.5, sm: 3, md: 2.6, lg: 3 },
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexGrow: 1,
                                        minHeight: { xs: 360, md: 430, lg: 470 },
                                    }}>
                                        <Chip
                                            label={plan.title}
                                            sx={{
                                                width: 'fit-content',
                                                mb: 2.1,
                                                height: 28,
                                                borderRadius: 999,
                                                bgcolor: plan.title === 'Scale' ? alpha(theme.palette.primary.main, 0.08) : alpha('#182033', 0.05),
                                                color: plan.title === 'Scale' ? 'primary.main' : '#697386',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: '0.7rem',
                                                fontWeight: 800,
                                                letterSpacing: '0.04em',
                                                textTransform: 'uppercase',
                                            }}
                                        />
                                        <Typography
                                            sx={{
                                                color: '#182033',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '1.6rem', md: '1.65rem', lg: '1.9rem' },
                                                lineHeight: 1.12,
                                                fontWeight: 800,
                                                letterSpacing: '-0.03em',
                                                mb: 1.2,
                                                minHeight: { xs: 64, md: 58, lg: 72 },
                                            }}
                                        >
                                            {plan.audience}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                color: '#697386',
                                                fontFamily: HERO_HEADLINE_FONT,
                                                fontSize: { xs: '0.92rem', md: '0.84rem', lg: '0.95rem' },
                                                lineHeight: 1.45,
                                                mb: 2.5,
                                                minHeight: { xs: 64, md: 54, lg: 70 },
                                            }}
                                        >
                                            {plan.description}
                                        </Typography>
                                        <Stack spacing={{ xs: 1.9, md: 1.45, lg: 1.9 }} sx={{ flexGrow: 1 }}>
                                            {plan.features.map((feature) => (
                                                <Stack key={feature} direction="row" spacing={1.15} alignItems="flex-start">
                                                    <Box sx={{
                                                        mt: 0.14, width: 18, height: 18,
                                                        display: 'grid', placeItems: 'center',
                                                        color: 'primary.main', flexShrink: 0,
                                                    }}>
                                                        <Check size={14} strokeWidth={2.8} />
                                                    </Box>
                                                    <Typography sx={{
                                                        color: '#465467',
                                                        fontFamily: HERO_HEADLINE_FONT,
                                                        fontSize: { xs: '0.92rem', md: '0.8rem', lg: '0.92rem' },
                                                        lineHeight: 1.35,
                                                        fontWeight: 500,
                                                    }}>
                                                        {feature}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>
                    </Box>

                    <Box
                        sx={{
                            maxWidth: 1280,
                            mx: 'auto',
                            p: 0,
                            borderRadius: 0,
                            bgcolor: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            mb: { xs: 7, md: 9 },
                        }}
                    >
                        <Stack spacing={1.5} sx={{ mb: { xs: 4, md: 5.5 }, maxWidth: 1120 }}>
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
                                {PRICING_PAGE_CONTENT.platform.eyebrow}
                            </Typography>
                            <Typography
                                sx={{
                                    maxWidth: 900,
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontSize: { xs: '1.85rem', md: '2.55rem', lg: '2.95rem' },
                                    lineHeight: { xs: 1.12, md: 1.06 },
                                    fontWeight: 800,
                                    letterSpacing: '-0.035em',
                                    color: '#182033',
                                }}
                            >
                                {PRICING_PAGE_CONTENT.platform.title}
                            </Typography>
                            <Typography
                                sx={{
                                    maxWidth: 980,
                                    color: '#697386',
                                    fontFamily: HERO_HEADLINE_FONT,
                                    fontSize: { xs: '0.82rem', md: '0.94rem' },
                                    lineHeight: { xs: 1.55, md: 1.58 },
                                }}
                            >
                                {PRICING_PAGE_CONTENT.platform.description}
                            </Typography>
                        </Stack>

                        <Box sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                            gap: { xs: 2.5, md: 2.25, lg: 3 },
                        }}>
                            {PRICING_PAGE_CONTENT.platform.capabilityGroups.map((group, index) => (
                                <Card
                                    key={group.title}
                                    sx={{
                                        borderRadius: '20px',
                                        border: `1px solid ${alpha('#182033', 0.1)}`,
                                        boxShadow: index === 1
                                            ? '0 26px 52px -28px rgba(15, 23, 42, 0.18)'
                                            : '0 14px 34px -26px rgba(15, 23, 42, 0.2)',
                                        background: '#ffffff',
                                        display: 'flex',
                                        flexDirection: 'column',
                                    }}
                                >
                                    <CardContent sx={{
                                        p: { xs: 2.5, sm: 3, md: 2.6, lg: 3 },
                                        display: 'flex',
                                        flexDirection: 'column',
                                        flexGrow: 1,
                                        minHeight: { xs: 300, md: 430, lg: 470 },
                                    }}>
                                        <Typography sx={{
                                            color: '#182033',
                                            fontFamily: HERO_HEADLINE_FONT,
                                            fontSize: { xs: '1.55rem', md: '1.6rem', lg: '1.85rem' },
                                            lineHeight: 1.12,
                                            fontWeight: 800,
                                            letterSpacing: '-0.03em',
                                            minHeight: { xs: 64, md: 58, lg: 72 },
                                            mb: 2.6,
                                        }}>
                                            {group.title}
                                        </Typography>
                                        <Stack spacing={{ xs: 1.9, md: 1.45, lg: 1.9 }} sx={{ flexGrow: 1 }}>
                                            {group.items.map((item) => (
                                                <Stack key={item} direction="row" spacing={1.15} alignItems="flex-start">
                                                    <Box sx={{
                                                        mt: 0.14, width: 18, height: 18,
                                                        display: 'grid', placeItems: 'center',
                                                        color: 'primary.main', flexShrink: 0,
                                                    }}>
                                                        <Check size={14} strokeWidth={2.8} />
                                                    </Box>
                                                    <Typography sx={{
                                                        color: '#465467',
                                                        fontFamily: HERO_HEADLINE_FONT,
                                                        fontSize: { xs: '0.92rem', md: '0.8rem', lg: '0.92rem' },
                                                        lineHeight: 1.35,
                                                        fontWeight: 500,
                                                    }}>
                                                        {item}
                                                    </Typography>
                                                </Stack>
                                            ))}
                                        </Stack>
                                    </CardContent>
                                </Card>
                            ))}
                        </Box>

                        <Stack alignItems="center" sx={{ pt: { xs: 4.5, md: 5.5 } }}>
                            <Button
                                component={RouterLink}
                                to={PRICING_PAGE_CONTENT.cta.primaryCta.to}
                                variant="contained"
                                sx={{
                                    minWidth: { xs: 210, md: 250 },
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
                                Let&apos;s Talk
                            </Button>
                        </Stack>
                    </Box>


                </Container>
            </Box>
        </>
    );
};

export default PricingPage;
