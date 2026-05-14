import { Box, Container, Typography, useTheme, useMediaQuery, Stack, Button, Tab, Tabs, Card } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { SECTORS } from '../lib/constants';
import SectionHeading from '../components/ui/SectionHeading';
import { ChevronRight, ArrowUpRight } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

const UseCases = () => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [activeIndex, setActiveIndex] = useState(0);

    const handleTabChange = (event, newValue) => {
        setActiveIndex(newValue);
    };

    const activeSector = SECTORS[activeIndex];

    return (
        <Box
            id="sectors"
            sx={{
                py: { xs: 10, md: 15 },
                bgcolor: theme.palette.mode === 'dark' ? '#0F172A' : '#F8FAFC',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Container maxWidth="lg">
                <SectionHeading
                    title="Smart Hiring Software Trusted by Growing Teams"
                    subtitle="Hirex REC adapts to industry-specific hiring complexity so recruiting teams can scale AI talent acquisition workflows without rebuilding the process every quarter."
                    align="center"
                    sx={{ mb: 8 }}
                />

                {/* Simplified Tab Navigation */}
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 6,
                    borderBottom: `1px solid ${theme.palette.divider}`
                }}>
                    <Tabs
                        value={activeIndex}
                        onChange={handleTabChange}
                        variant={isMobile ? "scrollable" : "standard"}
                        scrollButtons={isMobile ? "auto" : false}
                        sx={{
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: '3px 3px 0 0',
                                bgcolor: 'primary.main',
                            },
                        }}
                    >
                        {SECTORS.map((sector, index) => (
                            <Tab
                                key={index}
                                label={sector.name.split(' & ')[0]}
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '0.9rem',
                                    px: 4,
                                    py: 3,
                                    color: 'text.secondary',
                                    '&.Mui-selected': {
                                        color: 'primary.main',
                                    },
                                    textTransform: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        ))}
                    </Tabs>
                </Box>

                {/* Content Area */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeIndex}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -30 }}
                        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <Card sx={{
                            p: { xs: 3, md: 4 },
                            borderRadius: 6,
                            display: 'flex',
                            flexDirection: { xs: 'column', md: 'row' },
                            alignItems: 'stretch',
                            gap: { xs: 4, md: 6 },
                            bgcolor: theme.palette.mode === 'dark' ? '#1E293B' : '#FFFFFF',
                            boxShadow: theme.palette.mode === 'dark'
                                ? '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                                : '0 25px 50px -12px rgba(0, 0, 0, 0.05)',
                            border: `1px solid ${theme.palette.divider}`,
                            overflow: 'hidden',
                            minHeight: { md: 540 }
                        }}>
                            {/* Left: Image Representation */}
                            <Box sx={{
                                flex: { xs: 'none', md: 1 },
                                height: { xs: 260, md: 'auto' },
                                borderRadius: 4,
                                overflow: 'hidden',
                                position: 'relative',
                                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                display: 'flex',
                                border: `1px solid ${theme.palette.divider}`
                            }}>
                                <motion.img
                                    key={activeSector.image}
                                    src={activeSector.image}
                                    alt={activeSector.alt}
                                    initial={{ scale: 1.1, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.8 }}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'cover',
                                        display: 'block'
                                    }}
                                />
                                <Box sx={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'linear-gradient(to top, rgba(0,0,0,0.3), transparent)',
                                    pointerEvents: 'none'
                                }} />

                                {/* Overlay Icon Badge */}
                                <Box sx={{
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                    width: 48,
                                    height: 48,
                                    borderRadius: 1.5,
                                    bgcolor: 'rgba(255,255,255,0.95)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'primary.main',
                                    backdropFilter: 'blur(8px)',
                                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                                    zIndex: 2
                                }}>
                                    <activeSector.icon size={24} strokeWidth={2.5} />
                                </Box>
                            </Box>

                            {/* Right: Content Details */}
                            <Box sx={{
                                flex: 1.2,
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                py: { md: 2 }
                            }}>
                                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                                    <Box sx={{ width: 12, height: 2, bgcolor: 'primary.main', borderRadius: 1 }} />
                                    <Typography variant="overline" sx={{ fontWeight: 900, color: 'primary.main', letterSpacing: 2 }}>
                                        {activeSector.name.toUpperCase()}
                                    </Typography>
                                </Stack>

                                <Typography variant="h3" sx={{
                                    fontWeight: 900,
                                    mb: 2,
                                    fontSize: { xs: '2rem', md: '2.5rem' },
                                    color: 'text.primary',
                                    lineHeight: 1.2
                                }}>
                                    {activeSector.name}
                                </Typography>
                                <Typography variant="body1" sx={{
                                    color: 'text.secondary',
                                    fontSize: '1.1rem',
                                    mb: 4,
                                    lineHeight: 1.6,
                                    minHeight: { md: 80 }
                                }}>
                                    {activeSector.desc}
                                </Typography>

                                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 5 }}>
                                    {activeSector.tags.map((tag, i) => (
                                        <Box key={i} sx={{
                                            px: 2,
                                            py: 0.6,
                                            borderRadius: 2,
                                            bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                            color: 'text.primary',
                                            fontSize: '0.8rem',
                                            fontWeight: 700,
                                            border: `1px solid ${theme.palette.divider}`,
                                            m: 0.5
                                        }}>
                                            {tag}
                                        </Box>
                                    ))}
                                </Stack>

                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                                    <Button
                                        component={RouterLink}
                                        to="/solutions"
                                        variant="contained"
                                        size="large"
                                        endIcon={<ChevronRight />}
                                        sx={{
                                            px: 4,
                                            py: 1.5,
                                            borderRadius: 2.5,
                                            fontWeight: 800,
                                            fontSize: '0.95rem',
                                            boxShadow: `0 10px 20px ${theme.palette.primary.main}20`
                                        }}
                                    >
                                        Explore Solutions
                                    </Button>
                                </Stack>
                            </Box>
                        </Card>
                    </motion.div>
                </AnimatePresence>
            </Container>
        </Box>
    );
};

export default UseCases;
