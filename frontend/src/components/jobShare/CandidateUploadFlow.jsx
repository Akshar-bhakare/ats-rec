import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Box,
    Chip,
    Divider,
    LinearProgress,
    Paper,
    Radio,
    RadioGroup,
    FormControlLabel,
    Step,
    StepLabel,
    Stepper,
    TextField,
    Typography,
} from '@mui/material';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import { useSearchParams } from 'react-router-dom';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import {
    sanitizeShareParams,
    verifyShareRequest,
    storeCandidateSubmission,
    fetchShareContext,
} from '../../AppUtils/jobShareStorage';
import MUIFileInput from '../MUI/commonUI/MUIFileInput';
import Button from '../MUI/commonUI/MUIButton';
import { fetchData, performDeploySafeFetch } from '../../AppUtils/dataAPI';
import { trimFormStrings } from '../../AppUtils/formUtils';
import { useUiContextState } from '../../contexts/UiContext';
import MUIInput from '../MUI/commonUI/MUIInput';




const steps = ['Upload CV', 'Approve details', 'Screening'];
const ACCEPTED_FILE_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const CALL_WINDOW = { start: 8, end: 20 };

const PLATFORM_OPTIONS = [
    'LinkedIn',
    'WhatsApp',
    'Facebook',
    'Telegram',
    'Instagram',
    'Email',
    'Referral',
    'Other',
];


const nextCallSlot = (withinWindow) => {
    const now = new Date();
    const slot = new Date(now);
    if (withinWindow) {
        slot.setMinutes(slot.getMinutes() + 5);
    } else {
        if (now.getHours() >= CALL_WINDOW.end) {
            slot.setDate(slot.getDate() + 1);
        }
        slot.setHours(CALL_WINDOW.start, 30, 0, 0);
    }
    // return formatDateInput(slot);
    return dayjs(slot);
};




