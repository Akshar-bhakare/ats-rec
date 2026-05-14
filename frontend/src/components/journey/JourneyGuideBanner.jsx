import { useMemo } from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { Link, useLocation } from 'react-router-dom';

import { useAuthContextState } from '../../contexts/AuthContext';
import {
    JOURNEY_MAP,
    getNextJourneyStep,
    getJourneyRouteForRole,
    resolveJourneyRole,
    resolveJourneyStepIndex,
} from './journeyMapConfig';

const JourneyGuideBanner = ({ sx = {} }) => {
    const [authState] = useAuthContextState();
    const location = useLocation();

    const journeyRole = useMemo(() => {
        return resolveJourneyRole({
            pathname: location.pathname,
            role: authState?.user?.role,
            isAuthenticated: authState?.isAuthenticated,
        });
    }, [authState?.isAuthenticated, authState?.user?.role, location.pathname]);

    const journey = journeyRole ? JOURNEY_MAP[journeyRole] : null;
    const journeyMapPath = journeyRole ? getJourneyRouteForRole(journeyRole) : '/journey-map/';
    const currentStepIndex = journey
        ? resolveJourneyStepIndex(journey, location)
        : 0;
    const currentStep = journey?.steps?.[currentStepIndex] || null;
    const nextStep = journey ? getNextJourneyStep(journey, currentStepIndex) : null;

    if (!journey || !currentStep) return null;

    const totalSteps = journey.steps.length;
    const progressValue = Math.round(((currentStepIndex + 1) / totalSteps) * 100);
    const isLastStep = currentStepIndex >= totalSteps - 1;

    return (
        <Paper
            elevation={0}
            sx={{
                border: 1,
                borderColor: 'divider',
                borderRadius: 2,
                p: { xs: 1.5, md: 2 },
                ...sx,
            }}
        >
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', md: 'center' }}
            >
                <Box>
                    <Chip
                        size="small"
                        icon={<RouteRoundedIcon />}
                        label={`${journey.audienceLabel} Journey`}
                        sx={{ mb: 1 }}
                    />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
                        What should I do next?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {journey.goal}
                    </Typography>
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button
                        size="small"
                        component={Link}
                        to={journeyMapPath}
                        variant="outlined"
                    >
                        Open Full Journey Map
                    </Button>
                    {nextStep?.to && !isLastStep && (
                        <Button
                            size="small"
                            component={Link}
                            to={nextStep.to}
                            variant="contained"
                            endIcon={<ArrowForwardRoundedIcon />}
                        >
                            Next: {nextStep.shortLabel || nextStep.title}
                        </Button>
                    )}
                </Stack>
            </Stack>

            <Box sx={{ mt: 1.5 }}>
                <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                >
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                        Step {currentStepIndex + 1} of {totalSteps}: {currentStep.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                        {progressValue}% flow mapped
                    </Typography>
                </Stack>
                <LinearProgress
                    variant="determinate"
                    value={progressValue}
                    sx={{ height: 7, borderRadius: 4 }}
                />
            </Box>

            <Stack
                direction="row"
                useFlexGap
                flexWrap="wrap"
                spacing={0.75}
                sx={{ mt: 1.5 }}
            >
                {journey.steps.map((step, index) => {
                    const isActive = index === currentStepIndex;
                    const stepLabel = `${index + 1}. ${step.shortLabel || step.title}`;

                    if (step.to) {
                        return (
                            <Button
                                key={step.id}
                                component={Link}
                                to={step.to}
                                size="small"
                                variant={isActive ? 'contained' : 'outlined'}
                            >
                                {stepLabel}
                            </Button>
                        );
                    }

                    return (
                        <Chip
                            key={step.id}
                            size="small"
                            label={stepLabel}
                            color={isActive ? 'primary' : 'default'}
                            variant={isActive ? 'filled' : 'outlined'}
                        />
                    );
                })}
            </Stack>

            {isLastStep && (
                <Alert severity="success" sx={{ mt: 1.5 }}>
                    You are on the final mapped step for this role.
                </Alert>
            )}
        </Paper>
    );
};

export default JourneyGuideBanner;
