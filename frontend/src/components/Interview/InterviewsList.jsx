import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    TextField,
    Typography,
    IconButton,
    Tooltip,
    MenuItem,
    Autocomplete,
    Tabs,
    Tab,
    Avatar,
    Chip,
    InputAdornment,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import { fetchData } from '../../AppUtils/dataAPI';
import { useUiContextState } from '../../contexts/UiContext';
import { useNavigate } from 'react-router-dom';
import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useInterviewContextState } from '../../contexts/InterviewContext';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIAlert from '../MUI/commonUI/MUIAlert';

const COMMUNICATION_PARAMETER_NAME = 'Communication & Clarity';

const clampScore = (value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return null;
    return Math.max(0, Math.min(100, Math.round(value)));
};

const toFiniteNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const SCORELESS_STATUSES = new Set(['upcoming', 'unattended']);

const shouldHideScoreForStatus = (statusLabel) =>
    SCORELESS_STATUSES.has(String(statusLabel || '').trim().toLowerCase());

const hasPositiveNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0;
};

const hasInterviewerTrackStartSignal = (interviewerStartTimes) => {
    if (!interviewerStartTimes) return false;

    if (interviewerStartTimes instanceof Map) {
        for (const val of interviewerStartTimes.values()) {
            if (hasPositiveNumber(val)) return true;
        }
        return false;
    }

    if (typeof interviewerStartTimes === 'object') {
        return Object.values(interviewerStartTimes).some((val) => hasPositiveNumber(val));
    }

    return false;
};

const hasCandidateJoinSignal = (row) =>
    Boolean(row?.webrtcAccessUsedAt) ||
    hasPositiveNumber(row?.recordingMetadata?.candidateStartMs);

const hasInterviewerJoinSignal = (row) =>
    hasPositiveNumber(row?.recordingMetadata?.interviewerStartMs) ||
    hasInterviewerTrackStartSignal(row?.recordingMetadata?.interviewerStartTimes) ||
    Boolean(row?.interviewerFeedback);

const getUnattendedAbsentParticipants = (row, statusLabel) => {
    if (String(statusLabel || '').trim().toLowerCase() !== 'unattended') return [];

    const absent = [];
    const candidateJoined = hasCandidateJoinSignal(row);
    const interviewerTypeKey = String(row?.interviewerType || '').trim().toLowerCase();
    const expectsInterviewer =
        interviewerTypeKey.includes('human') ||
        (Array.isArray(row?.interviewers) && row.interviewers.length > 0);

    if (!candidateJoined) absent.push('Candidate');

    if (expectsInterviewer) {
        const interviewerJoined = hasInterviewerJoinSignal(row);
        if (!interviewerJoined) absent.push('Interviewer');
    }

    if (!absent.length) {
        absent.push('Candidate');
        if (expectsInterviewer) absent.push('Interviewer');
    }

    return absent;
};

const normalizeInterviewerTypeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return 'ai';
    if (raw === 'human+ai' || raw === 'human + ai' || raw === 'human & ai') return 'human+ai';
    if (raw === 'human') return 'human';
    if (raw === 'ai') return 'ai';
    if (raw.includes('human') && raw.includes('ai')) return 'human+ai';
    return raw;
};

const getInterviewerDisplayLabel = (row) => {
    const interviewerNames = Array.isArray(row?.interviewers)
        ? row.interviewers
            .map((u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email)
            .filter(Boolean)
        : [];

    if (interviewerNames.length) return interviewerNames.join(', ');

    if (typeof row?.interviewers === 'string' && row.interviewers.trim()) {
        return row.interviewers.trim();
    }

    const interviewerTypeKey = normalizeInterviewerTypeKey(row?.interviewerType);
    if (interviewerTypeKey === 'ai') return 'AI interviewer';

    return 'Unassigned';
};

const getHolisticInterviewScore = (row) =>
    clampScore(
        row?.evaluationScore ??
        row?.evaluation?.totalScore ??
        row?.evaluation?.score ??
        row?.evaluation?.overallScore ??
        row?.evaluationBreakdown?.totalScore ??
        row?.evaluationBreakdown?.evaluationScore ??
        row?.evaluationBreakdown?.score ??
        null
    );

const normalizeParamKey = (value) => String(value || '').trim().toLowerCase();

const normalizeParamItem = (name, value) => {
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName) return null;

    if (typeof value === 'number') {
        return { name: cleanName, score: clampScore(value), reason: null, weight: 1 };
    }

    const scoreVal =
        value?.score ??
        value?.value ??
        value?.percentage ??
        value?.obtainedScore ??
        value?.totalScore ??
        null;

    const weightVal =
        value?.weight ??
        value?.weightage ??
        value?.weightScore ??
        null;

    const reason =
        (typeof value?.reason === 'string' && value.reason.trim()) ||
        (typeof value?.feedback === 'string' && value.feedback.trim()) ||
        (typeof value?.comment === 'string' && value.comment.trim()) ||
        (typeof value?.summary === 'string' && value.summary.trim()) ||
        null;

    const weight =
        typeof weightVal === 'number' && Number.isFinite(weightVal) && weightVal > 0
            ? weightVal
            : 1;

    return {
        name: cleanName,
        score: clampScore(scoreVal),
        reason,
        weight,
    };
};

