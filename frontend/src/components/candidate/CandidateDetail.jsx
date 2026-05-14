import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link as NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Box,
    CircularProgress,
    Divider,
    IconButton,
    Avatar,
    Grid,
    Chip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Checkbox,
    FormControlLabel,
    Autocomplete,
    TextField,
    Tooltip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import EmailOutlinedIcon from '@mui/icons-material/EmailOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import DescriptionIcon from '@mui/icons-material/Description';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TrackChangesIcon from '@mui/icons-material/TrackChanges'; // ★ UPDATED

import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIAlert from '../MUI/commonUI/MUIAlert'; // ✅ ADDED
import { fetchData } from '../../AppUtils/dataAPI';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useCandidateContextState } from '../../contexts/CandidateContext';
import { useUiContextState } from '../../contexts/UiContext';
import { ScheduleSendOutlined } from '@mui/icons-material';
import { Stepper, Step, StepLabel, } from '@mui/material';
import defaultAvatar from '../../assets/default_avatar.jpg';
import { setDocumentTitle } from '../../AppUtils/documentTitle';



// const formatDateTime = ts => (ts ? new Date(ts).toLocaleString() : '—');

const formatDate = ts => (
    ts
        ? new Date(ts).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
        : 'N/A'
);

const getSkillKeys = skillsArray =>
    Array.isArray(skillsArray)
        ? skillsArray
            .flatMap(skill =>
                typeof skill === 'string'
                    ? [skill]
                    : skill && typeof skill === 'object'
                        ? Object.keys(skill)
                        : [],
            )
            .join(', ')
        : skillsArray ?? '—';

