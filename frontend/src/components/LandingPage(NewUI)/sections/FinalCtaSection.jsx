import { Box, Button, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const scrollToSection = (targetId) => {
    const target = document.getElementById(targetId);

    if (!target) {
        return;
    }

    const appBarOffset = 88;
    const top = target.getBoundingClientRect().top + window.scrollY - appBarOffset;
    window.scrollTo({ top, behavior: 'smooth' });
};

const openShowcaseDashboard = () => {
    window.dispatchEvent(new CustomEvent('hirexit:showcase-focus', {
        detail: { cardId: 'dashboard' }
    }));

    scrollToSection('product-walkthrough');
};

const FinalCtaSection = () => {
    const theme = useTheme();
    const accent = theme.palette.primary.main;

    return (
        <Box
            component="section"
            sx={{
                py: { xs: 6, md: 7.5 },
                bgcolor: accent
            }}
        >
            <Container sx={{ maxWidth: '1200px !important' }}>
                <Stack
                    spacing={{ xs: 2.4, md: 3.2 }}
                    alignItems="center"
                    textAlign="center"
                    sx={{ maxWidth: 860, mx: 'auto' }}
                >
                    <Typography
                        sx={{
                            fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                            fontSize: { xs: '1.7rem', md: '2.55rem' },
                            lineHeight: { xs: 1.14, md: 1.1 },
                            letterSpacing: '-0.05em',
                            fontWeight: 900,
                            color: '#ffffff'
                        }}
                    >
                        Ready to evolve your hiring process?
                    </Typography>

                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent="center"
                        sx={{ pt: { xs: 0.35, md: 0.6 } }}
                    >
                        <Button
                            component={RouterLink}
                            to="/book-demo"
                            variant="contained"
                            sx={{
                                minWidth: { xs: 190, md: 212 },
                                minHeight: { xs: 50, md: 58 },
                                px: { xs: 3.4, md: 4.2 },
                                borderRadius: '999px',
                                textTransform: 'none',
                                fontSize: { xs: '0.96rem', md: '1.02rem' },
                                fontWeight: 800,
                                bgcolor: '#171717',
                                color: '#ffffff',
                                boxShadow: 'none',
                                '&:hover': {
                                    bgcolor: '#0f0f10',
                                    boxShadow: 'none'
                                }
                            }}
                        >
                            Free Demo
                        </Button>

                        <Button
                            variant="contained"
                            onClick={openShowcaseDashboard}
                            sx={{
                                minWidth: { xs: 190, md: 212 },
                                minHeight: { xs: 50, md: 58 },
                                px: { xs: 3.4, md: 4.2 },
                                borderRadius: '999px',
                                textTransform: 'none',
                                fontSize: { xs: '0.96rem', md: '1.02rem' },
                                fontWeight: 800,
                                bgcolor: '#ffffff',
                                color: '#171717',
                                boxShadow: `0 18px 40px -26px ${alpha('#171717', 0.4)}`,
                                '&:hover': {
                                    bgcolor: '#f8fafc',
                                    boxShadow: `0 20px 42px -24px ${alpha('#171717', 0.42)}`
                                }
                            }}
                        >
                            Try Now
                        </Button>
                    </Stack>

                    <Typography
                        sx={{
                            color: alpha('#ffffff', 0.92),
                            fontSize: { xs: '0.86rem', md: '0.94rem' },
                            lineHeight: 1.65,
                            fontWeight: 500
                        }}
                    >
                        No credit card required. Setup in less than 10 minutes.
                    </Typography>
                </Stack>
            </Container>
        </Box>
    );
};

export default FinalCtaSection;