const getParameterWiseScores = (row) => {
    const raw =
        row?.evaluation?.parameters ||
        row?.evaluationBreakdown?.parameters ||
        row?.evaluationBreakdown?.parameterWiseEvaluation ||
        row?.evaluationBreakdown?.parameterWiseScores ||
        row?.evaluationBreakdown?.parameterWise ||
        row?.parameterWiseEvaluation ||
        row?.evaluation?.parameterWise ||
        row?.evaluation?.parameterWiseScores ||
        null;

    if (!raw) return [];

    if (Array.isArray(raw)) {
        return raw
            .map((entry) => {
                const name =
                    (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                    (typeof entry?.name === 'string' && entry.name.trim()) ||
                    (typeof entry?.title === 'string' && entry.title.trim()) ||
                    (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                    '';
                return normalizeParamItem(name, entry);
            })
            .filter(Boolean);
    }

    if (typeof raw === 'object') {
        if (Array.isArray(raw.parameters)) {
            return raw.parameters
                .map((entry) => {
                    const name =
                        (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                        (typeof entry?.name === 'string' && entry.name.trim()) ||
                        (typeof entry?.title === 'string' && entry.title.trim()) ||
                        (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                        '';
                    return normalizeParamItem(name, entry);
                })
                .filter(Boolean);
        }

        if (Array.isArray(raw.scores)) {
            return raw.scores
                .map((entry) => {
                    const name =
                        (typeof entry?.parameterName === 'string' && entry.parameterName.trim()) ||
                        (typeof entry?.name === 'string' && entry.name.trim()) ||
                        (typeof entry?.title === 'string' && entry.title.trim()) ||
                        (typeof entry?.parameter?.name === 'string' && entry.parameter.name.trim()) ||
                        '';
                    return normalizeParamItem(name, entry);
                })
                .filter(Boolean);
        }

        return Object.entries(raw)
            .map(([key, val]) => normalizeParamItem(key, val))
            .filter(Boolean);
    }

    return [];
};

const getCoveredParametersScore = (row) => {
    const parameterWise = getParameterWiseScores(row);
    if (!parameterWise.length) return null;

    const parameterEvidenceStats =
        row?.evaluationBreakdown?.parameterEvidenceStats ||
        row?.evaluation?.breakdown?.parameterEvidenceStats ||
        row?.evaluationBreakdown?.breakdown?.parameterEvidenceStats ||
        row?.evaluation?.parameterEvidenceStats ||
        row?.parameterEvidenceStats ||
        null;

    const evidenceOkByParam = new Map(
        parameterEvidenceStats && typeof parameterEvidenceStats === 'object'
            ? Object.entries(parameterEvidenceStats).map(([key, val]) => [
                normalizeParamKey(key),
                !!val?.ok,
            ])
            : []
    );

    const isParamCovered = (param) => {
        const key = normalizeParamKey(param?.name);
        if (!key) return false;

        const evidenceFlag = evidenceOkByParam.get(key);
        if (typeof evidenceFlag === 'boolean') return evidenceFlag;

        if (key === normalizeParamKey(COMMUNICATION_PARAMETER_NAME)) {
            return typeof param?.score === 'number' && Number.isFinite(param.score);
        }

        if (typeof param?.score !== 'number' || Number.isNaN(param.score)) return false;
        const reason = String(param?.reason || '').toLowerCase();
        if (reason.includes('insufficient evidence') || reason.includes('no substantial answer')) {
            return false;
        }
        return true;
    };

    const getParamWeight = (param) =>
        typeof param?.weight === 'number' && Number.isFinite(param.weight) && param.weight > 0
            ? param.weight
            : 1;

    const scoredParams = parameterWise.filter((param) => typeof param.score === 'number' && !Number.isNaN(param.score));
    const completedParams = scoredParams.filter(isParamCovered);
    const completedWeightSum = completedParams.reduce((acc, param) => acc + getParamWeight(param), 0);
    const completedWeightedSum = completedParams.reduce((acc, param) => acc + param.score * getParamWeight(param), 0);

    if (completedWeightSum <= 0) return null;
    return clampScore(completedWeightedSum / completedWeightSum);
};

const getInterviewerFeedbackOverall = (feedback) => {
    if (!feedback || typeof feedback !== 'object') return null;

    const overallComment =
        typeof feedback?.overallComment === 'string' && feedback.overallComment.trim()
            ? feedback.overallComment.trim()
            : null;
    if (overallComment) return overallComment;

    const recommendation =
        typeof feedback?.recommendation === 'string' && feedback.recommendation.trim()
            ? feedback.recommendation.trim()
            : null;
    if (recommendation) return recommendation;

    const rating =
        typeof feedback?.rating === 'number' && Number.isFinite(feedback.rating)
            ? Math.max(0, Math.min(5, Math.round(feedback.rating)))
            : null;

    return rating !== null ? `Rating: ${rating}/5` : null;
};

const getScoreBand = (score) => {
    if (score === null || score === undefined) return 'N/A';
    if (score < 33) return 'Low';
    if (score < 67) return 'Medium';
    return 'High';
};



export default function InterviewsList() {
    const [interviewState, setInterviewState] = useInterviewContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const initialQuery = interviewState?.interviewListQuery || {};
    const [searchTerm, setSearchTerm] = useState(initialQuery.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search || '');
    const [paginationModel, setPaginationModel] = useState(
        initialQuery.paginationModel || { page: 0, pageSize: 10 }
    );
    const [statusTab, setStatusTab] = useState('all');
    const [selectedIds, setSelectedIds] = useState([]);
    const [sortModel, setSortModel] = useState(initialQuery.sortModel || []);
    const [interviewsLoading, setInterviewsLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [current, setCurrent] = useState(null);

    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const [fltOpen, setFltOpen] = useState(false);
    const [fltField, setFltField] = useState('all');
    const [fltValue, setFltValue] = useState({ label: 'All', value: 'all' });
    const [valueOptions, setValueOptions] = useState([{ label: 'All', value: 'all' }]);
    const [fltDateFrom, setFltDateFrom] = useState('');
    const [fltDateTo, setFltDateTo] = useState('');

    const initialAppliedValue = initialQuery.appliedValue
        ? { label: initialQuery.appliedValueLabel || initialQuery.appliedValue, value: initialQuery.appliedValue }
        : { label: 'All', value: 'all' };
    const [appliedField, setAppliedField] = useState(initialQuery.appliedField || 'all');
    const [appliedValue, setAppliedValue] = useState(initialAppliedValue);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialQuery.appliedDateFrom || '');
    const [appliedDateTo, setAppliedDateTo] = useState(initialQuery.appliedDateTo || '');

    const requestRef = useRef(0);
    const inFlightKeyRef = useRef('');

    const closeAlert = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertCfg(a => ({ ...a, open: false }));
    };

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
        }, 400);

        return () => clearTimeout(handle);
    }, [searchTerm]);

    const formatDate = (value) => {
        if (!value) return 'N/A';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'N/A';
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const formatTime = (value) => {
        if (!value) return 'N/A';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return 'N/A';
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };

    const buildStatus = (row) => {
        const resolvedStatusLabel = String(row?.statusLabel || '').trim();
        if (resolvedStatusLabel) return resolvedStatusLabel;

        const raw = String(row?.interviewStatus || '').toLowerCase().trim();
        const requiresAssignee = String(row?.interviewerType || '').toLowerCase().includes('human');
        const hasInterviewers = Array.isArray(row?.interviewers)
            ? row.interviewers.length > 0
            : Boolean(row?.interviewerNames);
        const isVirtualMode = String(row?.interviewMode || '').toLowerCase() === 'virtual';
        const hasStartedSignal =
            /in\s*progress|ongoing|started/.test(raw) ||
            (isVirtualMode && Boolean(row?.webrtcAccessUsedAt));

        if (requiresAssignee && !hasInterviewers) return 'Unassigned';
        if (raw.includes('complete')) return 'Completed';
        if (raw.includes('miss')) return 'Unattended';
        if (raw.includes('cancel')) return 'Cancelled';
        if (row?.endedAt) return 'Completed';

        const startAt = row?.startAt ? new Date(row.startAt) : null;
        if (startAt && !Number.isNaN(startAt.getTime())) {
            const duration = Number(row?.durationMinutes || 45);
            const endAt = new Date(startAt.getTime() + duration * 60000);
            const now = Date.now();
            if (hasStartedSignal && now >= startAt.getTime() && now < endAt.getTime()) return 'In Progress';
            if (now >= endAt.getTime()) return 'Unattended';
        }

        if (raw.includes('upcoming')) return 'Upcoming';
        return 'Upcoming';
    };

    const statusChipStyles = (status) => {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'completed') {
            const main = theme.palette.info.main;
            return { color: main, bgcolor: alpha(main, isDark ? 0.2 : 0.12), dot: main };
        }
        if (normalized === 'unattended') {
            const main = theme.palette.error.main;
            return { color: main, bgcolor: alpha(main, isDark ? 0.2 : 0.12), dot: main };
        }
        if (normalized === 'unassigned') {
            const main = theme.palette.text.secondary;
            return {
                color: main,
                bgcolor: alpha(theme.palette.grey[500], isDark ? 0.22 : 0.16),
                dot: main,
            };
        }
        if (normalized === 'cancelled') {
            const main = theme.palette.text.secondary;
            return { color: main, bgcolor: alpha(main, isDark ? 0.18 : 0.1), dot: main };
        }
        if (normalized === 'in progress') {
            const main = theme.palette.warning.main;
            return { color: main, bgcolor: alpha(main, isDark ? 0.2 : 0.12), dot: main, pulse: true };
        }
        const main = theme.palette.success.main;
        return { color: main, bgcolor: alpha(main, isDark ? 0.2 : 0.12), dot: main };
    };

    const mappedRows = useMemo(() => {
        return (interviewState?.interviewRowsList || []).map((row) => {
            const candidateName = row?.candidateName || 'N/A';
            const candidateInitials = candidateName
                .split(' ')
                .filter(Boolean)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase();

            const interviewerNames = Array.isArray(row?.interviewers)
                ? row.interviewers
                    .map((u) => `${u?.firstName || ''} ${u?.lastName || ''}`.trim() || u?.email)
                    .filter(Boolean)
                : [];

            const interviewerLabel = getInterviewerDisplayLabel(row);

            const normalizedInterviewerType =
                row?.interviewerType === 'Human+AI' ? 'Human + AI' : row?.interviewerType;
            const interviewTypeLabel = row?.roundType === 'Coding'
                ? 'Coding'
                : (row?.interviewType || normalizedInterviewerType || 'AI');

            const clientUser = row?.client;
            const clientIsPopulated = clientUser && typeof clientUser === 'object' && (clientUser.firstName || clientUser.lastName || clientUser.email);
            const createdByName = clientIsPopulated
                ? `${clientUser.firstName || ''} ${clientUser.lastName || ''}`.trim() || clientUser.email || ''
                : (row?.createdByName || '');
            const statusLabel = buildStatus(row);
            const hideScoreForStatus = shouldHideScoreForStatus(statusLabel);
            const unattendedAbsentParticipants = getUnattendedAbsentParticipants(row, statusLabel);
            const unattendedAbsentText = unattendedAbsentParticipants.length
                ? `Not joined: ${unattendedAbsentParticipants.join(', ')}`
                : '';

            return {
                ...row,
                candidateName,
                candidateInitials: candidateInitials || 'NA',
                candidateEmail: row?.candidateEmail || '',
                companyName: row?.job?.company?.name || row?.companyName || 'N/A',
                interviewerLabel,
                interviewTypeLabel,
                createdByName,
                statusLabel,
                score: hideScoreForStatus ? null : (row?.score ?? null),
                scoreBand: hideScoreForStatus ? 'N/A' : (row?.scoreBand || getScoreBand(row?.score)),
                unattendedAbsentParticipants,
                unattendedAbsentText,
                timeLabel: formatTime(row?.startAt),
                dateLabel: formatDate(row?.startAt),
                durationLabel: `${Number(row?.durationMinutes || 0) || 45} mins`,
            };
        });
    }, [interviewState?.interviewRowsList]);

    const filteredRows = useMemo(() => {
        if (statusTab === 'all') return mappedRows;
        return mappedRows.filter((row) => String(row.statusLabel || '').toLowerCase() === statusTab);
    }, [mappedRows, statusTab]);

    const rowCount = interviewState?.interviewListMeta?.total ?? mappedRows.length;
    const displayRows = filteredRows;
    const displayRowCount = rowCount;

    const rowSelectionModel = useMemo(
        () => ({ type: 'include', ids: new Set(selectedIds) }),
        [selectedIds]
    );

    const handleSelectionChange = useCallback(
        (newSelection) => {
            if (Array.isArray(newSelection)) {
                setSelectedIds(newSelection);
                return;
            }
            if (newSelection?.ids) {
                const ids = [...newSelection.ids];
                if (newSelection.type === 'exclude') {
                    const allIds = (displayRows || [])
                        .map((row) => row.id ?? row._id)
                        .filter(Boolean);
                    if (!ids.length) {
                        setSelectedIds(allIds);
                        return;
                    }
                    setSelectedIds(allIds.filter((id) => !newSelection.ids.has(id)));
                    return;
                }
                setSelectedIds(ids);
                return;
            }
            setSelectedIds([]);
        },
        [displayRows]
    );

    const missedCount = useMemo(
        () => mappedRows.filter((row) => row.statusLabel === 'Unattended').length,
        [mappedRows]
    );

    const inProgressCount = useMemo(
        () => mappedRows.filter((row) => row.statusLabel === 'In Progress').length,
        [mappedRows]
    );

    const columns = useMemo(() => [
        {
            field: 'candidateName',
            headerName: 'Candidate',
            flex: 1.4,
            minWidth: 160,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, height: '100%', overflow: 'hidden' }}>
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            flexShrink: 0,
                            bgcolor: alpha(theme.palette.grey[400], isDark ? 0.28 : 0.18),
                            color: 'text.primary',
                            fontWeight: 700,
                            fontSize: 11,
                            border: 1,
                            borderColor: alpha(theme.palette.grey[500], isDark ? 0.55 : 0.32),
                        }}
                    >
                        {row.candidateInitials}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.candidateName || 'N/A'}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.candidateEmail || '--'}
                        </Typography>
                    </Box>
                </Box>
            ),
        },
        {
            field: 'jobTitle',
            headerName: 'Job & Company',
            flex: 1.2,
            minWidth: 140,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0, overflow: 'hidden' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.jobTitle || 'N/A'}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.companyName || '--'}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'startAt',
            headerName: 'Scheduled',
            flex: 0.85,
            minWidth: 110,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {row.timeLabel} - {row.dateLabel}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {row.durationLabel}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'interviewTypeLabel',
            headerName: 'Type',
            flex: 0.7,
            minWidth: 90,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                    {row.interviewTypeLabel}
                </Typography>
            ),
        },
        {
            field: 'interviewerLabel',
            headerName: 'Interviewer',
            flex: 0.9,
            minWidth: 110,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.interviewerLabel}
                </Typography>
            ),
        },
        {
            field: 'createdByName',
            headerName: 'Created By',
            flex: 0.9,
            minWidth: 120,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => (
                <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.createdByName || '—'}
                </Typography>
            ),
        },
        {
            field: 'statusLabel',
            headerName: 'Status',
            flex: 0.75,
            minWidth: 110,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => {
                const styles = statusChipStyles(row.statusLabel);
                const statusChip = (
                    <Chip
                        label={row.statusLabel}
                        size="small"
                        sx={{
                            bgcolor: styles.bgcolor,
                            color: styles.color,
                            fontWeight: 600,
                            '& .MuiChip-label': {
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.6,
                            },
                        }}
                        icon={
                            <Box
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: '50%',
                                    bgcolor: styles.dot,
                                    ml: 0.5,
                                    ...(styles.pulse && {
                                        animation: 'interviewPulse 1.4s ease-in-out infinite',
                                        '@keyframes interviewPulse': {
                                            '0%, 100%': { opacity: 1, transform: 'scale(1)' },
                                            '50%': { opacity: 0.45, transform: 'scale(1.5)' },
                                        },
                                    }),
                                }}
                            />
                        }
                    />
                );

                if (row.statusLabel === 'Unattended' && row.unattendedAbsentText) {
                    return (
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                justifyContent: 'center',
                                gap: 0.3,
                                minWidth: 0,
                            }}
                        >
                            {statusChip}
                            <Tooltip title={row.unattendedAbsentText} arrow>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.secondary',
                                        fontWeight: 600,
                                        minWidth: 0,
                                        maxWidth: '100%',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {row.unattendedAbsentText}
                                </Typography>
                            </Tooltip>
                        </Box>
                    );
                }

                return statusChip;
            },
        },
        {
            field: 'score',
            headerName: 'Score',
            flex: 1.1,
            minWidth: 180,
            align: 'left',
            headerAlign: 'left',
            renderCell: ({ row }) => {
                if (shouldHideScoreForStatus(row.statusLabel)) {
                    return (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            --
                        </Typography>
                    );
                }
                if (row.scoreMode === 'feedback') {
                    if (!row.scoreOverallFeedback) {
                        return (
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                --
                            </Typography>
                        );
                    }

                    return (
                        <Tooltip title={row.scoreOverallFeedback} arrow>
                            <Typography
                                variant="caption"
                                sx={{
                                    color: 'text.secondary',
                                    fontWeight: 600,
                                    display: 'block',
                                    maxWidth: '100%',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {row.scoreOverallFeedback}
                            </Typography>
                        </Tooltip>
                    );
                }

                if (row.scoreMode === 'coding') {
                    const passed = toFiniteNumber(row.codingPassedTestCases);
                    const total = toFiniteNumber(row.codingTotalTestCases);
                    if (passed === null) {
                        return (
                            <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                                --
                            </Typography>
                        );
                    }

                    const band = row.scoreBand || 'N/A';
                    const colorMap = {
                        High: theme.palette.success.main,
                        Medium: theme.palette.warning.main,
                        Low: theme.palette.error.main,
                    };
                    const hasPercentage = typeof row.score === 'number' && Number.isFinite(row.score);
                    const color = hasPercentage
                        ? (colorMap[band] || theme.palette.text.secondary)
                        : theme.palette.text.secondary;
                    const scoreLabel =
                        total !== null && total >= 0
                            ? `${Math.max(0, Math.round(passed))}/${Math.max(0, Math.round(total))}`
                            : `${Math.max(0, Math.round(passed))}`;

                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: 0.35,
                                    px: 1,
                                    py: 0.35,
                                    borderRadius: 1.5,
                                    bgcolor: alpha(color, isDark ? 0.18 : 0.1),
                                    border: `1px solid ${alpha(color, isDark ? 0.35 : 0.22)}`,
                                }}
                            >
                                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color, lineHeight: 1 }}>
                                    {scoreLabel}
                                </Typography>
                                <Typography sx={{ fontWeight: 600, fontSize: '0.65rem', color: alpha(color, 0.75), lineHeight: 1 }}>
                                    passed
                                </Typography>
                            </Box>
                            <Tooltip title={row.scoreMetricLabel || 'Passed test cases'} arrow>
                                <Chip
                                    label={row.scoreMetricShortLabel || 'Coding'}
                                    size="small"
                                    sx={{
                                        height: 18,
                                        fontSize: '0.6rem',
                                        fontWeight: 700,
                                        bgcolor: alpha(color, isDark ? 0.18 : 0.1),
                                        color,
                                        border: `1px solid ${alpha(color, isDark ? 0.35 : 0.2)}`,
                                    }}
                                />
                            </Tooltip>
                        </Box>
                    );
                }

                if (row.score === null || row.score === undefined) {
                    return (
                        <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic' }}>
                            --
                        </Typography>
                    );
                }
                const band = row.scoreBand || 'N/A';
                const colorMap = {
                    High: theme.palette.success.main,
                    Medium: theme.palette.warning.main,
                    Low: theme.palette.error.main,
                };
                const color = colorMap[band] || theme.palette.text.secondary;
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'baseline',
                                gap: 0.2,
                                px: 1,
                                py: 0.35,
                                borderRadius: 1.5,
                                bgcolor: alpha(color, isDark ? 0.18 : 0.1),
                                border: `1px solid ${alpha(color, isDark ? 0.35 : 0.22)}`,
                            }}
                        >
                            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', color, lineHeight: 1 }}>
                                {row.score}
                            </Typography>
                            <Typography sx={{ fontWeight: 600, fontSize: '0.65rem', color: alpha(color, 0.75), lineHeight: 1 }}>
                                /100
                            </Typography>
                        </Box>
                        <Tooltip title={row.scoreMetricLabel || band} arrow>
                            <Chip
                                label={row.scoreMetricShortLabel || band}
                                size="small"
                                sx={{
                                    height: 18,
                                    fontSize: '0.6rem',
                                    fontWeight: 700,
                                    bgcolor: alpha(color, isDark ? 0.18 : 0.1),
                                    color,
                                    border: `1px solid ${alpha(color, isDark ? 0.35 : 0.2)}`,
                                }}
                            />
                        </Tooltip>
                    </Box>
                );
            },
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [theme, isDark]);

    const loadInterviews = useCallback(async (queryState) => {
        const requestKey = JSON.stringify({
            paginationModel: queryState?.paginationModel || { page: 0, pageSize: 10 },
            sortModel: queryState?.sortModel || [],
            search: queryState?.search || '',
            appliedField: queryState?.appliedField || 'all',
            appliedValue: queryState?.appliedValue || 'all',
            appliedDateFrom: queryState?.appliedDateFrom || '',
            appliedDateTo: queryState?.appliedDateTo || '',
            statusTab: queryState?.statusTab || 'all',
        });

        if (inFlightKeyRef.current === requestKey) {
            return;
        }
        inFlightKeyRef.current = requestKey;

        const reqId = ++requestRef.current;
        setInterviewsLoading(true);
        // setUiState({ loadingMsg: 'Loading interviews, Please wait...' });

        const params = new URLSearchParams();
        params.set('page', String((queryState?.paginationModel?.page ?? 0) + 1));
        params.set('pageSize', String(queryState?.paginationModel?.pageSize ?? 10));

        const sort = queryState?.sortModel?.[0];
        if (sort?.field) params.set('sortBy', sort.field);
        if (sort?.sort) params.set('sortOrder', sort.sort);

        if (queryState?.search) {
            params.set('search', queryState.search);
        }

        if (queryState?.statusTab && queryState.statusTab !== 'all') {
            params.set('statusTab', queryState.statusTab);
        }

        const skipAppliedStatusFilter =
            queryState?.statusTab &&
            queryState.statusTab !== 'all' &&
            queryState?.appliedField === 'statusLabel';

        if (!skipAppliedStatusFilter && queryState?.appliedField && queryState.appliedField !== 'all') {
            params.set('filterField', queryState.appliedField);
            if (queryState.appliedField === 'startAt') {
                if (queryState.appliedDateFrom) params.set('dateFrom', queryState.appliedDateFrom);
                if (queryState.appliedDateTo) params.set('dateTo', queryState.appliedDateTo);
            } else if (queryState.appliedValue && queryState.appliedValue !== 'all') {
                params.set('filterValue', queryState.appliedValue);
            }
        }

        try {
            const res = await fetchData(`/api/interviewschedules?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res)
                ? {
                    total: list.length,
                    page: 1,
                    pageSize: list.length,
                    totalPages: 1
                }
                : (res?.meta || { total: list.length, page: 1, pageSize: list.length, totalPages: 1 });

            const mapped = (list || []).map((x) => {
                const interviewerNames = (x.interviewers || [])
                    .map(u => `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email)
                    .filter(Boolean);

                const isCodingRound =
                    String(x?.roundType || '').toLowerCase().includes('coding') ||
                    String(x?.interviewType || '').toLowerCase().includes('coding');
                const interviewerTypeKey = normalizeInterviewerTypeKey(x?.interviewerType);
                const coveredParametersScore = getCoveredParametersScore(x);
                const holisticInterviewScore = getHolisticInterviewScore(x);
                const overallFeedback = getInterviewerFeedbackOverall(x?.interviewerFeedback);
                const codingPassedTestCasesRaw = toFiniteNumber(x?.codingPassedTestCases);
                const codingTotalTestCasesRaw = toFiniteNumber(x?.codingTotalTestCases);
                const codingPassedTestCases =
                    codingPassedTestCasesRaw === null ? null : Math.max(0, Math.round(codingPassedTestCasesRaw));
                const codingTotalTestCases =
                    codingTotalTestCasesRaw === null ? null : Math.max(0, Math.round(codingTotalTestCasesRaw));

                let scoreMode = 'numeric';
                let scoreMetricLabel = 'Score';
                let scoreMetricShortLabel = 'Score';
                let score = null;

                if (isCodingRound) {
                    scoreMode = 'coding';
                    scoreMetricLabel = 'Passed Test Cases';
                    scoreMetricShortLabel = 'Test Cases';
                    if (
                        codingPassedTestCases !== null &&
                        codingTotalTestCases !== null &&
                        codingTotalTestCases > 0
                    ) {
                        score = clampScore((codingPassedTestCases / codingTotalTestCases) * 100);
                    }
                } else if (interviewerTypeKey === 'human') {
                    scoreMode = 'feedback';
                    scoreMetricLabel = 'Interviewer Feedback Overall';
                    scoreMetricShortLabel = 'Feedback';
                } else if (interviewerTypeKey === 'human+ai') {
                    score = holisticInterviewScore;
                    scoreMetricLabel = 'Holistic Interview Score';
                    scoreMetricShortLabel = 'Holistic';
                } else {
                    score = coveredParametersScore ?? holisticInterviewScore;
                    scoreMetricLabel = 'Covered Parameters Score';
                    scoreMetricShortLabel = 'Covered';
                }

                const scoreBand = getScoreBand(score);

                return {
                    ...x,
                    id: x._id || x.id,
                    candidateName: x?.candidate
                        ? `${x.candidate.firstName || ''} ${x.candidate.lastName || ''}`.trim() || x.candidate.email
                        : 'N/A',
                    candidateEmail: x?.candidate?.email || '',
                    jobTitle: x?.job ? (x.job.title || x.job.internalTitle || 'N/A') : 'N/A',
                    jobInternalTitle: x?.job?.internalTitle || '',
                    companyName: x?.job?.company?.name || '',
                    startAt: x.startAt || null,
                    durationMinutes: x.durationMinutes,
                    interviewMode: x.interviewMode,
                    interviewType: x.interviewType || 'N/A',
                    interviewerType: x.interviewerType || 'N/A',
                    interviewStatus: x.interviewStatus || null,
                    endedAt: x.endedAt || null,
                    roundType: x.roundType || null,
                    interviewerNames,
                    interviewers: Array.isArray(x.interviewers) ? x.interviewers : [],
                    score,
                    scoreBand,
                    scoreMode,
                    scoreMetricLabel,
                    scoreMetricShortLabel,
                    scoreOverallFeedback: overallFeedback,
                    coveredParametersScore,
                    holisticInterviewScore,
                    codingPassedTestCases,
                    codingTotalTestCases,
                };
            });

            if (reqId !== requestRef.current) return;

            setInterviewState({
                interviewRowsList: mapped,
                interviewListMeta: meta,
                interviewListQuery: queryState,
            });

            console.log('[InterviewsList] Interviews loaded', {
                count: mapped.length,
                total: meta?.total ?? mapped.length,
                page: (queryState?.paginationModel?.page ?? 0) + 1
            });
        } catch (err) {
            console.error('[InterviewsList] Failed to load interviews:', err);
        } finally {
            if (inFlightKeyRef.current === requestKey) {
                inFlightKeyRef.current = '';
            }
            if (reqId === requestRef.current) {
                setInterviewsLoading(false);
                setUiState({ loadingMsg: null });
            }
        }
    }, [setInterviewState, setUiState]);

    const appliedValueKey = appliedValue?.value ?? 'all';
    const appliedValueLabel = appliedValue?.label ?? appliedValueKey;
    const refreshToken = interviewState?.interviewListRefreshToken || 0;

    const queryState = useMemo(() => ({
        paginationModel,
        sortModel,
        search: debouncedSearch,
        appliedField,
        appliedValue: appliedValueKey,
        appliedValueLabel,
        appliedDateFrom,
        appliedDateTo,
        statusTab,
        refreshToken,
    }), [
        paginationModel,
        sortModel,
        debouncedSearch,
        appliedField,
        appliedValueKey,
        appliedValueLabel,
        appliedDateFrom,
        appliedDateTo,
        statusTab,
        refreshToken
    ]);

    const queryKey = useMemo(() => JSON.stringify(queryState), [queryState]);
    const cachedKey = useMemo(
        () => (interviewState?.interviewListQuery ? JSON.stringify(interviewState.interviewListQuery) : ''),
        [interviewState?.interviewListQuery]
    );

    useEffect(() => {
        if (interviewState?.interviewRowsList && cachedKey && cachedKey === queryKey) {
            return;
        }
        loadInterviews(queryState);
    }, [cachedKey, queryKey, interviewState?.interviewRowsList, loadInterviews, queryState]);

    const computeValueOptions = field => {
        if (field === 'all' || field === 'startAt') {
            setValueOptions([{ label: 'All', value: 'all' }]);
            setFltValue({ label: 'All', value: 'all' });
            return;
        }
        if (field === 'scoreBand') {
            const opts = [
                { label: 'All', value: 'all' },
                { label: 'High (67-100)', value: 'High' },
                { label: 'Medium (33-66)', value: 'Medium' },
                { label: 'Low (0-32)', value: 'Low' },
                { label: 'N/A (not scored)', value: 'N/A' },
            ];
            setValueOptions(opts);
            setFltValue(opts[0]);
            return;
        }
        const src = field === 'statusLabel' ? mappedRows : (interviewState?.interviewRowsList || []);
        let uniq = Array.from(new Set(
            src
                .map((r) => (r?.[field] ?? '').toString().trim())
                .filter(Boolean)
        ));
        uniq = uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const opts = [{ label: 'All', value: 'all' }, ...uniq.map(v => ({ label: v, value: v }))];
        const found = opts.find(o => o.value === fltValue.value) || opts[0];
        setValueOptions(opts);
        setFltValue(found);
    };

    const openFilterModal = () => {
        setFltField(appliedField);
        setFltValue(appliedValue);
        setFltDateFrom(appliedDateFrom);
        setFltDateTo(appliedDateTo);
        computeValueOptions(appliedField);
        setFltOpen(true);
    };

    const isFilterApplied =
        (appliedField === 'startAt' && (appliedDateFrom || appliedDateTo)) ||
        (appliedField !== 'all' && appliedValue?.value !== 'all');

    const deleteRow = async () => {
        if (!current?.id) return;
        // setUiState({ loadingMsg: 'Archiving interview, Please wait...' });
        try {
            await fetchData(`/api/interviewschedules/${current.id}/archive`, { method: 'PUT' });
            setDeleteOpen(false);
            setAlertCfg({ open: true, message: 'Interview archived.', severity: 'success' });
            loadInterviews(queryState);
        } catch (err) {
            console.error('[InterviewsList] Failed to archive interview:', err);
            setAlertCfg({
                open: true,
                message: err?.message || 'Failed to archive interview',
                severity: 'error'
            });
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 5 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh",
                // m: 5,
                // p: 2.5,
                // borderRadius: 3,
                // border: 1,
                // borderColor: 'divider',
                // bgcolor: 'background.paper',
                // boxShadow: 2,
            }}
        >
            <Box>
                <MUIAlert
                    open={alertCfg.open}
                    message={alertCfg.message}
                    severity={alertCfg.severity}
                    onClose={closeAlert}
                />

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                            All Interviews
                        </Typography>
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={() => loadInterviews(queryState)}>
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            flexWrap: 'wrap',
                        }}
                    >
                        <TextField
                            size="small"
                            placeholder="Search interviews"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                minWidth: { xs: '100%', sm: 260 },
                                bgcolor: 'background.paper',
                                borderRadius: 1.5,
                            }}
                        />
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 2,
                    }}
                >
                    <Tabs
                        value={statusTab}
                        onChange={(_e, val) => {
                            setStatusTab(val);
                            setSelectedIds([]);
                            setPaginationModel((prev) => ({ ...prev, page: 0 }));
                        }}
                        sx={{
                            minHeight: 36,
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                minHeight: 36,
                                px: 2,
                                fontWeight: 600,
                                color: 'text.secondary',
                            },
                            '& .Mui-selected': {
                                color: 'text.primary',
                            },
                            '& .MuiTabs-indicator': {
                                height: 3,
                                borderRadius: 3,
                                bgcolor: alpha(theme.palette.grey[700], isDark ? 0.52 : 0.45),
                            },
                        }}
                    >
                        <Tab label="All" value="all" />
                        <Tab label="Upcoming" value="upcoming" />
                        <Tab
                            value="in progress"
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                    In Progress
                                    {inProgressCount > 0 && (
                                        <Box
                                            sx={{
                                                minWidth: 18,
                                                height: 18,
                                                px: 0.6,
                                                borderRadius: 9,
                                                bgcolor: alpha(theme.palette.warning.main, isDark ? 0.28 : 0.18),
                                                border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
                                                color: theme.palette.warning.main,
                                                fontSize: '0.65rem',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}
                                        >
                                            {inProgressCount}
                                        </Box>
                                    )}
                                </Box>
                            }
                        />
                        <Tab label="Completed" value="completed" />
                        <Tab label="Unattended" value="unattended" />
                    </Tabs>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <MUIButton
                            variant="outlined"
                            onClick={openFilterModal}
                            startIcon={<FilterListIcon />}
                            sx={{
                                borderColor: isFilterApplied
                                    ? alpha(theme.palette.grey[700], isDark ? 0.55 : 0.42)
                                    : alpha(theme.palette.grey[600], isDark ? 0.4 : 0.3),
                                bgcolor: isFilterApplied
                                    ? alpha(theme.palette.grey[500], isDark ? 0.18 : 0.12)
                                    : 'transparent',
                                color: 'text.primary',
                            }}
                        >
                            Filters
                        </MUIButton>
                    </Box>
                </Box>

                {(missedCount > 0 && statusTab === "unattended") && (
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            px: 2,
                            py: 1.2,
                            mb: 2,
                            borderRadius: 2,
                            bgcolor: alpha(theme.palette.grey[400], isDark ? 0.16 : 0.14),
                            border: 1,
                            borderColor: alpha(theme.palette.grey[600], isDark ? 0.28 : 0.22),
                        }}
                    >
                        <Box
                            sx={{
                                width: 26,
                                height: 26,
                                borderRadius: '50%',
                                bgcolor: alpha(theme.palette.grey[700], isDark ? 0.58 : 0.5),
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'common.white',
                            }}
                        >
                            <InfoRoundedIcon fontSize="small" />
                        </Box>
                        <Typography variant="body2" sx={{ color: 'text.primary' }}>
                            These candidates were unattended for their AI interview. You can reschedule or assign them to a human interviewer.
                        </Typography>
                    </Box>
                )}

                <MUIRetrieveDataGrid
                    hideHeader
                    autoSizeColumns={false}
                    rows={displayRows}
                    rowCount={displayRowCount}
                    columns={columns}
                    rowHeight={72}
                    paginationMode="server"
                    paginationModel={paginationModel}
                    onPaginationModelChange={(model) => {
                        if (model.page === paginationModel.page && model.pageSize === paginationModel.pageSize) {
                            return;
                        }
                        setPaginationModel(model);
                    }}
                    sortingMode="server"
                    sortModel={sortModel}
                    onSortModelChange={(model) => {
                        const next = model || [];
                        const prevKey = JSON.stringify(sortModel || []);
                        const nextKey = JSON.stringify(next);
                        if (prevKey === nextKey) return;
                        setSortModel(next);
                        setPaginationModel((prev) => ({ ...prev, page: 0 }));
                    }}
                    loading={interviewsLoading}
                    slots={{
                        noRowsOverlay: () => (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <Typography variant="subtitle1">No interviews found</Typography>
                                <Typography variant="body2">
                                    Try adjusting search or filters.
                                </Typography>
                            </Box>
                        )
                    }}
                    checkboxSelection
                    selectedIds={selectedIds}
                    rowSelectionModel={rowSelectionModel}
                    onRowSelectionModelChange={handleSelectionChange}
                    onRowClick={row => navigate(`/interviews/${row.id}`)}
                    onDelete={row => {
                        setCurrent(row);
                        setDeleteOpen(true);
                    }}
                    sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider',
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: 'background.default',
                            borderBottom: 1,
                            borderBottomColor: 'divider',
                            color: 'text.secondary',
                            fontWeight: 600,
                            fontSize: '0.72rem',
                        },
                        '& .MuiDataGrid-row': {
                            backgroundColor: 'background.paper',
                            '&:nth-of-type(even)': {
                                backgroundColor: 'background.default',
                            },
                            '&:hover': {
                                boxShadow: 1,
                            },
                        },
                        '& .MuiDataGrid-cell': {
                            py: 1.2,
                            display: 'flex',
                            alignItems: 'center',
                        },
                        '& .MuiDataGrid-cellContent': {
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                        },
                        '& .MuiCheckbox-root': {
                            color: alpha(theme.palette.grey[700], isDark ? 0.72 : 0.55),
                            '&.Mui-checked': {
                                color: 'text.primary',
                            },
                        },
                    }}
                />

                <MUIModal open={fltOpen} onClose={() => setFltOpen(false)}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">Filter Interviews</Typography>
                        <Typography variant="body2" color="text.secondary">
                            Choose a column and a value. By default both are <b>All</b>.
                        </Typography>
                    </Box>

                    <TextField
                        label="Filter by"
                        select
                        value={fltField}
                        onChange={e => {
                            const v = e.target.value;
                            setFltField(v);
                            computeValueOptions(v);
                        }}
                        fullWidth
                        sx={{ mb: 2 }}
                        size="small"
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="candidateName">Candidate</MenuItem>
                        <MenuItem value="jobTitle">Job</MenuItem>
                        <MenuItem value="interviewMode">Mode</MenuItem>
                        <MenuItem value="interviewType">Type</MenuItem>
                        <MenuItem value="interviewerType">Interviewer</MenuItem>
                        <MenuItem value="statusLabel">Status</MenuItem>
                        <MenuItem value="scoreBand">Score Band</MenuItem>
                        <MenuItem value="startAt">Interview Date</MenuItem>
                    </TextField>

                    {fltField === 'startAt' ? (
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                            <TextField
                                label="From"
                                type="date"
                                value={fltDateFrom}
                                onChange={e => setFltDateFrom(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="To"
                                type="date"
                                value={fltDateTo}
                                onChange={e => setFltDateTo(e.target.value)}
                                size="small"
                                InputLabelProps={{ shrink: true }}
                            />
                        </Box>
                    ) : (
                        <Autocomplete
                            disablePortal
                            options={valueOptions}
                            value={fltValue}
                            onChange={(_, v) => setFltValue(v || { label: 'All', value: 'all' })}
                            getOptionLabel={o => o?.label ?? ''}
                            ListboxProps={{
                                style: {
                                    maxHeight: 260,
                                    overflow: 'auto',
                                    overscrollBehavior: 'contain',
                                },
                                onWheel: (event) => event.stopPropagation(),
                                onTouchMove: (event) => event.stopPropagation(),
                            }}
                            renderInput={params => <TextField {...params} label="Value" size="small" />}
                            sx={{ mb: 2 }}
                        />
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <MUIButton
                            color="dark"
                            variant="outlined"
                            onClick={() => {
                                setFltField(appliedField);
                                setFltValue(appliedValue);
                                setFltDateFrom(appliedDateFrom);
                                setFltDateTo(appliedDateTo);
                                setFltOpen(false);
                            }}
                        >
                            Cancel
                        </MUIButton>

                        <MUIButton
                            onClick={() => {
                                setFltField('all');
                                setFltValue({ label: 'All', value: 'all' });
                                setFltDateFrom('');
                                setFltDateTo('');
                                setValueOptions([{ label: 'All', value: 'all' }]);
                                setAppliedField('all');
                                setAppliedValue({ label: 'All', value: 'all' });
                                setAppliedDateFrom('');
                                setAppliedDateTo('');
                                setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                setFltOpen(false);
                            }}
                        >
                            Clear
                        </MUIButton>

                        <MUIButton
                            onClick={() => {
                                setAppliedField(fltField);
                                setAppliedValue(fltValue);
                                setAppliedDateFrom(fltField === 'startAt' ? fltDateFrom : '');
                                setAppliedDateTo(fltField === 'startAt' ? fltDateTo : '');
                                if (fltField === 'statusLabel' && (fltValue?.value || 'all') !== 'all') {
                                    setStatusTab('all');
                                }
                                setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                setFltOpen(false);
                            }}
                        >
                            Apply
                        </MUIButton>
                    </Box>
                </MUIModal>

                <MUIArchiveCnfModal
                    open={deleteOpen}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={deleteRow}
                    itemName={current?.candidateName || current?.jobTitle || 'Interview'}
                />
            </Box>
        </Box>
    );
}
