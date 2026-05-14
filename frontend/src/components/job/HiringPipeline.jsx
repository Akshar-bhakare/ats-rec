import dayjs from 'dayjs';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Autocomplete,
    Avatar,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    FormControlLabel,
    LinearProgress,
    MenuItem,
    Pagination,
    Paper,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import {
    Add,
    CancelOutlined,
    Download,
    Phone,
    ScheduleOutlined,
    Videocam,
    WhatsApp,
} from '@mui/icons-material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import {
    buildInterviewScheduleDrafts,
    buildInterviewScheduleParams,
} from '../../AppUtils/interviewScheduling';
import { getActiveStageItem, normalizeStageProgressStatus } from '../../AppUtils/stageProgress';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import StageResultEditorModal from '../CandidateATS/StageResultEditorModal';
import BulkInterviewScheduleModal from './BulkInterviewScheduleModal';
import JobDetail from './JobDetail';

const STAGE_DOT_COLORS = [
    '#10B981',
    '#3B82F6',
    '#7C3AED',
    '#F59E0B',
    '#14B8A6',
    '#EC4899',
    '#0EA5E9',
];
const CARD_PAGE_LIMIT = 4;
const ATS_PAGE_SIZE = 100;
const MAX_ATS_PAGES = 15;
const ATS_PAGE_FETCH_CONCURRENCY = 4;
const RELEVANCY_JOB_FETCH_CONCURRENCY = 4;

const DEFAULT_STAGE_STATUS = 'Not Initiated';
const FEEDBACK_SOURCE_CHOICES = ['AI Recruiter', 'Human Recruiter'];
const BULK_ACTION_MODES = {
    INTERVIEW: 'interview',
    SCHEDULE_CALL: 'scheduleCall',
    CLEAR_SCHEDULE: 'clearSchedule',
    TRIGGER_CALL: 'triggerCall',
    WHATSAPP: 'whatsapp',
};
const SELECTION_ACTION_BUTTON_SX = {
    textTransform: 'none',
    borderBottomWidth: 1.2,
    borderRadius: 2,
    px: 1.2,
    py: 0.45,
    minHeight: 34,
    fontSize: '0.80rem',
    '& .MuiButton-startIcon': {
        mr: 0.7,
    },
};
const EMPTY_STAGE_STATUS_MODAL = {
    open: false,
    cardId: '',
    atsId: '',
    stageResultId: '',
    candidateName: '',
    stageTitle: '',
    currentStatus: DEFAULT_STAGE_STATUS,
    currentFeedback: '',
    previousStageId: '',
    previousStageTitle: '',
};
const EMPTY_ADD_CANDIDATE_TARGET_STAGE = {
    id: '',
    title: '',
};

const normalizeId = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') return String(value._id || value.id || '');
    return String(value);
};

const normalizeStageStatus = (status) => {
    return normalizeStageProgressStatus(status, DEFAULT_STAGE_STATUS);
};

