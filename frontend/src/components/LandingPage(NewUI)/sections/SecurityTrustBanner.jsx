import { Box, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { ShieldCheck } from 'lucide-react';

const SecurityTrustBanner = () => {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const accent = theme.palette.primary.main;

    return (
        <Box
            sx={{
                py: { xs: 2.4, md: 3 },
                bgcolor: isDark ? alpha('#0f172a', 0.4) : alpha('#f8fafc', 0.8),
                borderTop: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', 0.08)}`,
                borderBottom: `1px solid ${alpha(isDark ? '#f8fafc' : '#dbe4f0', 0.08)}`,
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Container maxWidth="xl">
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={{ xs: 2, md: 4 }}
                    alignItems="center"
                    justifyContent="center"
                >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                            sx={{
                                width: 40,
                                height: 40,
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: alpha(accent, 0.1),
                                color: accent
                            }}
                        >
                            <ShieldCheck size={22} />
                        </Box>
                        <Box>
                            <Typography
                                sx={{
                                    fontSize: { xs: '0.85rem', md: '0.95rem' },
                                    fontWeight: 800,
                                    color: 'text.primary',
                                    letterSpacing: '0.01em',
                                    lineHeight: 1.2
                                }}
                            >
                                ISO/IEC 27001:2022 Certified
                            </Typography>
                            <Typography
                                sx={{
                                    fontSize: '0.72rem',
                                    fontWeight: 600,
                                    color: 'text.secondary',
                                    opacity: 0.8,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    mt: 0.2
                                }}
                            >
                                Enterprise-Grade Information Security
                            </Typography>
                        </Box>
                    </Stack>

                    <Box
                        sx={{
                            height: { xs: '1px', md: '28px' },
                            width: { xs: '60px', md: '1px' },
                            bgcolor: alpha(isDark ? '#f8fafc' : '#dbe4f0', 0.15),
                            display: { xs: 'none', md: 'block' }
                        }}
                    />

                    <Typography
                        sx={{
                            fontSize: { xs: '0.78rem', md: '0.88rem' },
                            color: 'text.secondary',
                            fontWeight: 500,
                            maxWidth: { xs: '100%', md: '500px' },
                            textAlign: { xs: 'center', md: 'left' },
                            lineHeight: 1.5
                        }}
                    >
                        We maintain the highest global standards for data protection and information security management
                        to ensure your hiring workflows are safe and compliant.
                    </Typography>
                </Stack>
            </Container>
        </Box>
    );
};

export default SecurityTrustBanner;
