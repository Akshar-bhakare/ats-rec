import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Chip,
    ClickAwayListener,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Tooltip,
    Typography,
    useTheme,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import {
    JOURNEY_MAP,
    getJourneyRouteForRole,
    getNextJourneyStep,
    resolveJourneyRole,
    resolveJourneyStepIndex,
} from './journeyMapConfig';

const RING_SIZE = 68;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const getRingOffset = (progressValue) => {
    const bounded = Math.max(0, Math.min(Number(progressValue) || 0, 100));
    return RING_CIRCUMFERENCE - ((bounded / 100) * RING_CIRCUMFERENCE);
};

const JourneyFloatingWidget = ({ assistantPresent = false }) => {
    const [authState] = useAuthContextState();
    const [, setUiState] = useUiContextState();
    const [panelOpen, setPanelOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const theme = useTheme();

    const journeyRole = useMemo(() => {
        return resolveJourneyRole({
            pathname: location.pathname,
            role: authState?.user?.role,
            isAuthenticated: authState?.isAuthenticated,
        });
    }, [authState?.isAuthenticated, authState?.user?.role, location.pathname]);

    const journey = journeyRole ? JOURNEY_MAP[journeyRole] : null;

    if (!journey) return null;

    const currentStepIndex = resolveJourneyStepIndex(journey, location);
    const currentStep = journey.steps[currentStepIndex] || null;
    const nextStep = getNextJourneyStep(journey, currentStepIndex);
    const totalSteps = journey.steps.length;
    const progressValue = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
    const isLastStep = currentStepIndex >= totalSteps - 1;
    const journeyMapPath = getJourneyRouteForRole(journeyRole);
    const ringOffset = getRingOffset(progressValue);
    const rightOffset = { xs: 16, sm: 24 };
    const buttonBottom = assistantPresent
        ? { xs: 94, sm: 106, md: 112 }
        : { xs: 16, sm: 24 };
    const panelBottom = assistantPresent
        ? { xs: 174, sm: 188, md: 194 }
        : { xs: 96, sm: 108 };
    const panelTop = assistantPresent
        ? { xs: 72, sm: 84, md: 92 }
        : { xs: 72, sm: 80, md: 88 };

    const navigateTo = (to) => {
        if (!to) return;
        navigate(to);
        setPanelOpen(false);
    };

    const closeJourneyWidget = () => {
        setPanelOpen(false);
        setUiState({
            showJourneyResumeModal: false,
            hideJourneyGuide: true,
        });
    };

    return (
        <ClickAwayListener onClickAway={() => setPanelOpen(false)}>
            <Box>
                <Box
                    sx={{
                        position: 'fixed',
                        right: rightOffset,
                        bottom: buttonBottom,
                        zIndex: theme.zIndex.drawer + 3,
                    }}
                >
                    <Tooltip title={`${progressValue}%`} placement="top" arrow>
                        <IconButton
                            aria-label="Open journey steps"
                            onClick={() => setPanelOpen((prev) => !prev)}
                            sx={{
                                p: 0.2,
                                border: 1,
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                                boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
                                '&:hover': {
                                    bgcolor: 'background.paper',
                                    boxShadow: '0 12px 28px rgba(0,0,0,0.2)',
                                },
                            }}
                        >
                            <Box sx={{ position: 'relative', width: RING_SIZE, height: RING_SIZE }}>
                                <svg width={RING_SIZE} height={RING_SIZE}>
                                    <circle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RING_RADIUS}
                                        fill="none"
                                        stroke={theme.palette.grey[300]}
                                        strokeWidth={RING_STROKE}
                                    />
                                    <circle
                                        cx={RING_SIZE / 2}
                                        cy={RING_SIZE / 2}
                                        r={RING_RADIUS}
                                        fill="none"
                                        stroke={theme.palette.success.main}
                                        strokeWidth={RING_STROKE}
                                        strokeDasharray={RING_CIRCUMFERENCE}
                                        strokeDashoffset={ringOffset}
                                        strokeLinecap="round"
                                        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
                                        style={{ transition: 'stroke-dashoffset 280ms ease' }}
                                    />
                                </svg>
                                <Box
                                    sx={{
                                        position: 'absolute',
                                        inset: 0,
                                        display: 'grid',
                                        placeItems: 'center',
                                    }}
                                >
                                    <RouteRoundedIcon color="primary" />
                                </Box>
                            </Box>
                        </IconButton>
                    </Tooltip>
                </Box>

                {panelOpen && (
                    <Paper
                        elevation={8}
                        sx={{
                            position: 'fixed',
                            right: rightOffset,
                            top: panelTop,
                            bottom: panelBottom,
                            width: { xs: 'calc(100vw - 24px)', sm: 430 },
                            maxWidth: 'calc(100vw - 24px)',
                            maxHeight: 'calc(100dvh - 24px)',
                            p: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            borderRadius: 2,
                            border: 1,
                            borderColor: 'divider',
                            zIndex: theme.zIndex.drawer + 3,
                        }}
                    >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Chip
                                size="small"
                                icon={<RouteRoundedIcon />}
                                label={`${journey.audienceLabel} Journey`}
                            />
                            <IconButton size="small" onClick={() => setPanelOpen(false)}>
                                <CloseRoundedIcon fontSize="small" />
                            </IconButton>
                        </Stack>

                        <Box
                            sx={{
                                mt: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                overflowX: 'hidden',
                                pr: 0.25,
                                pb: 0.25,
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                What should I do next?
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Step {currentStepIndex + 1} of {totalSteps}: {currentStep?.title}
                            </Typography>

                            <Box sx={{ mt: 1.5 }}>
                                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                                        Progress
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {progressValue}% mapped
                                    </Typography>
                                </Stack>
                                <LinearProgress
                                    variant="determinate"
                                    value={progressValue}
                                    sx={{ height: 8, borderRadius: 4 }}
                                />
                            </Box>

                            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1.5 }}>
                                {journey.steps.map((step, index) => (
                                    <Button
                                        key={step.id}
                                        size="small"
                                        variant={index === currentStepIndex ? 'contained' : 'outlined'}
                                        disabled={!step.to}
                                        onClick={() => navigateTo(step.to)}
                                    >
                                        {index + 1}. {step.shortLabel || step.title}
                                    </Button>
                                ))}
                            </Stack>

                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.75 }}>
                                <Button
                                    variant="outlined"
                                    onClick={() => navigateTo(journeyMapPath)}
                                >
                                    Open Full Journey Map
                                </Button>
                                {!isLastStep && (
                                    <Button
                                        variant="contained"
                                        endIcon={<ArrowForwardRoundedIcon />}
                                        onClick={() => navigateTo(nextStep?.to)}
                                    >
                                        Next: {nextStep?.shortLabel || nextStep?.title}
                                    </Button>
                                )}
                                <Button
                                    variant="text"
                                    color="inherit"
                                    onClick={closeJourneyWidget}
                                >
                                    Stop
                                </Button>
                            </Stack>
                        </Box>
                    </Paper>
                )}
            </Box>
        </ClickAwayListener>
    );
};

export default JourneyFloatingWidget;
