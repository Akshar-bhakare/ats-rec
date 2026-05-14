import {
    Box,
    Button,
    Chip,
    Divider,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import { Link, Navigate, useLocation } from 'react-router-dom';

import { useAuthContextState } from '../../contexts/AuthContext';
import {
    JOURNEY_MAP,
    getJourneyRouteForRole,
    isJourneyRole,
    resolveJourneyRole,
    resolveJourneyRoleFromUserRole,
    resolveJourneyStepIndex,
} from './journeyMapConfig';

const PROFILE_USE_CASES = [
    {
        title: 'Recruitment Platforms',
        description: 'Supports multi-client hiring operations where standardization and speed are critical.',
    },
    {
        title: 'Enterprise Bulk Hiring',
        description: 'Aligns large company workflows for role-wise intake, pipeline movement, and interview closure.',
    },
];

const JourneyMapPage = ({ roleKey = null }) => {
    const [authState] = useAuthContextState();
    const location = useLocation();

    const isAuthed = !!authState?.isAuthenticated;
    const signedInJourneyRole = resolveJourneyRoleFromUserRole(authState?.user?.role);
    const requestedRole = isJourneyRole(roleKey) ? roleKey : null;

    if (isAuthed && signedInJourneyRole && requestedRole && requestedRole !== signedInJourneyRole) {
        return <Navigate replace to={getJourneyRouteForRole(signedInJourneyRole)} />;
    }

    if (!isAuthed && requestedRole && requestedRole !== 'candidate') {
        return <Navigate replace to={getJourneyRouteForRole('candidate')} />;
    }

    const effectiveRole = requestedRole ||
        signedInJourneyRole ||
        resolveJourneyRole({
            pathname: location.pathname,
            role: authState?.user?.role,
            isAuthenticated: authState?.isAuthenticated,
        }) ||
        'candidate';

    const journey = JOURNEY_MAP[effectiveRole] || JOURNEY_MAP.candidate;
    const currentStepIndex = resolveJourneyStepIndex(journey, location);
    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 4 },
                pt: { xs: 1.5, sm: 2, md: 2.5 },
                pb: { xs: 3, sm: 4, md: 5 },
                mx: { xs: 0, sm: '1vw' },
                minHeight: '80vh',
            }}
        >
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
                {journey.audienceLabel} Journey Map
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1, maxWidth: 960 }}>
                Role-specific guidance to reduce confusion and keep hiring actions in the right order.
            </Typography>

            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                sx={{ mt: 2.5 }}
            >
                {PROFILE_USE_CASES.map((profile) => (
                    <Paper
                        key={profile.title}
                        elevation={0}
                        sx={{
                            flex: 1,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 2,
                        }}
                    >
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            {profile.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {profile.description}
                        </Typography>
                    </Paper>
                ))}
            </Stack>

            <Paper
                elevation={0}
                sx={{
                    mt: 2.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    overflow: 'hidden',
                }}
            >
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1.5}
                        alignItems={{ xs: 'flex-start', md: 'center' }}
                        justifyContent="space-between"
                    >
                        <Box>
                            <Chip
                                size="small"
                                icon={<RouteRoundedIcon />}
                                label={`${journey.audienceLabel} Journey`}
                                sx={{ mb: 1, mt: 1 }}
                            />
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {journey.goal}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                Current route aligns to step {currentStepIndex + 1} of {journey.steps.length}.
                            </Typography>
                        </Box>
                    </Stack>

                    <Stack spacing={1.25} sx={{ mt: 2 }}>
                        {journey.steps.map((step, index) => {
                            const isDone = index < currentStepIndex;

                            return (
                                <Paper
                                    key={step.id}
                                    elevation={0}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 2,
                                        p: 1.5,
                                        backgroundColor: 'background.paper',
                                    }}
                                >
                                    <Stack
                                        direction={{ xs: 'column', md: 'row' }}
                                        spacing={1}
                                        alignItems={{ xs: 'flex-start', md: 'center' }}
                                        justifyContent="space-between"
                                    >
                                        <Box>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                                    Step {index + 1}. {step.title}
                                                </Typography>
                                                {isDone && <Chip label="Done path" size="small" color="success" variant="outlined" />}
                                            </Stack>
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 860 }}>
                                                {step.description}
                                            </Typography>
                                        </Box>

                                        {step.to && (
                                            <Button
                                                component={Link}
                                                to={step.to}
                                                size="small"
                                                variant="outlined"
                                            >
                                                Open Step
                                            </Button>
                                        )}
                                    </Stack>
                                    {index < journey.steps.length - 1 && <Divider sx={{ mt: 1.5 }} />}
                                </Paper>
                            );
                        })}
                    </Stack>
                </Box>
            </Paper>
        </Box>
    );
};

export default JourneyMapPage;
