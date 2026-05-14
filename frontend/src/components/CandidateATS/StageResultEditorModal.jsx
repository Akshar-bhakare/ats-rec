import { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Chip,
    IconButton,
    LinearProgress,
    MenuItem,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import { fetchData } from '../../AppUtils/dataAPI';

const STATUS_CHOICES = [
    'Not Initiated',
    'Selected',
    'Rejected',
    'On Hold',
    'Completed',
    'Not Applicable',
];
const NEXT_STAGE_BUTTON_STATUSES = new Set(['Completed', 'Not Applicable']);

const normalizeInterviewerType = (value) => {
    const type = String(value || '').trim();
    if (type === 'Human' || type === 'Human+AI') return type;
    if (type === 'AI') return 'AI';
    return 'Unknown';
};

const getScheduleTimestamp = (schedule) => {
    const value = schedule?.startAt || schedule?.createdAt || 0;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
};

const buildAiFeedbackText = (schedule) => {
    const evaluation = schedule?.evaluation && typeof schedule.evaluation === 'object'
        ? schedule.evaluation
        : null;
    const parameters = evaluation?.parameters && typeof evaluation.parameters === 'object'
        ? evaluation.parameters
        : null;
    const parameterLines = parameters
        ? Object.entries(parameters)
            .map(([label, row]) => {
                const reason = typeof row?.reason === 'string' ? row.reason.trim() : '';
                if (!reason) return '';
                return `${label}: ${reason}`;
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];

    const rawScoreCandidates = [
        schedule?.evaluationScore,
        evaluation?.totalScore,
        evaluation?.score,
    ];
    const score = rawScoreCandidates.find((value) => Number.isFinite(Number(value)));
    const overallReason = [
        schedule?.overallReason,
        evaluation?.overallReason,
        schedule?.evaluationBreakdown?.overallReason,
    ]
        .find((value) => typeof value === 'string' && value.trim())
        ?.trim() || '';

    const sections = [];
    if (Number.isFinite(Number(score))) {
        sections.push(`AI Interview Score: ${Math.round(Number(score))}/100`);
    }
    if (overallReason) {
        sections.push(overallReason);
    }
    if (parameterLines.length) {
        sections.push(`Key observations:\n${parameterLines.join('\n')}`);
    }

    return sections.join('\n\n').trim();
};

const buildHumanFeedbackText = (schedule) => {
    const feedback = schedule?.interviewerFeedback && typeof schedule.interviewerFeedback === 'object'
        ? schedule.interviewerFeedback
        : null;
    if (!feedback) return '';

    const sections = [];
    if (typeof feedback?.recommendation === 'string' && feedback.recommendation.trim()) {
        sections.push(`Recommendation: ${feedback.recommendation.trim()}`);
    }
    if (typeof feedback?.strengths === 'string' && feedback.strengths.trim()) {
        sections.push(`Strengths: ${feedback.strengths.trim()}`);
    }
    if (typeof feedback?.improvements === 'string' && feedback.improvements.trim()) {
        sections.push(`Areas for Improvement: ${feedback.improvements.trim()}`);
    }
    if (typeof feedback?.overallComment === 'string' && feedback.overallComment.trim()) {
        sections.push(`Overall Comment: ${feedback.overallComment.trim()}`);
    }

    const parameterRatings = Array.isArray(feedback?.parameterRatings)
        ? feedback.parameterRatings
            .map((row) => {
                const skill = typeof row?.skill === 'string' ? row.skill.trim() : '';
                const comment = typeof row?.comment === 'string' ? row.comment.trim() : '';
                if (!skill && !comment) return '';
                if (skill && comment) return `${skill}: ${comment}`;
                return skill || comment;
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];

    if (parameterRatings.length) {
        sections.push(`Parameter feedback:\n${parameterRatings.join('\n')}`);
    }

    return sections.join('\n\n').trim();
};

export default function StageResultEditorModal({
    open,
    onClose,
    atsId = '',
    stageResultId = '',
    candidateName = 'Candidate',
    stageTitle = 'Stage',
    currentStatus = 'Not Initiated',
    currentFeedback = '',
    secondaryActionLabel = '',
    onSecondaryAction,
    secondaryActionDisabled = false,
    onSaved,
}) {
    const [nextStatus, setNextStatus] = useState(currentStatus || 'Not Initiated');
    const [feedbackText, setFeedbackText] = useState(currentFeedback || '');
    const [loadingContext, setLoadingContext] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [interviewerContext, setInterviewerContext] = useState({
        interviewerType: 'Unknown',
        hasSchedule: false,
        autoFeedbackAvailable: false,
    });

    useEffect(() => {
        if (!open) return;

        let cancelled = false;
        setNextStatus(currentStatus || 'Not Initiated');
        setFeedbackText(currentFeedback || '');
        setErrorText('');
        setInterviewerContext({
            interviewerType: 'Unknown',
            hasSchedule: false,
            autoFeedbackAvailable: false,
        });

        const hydrateContext = async () => {
            if (!atsId) return;

            setLoadingContext(true);
            try {
                const res = await fetchData(`/api/interviewschedules/view?candidateATS=${atsId}`);
                if (cancelled) return;

                const schedules = Array.isArray(res?.schedules) ? res.schedules : [];
                const latestSchedule = [...schedules]
                    .sort((a, b) => getScheduleTimestamp(b) - getScheduleTimestamp(a))[0] || null;

                const interviewerType = normalizeInterviewerType(latestSchedule?.interviewerType);
                const aiFeedback = buildAiFeedbackText(latestSchedule);
                const humanFeedback = buildHumanFeedbackText(latestSchedule);
                const isAiInterviewer = interviewerType === 'AI';
                const derivedFeedback =
                    String(currentFeedback || '').trim() ||
                    (isAiInterviewer ? aiFeedback : humanFeedback);

                setInterviewerContext({
                    interviewerType,
                    hasSchedule: Boolean(latestSchedule),
                    autoFeedbackAvailable: Boolean(aiFeedback),
                });
                setFeedbackText(derivedFeedback);
            } catch (err) {
                if (cancelled) return;
                console.error('[StageResultEditorModal] Failed to load interview context:', err);
                setInterviewerContext({
                    interviewerType: 'Unknown',
                    hasSchedule: false,
                    autoFeedbackAvailable: false,
                });
            } finally {
                if (!cancelled) {
                    setLoadingContext(false);
                }
            }
        };

        void hydrateContext();

        return () => {
            cancelled = true;
        };
    }, [atsId, currentFeedback, currentStatus, open]);

    const isAiInterviewer = interviewerContext.interviewerType === 'AI';
    const feedbackEditable = !isAiInterviewer || !interviewerContext.autoFeedbackAvailable;
    const feedbackHelperText = useMemo(() => {
        if (loadingContext) return 'Loading interview context...';
        if (isAiInterviewer && interviewerContext.autoFeedbackAvailable) {
            return 'Feedback was auto-filled from the latest AI interview evaluation.';
        }
        if (isAiInterviewer) {
            return 'AI interview feedback was not found, so you can enter it manually if needed.';
        }
        if (interviewerContext.interviewerType === 'Human' || interviewerContext.interviewerType === 'Human+AI') {
            return 'Manual feedback is required for Human and Human+AI interview rounds.';
        }
        return 'No linked interview schedule was found for this ATS yet.';
    }, [interviewerContext, isAiInterviewer, loadingContext]);

    const handleSave = async () => {
        const trimmedFeedback = String(feedbackText || '').trim();
        const normalizedStatus = String(nextStatus || '').trim() || 'Not Initiated';

        if (!atsId || !stageResultId) {
            setErrorText('Stage result details are missing.');
            return;
        }

        if (!isAiInterviewer && !trimmedFeedback) {
            setErrorText('Feedback is required for Human and Human+AI interviewer types.');
            return;
        }

        setSaving(true);
        setErrorText('');
        try {
            await fetchData(`/api/candidates/ats/${atsId}/stageresult/${stageResultId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    stageStatus: normalizedStatus,
                    remarkOrFeedback: trimmedFeedback,
                }),
            });

            if (typeof onSaved === 'function') {
                await onSaved({
                    stageStatus: normalizedStatus,
                    remarkOrFeedback: trimmedFeedback,
                    interviewerType: interviewerContext.interviewerType,
                });
            }
        } catch (err) {
            console.error('[StageResultEditorModal] Failed to save stage result:', err);
            setErrorText(err?.message || 'Unable to update stage result.');
        } finally {
            setSaving(false);
        }
    };

    const primaryActionLabel = NEXT_STAGE_BUTTON_STATUSES.has(String(nextStatus || '').trim())
        ? 'Next stage'
        : 'Save';
    const isNextStageAction = primaryActionLabel === 'Next stage';

    return (
        <MUIModal
            open={open}
            onClose={saving ? undefined : onClose}
            contentSx={{
                width: { xs: '94vw', sm: '620px' },
                maxWidth: '620px',
                borderRadius: 3,
                p: { xs: 2.2, sm: 3 },
                border: 'none',
            }}
        >
            <Box sx={{ position: 'relative' }}>
                <IconButton
                    aria-label="Close"
                    size="small"
                    onClick={onClose}
                    disabled={saving}
                    sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        color: 'text.secondary',
                    }}
                >
                    <CloseRoundedIcon fontSize="small" />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                    Stage Status
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.8 }}>
                    {candidateName}: {stageTitle}
                </Typography>

                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                        size="small"
                        label={`Interviewer: ${interviewerContext.interviewerType}`}
                        color={isAiInterviewer ? 'primary' : 'default'}
                        variant={isAiInterviewer ? 'filled' : 'outlined'}
                    />
                    <Chip
                        size="small"
                        label={isAiInterviewer && interviewerContext.autoFeedbackAvailable ? 'Feedback: Auto' : 'Feedback: Manual'}
                        variant="outlined"
                    />
                </Box>

                {loadingContext && (
                    <LinearProgress sx={{ borderRadius: 999, mb: 1.8 }} />
                )}

                <Box sx={{ display: 'grid', gap: 1.4 }}>
                    <TextField
                        select
                        size="small"
                        label="Stage Status"
                        value={nextStatus}
                        onChange={(event) => setNextStatus(event.target.value)}
                    >
                        {STATUS_CHOICES.map((status) => (
                            <MenuItem key={status} value={status}>
                                {status}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        size="small"
                        multiline
                        minRows={4}
                        label="Remark Or Feedback"
                        placeholder="Add stage feedback"
                        value={feedbackText}
                        onChange={(event) => setFeedbackText(event.target.value)}
                        InputProps={{ readOnly: !feedbackEditable }}
                        helperText={feedbackHelperText}
                    />
                </Box>

                {errorText ? (
                    <Typography variant="body2" sx={{ color: 'error.main', mt: 1.6 }}>
                        {errorText}
                    </Typography>
                ) : null}

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 1.2,
                        mt: 3,
                        flexWrap: 'wrap',
                    }}
                >
                    <Box>
                        {secondaryActionLabel && typeof onSecondaryAction === 'function' ? (
                            <MUIButton
                                onClick={onSecondaryAction}
                                variant="outlined"
                                disabled={saving || secondaryActionDisabled}
                                startIcon={<ArrowBackRoundedIcon fontSize="small" />}
                                sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                            >
                                {secondaryActionLabel}
                            </MUIButton>
                        ) : null}
                    </Box>
                    <Box sx={{ marginLeft: 'auto' }}>
                        <MUIButton
                            onClick={handleSave}
                            variant="contained"
                            disabled={saving}
                            endIcon={isNextStageAction ? <ArrowForwardRoundedIcon fontSize="small" /> : null}
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            {saving ? 'Saving...' : primaryActionLabel}
                        </MUIButton>
                    </Box>
                </Box>
            </Box>
        </MUIModal>
    );
}
