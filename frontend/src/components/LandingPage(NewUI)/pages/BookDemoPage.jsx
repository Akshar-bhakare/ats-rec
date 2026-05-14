import { useMemo, useState } from 'react';
import { Alert, Box, Button, Container, Stack, Typography, alpha, useTheme } from '@mui/material';
import { Zap, CheckCircle2, ArrowLeft } from 'lucide-react';
import dayjs from 'dayjs';
import DemoLeadCaptureForm from '../sections/DemoLeadCaptureForm';
import { getClientTimeZone } from '../../../AppUtils/dataAPI';
import { clearPublicDemoLeadSession, getPublicDemoLeadSession } from '../bookDemo/publicDemoLeadSession';
import { mapScheduleError } from '../bookDemo/bookDemoErrorUtils';
import { scheduleBookDemoMeeting } from '../bookDemo/bookDemoApi';
import BookDemoScheduleStep from '../bookDemo/BookDemoScheduleStep';
import BookDemoSuccessStep from '../bookDemo/BookDemoSuccessStep';

const BOOK_DEMO_HEADLINE_FONT = '"Inter", "Segoe UI", sans-serif';
const MEETING_DURATION_MINUTES = 30;

const createIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    return `book-demo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const createDefaultScheduleDraft = () => {
    const now = dayjs().add(30, 'minute').second(0).millisecond(0);
    const remainder = now.minute() % 30;
    const rounded = remainder === 0 ? now : now.add(30 - remainder, 'minute');

    return {
        startAt: rounded,
        timezone: getClientTimeZone(),
        durationMinutes: MEETING_DURATION_MINUTES,
    };
};

const getInitialVerifiedLead = () => getPublicDemoLeadSession();
const getInitialStep = () => (getPublicDemoLeadSession()?.candidateEmail ? 'schedule' : 'lead');

const BookDemoPage = () => {
    const theme = useTheme();
    const [step, setStep] = useState(getInitialStep);
    const [verifiedLead, setVerifiedLead] = useState(getInitialVerifiedLead);
    const [scheduleDraft, setScheduleDraft] = useState(createDefaultScheduleDraft);
    const [idempotencyKey, setIdempotencyKey] = useState(createIdempotencyKey);
    const [submissionState, setSubmissionState] = useState({
        scheduling: false,
        error: '',
    });
    const [result, setResult] = useState(null);

    const meetingPreview = useMemo(() => {
        if (!verifiedLead?.candidateName) {
            return null;
        }

        return {
            candidateName: verifiedLead.candidateName,
            candidateEmail: verifiedLead.candidateEmail,
        };
    }, [verifiedLead]);

    const resetLead = () => {
        clearPublicDemoLeadSession();
        setVerifiedLead(null);
        setResult(null);
        setSubmissionState({ scheduling: false, error: '' });
        setScheduleDraft(createDefaultScheduleDraft());
        setIdempotencyKey(createIdempotencyKey());
        setStep('lead');
    };

    const handleVerified = (session) => {
        const nextLead = session?.verifiedLead || getPublicDemoLeadSession();
        if (!nextLead?.candidateEmail) {
            return;
        }

        setVerifiedLead(nextLead);
        setResult(null);
        setSubmissionState({ scheduling: false, error: '' });
        setScheduleDraft(createDefaultScheduleDraft());
        setIdempotencyKey(createIdempotencyKey());
        setStep('schedule');
    };

    const handleScheduleSubmit = async () => {
        const startAt = dayjs(scheduleDraft?.startAt);
        if (!startAt.isValid() || startAt.isBefore(dayjs())) {
            setSubmissionState({
                scheduling: false,
                error: 'Please choose a future time slot.',
            });
            return;
        }

        if (!meetingPreview?.candidateEmail || !meetingPreview?.candidateName) {
            setSubmissionState({
                scheduling: false,
                error: 'Your verification session is missing. Please verify your email again.',
            });
            setStep('lead');
            return;
        }

        setSubmissionState({ scheduling: true, error: '' });

        try {
            const endAt = startAt.add(MEETING_DURATION_MINUTES, 'minute');
            const response = await scheduleBookDemoMeeting({
                candidateName: meetingPreview.candidateName,
                candidateEmail: meetingPreview.candidateEmail,
                startTime: startAt.toISOString(),
                endTime: endAt.toISOString(),
                timezone: scheduleDraft.timezone,
                idempotencyKey,
            });

            setResult(response);
            setSubmissionState({ scheduling: false, error: '' });
            setIdempotencyKey(createIdempotencyKey());
            setStep('success');
        } catch (error) {
            const mappedMessage = mapScheduleError(error);

            if (String(error?.error || '').trim().toUpperCase() === 'OTP_NOT_VERIFIED') {
                clearPublicDemoLeadSession();
                setVerifiedLead(null);
                setStep('lead');
            }

            setSubmissionState({
                scheduling: false,
                error: mappedMessage,
            });
        }
    };

    const handleBookAnother = () => {
        setResult(null);
        setSubmissionState({ scheduling: false, error: '' });
        setScheduleDraft(createDefaultScheduleDraft());
        setIdempotencyKey(createIdempotencyKey());
        setStep('schedule');
    };

    return (
        <Box
            component="section"
            sx={{
                py: { xs: 7, md: 10 },
                minHeight: 'calc(100vh - 160px)',
                background: `
                    radial-gradient(circle at 0% 0%, rgba(251, 146, 60, 0.2), transparent 26%),
                    radial-gradient(circle at 100% 100%, rgba(251, 146, 60, 0.16), transparent 28%),
                    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0) 42%),
                    linear-gradient(180deg, #fffdf9 0%, #fff8ef 100%)
                `
            }}
        >
            <Container sx={{ maxWidth: '1480px !important' }}>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', lg: '0.9fr 1.2fr' },
                        gap: { xs: 4, md: 6, lg: 8 },
                        alignItems: 'center'
                    }}
                >
                    <Stack spacing={{ xs: 2.2, md: 2.8 }} sx={{ maxWidth: 620 }}>
                        <Box
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 1,
                                width: 'fit-content',
                                px: 1.8,
                                py: 0.9,
                                borderRadius: 999,
                                bgcolor: alpha(theme.palette.primary.main, 0.1),
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`
                            }}
                        >
                            <Zap size={14} color={theme.palette.primary.main} />
                            <Typography
                                sx={{
                                    fontSize: { xs: '0.86rem', md: '0.92rem' },
                                    fontWeight: 800,
                                    letterSpacing: '0.08em',
                                    textTransform: 'uppercase',
                                    color: 'primary.main'
                                }}
                            >
                                AI-Driven Recruitment
                            </Typography>
                        </Box>

                        <Typography
                            sx={{
                                fontFamily: BOOK_DEMO_HEADLINE_FONT,
                                fontSize: { xs: '2.8rem', sm: '3.5rem', md: '4.2rem' },
                                lineHeight: { xs: 1.04, md: 0.98 },
                                letterSpacing: '-0.06em',
                                fontWeight: 900,
                                color: '#17203a'
                            }}
                        >
                            Scale your team with
                            <br />
                            <Box component="span" sx={{ color: 'primary.main' }}>
                                precision.
                            </Box>
                        </Typography>

                        <Typography
                            sx={{
                                maxWidth: 500,
                                fontSize: { xs: '1.06rem', md: '1.22rem' },
                                lineHeight: 1.7,
                                color: '#51627d',
                                fontWeight: 500
                            }}
                        >
                            Join 500+ forward-thinking companies using HIREX to automate their hiring funnel and find top talent 3x faster.
                        </Typography>

                        <Stack spacing={1.6} sx={{ pt: { xs: 1, md: 1.6 } }}>
                            {[
                                'Personalized 30-min walkthrough',
                                'Pricing tailor-made for your needs',
                                'Direct access to hiring experts'
                            ].map((item) => (
                                <Stack key={item} direction="row" spacing={1.5} alignItems="center">
                                    <Box
                                        sx={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: '50%',
                                            display: 'grid',
                                            placeItems: 'center',
                                            border: `2px solid ${theme.palette.primary.main}`,
                                            color: 'primary.main',
                                            flexShrink: 0
                                        }}
                                    >
                                        <CheckCircle2 size={15} />
                                    </Box>
                                    <Typography
                                        sx={{
                                            fontSize: { xs: '1rem', md: '1.1rem' },
                                            lineHeight: 1.55,
                                            color: '#24344f',
                                            fontWeight: 500
                                        }}
                                    >
                                        {item}
                                    </Typography>
                                </Stack>
                            ))}
                        </Stack>
                    </Stack>

                    <Box
                        sx={{
                            borderRadius: { xs: '30px', md: '34px' },
                            bgcolor: alpha('#ffffff', 0.94),
                            border: `1px solid ${alpha('#d9e2ec', 0.95)}`,
                            boxShadow: '0 36px 90px -48px rgba(15, 23, 42, 0.28)',
                            backdropFilter: 'blur(14px)',
                            px: { xs: 2.2, sm: 3, md: 4 },
                            py: { xs: 2.4, md: 3.2 }
                        }}
                    >
                        {step === 'lead' ? (
                            <DemoLeadCaptureForm
                                flow="book-demo"
                                open
                                onVerified={handleVerified}
                                showDemoRole={false}
                            />
                        ) : null}

                        {step === 'schedule' ? (
                            <Stack spacing={2.2}>
                                <Stack direction="row" justifyContent="space-between" alignItems="center">
                                    <Button
                                        variant="text"
                                        startIcon={<ArrowLeft size={16} />}
                                        onClick={resetLead}
                                        sx={{ fontWeight: 700, textTransform: 'none' }}
                                    >
                                        Back to registration
                                    </Button>
                                </Stack>

                                <BookDemoScheduleStep
                                    verifiedLead={verifiedLead}
                                    scheduleDraft={scheduleDraft}
                                    onScheduleChange={(value) => {
                                        setScheduleDraft((current) => ({
                                            ...current,
                                            startAt: value,
                                        }));
                                    }}
                                    onSubmit={handleScheduleSubmit}
                                    onResetLead={resetLead}
                                    loading={submissionState.scheduling}
                                    errorMessage={submissionState.error}
                                />
                            </Stack>
                        ) : null}

                        {step === 'success' ? (
                            <Stack spacing={2}>
                                {result?.status && result.status !== 'scheduled' ? (
                                    <Alert severity="info">
                                        Current status: {result.status}
                                    </Alert>
                                ) : null}
                                <BookDemoSuccessStep
                                    result={result}
                                    timezone={scheduleDraft.timezone}
                                    onBookAnother={handleBookAnother}
                                    onResetLead={resetLead}
                                />
                            </Stack>
                        ) : null}
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default BookDemoPage;