const normalizePhoneDigits = (value = '') => String(value || '').replace(/\D/g, '');
const isValidMongoId = (value) => /^[0-9a-fA-F]{24}$/.test(String(value || ''));
const toLocalDateTimeInputValue = (dateLike) => {
    const dt = dateLike instanceof Date ? new Date(dateLike.getTime()) : new Date(dateLike);
    if (Number.isNaN(dt.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    const year = dt.getFullYear();
    const month = pad(dt.getMonth() + 1);
    const day = pad(dt.getDate());
    const hours = pad(dt.getHours());
    const mins = pad(dt.getMinutes());
    return `${year}-${month}-${day}T${hours}:${mins}`;
};
const normalizeSkillsText = (skills) => {
    if (!skills) return '';
    if (typeof skills === 'string') return skills;
    if (!Array.isArray(skills)) return '';

    return skills
        .map((skill) => {
            if (!skill) return '';
            if (typeof skill === 'string' || typeof skill === 'number') return String(skill);

            if (typeof skill === 'object') {
                const preferred =
                    skill?.name ||
                    skill?.skill ||
                    skill?.label ||
                    skill?.title;
                if (preferred) return String(preferred);
                return Object.keys(skill).join(' ');
            }

            return '';
        })
        .filter(Boolean)
        .join(', ');
};
const normalizeRankNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
};

const getNameInitials = (fullName) =>
    String(fullName || '')
        .split(' ')
        .filter(Boolean)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'C';

const getStatusPalette = (theme, status) => {
    const normalized = String(status || '').toLowerCase();
    if (normalized === 'selected' || normalized === 'completed') {
        return {
            color: theme.palette.success.main,
            background: alpha(theme.palette.success.main, 0.14),
            border: alpha(theme.palette.success.main, 0.36),
        };
    }
    if (normalized === 'rejected') {
        return {
            color: theme.palette.error.main,
            background: alpha(theme.palette.error.main, 0.14),
            border: alpha(theme.palette.error.main, 0.36),
        };
    }
    if (normalized === 'on hold') {
        return {
            color: theme.palette.warning.main,
            background: alpha(theme.palette.warning.main, 0.14),
            border: alpha(theme.palette.warning.main, 0.36),
        };
    }
    return {
        color: theme.palette.text.secondary,
        background: alpha(theme.palette.text.secondary, 0.12),
        border: alpha(theme.palette.text.secondary, 0.28),
    };
};

const getRelevancyPalette = (theme, score) => {
    if (!Number.isFinite(score)) {
        return {
            color: theme.palette.text.secondary,
            background: alpha(theme.palette.text.secondary, 0.12),
            border: alpha(theme.palette.text.secondary, 0.28),
        };
    }
    if (score < 33) {
        return {
            color: theme.palette.error.main,
            background: alpha(theme.palette.error.main, 0.14),
            border: alpha(theme.palette.error.main, 0.34),
        };
    }
    if (score < 67) {
        return {
            color: theme.palette.warning.main,
            background: alpha(theme.palette.warning.main, 0.14),
            border: alpha(theme.palette.warning.main, 0.34),
        };
    }
    return {
        color: theme.palette.success.main,
        background: alpha(theme.palette.success.main, 0.14),
        border: alpha(theme.palette.success.main, 0.34),
    };
};

const normalizeRelevancyNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

const displayMetric = (value) => (
    value === null || value === undefined || value === '' ? 'N/A' : value
);
function HiringPipelineListView() {
    const [authState] = useAuthContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const theme = useTheme();
    const rootRef = useRef(null);
    const [jobs, setJobs] = useState([]);
    const [stages, setStages] = useState([]);
    const [cards, setCards] = useState([]);
    const [candidateSearch, setCandidateSearch] = useState('');
    const [selectedJobId, setSelectedJobId] = useState('all');
    const [relevancyFilter, setRelevancyFilter] = useState('all');
    const [reportModal, setReportModal] = useState({
        open: false,
        fromDate: dayjs().subtract(6, 'day'),
        toDate: dayjs(),
        stageIds: [],
    });
    const [stagePageById, setStagePageById] = useState({});
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [loadingPipeline, setLoadingPipeline] = useState(false);
    const [movingCardId, setMovingCardId] = useState('');
    const [actionCardId, setActionCardId] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [relevancyByJob, setRelevancyByJob] = useState({});
    const [relevancyModalOpen, setRelevancyModalOpen] = useState(false);
    const [selectedRelevancy, setSelectedRelevancy] = useState(null);
    const [relevancyLoading, setRelevancyLoading] = useState(false);
    const [confirmCallModal, setConfirmCallModal] = useState({
        open: false,
        card: null,
    });
    const [moveFeedbackModal, setMoveFeedbackModal] = useState({
        open: false,
        cardId: '',
        targetStageId: '',
        targetStageTitle: '',
        feedbackSource: FEEDBACK_SOURCE_CHOICES[1],
        feedbackText: '',
    });
    const [stageStatusModal, setStageStatusModal] = useState(EMPTY_STAGE_STATUS_MODAL);
    const [bulkActionMode, setBulkActionMode] = useState('');
    const [selectedCardIds, setSelectedCardIds] = useState([]);
    const [bulkScheduleModal, setBulkScheduleModal] = useState({
        open: false,
        scheduleAt: toLocalDateTimeInputValue(new Date(Date.now() + 10 * 60 * 1000)),
    });
    const [interviewScheduleModalOpen, setInterviewScheduleModalOpen] = useState(false);
    const [interviewScheduleDrafts, setInterviewScheduleDrafts] = useState([]);
    const [interviewScheduleSearch, setInterviewScheduleSearch] = useState('');
    const [bulkInterviewScheduleAt, setBulkInterviewScheduleAt] = useState(dayjs().add(10, 'minute'));
    const [bulkActionLoading, setBulkActionLoading] = useState(false);
    const [alertModal, setAlertModal] = useState({
        open: false,
        title: 'Info',
        message: '',
        severity: 'info',
    });
    const relevancyCacheRef = useRef({});
    const candidatePickerRequestRef = useRef(0);
    const [addCandidateChoiceModalOpen, setAddCandidateChoiceModalOpen] = useState(false);
    const [addCandidateTargetStage, setAddCandidateTargetStage] = useState(EMPTY_ADD_CANDIDATE_TARGET_STAGE);
    const [addCandidateModal, setAddCandidateModal] = useState({
        open: false,
        search: '',
        selectedIds: [],
        targetStageId: '',
        targetStageTitle: '',
    });
    const [candidatePickerRows, setCandidatePickerRows] = useState([]);
    const [candidatePickerLoading, setCandidatePickerLoading] = useState(false);
    const [candidatePickerSubmitting, setCandidatePickerSubmitting] = useState(false);



    const normalizeStageResults = useCallback((stageResults = []) => {
        const list = Array.isArray(stageResults) ? stageResults : [];
        return list
            .map((sr) => {
                const stageId = normalizeId(sr?.stage);
                const stageTitle = sr?.stage?.title || 'Stage';
                const createdAt = sr?.stage?.createdAt
                    ? new Date(sr.stage.createdAt).getTime()
                    : Number.MAX_SAFE_INTEGER;
                return {
                    id: normalizeId(sr?._id || sr?.id),
                    stageId,
                    stageTitle,
                    stageStatus: normalizeStageStatus(sr?.stageStatus),
                    remarkOrFeedback: String(sr?.remarkOrFeedback || '').trim(),
                    createdAt,
                };
            })
            .filter((sr) => sr.id && sr.stageId)
            .sort((a, b) => a.createdAt - b.createdAt);
    }, []);

    const buildPipelineCards = useCallback((candidateRows = []) => {
        const nextCards = [];

        (Array.isArray(candidateRows) ? candidateRows : []).forEach((candidate) => {
            const candidateId = normalizeId(candidate?._id || candidate?.id);
            if (!candidateId) return;

            const fullName =
                `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() ||
                candidate?.email ||
                'Candidate';
            const applications = Array.isArray(candidate?.applications)
                ? candidate.applications
                : [];

            applications.forEach((app) => {
                const atsId = normalizeId(app?._id || app?.id);
                const jobId = normalizeId(app?.job?._id || app?.job);
                if (!atsId || !jobId) return;

                const stageResults = normalizeStageResults(app?.stageResults);
                if (!stageResults.length) return;

                const activeStage = getActiveStageItem(
                    stageResults,
                    (sr) => sr?.stageStatus,
                    DEFAULT_STAGE_STATUS
                ) || stageResults[0];

                if (!activeStage?.stageId) return;

                const jobTitle =
                    app?.job?.title ||
                    app?.job?.internalTitle ||
                    app?.title ||
                    'Job';

                nextCards.push({
                    id: `${candidateId}-${atsId}`,
                    atsId,
                    candidateId,
                    jobId,
                    fullName,
                    email: candidate?.email || '',
                    phoneNumber: candidate?.phoneNumber || candidate?.mobile || '',
                    countryCode: candidate?.countryCode || '',
                    skillsText: normalizeSkillsText(candidate?.skills),
                    jobTitle,
                    activeStageId: activeStage.stageId,
                    activeStageStatus: activeStage.stageStatus,
                    stageResults,
                });
            });
        });

        return nextCards;
    }, [normalizeStageResults]);

    const loadJobs = useCallback(async () => {
        setLoadingJobs(true);
        try {
            const params = new URLSearchParams();
            params.set('resolveCompanies', 'true');
            params.set('viewMode', 'all');
            params.set('page', '1');
            params.set('pageSize', '200');

            const res = await fetchData(`/api/jobs/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const mapped = list
                .map((job) => ({
                    ...job,
                    id: normalizeId(job?._id || job?.id),
                }))
                .filter((job) => job.id)
                .sort((a, b) => {
                    const aTitle = (a?.title || a?.internalTitle || '').toLowerCase();
                    const bTitle = (b?.title || b?.internalTitle || '').toLowerCase();
                    return aTitle.localeCompare(bTitle);
                });
            setJobs(mapped);
        } catch (err) {
            console.error('[HiringPipeline] Failed to load jobs:', err);
            setJobs([]);
        } finally {
            setLoadingJobs(false);
        }
    }, []);

    const loadStages = useCallback(async () => {
        try {
            const res = await fetchData('/api/stages/');
            const list = Array.isArray(res) ? res : [];
            const mapped = list
                .map((stage, index) => ({
                    id: normalizeId(stage?._id || stage?.id),
                    title: stage?.title || 'Stage',
                    createdAt: stage?.createdAt
                        ? new Date(stage.createdAt).getTime()
                        : (Number.MAX_SAFE_INTEGER + index),
                }))
                .filter((stage) => stage.id)
                .sort((a, b) => a.createdAt - b.createdAt);
            setStages(mapped);
        } catch {
            setStages([]);
        }
    }, []);

    const buildRelevancyPayload = useCallback((source, fallbackName = 'Candidate') => {
        const totalScore = normalizeRelevancyNumber(
            source?.candidateRelevancyToJob ?? source?.relevancy
        );
        const rank = normalizeRankNumber(
            source?.rank ?? source?.candidateRank ?? source?.relevancyRank
        );

        return {
            name: source?.name || fallbackName || 'Candidate',
            candidateRelevancyToJob: totalScore,
            rank,
            experienceRelevancy: source?.experienceRelevancy ?? 'N/A',
            skillsRelevancy: source?.skillsRelevancy ?? 'N/A',
            responsibilitiesRelevancy: source?.responsibilitiesRelevancy ?? 'N/A',
            designationRelevancy: source?.designationRelevancy ?? 'N/A',
            salaryRelevancy: source?.salaryRelevancy ?? 'N/A',
            noticePeriodRelevancy: source?.noticePeriodRelevancy ?? 'N/A',
            interestRelevancy: source?.interestRelevancy ?? 'N/A',
            communicationRelevancy: source?.communicationRelevancy ?? 'N/A',
            reason: source?.reason || 'N/A',
        };
    }, []);

    const fetchLatestRelevancy = useCallback(async (candidateId, jobId, fallbackName) => {
        if (!candidateId || !jobId) return;
        setRelevancyLoading(true);
        try {
            const rows = await fetchData(
                `/api/relevancy?candidateId=${encodeURIComponent(candidateId)}&jobId=${encodeURIComponent(jobId)}&limit=5`
            );
            const list = Array.isArray(rows) ? rows : [];
            if (!list.length) return;

            const latest = [...list].sort((a, b) => {
                const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
                const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
                return bTime - aTime;
            })[0];

            if (latest) {
                setSelectedRelevancy(buildRelevancyPayload(latest, fallbackName));
            }
        } catch (err) {
            console.error('[HiringPipeline] Failed to fetch latest relevancy:', err);
        } finally {
            setRelevancyLoading(false);
        }
    }, [buildRelevancyPayload]);

    const hydrateRelevancy = useCallback(async (pipelineCards = []) => {
        const uniqueJobIds = [...new Set(
            (pipelineCards || [])
                .map((card) => card?.jobId)
                .filter(Boolean)
                .map(String)
        )];

        if (!uniqueJobIds.length) {
            setRelevancyByJob({});
            return;
        }

        const missingJobIds = uniqueJobIds.filter((jobId) => !relevancyCacheRef.current[jobId]);
        const fetchRelevancyByJob = async (jobId) => {
            try {
                const rows = await fetchData(
                    `/api/jobs/${jobId}/relevant-candidates?includeApplied=true&readOnly=true`
                );
                const list = Array.isArray(rows) ? rows : [];
                const mapByCandidate = {};

                list.forEach((item) => {
                    const candidateId = String(
                        item?.id || item?.candidateId || item?.candidate?._id || ''
                    );
                    if (!candidateId) return;
                    const fallbackName =
                        `${item?.firstName || ''} ${item?.lastName || ''}`.trim() ||
                        item?.email ||
                        'Candidate';
                    mapByCandidate[candidateId] = buildRelevancyPayload(item, fallbackName);
                });

                // Fallback rank if API rank is missing: higher score gets better rank.
                const rankedByScore = Object.entries(mapByCandidate)
                    .map(([candidateId, payload]) => ({
                        candidateId,
                        score: normalizeRelevancyNumber(payload?.candidateRelevancyToJob),
                    }))
                    .filter((entry) => Number.isFinite(entry.score))
                    .sort((a, b) => b.score - a.score);

                rankedByScore.forEach((entry, index) => {
                    const existingRank = normalizeRankNumber(mapByCandidate[entry.candidateId]?.rank);
                    if (existingRank === null) {
                        mapByCandidate[entry.candidateId].rank = index + 1;
                    }
                });

                return { jobId, mapByCandidate };
            } catch {
                return { jobId, mapByCandidate: {} };
            }
        };

        for (let index = 0; index < missingJobIds.length; index += RELEVANCY_JOB_FETCH_CONCURRENCY) {
            const batch = missingJobIds.slice(index, index + RELEVANCY_JOB_FETCH_CONCURRENCY);
            const batchResults = await Promise.all(batch.map((jobId) => fetchRelevancyByJob(jobId)));
            batchResults.forEach(({ jobId, mapByCandidate }) => {
                relevancyCacheRef.current[jobId] = mapByCandidate;
            });
        }

        const visibleMap = {};
        uniqueJobIds.forEach((jobId) => {
            visibleMap[jobId] = relevancyCacheRef.current[jobId] || {};
        });
        setRelevancyByJob(visibleMap);
    }, [buildRelevancyPayload]);

    const loadPipeline = useCallback(async () => {
        setLoadingPipeline(true);
        setErrorMsg('');
        try {
            const fetchAtsPage = async (page) => {
                const params = new URLSearchParams();
                params.set('page', String(page));
                params.set('pageSize', String(ATS_PAGE_SIZE));
                if (selectedJobId !== 'all') {
                    params.set('jobId', selectedJobId);
                }

                const res = await fetchData(`/api/candidates/ats/?${params.toString()}`);
                const list = Array.isArray(res) ? res : (res?.items || []);
                if (Array.isArray(res)) {
                    return { list, totalPages: 1 };
                }
                const nextTotalPages = Number(res?.meta?.totalPages || 1);
                return {
                    list,
                    totalPages: Number.isFinite(nextTotalPages) && nextTotalPages > 0
                        ? nextTotalPages
                        : 1,
                };
            };

            const firstPage = await fetchAtsPage(1);
            const collected = [...firstPage.list];
            const cappedTotalPages = Math.min(firstPage.totalPages, MAX_ATS_PAGES);

            if (cappedTotalPages > 1) {
                const remainingPages = Array.from(
                    { length: cappedTotalPages - 1 },
                    (_, idx) => idx + 2
                );

                for (let index = 0; index < remainingPages.length; index += ATS_PAGE_FETCH_CONCURRENCY) {
                    const batch = remainingPages.slice(index, index + ATS_PAGE_FETCH_CONCURRENCY);
                    const batchResponses = await Promise.all(
                        batch.map((page) => fetchAtsPage(page))
                    );
                    batchResponses.forEach((pageResponse) => {
                        collected.push(...pageResponse.list);
                    });
                }
            }

            const nextCards = buildPipelineCards(collected);
            setCards(nextCards);
            void hydrateRelevancy(nextCards);
        } catch (err) {
            console.error('[HiringPipeline] Failed to load pipeline:', err);
            setCards([]);
            setRelevancyByJob({});
            setErrorMsg('Unable to load hiring pipeline data.');
        } finally {
            setLoadingPipeline(false);
        }
    }, [buildPipelineCards, hydrateRelevancy, selectedJobId]);

    useEffect(() => {
        loadJobs();
        loadStages();
    }, [loadJobs, loadStages]);

    useEffect(() => {
        loadPipeline();
    }, [loadPipeline]);

    useEffect(() => {
        if (selectedJobId === 'all') return;
        if (!jobs.length) return;
        const exists = jobs.some((job) => job.id === selectedJobId);
        if (!exists) setSelectedJobId('all');
    }, [jobs, selectedJobId]);

    useEffect(() => {
        setStagePageById({});
    }, [candidateSearch, selectedJobId, relevancyFilter]);

    const stageColumns = useMemo(() => {
        const map = new Map();

        (stages || []).forEach((stage, index) => {
            map.set(stage.id, {
                id: stage.id,
                title: stage.title || 'Stage',
                createdAt: stage.createdAt || index,
            });
        });

        (cards || []).forEach((card) => {
            (card.stageResults || []).forEach((sr) => {
                if (!sr?.stageId) return;
                if (map.has(sr.stageId)) return;
                map.set(sr.stageId, {
                    id: sr.stageId,
                    title: sr.stageTitle || 'Stage',
                    createdAt: sr.createdAt || Number.MAX_SAFE_INTEGER,
                });
            });
        });

        return Array.from(map.values()).sort((a, b) => {
            if ((a.createdAt || 0) !== (b.createdAt || 0)) {
                return (a.createdAt || 0) - (b.createdAt || 0);
            }
            return String(a.title || '').localeCompare(String(b.title || ''));
        });
    }, [cards, stages]);
    const stageTitleById = useMemo(
        () => new Map((stageColumns || []).map((stage) => [stage.id, stage.title || 'Stage'])),
        [stageColumns]
    );
    const selectedJob = useMemo(
        () => jobs.find((job) => String(job.id) === String(selectedJobId)) || null,
        [jobs, selectedJobId]
    );
    const jobOptions = useMemo(() => {
        const mapped = (jobs || []).map((job) => ({
            id: String(job.id),
            label: job.title || job.internalTitle || 'Untitled Job',
        }));
        return [{ id: 'all', label: 'All Jobs' }, ...mapped];
    }, [jobs]);
    const selectedJobOption = useMemo(() => {
        if (selectedJobId === 'all') return jobOptions[0] || null;
        return (
            jobOptions.find((job) => String(job.id) === String(selectedJobId))
            || jobOptions[0]
            || null
        );
    }, [jobOptions, selectedJobId]);
    const selectedJobLabel = selectedJob?.title || selectedJob?.internalTitle || 'Selected Job';
    const candidatePickerViewMode = authState?.user?.role === 'recruiter' ? 'me' : 'all';
    const selectedJobCandidateIds = useMemo(() => {
        if (selectedJobId === 'all') return new Set();

        return new Set(
            (cards || [])
                .filter((card) => String(card?.jobId || '') === String(selectedJobId))
                .map((card) => String(card?.candidateId || ''))
                .filter(Boolean)
        );
    }, [cards, selectedJobId]);
    const availableCandidates = useMemo(() => {
        if (selectedJobId === 'all') return [];

        return (candidatePickerRows || [])
            .filter((candidate) => {
                const candidateId = normalizeId(candidate?._id || candidate?.id);
                if (!candidateId) return false;
                if (selectedJobCandidateIds.has(candidateId)) return false;

                const candidateJobIds = Array.isArray(candidate?.jobs)
                    ? candidate.jobs.map((jobId) => normalizeId(jobId)).filter(Boolean)
                    : [];

                return !candidateJobIds.includes(String(selectedJobId));
            })
            .sort((a, b) => {
                const aName = (
                    `${a?.firstName || ''} ${a?.lastName || ''}`.trim() ||
                    a?.email ||
                    'Candidate'
                ).toLowerCase();
                const bName = (
                    `${b?.firstName || ''} ${b?.lastName || ''}`.trim() ||
                    b?.email ||
                    'Candidate'
                ).toLowerCase();
                return aName.localeCompare(bName);
            });
    }, [candidatePickerRows, selectedJobCandidateIds, selectedJobId]);

    const searchedCards = useMemo(() => {
        const query = candidateSearch.trim().toLowerCase();
        if (!query) return cards || [];
        const queryDigits = normalizePhoneDigits(query);

        return (cards || []).filter((card) => {
            const name = String(card?.fullName || '').toLowerCase();
            const email = String(card?.email || '').toLowerCase();
            const jobTitle = String(card?.jobTitle || '').toLowerCase();
            const skills = String(card?.skillsText || '').toLowerCase();
            const mobileRaw = `${card?.countryCode || ''}${card?.phoneNumber || ''}`;
            const mobile = mobileRaw.toLowerCase();
            const mobileDigits = normalizePhoneDigits(mobileRaw);

            const nameMatch = name.includes(query);
            const emailMatch = email.includes(query);
            const jobTitleMatch = jobTitle.includes(query);
            const skillsMatch = skills.includes(query);
            const mobileTextMatch = mobile.includes(query);
            const mobileDigitMatch = queryDigits.length > 0 && mobileDigits.includes(queryDigits);

            return (
                nameMatch ||
                emailMatch ||
                jobTitleMatch ||
                skillsMatch ||
                mobileTextMatch ||
                mobileDigitMatch
            );
        });
    }, [cards, candidateSearch]);

    const filteredCards = useMemo(() => {
        return (searchedCards || []).filter((card) => {
            const relevancyDetails = relevancyByJob?.[card.jobId]?.[card.candidateId] || null;
            const score = normalizeRelevancyNumber(relevancyDetails?.candidateRelevancyToJob);

            let relevancyMatch = true;
            if (relevancyFilter === 'high') {
                relevancyMatch = Number.isFinite(score) && score >= 67;
            } else if (relevancyFilter === 'medium') {
                relevancyMatch = Number.isFinite(score) && score >= 33 && score <= 66;
            } else if (relevancyFilter === 'low') {
                relevancyMatch = Number.isFinite(score) && score < 33;
            } else if (relevancyFilter === 'na') {
                relevancyMatch = !Number.isFinite(score);
            }

            return relevancyMatch;
        });
    }, [searchedCards, relevancyByJob, relevancyFilter]);
    const selectedCardIdSet = useMemo(
        () => new Set((selectedCardIds || []).map(String)),
        [selectedCardIds]
    );
    const selectedCards = useMemo(() => (
        (filteredCards || []).filter((card) => selectedCardIdSet.has(String(card.id)))
    ), [filteredCards, selectedCardIdSet]);
    const selectedCardCount = selectedCardIds.length;
    const bulkSelectionEnabled = Boolean(bulkActionMode);

    const cardsByStage = useMemo(() => {
        const map = new Map(stageColumns.map((stage) => [stage.id, []]));

        (filteredCards || []).forEach((card) => {
            const stageId = card?.activeStageId;
            if (!stageId) return;
            if (!map.has(stageId)) map.set(stageId, []);
            map.get(stageId).push(card);
        });

        map.forEach((stageCards) => {
            stageCards.sort((a, b) => a.fullName.localeCompare(b.fullName));
        });

        return map;
    }, [filteredCards, stageColumns]);

    const filteredInterviewScheduleDrafts = useMemo(() => {
        const search = interviewScheduleSearch.trim().toLowerCase();
        if (!search) return interviewScheduleDrafts || [];
        return (interviewScheduleDrafts || []).filter((item) => {
            const haystack = [
                item?.firstName,
                item?.lastName,
                item?.email,
                item?.phoneNumber,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(search);
        });
    }, [interviewScheduleDrafts, interviewScheduleSearch]);


    useEffect(() => {
        const visibleIds = new Set((filteredCards || []).map((card) => String(card.id)));
        setSelectedCardIds((prev) => {
            if (!prev?.length) return prev;
            const next = prev.filter((id) => visibleIds.has(String(id)));
            return next.length === prev.length ? prev : next;
        });
    }, [filteredCards]);

    useEffect(() => {
        setStagePageById((prev) => {
            const next = {};

            stageColumns.forEach((stage) => {
                const totalCards = (cardsByStage.get(stage.id) || []).length;
                const totalPages = Math.max(1, Math.ceil(totalCards / CARD_PAGE_LIMIT));
                const current = Number(prev?.[stage.id] || 1);
                next[stage.id] = Math.min(Math.max(current, 1), totalPages);
            });

            const prevKeys = Object.keys(prev || {});
            const nextKeys = Object.keys(next);
            const unchanged =
                prevKeys.length === nextKeys.length &&
                nextKeys.every((key) => Number(prev[key]) === Number(next[key]));

            return unchanged ? prev : next;
        });
    }, [cardsByStage, stageColumns]);

    const openAlertModal = useCallback((title, message, severity = 'info') => {
        setAlertModal({
            open: true,
            title: title || 'Info',
            message: message || '',
            severity,
        });
    }, []);

    const closeAlertModal = useCallback(() => {
        setAlertModal((prev) => ({ ...prev, open: false }));
    }, []);

    const closeAddCandidateModal = useCallback(() => {
        candidatePickerRequestRef.current += 1;
        setAddCandidateTargetStage(EMPTY_ADD_CANDIDATE_TARGET_STAGE);
        setAddCandidateModal({
            open: false,
            search: '',
            selectedIds: [],
            targetStageId: '',
            targetStageTitle: '',
        });
        setCandidatePickerRows([]);
        setCandidatePickerLoading(false);
        setCandidatePickerSubmitting(false);
    }, []);

    const loadAvailableCandidates = useCallback(async (searchText = '') => {
        if (selectedJobId === 'all') {
            setCandidatePickerRows([]);
            return;
        }

        const requestId = ++candidatePickerRequestRef.current;
        setCandidatePickerLoading(true);

        try {
            const params = new URLSearchParams();
            params.set('viewMode', candidatePickerViewMode);
            params.set('page', '1');
            params.set('pageSize', '100');

            const query = String(searchText || '').trim();
            if (query) {
                params.set('search', query);
            }

            const res = await fetchData(`/api/candidates/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);

            if (requestId !== candidatePickerRequestRef.current) return;

            const mapped = list
                .map((candidate) => ({
                    ...candidate,
                    id: normalizeId(candidate?._id || candidate?.id),
                }))
                .filter((candidate) => candidate.id);

            setCandidatePickerRows(mapped);
        } catch (err) {
            if (requestId !== candidatePickerRequestRef.current) return;
            console.error('[HiringPipeline] Failed to load available candidates:', err);
            setCandidatePickerRows([]);
            setAlertModal({
                open: true,
                title: 'Error',
                message: err?.message || 'Unable to load existing candidates.',
                severity: 'error',
            });
        } finally {
            if (requestId === candidatePickerRequestRef.current) {
                setCandidatePickerLoading(false);
            }
        }
    }, [candidatePickerViewMode, selectedJobId]);

    useEffect(() => {
        if (!addCandidateModal.open) return undefined;

        const handle = setTimeout(() => {
            void loadAvailableCandidates(addCandidateModal.search);
        }, 300);

        return () => clearTimeout(handle);
    }, [addCandidateModal.open, addCandidateModal.search, loadAvailableCandidates]);

    useEffect(() => {
        if (!addCandidateModal.open) return;
        setAddCandidateModal((prev) => ({ ...prev, selectedIds: [] }));
    }, [selectedJobId, addCandidateModal.open]);

    const toggleAvailableCandidateSelection = useCallback((candidateId) => {
        setAddCandidateModal((prev) => {
            const candidateKey = String(candidateId || '');
            const exists = prev.selectedIds.includes(candidateKey);

            return {
                ...prev,
                selectedIds: exists
                    ? prev.selectedIds.filter((id) => id !== candidateKey)
                    : [...prev.selectedIds, candidateKey],
            };
        });
    }, []);

    const submitAddCandidatesToPipeline = useCallback(async () => {
        if (selectedJobId === 'all') {
            openAlertModal(
                'Select a Job',
                'Choose a specific job before adding existing candidates to the pipeline.',
                'info'
            );
            return;
        }

        const candidateIds = (addCandidateModal.selectedIds || []).filter(isValidMongoId);
        if (!candidateIds.length) {
            openAlertModal('Select Candidates', 'Choose at least one candidate to continue.', 'warning');
            return;
        }

        setCandidatePickerSubmitting(true);
        try {
            const targetStageId = isValidMongoId(addCandidateModal.targetStageId)
                ? String(addCandidateModal.targetStageId)
                : '';
            const targetStageTitle = String(addCandidateModal.targetStageTitle || '').trim() || 'first stage';

            const res = await fetchData('/api/candidates/assign-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidateIds,
                    jobIds: [selectedJobId],
                    ...(targetStageId ? { targetStageId } : {}),
                }),
            });

            const updatedCount = Number(res?.updated || candidateIds.length);
            const skippedCount = Array.isArray(res?.skipped) ? res.skipped.length : 0;

            closeAddCandidateModal();
            await loadPipeline();

            openAlertModal(
                'Success',
                `${updatedCount} candidate${updatedCount === 1 ? '' : 's'} added to ${selectedJobLabel}`
                + ` in ${targetStageTitle}.`
                + (skippedCount
                    ? ` ${skippedCount} candidate${skippedCount === 1 ? '' : 's'} were already assigned and skipped.`
                    : ''),
                'success'
            );
        } catch (err) {
            console.error('[HiringPipeline] Failed to add candidates to pipeline:', err);
            openAlertModal('Error', err?.message || 'Unable to add candidates to the pipeline.', 'error');
        } finally {
            setCandidatePickerSubmitting(false);
        }
    }, [
        addCandidateModal.selectedIds,
        addCandidateModal.targetStageId,
        addCandidateModal.targetStageTitle,
        closeAddCandidateModal,
        loadPipeline,
        openAlertModal,
        selectedJobId,
        selectedJobLabel,
    ]);

    const openMoveFeedbackModal = useCallback((cardId, targetStageId) => {
        const card = cards.find((item) => item.id === cardId);
        if (!card || !targetStageId) return;
        if (card.activeStageId === targetStageId) return;

        const orderedStageResults = Array.isArray(card.stageResults) ? card.stageResults : [];
        const targetStage = orderedStageResults.find((sr) => sr.stageId === targetStageId);
        if (!targetStage) {
            openAlertModal('Error', 'Target stage not found for this candidate.', 'error');
            return;
        }

        setMoveFeedbackModal({
            open: true,
            cardId,
            targetStageId,
            targetStageTitle: targetStage.stageTitle || stageTitleById.get(targetStageId) || 'Stage',
            feedbackSource: FEEDBACK_SOURCE_CHOICES[1],
            feedbackText: '',
        });
    }, [cards, openAlertModal, stageTitleById]);

    const closeMoveFeedbackModal = useCallback(() => {
        setMoveFeedbackModal((prev) => ({
            ...prev,
            open: false,
            feedbackSource: FEEDBACK_SOURCE_CHOICES[1],
            feedbackText: '',
        }));
    }, []);

    const moveCandidateToStage = useCallback(async (cardId, targetStageId, feedbackText) => {
        const card = cards.find((item) => item.id === cardId);
        if (!card || !card.atsId || !targetStageId) return false;
        if (card.activeStageId === targetStageId) return false;

        const trimmedFeedback = String(feedbackText || '').trim();
        if (!trimmedFeedback) {
            openAlertModal('Validation', 'Feedback is mandatory to move candidate stage.', 'warning');
            return false;
        }

        const orderedStageResults = Array.isArray(card.stageResults) ? card.stageResults : [];
        const targetIndex = orderedStageResults.findIndex((sr) => sr.stageId === targetStageId);
        if (targetIndex === -1) return false;

        const updates = orderedStageResults
            .map((sr, index) => {
                const currentStatus = normalizeStageStatus(sr.stageStatus);
                let nextStatus = currentStatus;

                if (index === targetIndex) nextStatus = 'Selected';
                if (index > targetIndex) nextStatus = DEFAULT_STAGE_STATUS;

                if (nextStatus === currentStatus) return null;

                return {
                    stageResultId: sr.id,
                    stageStatus: nextStatus,
                    remarkOrFeedback: index === targetIndex ? trimmedFeedback : '',
                };
            })
            .filter(Boolean);

        if (!updates.length) return false;

        setMovingCardId(cardId);
        try {
            for (const update of updates) {
                await fetchData(
                    `/api/candidates/ats/${card.atsId}/stageresult/${update.stageResultId}`,
                    {
                        method: 'PUT',
                        body: JSON.stringify({
                            stageStatus: update.stageStatus,
                            remarkOrFeedback: update.remarkOrFeedback,
                        }),
                    }
                );
            }
            await loadPipeline();
            return true;
        } catch (err) {
            console.error('[HiringPipeline] Failed to move candidate:', err);
            openAlertModal('Error', err?.message || 'Unable to update candidate stage.', 'error');
            return false;
        } finally {
            setMovingCardId('');
        }
    }, [cards, loadPipeline, openAlertModal]);

    const handleMoveFeedbackSubmit = useCallback(async () => {
        const cardId = moveFeedbackModal.cardId;
        const targetStageId = moveFeedbackModal.targetStageId;
        const source = String(moveFeedbackModal.feedbackSource || '').trim();
        const feedback = String(moveFeedbackModal.feedbackText || '').trim();
        if (!source || !feedback) {
            openAlertModal(
                'Validation',
                'Select feedback source and enter candidate feedback to continue.',
                'warning'
            );
            return;
        }

        const mergedFeedback = `${source}: ${feedback}`;
        const moved = await moveCandidateToStage(cardId, targetStageId, mergedFeedback);
        if (!moved) return;
        closeMoveFeedbackModal();
    }, [closeMoveFeedbackModal, moveCandidateToStage, moveFeedbackModal, openAlertModal]);

    const getPreviousStageResult = useCallback((card) => {
        const orderedStageResults = Array.isArray(card?.stageResults) ? card.stageResults : [];
        const activeIndex = orderedStageResults.findIndex(
            (sr) => sr?.stageId === card?.activeStageId
        );
        if (activeIndex <= 0) return null;
        return orderedStageResults[activeIndex - 1] || null;
    }, []);

    const openStageStatusModal = useCallback((event, card) => {
        event?.stopPropagation?.();
        if (!card || !card.atsId || !card.activeStageId) return;

        const activeStageResult = (card.stageResults || []).find(
            (sr) => sr.stageId === card.activeStageId
        );
        const previousStage = getPreviousStageResult(card);
        if (!activeStageResult?.id) {
            openAlertModal('Error', 'Active stage details not found for this candidate.', 'error');
            return;
        }

        const currentStatus = normalizeStageStatus(activeStageResult.stageStatus);
        setStageStatusModal({
            open: true,
            cardId: card.id,
            atsId: card.atsId,
            stageResultId: activeStageResult.id,
            candidateName: card.fullName || 'Candidate',
            stageTitle:
                activeStageResult.stageTitle ||
                stageTitleById.get(card.activeStageId) ||
                'Stage',
            currentStatus,
            currentFeedback: activeStageResult.remarkOrFeedback || '',
            previousStageId: previousStage?.stageId || '',
            previousStageTitle: previousStage?.stageTitle || '',
        });
    }, [getPreviousStageResult, openAlertModal, stageTitleById]);

    const closeStageStatusModal = useCallback(() => {
        setStageStatusModal(EMPTY_STAGE_STATUS_MODAL);
    }, []);

    const toggleCardSelection = useCallback((cardId) => {
        if (!cardId) return;
        setSelectedCardIds((prev) => {
            if (prev.includes(cardId)) {
                return prev.filter((id) => id !== cardId);
            }
            return [...prev, cardId];
        });
    }, []);

    const toggleStageSelection = useCallback((stageCardIds = [], shouldSelect = true) => {
        if (!stageCardIds.length) return;
        setSelectedCardIds((prev) => {
            const next = new Set(prev);
            if (shouldSelect) {
                stageCardIds.forEach((id) => next.add(id));
            } else {
                stageCardIds.forEach((id) => next.delete(id));
            }
            return Array.from(next);
        });
    }, []);

    const resetBulkSelection = useCallback(() => {
        setSelectedCardIds([]);
        setBulkActionMode('');
        setBulkScheduleModal({
            open: false,
            scheduleAt: toLocalDateTimeInputValue(new Date(Date.now() + 10 * 60 * 1000)),
        });
        setInterviewScheduleModalOpen(false);
        setInterviewScheduleDrafts([]);
        setInterviewScheduleSearch('');
        setBulkInterviewScheduleAt(dayjs().add(10, 'minute'));
    }, []);

    useEffect(() => {
        resetBulkSelection();
    }, [resetBulkSelection, selectedJobId]);

    const navigateToInterviewRoute = useCallback((params) => {
        const nextParams =
            params instanceof URLSearchParams
                ? new URLSearchParams(params.toString())
                : new URLSearchParams(params);
        nextParams.set('view', 'schedule');
        navigate(`/interviews/schedule/?${nextParams.toString()}`);
    }, [navigate]);

    const executeBulkInterviewSchedule = useCallback(() => {
        const targetCards = (selectedCards || []).filter((card) => isValidMongoId(card?.atsId));
        if (!targetCards.length) {
            openAlertModal('Validation', 'Select valid candidates to schedule interview.', 'warning');
            return;
        }

        if (targetCards.length === 1) {
            const card = targetCards[0];
            const params = new URLSearchParams();
            params.set('atsid', card.atsId);
            if (card.candidateId) params.set('cid', card.candidateId);
            if (card.jobId) params.set('jid', card.jobId);
            navigateToInterviewRoute(params);
            resetBulkSelection();
            return;
        }

        const baseTime = dayjs().add(10, 'minute');
        setBulkInterviewScheduleAt(baseTime);
        setInterviewScheduleDrafts(buildInterviewScheduleDrafts(targetCards, baseTime));
        setInterviewScheduleSearch('');
        setInterviewScheduleModalOpen(true);
    }, [navigateToInterviewRoute, openAlertModal, resetBulkSelection, selectedCards]);

    const updateInterviewScheduleTime = useCallback((draftId, nextVal) => {
        setInterviewScheduleDrafts((prev) => (
            (prev || []).map((item) => (
                item.id === draftId ? { ...item, scheduleAt: nextVal } : item
            ))
        ));
    }, []);

    const updateInterviewDuration = useCallback((draftId, nextVal) => {
        setInterviewScheduleDrafts((prev) => (
            (prev || []).map((item) => (
                item.id === draftId
                    ? { ...item, durationMinutes: Number(nextVal) || 45 }
                    : item
            ))
        ));
    }, []);

    const continueToInterviewScheduler = useCallback(() => {
        const atsIds = (interviewScheduleDrafts || [])
            .map((item) => item?.atsId)
            .filter((id) => isValidMongoId(id));

        if (!atsIds.length) {
            openAlertModal('Validation', 'No valid candidates to schedule.', 'warning');
            return;
        }

        const invalidSchedules = (interviewScheduleDrafts || []).filter(
            (item) => !dayjs(item?.scheduleAt).isValid()
        );
        if (invalidSchedules.length) {
            openAlertModal(
                'Validation',
                'Please select interview date & time for all candidates.',
                'warning'
            );
            return;
        }

        const params = buildInterviewScheduleParams({
            drafts: interviewScheduleDrafts,
            jobId: selectedJob?.id,
            fallbackScheduleAt: bulkInterviewScheduleAt,
        });
        if (atsIds.length) {
            params.set('atsids', atsIds.join(','));
        }
        setInterviewScheduleModalOpen(false);
        navigate(`/interviews/schedule/?${params.toString()}`);
        resetBulkSelection();
    }, [
        bulkInterviewScheduleAt,
        interviewScheduleDrafts,
        navigate,
        openAlertModal,
        resetBulkSelection,
        selectedJob?.id,
    ]);




    const submitBulkScheduleCalls = useCallback(async () => {
        const targetCards = (selectedCards || []).filter(
            (card) => isValidMongoId(card?.candidateId) && isValidMongoId(card?.jobId)
        );
        if (!targetCards.length) {
            openAlertModal('Validation', 'Select valid candidates to schedule call.', 'warning');
            return;
        }

        const scheduleDate = new Date(bulkScheduleModal.scheduleAt);
        if (Number.isNaN(scheduleDate.getTime()) || scheduleDate.getTime() <= Date.now()) {
            openAlertModal(
                'Validation',
                'Select a valid future date/time for scheduling call(s).',
                'warning'
            );
            return;
        }

        setBulkActionLoading(true);
        try {
            await fetchData('/api/ai/call/schedule/', {
                method: 'POST',
                body: JSON.stringify({
                    candidates: targetCards.map((card) => ({
                        _id: card.candidateId,
                        jobId: card.jobId,
                    })),
                    scheduleTime: scheduleDate.toISOString(),
                }),
            });
            setBulkScheduleModal((prev) => ({ ...prev, open: false }));
            openAlertModal('Success', 'Call schedule updated for selected candidates.', 'success');
            resetBulkSelection();
            await loadPipeline();
        } catch (err) {
            console.error('[HiringPipeline] Failed to bulk schedule calls:', err);
            openAlertModal('Error', err?.message || 'Unable to schedule calls.', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    }, [bulkScheduleModal.scheduleAt, loadPipeline, openAlertModal, resetBulkSelection, selectedCards]);

    const executeBulkClearSchedule = useCallback(async () => {
        const targetCards = (selectedCards || []).filter(
            (card) => isValidMongoId(card?.candidateId) && isValidMongoId(card?.jobId)
        );
        if (!targetCards.length) {
            openAlertModal('Validation', 'Select valid candidates to clear schedule.', 'warning');
            return;
        }

        setBulkActionLoading(true);
        try {
            await fetchData('/api/ai/call/schedule/clear/', {
                method: 'DELETE',
                body: JSON.stringify({
                    candidates: targetCards.map((card) => ({
                        _id: card.candidateId,
                        jobId: card.jobId,
                    })),
                }),
            });
            openAlertModal('Success', 'Schedule cleared for selected candidates.', 'success');
            resetBulkSelection();
            await loadPipeline();
        } catch (err) {
            console.error('[HiringPipeline] Failed to clear schedules:', err);
            openAlertModal('Error', err?.message || 'Unable to clear schedules.', 'error');
        } finally {
            setBulkActionLoading(false);
        }
    }, [loadPipeline, openAlertModal, resetBulkSelection, selectedCards]);

    const executeBulkTriggerCalls = useCallback(async () => {
        const targetCards = (selectedCards || []).filter(
            (card) => isValidMongoId(card?.candidateId) && isValidMongoId(card?.jobId)
        );
        if (!targetCards.length) {
            openAlertModal('Validation', 'Select valid candidates to trigger AI calls.', 'warning');
            return;
        }

        setBulkActionLoading(true);
        setUiState({ loadingMsg: 'Triggering AI calls, please wait...' });
        try {
            const failures = [];

            for (const card of targetCards) {
                try {
                    await fetchData(`/api/ai/call/trigger/plivo/${card.candidateId}/${card.jobId}/`);
                } catch (err) {
                    failures.push({
                        name: card.fullName || 'Candidate',
                        message: err?.message || 'Unknown error',
                    });
                    console.error('[HiringPipeline] Failed to trigger AI call:', err);
                }
            }

            if (failures.length) {
                openAlertModal(
                    'Partial Success',
                    `AI calls were triggered for ${targetCards.length - failures.length} candidate(s). `
                    + `Failed for ${failures.length}: ${failures.map((item) => item.name).join(', ')}.`,
                    'warning'
                );
            } else {
                openAlertModal('Success', 'AI call(s) triggered successfully.', 'success');
            }

            resetBulkSelection();
            await loadPipeline();
        } finally {
            setUiState({ loadingMsg: null });
            setBulkActionLoading(false);
        }
    }, [loadPipeline, openAlertModal, resetBulkSelection, selectedCards, setUiState]);

    const executeBulkTriggerWhatsApp = useCallback(async () => {
        const targetCards = (selectedCards || []).filter(
            (card) => isValidMongoId(card?.candidateId) && isValidMongoId(card?.jobId)
        );
        if (!targetCards.length) {
            openAlertModal(
                'Validation',
                'Select valid candidates to initiate WhatsApp conversations.',
                'warning'
            );
            return;
        }

        setBulkActionLoading(true);
        setUiState({ loadingMsg: 'Initiating WhatsApp conversations, please wait...' });
        try {
            const failures = [];

            for (const card of targetCards) {
                try {
                    await fetchData(`/api/ai/call/trigger/whatsapp/${card.candidateId}/${card.jobId}/`);
                } catch (err) {
                    failures.push({
                        name: card.fullName || 'Candidate',
                        message: err?.message || 'Unknown error',
                    });
                    console.error('[HiringPipeline] Failed to trigger WhatsApp:', err);
                }
            }

            if (failures.length) {
                openAlertModal(
                    'Partial Success',
                    `WhatsApp was initiated for ${targetCards.length - failures.length} candidate(s). `
                    + `Failed for ${failures.length}: ${failures.map((item) => item.name).join(', ')}.`,
                    'warning'
                );
            } else {
                openAlertModal(
                    'Success',
                    'WhatsApp conversation(s) initiated successfully.',
                    'success'
                );
            }

            resetBulkSelection();
            await loadPipeline();
        } finally {
            setUiState({ loadingMsg: null });
            setBulkActionLoading(false);
        }
    }, [loadPipeline, openAlertModal, resetBulkSelection, selectedCards, setUiState]);

    const openDownloadReportModal = useCallback(() => {
        if (selectedJobId === 'all' || !selectedJob?.id) {
            openAlertModal(
                'Select a Job',
                'Choose a specific job before downloading the report.',
                'info'
            );
            return;
        }

        const stageIds = (stageColumns || [])
            .map((stage) => String(stage?.id || ''))
            .filter(Boolean);

        if (!stageIds.length) {
            openAlertModal('Validation', 'No stages found for the selected job.', 'warning');
            return;
        }

        setReportModal({
            open: true,
            fromDate: dayjs().subtract(6, 'day'),
            toDate: dayjs(),
            stageIds,
        });
    }, [openAlertModal, selectedJob, selectedJobId, stageColumns]);

    const closeDownloadReportModal = useCallback(() => {
        setReportModal((prev) => ({ ...prev, open: false }));
    }, []);

    const toggleReportStageSelection = useCallback((stageId, isChecked) => {
        const normalizedStageId = String(stageId || '');
        if (!normalizedStageId) return;

        setReportModal((prev) => {
            const existingIds = Array.isArray(prev?.stageIds) ? prev.stageIds : [];
            const hasStage = existingIds.includes(normalizedStageId);

            if (isChecked && !hasStage) {
                return { ...prev, stageIds: [...existingIds, normalizedStageId] };
            }
            if (!isChecked && hasStage) {
                return {
                    ...prev,
                    stageIds: existingIds.filter((id) => id !== normalizedStageId),
                };
            }
            return prev;
        });
    }, []);

    const downloadReport = useCallback(async () => {
        if (selectedJobId === 'all' || !selectedJob?.id) return;

        const fromDate = reportModal?.fromDate;
        const toDate = reportModal?.toDate;
        const normalizedFromDate = dayjs(fromDate);
        const normalizedToDate = dayjs(toDate);
        if (!normalizedFromDate.isValid() || !normalizedToDate.isValid()) {
            openAlertModal('Validation', 'Please select a valid date range.', 'warning');
            return;
        }
        if (normalizedFromDate.isAfter(normalizedToDate, 'day')) {
            openAlertModal('Validation', '"From" date must be before "To" date.', 'warning');
            return;
        }

        const stageIds = [...new Set(
            (reportModal?.stageIds || [])
                .map((stageId) => String(stageId || ''))
                .filter(isValidMongoId)
        )];
        if (!stageIds.length) {
            openAlertModal('Validation', 'Select at least one stage for the report.', 'warning');
            return;
        }

        const trackerSourceCards = selectedCardCount > 0 ? selectedCards : filteredCards;
        const candidateIds = [...new Set(
            (trackerSourceCards || [])
                .map((card) => String(card?.candidateId || ''))
                .filter(isValidMongoId)
        )];

        if (!candidateIds.length) {
            openAlertModal('Validation', 'No valid candidates found to download report.', 'warning');
            return;
        }

        setBulkActionLoading(true);
        setUiState({ loadingMsg: 'Preparing report, please wait...' });
        try {
            const params = new URLSearchParams();
            params.set('ids', candidateIds.join(','));
            params.set('jobId', String(selectedJob.id));
            params.set('stageIds', stageIds.join(','));
            params.set('from', normalizedFromDate.format('DD/MM/YYYY'));
            params.set('to', normalizedToDate.format('DD/MM/YYYY'));

            const blob = await fetchData(
                `/api/candidates/stage-report/?${params.toString()}`,
                {
                    method: 'GET',
                    headers: {
                        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    },
                }
            );

            const safeTitle = String(selectedJob?.title || selectedJob?.internalTitle || 'job')
                .replace(/[^\w.-]+/g, '_')
                .slice(0, 80) || 'job';

            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `Report_job__${safeTitle}__${selectedJob.id}.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.URL.revokeObjectURL(url);
            closeDownloadReportModal();
        } catch (err) {
            console.error('[HiringPipeline] Failed to download report:', err);
            const errorMessage =
                (typeof err === 'string' ? err : '')
                || err?.error
                || err?.message
                || 'Could not download report.';
            openAlertModal('Error', errorMessage, 'error');
        } finally {
            setUiState({ loadingMsg: null });
            setBulkActionLoading(false);
        }
    }, [
        closeDownloadReportModal,
        filteredCards,
        openAlertModal,
        reportModal?.fromDate,
        reportModal?.stageIds,
        reportModal?.toDate,
        selectedCardCount,
        selectedCards,
        selectedJob,
        selectedJobId,
        setUiState,
    ]);

    const handleBulkActionClick = useCallback((mode) => {
        if (!mode) return;
        if (bulkActionLoading) return;

        if (bulkActionMode !== mode) {
            setBulkActionMode(mode);
            setSelectedCardIds([]);
            return;
        }

        if (!selectedCardCount) {
            setBulkActionMode('');
            setSelectedCardIds([]);
            return;
        }

        if (mode === BULK_ACTION_MODES.INTERVIEW) {
            executeBulkInterviewSchedule();
            return;
        }
        if (mode === BULK_ACTION_MODES.SCHEDULE_CALL) {
            setBulkScheduleModal({
                open: true,
                scheduleAt: toLocalDateTimeInputValue(new Date(Date.now() + 10 * 60 * 1000)),
            });
            return;
        }
        if (mode === BULK_ACTION_MODES.CLEAR_SCHEDULE) {
            void executeBulkClearSchedule();
            return;
        }
        if (mode === BULK_ACTION_MODES.TRIGGER_CALL) {
            void executeBulkTriggerCalls();
            return;
        }
        if (mode === BULK_ACTION_MODES.WHATSAPP) {
            void executeBulkTriggerWhatsApp();
        }
    }, [
        bulkActionLoading,
        bulkActionMode,
        executeBulkClearSchedule,
        executeBulkInterviewSchedule,
        executeBulkTriggerCalls,
        executeBulkTriggerWhatsApp,
        selectedCardCount,
    ]);

    const triggerAiCall = (event, card) => {
        event.stopPropagation();
        if (!card?.candidateId || !card?.jobId) {
            openAlertModal('Error', 'Candidate or Job information is missing.', 'error');
            return;
        }
        setConfirmCallModal({ open: true, card });
    };

    const handleConfirmTriggerAiCall = useCallback(async () => {
        const card = confirmCallModal.card;
        setConfirmCallModal({ open: false, card: null });
        if (!card?.candidateId || !card?.jobId) return;

        setActionCardId(card.id);
        try {
            await fetchData(`/api/ai/call/trigger/plivo/${card.candidateId}/${card.jobId}/`);
            openAlertModal('Success', 'AI call triggered successfully.', 'success');
        } catch (err) {
            console.error('[HiringPipeline] Failed to trigger AI call:', err);
            openAlertModal('Error', err?.message || 'Unable to trigger AI call.', 'error');
        } finally {
            setActionCardId('');
        }
    }, [confirmCallModal.card, openAlertModal]);

    const openInterviewScheduler = (event, card) => {
        event.stopPropagation();
        if (!card?.atsId) return;
        const params = new URLSearchParams();
        params.set('atsid', card.atsId);
        if (card.candidateId) params.set('cid', card.candidateId);
        if (card.jobId) params.set('jid', card.jobId);
        navigateToInterviewRoute(params);
    };

    const closeAddCandidateChoiceModal = useCallback(() => {
        setAddCandidateChoiceModalOpen(false);
        setAddCandidateTargetStage(EMPTY_ADD_CANDIDATE_TARGET_STAGE);
    }, []);

    const openExistingCandidateModal = useCallback(() => {
        if (selectedJobId === 'all') {
            openAlertModal(
                'Select a Job',
                'Choose a specific job before adding existing candidates to the pipeline.',
                'info'
            );
            return;
        }

        setAddCandidateChoiceModalOpen(false);
        setAddCandidateModal({
            open: true,
            search: '',
            selectedIds: [],
            targetStageId: String(addCandidateTargetStage?.id || ''),
            targetStageTitle: String(addCandidateTargetStage?.title || ''),
        });
        setCandidatePickerRows([]);
    }, [addCandidateTargetStage?.id, addCandidateTargetStage?.title, openAlertModal, selectedJobId]);

    const openAddCandidate = useCallback((stage) => {
        const stageId = String(stage?.id || '');
        const stageTitle = String(stage?.title || '').trim() || 'first stage';
        setAddCandidateTargetStage({
            id: stageId,
            title: stageTitle,
        });
        setAddCandidateChoiceModalOpen(true);
    }, []);

    const openNewCandidateForm = useCallback(() => {
        setAddCandidateChoiceModalOpen(false);
        const preselectStageId = String(addCandidateTargetStage?.id || '');
        const preselectStageTitle = String(addCandidateTargetStage?.title || '').trim();
        const nextRouteState = {
            ...(preselectStageId ? { preselectStageId } : {}),
            ...(preselectStageTitle ? { preselectStageTitle } : {}),
        };
        setAddCandidateTargetStage(EMPTY_ADD_CANDIDATE_TARGET_STAGE);
        if (selectedJobId !== 'all') {
            navigate('/candidates/new/', {
                state: { preselectJobId: selectedJobId, ...nextRouteState },
            });
            return;
        }
        navigate('/candidates/new/', { state: nextRouteState });
    }, [addCandidateTargetStage?.id, addCandidateTargetStage?.title, navigate, selectedJobId]);

    const moveModalCard = cards.find((item) => item.id === moveFeedbackModal.cardId) || null;
    const addCandidateTargetLabel = String(addCandidateModal.targetStageTitle || '').trim() || 'first stage';
    const noData = !loadingPipeline && !errorMsg && filteredCards.length === 0;

    return (
        <Box
            ref={rootRef}
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 5 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh",
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2,
                    mx: { xs: 2, sm: 3, md: 0 },
                    mt: { xs: 0.5, sm: 1.5, md: 2 },
                    mb: 4,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        Hiring Pipeline
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        gap: 1.5,
                        justifyContent: { xs: 'flex-start', md: 'flex-end' },
                        width: { xs: '100%', md: 'auto' },
                    }}
                >
                    <TextField
                        size="small"
                        label="Search"
                        placeholder="Name, Mobile, Email, Job Title, Skills"
                        value={candidateSearch}
                        onChange={(event) => setCandidateSearch(event.target.value)}
                        sx={{
                            minWidth: { xs: '100%', sm: 240 },
                            backgroundColor: 'background.paper',
                        }}
                    />

                    <Autocomplete
                        size="small"
                        options={jobOptions}
                        value={selectedJobOption}
                        onChange={(_event, next) => setSelectedJobId(next?.id || 'all')}
                        getOptionLabel={(option) => option?.label || ''}
                        isOptionEqualToValue={(option, value) => (
                            String(option?.id) === String(value?.id)
                        )}
                        loading={loadingJobs}
                        disabled={loadingJobs}
                        sx={{
                            minWidth: { xs: '100%', sm: 220 },
                            backgroundColor: 'background.paper',
                        }}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Job"
                                placeholder="Type to search jobs"
                                sx={{ backgroundColor: 'background.paper' }}
                            />
                        )}
                    />

                    <TextField
                        select
                        size="small"
                        label="Relevancy"
                        value={relevancyFilter}
                        onChange={(event) => setRelevancyFilter(event.target.value)}
                        sx={{
                            minWidth: { xs: '100%', sm: 170 },
                            backgroundColor: 'background.paper',
                        }}
                    >
                        <MenuItem value="all">All Relevancy</MenuItem>
                        <MenuItem value="high">High (67-100)</MenuItem>
                        <MenuItem value="medium">Medium (33-66)</MenuItem>
                        <MenuItem value="low">Low (0-32)</MenuItem>
                        <MenuItem value="na">N/A</MenuItem>
                    </TextField>
                </Box>
            </Box>

            <Paper
                elevation={0}
                sx={{
                    p: { xs: 2, sm: 3 },
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: 'background.paper',
                    minHeight: '70vh',
                }}
            >

                {selectedJobId !== 'all' && (
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 1.1,
                            mb: 1.8,
                        }}
                    >
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ScheduleOutlined />}
                            onClick={() => handleBulkActionClick(BULK_ACTION_MODES.INTERVIEW)}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color:
                                    bulkActionMode === BULK_ACTION_MODES.INTERVIEW
                                        ? (selectedCardCount ? 'success.main' : 'warning.main')
                                        : 'text.primary',
                            }}
                        >
                            {bulkActionMode === BULK_ACTION_MODES.INTERVIEW
                                ? (selectedCardCount ? 'Schedule Interview' : 'Remove selection mode')
                                : 'Select to Schedule Interview'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ScheduleOutlined />}
                            onClick={() => handleBulkActionClick(BULK_ACTION_MODES.SCHEDULE_CALL)}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color:
                                    bulkActionMode === BULK_ACTION_MODES.SCHEDULE_CALL
                                        ? (selectedCardCount ? 'success.main' : 'warning.main')
                                        : 'text.primary',
                            }}
                        >
                            {bulkActionMode === BULK_ACTION_MODES.SCHEDULE_CALL
                                ? (selectedCardCount ? 'Schedule Call(s)' : 'Remove selection mode')
                                : 'Select to Schedule Call(s)'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CancelOutlined />}
                            onClick={() => handleBulkActionClick(BULK_ACTION_MODES.CLEAR_SCHEDULE)}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color:
                                    bulkActionMode === BULK_ACTION_MODES.CLEAR_SCHEDULE
                                        ? (selectedCardCount ? 'success.main' : 'warning.main')
                                        : 'text.primary',
                            }}
                        >
                            {bulkActionMode === BULK_ACTION_MODES.CLEAR_SCHEDULE
                                ? (selectedCardCount ? 'Clear Schedule(s)' : 'Remove selection mode')
                                : 'Select to Clear Schedule(s)'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Phone />}
                            onClick={() => handleBulkActionClick(BULK_ACTION_MODES.TRIGGER_CALL)}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color:
                                    bulkActionMode === BULK_ACTION_MODES.TRIGGER_CALL
                                        ? (selectedCardCount ? 'success.main' : 'warning.main')
                                        : 'text.primary',
                            }}
                        >
                            {bulkActionMode === BULK_ACTION_MODES.TRIGGER_CALL
                                ? (selectedCardCount ? 'Trigger Call(s)' : 'Remove selection mode')
                                : 'Select to Trigger Call(s)'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<WhatsApp />}
                            onClick={() => handleBulkActionClick(BULK_ACTION_MODES.WHATSAPP)}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color:
                                    bulkActionMode === BULK_ACTION_MODES.WHATSAPP
                                        ? (selectedCardCount ? 'success.main' : 'warning.main')
                                        : 'text.primary',
                            }}
                        >
                            {bulkActionMode === BULK_ACTION_MODES.WHATSAPP
                                ? (selectedCardCount ? 'Initiate WhatsApp' : 'Remove selection mode')
                                : 'Select to Initiate WhatsApp'}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<Download />}
                            onClick={openDownloadReportModal}
                            disabled={loadingPipeline || bulkActionLoading}
                            sx={{
                                ...SELECTION_ACTION_BUTTON_SX,
                                color: 'warning.dark',
                                borderColor: alpha(theme.palette.warning.main, 0.45),
                            }}
                        >
                            Download Report
                        </Button>
                        {bulkSelectionEnabled && (
                            <Typography
                                variant="caption"
                                sx={{ display: 'flex', alignItems: 'center', color: 'text.secondary' }}
                            >
                                Selected: {selectedCardCount}
                            </Typography>
                        )}
                    </Box>
                )}

                {loadingPipeline && (
                    <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress />
                    </Box>
                )}

                {!loadingPipeline && errorMsg && (
                    <Box sx={{ py: 6 }}>
                        <Typography color="error">{errorMsg}</Typography>
                    </Box>
                )}

                {!loadingPipeline && !errorMsg && (
                    <Box sx={{ overflowX: 'auto', pb: 1 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'center',
                                gap: { xs: 1.5, lg: 2 },
                                width: '100%',
                                minWidth: 'max-content',
                                px: { xs: 0.25, sm: 0.5, lg: 1 },
                                mx: 'auto',
                            }}
                        >
                            {stageColumns.map((stage, index) => {
                                const stageCards = cardsByStage.get(stage.id) || [];
                                const stageCardIds = stageCards.map((card) => String(card.id));
                                const stageSelectedCount = stageCardIds.filter((id) => selectedCardIdSet.has(id)).length;
                                const stageAllSelected = stageCardIds.length > 0 && stageSelectedCount === stageCardIds.length;
                                const stageIndeterminate = stageSelectedCount > 0 && stageSelectedCount < stageCardIds.length;
                                const stageTotalPages = Math.max(
                                    1,
                                    Math.ceil(stageCards.length / CARD_PAGE_LIMIT)
                                );
                                const stageCurrentPage = Math.min(
                                    Math.max(Number(stagePageById?.[stage.id] || 1), 1),
                                    stageTotalPages
                                );
                                const pageStart = (stageCurrentPage - 1) * CARD_PAGE_LIMIT;
                                const paginatedStageCards = stageCards.slice(
                                    pageStart,
                                    pageStart + CARD_PAGE_LIMIT
                                );
                                const stageDot = STAGE_DOT_COLORS[index % STAGE_DOT_COLORS.length];

                                return (
                                    <Box
                                        key={stage.id}
                                        sx={{
                                            width: { xs: 296, sm: 310, lg: 330 },
                                            flexShrink: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            borderRadius: 2,
                                            border: '1px dashed',
                                            borderColor: alpha(theme.palette.text.primary, 0.25),
                                            p: 1.2,
                                        }}
                                    >
                                        <Box
                                            sx={{ display: 'flex', alignItems: 'center', gap: 1.1, minHeight: 64, px: 0.5 }}><Box sx={{ width: 13, height: 13, borderRadius: '50%', backgroundColor: stageDot, flexShrink: 0 }}
                                            />
                                            <Typography
                                                variant="h6"
                                                sx={{
                                                    fontWeight: 700,
                                                    fontSize: 18,
                                                    lineHeight: 1.25,
                                                    flex: 1,
                                                    minWidth: 0,
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: 2,
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                }}
                                            >
                                                {stage.title}
                                            </Typography>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 0.8,
                                                    flexShrink: 0,
                                                }}
                                            >
                                                {bulkSelectionEnabled && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                                                        <Checkbox
                                                            size="small"
                                                            checked={stageAllSelected}
                                                            indeterminate={stageIndeterminate}
                                                            disabled={bulkActionLoading || !stageCardIds.length}
                                                            onClick={(event) => event.stopPropagation()}
                                                            onChange={() => toggleStageSelection(stageCardIds, !stageAllSelected)}
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            sx={{ color: 'text.secondary', fontWeight: 600 }}
                                                        >
                                                            All
                                                        </Typography>
                                                    </Box>
                                                )}
                                                <Chip
                                                    size="small"
                                                    label={stageCards.length}
                                                    sx={{
                                                        backgroundColor: alpha(theme.palette.text.secondary, 0.12),
                                                        color: 'text.secondary',
                                                        fontWeight: 600,
                                                        minWidth: 30,
                                                        width: 'fit-content',
                                                        maxWidth: 'none',
                                                        flexShrink: 0,
                                                        alignSelf: 'flex-start',
                                                        mt: 0.15,
                                                        '& .MuiChip-label': {
                                                            px: 1,
                                                            whiteSpace: 'nowrap',
                                                            overflow: 'visible',
                                                            textOverflow: 'clip',
                                                        },
                                                    }}
                                                />
                                            </Box>
                                        </Box>

                                        <Box
                                            sx={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                flex: 1,
                                                minHeight: 480,
                                                mt: 1.1,
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                                <Box sx={{ display: 'grid', gap: 1.2, mb: 1.2 }}>
                                                    {paginatedStageCards.map((card) => {
                                                        const statusPalette = getStatusPalette(
                                                            theme,
                                                            card.activeStageStatus
                                                        );
                                                        const relevancyDetails = relevancyByJob?.[card.jobId]?.[card.candidateId] || null;
                                                        const relevancyScore = normalizeRelevancyNumber(
                                                            relevancyDetails?.candidateRelevancyToJob
                                                        );
                                                        const relevancyPalette = getRelevancyPalette(
                                                            theme,
                                                            relevancyScore
                                                        );
                                                        const relevancyLabel = Number.isFinite(relevancyScore)
                                                            ? `${relevancyScore}%`
                                                            : 'N/A';
                                                        const busy =
                                                            movingCardId === card.id ||
                                                            actionCardId === card.id ||
                                                            bulkActionLoading;
                                                        const selectedInBulk = selectedCardIds.includes(card.id);

                                                        return (
                                                            <Paper
                                                                key={card.id}
                                                                onClick={() => {
                                                                    if (bulkSelectionEnabled) {
                                                                        toggleCardSelection(card.id);
                                                                        return;
                                                                    }
                                                                    navigate(`/candidates/${card.candidateId}/`);
                                                                }}
                                                                elevation={0}
                                                                sx={{
                                                                    width: '100%',
                                                                    maxWidth: '100%',
                                                                    minWidth: 0,
                                                                    p: 1.6,
                                                                    my: 1,
                                                                    borderRadius: 2.2,
                                                                    border: '1px solid',
                                                                    borderColor: selectedInBulk
                                                                        ? alpha(theme.palette.primary.main, 0.7)
                                                                        : alpha(theme.palette.divider, 0.9),
                                                                    backgroundColor: 'background.paper',
                                                                    cursor: busy
                                                                        ? 'progress'
                                                                        : 'pointer',
                                                                    overflow: 'hidden',
                                                                    transition: 'all 0.18s ease',
                                                                    '&:hover': {
                                                                        borderColor: alpha(theme.palette.primary.main, 0.5),
                                                                        boxShadow: `0 8px 22px ${alpha(theme.palette.common.black, 0.12)}`,
                                                                    },
                                                                }}
                                                            >
                                                                <Box
                                                                    sx={{
                                                                        display: 'flex',
                                                                        justifyContent: 'space-between',
                                                                        gap: 1.2,
                                                                        alignItems: 'flex-start',
                                                                    }}
                                                                >
                                                                    <Box
                                                                        sx={{
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: 1.2,
                                                                            minWidth: 0,
                                                                            flex: 1,
                                                                        }}
                                                                    >
                                                                        {bulkSelectionEnabled && (
                                                                            <Checkbox
                                                                                size="small"
                                                                                checked={selectedInBulk}
                                                                                onClick={(event) => event.stopPropagation()}
                                                                                onChange={() => toggleCardSelection(card.id)}
                                                                                disabled={busy}
                                                                            />
                                                                        )}
                                                                        <Avatar
                                                                            sx={{
                                                                                width: 38,
                                                                                height: 38,
                                                                                fontSize: 13,
                                                                                fontWeight: 700,
                                                                                backgroundColor: alpha(stageDot, 0.2),
                                                                                color: stageDot,
                                                                            }}
                                                                        >
                                                                            {getNameInitials(card.fullName)}
                                                                        </Avatar>
                                                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                                                            <Typography
                                                                                variant="subtitle1"
                                                                                sx={{ fontWeight: 700 }}
                                                                                noWrap
                                                                            >
                                                                                {card.fullName}
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="body2"
                                                                                color="text.secondary"
                                                                                noWrap
                                                                            >
                                                                                {card.jobTitle}
                                                                            </Typography>
                                                                        </Box>
                                                                    </Box>

                                                                    <Box
                                                                        sx={{
                                                                            display: 'flex',
                                                                            flexDirection: 'column',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            gap: 0.8,
                                                                            flexShrink: 0,
                                                                            minWidth: 96,
                                                                        }}
                                                                    >
                                                                        <Chip
                                                                            size="small"
                                                                            label={card.activeStageStatus}
                                                                            onClick={
                                                                                busy || bulkSelectionEnabled
                                                                                    ? undefined
                                                                                    : (event) => openStageStatusModal(event, card)
                                                                            }
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                                color: statusPalette.color,
                                                                                backgroundColor: statusPalette.background,
                                                                                border: `1px solid ${statusPalette.border}`,
                                                                                maxWidth: 180,
                                                                                cursor:
                                                                                    busy || bulkSelectionEnabled
                                                                                        ? 'default'
                                                                                        : 'pointer',
                                                                            }}
                                                                        />
                                                                        <Chip
                                                                            size="small"
                                                                            label={relevancyLabel}
                                                                            onClick={(event) => {
                                                                                event.stopPropagation();
                                                                                const payload = buildRelevancyPayload(
                                                                                    relevancyDetails,
                                                                                    card.fullName
                                                                                );
                                                                                setSelectedRelevancy(payload);
                                                                                setRelevancyModalOpen(true);
                                                                                fetchLatestRelevancy(
                                                                                    card.candidateId,
                                                                                    card.jobId,
                                                                                    card.fullName
                                                                                );
                                                                            }}
                                                                            sx={{
                                                                                fontWeight: 700,
                                                                                color: relevancyPalette.color,
                                                                                backgroundColor: relevancyPalette.background,
                                                                                border: `1px solid ${relevancyPalette.border}`,
                                                                                minWidth: 56,
                                                                                cursor: 'pointer',
                                                                            }}
                                                                        />
                                                                    </Box>
                                                                </Box>

                                                                <Typography
                                                                    variant="caption"
                                                                    color="text.secondary"
                                                                    sx={{ display: 'block', mt: 1.2, mb: 1.3 }}
                                                                    noWrap
                                                                >
                                                                    {card.email || 'No email available'}
                                                                </Typography>

                                                                <Box
                                                                    sx={{
                                                                        display: 'grid',
                                                                        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                                                                        gap: 1,
                                                                    }}
                                                                >
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        startIcon={<Phone fontSize="small" />}
                                                                        disabled={busy || bulkSelectionEnabled}
                                                                        onClick={(event) => triggerAiCall(event, card)}
                                                                        sx={{ textTransform: 'none', width: '100%', minWidth: 0 }}
                                                                    >
                                                                        Call
                                                                    </Button>
                                                                    <Button
                                                                        size="small"
                                                                        variant="outlined"
                                                                        startIcon={<Videocam fontSize="small" />}
                                                                        disabled={busy || bulkSelectionEnabled}
                                                                        onClick={(event) => openInterviewScheduler(event, card)}
                                                                        sx={{ textTransform: 'none', width: '100%', minWidth: 0 }}
                                                                    >
                                                                        Interview
                                                                    </Button>
                                                                </Box>
                                                            </Paper>
                                                        );
                                                    })}

                                                </Box>

                                                {stageTotalPages > 1 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.6, pb: 1 }}>
                                                        <Pagination
                                                            count={stageTotalPages}
                                                            page={stageCurrentPage}
                                                            size="small"
                                                            siblingCount={0}
                                                            boundaryCount={1}
                                                            onChange={(_event, page) => {
                                                                setStagePageById((prev) => ({
                                                                    ...prev,
                                                                    [stage.id]: page,
                                                                }));
                                                            }}
                                                        />
                                                    </Box>
                                                )}

                                                <Button
                                                    variant="text"
                                                    fullWidth
                                                    startIcon={<Add fontSize="small" />}
                                                    onClick={() => openAddCandidate(stage)}
                                                    sx={{
                                                        mt: 'auto',
                                                        py: 1.1,
                                                        borderRadius: 2,
                                                        border: '2px dashed',
                                                        borderColor: alpha(theme.palette.text.primary, 0.3),
                                                        color: 'text.secondary',
                                                        textTransform: 'none',
                                                        '&:hover': {
                                                            borderColor: alpha(theme.palette.primary.main, 0.45),
                                                            color: 'primary.main',
                                                            backgroundColor: alpha(theme.palette.primary.main, 0.05),
                                                        },
                                                    }}
                                                >
                                                    Add candidate
                                                </Button>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>

                        {noData && (
                            <Box sx={{ px: 1, py: 6 }}>
                                <Typography variant="subtitle1">No candidates found</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {selectedJobId === 'all'
                                        ? 'Select a specific job to add an existing candidate, or use Add candidate to create a new one.'
                                        : 'Use Add candidate to attach an existing candidate or create a new one for this pipeline.'}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}
            </Paper>

            <MUIModal
                open={addCandidateChoiceModalOpen}
                onClose={closeAddCandidateChoiceModal}
                contentSx={{
                    width: { xs: '92vw', sm: '620px' },
                    maxWidth: '620px',
                    borderRadius: 3,
                    p: { xs: 2.2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                        Add Candidate
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.2 }}>
                        {selectedJobId === 'all'
                            ? 'Open the new candidate form, or select a specific job first to add from your existing candidate pool.'
                            : `Choose whether you want to attach someone from your existing pool or open the new candidate form. They will be placed in ${addCandidateTargetStage?.title || 'first stage'}.`}
                    </Typography>

                    <Box sx={{ display: 'grid', gap: 1.2 }}>
                        {selectedJobId !== 'all' && (
                            <Paper
                                variant="outlined"
                                onClick={openExistingCandidateModal}
                                sx={{
                                    p: 2,
                                    borderRadius: 2.2,
                                    borderColor: alpha(theme.palette.primary.main, 0.2),
                                    cursor: 'pointer',
                                    transition: 'all 0.18s ease',
                                    '&:hover': {
                                        borderColor: alpha(theme.palette.primary.main, 0.48),
                                        boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                                    },
                                }}
                            >
                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.4 }}>
                                    Add from Existing Candidate
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {`Open the existing candidate picker for ${selectedJobLabel} and place them in ${addCandidateTargetStage?.title || 'first stage'}.`}
                                </Typography>
                            </Paper>
                        )}

                        <Paper
                            variant="outlined"
                            onClick={openNewCandidateForm}
                            sx={{
                                p: 2,
                                borderRadius: 2.2,
                                borderColor: alpha(theme.palette.primary.main, 0.2),
                                cursor: 'pointer',
                                transition: 'all 0.18s ease',
                                '&:hover': {
                                    borderColor: alpha(theme.palette.primary.main, 0.48),
                                    boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                                },
                            }}
                        >
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.4 }}>
                                Add New Candidate
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {selectedJobId === 'all'
                                    ? 'Open the new candidate form.'
                                    : `Open the new candidate form with ${selectedJobLabel} preselected.`}
                            </Typography>
                        </Paper>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.4 }}>
                        <MUIButton
                            onClick={closeAddCandidateChoiceModal}
                            variant="outlined"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Close
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <MUIModal
                open={addCandidateModal.open}
                onClose={closeAddCandidateModal}
                contentSx={{
                    width: { xs: '94vw', sm: '760px' },
                    maxWidth: '760px',
                    borderRadius: 3,
                    p: { xs: 2.2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                        Add Existing Candidates
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.2 }}>
                        Add candidates from your existing pool to <strong>{selectedJobLabel}</strong>.
                        They will enter the <strong>{addCandidateTargetLabel}</strong> stage automatically.
                    </Typography>

                    <TextField
                        size="small"
                        label="Search candidates"
                        placeholder="Name, email, phone, skills"
                        value={addCandidateModal.search}
                        onChange={(event) => {
                            setAddCandidateModal((prev) => ({
                                ...prev,
                                search: event.target.value,
                                selectedIds: [],
                            }));
                        }}
                        fullWidth
                        sx={{ mb: 1.4 }}
                    />

                    {candidatePickerLoading && (
                        <LinearProgress sx={{ borderRadius: 999, mb: 1.4 }} />
                    )}

                    <Box
                        sx={{
                            display: 'grid',
                            gap: 1,
                            maxHeight: 420,
                            overflowY: 'auto',
                            pr: 0.4,
                            pb: 0.2,
                        }}
                    >
                        {!candidatePickerLoading && availableCandidates.length === 0 && (
                            <Box
                                sx={{
                                    py: 4.5,
                                    px: 2,
                                    borderRadius: 2,
                                    border: '1px dashed',
                                    borderColor: alpha(theme.palette.divider, 0.8),
                                    textAlign: 'center',
                                }}
                            >
                                <Typography variant="subtitle2" sx={{ mb: 0.6 }}>
                                    No available candidates found
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {addCandidateModal.search.trim()
                                        ? 'Try a different search. Candidates already assigned to this job are hidden.'
                                        : 'Candidates already assigned to this job are hidden from this list.'}
                                </Typography>
                            </Box>
                        )}

                        {availableCandidates.map((candidate) => {
                            const candidateId = String(candidate.id || candidate._id || '');
                            const fullName =
                                `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() ||
                                candidate?.email ||
                                'Candidate';
                            const selected = addCandidateModal.selectedIds.includes(candidateId);
                            const jobSummary = String(candidate?.jobApplied || '').trim();
                            const phoneText = [candidate?.countryCode, candidate?.phoneNumber]
                                .filter(Boolean)
                                .join(' ')
                                .trim();

                            return (
                                <Paper
                                    key={candidateId}
                                    variant="outlined"
                                    onClick={() => toggleAvailableCandidateSelection(candidateId)}
                                    sx={{
                                        display: 'flex',
                                        gap: 1.2,
                                        alignItems: 'flex-start',
                                        p: 1.2,
                                        borderRadius: 2,
                                        cursor: 'pointer',
                                        borderColor: selected
                                            ? alpha(theme.palette.primary.main, 0.72)
                                            : alpha(theme.palette.divider, 0.9),
                                        backgroundColor: selected
                                            ? alpha(theme.palette.primary.main, 0.06)
                                            : 'background.paper',
                                        transition: 'all 0.18s ease',
                                        '&:hover': {
                                            borderColor: alpha(theme.palette.primary.main, 0.48),
                                            boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.08)}`,
                                        },
                                    }}
                                >
                                    <Checkbox
                                        size="small"
                                        checked={selected}
                                        onClick={(event) => event.stopPropagation()}
                                        onChange={() => toggleAvailableCandidateSelection(candidateId)}
                                    />
                                    <Avatar
                                        sx={{
                                            width: 38,
                                            height: 38,
                                            fontSize: 13,
                                            fontWeight: 700,
                                            backgroundColor: alpha(theme.palette.primary.main, 0.14),
                                            color: theme.palette.primary.main,
                                        }}
                                    >
                                        {getNameInitials(fullName)}
                                    </Avatar>
                                    <Box sx={{ minWidth: 0, flex: 1 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                                            {fullName}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap>
                                            {candidate?.email || phoneText || 'No contact info'}
                                        </Typography>
                                        {phoneText && candidate?.email && (
                                            <Typography
                                                variant="caption"
                                                sx={{ display: 'block', color: 'text.secondary', mt: 0.2 }}
                                            >
                                                {phoneText}
                                            </Typography>
                                        )}
                                        <Typography
                                            variant="caption"
                                            sx={{ display: 'block', color: 'text.secondary', mt: 0.6 }}
                                        >
                                            {jobSummary
                                                ? `Current jobs: ${jobSummary}`
                                                : 'Not applied to any job yet'}
                                        </Typography>
                                    </Box>
                                </Paper>
                            );
                        })}
                    </Box>

                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 1.4,
                            mt: 2.4,
                            flexWrap: 'wrap',
                        }}
                    >
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                            Available: {availableCandidates.length} | Selected: {addCandidateModal.selectedIds.length}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.2 }}>
                            <MUIButton
                                onClick={closeAddCandidateModal}
                                variant="outlined"
                                sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                            >
                                Close
                            </MUIButton>
                            <MUIButton
                                onClick={submitAddCandidatesToPipeline}
                                variant="contained"
                                disabled={
                                    candidatePickerLoading ||
                                    candidatePickerSubmitting ||
                                    addCandidateModal.selectedIds.length === 0
                                }
                                sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                            >
                                {candidatePickerSubmitting ? 'Adding...' : 'Add to Pipeline'}
                            </MUIButton>
                        </Box>
                    </Box>
                </Box>
            </MUIModal>

            <MUIModal
                open={reportModal.open}
                onClose={closeDownloadReportModal}
                contentSx={{
                    width: { xs: '92vw', sm: '560px' },
                    maxWidth: '560px',
                    borderRadius: 3,
                    p: { xs: 2.2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                        Download Report
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.2 }}>
                        {selectedJobLabel}
                    </Typography>

                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <DatePicker
                            label="From (dd/mm/yyyy)"
                            value={reportModal.fromDate}
                            onChange={(value) => {
                                setReportModal((prev) => ({ ...prev, fromDate: value }));
                            }}
                            format="DD/MM/YYYY"
                            sx={{ mb: 2, width: '100%' }}
                            maxDate={reportModal.toDate || dayjs()}
                        />
                        <DatePicker
                            label="To (dd/mm/yyyy)"
                            value={reportModal.toDate}
                            onChange={(value) => {
                                setReportModal((prev) => ({ ...prev, toDate: value }));
                            }}
                            format="DD/MM/YYYY"
                            sx={{ mb: 1.2, width: '100%' }}
                            minDate={reportModal.fromDate || undefined}
                            maxDate={dayjs()}
                        />
                    </LocalizationProvider>

                    <Typography variant="subtitle2" sx={{ mt: 1, mb: 1 }}>
                        Stage-wise sheets
                    </Typography>
                    <Box
                        sx={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 0.8,
                            mb: 2.2,
                            maxHeight: 220,
                            overflowY: 'auto',
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1,
                        }}
                    >
                        {(stageColumns || []).map((stage) => {
                            const stageId = String(stage?.id || '');
                            const checked = (reportModal.stageIds || []).includes(stageId);
                            return (
                                <FormControlLabel
                                    key={stageId}
                                    control={(
                                        <Checkbox
                                            size="small"
                                            checked={checked}
                                            onChange={(event) => {
                                                toggleReportStageSelection(stageId, event.target.checked);
                                            }}
                                        />
                                    )}
                                    label={stage?.title || 'Stage'}
                                    sx={{ minWidth: { xs: '100%', sm: '45%' }, mr: 0 }}
                                />
                            );
                        })}
                        {!stageColumns.length && (
                            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                                No stages available for this job.
                            </Typography>
                        )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.2, mt: 2.4 }}>
                        <MUIButton
                            onClick={closeDownloadReportModal}
                            variant="outlined"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Cancel
                        </MUIButton>
                        <MUIButton
                            onClick={downloadReport}
                            variant="contained"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Download Report
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <MUIModal
                open={moveFeedbackModal.open}
                onClose={closeMoveFeedbackModal}
                contentSx={{
                    width: { xs: '92vw', sm: '560px' },
                    maxWidth: '560px',
                    borderRadius: 3,
                    p: { xs: 2.2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                        Candidate Feedback
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.2 }}>
                        {moveModalCard?.fullName || 'Candidate'}: {stageTitleById.get(
                            moveModalCard?.activeStageId || ''
                        ) || 'Current Stage'} to {moveFeedbackModal.targetStageTitle || 'Next Stage'}
                    </Typography>

                    <Box sx={{ display: 'grid', gap: 1.4 }}>
                        <TextField
                            select
                            size="small"
                            label="Feedback Source"
                            value={moveFeedbackModal.feedbackSource}
                            onChange={(event) => {
                                setMoveFeedbackModal((prev) => ({
                                    ...prev,
                                    feedbackSource: event.target.value,
                                }));
                            }}
                            required
                        >
                            {FEEDBACK_SOURCE_CHOICES.map((source) => (
                                <MenuItem key={source} value={source}>
                                    {source}
                                </MenuItem>
                            ))}
                        </TextField>
                        <TextField
                            size="small"
                            multiline
                            minRows={4}
                            label="Candidate Feedback"
                            placeholder="Enter required feedback"
                            value={moveFeedbackModal.feedbackText}
                            onChange={(event) => {
                                setMoveFeedbackModal((prev) => ({
                                    ...prev,
                                    feedbackText: event.target.value,
                                }));
                            }}
                            required
                        />
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.2, mt: 3 }}>
                        <MUIButton
                            onClick={handleMoveFeedbackSubmit}
                            variant="contained"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Move to Previous Stage
                        </MUIButton>
                        <MUIButton
                            onClick={closeMoveFeedbackModal}
                            variant="outlined"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Close
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <BulkInterviewScheduleModal
                open={interviewScheduleModalOpen}
                onClose={() => setInterviewScheduleModalOpen(false)}
                title="Schedule Interviews"
                drafts={interviewScheduleDrafts}
                filteredDrafts={filteredInterviewScheduleDrafts}
                searchValue={interviewScheduleSearch}
                onSearchChange={setInterviewScheduleSearch}
                onDateChange={updateInterviewScheduleTime}
                onDurationChange={updateInterviewDuration}
                onContinue={continueToInterviewScheduler}
                continueDisabled={!interviewScheduleDrafts.length}
            />

            <StageResultEditorModal
                open={stageStatusModal.open}
                onClose={closeStageStatusModal}
                atsId={stageStatusModal.atsId}
                stageResultId={stageStatusModal.stageResultId}
                candidateName={stageStatusModal.candidateName}
                stageTitle={stageStatusModal.stageTitle}
                currentStatus={stageStatusModal.currentStatus}
                currentFeedback={stageStatusModal.currentFeedback}
                secondaryActionLabel={
                    stageStatusModal.previousStageId ? 'Previous stage' : ''
                }
                onSecondaryAction={() => {
                    closeStageStatusModal();
                    openMoveFeedbackModal(
                        stageStatusModal.cardId,
                        stageStatusModal.previousStageId
                    );
                }}
                secondaryActionDisabled={!stageStatusModal.previousStageId}
                onSaved={async () => {
                    closeStageStatusModal();
                    await loadPipeline();
                    openAlertModal('Success', 'Candidate stage status updated.', 'success');
                }}
            />


            <MUIModal
                open={bulkScheduleModal.open}
                onClose={() => setBulkScheduleModal((prev) => ({ ...prev, open: false }))}
                contentSx={{
                    width: { xs: '92vw', sm: '560px' },
                    maxWidth: '560px',
                    borderRadius: 3,
                    p: { xs: 2.2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.8 }}>
                        Schedule Call(s)
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.2 }}>
                        Selected candidates: {selectedCardCount}
                    </Typography>

                    <TextField
                        size="small"
                        type="datetime-local"
                        label="Schedule Date & Time"
                        value={bulkScheduleModal.scheduleAt}
                        onChange={(event) => {
                            setBulkScheduleModal((prev) => ({
                                ...prev,
                                scheduleAt: event.target.value,
                            }));
                        }}
                        InputLabelProps={{ shrink: true }}
                        fullWidth
                    />

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.2, mt: 3 }}>
                        <MUIButton
                            onClick={() => setBulkScheduleModal((prev) => ({ ...prev, open: false }))}
                            variant="outlined"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Close
                        </MUIButton>
                        <MUIButton
                            onClick={submitBulkScheduleCalls}
                            variant="contained"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            Schedule Call(s)
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <MUIModal
                open={relevancyModalOpen}
                onClose={() => setRelevancyModalOpen(false)}
                contentSx={{
                    width: { xs: '94vw', sm: '86vw', md: '70vw', lg: '56vw' },
                    maxWidth: '980px',
                    borderRadius: 3,
                    p: { xs: 2, sm: 3 },
                    border: 'none',
                }}
            >
                <Box
                    sx={{
                        borderRadius: 3,
                        p: { xs: 2, sm: 3 },
                        backgroundColor: alpha(theme.palette.grey[300], 0.16),
                    }}
                >
                    <Typography
                        variant="h5"
                        align="center"
                        sx={{ fontWeight: 700, mb: 2 }}
                    >
                        Candidate Relevancy Breakdown
                    </Typography>

                    {selectedRelevancy?.name && (
                        <Typography
                            variant="h6"
                            align="center"
                            sx={{
                                textTransform: 'uppercase',
                                fontWeight: 600,
                                mb: 2.5,
                                letterSpacing: 0.4,
                            }}
                        >
                            {selectedRelevancy.name}
                        </Typography>
                    )}

                    {relevancyLoading && (
                        <LinearProgress sx={{ borderRadius: 999, mb: 2 }} />
                    )}

                    {selectedRelevancy ? (
                        <>
                            <Box
                                sx={{
                                    p: 2.2,
                                    borderRadius: 2,
                                    border: '1px solid',
                                    borderColor: '#c3d8ff',
                                    background:
                                        'linear-gradient(135deg, rgba(191,219,254,0.42) 0%, rgba(219,234,254,0.62) 100%)',
                                    mb: 3,
                                }}
                            >
                                <Typography
                                    variant="subtitle2"
                                    sx={{
                                        color: '#2563eb',
                                        textTransform: 'uppercase',
                                        fontWeight: 700,
                                        letterSpacing: 0.4,
                                        mb: 1,
                                    }}
                                >
                                    Overview
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                    Total Relevancy: {Number.isFinite(Number(selectedRelevancy.candidateRelevancyToJob))
                                        ? `${selectedRelevancy.candidateRelevancyToJob}%`
                                        : 'N/A'}
                                </Typography>
                            </Box>

                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                    rowGap: 2.2,
                                    columnGap: 4,
                                    mb: 3,
                                }}
                            >
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Experience Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.experienceRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Skills Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.skillsRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Responsibilities Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.responsibilitiesRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Designation Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.designationRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Salary Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.salaryRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Notice Period Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.noticePeriodRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Interest Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.interestRelevancy)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                                        Communication Relevancy
                                    </Typography>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        {displayMetric(selectedRelevancy.communicationRelevancy)}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.2 }}>
                                    Reason
                                </Typography>
                                <Box
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        backgroundColor: alpha(theme.palette.grey[300], 0.24),
                                        border: '1px solid',
                                        borderColor: alpha(theme.palette.divider, 0.8),
                                    }}
                                >
                                    <Typography
                                        variant="body1"
                                        sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
                                    >
                                        {displayMetric(selectedRelevancy.reason)}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                                <MUIButton
                                    onClick={() => setRelevancyModalOpen(false)}
                                    variant="outlined"
                                    sx={{ px: 3.2, py: 0.8, borderRadius: 1.5 }}
                                >
                                    Close
                                </MUIButton>
                            </Box>
                        </>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 3 }}>
                            <Typography variant="body1">No relevancy data available.</Typography>
                        </Box>
                    )}
                </Box>
            </MUIModal>

            <MUIModal
                open={confirmCallModal.open}
                onClose={() => setConfirmCallModal({ open: false, card: null })}
                contentSx={{
                    width: { xs: '92vw', sm: '520px' },
                    maxWidth: '520px',
                    borderRadius: 3,
                    p: { xs: 2.5, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography variant="h5" sx={{ fontWeight: 600, mb: 1.8 }}>
                        Confirm
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.primary', mb: 3.2 }}>
                        Trigger AI call for this candidate?
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.2 }}>
                        <MUIButton
                            onClick={() => setConfirmCallModal({ open: false, card: null })}
                            variant="outlined"
                            sx={{ px: 2.6, py: 0.8, borderRadius: 999 }}
                        >
                            Cancel
                        </MUIButton>
                        <MUIButton
                            onClick={handleConfirmTriggerAiCall}
                            variant="contained"
                            sx={{ px: 2.8, py: 0.8, borderRadius: 999 }}
                        >
                            OK
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>

            <MUIModal
                open={alertModal.open}
                onClose={closeAlertModal}
                contentSx={{
                    width: { xs: '92vw', sm: '680px' },
                    maxWidth: '680px',
                    borderRadius: 3,
                    p: { xs: 2.5, sm: 3 },
                    border: 'none',
                }}
            >
                <Box>
                    <Typography
                        variant="h4"
                        sx={{
                            fontWeight: 500,
                            mb: 2,
                            color: alertModal.severity === 'error' ? 'error.main' : 'text.primary',
                        }}
                    >
                        {alertModal.title}
                    </Typography>
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'text.primary',
                            whiteSpace: 'pre-wrap',
                            mb: 3.2,
                            lineHeight: 1.4,
                        }}
                    >
                        {alertModal.message}
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <MUIButton
                            onClick={closeAlertModal}
                            variant="outlined"
                            sx={{ px: 3.6, py: 0.8, borderRadius: 1.5 }}
                        >
                            OK
                        </MUIButton>
                    </Box>
                </Box>
            </MUIModal>
        </Box>
    );
}

