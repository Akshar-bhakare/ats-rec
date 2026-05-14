import { useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import {
    JOURNEY_MAP,
    getJourneyRouteForRole,
    isLocationOnJourneyStep,
    resolveJourneyRoleFromUserRole,
} from './journeyMapConfig';

const FLOW_STATE_PREFIX = 'journey_flow_state_v1';

const defaultFlowState = {
    active: false,
    currentStepIndex: 0,
};

const clampStepIndex = (value, max) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.min(parsed, max));
};

const JourneyResumeModal = () => {
    const [authState] = useAuthContextState();
    const [uiState, setUiState] = useUiContextState();
    const [flowVersion, setFlowVersion] = useState(0);
    const navigate = useNavigate();
    const location = useLocation();

    const isAuthed = !!authState?.isAuthenticated;
    const userId = authState?.user?._id ? String(authState.user._id) : '';
    const roleKey = resolveJourneyRoleFromUserRole(authState?.user?.role);
    const journey = roleKey ? JOURNEY_MAP[roleKey] : null;

    if (!journey || !userId || !isAuthed) return null;

    const storageKey = `${FLOW_STATE_PREFIX}:${userId}:${roleKey}`;
    const firstStep = journey.steps[0] || null;
    const journeyPath = getJourneyRouteForRole(roleKey);

    const readFlowState = () => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (!raw) return defaultFlowState;

            const parsed = JSON.parse(raw);
            return {
                active: Boolean(parsed?.active),
                currentStepIndex: clampStepIndex(parsed?.currentStepIndex, journey.steps.length - 1),
            };
        } catch {
            return defaultFlowState;
        }
    };

    const writeFlowState = (nextState) => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextState));
        } catch {
            // no-op
        }
        setFlowVersion((prev) => prev + 1);
    };

    const clearFlowState = () => {
        writeFlowState(defaultFlowState);
    };

    void flowVersion;
    const flowState = readFlowState();

    const currentStepIndex = clampStepIndex(flowState.currentStepIndex, journey.steps.length - 1);
    const currentStep = journey.steps[currentStepIndex] || null;
    const nextStep = journey.steps[currentStepIndex + 1] || null;

    const initialModalOpen = Boolean(uiState?.showJourneyResumeModal);
    const stepModalOpen =
        !initialModalOpen &&
        flowState.active &&
        Boolean(currentStep && isLocationOnJourneyStep(currentStep, location));

    const dismissJourneyModals = () => {
        setUiState({
            showJourneyResumeModal: false,
            hideJourneyGuide: true,
        });
        clearFlowState();
    };

    const startJourneyFlow = () => {
        setUiState({
            showJourneyResumeModal: false,
            hideJourneyGuide: false,
        });
        writeFlowState({
            active: true,
            currentStepIndex: 0,
        });

        if (firstStep?.to) {
            navigate(firstStep.to);
        } else {
            navigate(journeyPath);
        }
    };

    const skipJourneyFlow = () => {
        dismissJourneyModals();
    };

    const closeJourneyPopupOnly = () => {
        setUiState({
            showJourneyResumeModal: false,
            hideJourneyGuide: false,
        });
        clearFlowState();
    };

    const handleInitialModalClose = (_event, reason) => {
        if (reason === 'backdropClick') {
            closeJourneyPopupOnly();
            return;
        }
        skipJourneyFlow();
    };

    const continueToNextStep = () => {
        if (!flowState.active) return;

        const isLastStep = currentStepIndex >= journey.steps.length - 1;
        if (isLastStep) {
            clearFlowState();
            navigate(journeyPath);
            return;
        }

        const nextIndex = currentStepIndex + 1;
        writeFlowState({
            active: true,
            currentStepIndex: nextIndex,
        });

        const nextRoute = journey.steps[nextIndex]?.to || journeyPath;
        navigate(nextRoute);
    };

    const stopStepByStepJourney = () => {
        dismissJourneyModals();
        navigate(journeyPath);
    };

    const handleStepModalClose = (_event, reason) => {
        if (reason === 'backdropClick') {
            closeJourneyPopupOnly();
            return;
        }
        stopStepByStepJourney();
    };

    return (
        <>
            <Dialog
                open={initialModalOpen}
                onClose={handleInitialModalClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1 }}>
                    Continue Your {journey.audienceLabel} Journey?
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Click continue to start a guided step-by-step flow. We will move you through each step popup and finally open your journey map page.
                    </Typography>

                    <Box
                        sx={{
                            mt: 2,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 2,
                            p: 1.5,
                        }}
                    >
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            First Step: 1. {firstStep?.title || 'Journey Start'}
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={skipJourneyFlow} variant="outlined">
                        Skip journey
                    </Button>
                    <Button onClick={startJourneyFlow} variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
                        Continue journey
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={stepModalOpen}
                onClose={handleStepModalClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1 }}>
                    {journey.audienceLabel} Guided Flow
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={1.25}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                            Current Step: {currentStepIndex + 1}. {currentStep?.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {currentStep?.description}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {nextStep
                                ? `Next Step: ${nextStep.shortLabel || nextStep.title}`
                                : 'This is the last step. Continue to open your role journey map.'}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={stopStepByStepJourney} variant="outlined">
                        Stop journey flow
                    </Button>
                    <Button onClick={continueToNextStep} variant="contained" endIcon={<ArrowForwardRoundedIcon />}>
                        {nextStep ? 'Continue to next step' : 'Open journey map'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default JourneyResumeModal;
