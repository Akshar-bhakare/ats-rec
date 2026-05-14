/* eslint-disable no-unused-vars */

import React from 'react';
import {
    Box,
    Stepper,
    Step,
    StepLabel,
    StepConnector,
    stepConnectorClasses,
    styled,
    Typography,
} from '@mui/material';

// --- Icons ---
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// --- styled Components ---

const ColorlibConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.alternativeLabel}`]: {
        top: 16,
    },
    [`&.${stepConnectorClasses.active}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: '#56B6F7', // Light Blue/Cyan from image 
        },
    },
    [`&.${stepConnectorClasses.completed}`]: {
        [`& .${stepConnectorClasses.line}`]: {
            borderColor: '#56B6F7',
        },
    },
    [`& .${stepConnectorClasses.line}`]: {
        borderColor: '#E5E7EB',
        borderTopWidth: 2,
        borderRadius: 1,
    },
}));

const ColorlibStepIconRoot = styled('div')(({ theme, ownerState }) => ({
    backgroundColor: '#fff',
    zIndex: 1,
    color: ownerState.active || ownerState.completed ? '#F59E0B' : '#E5E7EB', // Yellow/Orange for active/completed (as per user image hint 'L1' yellow)
    width: 'var(--step-icon-size, 32px)',
    height: 'var(--step-icon-size, 32px)',
    display: 'flex',
    borderRadius: '50%',
    justifyContent: 'center',
    alignItems: 'center',
    border: ownerState.active || ownerState.completed ? '2px solid #F59E0B' : '2px solid #E5E7EB',
    transition: 'all 0.2s ease-in-out',
}));

function ColorlibStepIcon(props) {
    const { active, completed, className } = props;

    return (
        <ColorlibStepIconRoot ownerState={{ completed, active }} className={className}>
            <HourglassEmptyIcon sx={{ fontSize: 'var(--step-icon-font-size, 16px)' }} />
        </ColorlibStepIconRoot>
    );
}

const CandidateProgress = ({ stageResults = [] }) => {
    // Determine active step
    // Strategy: Find first 'Not Initiated' or 'Pending'. 
    // If all completed, active is last + 1 (or just last).
    // Based on user image: "Initial AI Call" (left) -> "Initial AI Call...(Not Initiated)" was current text.
    // Wait, if "Initial AI Call" is current, it means it's index 0.

    const activeStep = stageResults.findIndex(s => s.stageStatus === 'Not Initiated' || s.stageStatus === 'Pending');
    const safeActiveStep = activeStep === -1 ? stageResults.length : activeStep;

    // Access active stage info for text
    const activeStage = stageResults[safeActiveStep];
    const activeStageTitle = activeStage?.stage?.title || 'None';
    const activeStageStatus = activeStage?.stageStatus || 'Completed'; // If no 'Not Initiated' found, assume all done

    return (
        <Box
            sx={{
                width: '100%',
            }}
        >
            <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                mb={3}
            >
                <Typography
                    sx={{
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#111827',
                        letterSpacing: '-0.01em'
                    }}
                >
                    Candidate Progress
                </Typography>
            </Box>

            <Box sx={{ width: '100%', overflowX: 'auto', pb: 1 }}>
                <Stepper
                    alternativeLabel
                    activeStep={safeActiveStep}
                    connector={<ColorlibConnector />}
                    sx={{
                        minWidth: { xs: 520, sm: '100%' },
                        '--step-icon-size': { xs: '26px', sm: '26px', md: '32px' },
                        '--step-icon-font-size': { xs: '14px', sm: '14px', md: '16px' },
                    }}
                >
                    {stageResults.map((res, index) => (
                        <Step key={res._id || res.stage?.title}>
                            <StepLabel StepIconComponent={ColorlibStepIcon}>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        mt: 0.5,
                                        color: (theme) =>
                                            index === safeActiveStep ? '#F59E0B' : 'text.secondary', // Yellow for active label
                                        opacity: index > safeActiveStep ? 0.6 : 1
                                    }}
                                >
                                    {res.stage?.title || 'Unknown Stage'}
                                </Typography>
                            </StepLabel>
                        </Step>
                    ))}
                </Stepper>
            </Box>

            {/* Current Stage Indicator */}
            <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography
                    variant="body2"
                    sx={{
                        color: 'text.secondary',
                        // bgcolor: '#F9FAFB', // Removing bg to match cleaner look if needed, or keeping it.
                        // Image showed text: "Current stage: Initial AI Call..." (Not Initiated)" with yellow highlight on stage name.
                        display: 'inline-block',
                        fontSize: '13px'
                    }}
                >
                    Current stage: <span style={{ fontWeight: 700, color: '#F59E0B' }}>{activeStageTitle}</span> ({activeStageStatus})
                </Typography>
            </Box>
        </Box>
    );
};

export default CandidateProgress;