function HiringPipelineJobDetailView() {
    const navigate = useNavigate();
    const location = useLocation();
    const rootRef = useRef(null);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('openTab') === 'Candidates') return;
        params.set('openTab', 'Candidates');
        navigate(
            {
                pathname: location.pathname,
                search: params.toString(),
            },
            { replace: true }
        );
    }, [location.pathname, location.search, navigate]);

    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;

        const hidePipelineExtras = () => {
            const textTargets = [
                'Top 5 Applied Candidates by Relevancy',
                'Select to Schedule Interview',
                'Select to Schedule Call(s)',
                'Select to Clear Schedule(s)',
                'Select to Trigger Call(s)',
                'Select to Initiate WhatsApp',
                'Download tracker',
            ];

            const allNodes = root.querySelectorAll('*');
            allNodes.forEach((node) => {
                const text = (node.textContent || '').trim();
                if (!textTargets.includes(text)) return;
                const actionNode =
                    node.closest('button') ||
                    node.closest('[role="button"]') ||
                    node.closest('.MuiBox-root') ||
                    node;
                if (actionNode instanceof HTMLElement) {
                    actionNode.style.display = 'none';
                }
            });
        };

        hidePipelineExtras();
        const observer = new MutationObserver(() => hidePipelineExtras());
        observer.observe(root, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, []);

    return (
        <Box ref={rootRef}>
            <JobDetail pipelineOnly />
        </Box>
    );
}

export default function HiringPipeline() {
    const { id } = useParams();

    if (id) {
        return <HiringPipelineJobDetailView />;
    }

    return <HiringPipelineListView />;
}
