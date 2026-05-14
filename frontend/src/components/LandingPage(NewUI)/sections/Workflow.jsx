import { useEffect, useRef, useState } from 'react';
import { Box, Container, Paper, Typography, alpha, useTheme } from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { WORKFLOW_STEPS } from '../lib/constants';

const ORBIT_SIZES = ['32%', '48%', '64%', '82%'];

const VISUAL_NODE_POSITIONS = [
    { top: '28%', left: '73%', color: 'secondary' },
    { top: '40%', left: '72%', color: 'primary' },
    { top: '61%', left: '28%', color: 'secondary' },
    { top: '73%', left: '58%', color: 'primary' }
];

const Workflow = () => {
    const theme = useTheme();
    const [activeStep, setActiveStep] = useState(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState(true);
    const [progress, setProgress] = useState(0);
    const progressIntervalRef = useRef(null);

    const stepDuration = 4600;
    const currentStep = WORKFLOW_STEPS[activeStep];
    const StepIcon = currentStep.icon;

    useEffect(() => {
        window.clearInterval(progressIntervalRef.current);

        if (!isAutoPlaying) {
            return undefined;
        }

        progressIntervalRef.current = window.setInterval(() => {
            setProgress((current) => {
                const next = current + (100 / (stepDuration / 100));

                if (next >= 100) {
                    setActiveStep((index) => (index + 1) % WORKFLOW_STEPS.length);
                    return 0;
                }

                return next;
            });
        }, 100);

        return () => window.clearInterval(progressIntervalRef.current);
    }, [activeStep, isAutoPlaying]);

    const handleStepClick = (index) => {
        setActiveStep(index);
        setProgress(0);
    };

    return (
        <Box
            id="workflow"
            sx={{
                py: { xs: 6, md: 8 },
                backgroundColor: '#1c1c1e',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            <Box
                sx={{
                    position: 'absolute',
                    inset: 0,
                    background: `
                        radial-gradient(circle at 18% 18%, rgba(236, 103, 39, 0.06), transparent 24%),
                        radial-gradient(circle at 82% 78%, rgba(52, 120, 188, 0.05), transparent 26%)
                    `,
                    pointerEvents: 'none'
                }}
            />

            <Container maxWidth="xl" sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ maxWidth: 1060, mx: 'auto' }}>
                    <Paper
                        elevation={0}
                        onMouseEnter={() => setIsAutoPlaying(false)}
                        onMouseLeave={() => setIsAutoPlaying(true)}
                        sx={{
                            borderRadius: { xs: '28px', md: '34px' },
                            p: { xs: 1.5, sm: 2, md: 2.35 },
                            bgcolor: '#ffffff',
                            border: '1px solid rgba(226, 232, 240, 0.9)',
                            boxShadow: '0 40px 90px rgba(0, 0, 0, 0.24)'
                        }}
                    >
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '250px minmax(0, 1fr)' },
                                gap: { xs: 2.25, md: 3 },
                                alignItems: 'start'
                            }}
                        >
                            <Box>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, minmax(0, 1fr))', md: '1fr' },
                                        gap: 1
                                    }}
                                >
                                    {WORKFLOW_STEPS.map((step, index) => {
                                        const active = index === activeStep;
                                        const Icon = step.icon;

                                        return (
                                            <Box
                                                key={step.id}
                                                onClick={() => handleStepClick(index)}
                                                sx={{
                                                    px: { xs: 1.05, md: 1.2 },
                                                    py: { xs: 0.95, md: 1.1 },
                                                    borderRadius: '16px',
                                                    border: `1px solid ${active ? alpha(theme.palette.primary.main, 0.28) : 'transparent'}`,
                                                    bgcolor: active ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.22s ease',
                                                    '&:hover': {
                                                        bgcolor: active ? alpha(theme.palette.primary.main, 0.1) : alpha('#94a3b8', 0.08),
                                                        transform: 'translateX(4px)'
                                                    }
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: { xs: 34, md: 36 },
                                                        height: { xs: 34, md: 36 },
                                                        borderRadius: '10px',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        flexShrink: 0,
                                                        bgcolor: active ? theme.palette.primary.main : '#eef3f9',
                                                        color: active ? '#ffffff' : '#64748b',
                                                        boxShadow: active ? `0 16px 32px ${alpha(theme.palette.primary.main, 0.24)}` : 'none'
                                                    }}
                                                >
                                                    <Icon size={16} strokeWidth={2.15} />
                                                </Box>

                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography
                                                        sx={{
                                                            fontSize: { xs: '0.62rem', md: '0.67rem' },
                                                            lineHeight: 1.25,
                                                            fontWeight: 800,
                                                            textTransform: 'uppercase',
                                                            letterSpacing: '0.06em',
                                                            color: active ? '#23314d' : '#6b7a93'
                                                        }}
                                                    >
                                                        {step.navLabel}
                                                    </Typography>

                                                    {active && (
                                                        <Box
                                                            sx={{
                                                                mt: 1,
                                                                height: 3,
                                                                borderRadius: 999,
                                                                bgcolor: alpha(theme.palette.primary.main, 0.12),
                                                                overflow: 'hidden'
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    width: `${progress}%`,
                                                                    height: '100%',
                                                                    borderRadius: 999,
                                                                    background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.68)} 100%)`
                                                                }}
                                                            />
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            </Box>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentStep.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -16 }}
                                    transition={{ duration: 0.36, ease: 'easeOut' }}
                                >
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 1.8, md: 2.2 } }}>
                                        <Box
                                            sx={{
                                                display: 'inline-flex',
                                                alignSelf: 'flex-start',
                                                px: 1.25,
                                                py: 0.58,
                                                borderRadius: 999,
                                                bgcolor: alpha(theme.palette.primary.main, 0.08),
                                                color: theme.palette.primary.main
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontSize: { xs: '0.62rem', md: '0.66rem' },
                                                    fontWeight: 900,
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.12em'
                                                }}
                                            >
                                                {currentStep.stageLabel}
                                            </Typography>
                                        </Box>

                                        <Typography
                                            component="h2"
                                            sx={{
                                                maxWidth: 620,
                                                color: '#1f2a3d',
                                                fontFamily: "'Sora','Space Grotesk','Outfit','Segoe UI',sans-serif",
                                                fontSize: { xs: '1.62rem', sm: '1.95rem', md: '2.4rem' },
                                                lineHeight: { xs: 1.12, md: 1.08 },
                                                letterSpacing: '-0.04em',
                                                fontWeight: 850
                                            }}
                                        >
                                            {currentStep.title}
                                        </Typography>

                                        <Typography
                                            sx={{
                                                maxWidth: 630,
                                                color: '#64748b',
                                                fontSize: { xs: '0.94rem', md: '1rem' },
                                                lineHeight: 1.68
                                            }}
                                        >
                                            {currentStep.description}
                                        </Typography>

                                        <Box
                                            sx={{
                                                position: 'relative',
                                                minHeight: { xs: 240, md: 330 },
                                                borderRadius: { xs: '24px', md: '28px' },
                                                border: '1px solid #e7edf5',
                                                background: 'linear-gradient(180deg, #fbfcff 0%, #f4f7fb 100%)',
                                                overflow: 'hidden',
                                                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)'
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    background: `
                                                        radial-gradient(circle at 28% 20%, rgba(236, 103, 39, 0.08), transparent 24%),
                                                        radial-gradient(circle at 74% 76%, rgba(52, 120, 188, 0.07), transparent 26%)
                                                    `
                                                }}
                                            />

                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: { xs: 14, md: 20 },
                                                    right: { xs: 14, md: 20 },
                                                    zIndex: 3,
                                                    px: { xs: 1.15, md: 1.45 },
                                                    py: 0.8,
                                                    borderRadius: '14px',
                                                    bgcolor: '#ffffff',
                                                    border: '1px solid #edf2f7',
                                                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        bgcolor: '#22c55e'
                                                    }}
                                                />
                                                <Typography
                                                    sx={{
                                                        fontSize: { xs: '0.58rem', md: '0.62rem' },
                                                        fontWeight: 900,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.12em',
                                                        color: '#334155'
                                                    }}
                                                >
                                                    {currentStep.signalLabel}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: { xs: 14, md: 18 },
                                                    left: { xs: 14, md: 20 },
                                                    zIndex: 3,
                                                    px: { xs: 1.15, md: 1.45 },
                                                    py: 0.8,
                                                    borderRadius: '14px',
                                                    bgcolor: '#ffffff',
                                                    border: '1px solid #edf2f7',
                                                    boxShadow: '0 20px 40px rgba(15, 23, 42, 0.08)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        bgcolor: theme.palette.primary.main
                                                    }}
                                                />
                                                <Typography
                                                    sx={{
                                                        fontSize: { xs: '0.58rem', md: '0.62rem' },
                                                        fontWeight: 900,
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.12em',
                                                        color: '#334155'
                                                    }}
                                                >
                                                    {currentStep.processLabel}
                                                </Typography>
                                            </Box>

                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    display: 'grid',
                                                    placeItems: 'center'
                                                }}
                                            >
                                                {ORBIT_SIZES.map((size, index) => (
                                                    <Box
                                                        key={size}
                                                        component={motion.div}
                                                        animate={{ rotate: 360 }}
                                                        transition={{
                                                            duration: 18 + (index * 7),
                                                            repeat: Infinity,
                                                            ease: 'linear'
                                                        }}
                                                        sx={{
                                                            position: 'absolute',
                                                            width: size,
                                                            aspectRatio: '1 / 1',
                                                            borderRadius: '50%',
                                                            border: `1px dashed ${alpha('#94a3b8', index === 0 ? 0.28 : 0.18)}`
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '100%',
                                                                transform: 'translate(-50%, -50%)',
                                                                width: index < 2 ? 8 : 6,
                                                                height: index < 2 ? 8 : 6,
                                                                borderRadius: '50%',
                                                                bgcolor: index % 2 === 0 ? theme.palette.primary.main : theme.palette.secondary.main,
                                                                boxShadow: `0 0 0 8px ${alpha(index % 2 === 0 ? theme.palette.primary.main : theme.palette.secondary.main, 0.08)}`
                                                            }}
                                                        />
                                                    </Box>
                                                ))}

                                                {VISUAL_NODE_POSITIONS.map((node, index) => (
                                                    <Box
                                                        key={`${node.color}-${index}`}
                                                        component={motion.div}
                                                        animate={{ scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
                                                        transition={{ duration: 2.2 + (index * 0.4), repeat: Infinity, ease: 'easeInOut' }}
                                                        sx={{
                                                            position: 'absolute',
                                                            top: node.top,
                                                            left: node.left,
                                                            width: index === 0 ? 8 : 6,
                                                            height: index === 0 ? 8 : 6,
                                                            borderRadius: '50%',
                                                            bgcolor: node.color === 'primary' ? theme.palette.primary.main : theme.palette.secondary.main,
                                                            boxShadow: `0 0 0 6px ${alpha(node.color === 'primary' ? theme.palette.primary.main : theme.palette.secondary.main, 0.08)}`
                                                        }}
                                                    />
                                                ))}

                                                <Box
                                                    component={motion.div}
                                                    animate={{ y: [0, -10, 0], scale: [1, 1.03, 1] }}
                                                    transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
                                                    sx={{
                                                        position: 'relative',
                                                        zIndex: 2,
                                                        width: { xs: 96, md: 116 },
                                                        height: { xs: 96, md: 116 },
                                                        borderRadius: '50%',
                                                        display: 'grid',
                                                        placeItems: 'center',
                                                        bgcolor: '#ffffff',
                                                        border: `4px solid ${theme.palette.primary.main}`,
                                                        boxShadow: `0 28px 64px -30px ${alpha(theme.palette.primary.main, 0.36)}`
                                                    }}
                                                >
                                                    <StepIcon size={56} strokeWidth={1.75} color={theme.palette.primary.main} />
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </motion.div>
                            </AnimatePresence>
                        </Box>
                    </Paper>
                </Box>
            </Container>
        </Box>
    );
};

export default Workflow;