const CandidateUploadFlow = () => {
    const [searchParams] = useSearchParams();
    const rawParams = useMemo(() => Object.fromEntries(searchParams.entries()), [searchParams]);
    const sanitizedParams = useMemo(() => sanitizeShareParams(rawParams), [rawParams]);
    const verification = useMemo(() => verifyShareRequest(rawParams), [rawParams]);

    const verfLink = verification.status === 'ok' ? verification.link : null;
    const token = sanitizedParams.token || verfLink?.token;

    const [, setUiState] = useUiContextState();
    const [activeStep, setActiveStep] = useState(0);
    const [fileMeta, setFileMeta] = useState(null);
    const [parserState, setParserState] = useState({ status: 'idle', message: '' });
    // Job context fetched from backend (or from legacy token)
    const [jobContext, setJobContext] = useState(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [formValues, setFormValues] = useState({
        "firstName of Candidate 0": '',
        "lastName of Candidate 0": '',
        "email of Candidate 0": '',
        "countryCode of Candidate 0": '',
        "phoneNumber of Candidate 0": '',
        "skills of Candidate 0": '',
        "resumeUrl of Candidate 0": '',
        "resumeText of Candidate 0": '',
        "Approved Candidate 0": true,
    });
    const [screeningValues, setScreeningValues] = useState({
        source: verfLink?.defaultSource || sanitizedParams.defaultSource || '',
        referralDetails: '',
        callPreference: 'now',
        callSchedule: null,
        notes: '',
    });
    const [callWindowMessage, setCallWindowMessage] = useState('');
    const [autoScheduled, setAutoScheduled] = useState(false);
    const [savedCandidate, setSavedCandidate] = useState();
    const [submitState, setSubmitState] = useState({ status: 'idle', message: '' });


    const resumeOrCvParser = useCallback(async () => {
        return await performDeploySafeFetch(
            "Resume Parsing",
            async () => {
                const formEl = document.getElementById('id_file_form');
                const body = formEl ? new FormData(formEl) : undefined;
                return await fetchData("/api/candidates/job/social/upload/", {
                    method: 'POST',
                    body,
                });
            },
            setUiState,
            "Parsing, Please wait"
        )
            .catch((err) => {
                console.error('Error in fetching data...\n', err);
                setUiState({ loadingMsg: null, alert: { open: true, severity: 'error', message: 'Error in parsing resume...' } });
                console.error(
                    "Resume parsing error: ", (err?.message || JSON.stringify(err))
                );
                throw err; // Propagate error so handleFile knows it failed
            })
            .finally(() => setUiState({ loadingMsg: null }));

    }, [setUiState]);

    useEffect(() => {
        setScreeningValues((prev) => ({
            ...prev,
            source: jobContext?.defaultSource || verfLink?.defaultSource || sanitizedParams.defaultSource || prev.source,
        }));
    }, [jobContext?.defaultSource, verfLink?.defaultSource, sanitizedParams.defaultSource]);

    // Fetch full job context from backend (or use legacy token data)
    useEffect(() => {
        if (!verfLink) return;
        // Legacy tokens already carry all display fields
        if (verfLink._isLegacy) {
            setJobContext({
                jobId: verfLink.jobId,
                jobTitle: verfLink.jobTitle,
                companyName: verfLink.companyName,
                jobSnippet: verfLink.jobSnippet,
                jobSharer: verfLink.jobSharer,
                defaultSource: verfLink.defaultSource,
            });
            return;
        }
        // New slim token — fetch from backend
        if (verfLink.jobId && verfLink.sharerEmail) {
            setContextLoading(true);
            fetchShareContext(verfLink.jobId, verfLink.sharerEmail)
                .then((data) => {
                    setJobContext({
                        jobId: data.jobId,
                        jobTitle: data.jobTitle,
                        companyName: data.companyName,
                        jobSnippet: data.jobSnippet,
                        jobSharer: data.jobSharer,
                        defaultSource: verfLink.defaultSource,
                    });
                })
                .catch((err) => {
                    console.error('Failed to fetch share context', err);
                    setSubmitState({ status: 'error', message: 'Unable to load job details. Please request a new link.' });
                })
                .finally(() => setContextLoading(false));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verfLink?.jobId, verfLink?.sharerEmail, verfLink?._isLegacy]);

    const handleFile = useCallback(async (event) => {
        const file = Array.isArray(event) ? event?.[0] : event.target.files?.[0];
        if (!file) return;

        // Reset previous candidate details immediately on new file selection
        setFormValues((prev) => ({
            ...prev,
            "firstName of Candidate 0": '',
            "lastName of Candidate 0": '',
            "email of Candidate 0": '',
            "countryCode of Candidate 0": '',
            "phoneNumber of Candidate 0": '',
            "skills of Candidate 0": '',
            "resumeUrl of Candidate 0": '',
            "resumeText of Candidate 0": '',
        }));
        setSavedCandidate(null);

        setFileMeta({
            name: file.name,
            size: file.size,
            type: file.type,
        });

        setParserState({ status: 'loading', message: 'Parsing CV and extracting essentials…' });

        try {
            const parsed = await resumeOrCvParser();
            setFormValues((prev) => ({ ...prev, ...parsed }));
            setParserState({ status: 'success', message: 'CV parsed. Please approve or correct the details.' });
            setActiveStep(1);
        } catch (err) {
            console.error('CV parsing failed', err);
            setParserState({ status: 'error', message: 'Parsing failed. Please fill details manually.' });
        }
    }, [resumeOrCvParser]);

    const isWithinCallWindow = () => {
        // const now = new Date();
        // return now.getHours() >= CALL_WINDOW.start && now.getHours() <= CALL_WINDOW.end;
        return true;
    };

    useEffect(() => {
        const withinWindow = isWithinCallWindow();
        if (screeningValues.callPreference === 'now') {
            if (!withinWindow) {
                const fallback = nextCallSlot(false);
                setScreeningValues((prev) => ({
                    ...prev,
                    callPreference: 'schedule',
                    callSchedule: fallback,
                }));
                setCallWindowMessage(`Our calling window is 8 AM - 8 PM. We scheduled the earliest available slot (${new Date(fallback).toLocaleString('en-US', {
                    weekday: 'short',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                })}).`);
                setAutoScheduled(true);
            } else {
                setAutoScheduled(false);
                setCallWindowMessage('');
            }
        } else if (!autoScheduled) {
            setCallWindowMessage('');
        }
    }, [screeningValues.callPreference, autoScheduled]);

    useEffect(() => {
        if (screeningValues.callPreference === 'schedule' && !screeningValues.callSchedule) {
            const fallback = nextCallSlot(isWithinCallWindow());
            setScreeningValues((prev) => ({
                ...prev,
                callSchedule: fallback,
            }));
        }
    }, [screeningValues.callPreference, screeningValues.callSchedule]);

    const handleFormChange = (field, value) => {
        const nextValue = field.includes('phoneNumber')
            ? String(value || '').replace(/\D/g, '')
            : value;
        setFormValues((prev) => ({ ...prev, [field]: nextValue }));
    };

    const handleScreeningChange = (field, value) => {
        setScreeningValues((prev) => ({ ...prev, [field]: value }));
        if (field === 'callPreference' && value === 'schedule') {
            setAutoScheduled(false);
            setCallWindowMessage('');
        }
    };

    const saveCandidateParsedDetails = async () => {

        setUiState({ loadingMsg: 'Saving, Please wait...' });

        const trimmedFormValues = trimFormStrings(formValues);
        setFormValues(trimmedFormValues);
        const body = JSON.stringify({
            ...(jobContext || {}),
            ...trimmedFormValues,
        });

        return await performDeploySafeFetch(
            "Saving Details",
            async () => await fetchData("/api/candidates/job/social/multiple/", {
                method: 'POST',
                body,
            }),
            setUiState,
            "Saving, Please wait"
        )
            .catch((err) => {
                console.error('Error in saving data...\n', err);
                setUiState({ loadingMsg: null, alert: { open: true, severity: 'error', message: 'Error in saving details...' } });
                console.error(
                    "Resume parsed details save error: ", (err?.message || JSON.stringify(err))
                );
                throw err;
            })
            .finally(() => setUiState({ loadingMsg: null }));

    }


    const maxDtLmt = dayjs().add(50, "hour").toDate();

    const handleSubmit = async (ev = null) => {
        ev?.preventDefault();
        if (!token || !jobContext) {
            setSubmitState({ status: 'error', message: 'Missing share context. Please request a new link.' });
            return;
        }

        if (screeningValues.callPreference === "schedule") {
            let dtObj = new dayjs(screeningValues.callSchedule).toDate().getTime();

            if (dtObj <= new Date().getTime() && dtObj >= maxDtLmt.getTime()) {
                setUiState({ loadingMsg: null, alert: { open: true, message: 'Invalid date-time combination, for scheduling AI Call(s)...', severity: 'error' } });
                return;
            }

        }

        const trimmedScreening = trimFormStrings(screeningValues);
        setScreeningValues(trimmedScreening);
        const payload = {
            jobId: jobContext.jobId,
            jobTitle: jobContext.jobTitle,
            companyName: jobContext.companyName,
            sharedBy: jobContext.jobSharer,
            defaultSource: jobContext.defaultSource,
            selectedSource: trimmedScreening.source,
            fileMeta,
            candidate: { ...savedCandidate },
            screening: trimmedScreening,
        };
        try {
            const screeningCallRes = await performDeploySafeFetch(
                "Submitting Application",
                async () => await fetchData("/api/candidates/job/social/screening/call/", {
                    method: "POST",
                    body: JSON.stringify(payload),
                }),
                setUiState,
                "Saving, Please wait"
            );

            if (!screeningCallRes?.ok) {
                throw screeningCallRes;
            }

            storeCandidateSubmission({ token, payload: { ...payload, screeningCallRes } });
            setSubmitState({ status: 'success', message: 'Thanks! We have your CV and our system will reach out shortly.' });
            setActiveStep(steps.length);
        } catch (err) {
            setSubmitState({ status: 'error', message: (err?.message || err?.statusText || 'Unable to save your submission.') });

        } finally {
            setUiState({ loadingMsg: null });

        }
    };

    if (verification.status !== 'ok') {
        return (
            <MUICenterLayout>
                <Paper sx={{ p: 4, maxWidth: 540 }}>
                    <Typography variant="h5" gutterBottom>Link unavailable</Typography>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        We could not verify this share link ({verification.reason}). Ask the admin for a fresh link.
                    </Alert>
                    {Object.entries(sanitizedParams).length > 0 && (
                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                            {Object.entries(sanitizedParams).map(([key, val]) => (
                                <Chip key={key} label={`${key}: ${val}`} size="small" />
                            ))}
                        </Box>
                    )}
                </Paper>
            </MUICenterLayout>
        );
    }

    const renderStepContent = () => {
        switch (activeStep) {
            case 0:
                return (
                    <Box component="form" id='id_file_form' sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <MUIFileInput
                            name='resumes'
                            label='Drag & drop resume'
                            type='file'
                            onChange={handleFile}
                            maxFiles={1}
                            acceptedTypes={ACCEPTED_FILE_TYPES}
                            required={true}
                            align='center'
                            sx={{ m: 3 }}
                        />

                        {activeStep === 0 && parserState.status === 'loading' && <LinearProgress />}
                        {activeStep === 0 && fileMeta && (
                            <Alert severity="info" sx={{ my: 3 }}>
                                Selected file: {fileMeta.name} ({Math.round(fileMeta.size / 1024)} KB)
                            </Alert>
                        )}
                    </Box>
                );
            case 1:
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Typography variant="subtitle2" color="text.secondary">
                            Approve or correct the extracted details.
                        </Typography>
                        {savedCandidate?.validated === "errored" && Object.entries(savedCandidate)?.map?.(([candKey, candVal]) => candKey?.includes("error") &&
                            <Typography variant="subtitle2" color="error" sx={{ py: 2 }}>
                                {candVal}
                            </Typography>)}
                        <Box sx={{ display: "flex", justifyContent: "space-around", gap: 3 }}>
                            <TextField size='small' label="First name" value={formValues["firstName of Candidate 0"]} onChange={(e) => handleFormChange('firstName of Candidate 0', e.target.value)} fullWidth required />
                            <TextField size='small' label="Last name" value={formValues["lastName of Candidate 0"]} onChange={(e) => handleFormChange('lastName of Candidate 0', e.target.value)} fullWidth required />
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-around", gap: 3 }}>
                            <TextField size='small' label="Country Code" type='tel' value={formValues["countryCode of Candidate 0"]} onChange={(e) => handleFormChange('countryCode of Candidate 0', e.target.value)} fullWidth required />
                            <TextField size='small' label="Phone" type='tel' value={formValues["phoneNumber of Candidate 0"]} onChange={(e) => handleFormChange('phoneNumber of Candidate 0', e.target.value)} fullWidth required />
                        </Box>
                        <Box sx={{ display: "flex", justifyContent: "space-around", gap: 3 }}>
                            <TextField size='small' label="Email" type='email' value={formValues["email of Candidate 0"]} onChange={(e) => handleFormChange('email of Candidate 0', e.target.value)} fullWidth required />
                            <TextField size='small' label="Skills" value={formValues["skills of Candidate 0"]} onChange={(e) => handleFormChange('skills of Candidate 0', e.target.value)} fullWidth required />
                        </Box>
                        <TextField label="Resume Url" type='hidden' sx={{ display: "none" }} value={formValues["resumeUrl of Candidate 0"]} onChange={(e) => handleFormChange('resumeUrl of Candidate 0', e.target.value)} />
                        <TextField label="Resume Text" type='hidden' sx={{ display: "none" }} value={formValues["resumeText of Candidate 0"]} onChange={(e) => handleFormChange('resumeText of Candidate 0', e.target.value)} />
                    </Box>
                );
            case 2:
                return (
                    <Box component="form" id='id_final_form' onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 3 }}>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ my: 2 }}>
                            Screening
                        </Typography>
                        <MUIInput
                            AutocompleteProps={{
                                options: PLATFORM_OPTIONS,
                                value: screeningValues.source,
                                onChange: (e, newVal) => handleScreeningChange('source', newVal),
                            }}
                            AutocompleteInputProps={{
                                label: "Where did you find this link?",
                                required: true,
                            }}
                        />
                        {["Referral", 'Other'].includes(screeningValues.source) && <TextField
                            size='small'
                            label={screeningValues.source === "Referral" ? "Employee Id" : "Any additional context"}
                            value={screeningValues.referralDetails}
                            onChange={(e) => handleScreeningChange('referralDetails', e.target.value)}
                            required={true}
                        />}
                        <Typography variant="subtitle2" sx={{ mt: 4 }}>Call preference</Typography>
                        {isWithinCallWindow() && <RadioGroup
                            row
                            value={screeningValues.callPreference}
                            onChange={(e) => handleScreeningChange('callPreference', e.target.value)}
                        >
                            <FormControlLabel value="now" control={<Radio />} label="Call me now" />
                            <FormControlLabel value="schedule" control={<Radio />} label="Schedule for later" />
                        </RadioGroup>}
                        <Typography variant="body2" color="text.secondary">
                            Our system will connect you between 8 AM - 8 PM or at the slot you pick.
                        </Typography>

                        {screeningValues.callPreference === 'schedule' && (
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <DateTimePicker
                                    label="Schedule Date & Time *"
                                    value={screeningValues.callSchedule}
                                    format="DD-MM-YYYY hh:mm A"
                                    onChange={val => handleScreeningChange('callSchedule', val)}
                                    sx={{ width: '100%', pb: 0, mb: 0 }}
                                />
                            </LocalizationProvider>

                        )}
                        {callWindowMessage && (
                            <Alert severity="warning">{callWindowMessage}</Alert>
                        )}
                        <TextField
                            size='small'
                            label="Anything else we should know?"
                            value={screeningValues.notes}
                            onChange={(e) => handleScreeningChange('notes', e.target.value)}
                            multiline
                            minRows={3}
                        />
                        <Button
                            type="submit"
                            id="id_final_form_submit_btn"
                            sx={{
                                display: "none",
                            }}
                        />
                    </Box>
                );
            default:
                return null;
        }
    };

    if (activeStep === steps.length) {
        return (
            <MUICenterLayout>
                <Paper sx={{ p: 4, maxWidth: 520, textAlign: 'center' }}>
                    <TaskAltIcon color="success" sx={{ fontSize: 48, mb: 2 }} />
                    <Typography variant="h5" gutterBottom>Submission received</Typography>
                    <Typography color="text.secondary" sx={{ mb: 2 }}>
                        {submitState.message}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {screeningValues.callPreference === 'schedule' && screeningValues.callSchedule
                            ? `We scheduled a call for ${new Date(screeningValues.callSchedule).toLocaleString()}.`
                            : 'The recruiter will give you a quick call within the working window.'}
                    </Typography>
                </Paper>
            </MUICenterLayout>
        );
    }

    return (
        <Box sx={{ m: { xs: 0, sm: 2, md: 3 }, mb: { xs: 2, sm: 4, md: 5 } }}>
            <MUICenterLayout>
                <Paper sx={{ maxHeight: '90vh', maxWidth: 720, overflow: "auto", p: { xs: 3, md: 5 } }}>
                    <Typography variant="h5" gutterBottom>{contextLoading ? 'Loading…' : jobContext?.jobTitle}</Typography>
                    <Typography variant="subtitle1" color="text.secondary">{contextLoading ? '' : jobContext?.jobSnippet}</Typography>
                    <Divider sx={{ my: 3, pt: 5 }} />
                    <Typography variant="overline" color="text.secondary">Steps</Typography>
                    <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {[0, 1].includes(activeStep) && parserState.status !== 'idle' && parserState.message && (
                        <Alert severity={parserState.status === 'error' ? 'error' : 'success'} sx={{ my: 3 }}>
                            {parserState.message}
                        </Alert>
                    )}

                    {renderStepContent()}

                    {submitState.status === 'error' && (
                        <Alert severity="error" sx={{ mt: 2 }}>{submitState.message}</Alert>
                    )}

                    <Divider sx={{ my: 3, pt: 5 }} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                        <Button
                            disabled={activeStep === 0}
                            onClick={() => setActiveStep((s) => Math.max(s - 1, 0))}
                        >
                            Back
                        </Button>
                        {activeStep < steps.length - 1 ? (
                            <Button
                                onClick={() => {
                                    if (activeStep === 1) {
                                        saveCandidateParsedDetails().then(candDet => {
                                            setSavedCandidate(candDet)
                                            if ("_id" in (candDet || {})) {
                                                setActiveStep((s) => Math.min(s + 1, steps.length - 1));
                                            }
                                        });
                                    } else {
                                        setActiveStep((s) => Math.min(s + 1, steps.length - 1));
                                    }
                                }}
                                disabled={(activeStep === 0 && !fileMeta)}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                disabled={!("_id" in (savedCandidate || {}))}
                                onClick={() => {
                                    document?.getElementById("id_final_form_submit_btn")?.click();
                                }}
                            >
                                Submit application
                            </Button>
                        )}
                    </Box>
                </Paper>
            </MUICenterLayout>
        </Box>
    );
};

export default CandidateUploadFlow;
