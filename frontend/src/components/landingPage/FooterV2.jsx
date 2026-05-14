import { Box, Container, Divider, IconButton, Link, Stack, Typography, alpha } from '@mui/material';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import { MapPin } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

const productLinks = [
    { name: 'Our Story', href: '/about' },
    { name: 'Why Us?', href: '/why-us' },
    { name: 'Industries', href: '/industries' },
    { name: 'Pricing', href: '/pricing' }
];

const touchPoints = [
    // { icon: Mail, label: 'support@hirexit.com', href: 'mailto:support@hirexit.com' },
    { icon: MapPin, label: 'DUBAI, UAE' },
    { icon: MapPin, label: 'PUNE, INDIA' }
];

const FooterV2 = () => {
    return (
        <Box
            component="footer"
            sx={{
                bgcolor: '#1f2742',
                color: '#ffffff',
                borderTop: '1px solid #f97316'
            }}
        >
            <Container sx={{ maxWidth: '1140px !important', px: { xs: 3, md: 4 } }}>
                <Box sx={{ pt: { xs: 5.5, md: 6.5 }, pb: { xs: 3.5, md: 3.9 } }}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', md: '1.35fr 1fr 1fr' },
                            gap: { xs: 4, md: 8.5 },
                            alignItems: 'start'
                        }}
                    >
                        <Box sx={{ maxWidth: 310 }}>
                            <Stack direction="row" spacing={0.05} alignItems="flex-start" sx={{ mb: 2.1 }}>
                                <Typography
                                    sx={{
                                        fontSize: { xs: '1.9rem', md: '2.05rem' },
                                        fontWeight: 900,
                                        letterSpacing: '-0.05em',
                                        color: '#f97316',
                                        lineHeight: 0.96
                                    }}
                                >
                                    HIREX
                                </Typography>
                                <Typography
                                    sx={{
                                        pt: 0.24,
                                        fontSize: '0.84rem',
                                        fontWeight: 800,
                                        color: alpha('#ffffff', 0.5),
                                        lineHeight: 1
                                    }}
                                >
                                    REC
                                </Typography>
                            </Stack>

                            <Typography
                                sx={{
                                    maxWidth: 285,
                                    fontSize: '0.94rem',
                                    lineHeight: 1.72,
                                    color: alpha('#ffffff', 0.6),
                                    mb: 2.15
                                }}
                            >
                                Empowering enterprise recruitment through ethical AI and seamless candidate experiences.
                            </Typography>

                            <IconButton
                                component="a"
                                href="https://www.linkedin.com/company/hirex-it/?viewAsMember=true"
                                target="_blank"
                                rel="noreferrer"
                                sx={{
                                    width: 28,
                                    height: 28,
                                    p: 0,
                                    borderRadius: 1,
                                    color: alpha('#ffffff', 0.58),
                                    bgcolor: 'transparent',
                                    '&:hover': {
                                        color: '#ffffff',
                                        bgcolor: 'transparent'
                                    }
                                }}
                            >
                                <LinkedInIcon sx={{ fontSize: 16 }} />
                            </IconButton>
                        </Box>

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: '1.04rem',
                                    fontWeight: 800,
                                    color: '#ffffff',
                                    mb: 2
                                }}
                            >
                                Product
                            </Typography>

                            <Stack spacing={1.55}>
                                {productLinks.map((item) => (
                                    <Link
                                        key={item.name}
                                        component={RouterLink}
                                        to={item.href}
                                        underline="none"
                                        sx={{
                                            width: 'fit-content',
                                            fontSize: '0.95rem',
                                            fontWeight: 500,
                                            color: alpha('#ffffff', 0.72),
                                            transition: 'color 0.2s ease',
                                            '&:hover': {
                                                color: '#ffffff'
                                            }
                                        }}
                                    >
                                        {item.name}
                                    </Link>
                                ))}
                            </Stack>
                        </Box>

                        <Box>
                            <Typography
                                sx={{
                                    fontSize: '1.04rem',
                                    fontWeight: 800,
                                    color: '#ffffff',
                                    mb: 2
                                }}
                            >
                                Our Presence
                            </Typography>

                            <Stack spacing={1.55}>
                                {touchPoints.map((item) => {
                                    const Icon = item.icon;

                                    if (item.href) {
                                        return (
                                            <Link
                                                key={item.label}
                                                href={item.href}
                                                underline="none"
                                                sx={{
                                                    width: 'fit-content',
                                                    '&:hover .footer-touch-text': {
                                                        color: '#ffffff'
                                                    }
                                                }}
                                            >
                                                <Stack direction="row" spacing={1.15} alignItems="center">
                                                    <Icon size={14.5} color="#f97316" />
                                                    <Typography
                                                        className="footer-touch-text"
                                                        sx={{
                                                            fontSize: '0.95rem',
                                                            color: alpha('#ffffff', 0.72),
                                                            transition: 'color 0.2s ease'
                                                        }}
                                                    >
                                                        {item.label}
                                                    </Typography>
                                                </Stack>
                                            </Link>
                                        );
                                    }

                                    return (
                                        <Stack key={item.label} direction="row" spacing={1.15} alignItems="center">
                                            <Icon size={14.5} color="#f97316" />
                                            <Typography sx={{ fontSize: '0.95rem', color: alpha('#ffffff', 0.72) }}>
                                                {item.label}
                                            </Typography>
                                        </Stack>
                                    );
                                })}
                            </Stack>
                        </Box>
                    </Box>

                    <Divider sx={{ mt: { xs: 4.5, md: 5.4 }, mb: { xs: 2.8, md: 3.1 }, borderColor: alpha('#ffffff', 0.1) }} />

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 2
                        }}
                    >
                        <Typography sx={{ fontSize: '0.82rem', color: alpha('#ffffff', 0.42) }}>
                            {'\u00A9 2026 Hirex Rec. All rights reserved.'}
                        </Typography>

                        <Stack direction="row" spacing={2.8} flexWrap="wrap" useFlexGap>
                            <Link
                                component={RouterLink}
                                to="/termscondition/"
                                underline="none"
                                sx={{
                                    fontSize: '0.82rem',
                                    color: alpha('#ffffff', 0.42),
                                    '&:hover': {
                                        color: alpha('#ffffff', 0.76)
                                    }
                                }}
                            >
                                Terms of Service
                            </Link>
                            <Link
                                component={RouterLink}
                                to="/privacypolicy/#cookies"
                                underline="none"
                                sx={{
                                    fontSize: '0.82rem',
                                    color: alpha('#ffffff', 0.42),
                                    '&:hover': {
                                        color: alpha('#ffffff', 0.76)
                                    }
                                }}
                            >
                                Cookie Policy
                            </Link>
                        </Stack>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default FooterV2;