const formatClockTime = timestamp => {
    if (!timestamp) return '';
    const dateObj = new Date(timestamp);
    if (Number.isNaN(dateObj.getTime())) return '';
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();
    const meridiem = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12 || 12;
    const minutesPadded = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minutesPadded}:${seconds} ${meridiem}`;
};

const getTranscriptText = (message) => {
    if (!message) return '';
    const content = message.content;
    if (Array.isArray(content) && content.length) {
        const first = content[0];
        if (typeof first === 'string') return first.trim();
        if (first && typeof first.text === 'string') return first.text.trim();
        if (first && typeof first.value === 'string') return first.value.trim();
    }
    if (typeof content === 'string') return content.trim();
    if (content && typeof content.text === 'string') return content.text.trim();
    return '';
};

const getPlainTextValue = (value) => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (Array.isArray(value)) {
        for (const item of value) {
            const text = getPlainTextValue(item);
            if (text) return text;
        }
        return '';
    }
    if (value && typeof value === 'object') {
        const directKeys = ['text', 'value', 'label', 'title', 'name'];
        for (const key of directKeys) {
            if (typeof value[key] === 'string' && value[key].trim()) {
                return value[key].trim();
            }
        }
        for (const nestedValue of Object.values(value)) {
            const text = getPlainTextValue(nestedValue);
            if (text) return text;
        }
    }
    return '';
};

const getJobTitleText = (job) => {
    if (!job) return 'Job';
    return getPlainTextValue(job.title) || getPlainTextValue(job.internalTitle) || 'Job';
};

const getJobInternalTitleText = (job) => getPlainTextValue(job?.internalTitle);

const getJobTitleLabel = (job) => {
    const title = getJobTitleText(job);
    const internalTitle = getJobInternalTitleText(job);
    return internalTitle && internalTitle !== title ? `${title} (${internalTitle})` : title;
};

const truncateWithEllipsis = (value, maxLength = 18) => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
};

const renderJobTitle = job => {
    if (!job) return 'Job';
    const title = getJobTitleText(job);
    const internalTitle = getJobInternalTitleText(job);
    if (internalTitle && internalTitle !== title) {
        return (
            <>
                {title}
                <Typography
                    variant="caption"
                    component="span"
                    sx={{ color: 'text.secondary', ml: 0.5, fontSize: '0.68rem' }}
                >
                    ({internalTitle})
                </Typography>
            </>
        );
    }
    return title;
};

const clampPercentage = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return Math.max(0, Math.min(100, Math.round(numeric)));
};

const getInterviewScheduleScore = (schedule) => clampPercentage(
    schedule?.evaluationScore ??
    schedule?.evaluation?.totalScore ??
    schedule?.evaluation?.score ??
    schedule?.evaluation?.overallScore ??
    schedule?.evaluationBreakdown?.totalScore ??
    schedule?.evaluationBreakdown?.evaluationScore ??
    schedule?.evaluationBreakdown?.score ??
    null
);

const hasInterviewerFeedbackData = (source) => {
    const feedback = source?.interviewerFeedback || source || null;
    return Boolean(
        feedback?.rating ||
        feedback?.recommendation ||
        feedback?.submittedAt ||
        feedback?.strengths ||
        feedback?.improvements ||
        feedback?.overallComment ||
        (Array.isArray(feedback?.parameterRatings) && feedback.parameterRatings.length)
    );
};

const normalizeStageLookupKey = (value) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

const canStageShowScore = (status) => {
    const normalized = String(status || '').trim().toLowerCase();
    return Boolean(normalized && normalized !== 'not initiated' && normalized !== 'not applicable');
};

const getScheduleDerivedStageStatus = (schedule) => {
    if (!schedule) return '';

    const rawStatus = String(schedule?.interviewStatus || schedule?.status || '').trim();
    const normalizedStatus = rawStatus.toLowerCase();

    if (
        getInterviewScheduleScore(schedule) !== null ||
        schedule?.completedAt ||
        schedule?.endedAt ||
        schedule?.evaluation?.completedAt ||
        schedule?.evaluationBreakdown?.completedAt ||
        normalizedStatus.includes('complete')
    ) {
        return 'Completed';
    }
    if (normalizedStatus.includes('miss') || normalizedStatus.includes('unattend')) {
        return 'Missed';
    }
    if (normalizedStatus.includes('reject') || normalizedStatus.includes('fail')) {
        return 'Rejected';
    }
    if (normalizedStatus.includes('progress') || normalizedStatus.includes('ongoing')) {
        return 'In Progress';
    }
    if (normalizedStatus.includes('upcoming') || normalizedStatus.includes('schedule')) {
        return 'Scheduled';
    }

    return rawStatus;
};

const isActualAttemptedInterview = (schedule) => {
    if (!schedule) return false;
    if (getInterviewScheduleScore(schedule) !== null) return true;

    const rawStatus = String(schedule?.interviewStatus || schedule?.status || '').trim().toLowerCase();
    return Boolean(
        schedule?.endedAt ||
        schedule?.completedAt ||
        schedule?.evaluation?.completedAt ||
        schedule?.evaluationBreakdown?.completedAt ||
        schedule?.webrtcAccessUsedAt ||
        rawStatus.includes('complete') ||
        rawStatus.includes('progress') ||
        rawStatus.includes('ongoing') ||
        rawStatus.includes('attend')
    );
};

const getEffectiveStageStatus = (stageStatus, schedule) => {
    const normalized = String(stageStatus || '').trim().toLowerCase();
    if (normalized && normalized !== 'not initiated' && normalized !== 'not applicable') {
        return stageStatus;
    }

    const derivedStatus = getScheduleDerivedStageStatus(schedule);
    return derivedStatus || stageStatus || 'Not Initiated';
};

const getInterviewOverallEvaluation = (item) =>
    (typeof item?.overallReason === 'string' && item.overallReason.trim()) ||
    (typeof item?.evaluation?.overallReason === 'string' && item.evaluation.overallReason.trim()) ||
    (typeof item?.evaluation?.reason === 'string' && item.evaluation.reason.trim()) ||
    (typeof item?.evaluationReason === 'string' && item.evaluationReason.trim()) ||
    (typeof item?.evaluationBreakdown?.overallReason === 'string' && item.evaluationBreakdown.overallReason.trim()) ||
    (typeof item?.evaluationBreakdown?.evaluationReason === 'string' && item.evaluationBreakdown.evaluationReason.trim()) ||
    (typeof item?.evaluationBreakdown?.reason === 'string' && item.evaluationBreakdown.reason.trim()) ||
    null;

const normalizeInterviewParamItem = (name, value) => {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return null;

    if (typeof value === 'number') {
        return { name: cleanName, score: clampPercentage(value), reason: null, weight: 1, group: '' };
    }

    const scoreVal =
        value?.score ??
        value?.value ??
        value?.percentage ??
        value?.obtainedScore ??
        value?.totalScore ??
        null;

    const reason =
        (typeof value?.reason === 'string' && value.reason.trim()) ||
        (typeof value?.feedback === 'string' && value.feedback.trim()) ||
        (typeof value?.comment === 'string' && value.comment.trim()) ||
        (typeof value?.summary === 'string' && value.summary.trim()) ||
        null;

    const weightVal =
        value?.weight ??
        value?.weightage ??
        value?.weightScore ??
        null;

    return {
        name: cleanName,
        score: clampPercentage(scoreVal),
        reason,
        weight: typeof weightVal === 'number' && Number.isFinite(weightVal) && weightVal > 0 ? weightVal : 1,
        group: typeof value?.group === 'string' ? value.group.trim() : '',
    };
};

const getInterviewParameterWise = (item) => {
    const parameterWiseRaw =
        item?.evaluation?.parameters ||
        item?.evaluationBreakdown?.parameters ||
        item?.evaluationBreakdown?.parameterWiseEvaluation ||
        item?.evaluationBreakdown?.parameterWiseScores ||
        item?.evaluationBreakdown?.parameterWise ||
        item?.parameterWiseEvaluation ||
        item?.evaluation?.parameterWise ||
        item?.evaluation?.parameterWiseScores ||
        null;

    if (!parameterWiseRaw) return [];

    if (Array.isArray(parameterWiseRaw)) {
        return parameterWiseRaw
            .map((param) => {
                const name =
                    (typeof param?.parameterName === 'string' && param.parameterName.trim()) ||
                    (typeof param?.name === 'string' && param.name.trim()) ||
                    (typeof param?.title === 'string' && param.title.trim()) ||
                    (typeof param?.parameter?.name === 'string' && param.parameter.name.trim()) ||
                    '';
                return normalizeInterviewParamItem(name, param);
            })
            .filter(Boolean);
    }

    if (typeof parameterWiseRaw === 'object') {
        if (Array.isArray(parameterWiseRaw.parameters)) {
            return parameterWiseRaw.parameters
                .map((param) => {
                    const name =
                        (typeof param?.parameterName === 'string' && param.parameterName.trim()) ||
                        (typeof param?.name === 'string' && param.name.trim()) ||
                        (typeof param?.title === 'string' && param.title.trim()) ||
                        (typeof param?.parameter?.name === 'string' && param.parameter.name.trim()) ||
                        '';
                    return normalizeInterviewParamItem(name, param);
                })
                .filter(Boolean);
        }

        if (Array.isArray(parameterWiseRaw.scores)) {
            return parameterWiseRaw.scores
                .map((param) => {
                    const name =
                        (typeof param?.parameterName === 'string' && param.parameterName.trim()) ||
                        (typeof param?.name === 'string' && param.name.trim()) ||
                        (typeof param?.title === 'string' && param.title.trim()) ||
                        (typeof param?.parameter?.name === 'string' && param.parameter.name.trim()) ||
                        '';
                    return normalizeInterviewParamItem(name, param);
                })
                .filter(Boolean);
        }

        return Object.entries(parameterWiseRaw)
            .map(([name, value]) => normalizeInterviewParamItem(name, value))
            .filter(Boolean);
    }

    return [];
};

const formatInterviewParticipantName = (person) => {
    if (!person) return '';
    if (typeof person === 'string') return person;
    const fullName = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
    return fullName || person?.email || '';
};

export default function CandidateDetail() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [authState] = useAuthContextState();
    const [, setCandidateState] = useCandidateContextState();
    const [, setUiState] = useUiContextState();
    const role = authState.user?.role;
    const canDownloadAudio = ['ultra_admin', 'client_admin', 'manager'].includes(role);
    const [candidate, setCandidate] = useState(null);
    const [candidateError, setCandidateError] = useState(null); // 'archived' | 'not_found' | null
    const [jobs, setJobs] = useState([]);

    const [showAudioModal, setShowAudioModal] = useState(false);
    const [activeJobIdForTranscript, setActiveJobIdForTranscript] = useState(null);
    const [activeJobIdForAudio, setActiveJobIdForAudio] = useState(null);
    const [jobConversations, setJobConversations] = useState({});
    const [showTranscriptModal, setShowTranscriptModal] = useState(false);
    const [deleteModalOpen, setDeleteModal] = useState(false);
    const [selectedJobProgress, setSelectedJobProgress] = useState(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [showResumeModal, setShowResumeModal] = useState(false);
    const [resumePreviewMode, setResumePreviewMode] = useState('google');
    const [resumeFrameKey, setResumeFrameKey] = useState(0);
    const [resumeFrameLoading, setResumeFrameLoading] = useState(false);
    const [actionsAnchorEl, setActionsAnchorEl] = useState(null);
    const [actionsJob, setActionsJob] = useState(null);
    const actionsMenuOpen = Boolean(actionsAnchorEl);
    const [showAllApplications, setShowAllApplications] = useState(false);
    const [expandedApplicationRowKey, setExpandedApplicationRowKey] = useState(null);
    const [selectedApplicationJobId, setSelectedApplicationJobId] = useState('');
    const [applicationJobSearchInput, setApplicationJobSearchInput] = useState('');
    const [applicationJobAutocompleteOpen, setApplicationJobAutocompleteOpen] = useState(false);
    const [startCallModalOpen, setStartCallModalOpen] = useState(false);
    const [startCallJob, setStartCallJob] = useState(null);
    const [applyDialogOpen, setApplyDialogOpen] = useState(false);
    const [applyMulti, setApplyMulti] = useState(false);
    const [applyJobOptions, setApplyJobOptions] = useState([]);
    const [applyPicked, setApplyPicked] = useState([]);
    const [interviewViewsByAts, setInterviewViewsByAts] = useState({});
    const [interviewViewsLoading, setInterviewViewsLoading] = useState(false);
    const [showInterviewInsightModal, setShowInterviewInsightModal] = useState(false);
    const [selectedInterviewInsight, setSelectedInterviewInsight] = useState(null);
    const [interviewInsightModalView, setInterviewInsightModalView] = useState('report');
    const [interviewInsightReportUrl, setInterviewInsightReportUrl] = useState('');
    const [interviewInsightReportLoading, setInterviewInsightReportLoading] = useState(false);
    const [interviewInsightReportError, setInterviewInsightReportError] = useState('');

    // ✅ ADDED: success/error toast for archive from detail
    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const closeAlert = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertCfg(a => ({ ...a, open: false }));
    };

    // application stages from Candidate ATS for the selected job
    const [stageRows, setStageRows] = useState([]);

    // you control which is active
    const [activeIndex, setActiveIndex] = useState(0);

    const uiStateRef = useRef(setUiState);
    const interviewInsightReportUrlRef = useRef('');

    useEffect(() => {
        uiStateRef.current = setUiState;
    }, [setUiState]);

    useEffect(() => {
        if (!showResumeModal) {
            setResumeFrameLoading(false);
            return;
        }
        const hasResume = Boolean((candidate?.resumeUrl || '').trim());
        setResumeFrameLoading(hasResume);
        if (hasResume) {
            setResumeFrameKey((k) => k + 1);
            const timeoutRef = setTimeout(() => {
                setResumeFrameLoading(false);
            }, 8000);
            return () => clearTimeout(timeoutRef);
        }
    }, [showResumeModal, resumePreviewMode, candidate?.resumeUrl]);

    const loadCandidateDetails = useCallback(async (candidateId) => {
        if (!candidateId) return;
        uiStateRef.current({ loadingMsg: 'Loading...' });
        setCandidateError(null);
        try {
            const candidateResponse = await fetchData(`/api/candidates/${candidateId}?t=${Date.now()}`);

            if (!candidateResponse?.resumeUrl) {
                const candidateATSResponse = candidateResponse?.applications?.[0]
                    ? await fetchData(`/api/candidates/ats/${candidateResponse.applications[0]}`)
                    : null;
                candidateResponse.resumeUrl = candidateATSResponse?.resumeUrl;
            }

            setCandidate(candidateResponse || null);

            const jobIds = Array.isArray(candidateResponse?.jobs)
                ? candidateResponse.jobs
                : [];
            if (jobIds.length) {
                const jobDocs = await Promise.all(
                    jobIds.map(jobId =>
                        fetchData(`/api/jobs/${jobId}`).catch(() => null),
                    ),
                );
                setJobs(jobDocs.filter(Boolean));
            } else {
                setJobs([]);
            }
        } catch (err) {
            // Detect archived (410) vs not-found (404)
            const code = err?.code || err?.status;
            if (code === 410 || err?.message === 'Candidate is archived') {
                setCandidateError('archived');
            } else {
                setCandidateError('not_found');
            }
        } finally {
            uiStateRef.current({ loadingMsg: null });
        }
    }, []);

    useEffect(() => {
        loadCandidateDetails(id);
    }, [id, loadCandidateDetails]);

    const candidateName = [
        candidate?.firstName,
        candidate?.lastName,
    ].filter(Boolean).join(' ').trim() || candidate?.email || '';

    useEffect(() => {
        setDocumentTitle(candidateName || 'Candidate Detail');
    }, [candidateName]);

    const ensureConversationLoaded = async job => {
        if (!job?._id || jobConversations[job._id]) return;

        setUiState({ loadingMsg: 'Loading…' });
        try {
            const list = await fetchData(`/api/conversations/${id}/${job._id}/`);
            let jobSpecific = (list || [])
            if (!jobSpecific.length) {
                setJobConversations(prev => ({
                    ...prev,
                    [job._id]: { messages: [], audioUrl: '', error: 'No conversation found' },
                }));
                return;
            }
            jobSpecific = jobSpecific.sort(
                (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
            )[0];

            const filteredMessages = (jobSpecific.messages || []).filter(
                message => message.role !== 'system',
            );

            const audioUrl = jobSpecific.audio_url || jobSpecific.recording || '';
            console.log('[CandidateDetail] Conversation audio loaded:', {
                candidateId: id,
                jobId: job._id,
                conversationId: jobSpecific?._id,
                audioUrl: audioUrl || 'n/a',
            });

            setJobConversations(prev => ({
                ...prev,
                [job._id]: {
                    messages: filteredMessages,
                    audioUrl,
                    error: filteredMessages.length ? null : 'No content to display',
                },
            }));
        } catch {
            alert("Failed to fetch conversation");

        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const handleOpenTranscript = async job => {
        await ensureConversationLoaded(job);
        setActiveJobIdForTranscript(job._id);
        setShowTranscriptModal(true);
    };

    const handleCloseTranscriptModal = () => {
        setShowTranscriptModal(false);
        setActiveJobIdForTranscript(null);
    };

    const handleOpenAudio = async job => {
        await ensureConversationLoaded(job);
        setActiveJobIdForAudio(job._id);
        setShowAudioModal(true);
    };

    const handleOpenActionsMenu = (event, job) => {
        event.stopPropagation();
        setActionsAnchorEl(event.currentTarget);
        setActionsJob(job);
    };

    const handleCloseActionsMenu = () => {
        setActionsAnchorEl(null);
        setActionsJob(null);
    };

    const openStartCallModal = (job) => {
        setStartCallJob(job);
        setStartCallModalOpen(true);
    };

    const handleStartAiCall = async () => {
        if (!candidate?._id || !startCallJob?._id) return;
        setUiState({ loadingMsg: 'Triggering, Please wait...' });
        try {
            await fetchData(`/api/ai/call/trigger/plivo/${candidate._id}/${startCallJob._id}/`);
            setAlertCfg({ open: true, message: 'AI call triggered successfully.', severity: 'success' });
        } catch (err) {
            console.error('[CandidateDetail] start AI call failed:', err);
            setAlertCfg({
                open: true,
                message: err?.message || 'Failed to trigger AI call. Please try again.',
                severity: 'error',
            });
        } finally {
            setUiState({ loadingMsg: null });
            setStartCallModalOpen(false);
            setStartCallJob(null);
        }
    };

    const ensureJobOptions = async () => {
        if (applyJobOptions.length) return;
        setUiState({ loadingMsg: 'Loading, Please wait...' });
        try {
            const list = await fetchData('/api/jobs?fields=_id,title,internalTitle');
            setApplyJobOptions(list.map(j => ({
                label: j.title + `(${j.internalTitle})`,
                value: j._id
            })));
        } catch (err) {
            console.error(err);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const handleApplyToJobClick = async () => {
        await ensureJobOptions();
        setApplyDialogOpen(true);
    };

    const assignToJobs = async () => {
        if (!candidate?._id) return;
        if (!applyPicked.length) {
            alert('Select at least one job');
            return;
        }
        setUiState({ loadingMsg: 'Loading, Please wait...' });
        const res = await fetchData('/api/candidates/assign-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidateIds: [candidate._id],
                jobIds: applyPicked.map((job) => job.value),
            }),
        })
            .catch(e => ({ error: e?.message || 'Candidate is already applied for this job' }))
            .finally(() => setUiState({ loadingMsg: null }));

        if (res?.error) alert(res.error);
        else {
            if (res.skipped?.length) {
                alert(`${res.skipped.length} candidate(s) were already on that job and skipped.`);
            }
            await loadCandidateDetails(id);
        }
        setApplyDialogOpen(false);
        setApplyPicked([]);
    };

    const handleArchive = async () => {
        if (!candidate) return;

        setUiState({ loadingMsg: 'Deleting…' });

        try {
            await fetchData(`/api/candidates/${candidate._id}`, { method: 'DELETE' });

            // ✅ Clear cached list so Talent Pool refetches fresh data
            setCandidateState({ candidateListRows: null, candidateListQuery: null });

            // ✅ ADDED: show success msg like list page
            setAlertCfg({ open: true, message: 'Candidate archived.', severity: 'success' });

            // keep behavior (navigate to list) but allow toast to be visible briefly
            setTimeout(() => {
                navigate('/candidates');
            }, 500);
        } catch (err) {
            console.error('[CandidateDetail] archive failed:', err);
            setAlertCfg({
                open: true,
                message: err?.message || 'Failed to archive candidate.',
                severity: 'error',
            });
        } finally {
            setDeleteModal(false);
            setUiState({ loadingMsg: null });
        }
    };

    const openEdit = () => {
        if (!candidate) return;
        const prefillDict = {
            _id: candidate._id,
            jobId: candidate.jobs?.[0] ?? '',
            ['firstName of Candidate 0']: candidate.firstName ?? '',
            ['lastName of Candidate 0']: candidate.lastName ?? '',
            ['email of Candidate 0']: candidate.email ?? '',
            ['countryCode of Candidate 0']: candidate.countryCode ?? '+91',
            ['phoneNumber of Candidate 0']: candidate.phoneNumber ?? '',
            ['skills of Candidate 0']: getSkillKeys(candidate.skills),
            ['Approved Candidate 0']: true,
        };
        setCandidateState({ candidateInitialValuesDict: prefillDict });
        navigate(`/candidates/edit/${candidate._id}`);
    };

    const downloadTrackerForJob = async (job) => {
        if (!candidate?._id || !job?._id) return;
        try {
            setUiState({ loadingMsg: 'Preparing tracker…' });
            const excelBlob = await fetchData(
                `/api/candidates/tracker/?ids=${candidate._id}&jobId=${job._id}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                },
            );
            setUiState({ loadingMsg: null });

            const url = URL.createObjectURL(excelBlob);
            const safeTitle = (job.title || 'job').trim().replace(/\s+/g, '_');
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `candidate_${candidate._id}_${safeTitle}_tracker.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Tracker download failed:', err);
            setUiState({ loadingMsg: null });
            alert('Could not download tracker.');
        }
    };

    const openProgressForJob = (job) => {
        if (!job?._id) return;
        const ats = getApplicationATSForJob(job._id);
        if (ats && Array.isArray(ats.stageResults) && ats.stageResults.length) {
            const rows = ats.stageResults.map((sr, idx) => ({
                id: String(sr._id || sr.id || idx),
                title: sr.stage?.title || `Stage ${idx + 1}`,
                status: sr.stageStatus || 'Not Initiated',
                remark: sr.remarkOrFeedback || '',
                description: sr.stage?.description || '',
            }));

            const lastNonInit = rows.reduce((acc, row, index) => {
                const status = (row.status || '').toLowerCase();
                if (status && status !== 'not initiated' && status !== 'not applicable') {
                    return index;
                }
                return acc;
            }, -1);

            const nextActiveIndex = lastNonInit >= 0 ? lastNonInit : 0;

            setSelectedJobProgress({ job, ats });
            setStageRows(rows);
            setActiveIndex(nextActiveIndex);
        } else {
            setSelectedJobProgress({ job, ats: null });
            setStageRows([]);
            setActiveIndex(0);
        }

        setShowProgressModal(true);
    };

    const search = new URLSearchParams(location.search);
    const jid = search.get('jid') || search.get('jobId');

    useEffect(() => {
        const shouldOpen = (search.get('showaudiomodal') || '').toLowerCase() === 'true';

        if (!shouldOpen || !candidate || !jid) return;

        const openAudioModalAtStart = async () => {
            let jobToOpen = null;
            if (jid && jobs.length) {
                jobToOpen = jobs.find(j => String(j._id) === String(jid));
            }
            if (!jobToOpen && jobs.length) {
                jobToOpen = jobs[0];
            }
            if (jobToOpen) {
                await handleOpenAudio(jobToOpen);
            }
        };
        openAudioModalAtStart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, candidate, jobs]);


    useEffect(() => {
        const shouldOpen = (search.get('showtranscriptmodal') || '').toLowerCase() === 'true';

        if (!shouldOpen || !candidate || !jid) return;

        const openTrsanscriptModalAtStart = async () => {
            let jobToOpen = null;
            if (jid && jobs.length) {
                jobToOpen = jobs.find(j => String(j._id) === String(jid));
            }
            if (!jobToOpen && jobs.length) {
                jobToOpen = jobs[0];
            }
            if (jobToOpen) {
                await handleOpenTranscript(jobToOpen);
            }
        };
        openTrsanscriptModalAtStart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, candidate, jobs]);

    const getApplicationATSForJob = (jobId) => {
        if (!candidate || !Array.isArray(candidate.applicationsATS)) return null;
        const targetId = String(jobId);
        return (
            candidate.applicationsATS.find(ats => {
                const atsJobId = ats.job && (ats.job._id || ats.job);
                return atsJobId && String(atsJobId) === targetId;
            }) || null
        );
    };

    const applicationAtsList = Array.isArray(candidate?.applicationsATS) ? candidate.applicationsATS : [];
    const applicationAtsIdsKey = applicationAtsList
        .map((ats) => String(ats?._id || ''))
        .filter(Boolean)
        .join('|');

    useEffect(() => {
        setShowAllApplications(false);
    }, [candidate?._id]);

    useEffect(() => {
        let isActive = true;
        const atsIds = applicationAtsIdsKey
            ? applicationAtsIdsKey.split('|').filter(Boolean)
            : [];

        if (!candidate?._id || !atsIds.length) {
            setInterviewViewsByAts({});
            setInterviewViewsLoading(false);
            return () => {
                isActive = false;
            };
        }

        setInterviewViewsLoading(true);

        (async () => {
            try {
                const results = await Promise.allSettled(
                    atsIds.map((atsId) => fetchData(`/api/interviewschedules/view?candidateATS=${atsId}`)),
                );

                if (!isActive) return;

                const nextViews = {};
                results.forEach((result, index) => {
                    if (result.status === 'fulfilled' && !result.value?.error) {
                        nextViews[atsIds[index]] = result.value;
                    }
                });

                setInterviewViewsByAts(nextViews);
            } catch (err) {
                if (!isActive) return;
                console.error('Failed to load interview schedule views:', err);
                setInterviewViewsByAts({});
            } finally {
                if (isActive) {
                    setInterviewViewsLoading(false);
                }
            }
        })();

        return () => {
            isActive = false;
        };
    }, [candidate?._id, applicationAtsIdsKey]);

    useEffect(() => {
        let active = true;
        const isFeedbackView = interviewInsightModalView === 'feedback';
        const scheduleId = selectedInterviewInsight?.scheduleId || null;

        const clearReportPreview = () => {
            if (interviewInsightReportUrlRef.current) {
                window.URL.revokeObjectURL(interviewInsightReportUrlRef.current);
                interviewInsightReportUrlRef.current = '';
            }
            setInterviewInsightReportUrl('');
            setInterviewInsightReportLoading(false);
            setInterviewInsightReportError('');
        };

        if (!showInterviewInsightModal || isFeedbackView) {
            clearReportPreview();
            return () => {
                active = false;
            };
        }

        if (!scheduleId) {
            clearReportPreview();
            setInterviewInsightReportError('Interview report is not available for this stage yet.');
            return () => {
                active = false;
            };
        }

        clearReportPreview();
        setInterviewInsightReportLoading(true);

        const loadInterviewReportPreview = async () => {
            try {
                const blob = await fetchData(`/api/interviewschedules/${scheduleId}/report`, {
                    method: 'GET',
                });

                if (!active) return;

                if (!(blob instanceof Blob)) {
                    throw new Error('Interview report response was not a PDF blob.');
                }

                const reportUrl = window.URL.createObjectURL(blob);
                interviewInsightReportUrlRef.current = reportUrl;
                setInterviewInsightReportUrl(reportUrl);
            } catch (error) {
                if (!active) return;
                console.error('Failed to load interview report preview', error);
                setInterviewInsightReportError(
                    error?.status === 404
                        ? 'Interview report is not available for this stage yet.'
                        : 'Unable to load the interview report right now.',
                );
            } finally {
                if (active) {
                    setInterviewInsightReportLoading(false);
                }
            }
        };

        loadInterviewReportPreview();

        return () => {
            active = false;
            clearReportPreview();
        };
    }, [
        interviewInsightModalView,
        selectedInterviewInsight?.scheduleId,
        showInterviewInsightModal,
    ]);

    if (candidateError) {
        return (
            <MUICenterLayout>
                <Typography>
                    {candidateError === 'archived'
                        ? 'Candidate is Archived'
                        : 'Candidate not found'}
                </Typography>
            </MUICenterLayout>
        );
    }

    if (!candidate) {
        return (
            <MUICenterLayout>
                <Typography>Loading…</Typography>
            </MUICenterLayout>
        );
    }

    const activeTranscriptData =
        activeJobIdForTranscript && jobConversations[activeJobIdForTranscript];
    const activeAudioData =
        activeJobIdForAudio && jobConversations[activeJobIdForAudio];
    const activeAudioAts = activeJobIdForAudio ? getApplicationATSForJob(activeJobIdForAudio) : null;
    const resolvedAudioUrl = activeAudioData?.audioUrl || activeAudioAts?.callAudioUrl || '';

    const activeJob = jobs.find(j => j._id === activeJobIdForAudio);
    const downloadFileName = activeJob
        ? `${candidate.firstName}_${candidate.lastName}-${candidate._id}-${activeJob.title
            .trim()
            .replace(/\s+/g, '_')}.wav`
        : `recording-${candidate._id}.wav`;

    const activeStage = stageRows[activeIndex] || null;
    const fullName = [candidate.firstName, candidate.lastName].filter(Boolean).join(' ') || 'Candidate';
    const rawSkills = getSkillKeys(candidate.skills);
    const skillList = String(rawSkills || '')
        .split(',')
        .map((skill) => skill.trim())
        .filter((skill) => /[a-zA-Z0-9]/.test(skill));

    const emailText = candidate.email || 'N/A';
    const phoneText = [candidate.countryCode, candidate.phoneNumber]
        .filter(Boolean)
        .join(' ')
        .trim() || 'N/A';
    const resumeUrl = (candidate?.resumeUrl || '').trim();
    const resumePreviewUrl = resumeUrl
        ? (resumePreviewMode === 'direct'
            ? resumeUrl
            : `https://docs.google.com/gview?url=${encodeURIComponent(resumeUrl)}&embedded=true`)
        : '';
    const formatLocationValue = (val) => {
        if (!val) return 'N/A';
        if (Array.isArray(val)) {
            const joined = val.filter(Boolean).join(', ').trim();
            return joined || 'N/A';
        }
        const asString = String(val || '').trim();
        if (!asString) return 'N/A';
        try {
            const parsed = JSON.parse(asString);
            if (Array.isArray(parsed)) {
                const joined = parsed.filter(Boolean).join(', ').trim();
                if (joined) return joined;
            }
        } catch {
            // ignore JSON parse errors
        }
        return asString;
    };
    const locationText = formatLocationValue(
        candidate.location ||
        candidate.currentLocation ||
        candidate.city ||
        candidate?.applicationsATS?.[0]?.location
    );
    // const highlightSkills = skillList.slice(0, 3);

    const getStageSnapshot = (ats, stageColumns = []) => {
        const activeColumn =
            [...stageColumns].reverse().find((column) => {
                const status = String(column?.status || '').trim().toLowerCase();
                return status && status !== 'not initiated' && status !== 'not applicable';
            }) || null;

        if (activeColumn) {
            const statusLabel = String(activeColumn?.status || '').trim();
            return {
                chipLabel: (statusLabel || 'N/A').toUpperCase(),
                statusLabel: activeColumn.title || statusLabel || 'N/A',
            };
        }

        const stageResults = Array.isArray(ats?.stageResults) ? ats.stageResults : [];
        if (!stageResults.length) {
            return { chipLabel: 'N/A', statusLabel: 'Not Initiated' };
        }
        const active =
            [...stageResults].reverse().find((sr) => {
                const status = String(sr?.stageStatus || '').trim().toLowerCase();
                return status && status !== 'not initiated' && status !== 'not applicable';
            }) || null;
        if (!active) {
            return { chipLabel: 'N/A', statusLabel: 'Not Initiated' };
        }
        const stageTitle = String(active?.stage?.title || '').trim();
        const stageStatus = String(active?.stageStatus || '').trim();
        const chipLabel = (stageStatus || 'N/A').toUpperCase();
        const statusLabel = stageTitle || stageStatus || 'N/A';
        return { chipLabel, statusLabel };
    };

    const getLatestInterviewScore = (ats) => {
        const atsId = String(ats?._id || '');
        const schedules = Array.isArray(interviewViewsByAts[atsId]?.schedules)
            ? interviewViewsByAts[atsId].schedules
            : [];

        return schedules.reduce((latest, schedule) => {
            const score = getInterviewScheduleScore(schedule);
            if (score === null) return latest;

            const nextTime = Math.max(
                new Date(schedule?.evaluation?.completedAt || 0).getTime(),
                new Date(schedule?.evaluationBreakdown?.completedAt || 0).getTime(),
                new Date(schedule?.completedAt || 0).getTime(),
                new Date(schedule?.endedAt || 0).getTime(),
                new Date(schedule?.updatedAt || 0).getTime(),
                new Date(schedule?.startAt || 0).getTime(),
                new Date(schedule?.createdAt || 0).getTime(),
            );

            if (!latest || nextTime >= latest.time) {
                return { score, time: nextTime };
            }

            return latest;
        }, null)?.score ?? null;
    };

    const getMatchScore = (ats) => {
        const latestInterviewScore = getLatestInterviewScore(ats);
        if (latestInterviewScore !== null) {
            return latestInterviewScore;
        }

        const raw =
            ats?.videoInterviewScore ??
            ats?.evaluationScore ??
            ats?.matchScore ??
            ats?.aiScore ??
            ats?.score ??
            null;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) return Math.round(numeric);
        return null;
    };

    const getApplicationRelevancyScore = (ats) => {
        const raw =
            ats?.candidateRelevancyToJob ??
            ats?.matchScore ??
            ats?.aiScore ??
            ats?.score ??
            null;
        const numeric = Number(raw);
        if (Number.isFinite(numeric)) return Math.round(numeric);
        return null;
    };

    const getStageVisualMeta = (status) => {
        const normalized = String(status || '').trim().toLowerCase();
        if (!normalized || normalized === 'not initiated' || normalized === 'not applicable') {
            return {
                dotColor: alpha(theme.palette.text.secondary, isDark ? 0.28 : 0.2),
                lineColor: alpha(theme.palette.text.secondary, isDark ? 0.2 : 0.14),
                panelBg: 'background.paper',
                panelBorder: 'divider',
                statusBg: alpha(theme.palette.text.secondary, isDark ? 0.16 : 0.08),
                statusColor: 'text.secondary',
            };
        }
        if (normalized.includes('reject') || normalized.includes('fail')) {
            return {
                dotColor: theme.palette.error.main,
                lineColor: alpha(theme.palette.error.main, isDark ? 0.44 : 0.28),
                panelBg: alpha(theme.palette.error.main, isDark ? 0.08 : 0.04),
                panelBorder: alpha(theme.palette.error.main, isDark ? 0.32 : 0.18),
                statusBg: alpha(theme.palette.error.main, isDark ? 0.18 : 0.1),
                statusColor: 'error.main',
            };
        }
        return {
            dotColor: theme.palette.primary.main,
            lineColor: alpha(theme.palette.primary.main, isDark ? 0.48 : 0.24),
            panelBg: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
            panelBorder: alpha(theme.palette.primary.main, isDark ? 0.32 : 0.16),
            statusBg: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
            statusColor: 'primary.main',
        };
    };

    const buildStageInterviewColumns = (ats) => {
        const stageResults = Array.isArray(ats?.stageResults) ? ats.stageResults : [];
        if (!stageResults.length) return [];

        const columns = stageResults.map((sr, index) => ({
            id: String(sr?._id || sr?.stage?._id || index),
            stageId: String(sr?.stage?._id || ''),
            title: sr?.stage?.title || `Stage ${index + 1}`,
            status: sr?.stageStatus || 'Not Initiated',
            remark: typeof sr?.remarkOrFeedback === 'string' ? sr.remarkOrFeedback.trim() : '',
            linkedSchedule: null,
            feedbackSchedule: null,
            cards: [],
        }));

        const atsId = String(ats?._id || '');
        const schedules = Array.isArray(interviewViewsByAts[atsId]?.schedules)
            ? [...interviewViewsByAts[atsId].schedules]
            : [];

        const scheduleItems = schedules
            .map((schedule, index) => ({
                id: String(schedule?._id || `${atsId}-${index}`),
                score: getInterviewScheduleScore(schedule),
                interviewType: schedule?.interviewType || schedule?.roundType || `Interview ${index + 1}`,
                startAt: schedule?.startAt || schedule?.createdAt || null,
                schedule,
            }))
            .sort((a, b) => {
                const aTime = new Date(a.startAt || 0).getTime();
                const bTime = new Date(b.startAt || 0).getTime();
                return aTime - bTime;
            });

        const resolveTargetIndex = (scheduleItem) => {
            const targetStageId = String(scheduleItem?.schedule?.targetStageId || '').trim();
            if (targetStageId) {
                const targetById = columns.findIndex((column) => column.stageId === targetStageId);
                return targetById;
            }

            const targetStageTitleKey = normalizeStageLookupKey(scheduleItem?.schedule?.targetStageTitle);
            if (targetStageTitleKey) {
                return columns.findIndex((column) => (
                    normalizeStageLookupKey(column.title) === targetStageTitleKey
                ));
            }

            const scheduleKey = normalizeStageLookupKey(scheduleItem.interviewType);
            if (!scheduleKey) return -1;

            return columns.findIndex((column) => (
                normalizeStageLookupKey(column.title) === scheduleKey
            ));
        };

        scheduleItems.forEach((scheduleItem) => {
            const targetIndex = resolveTargetIndex(scheduleItem);
            if (targetIndex >= 0) {
                columns[targetIndex].linkedSchedule = scheduleItem.schedule;
                if (hasInterviewerFeedbackData(scheduleItem.schedule)) {
                    columns[targetIndex].feedbackSchedule = scheduleItem.schedule;
                }
            }
        });

        columns.forEach((column) => {
            column.status = getEffectiveStageStatus(column.status, column.linkedSchedule);
        });

        const attemptedSchedules = [...scheduleItems]
            .filter((item) => isActualAttemptedInterview(item.schedule))
            .sort((a, b) => {
                const aTime = new Date(a.startAt || 0).getTime();
                const bTime = new Date(b.startAt || 0).getTime();
                return bTime - aTime;
            });

        attemptedSchedules.forEach((schedule) => {
            const targetIndex = resolveTargetIndex(schedule);
            if (targetIndex >= 0) {
                if (!canStageShowScore(columns[targetIndex].status)) {
                    return;
                }
                columns[targetIndex].cards.push({
                    id: schedule.id,
                    score: schedule.score,
                    schedule: schedule.schedule || null,
                });
            }
        });

        if (!attemptedSchedules.length && !scheduleItems.length) {
            const fallbackScore = clampPercentage(getMatchScore(ats));
            if (fallbackScore !== null) {
                const fallbackIndex = columns.reduce((acc, column, index) => (
                    canStageShowScore(column.status) ? index : acc
                ), -1);
                if (fallbackIndex < 0) {
                    return columns;
                }
                if (fallbackIndex >= 0) {
                    columns[fallbackIndex].cards.push({
                        id: `fallback-${atsId || fallbackIndex}`,
                        score: fallbackScore,
                        schedule: null,
                    });
                }
            }
        }

        return columns;
    };

    const applicationRows = (() => {
        const atsList = Array.isArray(candidate.applicationsATS) ? candidate.applicationsATS : [];
        if (atsList.length) {
            return atsList
                .map((ats) => {
                    const job = typeof ats.job === 'object'
                        ? ats.job
                        : jobs.find((j) => String(j?._id) === String(ats.job));
                    if (!job) return null;
                    return { job, ats };
                })
                .filter(Boolean);
        }
        return (jobs || []).map((job) => ({ job, ats: getApplicationATSForJob(job._id) }));
    })();
    const applicationFilterOptions = applicationRows.map(({ job }) => {
        const companyName =
            job?.company?.name ||
            job?.company?.title ||
            job?.companyName ||
            '';
        const jobTitleLabel = getJobTitleLabel(job);
        return {
            value: String(job?._id || job?.id || ''),
            label: companyName ? `${jobTitleLabel} - ${companyName}` : jobTitleLabel,
        };
    });
    const effectiveSelectedApplicationJobId =
        selectedApplicationJobId &&
            applicationFilterOptions.some((option) => option.value === selectedApplicationJobId)
            ? selectedApplicationJobId
            : '';
    const selectedApplicationOption =
        applicationFilterOptions.find((option) => option.value === effectiveSelectedApplicationJobId) ||
        null;
    const displayedApplicationJobInputValue =
        !applicationJobAutocompleteOpen && selectedApplicationOption
            ? truncateWithEllipsis(selectedApplicationOption.label, 18)
            : applicationJobSearchInput;
    const filteredApplicationRows = effectiveSelectedApplicationJobId
        ? applicationRows.filter(({ job }) => String(job?._id || job?.id || '') === effectiveSelectedApplicationJobId)
        : applicationRows;
    const initialApplicationCount = 5;
    const visibleApplicationRows = effectiveSelectedApplicationJobId
        ? filteredApplicationRows
        : showAllApplications
            ? filteredApplicationRows
            : filteredApplicationRows.slice(0, initialApplicationCount);
    const hasHiddenApplications = !effectiveSelectedApplicationJobId &&
        filteredApplicationRows.length > initialApplicationCount &&
        !showAllApplications;
    // const primaryJobTitle = getJobTitleText(applicationRows[0]?.job) || getJobTitleText(jobs[0]);
    // const skillsetLabel = primaryJobTitle ? `${primaryJobTitle} Skillset` : 'Skillset';
    const activeInterviewRow = applicationRows[0] || null;
    const applicationGridColumns = {
        md: '36px minmax(0, 1.18fr) minmax(0, 1.6fr) minmax(0, 0.92fr) minmax(0, 0.9fr) 28px',
        lg: '36px minmax(0, 1.42fr) minmax(0, 1.48fr) minmax(0, 0.95fr) minmax(0, 0.82fr) 28px',
    };
    const openResumePreviewModal = () => {
        setResumePreviewMode('google');
        setResumeFrameLoading(Boolean(resumeUrl));
        setResumeFrameKey((k) => k + 1);
        setShowResumeModal(true);
    };
    const buildInterviewInsightPayload = (schedule, options = {}) => {
        const { job, stageTitle, fallbackScore, stageRemarkFeedback, stageStatus } = options;
        const base = schedule ? { ...schedule } : {};
        const payload = {
            ...base,
            scheduleId: base?._id || base?.id || null,
            _id: base?._id || base?.id || `stage-insight-${job?._id || job?.id || stageTitle || 'unknown'}`,
        };

        if (job && !payload.job) {
            payload.job = job;
        }
        if (!payload.interviewType && stageTitle) {
            payload.interviewType = stageTitle;
        }
        if (
            fallbackScore !== null &&
            fallbackScore !== undefined &&
            getInterviewScheduleScore(payload) === null
        ) {
            payload.evaluationScore = fallbackScore;
        }
        if (!payload.stageRemarkOrFeedback && stageRemarkFeedback) {
            payload.stageRemarkOrFeedback = String(stageRemarkFeedback).trim();
        }
        if (!payload.stageStatus && stageStatus) {
            payload.stageStatus = stageStatus;
        }

        return payload;
    };
    const clearInterviewInsightReportPreview = () => {
        if (interviewInsightReportUrlRef.current) {
            window.URL.revokeObjectURL(interviewInsightReportUrlRef.current);
            interviewInsightReportUrlRef.current = '';
        }
        setInterviewInsightReportUrl('');
        setInterviewInsightReportLoading(false);
        setInterviewInsightReportError('');
    };
    const openInterviewInsightModal = (schedule, view = 'report') => {
        if (!schedule) return;
        setSelectedInterviewInsight(schedule);
        setInterviewInsightModalView(view);
        setShowInterviewInsightModal(true);
    };
    const closeInterviewInsightModal = () => {
        clearInterviewInsightReportPreview();
        setShowInterviewInsightModal(false);
        setSelectedInterviewInsight(null);
        setInterviewInsightModalView('report');
    };

    const interviewInsightScore = getInterviewScheduleScore(selectedInterviewInsight);
    const interviewInsightOverallEvaluation = getInterviewOverallEvaluation(selectedInterviewInsight);
    const interviewInsightParameters = getInterviewParameterWise(selectedInterviewInsight);
    const interviewInsightFeedback = selectedInterviewInsight?.interviewerFeedback || null;
    const interviewInsightStageRemark = typeof selectedInterviewInsight?.stageRemarkOrFeedback === 'string'
        ? selectedInterviewInsight.stageRemarkOrFeedback.trim()
        : '';
    const interviewInsightScoreValue =
        typeof interviewInsightScore === 'number' && !Number.isNaN(interviewInsightScore)
            ? Math.max(0, Math.min(100, interviewInsightScore))
            : null;
    const interviewInsightInterviewers = Array.isArray(selectedInterviewInsight?.interviewers)
        ? selectedInterviewInsight.interviewers.map(formatInterviewParticipantName).filter(Boolean)
        : [];
    const interviewInsightFeedbackParameterRatings = Array.isArray(interviewInsightFeedback?.parameterRatings)
        ? interviewInsightFeedback.parameterRatings
        : [];
    const hasInterviewInsightFeedback = hasInterviewerFeedbackData(interviewInsightFeedback);
    const hasInterviewInsightStageRemark = Boolean(interviewInsightStageRemark);
    const isInterviewInsightFeedbackView = interviewInsightModalView === 'feedback';
    const showLegacyInterviewEvaluation = interviewInsightModalView === '__legacy_evaluation__';
    const interviewInsightBand = (() => {
        if (typeof interviewInsightScore !== 'number' || Number.isNaN(interviewInsightScore)) {
            return {
                label: 'N/A',
                color: theme.palette.text.secondary,
                bg: alpha(theme.palette.text.secondary, isDark ? 0.2 : 0.12),
            };
        }
        if (interviewInsightScore < 33) {
            return {
                label: 'Low',
                color: theme.palette.error.main,
                bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
            };
        }
        if (interviewInsightScore < 67) {
            return {
                label: 'Medium',
                color: theme.palette.warning.main,
                bg: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
            };
        }
        return {
            label: 'High',
            color: theme.palette.success.main,
            bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
        };
    })();
    const getInterviewRecommendationTone = (recommendation) => {
        if (!recommendation) {
            return {
                color: theme.palette.text.secondary,
                bg: alpha(theme.palette.text.secondary, isDark ? 0.18 : 0.1),
            };
        }
        if (recommendation === 'Strongly Recommend') {
            return {
                color: theme.palette.success.dark,
                bg: alpha(theme.palette.success.main, isDark ? 0.22 : 0.12),
            };
        }
        if (recommendation === 'Recommend') {
            return {
                color: theme.palette.success.main,
                bg: alpha(theme.palette.success.main, isDark ? 0.18 : 0.1),
            };
        }
        if (recommendation === 'Neutral') {
            return {
                color: theme.palette.warning.dark,
                bg: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.1),
            };
        }
        return {
            color: theme.palette.error.main,
            bg: alpha(theme.palette.error.main, isDark ? 0.18 : 0.1),
        };
    };

    return (
        <Box
            sx={{
                p: { xs: 2, sm: 3 },
                width: '100%',
                minHeight: '100vh',
                bgcolor: 'background.default',
            }}
        >
            <Card
                sx={{
                    width: '100%',
                    minHeight: 'calc(100vh - 140px)',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'none',
                    bgcolor: 'transparent',
                    border: 'none',
                }}
            >
                <CardContent sx={{ flex: 1, p: { xs: 2, sm: 4 } }}>
                    {/* ✅ ADDED: toast surface */}
                    <MUIAlert
                        open={alertCfg.open}
                        message={alertCfg.message}
                        severity={alertCfg.severity}
                        onClose={closeAlert}
                    />

                    <Box sx={{ maxWidth: '1400px', mx: 'auto' }}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                mb: 3,
                                flexWrap: 'wrap',
                                gap: 2,
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <IconButton
                                    size="small"
                                    onClick={() => navigate(-1)}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        bgcolor: 'background.paper',
                                    }}
                                >
                                    <ArrowBackIosIcon fontSize="small" />
                                </IconButton>
                                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                                    Candidate Profile
                                </Typography>
                                <Typography variant="subtitle2" sx={{ color: 'text.secondary' }}>
                                    &gt;
                                </Typography>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                    {fullName}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                {candidate.email ? (
                                    <MUIButton
                                        variant="outlined"
                                        size="small"
                                        component="a"
                                        href={`mailto:${candidate.email}`}
                                        startIcon={<EmailOutlinedIcon fontSize="small" />}
                                        sx={{ borderRadius: 2 }}
                                    >
                                        Email
                                    </MUIButton>
                                ) : null}
                                <MUIButton
                                    variant="outlined"
                                    size="small"
                                    startIcon={<DescriptionIcon fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                    onClick={openResumePreviewModal}
                                    disabled={!resumeUrl}
                                >
                                    View Resume
                                </MUIButton>
                                <MUIButton
                                    variant="outlined"
                                    size="small"
                                    startIcon={<PhoneOutlinedIcon fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                    onClick={() => {
                                        const candidatePhone = `${candidate?.countryCode || ''}${candidate?.phoneNumber || ''}`.trim();
                                        navigate(`/ai-call-logs${candidatePhone ? `?phone=${encodeURIComponent(candidatePhone)}` : ''}`);
                                    }}
                                >
                                    Call History
                                </MUIButton>
                                <MUIButton
                                    variant="outlined"
                                    size="small"
                                    startIcon={<EditOutlinedIcon fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                    onClick={openEdit}
                                >
                                    Edit
                                </MUIButton>
                                <MUIButton
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    startIcon={<ArchiveOutlinedIcon fontSize="small" />}
                                    sx={{ borderRadius: 2 }}
                                    onClick={() => setDeleteModal(true)}
                                >
                                    Archive
                                </MUIButton>
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: {
                                    xs: '1fr',
                                    sm: 'minmax(220px, 248px) minmax(0, 1fr)',
                                    md: 'minmax(230px, 270px) minmax(0, 1fr)',
                                },
                                alignItems: 'start',
                                rowGap: { xs: 2, sm: 0 },
                            }}
                        >
                            <Box
                                sx={{
                                    pr: { sm: 2, md: 3 },
                                    borderRight: { sm: '1px dashed' },
                                    borderRightColor: { sm: 'divider' },
                                    minWidth: 0,
                                }}
                            >
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Box
                                        sx={{
                                            p: 2,
                                            borderRadius: 3,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            boxShadow: 1,
                                            display: 'flex',
                                            justifyContent: 'center',
                                        }}
                                    >
                                        <Box
                                            component="img"
                                            src={defaultAvatar}
                                            alt="Candidate"
                                            sx={{
                                                width: '100%',
                                                maxWidth: 190,
                                                height: 210,
                                                objectFit: 'cover',
                                                borderRadius: 2,
                                                border: 1,
                                                borderColor: 'divider',
                                                bgcolor: 'background.paper',
                                            }}
                                        />
                                    </Box>

                                    <Box
                                        sx={{
                                            p: 2.5,
                                            borderRadius: 3,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            boxShadow: 1,
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                                            Contact Details
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1.2 }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    minWidth: 0,
                                                    px: 1.25,
                                                    py: 0.75,
                                                    borderRadius: 2,
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.default',
                                                }}
                                            >
                                                <LocationOnOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Tooltip
                                                    title={locationText || ''}
                                                    placement="top"
                                                    arrow
                                                    disableHoverListener={!locationText || locationText === 'N/A'}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{
                                                            color: 'text.primary',
                                                            minWidth: 0,
                                                            flex: 1,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {locationText}
                                                    </Typography>
                                                </Tooltip>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    minWidth: 0,
                                                    px: 1.25,
                                                    py: 0.75,
                                                    borderRadius: 2,
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.default',
                                                }}
                                            >
                                                <PhoneOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Typography variant="body2" sx={{ color: 'text.primary' }}>
                                                    {phoneText}
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    minWidth: 0,
                                                    px: 1.25,
                                                    py: 0.75,
                                                    borderRadius: 2,
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    bgcolor: 'background.default',
                                                }}
                                            >
                                                <EmailOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                                                <Tooltip
                                                    title={emailText || ''}
                                                    placement="top"
                                                    arrow
                                                    disableHoverListener={!emailText || emailText === 'N/A'}
                                                >
                                                    <Typography
                                                        variant="body2"
                                                        noWrap
                                                        sx={{
                                                            color: 'text.primary',
                                                            minWidth: 0,
                                                            flex: 1,
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                        }}
                                                    >
                                                        {emailText}
                                                    </Typography>
                                                </Tooltip>
                                            </Box>
                                        </Box>
                                    </Box>

                                    <Box
                                        sx={{
                                            p: 2.5,
                                            borderRadius: 3,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            boxShadow: 1,
                                        }}
                                    >
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                            Skills
                                        </Typography>
                                        {skillList.length ? (
                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gap: 0.6,
                                                    maxHeight: skillList.length > 4 ? 120 : 'none',
                                                    overflowY: skillList.length > 4 ? 'auto' : 'visible',
                                                    pr: skillList.length > 4 ? 0.5 : 0,
                                                }}
                                            >
                                                {skillList.map((skill) => (
                                                    <Typography key={skill} variant="body2" sx={{ color: 'text.secondary' }}>
                                                        {skill}
                                                    </Typography>
                                                ))}
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">
                                                No skills listed.
                                            </Typography>
                                        )}
                                    </Box>
                                </Box>
                            </Box>

                            <Box
                                sx={{
                                    pl: { sm: 2, md: 3 },
                                    minWidth: 0,
                                }}
                            >
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                    <Box
                                        sx={{
                                            p: 3,
                                            borderRadius: 3,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: 'divider',
                                            boxShadow: 1,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                mb: 2,
                                                flexWrap: 'wrap',
                                                gap: 1.5,
                                            }}
                                        >
                                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                                Applications
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexWrap: 'wrap', ml: 'auto' }}>
                                                {applicationRows.length ? (
                                                    <Autocomplete
                                                        size="small"
                                                        options={applicationFilterOptions}
                                                        value={selectedApplicationOption}
                                                        inputValue={displayedApplicationJobInputValue}
                                                        onOpen={() => {
                                                            setApplicationJobAutocompleteOpen(true);
                                                            if (selectedApplicationOption) {
                                                                setApplicationJobSearchInput(selectedApplicationOption.label);
                                                            }
                                                        }}
                                                        onClose={() => {
                                                            setApplicationJobAutocompleteOpen(false);
                                                        }}
                                                        autoHighlight
                                                        openOnFocus
                                                        clearOnEscape
                                                        selectOnFocus
                                                        handleHomeEndKeys
                                                        clearOnBlur={false}
                                                        getOptionLabel={(option) => option?.label || ''}
                                                        isOptionEqualToValue={(option, value) => option?.value === value?.value}
                                                        noOptionsText="No jobs found"
                                                        filterOptions={(options, state) => {
                                                            const query = state.inputValue.trim().toLowerCase();
                                                            if (!query) return options;
                                                            return options.filter((option) => option.label.toLowerCase().includes(query));
                                                        }}
                                                        onInputChange={(_, newInputValue, reason) => {
                                                            if (reason === 'reset') {
                                                                setApplicationJobSearchInput(newInputValue || '');
                                                                return;
                                                            }
                                                            if (reason === 'clear') {
                                                                setApplicationJobSearchInput('');
                                                                return;
                                                            }
                                                            setApplicationJobSearchInput(newInputValue);
                                                        }}
                                                        onChange={(_, option) => {
                                                            setSelectedApplicationJobId(option?.value || '');
                                                            setApplicationJobSearchInput(option?.label || '');
                                                        }}
                                                        renderOption={(props, option) => (
                                                            <li {...props} style={{ fontSize: '0.84rem', cursor: 'pointer' }}>
                                                                {option.label}
                                                            </li>
                                                        )}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Job"
                                                                placeholder={selectedApplicationOption ? '' : 'Search jobs'}
                                                                inputProps={{
                                                                    ...params.inputProps,
                                                                    title: selectedApplicationOption?.label || '',
                                                                }}
                                                            />
                                                        )}
                                                        sx={{
                                                            minWidth: { xs: '100%', sm: 170 },
                                                            maxWidth: { xs: '100%', sm: 210 },
                                                            '& .MuiOutlinedInput-root': {
                                                                borderRadius: 2,
                                                                bgcolor: 'transparent',
                                                                height: 36,
                                                                '& .MuiOutlinedInput-notchedOutline': {
                                                                    borderColor: alpha(theme.palette.primary.main, 0.5),
                                                                },
                                                                '&:hover': {
                                                                    bgcolor: 'transparent',
                                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                                        borderColor: 'primary.main',
                                                                    },
                                                                },
                                                                '&.Mui-focused': {
                                                                    bgcolor: 'transparent',
                                                                    '& .MuiOutlinedInput-notchedOutline': {
                                                                        borderColor: 'primary.main',
                                                                    },
                                                                },
                                                            },
                                                            '& .MuiInputLabel-root': {
                                                                fontSize: '0.8rem',
                                                                color: alpha(theme.palette.primary.main, 0.68),
                                                            },
                                                            '& .MuiInputLabel-root.Mui-focused': {
                                                                color: 'primary.main',
                                                            },
                                                            '& .MuiAutocomplete-input': {
                                                                py: '2.5px !important',
                                                                pr: '0 !important',
                                                                color: 'primary.main',
                                                                fontFamily: theme.typography.button.fontFamily,
                                                                fontSize: '0.78rem',
                                                                fontWeight: theme.typography.button.fontWeight,
                                                                lineHeight: 1.2,
                                                                letterSpacing: theme.typography.button.letterSpacing,
                                                                textTransform: theme.typography.button.textTransform,
                                                                minWidth: '0 !important',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            },
                                                            '& .MuiAutocomplete-input::placeholder': {
                                                                color: alpha(theme.palette.primary.main, 0.78),
                                                                fontFamily: theme.typography.button.fontFamily,
                                                                fontSize: '0.78rem',
                                                                fontWeight: theme.typography.button.fontWeight,
                                                                letterSpacing: theme.typography.button.letterSpacing,
                                                                textTransform: theme.typography.button.textTransform,
                                                                opacity: 1,
                                                            },
                                                            '& .MuiAutocomplete-inputRoot': {
                                                                pr: '58px !important',
                                                            },
                                                            '& .MuiAutocomplete-endAdornment': {
                                                                right: 6,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.1,
                                                            },
                                                            '& .MuiAutocomplete-clearIndicator, & .MuiAutocomplete-popupIndicator': {
                                                                p: '2px',
                                                                color: 'primary.main',
                                                            },
                                                        }}
                                                    />
                                                ) : null}
                                                <MUIButton
                                                    size="small"
                                                    variant="outlined"
                                                    startIcon={<AddRoundedIcon fontSize="small" />}
                                                    sx={{ borderRadius: 2 }}
                                                    onClick={handleApplyToJobClick}
                                                >
                                                    Add to Job
                                                </MUIButton>
                                            </Box>
                                        </Box>

                                        {applicationRows.length ? (
                                            <Box sx={{ display: 'grid', gap: 1.2 }}>
                                                <Box sx={{ display: 'grid', gap: 1.2 }}>
                                                    {visibleApplicationRows.map(({ job, ats }) => {
                                                        const appliedAt =
                                                            ats?.createdAt ||
                                                            ats?.updatedAt ||
                                                            job?.createdAt ||
                                                            job?.updatedAt;
                                                        const stageColumns = buildStageInterviewColumns(ats);
                                                        const { chipLabel, statusLabel } = getStageSnapshot(ats, stageColumns);
                                                        const applicationRelevancyScore = getApplicationRelevancyScore(ats);
                                                        const displayScore = Number.isFinite(applicationRelevancyScore)
                                                            ? Math.max(0, Math.min(100, applicationRelevancyScore))
                                                            : 0;
                                                        const scoreText = Number.isFinite(applicationRelevancyScore)
                                                            ? `${displayScore}%`
                                                            : 'N/A';
                                                        const companyName =
                                                            job?.company?.name ||
                                                            job?.company?.title ||
                                                            job?.companyName ||
                                                            job?.internalTitle ||
                                                            '';
                                                        const rowKey = String(ats?._id || job?._id || job?.id || job?.title);
                                                        const isApplicationExpanded =
                                                            expandedApplicationRowKey === rowKey ||
                                                            (expandedApplicationRowKey === null &&
                                                                Boolean(effectiveSelectedApplicationJobId) &&
                                                                visibleApplicationRows.length === 1);
                                                        const hasExpandableStages = stageColumns.length > 0;
                                                        const toggleApplicationAccordion = () => {
                                                            if (!hasExpandableStages) return;
                                                            setExpandedApplicationRowKey((current) => (
                                                                current === rowKey ? null : rowKey
                                                            ));
                                                        };
                                                        return (
                                                            <Accordion
                                                                key={rowKey}
                                                                disableGutters
                                                                expanded={hasExpandableStages ? isApplicationExpanded : false}
                                                                onChange={hasExpandableStages ? (_, expanded) => {
                                                                    setExpandedApplicationRowKey(expanded ? rowKey : null);
                                                                } : undefined}
                                                                TransitionProps={hasExpandableStages ? {
                                                                    timeout: {
                                                                        enter: 180,
                                                                        exit: 140,
                                                                    },
                                                                    mountOnEnter: true,
                                                                    unmountOnExit: true,
                                                                } : undefined}
                                                                sx={{
                                                                    borderRadius: 2.5,
                                                                    overflow: 'hidden',
                                                                    backgroundColor: 'background.default',
                                                                    border: 1,
                                                                    borderColor: 'divider',
                                                                    boxShadow: 1,
                                                                    transition: theme.transitions.create(
                                                                        ['box-shadow', 'border-color', 'transform'],
                                                                        { duration: theme.transitions.duration.shorter }
                                                                    ),
                                                                    '&:hover': hasExpandableStages ? {
                                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.28 : 0.2),
                                                                        boxShadow: isDark
                                                                            ? '0 10px 24px rgba(0, 0, 0, 0.22)'
                                                                            : '0 12px 26px rgba(15, 23, 42, 0.08)',
                                                                    } : undefined,
                                                                    '&::before': {
                                                                        display: 'none',
                                                                    },
                                                                    '&.Mui-expanded': {
                                                                        mt: 0,
                                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.26 : 0.18),
                                                                        boxShadow: isDark
                                                                            ? '0 12px 28px rgba(0, 0, 0, 0.24)'
                                                                            : '0 14px 28px rgba(15, 23, 42, 0.09)',
                                                                    },
                                                                }}
                                                            >
                                                                <AccordionSummary
                                                                    expandIcon={hasExpandableStages ? (
                                                                        <Box
                                                                            data-application-accordion-trigger="icon"
                                                                            onClick={(event) => {
                                                                                event.preventDefault();
                                                                                event.stopPropagation();
                                                                                toggleApplicationAccordion();
                                                                            }}
                                                                            sx={{
                                                                                width: 26,
                                                                                height: 26,
                                                                                borderRadius: '50%',
                                                                                display: 'grid',
                                                                                placeItems: 'center',
                                                                                cursor: 'pointer',
                                                                                transition: theme.transitions.create(
                                                                                    ['background-color', 'color'],
                                                                                    { duration: theme.transitions.duration.shorter }
                                                                                ),
                                                                                '&:hover': {
                                                                                    color: 'primary.main',
                                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08),
                                                                                },
                                                                            }}
                                                                        >
                                                                            <ExpandMoreIcon fontSize="small" />
                                                                        </Box>
                                                                    ) : null}
                                                                    onClick={hasExpandableStages ? (event) => {
                                                                        const trigger = event.target.closest('[data-application-accordion-trigger="content"]');
                                                                        if (!trigger) return;
                                                                        event.preventDefault();
                                                                        toggleApplicationAccordion();
                                                                    } : undefined}
                                                                    onKeyDown={hasExpandableStages ? (event) => {
                                                                        if (
                                                                            event.target === event.currentTarget &&
                                                                            (event.key === 'Enter' || event.key === ' ')
                                                                        ) {
                                                                            event.preventDefault();
                                                                            toggleApplicationAccordion();
                                                                        }
                                                                    } : undefined}
                                                                    sx={{
                                                                        px: 1.5,
                                                                        py: 1.5,
                                                                        minHeight: 'unset',
                                                                        '& .MuiAccordionSummary-content': {
                                                                            m: 0,
                                                                            display: 'grid',
                                                                            gap: 1.15,
                                                                        },
                                                                        '& [data-application-accordion-trigger="content"]': hasExpandableStages ? {
                                                                            borderRadius: 1.75,
                                                                            transition: theme.transitions.create(
                                                                                ['background-color', 'box-shadow', 'transform'],
                                                                                { duration: theme.transitions.duration.shorter }
                                                                            ),
                                                                        } : undefined,
                                                                        '& [data-application-accordion-trigger="content"]:hover': hasExpandableStages ? {
                                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.04),
                                                                            boxShadow: isDark
                                                                                ? '0 6px 14px rgba(0, 0, 0, 0.18)'
                                                                                : '0 8px 18px rgba(15, 23, 42, 0.06)',
                                                                            transform: 'translateY(-1px)',
                                                                        } : undefined,
                                                                        '& .MuiAccordionSummary-expandIconWrapper': {
                                                                            color: 'text.secondary',
                                                                            alignSelf: 'flex-start',
                                                                            mt: { xs: 0.3, md: 0.6 },
                                                                            transition: theme.transitions.create(
                                                                                ['transform'],
                                                                                { duration: theme.transitions.duration.shorter }
                                                                            ),
                                                                        },
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            display: { xs: 'none', md: 'grid' },
                                                                            gridTemplateColumns: applicationGridColumns,
                                                                            columnGap: 2,
                                                                            alignItems: 'center',
                                                                            px: 0.25,
                                                                            minWidth: 0,
                                                                        }}
                                                                    >
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                        >
                                                                            Job
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                        >
                                                                            Title
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                        >
                                                                            Latest Progressed Stage
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                        >
                                                                            Relevancy with Job
                                                                        </Typography>
                                                                        <Typography
                                                                            variant="caption"
                                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                        >
                                                                            Application Date
                                                                        </Typography>
                                                                        <Box />
                                                                    </Box>

                                                                    <Box
                                                                        sx={{
                                                                            display: 'grid',
                                                                            gridTemplateColumns: {
                                                                                xs: '1fr',
                                                                                ...applicationGridColumns,
                                                                            },
                                                                            alignItems: { xs: 'center', md: 'start' },
                                                                            columnGap: 2,
                                                                            rowGap: { xs: 1.2, md: 0 },
                                                                            minWidth: 0,
                                                                        }}
                                                                    >
                                                                        <Box
                                                                            data-application-accordion-trigger="content"
                                                                            sx={{
                                                                                width: 'fit-content',
                                                                                cursor: hasExpandableStages ? 'pointer' : 'default',
                                                                            }}
                                                                        >
                                                                            <Avatar
                                                                                src={defaultAvatar}
                                                                                sx={{
                                                                                    width: 32,
                                                                                    height: 32,
                                                                                    bgcolor: alpha(theme.palette.grey[400], isDark ? 0.28 : 0.18),
                                                                                }}
                                                                            />
                                                                        </Box>

                                                                        <Box
                                                                            data-application-accordion-trigger="content"
                                                                            sx={{
                                                                                minWidth: 0,
                                                                                width: 'fit-content',
                                                                                maxWidth: '100%',
                                                                                cursor: hasExpandableStages ? 'pointer' : 'default',
                                                                            }}
                                                                        >
                                                                            <NavLink
                                                                                to={`/jobs/${job._id}`}
                                                                                onClick={(event) => event.stopPropagation()}
                                                                                style={{
                                                                                    textDecoration: 'none',
                                                                                    color: 'inherit',
                                                                                }}
                                                                            >
                                                                                <Typography
                                                                                    variant="subtitle2"
                                                                                    sx={{
                                                                                        fontWeight: 700,
                                                                                        fontSize: '0.9rem',
                                                                                        lineHeight: 1.35,
                                                                                        whiteSpace: 'nowrap',
                                                                                        overflow: 'hidden',
                                                                                        textOverflow: 'ellipsis',
                                                                                    }}
                                                                                >
                                                                                    {renderJobTitle(job)}
                                                                                </Typography>
                                                                            </NavLink>
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{ color: 'text.secondary', fontSize: '0.72rem' }}
                                                                            >
                                                                                {companyName || 'Company'}
                                                                            </Typography>
                                                                        </Box>

                                                                        <Box
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems: 'flex-start',
                                                                                gap: 0.8,
                                                                                minWidth: 0,
                                                                                width: 'fit-content',
                                                                                maxWidth: '100%',
                                                                            }}
                                                                        >
                                                                            <Chip
                                                                                size="small"
                                                                                label={chipLabel}
                                                                                sx={{
                                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                                                                    color: 'primary.main',
                                                                                    fontWeight: 700,
                                                                                    height: 22,
                                                                                    fontSize: '0.68rem',
                                                                                    cursor: 'default',
                                                                                }}
                                                                            />
                                                                            <Typography
                                                                                variant="body2"
                                                                                sx={{
                                                                                    color: 'text.secondary',
                                                                                    cursor: 'pointer',
                                                                                    fontSize: '0.82rem',
                                                                                    lineHeight: 1.35,
                                                                                    minWidth: 0,
                                                                                    flex: 1,
                                                                                    display: '-webkit-box',
                                                                                    WebkitLineClamp: 2,
                                                                                    WebkitBoxOrient: 'vertical',
                                                                                    overflow: 'hidden',
                                                                                    borderRadius: 1.25,
                                                                                    px: 0.35,
                                                                                    mx: -0.35,
                                                                                    transition: theme.transitions.create(
                                                                                        ['background-color', 'color'],
                                                                                        { duration: theme.transitions.duration.shorter }
                                                                                    ),
                                                                                    '&:hover': {
                                                                                        color: 'primary.main',
                                                                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.05),
                                                                                    },
                                                                                }}
                                                                                onClick={(event) => {
                                                                                    event.stopPropagation();
                                                                                    openProgressForJob(job);
                                                                                }}
                                                                            >
                                                                                {statusLabel}
                                                                            </Typography>
                                                                        </Box>

                                                                        <Box
                                                                            data-application-accordion-trigger="content"
                                                                            sx={{
                                                                                display: 'flex',
                                                                                alignItems: 'center',
                                                                                gap: 1,
                                                                                width: '100%',
                                                                                maxWidth: 150,
                                                                                cursor: hasExpandableStages ? 'pointer' : 'default',
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{ color: 'primary.main', fontWeight: 700 }}
                                                                            >
                                                                                {scoreText}
                                                                            </Typography>
                                                                            <Box
                                                                                sx={{
                                                                                    flex: 1,
                                                                                    height: 6,
                                                                                    borderRadius: 999,
                                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                                                                    overflow: 'hidden',
                                                                                }}
                                                                            >
                                                                                <Box
                                                                                    sx={{
                                                                                        width: `${displayScore}%`,
                                                                                        height: '100%',
                                                                                        bgcolor: 'primary.main',
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        </Box>

                                                                        <Box
                                                                            data-application-accordion-trigger="content"
                                                                            sx={{
                                                                                width: 'fit-content',
                                                                                cursor: hasExpandableStages ? 'pointer' : 'default',
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                variant="caption"
                                                                                sx={{ color: 'text.secondary', fontSize: '0.74rem', lineHeight: 1.35 }}
                                                                            >
                                                                                {formatDate(appliedAt)}
                                                                            </Typography>
                                                                        </Box>

                                                                        <IconButton
                                                                            component="span"
                                                                            aria-label={`Open actions for ${getJobTitleLabel(job)}`}
                                                                            size="small"
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                handleOpenActionsMenu(event, job);
                                                                            }}
                                                                            sx={{ justifySelf: 'end' }}
                                                                        >
                                                                            <MoreHorizIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Box>
                                                                </AccordionSummary>

                                                                {hasExpandableStages && isApplicationExpanded ? (
                                                                    <AccordionDetails sx={{ px: 1.5, pt: 0, pb: 1.5 }}>
                                                                        <Box
                                                                            sx={{
                                                                                pt: 1.75,
                                                                                borderTop: 1,
                                                                                borderTopColor: alpha(theme.palette.divider, 0.72),
                                                                                display: 'grid',
                                                                                gap: 1.2,
                                                                            }}
                                                                        >
                                                                            <Box
                                                                                sx={{
                                                                                    display: 'flex',
                                                                                    justifyContent: 'space-between',
                                                                                    alignItems: 'center',
                                                                                    gap: 1,
                                                                                    flexWrap: 'wrap',
                                                                                }}
                                                                            >
                                                                                <Typography
                                                                                    variant="caption"
                                                                                    sx={{
                                                                                        color: 'text.secondary',
                                                                                        textTransform: 'uppercase',
                                                                                        letterSpacing: '0.08em',
                                                                                    }}
                                                                                >
                                                                                    Interview Stages
                                                                                </Typography>
                                                                                {interviewViewsLoading ? (
                                                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                                        Loading latest interview scores...
                                                                                    </Typography>
                                                                                ) : null}
                                                                            </Box>

                                                                            <Box sx={{ display: 'grid', gap: 1.1 }}>
                                                                                {stageColumns.map((stage, stageIndex) => {
                                                                                    const visual = getStageVisualMeta(stage.status);
                                                                                    const stageCards = Array.isArray(stage.cards) ? stage.cards : [];
                                                                                    const stageSchedule = stage.linkedSchedule || null;
                                                                                    const feedbackSchedule = stage.feedbackSchedule || stageSchedule || null;
                                                                                    const hasStageFeedbackAction = Boolean(
                                                                                        feedbackSchedule?._id ||
                                                                                        feedbackSchedule?.id ||
                                                                                        stage.remark
                                                                                    );
                                                                                    const hasAttemptCards = stageCards.length > 0;
                                                                                    const isCardsScrollable = stageCards.length > 1;
                                                                                    const attemptSummaryLabel = hasAttemptCards
                                                                                        ? `${stageCards.length} attempted interview${stageCards.length === 1 ? '' : 's'}`
                                                                                        : 'No attempted interviews yet';
                                                                                    const hasNextStage = stageIndex < stageColumns.length - 1;
                                                                                    const openStageFeedback = () => {
                                                                                        openInterviewInsightModal(
                                                                                            buildInterviewInsightPayload(feedbackSchedule, {
                                                                                                job,
                                                                                                stageTitle: stage.title,
                                                                                                stageRemarkFeedback: stage.remark,
                                                                                                stageStatus: stage.status,
                                                                                            }),
                                                                                            'feedback'
                                                                                        );
                                                                                    };
                                                                                    return (
                                                                                        <Box
                                                                                            key={`${rowKey}-${stage.id}`}
                                                                                            sx={{
                                                                                                display: 'grid',
                                                                                                gridTemplateColumns: {
                                                                                                    xs: '1fr',
                                                                                                    md: 'minmax(0, 1fr) 248px',
                                                                                                },
                                                                                                rowGap: 1.1,
                                                                                                columnGap: { xs: 1.1, md: 1.9 },
                                                                                                alignItems: 'stretch',
                                                                                            }}
                                                                                        >
                                                                                            <Box
                                                                                                sx={{
                                                                                                    display: 'flex',
                                                                                                    gap: 0.95,
                                                                                                    minWidth: 0,
                                                                                                }}
                                                                                            >
                                                                                                <Box
                                                                                                    sx={{
                                                                                                        width: 20,
                                                                                                        display: 'flex',
                                                                                                        flexDirection: 'column',
                                                                                                        alignItems: 'center',
                                                                                                        flexShrink: 0,
                                                                                                    }}
                                                                                                >
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            width: 14,
                                                                                                            height: 14,
                                                                                                            borderRadius: '50%',
                                                                                                            bgcolor: visual.dotColor,
                                                                                                            boxShadow: `0 0 0 4px ${alpha(theme.palette.background.paper, isDark ? 0.3 : 0.9)}`,
                                                                                                        }}
                                                                                                    />
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            width: 2,
                                                                                                            flex: hasNextStage ? 1 : 0,
                                                                                                            minHeight: hasNextStage ? 30 : 4,
                                                                                                            mt: 0.45,
                                                                                                            borderRadius: 999,
                                                                                                            bgcolor: hasNextStage ? visual.lineColor : 'transparent',
                                                                                                        }}
                                                                                                    />
                                                                                                </Box>

                                                                                                <Box sx={{ minWidth: 0, pt: 0.05 }}>
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'flex-start',
                                                                                                            gap: 0.7,
                                                                                                            minWidth: 0,
                                                                                                        }}
                                                                                                    >
                                                                                                        {hasStageFeedbackAction ? (
                                                                                                            <Button
                                                                                                                size="small"
                                                                                                                variant="text"
                                                                                                                startIcon={<RecordVoiceOverIcon sx={{ fontSize: 13 }} />}
                                                                                                                onClick={openStageFeedback}
                                                                                                                sx={{
                                                                                                                    minWidth: 0,
                                                                                                                    flexShrink: 0,
                                                                                                                    alignSelf: 'center',
                                                                                                                    px: 0.9,
                                                                                                                    py: 0.2,
                                                                                                                    borderRadius: 999,
                                                                                                                    textTransform: 'none',
                                                                                                                    fontWeight: 700,
                                                                                                                    fontSize: '0.7rem',
                                                                                                                    lineHeight: 1.2,
                                                                                                                    color: 'primary.main',
                                                                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.06),
                                                                                                                    '& .MuiButton-startIcon': {
                                                                                                                        mr: 0.45,
                                                                                                                        ml: 0,
                                                                                                                    },
                                                                                                                    '&:hover': {
                                                                                                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                                                                                                                    },
                                                                                                                }}
                                                                                                            >
                                                                                                                Feedback
                                                                                                            </Button>
                                                                                                        ) : null}
                                                                                                        <Typography
                                                                                                            variant="body2"
                                                                                                            sx={{
                                                                                                                flex: 1,
                                                                                                                minWidth: 0,
                                                                                                                fontWeight: 700,
                                                                                                                fontSize: '0.94rem',
                                                                                                                lineHeight: 1.45,
                                                                                                                color: 'text.primary',
                                                                                                                display: '-webkit-box',
                                                                                                                WebkitLineClamp: 2,
                                                                                                                WebkitBoxOrient: 'vertical',
                                                                                                                overflow: 'hidden',
                                                                                                            }}
                                                                                                        >
                                                                                                            {stage.title}
                                                                                                        </Typography>
                                                                                                    </Box>
                                                                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.6, mt: 0.65 }}>
                                                                                                        <Chip
                                                                                                            size="small"
                                                                                                            label={stage.status}
                                                                                                            sx={{
                                                                                                                bgcolor: visual.statusBg,
                                                                                                                color: visual.statusColor,
                                                                                                                fontWeight: 700,
                                                                                                                height: 24,
                                                                                                                maxWidth: '100%',
                                                                                                                '& .MuiChip-label': {
                                                                                                                    px: 0.9,
                                                                                                                    fontSize: '0.74rem',
                                                                                                                    overflow: 'hidden',
                                                                                                                    textOverflow: 'ellipsis',
                                                                                                                },
                                                                                                            }}
                                                                                                        />
                                                                                                        {stageSchedule?.interviewType ? (
                                                                                                            <Typography
                                                                                                                variant="caption"
                                                                                                                sx={{
                                                                                                                    color: 'text.secondary',
                                                                                                                    alignSelf: 'center',
                                                                                                                    fontSize: '0.74rem',
                                                                                                                }}
                                                                                                            >
                                                                                                                {stageSchedule.interviewType}
                                                                                                            </Typography>
                                                                                                        ) : null}
                                                                                                    </Box>
                                                                                                </Box>
                                                                                            </Box>

                                                                                            <Box
                                                                                                sx={{
                                                                                                    minHeight: 104,
                                                                                                    borderRadius: 3,
                                                                                                    border: 1,
                                                                                                    borderColor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                                                                                                    bgcolor: alpha(theme.palette.background.paper, isDark ? 0.28 : 0.74),
                                                                                                    boxShadow: isDark
                                                                                                        ? 'inset 0 1px 0 rgba(255, 255, 255, 0.02)'
                                                                                                        : 'inset 0 1px 0 rgba(255, 255, 255, 0.72)',
                                                                                                    display: 'grid',
                                                                                                    gap: 0.9,
                                                                                                    px: 1,
                                                                                                    py: 1,
                                                                                                }}
                                                                                            >
                                                                                                <Box
                                                                                                    sx={{
                                                                                                        display: 'flex',
                                                                                                        alignItems: 'center',
                                                                                                        justifyContent: 'space-between',
                                                                                                        gap: 1,
                                                                                                        minHeight: 20,
                                                                                                        px: 0.15,
                                                                                                    }}
                                                                                                >
                                                                                                    <Typography
                                                                                                        variant="caption"
                                                                                                        sx={{
                                                                                                            color: hasAttemptCards ? 'primary.main' : 'text.secondary',
                                                                                                            fontWeight: 700,
                                                                                                            fontSize: '0.73rem',
                                                                                                            letterSpacing: '0.02em',
                                                                                                        }}
                                                                                                    >
                                                                                                        {attemptSummaryLabel}
                                                                                                    </Typography>
                                                                                                    {isCardsScrollable ? (
                                                                                                        <Box
                                                                                                            sx={{
                                                                                                                display: 'flex',
                                                                                                                alignItems: 'center',
                                                                                                                gap: 0.35,
                                                                                                                color: 'text.secondary',
                                                                                                                flexShrink: 0,
                                                                                                            }}
                                                                                                        >
                                                                                                            <MoreHorizIcon sx={{ fontSize: 16 }} />
                                                                                                            <Typography
                                                                                                                variant="caption"
                                                                                                                sx={{
                                                                                                                    fontWeight: 700,
                                                                                                                    fontSize: '0.68rem',
                                                                                                                    letterSpacing: '0.03em',
                                                                                                                }}
                                                                                                            >
                                                                                                                Scroll
                                                                                                            </Typography>
                                                                                                        </Box>
                                                                                                    ) : null}
                                                                                                </Box>

                                                                                                {hasAttemptCards ? (
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            display: 'flex',
                                                                                                            gap: 1,
                                                                                                            maxWidth: '100%',
                                                                                                            overflowX: 'auto',
                                                                                                            overflowY: 'hidden',
                                                                                                            pb: 0.55,
                                                                                                            pr: isCardsScrollable ? 0.45 : 0,
                                                                                                            pl: 0.15,
                                                                                                            alignItems: 'stretch',
                                                                                                            scrollSnapType: 'x proximity',
                                                                                                            scrollbarWidth: 'thin',
                                                                                                            '&::-webkit-scrollbar': {
                                                                                                                height: 7,
                                                                                                            },
                                                                                                            '&::-webkit-scrollbar-thumb': {
                                                                                                                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.32 : 0.18),
                                                                                                                borderRadius: 999,
                                                                                                            },
                                                                                                            '&::-webkit-scrollbar-track': {
                                                                                                                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                                                                                                                borderRadius: 999,
                                                                                                            },
                                                                                                        }}
                                                                                                    >
                                                                                                        {stageCards.map((attemptCard, attemptIndex) => {
                                                                                                            const attemptSchedule = attemptCard?.schedule || null;
                                                                                                            const isAttemptClickable = Boolean(attemptSchedule?._id || attemptSchedule?.id);
                                                                                                            const attemptScoreLabel = typeof attemptCard?.score === 'number'
                                                                                                                ? `${attemptCard.score}%`
                                                                                                                : '--';
                                                                                                            const shouldStretchAttemptCard = !isCardsScrollable;
                                                                                                            return (
                                                                                                                <Box
                                                                                                                    key={attemptCard?.id || `${stage.id}-attempt-${attemptIndex}`}
                                                                                                                    sx={{
                                                                                                                        minHeight: 86,
                                                                                                                        width: shouldStretchAttemptCard ? '100%' : { xs: 196, md: 188 },
                                                                                                                        minWidth: shouldStretchAttemptCard ? 0 : { xs: 196, md: 188 },
                                                                                                                        maxWidth: shouldStretchAttemptCard ? '100%' : { xs: 196, md: 188 },
                                                                                                                        flex: shouldStretchAttemptCard ? '1 1 auto' : '0 0 auto',
                                                                                                                        flexShrink: shouldStretchAttemptCard ? 1 : 0,
                                                                                                                        scrollSnapAlign: 'start',
                                                                                                                        borderRadius: 2.6,
                                                                                                                        border: 1,
                                                                                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.14),
                                                                                                                        bgcolor: theme.palette.background.paper,
                                                                                                                        boxShadow: isDark
                                                                                                                            ? '0 8px 18px rgba(0, 0, 0, 0.16)'
                                                                                                                            : '0 10px 22px rgba(15, 23, 42, 0.05)',
                                                                                                                        display: 'flex',
                                                                                                                        alignItems: 'center',
                                                                                                                        justifyContent: 'space-between',
                                                                                                                        gap: 1,
                                                                                                                        px: 1.15,
                                                                                                                        py: 1,
                                                                                                                    }}
                                                                                                                >
                                                                                                                    <Box sx={{ minWidth: 0 }}>
                                                                                                                        <Typography
                                                                                                                            variant="body2"
                                                                                                                            sx={{
                                                                                                                                fontWeight: 700,
                                                                                                                                fontSize: '0.88rem',
                                                                                                                                color: 'text.primary',
                                                                                                                                whiteSpace: 'nowrap',
                                                                                                                                overflow: 'hidden',
                                                                                                                                textOverflow: 'ellipsis',
                                                                                                                            }}
                                                                                                                        >
                                                                                                                            {attemptSchedule?.interviewType || `Interview Attempt ${attemptIndex + 1}`}
                                                                                                                        </Typography>
                                                                                                                        <Typography
                                                                                                                            variant="caption"
                                                                                                                            sx={{
                                                                                                                                display: 'block',
                                                                                                                                mt: 0.45,
                                                                                                                                color: 'text.secondary',
                                                                                                                                fontSize: '0.74rem',
                                                                                                                            }}
                                                                                                                        >
                                                                                                                            {attemptSchedule?.startAt
                                                                                                                                ? formatDate(attemptSchedule.startAt)
                                                                                                                                : attemptSchedule?.createdAt
                                                                                                                                    ? formatDate(attemptSchedule.createdAt)
                                                                                                                                    : 'Attempt recorded'}
                                                                                                                        </Typography>
                                                                                                                    </Box>

                                                                                                                    <Box
                                                                                                                        component={isAttemptClickable ? 'button' : 'div'}
                                                                                                                        type={isAttemptClickable ? 'button' : undefined}
                                                                                                                        aria-label={isAttemptClickable ? `Open report for ${attemptSchedule?.interviewType || 'interview'}` : undefined}
                                                                                                                        sx={{
                                                                                                                            width: 56,
                                                                                                                            height: 56,
                                                                                                                            borderRadius: '50%',
                                                                                                                            border: 2,
                                                                                                                            borderColor: alpha(theme.palette.primary.main, isDark ? 0.32 : 0.2),
                                                                                                                            display: 'grid',
                                                                                                                            placeItems: 'center',
                                                                                                                            flexShrink: 0,
                                                                                                                            p: 0,
                                                                                                                            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.42 : 0.92),
                                                                                                                            cursor: isAttemptClickable ? 'pointer' : 'default',
                                                                                                                            transition: 'transform 160ms ease, box-shadow 160ms ease, background-color 160ms ease',
                                                                                                                            '&:hover': isAttemptClickable ? {
                                                                                                                                transform: 'translateY(-1px)',
                                                                                                                                boxShadow: 3,
                                                                                                                                backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.1 : 0.05),
                                                                                                                            } : undefined,
                                                                                                                            '&:focus-visible': isAttemptClickable ? {
                                                                                                                                outline: `2px solid ${alpha(theme.palette.primary.main, isDark ? 0.7 : 0.42)}`,
                                                                                                                                outlineOffset: 2,
                                                                                                                            } : undefined,
                                                                                                                        }}
                                                                                                                        onClick={isAttemptClickable ? () => {
                                                                                                                            openInterviewInsightModal(
                                                                                                                                buildInterviewInsightPayload(attemptSchedule, {
                                                                                                                                    job,
                                                                                                                                    stageTitle: stage.title,
                                                                                                                                    fallbackScore: attemptCard.score,
                                                                                                                                }),
                                                                                                                                'report'
                                                                                                                            );
                                                                                                                        } : undefined}
                                                                                                                    >
                                                                                                                        <Typography
                                                                                                                            variant="body1"
                                                                                                                            sx={{
                                                                                                                                fontWeight: 800,
                                                                                                                                fontSize: typeof attemptCard?.score === 'number' ? '0.94rem' : '0.8rem',
                                                                                                                                color: 'primary.main',
                                                                                                                            }}
                                                                                                                        >
                                                                                                                            {attemptScoreLabel}
                                                                                                                        </Typography>
                                                                                                                    </Box>
                                                                                                                </Box>
                                                                                                            );
                                                                                                        })}
                                                                                                    </Box>
                                                                                                ) : (
                                                                                                    <Box
                                                                                                        sx={{
                                                                                                            minHeight: 72,
                                                                                                            borderRadius: 2.4,
                                                                                                            border: 1,
                                                                                                            borderColor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
                                                                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.05 : 0.025),
                                                                                                            display: 'flex',
                                                                                                            alignItems: 'center',
                                                                                                            justifyContent: 'center',
                                                                                                            px: 2,
                                                                                                        }}
                                                                                                    >
                                                                                                        <Typography
                                                                                                            variant="caption"
                                                                                                            sx={{
                                                                                                                color: 'text.disabled',
                                                                                                                fontWeight: 700,
                                                                                                                fontSize: '0.76rem',
                                                                                                                letterSpacing: '0.02em',
                                                                                                            }}
                                                                                                        >
                                                                                                            No score yet
                                                                                                        </Typography>
                                                                                                    </Box>
                                                                                                )}
                                                                                            </Box>
                                                                                        </Box>
                                                                                    );
                                                                                })}
                                                                            </Box>
                                                                        </Box>
                                                                    </AccordionDetails>
                                                                ) : null}
                                                            </Accordion>
                                                        );
                                                    })}
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No applications yet.
                                            </Typography>
                                        )}

                                        {hasHiddenApplications ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                                                <MUIButton
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{ borderRadius: 2 }}
                                                    onClick={() => setShowAllApplications(true)}
                                                >
                                                    Show More
                                                </MUIButton>
                                            </Box>
                                        ) : null}

                                        <Menu
                                            anchorEl={actionsAnchorEl}
                                            open={actionsMenuOpen}
                                            onClose={handleCloseActionsMenu}
                                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                                        >
                                            <MenuItem
                                                disabled={!actionsJob?._id}
                                                onClick={() => {
                                                    if (!actionsJob?._id) return;
                                                    handleCloseActionsMenu();
                                                    openStartCallModal(actionsJob);
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <ScheduleSendOutlined fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary="Start AI Call" />
                                            </MenuItem>
                                            <MenuItem
                                                disabled={!actionsJob?._id}
                                                onClick={() => {
                                                    if (!actionsJob?._id) return;
                                                    handleCloseActionsMenu();
                                                    navigate(`/ats/?cid=${candidate._id}&jid=${actionsJob._id}`);
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <TrackChangesIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary="Track Interviews" />
                                            </MenuItem>
                                            <MenuItem
                                                disabled={!actionsJob?._id}
                                                onClick={() => {
                                                    if (!actionsJob?._id) return;
                                                    handleCloseActionsMenu();
                                                    handleOpenTranscript(actionsJob);
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <DescriptionIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary="Transcript" />
                                            </MenuItem>
                                            <MenuItem
                                                disabled={!actionsJob?._id}
                                                onClick={() => {
                                                    if (!actionsJob?._id) return;
                                                    handleCloseActionsMenu();
                                                    handleOpenAudio(actionsJob);
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <RecordVoiceOverIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary="Audio" />
                                            </MenuItem>
                                            <MenuItem
                                                disabled={!actionsJob?._id}
                                                onClick={() => {
                                                    if (!actionsJob?._id) return;
                                                    handleCloseActionsMenu();
                                                    downloadTrackerForJob(actionsJob);
                                                }}
                                            >
                                                <ListItemIcon>
                                                    <DownloadIcon fontSize="small" />
                                                </ListItemIcon>
                                                <ListItemText primary="Download Tracker" />
                                            </MenuItem>
                                        </Menu>
                                    </Box>


                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </CardContent>

                <MUIArchiveCnfModal
                    open={deleteModalOpen}
                    onClose={() => setDeleteModal(false)}
                    onConfirm={handleArchive}
                    itemName={`${candidate.firstName} ${candidate.lastName}`}
                    variant="candidate"
                />

                <MUIModal
                    open={startCallModalOpen}
                    onClose={() => {
                        setStartCallModalOpen(false);
                        setStartCallJob(null);
                    }}
                    contentSx={{ p: 0, maxWidth: 'min(460px, 92vw)', overflow: 'hidden' }}
                >
                    <Box
                        sx={{
                            p: 3,
                            textAlign: 'center',
                            position: 'relative',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <IconButton
                            onClick={() => {
                                setStartCallModalOpen(false);
                                setStartCallJob(null);
                            }}
                            sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }}
                            size="small"
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>

                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
                            <Box
                                sx={{
                                    width: 88,
                                    height: 88,
                                    borderRadius: '50%',
                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.2 : 0.12),
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: 2,
                                }}
                            >
                                <RecordVoiceOverIcon sx={{ fontSize: 44, color: 'primary.main' }} />
                            </Box>
                        </Box>

                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            Start AI Call?
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                            Are you sure you want to start an AI call with {fullName} for {startCallJob?.title || 'this job'}?
                        </Typography>

                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                            <MUIButton
                                variant="outlined"
                                onClick={() => {
                                    setStartCallModalOpen(false);
                                    setStartCallJob(null);
                                }}
                            >
                                Cancel
                            </MUIButton>
                            <MUIButton
                                variant="contained"
                                onClick={handleStartAiCall}
                            >
                                Start Call
                            </MUIButton>
                        </Box>
                    </Box>
                </MUIModal>

                <MUIModal open={applyDialogOpen} onClose={() => setApplyDialogOpen(false)}>
                    <Box sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>
                        Assign 1 candidate
                    </Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={applyMulti}
                                onChange={e => { setApplyMulti(e.target.checked); setApplyPicked([]); }}
                            />
                        }
                        label="Enable multiple job selection"
                    />
                    <Autocomplete
                        multiple={applyMulti}
                        options={applyJobOptions}
                        value={applyMulti ? applyPicked : applyPicked[0] ?? null}
                        onChange={(_, value) => setApplyPicked(applyMulti ? value : value ? [value] : [])}
                        getOptionLabel={option => (typeof option === 'string' ? option : option.label)}
                        isOptionEqualToValue={(option, value) => option.value === (value?.value ?? value)}
                        renderInput={params => <TextField {...params} label="Job(s)" margin="normal" />}
                    />
                    {applyMulti && applyPicked.length > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {applyPicked.map(job => (
                                <Chip
                                    key={job.value}
                                    label={job.label}
                                    onDelete={() => setApplyPicked(applyPicked.filter(item => item.value !== job.value))}
                                />
                            ))}
                        </Box>
                    )}
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button onClick={() => setApplyDialogOpen(false)}>Cancel</Button>
                        <Button variant="contained" onClick={assignToJobs}>Assign</Button>
                    </Box>
                </MUIModal>

                <MUIModal open={showAudioModal} onClose={() => setShowAudioModal(false)}>
                    <Box
                        sx={{
                            bgcolor: 'background.paper',
                            borderRadius: 2,
                            p: 3,
                            minWidth: 350,
                        }}
                    >
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                mb: 2,
                            }}
                        >
                            <Typography variant="h6">Call Recording</Typography>
                            <Box>
                                {canDownloadAudio && resolvedAudioUrl && (
                                    <IconButton
                                        size="small"
                                        component="a"
                                        href={resolvedAudioUrl}
                                        download={downloadFileName}
                                        sx={{ mr: 1 }}
                                    >
                                        <DownloadIcon fontSize="small" />
                                    </IconButton>
                                )}
                                <IconButton
                                    onClick={() => setShowAudioModal(false)}
                                    size="small"
                                >
                                    <CloseIcon />
                                </IconButton>
                            </Box>

                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                            {resolvedAudioUrl ? (
                                <audio
                                    controls
                                    controlsList="nodownload"
                                    style={{ width: '100%' }}
                                >
                                    <source
                                        src={resolvedAudioUrl}
                                        type="audio/wav"
                                    />
                                    Your browser does not support the audio element.
                                </audio>
                            ) : (
                                <Typography variant="caption">
                                    The audio will be available only after the call has ended...
                                </Typography>
                            )}
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                            <Button onClick={() => setShowAudioModal(false)}>Close</Button>
                        </Box>
                    </Box>
                </MUIModal>

                <MUIModal
                    open={showProgressModal}
                    onClose={() => setShowProgressModal(false)}
                    contentSx={{
                        p: 0,
                        bgcolor: 'transparent',
                        boxShadow: 'none',
                        border: 'none',
                        overflow: 'visible',
                        width: 'auto',
                        maxWidth: 'none',
                        maxHeight: 'none',
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            width: 'min(560px, calc(100vw - 24px))',
                            maxWidth: 'calc(100vw - 24px)',
                            bgcolor: 'background.paper',
                            borderRadius: 3,
                            boxShadow: isDark
                                ? '0 22px 54px rgba(0, 0, 0, 0.38)'
                                : '0 20px 48px rgba(15, 23, 42, 0.14)',
                            overflow: 'visible',
                        }}
                    >
                        <IconButton
                            size="small"
                            onClick={() => setShowProgressModal(false)}
                            sx={{
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                zIndex: 2,
                                transform: 'translate(38%, -38%)',
                                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.92),
                                boxShadow: isDark
                                    ? '0 10px 24px rgba(0, 0, 0, 0.24)'
                                    : '0 10px 24px rgba(15, 23, 42, 0.08)',
                                border: 1,
                                borderColor: alpha(theme.palette.divider, 0.7),
                                '&:hover': {
                                    bgcolor: 'background.paper',
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>

                        <Box
                            sx={{
                                maxHeight: 'min(82vh, 720px)',
                                overflowY: 'auto',
                                borderRadius: 3,
                                p: { xs: 2, sm: 2.5 },
                            }}
                        >

                            <Box sx={{ mb: 1.5 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    Application Progress
                                </Typography>
                                {selectedJobProgress?.job ? (
                                    <Typography
                                        variant="body2"
                                        sx={{ mt: 0.45, color: 'text.secondary', lineHeight: 1.5 }}
                                    >
                                        {renderJobTitle(selectedJobProgress.job)}
                                    </Typography>
                                ) : null}
                            </Box>

                            <Box
                                sx={{
                                    px: { xs: 0.5, sm: 1 },
                                    py: 1.2,
                                    borderRadius: 2.5,
                                    border: 1,
                                    borderColor: alpha(theme.palette.divider, 0.8),
                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.2 : 0.45),
                                    overflowX: 'auto',
                                    scrollbarWidth: 'thin',
                                    '&::-webkit-scrollbar': {
                                        height: 6,
                                    },
                                    '&::-webkit-scrollbar-thumb': {
                                        backgroundColor: alpha(theme.palette.text.secondary, 0.3),
                                        borderRadius: 999,
                                    },
                                }}
                            >
                                <Stepper
                                    activeStep={activeIndex}
                                    alternativeLabel
                                    sx={{
                                        minWidth: stageRows.length > 3 ? stageRows.length * 110 : '100%',
                                        '& .MuiStepLabel-label': {
                                            mt: 0.75,
                                            fontSize: '0.78rem',
                                            color: 'text.secondary',
                                            lineHeight: 1.35,
                                        },
                                        '& .MuiStepLabel-label.Mui-active': {
                                            color: 'text.primary',
                                            fontWeight: 600,
                                        },
                                        '& .MuiStepLabel-label.Mui-completed': {
                                            color: 'text.primary',
                                        },
                                        '& .MuiStepConnector-line': {
                                            borderColor: alpha(theme.palette.divider, 0.9),
                                        },
                                        '& .MuiStepIcon-root': {
                                            fontSize: '1.4rem',
                                        },
                                    }}
                                >
                                    {stageRows.map((row, index) => (
                                        <Step
                                            key={row.id}
                                            onClick={() => setActiveIndex(index)}
                                            sx={{ cursor: 'pointer' }}
                                        >
                                            <StepLabel>{row.title}</StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            </Box>

                            {!stageRows.length && (
                                <Typography
                                    sx={{ textAlign: 'center', mt: 1.5, color: 'text.secondary' }}
                                >
                                    No application progress data found for this job yet.
                                </Typography>
                            )}

                            {activeStage && (
                                <Box
                                    sx={{
                                        mt: 1.25,
                                        borderRadius: 2.5,
                                        border: 1,
                                        borderColor: alpha(theme.palette.divider, 0.78),
                                        bgcolor: 'background.paper',
                                        p: { xs: 1.5, sm: 1.75 },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            justifyContent: 'space-between',
                                            gap: 1,
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography
                                                variant="subtitle1"
                                                sx={{
                                                    fontWeight: 700,
                                                    lineHeight: 1.35,
                                                    color: 'text.primary',
                                                }}
                                            >
                                                {activeStage.title}
                                            </Typography>
                                            <Typography
                                                variant="caption"
                                                sx={{ mt: 0.35, display: 'block', color: 'text.secondary' }}
                                            >
                                                Selected stage details
                                            </Typography>
                                        </Box>
                                        <Chip
                                            size="small"
                                            label={activeStage.status || 'Not Initiated'}
                                            sx={{
                                                bgcolor: getStageVisualMeta(activeStage.status).statusBg,
                                                color: getStageVisualMeta(activeStage.status).statusColor,
                                                fontWeight: 700,
                                                height: 24,
                                            }}
                                        />
                                    </Box>

                                    <Box
                                        sx={{
                                            mt: 1.25,
                                            display: 'grid',
                                            gap: 1,
                                        }}
                                    >
                                        {activeStage.description ? (
                                            <Box
                                                sx={{
                                                    px: 1.25,
                                                    py: 1,
                                                    borderRadius: 2,
                                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.16 : 0.55),
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.08em',
                                                    }}
                                                >
                                                    Description
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.55, lineHeight: 1.65 }}>
                                                    {activeStage.description}
                                                </Typography>
                                            </Box>
                                        ) : null}

                                        {activeStage.remark ? (
                                            <Box
                                                sx={{
                                                    px: 1.25,
                                                    py: 1,
                                                    borderRadius: 2,
                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                                                    border: 1,
                                                    borderColor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.1),
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        color: 'text.secondary',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '0.08em',
                                                    }}
                                                >
                                                    Remark / Feedback
                                                </Typography>
                                                <Typography variant="body2" sx={{ mt: 0.55, lineHeight: 1.65 }}>
                                                    {activeStage.remark}
                                                </Typography>
                                            </Box>
                                        ) : null}
                                    </Box>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </MUIModal>

                <MUIModal
                    open={showInterviewInsightModal}
                    onClose={closeInterviewInsightModal}
                    contentSx={{
                        p: 0,
                        width: { xs: '96vw', sm: '92vw', md: 'min(1040px, 94vw)' },
                        maxWidth: '1040px',
                        maxHeight: '92vh',
                        overflow: 'hidden',
                        border: 'none',
                        borderRadius: { xs: 3, sm: 4 },
                        boxShadow: isDark
                            ? '0 28px 72px rgba(0, 0, 0, 0.48)'
                            : '0 28px 72px rgba(15, 23, 42, 0.18)',
                    }}
                >
                    <Box
                        sx={{
                            position: 'relative',
                            bgcolor: 'background.paper',
                            display: 'flex',
                            flexDirection: 'column',
                            maxHeight: '92vh',
                            minHeight: { xs: '70vh', md: '76vh' },
                        }}
                    >
                        <IconButton
                            size="small"
                            onClick={closeInterviewInsightModal}
                            sx={{
                                position: 'absolute',
                                top: 16,
                                right: 16,
                                zIndex: 2,
                                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.32 : 0.74),
                                border: 1,
                                borderColor: alpha(theme.palette.common.black, isDark ? 0.18 : 0.08),
                                backdropFilter: 'blur(12px)',
                                '&:hover': {
                                    bgcolor: alpha(theme.palette.background.paper, isDark ? 0.44 : 0.92),
                                },
                            }}
                        >
                            <CloseIcon />
                        </IconButton>

                        <Box
                            sx={{
                                px: { xs: 2.25, sm: 3.25 },
                                py: { xs: 2.25, sm: 2.75 },
                                borderBottom: 1,
                                borderBottomColor: alpha(theme.palette.divider, 0.72),
                                pr: { xs: 6.5, sm: 7.5 },
                                background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08)} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                            }}
                        >
                            <Typography
                                variant="overline"
                                sx={{
                                    display: 'block',
                                    color: 'text.secondary',
                                    letterSpacing: '0.14em',
                                    fontWeight: 700,
                                    mb: 0.75,
                                }}
                            >
                                {isInterviewInsightFeedbackView ? 'Interviewer Feedback' : 'Interview Report'}
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2, pr: { xs: 2, sm: 0 } }}>
                                {(selectedInterviewInsight?.job && typeof selectedInterviewInsight.job === 'object')
                                    ? renderJobTitle(selectedInterviewInsight.job)
                                    : activeInterviewRow?.job
                                        ? renderJobTitle(activeInterviewRow.job)
                                        : 'Interview detail'}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: 'text.secondary',
                                    mt: 0.9,
                                    maxWidth: 680,
                                    lineHeight: 1.7,
                                }}
                            >
                                {isInterviewInsightFeedbackView
                                    ? 'Interviewer notes, ratings, and recommendation for this interview stage.'
                                    : ''}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.75 }}>
                                {selectedInterviewInsight?.interviewType ? (
                                    <Chip
                                        size="small"
                                        label={selectedInterviewInsight.interviewType}
                                        sx={{
                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.1),
                                            color: 'primary.main',
                                            fontWeight: 700,
                                        }}
                                    />
                                ) : null}
                                {selectedInterviewInsight?.interviewerType ? (
                                    <Chip
                                        size="small"
                                        label={selectedInterviewInsight.interviewerType}
                                        sx={{
                                            bgcolor: alpha(theme.palette.info.main, isDark ? 0.2 : 0.1),
                                            color: theme.palette.info.main,
                                            fontWeight: 700,
                                        }}
                                    />
                                ) : null}
                                {selectedInterviewInsight?.startAt ? (
                                    <Chip
                                        size="small"
                                        label={formatDate(selectedInterviewInsight.startAt)}
                                        sx={{
                                            bgcolor: alpha(theme.palette.text.secondary, isDark ? 0.18 : 0.08),
                                            color: 'text.secondary',
                                            fontWeight: 700,
                                        }}
                                    />
                                ) : null}
                                {interviewInsightScoreValue !== null ? (
                                    <Chip
                                        size="small"
                                        label={`Score ${interviewInsightScoreValue}%`}
                                        sx={{
                                            bgcolor: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.1),
                                            color: theme.palette.warning.main,
                                            fontWeight: 700,
                                        }}
                                    />
                                ) : null}
                                {interviewInsightInterviewers.length ? (
                                    <Chip
                                        size="small"
                                        label={`${interviewInsightInterviewers.length} interviewer${interviewInsightInterviewers.length > 1 ? 's' : ''}`}
                                        sx={{
                                            bgcolor: alpha(theme.palette.success.main, isDark ? 0.18 : 0.08),
                                            color: theme.palette.success.main,
                                            fontWeight: 700,
                                        }}
                                    />
                                ) : null}
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                p: { xs: 2.25, sm: 3.25 },
                                flex: 1,
                                minHeight: 0,
                                overflowY: 'auto',
                                display: 'grid',
                                gap: 2.25,
                                bgcolor: alpha(theme.palette.background.default, isDark ? 0.36 : 0.72),
                                '&::-webkit-scrollbar': {
                                    width: 10,
                                },
                                '&::-webkit-scrollbar-thumb': {
                                    backgroundColor: alpha(theme.palette.text.secondary, isDark ? 0.34 : 0.18),
                                    borderRadius: 999,
                                    border: `2px solid ${theme.palette.background.default}`,
                                },
                                '&::-webkit-scrollbar-track': {
                                    backgroundColor: 'transparent',
                                },
                            }}
                        >
                            {!isInterviewInsightFeedbackView ? (
                                <>
                                    <Card
                                        sx={{
                                            borderRadius: 4,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: alpha(theme.palette.divider, 0.72),
                                            boxShadow: isDark
                                                ? '0 16px 40px rgba(0, 0, 0, 0.18)'
                                                : '0 16px 40px rgba(15, 23, 42, 0.06)',
                                        }}
                                    >
                                        <CardContent sx={{ p: { xs: 2.25, sm: 2.6 } }}>
                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: { xs: '1fr', lg: '260px minmax(0, 1fr)' },
                                                    gap: 2,
                                                    alignItems: 'start',
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        borderRadius: 3.5,
                                                        p: 1.75,
                                                        border: 1,
                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.22 : 0.12),
                                                        background: `linear-gradient(155deg, ${alpha(theme.palette.primary.main, isDark ? 0.22 : 0.1)} 0%, ${alpha(theme.palette.background.paper, 1)} 78%)`,
                                                        display: 'grid',
                                                        gap: 1.2,
                                                    }}
                                                >
                                                    <Box
                                                        sx={{
                                                            width: 42,
                                                            height: 42,
                                                            borderRadius: 3,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08),
                                                            color: 'primary.main',
                                                        }}
                                                    >
                                                        <DescriptionIcon fontSize="small" />
                                                    </Box>
                                                    <Box>
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                        >
                                                            Stage Report
                                                        </Typography>
                                                        <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15, mt: 0.7 }}>
                                                            {interviewInsightScoreValue !== null ? `${interviewInsightScoreValue}%` : 'PDF'}
                                                        </Typography>
                                                    </Box>
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                                                        {selectedInterviewInsight?.interviewType || 'Interview'}
                                                        {selectedInterviewInsight?.startAt ? ` - ${formatDate(selectedInterviewInsight.startAt)}` : ''}
                                                    </Typography>
                                                </Box>

                                                <Box sx={{ display: 'grid', gap: 1.1 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                        Interview Report Preview
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.75 }}>
                                                        This modal shows the same report PDF that is downloaded from the interview detail page,
                                                        but inline for the selected stage.
                                                    </Typography>
                                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                        {selectedInterviewInsight?.interviewType ? (
                                                            <Chip
                                                                size="small"
                                                                label={selectedInterviewInsight.interviewType}
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.primary.main, isDark ? 0.16 : 0.08),
                                                                    color: 'primary.main',
                                                                    fontWeight: 700,
                                                                }}
                                                            />
                                                        ) : null}
                                                        {selectedInterviewInsight?.interviewerType ? (
                                                            <Chip
                                                                size="small"
                                                                label={selectedInterviewInsight.interviewerType}
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.info.main, isDark ? 0.16 : 0.08),
                                                                    color: theme.palette.info.main,
                                                                    fontWeight: 700,
                                                                }}
                                                            />
                                                        ) : null}
                                                        {selectedInterviewInsight?.startAt ? (
                                                            <Chip
                                                                size="small"
                                                                label={formatDate(selectedInterviewInsight.startAt)}
                                                                sx={{
                                                                    bgcolor: alpha(theme.palette.text.secondary, isDark ? 0.16 : 0.08),
                                                                    color: 'text.secondary',
                                                                    fontWeight: 700,
                                                                }}
                                                            />
                                                        ) : null}
                                                        {interviewInsightInterviewers.length ? (
                                                            <Chip
                                                                size="small"
                                                                label={interviewInsightInterviewers.join(', ')}
                                                                sx={{
                                                                    maxWidth: '100%',
                                                                    bgcolor: alpha(theme.palette.success.main, isDark ? 0.16 : 0.08),
                                                                    color: theme.palette.success.main,
                                                                    fontWeight: 700,
                                                                    '& .MuiChip-label': {
                                                                        display: 'block',
                                                                        overflow: 'hidden',
                                                                        textOverflow: 'ellipsis',
                                                                    },
                                                                }}
                                                            />
                                                        ) : null}
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>

                                    <Card
                                        sx={{
                                            borderRadius: 4,
                                            bgcolor: 'background.paper',
                                            border: 1,
                                            borderColor: alpha(theme.palette.divider, 0.72),
                                            boxShadow: isDark
                                                ? '0 16px 40px rgba(0, 0, 0, 0.18)'
                                                : '0 16px 40px rgba(15, 23, 42, 0.06)',
                                            minHeight: { xs: 420, md: 580 },
                                            display: 'flex',
                                            flexDirection: 'column',
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                px: { xs: 2.25, sm: 2.6 },
                                                py: 1.7,
                                                borderBottom: 1,
                                                borderBottomColor: alpha(theme.palette.divider, 0.72),
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                gap: 1,
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                    PDF Preview
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    Scroll inside the document to review the full interview report.
                                                </Typography>
                                            </Box>
                                            {interviewInsightReportLoading ? (
                                                <Chip
                                                    size="small"
                                                    label="Loading report"
                                                    sx={{
                                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                        color: 'primary.main',
                                                        fontWeight: 700,
                                                    }}
                                                />
                                            ) : null}
                                        </Box>

                                        <Box
                                            sx={{
                                                flex: 1,
                                                minHeight: 0,
                                                p: { xs: 1.5, sm: 2 },
                                                bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    height: '100%',
                                                    minHeight: { xs: 360, md: 500 },
                                                    borderRadius: 3.5,
                                                    overflow: 'hidden',
                                                    border: 1,
                                                    borderColor: alpha(theme.palette.divider, 0.82),
                                                    bgcolor: 'background.paper',
                                                    position: 'relative',
                                                }}
                                            >
                                                {interviewInsightReportLoading ? (
                                                    <Box
                                                        sx={{
                                                            position: 'absolute',
                                                            inset: 0,
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            textAlign: 'center',
                                                            px: 3,
                                                            bgcolor: alpha(theme.palette.background.paper, isDark ? 0.9 : 0.82),
                                                        }}
                                                    >
                                                        <Box>
                                                            <CircularProgress size={30} />
                                                            <Typography variant="subtitle2" sx={{ mt: 1.5, fontWeight: 700 }}>
                                                                Loading interview report...
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mt: 0.6, color: 'text.secondary' }}>
                                                                Preparing the PDF preview for this stage.
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : null}

                                                {!interviewInsightReportLoading && interviewInsightReportError ? (
                                                    <Box
                                                        sx={{
                                                            height: '100%',
                                                            display: 'grid',
                                                            placeItems: 'center',
                                                            px: 3,
                                                            py: 4,
                                                            textAlign: 'center',
                                                        }}
                                                    >
                                                        <Box sx={{ maxWidth: 360 }}>
                                                            <DescriptionIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                                Interview report unavailable
                                                            </Typography>
                                                            <Typography variant="body2" sx={{ mt: 0.8, color: 'text.secondary', lineHeight: 1.7 }}>
                                                                {interviewInsightReportError}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : null}

                                                {!interviewInsightReportLoading && !interviewInsightReportError && interviewInsightReportUrl ? (
                                                    <iframe
                                                        title={`${selectedInterviewInsight?.interviewType || 'Interview'} report`}
                                                        src={interviewInsightReportUrl}
                                                        width="100%"
                                                        style={{ border: 'none', height: '100%' }}
                                                    />
                                                ) : null}
                                            </Box>
                                        </Box>
                                    </Card>

                                    {showLegacyInterviewEvaluation ? (
                                        <>
                                            <Box
                                                sx={{
                                                    display: 'grid',
                                                    gridTemplateColumns: { xs: '1fr', lg: '320px minmax(0, 1fr)' },
                                                    gap: 2,
                                                }}
                                            >
                                                <Box
                                                    sx={{
                                                        borderRadius: 4,
                                                        p: { xs: 2.25, sm: 2.5 },
                                                        border: 1,
                                                        borderColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.12),
                                                        background: `linear-gradient(155deg, ${alpha(theme.palette.primary.main, isDark ? 0.24 : 0.1)} 0%, ${alpha(theme.palette.background.paper, 1)} 75%)`,
                                                        boxShadow: isDark
                                                            ? '0 16px 40px rgba(0, 0, 0, 0.28)'
                                                            : '0 16px 40px rgba(15, 23, 42, 0.08)',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: 1.75,
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.25 }}>
                                                        <Box>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                            >
                                                                Interview Score
                                                            </Typography>
                                                            <Typography
                                                                variant="h2"
                                                                sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.05, mt: 0.8 }}
                                                            >
                                                                {interviewInsightScoreValue !== null ? `${interviewInsightScoreValue}%` : '--'}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            label={interviewInsightBand.label}
                                                            size="small"
                                                            sx={{
                                                                bgcolor: interviewInsightBand.bg,
                                                                color: interviewInsightBand.color,
                                                                fontWeight: 700,
                                                                height: 28,
                                                            }}
                                                        />
                                                    </Box>

                                                    <Box
                                                        sx={{
                                                            height: 10,
                                                            borderRadius: 999,
                                                            overflow: 'hidden',
                                                            bgcolor: alpha(theme.palette.primary.main, isDark ? 0.12 : 0.08),
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: `${interviewInsightScoreValue || 0}%`,
                                                                height: '100%',
                                                                borderRadius: 999,
                                                                bgcolor: interviewInsightBand.color,
                                                                transition: 'width 240ms ease',
                                                            }}
                                                        />
                                                    </Box>

                                                    <Box
                                                        sx={{
                                                            display: 'grid',
                                                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                p: 1.25,
                                                                borderRadius: 2.75,
                                                                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.34 : 0.82),
                                                                border: 1,
                                                                borderColor: alpha(theme.palette.divider, 0.75),
                                                                minHeight: 74,
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                            >
                                                                Interviewers
                                                            </Typography>
                                                            <Typography
                                                                variant="body2"
                                                                sx={{ mt: 0.7, fontWeight: 600, lineHeight: 1.5 }}
                                                            >
                                                                {interviewInsightInterviewers.length
                                                                    ? interviewInsightInterviewers.join(', ')
                                                                    : 'Interviewer details not available'}
                                                            </Typography>
                                                        </Box>

                                                        <Box
                                                            sx={{
                                                                p: 1.25,
                                                                borderRadius: 2.75,
                                                                bgcolor: alpha(theme.palette.background.paper, isDark ? 0.34 : 0.82),
                                                                border: 1,
                                                                borderColor: alpha(theme.palette.divider, 0.75),
                                                                minHeight: 74,
                                                            }}
                                                        >
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                            >
                                                                Interview Date
                                                            </Typography>
                                                            <Typography
                                                                variant="body2"
                                                                sx={{ mt: 0.7, fontWeight: 600, lineHeight: 1.5 }}
                                                            >
                                                                {selectedInterviewInsight?.startAt
                                                                    ? formatDate(selectedInterviewInsight.startAt)
                                                                    : 'Date not available'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                </Box>

                                                <Card
                                                    sx={{
                                                        borderRadius: 4,
                                                        bgcolor: 'background.paper',
                                                        border: 1,
                                                        borderColor: alpha(theme.palette.divider, 0.72),
                                                        boxShadow: isDark
                                                            ? '0 16px 40px rgba(0, 0, 0, 0.18)'
                                                            : '0 16px 40px rgba(15, 23, 42, 0.06)',
                                                    }}
                                                >
                                                    <CardContent sx={{ p: { xs: 2.25, sm: 2.6 } }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 1.75 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1 }}>
                                                                <Box
                                                                    sx={{
                                                                        width: 38,
                                                                        height: 38,
                                                                        borderRadius: 2.5,
                                                                        display: 'grid',
                                                                        placeItems: 'center',
                                                                        bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                                        color: 'primary.main',
                                                                    }}
                                                                >
                                                                    <TrackChangesIcon fontSize="small" />
                                                                </Box>
                                                                <Box>
                                                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                                        Stage Evaluation
                                                                    </Typography>
                                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                        Evaluation summary for the selected interview stage
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                            <Chip
                                                                label={interviewInsightBand.label}
                                                                size="small"
                                                                sx={{
                                                                    bgcolor: interviewInsightBand.bg,
                                                                    color: interviewInsightBand.color,
                                                                    fontWeight: 700,
                                                                }}
                                                            />
                                                        </Box>

                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                color: 'text.primary',
                                                                lineHeight: 1.8,
                                                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.08 : 0.04),
                                                                border: 1,
                                                                borderColor: alpha(theme.palette.primary.main, isDark ? 0.14 : 0.08),
                                                                borderRadius: 3,
                                                                p: 1.6,
                                                            }}
                                                        >
                                                            {interviewInsightOverallEvaluation || 'Overall evaluation will appear once the interview is scored.'}
                                                        </Typography>

                                                        <Box
                                                            sx={{
                                                                mt: 1.75,
                                                                display: 'grid',
                                                                gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                                                                gap: 1,
                                                            }}
                                                        >
                                                            <Box
                                                                sx={{
                                                                    p: 1.25,
                                                                    borderRadius: 2.75,
                                                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                                                    border: 1,
                                                                    borderColor: alpha(theme.palette.divider, 0.65),
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                >
                                                                    Interview Type
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 600 }}>
                                                                    {selectedInterviewInsight?.interviewType || 'N/A'}
                                                                </Typography>
                                                            </Box>

                                                            <Box
                                                                sx={{
                                                                    p: 1.25,
                                                                    borderRadius: 2.75,
                                                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                                                    border: 1,
                                                                    borderColor: alpha(theme.palette.divider, 0.65),
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                >
                                                                    Evaluation Level
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 600 }}>
                                                                    {interviewInsightBand.label}
                                                                </Typography>
                                                            </Box>

                                                            <Box
                                                                sx={{
                                                                    p: 1.25,
                                                                    borderRadius: 2.75,
                                                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                                                    border: 1,
                                                                    borderColor: alpha(theme.palette.divider, 0.65),
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                >
                                                                    Interview Mode
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ mt: 0.7, fontWeight: 600 }}>
                                                                    {selectedInterviewInsight?.interviewerType || 'N/A'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Box>

                                            <Card
                                                sx={{
                                                    borderRadius: 4,
                                                    bgcolor: 'background.paper',
                                                    border: 1,
                                                    borderColor: alpha(theme.palette.divider, 0.72),
                                                    boxShadow: isDark
                                                        ? '0 16px 40px rgba(0, 0, 0, 0.18)'
                                                        : '0 16px 40px rgba(15, 23, 42, 0.06)',
                                                }}
                                            >
                                                <CardContent sx={{ p: { xs: 2.25, sm: 2.6 } }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 2 }}>
                                                        <Box
                                                            sx={{
                                                                width: 38,
                                                                height: 38,
                                                                borderRadius: 2.5,
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                                color: 'primary.main',
                                                            }}
                                                        >
                                                            <DescriptionIcon fontSize="small" />
                                                        </Box>
                                                        <Box>
                                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                                Parameter-wise Evaluation
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                                {interviewInsightParameters.length
                                                                    ? `${interviewInsightParameters.length} parameter${interviewInsightParameters.length > 1 ? 's' : ''} scored`
                                                                    : 'Detailed score breakdown appears here once scoring is available'}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                    {interviewInsightParameters.length ? (
                                                        <Box
                                                            sx={{
                                                                display: 'grid',
                                                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                                gap: 1.25,
                                                            }}
                                                        >
                                                            {interviewInsightParameters.map((param, idx) => {
                                                                const paramScoreValue =
                                                                    typeof param.score === 'number' && !Number.isNaN(param.score)
                                                                        ? Math.max(0, Math.min(100, param.score))
                                                                        : null;
                                                                const paramBand =
                                                                    paramScoreValue !== null
                                                                        ? paramScoreValue < 33
                                                                            ? {
                                                                                label: 'Low',
                                                                                color: theme.palette.error.main,
                                                                                bg: alpha(theme.palette.error.main, isDark ? 0.2 : 0.12),
                                                                            }
                                                                            : paramScoreValue < 67
                                                                                ? {
                                                                                    label: 'Medium',
                                                                                    color: theme.palette.warning.main,
                                                                                    bg: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
                                                                                }
                                                                                : {
                                                                                    label: 'High',
                                                                                    color: theme.palette.success.main,
                                                                                    bg: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
                                                                                }
                                                                        : {
                                                                            label: 'N/A',
                                                                            color: theme.palette.text.secondary,
                                                                            bg: alpha(theme.palette.text.secondary, isDark ? 0.18 : 0.08),
                                                                        };

                                                                return (
                                                                    <Box
                                                                        key={`${param.name}-${idx}`}
                                                                        sx={{
                                                                            p: 1.5,
                                                                            borderRadius: 3,
                                                                            bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.46),
                                                                            border: 1,
                                                                            borderColor: alpha(theme.palette.divider, 0.68),
                                                                            minHeight: 126,
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            gap: 1.1,
                                                                        }}
                                                                    >
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
                                                                            <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.5 }}>
                                                                                {param.name}
                                                                            </Typography>
                                                                            <Chip
                                                                                label={paramBand.label}
                                                                                size="small"
                                                                                sx={{ bgcolor: paramBand.bg, color: paramBand.color, fontWeight: 700 }}
                                                                            />
                                                                        </Box>

                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                            <Typography variant="h6" sx={{ fontWeight: 800, color: paramBand.color }}>
                                                                                {paramScoreValue !== null ? `${paramScoreValue}%` : '--'}
                                                                            </Typography>
                                                                            <Box
                                                                                sx={{
                                                                                    flex: 1,
                                                                                    height: 8,
                                                                                    borderRadius: 999,
                                                                                    overflow: 'hidden',
                                                                                    bgcolor: alpha(paramBand.color, isDark ? 0.18 : 0.1),
                                                                                }}
                                                                            >
                                                                                <Box
                                                                                    sx={{
                                                                                        width: `${paramScoreValue || 0}%`,
                                                                                        height: '100%',
                                                                                        borderRadius: 999,
                                                                                        bgcolor: paramBand.color,
                                                                                    }}
                                                                                />
                                                                            </Box>
                                                                        </Box>

                                                                        <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7, mt: 'auto' }}>
                                                                            {param.reason || 'No evaluator note was recorded for this parameter.'}
                                                                        </Typography>
                                                                    </Box>
                                                                );
                                                            })}
                                                        </Box>
                                                    ) : (
                                                        <Box
                                                            sx={{
                                                                minHeight: 220,
                                                                borderRadius: 3.5,
                                                                border: '1px dashed',
                                                                borderColor: alpha(theme.palette.divider, 0.9),
                                                                bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                                                display: 'grid',
                                                                placeItems: 'center',
                                                                textAlign: 'center',
                                                                px: 3,
                                                            }}
                                                        >
                                                            <Box>
                                                                <DescriptionIcon sx={{ fontSize: 34, color: 'text.disabled', mb: 1 }} />
                                                                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 320, lineHeight: 1.7 }}>
                                                                    Parameter-wise evaluation will appear after this interview is scored in detail.
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </>
                                    ) : null}
                                </>
                            ) : null}

                            {isInterviewInsightFeedbackView ? (
                                <Card
                                    sx={{
                                        borderRadius: 4,
                                        bgcolor: 'background.paper',
                                        border: 1,
                                        borderColor: alpha(theme.palette.divider, 0.72),
                                        boxShadow: isDark
                                            ? '0 16px 40px rgba(0, 0, 0, 0.18)'
                                            : '0 16px 40px rgba(15, 23, 42, 0.06)',
                                    }}
                                >
                                    <CardContent sx={{ p: { xs: 2.25, sm: 2.6 } }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.1, mb: 2 }}>
                                            <Box
                                                sx={{
                                                    width: 38,
                                                    height: 38,
                                                    borderRadius: 2.5,
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    bgcolor: alpha(theme.palette.warning.main, isDark ? 0.18 : 0.08),
                                                    color: theme.palette.warning.main,
                                                }}
                                            >
                                                <RecordVoiceOverIcon fontSize="small" />
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                    Interview Feedback
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                    Stage remark and interviewer observations captured for this interview stage
                                                </Typography>
                                            </Box>
                                        </Box>
                                        {hasInterviewInsightStageRemark ? (
                                            <Box
                                                sx={{
                                                    mb: hasInterviewInsightFeedback ? 1.5 : 0,
                                                    p: 1.5,
                                                    borderRadius: 3,
                                                    bgcolor: alpha(theme.palette.info.main, isDark ? 0.1 : 0.06),
                                                    border: 1,
                                                    borderColor: alpha(theme.palette.info.main, isDark ? 0.18 : 0.14),
                                                }}
                                            >
                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 0.85 }}>
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: theme.palette.info.main, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                    >
                                                        Stage Remark / Feedback
                                                    </Typography>
                                                    {selectedInterviewInsight?.stageStatus ? (
                                                        <Chip
                                                            size="small"
                                                            label={selectedInterviewInsight.stageStatus}
                                                            sx={{
                                                                bgcolor: alpha(theme.palette.info.main, isDark ? 0.16 : 0.08),
                                                                color: theme.palette.info.main,
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                    ) : null}
                                                </Box>
                                                <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.7 }}>
                                                    {interviewInsightStageRemark}
                                                </Typography>
                                            </Box>
                                        ) : null}
                                        {hasInterviewInsightFeedback ? (
                                            <Box sx={{ display: 'grid', gap: 1.5 }}>
                                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                    {interviewInsightFeedback?.rating ? (
                                                        <Chip
                                                            size="small"
                                                            label={`Rating ${interviewInsightFeedback.rating}/5`}
                                                            sx={{
                                                                bgcolor: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.12),
                                                                color: theme.palette.warning.main,
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                    ) : null}
                                                    {interviewInsightFeedback?.recommendation ? (
                                                        <Chip
                                                            size="small"
                                                            label={interviewInsightFeedback.recommendation}
                                                            sx={{
                                                                bgcolor: getInterviewRecommendationTone(interviewInsightFeedback.recommendation).bg,
                                                                color: getInterviewRecommendationTone(interviewInsightFeedback.recommendation).color,
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                    ) : null}
                                                    {interviewInsightFeedback?.submittedAt ? (
                                                        <Chip
                                                            size="small"
                                                            label={`Submitted ${formatDate(interviewInsightFeedback.submittedAt)}`}
                                                            sx={{
                                                                bgcolor: alpha(theme.palette.success.main, isDark ? 0.16 : 0.08),
                                                                color: theme.palette.success.main,
                                                                fontWeight: 700,
                                                            }}
                                                        />
                                                    ) : null}
                                                </Box>

                                                {(interviewInsightFeedback?.strengths || interviewInsightFeedback?.improvements) ? (
                                                    <Box
                                                        sx={{
                                                            display: 'grid',
                                                            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                                            gap: 1.25,
                                                        }}
                                                    >
                                                        {interviewInsightFeedback?.strengths ? (
                                                            <Box
                                                                sx={{
                                                                    p: 1.5,
                                                                    borderRadius: 3,
                                                                    bgcolor: alpha(theme.palette.success.main, isDark ? 0.12 : 0.08),
                                                                    border: 1,
                                                                    borderColor: alpha(theme.palette.success.main, isDark ? 0.2 : 0.14),
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: 'success.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                >
                                                                    Strengths
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ mt: 0.7, color: 'text.secondary', lineHeight: 1.7 }}>
                                                                    {interviewInsightFeedback.strengths}
                                                                </Typography>
                                                            </Box>
                                                        ) : null}
                                                        {interviewInsightFeedback?.improvements ? (
                                                            <Box
                                                                sx={{
                                                                    p: 1.5,
                                                                    borderRadius: 3,
                                                                    bgcolor: alpha(theme.palette.warning.main, isDark ? 0.12 : 0.08),
                                                                    border: 1,
                                                                    borderColor: alpha(theme.palette.warning.main, isDark ? 0.2 : 0.14),
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="caption"
                                                                    sx={{ color: 'warning.main', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                                >
                                                                    Areas for Improvement
                                                                </Typography>
                                                                <Typography variant="body2" sx={{ mt: 0.7, color: 'text.secondary', lineHeight: 1.7 }}>
                                                                    {interviewInsightFeedback.improvements}
                                                                </Typography>
                                                            </Box>
                                                        ) : null}
                                                    </Box>
                                                ) : null}

                                                {interviewInsightFeedback?.overallComment ? (
                                                    <Box
                                                        sx={{
                                                            p: 1.5,
                                                            borderRadius: 3,
                                                            bgcolor: alpha(theme.palette.background.default, isDark ? 0.24 : 0.5),
                                                            border: 1,
                                                            borderColor: alpha(theme.palette.divider, 0.68),
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                        >
                                                            Overall Comment
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ mt: 0.7, color: 'text.secondary', lineHeight: 1.7 }}>
                                                            {interviewInsightFeedback.overallComment}
                                                        </Typography>
                                                    </Box>
                                                ) : null}

                                                {interviewInsightFeedbackParameterRatings.length ? (
                                                    <>
                                                        <Divider />
                                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                                            <Typography
                                                                variant="caption"
                                                                sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}
                                                            >
                                                                Parameter Ratings
                                                            </Typography>
                                                            {interviewInsightFeedbackParameterRatings.map((ratingRow, idx) => (
                                                                <Box
                                                                    key={`${ratingRow.skill || 'parameter'}-${idx}`}
                                                                    sx={{
                                                                        p: 1.3,
                                                                        borderRadius: 2.75,
                                                                        bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.46),
                                                                        border: 1,
                                                                        borderColor: alpha(theme.palette.divider, 0.68),
                                                                    }}
                                                                >
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                                                                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                                                            {ratingRow.skill || 'Parameter'}
                                                                        </Typography>
                                                                        <Chip
                                                                            size="small"
                                                                            label={ratingRow.rating ? `${ratingRow.rating}/5` : '--'}
                                                                            sx={{
                                                                                bgcolor: alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08),
                                                                                color: 'primary.main',
                                                                                fontWeight: 700,
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                    <Typography
                                                                        variant="body2"
                                                                        sx={{ display: 'block', mt: 0.7, color: 'text.secondary', lineHeight: 1.7 }}
                                                                    >
                                                                        {ratingRow.comment || 'No comment provided.'}
                                                                    </Typography>
                                                                </Box>
                                                            ))}
                                                        </Box>
                                                    </>
                                                ) : null}
                                            </Box>
                                        ) : (
                                            <Box
                                                sx={{
                                                    minHeight: 300,
                                                    borderRadius: 3.5,
                                                    border: '1px dashed',
                                                    borderColor: alpha(theme.palette.divider, 0.9),
                                                    bgcolor: alpha(theme.palette.background.default, isDark ? 0.22 : 0.5),
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    textAlign: 'center',
                                                    px: 3,
                                                }}
                                            >
                                                <Box>
                                                    <RecordVoiceOverIcon sx={{ fontSize: 38, color: 'text.disabled', mb: 1 }} />
                                                    <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 320, lineHeight: 1.7 }}>
                                                        {hasInterviewInsightStageRemark
                                                            ? 'No interviewer feedback has been submitted for this interview yet.'
                                                            : 'No stage remark or interviewer feedback is available for this interview yet.'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : null}
                        </Box>
                    </Box>
                </MUIModal>

                <MUIModal
                    open={showResumeModal}
                    onClose={() => setShowResumeModal(false)}
                    contentSx={{
                        p: 0,
                        width: { xs: '96vw', sm: '94vw', md: '90vw', lg: '86vw' },
                        maxWidth: '1260px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        border: 'none',
                    }}
                >
                    <Box
                        sx={{
                            height: { xs: '90vh', md: '90vh' },
                            minHeight: 360,
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Box
                            sx={{
                                px: { xs: 2, sm: 2.5 },
                                py: 1.5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                borderBottom: 1,
                                borderBottomColor: 'divider',
                                gap: 1,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Box sx={{ minWidth: 0 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                                    Resume Preview
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                    {fullName}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                                <IconButton
                                    size="small"
                                    onClick={() => setShowResumeModal(false)}
                                    title="Close"
                                >
                                    <CloseIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                flex: 1,
                                minHeight: 0,
                                px: { xs: 2, sm: 2.5 },
                                py: { xs: 1.25, sm: 1.5 },
                            }}
                        >
                            <Box
                                sx={{
                                    height: '100%',
                                    position: 'relative',
                                    borderRadius: 1,
                                    overflow: 'hidden',
                                    border: 5,
                                    borderColor: 'divider',
                                    bgcolor: 'background.default',
                                }}
                            >
                                {resumePreviewUrl ? (
                                    <>
                                        <iframe
                                            key={`${resumePreviewMode}-${resumeFrameKey}`}
                                            src={resumePreviewUrl}
                                            width="100%"
                                            style={{ border: 'none', height: '100%' }}
                                            title={`${fullName} Resume`}
                                            onLoad={() => setResumeFrameLoading(false)}
                                            onError={() => setResumeFrameLoading(false)}
                                        />
                                        {resumeFrameLoading && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    inset: 0,
                                                    bgcolor: alpha(theme.palette.background.default, 0.8),
                                                    display: 'grid',
                                                    placeItems: 'center',
                                                    textAlign: 'center',
                                                    px: 2,
                                                }}
                                            >
                                                <Box>
                                                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                                        Loading resume preview...
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                                        If this takes too long, use "Try Direct Preview".
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    <Box
                                        sx={{
                                            height: '100%',
                                            display: 'grid',
                                            placeItems: 'center',
                                            px: 2,
                                            textAlign: 'center',
                                        }}
                                    >
                                        <Box>
                                            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                                                Resume preview unavailable
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                                No resume URL is available for this candidate.
                                            </Typography>
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        </Box>

                        <Box
                            sx={{
                                px: { xs: 2, sm: 2.5 },
                                pb: 1.5,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 1,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                {resumePreviewMode === 'google'
                                    ? 'Stable preview mode enabled to avoid auto-download behavior.'
                                    : 'Direct preview mode may follow browser download rules set by the file host.'}
                            </Typography>
                            <MUIButton
                                variant="outlined"
                                size="small"
                                onClick={() => setShowResumeModal(false)}
                            >
                                Close
                            </MUIButton>
                        </Box>
                    </Box>
                </MUIModal>
            </Card>

            <MUIModal
                open={showTranscriptModal}
                onClose={handleCloseTranscriptModal}
                contentSx={{ p: 0, maxWidth: 'min(680px, 92vw)', overflow: 'hidden' }}
            >
                <Box
                    sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 2.5,
                        p: 0,
                        width: '100%',
                        maxHeight: '82vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        border: 1,
                        borderColor: 'divider',
                        boxShadow: 2,
                    }}
                >
                    <Box
                        sx={{
                            px: 3,
                            py: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            borderBottom: 1,
                            borderBottomColor: 'divider',
                            bgcolor: 'background.default',
                        }}
                    >
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Conversation Transcript
                        </Typography>
                        <IconButton size="small" onClick={handleCloseTranscriptModal} title="Close">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                    <Box
                        sx={{
                            flex: 1,
                            minHeight: '260px',
                            overflowY: 'auto',
                            overflowX: 'hidden',
                            px: 3,
                            py: 2.5,
                            bgcolor: 'background.default',
                        }}
                    >
                        {activeTranscriptData?.error ? (
                            <Typography color="error">{activeTranscriptData.error}</Typography>
                        ) : !activeTranscriptData ? (
                            <Typography color="text.secondary">Loading...</Typography>
                        ) : (() => {
                            const messages = Array.isArray(activeTranscriptData.messages)
                                ? activeTranscriptData.messages
                                : [];
                            const rendered = messages
                                .map((message, index) => {
                                    const text = getTranscriptText(message);
                                    if (!text) return null;
                                    const isCandidate = ['user', 'candidate', 'human'].includes(
                                        (message.role || '').toLowerCase()
                                    );
                                    const bubbleBg = isCandidate
                                        ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12)
                                        : alpha(theme.palette.secondary.main, isDark ? 0.16 : 0.1);
                                    const bubbleBorder = isCandidate
                                        ? alpha(theme.palette.primary.main, isDark ? 0.32 : 0.2)
                                        : alpha(theme.palette.secondary.main, isDark ? 0.28 : 0.18);
                                    return (
                                        <Box
                                            key={index}
                                            sx={{
                                                display: 'flex',
                                                flexDirection: isCandidate ? 'row-reverse' : 'row',
                                                mb: 2.5,
                                            }}
                                        >
                                            <Box sx={{ maxWidth: '85%', minWidth: 0 }}>
                                                <Box
                                                    sx={{
                                                        px: 2,
                                                        py: 1.2,
                                                        borderRadius: 2,
                                                        color: 'text.primary',
                                                        fontSize: '1rem',
                                                        wordBreak: 'break-word',
                                                        overflowWrap: 'anywhere',
                                                        border: `1px solid ${bubbleBorder}`,
                                                        bgcolor: bubbleBg,
                                                        boxShadow: 1,
                                                    }}
                                                >
                                                    {text}
                                                </Box>
                                                <Typography
                                                    sx={{
                                                        fontSize: '0.82rem',
                                                        color: 'text.secondary',
                                                        mt: 0.6,
                                                        textAlign: isCandidate ? 'right' : 'left',
                                                    }}
                                                >
                                                    {formatClockTime(message.time)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })
                                .filter(Boolean);

                            if (!rendered.length) {
                                return (
                                    <Typography color="text.secondary">
                                        No transcript found.
                                    </Typography>
                                );
                            }
                            return rendered;
                        })()}
                    </Box>
                    <Box
                        sx={{
                            px: 3,
                            py: 2,
                            borderTop: 1,
                            borderTopColor: 'divider',
                            display: 'flex',
                            justifyContent: 'flex-end',
                            bgcolor: 'background.default',
                        }}
                    >
                        <MUIButton
                            variant="contained"
                            onClick={handleCloseTranscriptModal}
                        >
                            Close
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>
        </Box>
    );
}
