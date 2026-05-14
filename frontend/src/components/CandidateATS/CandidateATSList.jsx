import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Card,
    CardContent,
    Divider,
    Avatar,
    InputAdornment,
    IconButton,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Tooltip,
    TextField,
    Typography,
    Stepper,
    Step,
    StepLabel,
    Skeleton
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SearchIcon from '@mui/icons-material/Search';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import { alpha, useTheme } from '@mui/material/styles';

import MUIAlert from '../MUI/commonUI/MUIAlert';
import { fetchData } from '../../AppUtils/dataAPI';
import { useUiContextState } from '../../contexts/UiContext';
import { useCandidateATSContextState } from '../../contexts/CandidateATSContext';
import { useAuthContextState } from '../../contexts/AuthContext';
import MUIInput from '../MUI/commonUI/MUIInput';
import MUICreateForm from '../MUI/CommonCRUD/MUICreateForm';
import { DriveFileRenameOutlineRounded } from '@mui/icons-material';
import MUIButton from '../MUI/commonUI/MUIButton';
import defaultAvatar from '../../assets/default_avatar.jpg';

const STATUS_CHOICES = ['Not Initiated', 'Selected', 'Rejected', 'On Hold', 'Completed', 'Not Applicable'];
const SORT_OPTIONS = [
    { value: 'createdAt_desc', label: 'Newest', field: 'createdAt', sort: 'desc' },
    { value: 'createdAt_asc', label: 'Oldest', field: 'createdAt', sort: 'asc' },
    { value: 'candidateName_asc', label: 'Candidate (A-Z)', field: 'candidateName', sort: 'asc' },
    { value: 'candidateName_desc', label: 'Candidate (Z-A)', field: 'candidateName', sort: 'desc' },
    { value: 'email_asc', label: 'Email (A-Z)', field: 'email', sort: 'asc' },
    { value: 'email_desc', label: 'Email (Z-A)', field: 'email', sort: 'desc' },
];

// same color logic as InterviewScheduler
const colorFor = (theme, status) => {
    switch (status) {
        case 'Completed':
            return theme.palette.success.main;
        case 'Not Initiated':
            return theme.palette.warning.main;
        case 'Rejected':
            return theme.palette.error.main;
        case 'On Hold':
            return theme.palette.info.main;
        case 'Not Applicable':
            return theme.palette.warning.main;
        case 'Selected':
            return theme.palette.success.main;
        default:
            return theme.palette.text.secondary;
    }
};

// same icon logic as InterviewScheduler
const iconFor = (status) => {
    switch (status) {
        case 'Completed':
            return <CheckCircleOutlineIcon />;
        case 'Not Initiated':
            return <HourglassEmptyIcon />;
        case 'Rejected':
            return <CancelOutlinedIcon />;
        case 'On Hold':
            return <PauseCircleOutlineIcon />;
        case 'Not Applicable':
            return <BlockOutlinedIcon />;
        case 'Selected':
            return <CheckCircleOutlineIcon />;
        default:
            return <RadioButtonUncheckedIcon />;
    }
};

// wrapper to feed into StepIconComponent
const makeStepIcon = (theme, status) => () => (
    <Box sx={{ color: colorFor(theme, status), display: 'flex', alignItems: 'center' }}>
        {iconFor(status)}
    </Box>
);

export default function CandidateATS() {
    const theme = useTheme();
    const [authState] = useAuthContextState();
    const [candidateATSState, setCandidateATSState] = useCandidateATSContextState();
    const [, setUiState] = useUiContextState();
    const [searchParams] = useSearchParams();
    const initialQuery = candidateATSState?.candidateATSListQuery || {};
    const initCid = searchParams.get('cid') || initialQuery.candidateId || 'all';
    const initJid = searchParams.get('jid') || initialQuery.jobId || 'all';

    const [alert, setAlert] = useState({ open: false, msg: '', sev: 'success' });
    const [candFilter, setCandFilter] = useState(initCid || 'all');
    const [jobFilter, setJobFilter] = useState(initJid || 'all');
    const [searchTerm, setSearchTerm] = useState(initialQuery.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search || '');
    const [candidateOptions, setCandidateOptions] = useState([
        { label: 'All Candidates', value: 'all' }
    ]);
    const [candidateSearchInput, setCandidateSearchInput] = useState('');
    const [candidateOptionsLoading, setCandidateOptionsLoading] = useState(false);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 1000 });
    const [sortModel, setSortModel] = useState(
        initialQuery.sortModel || [{ field: 'createdAt', sort: 'desc' }]
    );
    const [atsLoading, setAtsLoading] = useState(false);
    const [editStage, setEditStage] = useState(null); ``
    const [activeStageByApp, setActiveStageByApp] = useState({});
    const [candidateProfile, setCandidateProfile] = useState(null);
    const [, setCandidateProfileLoading] = useState(
        initCid && initCid !== 'all'
    );
    const [candidateProfileLoaded, setCandidateProfileLoaded] = useState(
        !(initCid && initCid !== 'all')
    );
    const requestRef = useRef(0);
    const inFlightKeyRef = useRef('');
    const candidateOptionsRequestRef = useRef(0);
    const candidateOptionsInFlightRef = useRef('');

    const navigate = useNavigate();

    const normalizeJob = (job) => {
        if (!job) return null;
        if (typeof job !== 'object') {
            return { _id: job, title: '', internalTitle: '', company: null };
        }
        return {
            _id: job._id || job.id,
            title: job.title || '',
            internalTitle: job.internalTitle || '',
            company: job.company ? { name: job.company.name || '' } : null,
        };
    };

    const normalizeStageResult = (sr) => ({
        _id: sr?._id || sr?.id,
        stageStatus: sr?.stageStatus || 'Not Initiated',
        remarkOrFeedback: sr?.remarkOrFeedback || '',
        stage: sr?.stage
            ? {
                title: sr.stage.title || 'Stage',
                description: sr.stage.description || 'N/A',
            }
            : { title: 'Stage', description: 'N/A' },
    });

    const normalizeApplication = useCallback((app) => {
        if (!app) return null;
        return {
            _id: app._id || app.id,
            title: app.title || '',
            job: normalizeJob(app.job),
            stageResults: Array.isArray(app.stageResults)
                ? app.stageResults.map(normalizeStageResult)
                : [],
        };
    }, []);

    const normalizeCandidate = useCallback((cand) => ({
        _id: cand?._id || cand?.id,
        firstName: cand?.firstName || '',
        lastName: cand?.lastName || '',
        email: cand?.email || '',
        applications: Array.isArray(cand?.applications)
            ? cand.applications.map(normalizeApplication).filter(Boolean)
            : [],
    }), [normalizeApplication]);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
        }, 400);

        return () => clearTimeout(handle);
    }, [searchTerm]);

    useEffect(() => {
        let alive = true;
        if (!candFilter || candFilter === 'all') {
            setCandidateProfile(null);
            setCandidateProfileLoading(false);
            setCandidateProfileLoaded(true);
            return () => { };
        }
        setCandidateProfile(null);
        setCandidateProfileLoaded(false);
        (async () => {
            setCandidateProfileLoading(true);
            try {
                const profile = await fetchData(`/api/candidates/${candFilter}`);
                if (alive) setCandidateProfile(profile || null);
                // eslint-disable-next-line no-unused-vars
            } catch (err) {
                if (alive) setCandidateProfile(null);
            } finally {
                if (alive) {
                    setCandidateProfileLoading(false);
                    setCandidateProfileLoaded(true);
                }
            }
        })();
        return () => {
            alive = false;
        };
    }, [candFilter]);

    const loadCandidateOptions = useCallback(async (searchValue) => {
        const cleaned = String(searchValue || '').trim();
        const requestKey = JSON.stringify({ search: cleaned });

        if (candidateOptionsInFlightRef.current === requestKey) {
            return;
        }
        candidateOptionsInFlightRef.current = requestKey;

        const reqId = ++candidateOptionsRequestRef.current;
        setCandidateOptionsLoading(true);

        const params = new URLSearchParams();
        params.set('fields', '_id,firstName,lastName,email');
        params.set('page', '1');
        params.set('pageSize', '50');
        if (cleaned) params.set('search', cleaned);
        if (authState?.user?.role === 'recruiter') {
            params.set('viewMode', 'me');
        }

        try {
            const res = await fetchData(`/api/candidates/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const nextOptions = list.map(c => ({
                label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
                value: c._id
            }));

            if (reqId !== candidateOptionsRequestRef.current) return;

            setCandidateOptions([
                { label: 'All Candidates', value: 'all' },
                ...nextOptions
            ]);
        } catch (err) {
            console.error('[CandidateATSList] Failed to load candidate options:', err);
        } finally {
            if (candidateOptionsInFlightRef.current === requestKey) {
                candidateOptionsInFlightRef.current = '';
            }
            if (reqId === candidateOptionsRequestRef.current) {
                setCandidateOptionsLoading(false);
            }
        }
    }, [authState?.user?.role]);

    useEffect(() => {
        const handle = setTimeout(() => {
            loadCandidateOptions(candidateSearchInput);
        }, 350);

        return () => clearTimeout(handle);
    }, [candidateSearchInput, loadCandidateOptions]);

    const loadCandidateATS = useCallback(async (queryState) => {
        const requestKey = JSON.stringify({
            candidateId: queryState?.candidateId || 'all',
            jobId: queryState?.jobId || 'all',
            paginationModel: queryState?.paginationModel || { page: 0, pageSize: 10 },
            sortModel: queryState?.sortModel || [],
            search: queryState?.search || '',
        });

        if (inFlightKeyRef.current === requestKey) {
            return;
        }
        inFlightKeyRef.current = requestKey;

        const reqId = ++requestRef.current;
        setAtsLoading(true);
        setUiState({ loadingMsg: 'Loading ATS records, Please wait...' });

        const params = new URLSearchParams();
        params.set('page', String((queryState?.paginationModel?.page ?? 0) + 1));
        params.set('pageSize', String(queryState?.paginationModel?.pageSize ?? 10));

        const sort = queryState?.sortModel?.[0];
        if (sort?.field) params.set('sortBy', sort.field);
        if (sort?.sort) params.set('sortOrder', sort.sort);

        if (queryState?.search) {
            params.set('search', queryState.search);
        }

        if (queryState?.candidateId && queryState.candidateId !== 'all') {
            params.set('candidateId', queryState.candidateId);
        }
        if (queryState?.jobId && queryState.jobId !== 'all') {
            params.set('jobId', queryState.jobId);
        }

        try {
            const res = await fetchData(`/api/candidates/ats?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res)
                ? {
                    total: list.length,
                    page: 1,
                    pageSize: list.length,
                    totalPages: 1
                }
                : (res?.meta || { total: list.length, page: 1, pageSize: list.length, totalPages: 1 });

            const normalized = list.map(normalizeCandidate);

            if (reqId !== requestRef.current) return;

            setCandidateATSState({
                candidateATSListRows: normalized,
                candidateATSListMeta: meta,
                candidateATSListQuery: queryState
            });

            console.log('[CandidateATSList] ATS records loaded', {
                count: normalized.length,
                total: meta?.total ?? normalized.length,
                page: (queryState?.paginationModel?.page ?? 0) + 1
            });
        } catch (err) {
            console.error('[CandidateATSList] Failed to load ATS records:', err);
        } finally {
            if (inFlightKeyRef.current === requestKey) {
                inFlightKeyRef.current = '';
            }
            if (reqId === requestRef.current) {
                setAtsLoading(false);
                setUiState({ loadingMsg: null });
            }
        }
    }, [normalizeCandidate, setCandidateATSState, setUiState]);

    const queryState = useMemo(() => ({
        candidateId: candFilter,
        jobId: jobFilter,
        paginationModel,
        sortModel,
        search: debouncedSearch,
    }), [candFilter, jobFilter, paginationModel, sortModel, debouncedSearch]);

    const queryKey = useMemo(() => JSON.stringify(queryState), [queryState]);
    const cachedKey = useMemo(
        () => (candidateATSState?.candidateATSListQuery ? JSON.stringify(candidateATSState.candidateATSListQuery) : ''),
        [candidateATSState?.candidateATSListQuery]
    );

    useEffect(() => {
        if (candidateATSState?.candidateATSListRows && cachedKey && cachedKey === queryKey) {
            return;
        }
        loadCandidateATS(queryState);
    }, [cachedKey, queryKey, candidateATSState?.candidateATSListRows, loadCandidateATS, queryState]);

    const candATS = useMemo(() => candidateATSState?.candidateATSListRows || [], [candidateATSState?.candidateATSListRows]);

    /* options -------------------------------------------------- */
    const candOptions = useMemo(
        () => {
            const merged = new Map();
            candidateOptions.forEach(opt => {
                merged.set(opt.value, opt);
            });
            candATS.forEach(c => {
                merged.set(c._id, {
                    label: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.email,
                    value: c._id
                });
            });
            if (!merged.has('all')) {
                merged.set('all', { label: 'All Candidates', value: 'all' });
            }
            return Array.from(merged.values());
        },
        [candidateOptions, candATS]
    );

    const jobs = useMemo(() => {
        const uniq = new Map();
        candATS.forEach((cand) => {
            (cand.applications || []).forEach((app) => {
                const job = app.job;
                const jobId = job?._id || job?.id;
                if (!jobId) return;
                if (!uniq.has(jobId)) uniq.set(jobId, job);
            });
        });
        return Array.from(uniq.values());
    }, [candATS]);

    const allJobOpts = useMemo(
        () => [
            { label: 'All Jobs', value: 'all' },
            ...jobs.map(j => ({
                label:
                    j.title +
                    `(${j.internalTitle})` +
                    (j.company?.name ? ` - ${j.company.name}` : ''),
                value: j._id
            }))
        ],
        [jobs]
    );

    const jobOptions = useMemo(() => {
        if (candFilter === 'all') return allJobOpts;
        const c = candATS.find(x => x._id === candFilter);
        const ids = new Set((c?.applications || []).map(a => String(a.job?._id || a.job)));
        return [
            { label: 'All Jobs', value: 'all' },
            ...allJobOpts.filter(j => ids.has(j.value))
        ];
    }, [candFilter, candATS, allJobOpts]);

    const selectedCandidateOption = useMemo(
        () => (candFilter === 'all'
            ? null
            : candOptions.find(val => val?.value === candFilter) || null),
        [candFilter, candOptions]
    );

    const candidateDisplayName = useMemo(() => {
        if (candidateProfile) {
            return `${candidateProfile.firstName || ''} ${candidateProfile.lastName || ''}`.trim() || candidateProfile.email;
        }
        return selectedCandidateOption?.label || '';
    }, [candidateProfile, selectedCandidateOption]);
    const isCandidateFocused = candFilter !== 'all';
    const showProfileSkeleton = isCandidateFocused && !candidateProfileLoaded;

    /* filter view ---------------------------------------------- */
    const view = useMemo(
        () => {
            let filtered = candATS;
            if (candFilter && candFilter !== 'all') {
                filtered = filtered.filter(c => c._id === candFilter);
            }
            if (jobFilter && jobFilter !== 'all') {
                filtered = filtered
                    .map(c => ({
                        ...c,
                        applications: (c.applications || []).filter(
                            a => String(a.job?._id || a.job) === String(jobFilter)
                        )
                    }))
                    .filter(c => c.applications.length);
            }
            return filtered;
        },
        [candATS, candFilter, jobFilter]
    );

    return (
        <>
            <MUIAlert
                open={alert.open}
                message={alert.msg}
                severity={alert.sev}
                onClose={() => setAlert(a => ({ ...a, open: false }))}
            />

            <Box
                sx={{
                    px: { xs: 2, md: 4 },
                    py: { xs: 2, md: 3 },
                    minHeight: '100vh',
                    backgroundColor: '#F6F6F6'
                }}
            >
                <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, color: theme.palette.primary.main }}>
                        <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', fontWeight: 600 }}
                            onClick={() => navigate(-1)}
                        >
                            {'<'} Candidate Profile
                        </Typography>
                        <Typography variant="body2" sx={{ color: theme.palette.text.secondary }}>
                            {'>'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {candidateDisplayName || 'Candidate Tracking'}
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: isCandidateFocused ? { xs: '1fr', lg: '260px 1fr' } : '1fr',
                            gap: 2
                        }}
                    >
                        {isCandidateFocused && (
                            <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                <CardContent sx={{ textAlign: 'center' }}>
                                    {showProfileSkeleton ? (
                                        <>
                                            <Skeleton
                                                variant="rounded"
                                                width={120}
                                                height={140}
                                                sx={{ mx: 'auto', mb: 2, borderRadius: 2 }}
                                            />
                                            <Skeleton variant="text" width="60%" sx={{ mx: 'auto' }} />
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="subtitle2" sx={{ textAlign: 'left', mb: 1 }}>
                                                Contact
                                            </Typography>
                                            <Box sx={{ display: 'grid', gap: 1 }}>
                                                <Skeleton variant="text" width="80%" />
                                                <Skeleton variant="text" width="70%" />
                                                <Skeleton variant="text" width="90%" />
                                            </Box>
                                        </>
                                    ) : (
                                        <>
                                            <Avatar
                                                variant="rounded"
                                                src={candidateProfile?.profileUrl || defaultAvatar}
                                                alt={candidateDisplayName}
                                                sx={{
                                                    width: 120,
                                                    height: 140,
                                                    mx: 'auto',
                                                    mb: 2,
                                                    bgcolor: alpha(theme.palette.grey[400], 0.2),
                                                    color: theme.palette.text.primary,
                                                    fontWeight: 700,
                                                    borderRadius: 2,
                                                    boxShadow: `0 8px 20px ${alpha(theme.palette.common.black, 0.16)}`
                                                }}
                                            >
                                                {(candidateDisplayName || 'C')[0]}
                                            </Avatar>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                                {candidateDisplayName || 'Candidate'}
                                            </Typography>
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="subtitle2" sx={{ textAlign: 'left', mb: 1 }}>
                                                Contact
                                            </Typography>
                                            <Box sx={{ display: 'grid', gap: 1 }}>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        px: 1,
                                                        py: 0.6,
                                                        borderRadius: 2,
                                                        border: 1,
                                                        borderColor: 'divider',
                                                        bgcolor: 'background.default',
                                                    }}
                                                >
                                                    <LocationOnOutlinedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                                                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                                                        {candidateProfile?.location || 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        px: 1,
                                                        py: 0.6,
                                                        borderRadius: 2,
                                                        border: 1,
                                                        borderColor: 'divider',
                                                        bgcolor: 'background.default',
                                                    }}
                                                >
                                                    <PhoneOutlinedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                                                    <Typography variant="body2" sx={{ color: theme.palette.text.primary }}>
                                                        {candidateProfile?.phoneNumber
                                                            ? `${candidateProfile?.countryCode || ''} ${candidateProfile?.phoneNumber}`.trim()
                                                            : 'N/A'}
                                                    </Typography>
                                                </Box>
                                                <Box
                                                    sx={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 1,
                                                        px: 1,
                                                        py: 0.6,
                                                        borderRadius: 2,
                                                        border: 1,
                                                        borderColor: 'divider',
                                                        bgcolor: 'background.default',
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    <MailOutlineOutlinedIcon sx={{ fontSize: 18, color: theme.palette.text.secondary }} />
                                                    <Tooltip
                                                        title={candidateProfile?.email || ''}
                                                        arrow
                                                        disableHoverListener={!candidateProfile?.email}
                                                    >
                                                        <Typography
                                                            variant="body2"
                                                            noWrap
                                                            sx={{
                                                                color: theme.palette.text.primary,
                                                                minWidth: 0,
                                                                flex: 1,
                                                                maxWidth: '100%',
                                                                display: 'block',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {candidateProfile?.email || 'N/A'}
                                                        </Typography>
                                                    </Tooltip>
                                                </Box>
                                            </Box>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        <Card
                            sx={{
                                borderRadius: 3,
                                border: `1px solid ${theme.palette.divider}`,
                                background: alpha(theme.palette.background.paper, 0.78),
                                backdropFilter: 'blur(8px)',
                            }}
                        >
                            <CardContent>
                                <Box
                                    sx={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: 2
                                    }}
                                >
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Candidate Application Tracking Records
                                    </Typography>

                                    <Box
                                        spacing={2}
                                        sx={{
                                            minWidth: { xs: '100%', md: 'auto' },
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: 1.5,
                                            justifyContent: 'flex-end',
                                            alignItems: 'center'
                                        }}
                                    >
                                        <TextField
                                            label="Search"
                                            size="small"
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                                            }}
                                            InputProps={{
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <SearchIcon fontSize="small" />
                                                    </InputAdornment>
                                                )
                                            }}
                                        />
                                        <TextField
                                            select
                                            label="Sort by"
                                            size="small"
                                            value={
                                                SORT_OPTIONS.find(
                                                    opt => opt.field === sortModel?.[0]?.field && opt.sort === sortModel?.[0]?.sort
                                                )?.value || 'createdAt_desc'
                                            }
                                            onChange={(e) => {
                                                const picked = SORT_OPTIONS.find(opt => opt.value === e.target.value);
                                                const nextSort = picked ? [{ field: picked.field, sort: picked.sort }] : [];
                                                setSortModel(nextSort);
                                                setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                            }}
                                            sx={{ minWidth: 160 }}
                                        >
                                            {SORT_OPTIONS.map(opt => (
                                                <MenuItem key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        <MUIInput
                                            AutocompleteProps={{
                                                freeSolo: false,
                                                options: candOptions,
                                                filterOptions: (options) => options,
                                                value: selectedCandidateOption,
                                                disabled: true,
                                                onInputChange: (_event, newValue, reason) => {
                                                    if (reason === 'reset') return;
                                                    setCandidateSearchInput(newValue || '');
                                                },
                                                onChange: (_, val) => {
                                                    const next = val?.value || 'all';
                                                    setCandFilter(next);
                                                    setJobFilter('all');
                                                    setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                                    if (!val || val.value === 'all') {
                                                        setCandidateSearchInput('');
                                                    } else {
                                                        setCandidateSearchInput(val.label || '');
                                                    }
                                                },
                                                loading: candidateOptionsLoading,
                                                size: 'small'
                                            }}
                                            AutocompleteInputProps={{
                                                label: 'Filter Candidate',
                                                required: true
                                            }}
                                            sx={{
                                                minWidth: 180
                                            }}
                                        />
                                        <MUIInput
                                            AutocompleteProps={{
                                                freeSolo: false,
                                                options: jobOptions,
                                                value: jobOptions.find(
                                                    val => val?.value === jobFilter
                                                ),
                                                onChange: (_, val) => {
                                                    const next = val?.value || 'all';
                                                    setJobFilter(next);
                                                    setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                                },
                                                size: 'small'
                                            }}
                                            AutocompleteInputProps={{
                                                label: 'Filter Job',
                                                required: true
                                            }}
                                            sx={{
                                                minWidth: 180
                                            }}
                                        />
                                    </Box>
                                </Box>

                                <Divider sx={{ my: 2 }} />

                                {atsLoading ? (
                                    <Typography
                                        sx={{ textAlign: 'center', mt: 4 }}
                                        color="text.secondary"
                                    >
                                        Loading ATS records...
                                    </Typography>
                                ) : view.length === 0 ? (
                                    <Typography
                                        sx={{ textAlign: 'center', mt: 4 }}
                                        color="text.secondary"
                                    >
                                        No records found. Try adjusting search or filters.
                                    </Typography>
                                ) : (
                                    view.map(cand => (
                                        <Accordion
                                            key={cand._id}
                                            defaultExpanded
                                            sx={{
                                                m: 2,
                                                borderRadius: 2,
                                                borderBottom: '0.8px solid'
                                            }}
                                        >
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Typography sx={{ fontWeight: 600 }}>
                                                    {cand.firstName} {cand.lastName}
                                                </Typography>
                                            </AccordionSummary>

                                            <AccordionDetails>
                                                {cand.applications.map(app => {
                                                    const stageResults = app.stageResults || [];

                                                    // build rows similar to InterviewScheduler
                                                    const stageRows = stageResults.map(sr => ({
                                                        id: sr._id,
                                                        title: sr.stage?.title || 'Stage',
                                                        status: sr.stageStatus || 'Not Initiated',
                                                        description: sr.stage?.description || 'N/A',
                                                        remarkOrFeedback: sr.remarkOrFeedback || ''
                                                    }));

                                                    // default: first stage (index 0)
                                                    let activeIndex = 0;
                                                    if (stageRows.length > 0) {
                                                        const activeIdForApp = activeStageByApp[app._id];
                                                        const manualIdx = stageRows.findIndex(
                                                            s => s.id === activeIdForApp
                                                        );
                                                        if (manualIdx >= 0) {
                                                            activeIndex = manualIdx;
                                                        }
                                                    }

                                                    const activeRow = stageRows[activeIndex];
                                                    const activeSr = stageResults.find(
                                                        s => s._id === activeRow?.id
                                                    );

                                                    return (
                                                        <Accordion
                                                            key={app._id}
                                                            defaultExpanded
                                                            sx={{
                                                                m: 1,
                                                                borderRadius: 2,
                                                                borderBottom: '1px dashed'
                                                            }}
                                                        >
                                                            <AccordionSummary
                                                                expandIcon={<ExpandMoreIcon />}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        fontWeight: 500
                                                                    }}
                                                                >
                                                                    {app.title}
                                                                </Typography>
                                                                <Typography
                                                                    sx={{
                                                                        ml: 2,
                                                                        color: 'text.secondary'
                                                                    }}
                                                                >
                                                                    {app.job?.title || '—'}
                                                                </Typography>
                                                            </AccordionSummary>

                                                            <AccordionDetails>
                                                                {stageRows.length === 0 ? (
                                                                    <Typography
                                                                        variant="body2"
                                                                        color="text.secondary"
                                                                    >
                                                                        No stages found.
                                                                    </Typography>
                                                                ) : (
                                                                    <>
                                                                        {/* STAGE STEPPER – same vibe as InterviewScheduler */}
                                                                        <Box sx={{ mb: 3 }}>
                                                                            <Stepper
                                                                                activeStep={activeIndex}
                                                                                alternativeLabel
                                                                                sx={{
                                                                                    '& .MuiStepConnector-line': {
                                                                                        borderColor: alpha(theme.palette.primary.main, 0.4),
                                                                                        borderTopWidth: 3
                                                                                    }
                                                                                }}
                                                                            >
                                                                                {stageRows.map(row => (
                                                                                    <Step
                                                                                        key={row.id}
                                                                                        onClick={() =>
                                                                                            setActiveStageByApp(prev => ({
                                                                                                ...prev,
                                                                                                [app._id]: row.id
                                                                                            }))
                                                                                        }
                                                                                        sx={{
                                                                                            cursor: 'pointer'
                                                                                        }}
                                                                                    >
                                                                                        <StepLabel
                                                                                            StepIconComponent={makeStepIcon(
                                                                                                theme,
                                                                                                row.status
                                                                                            )}
                                                                                            sx={{
                                                                                                '& .MuiStepLabel-label': {
                                                                                                    color:
                                                                                                        colorFor(
                                                                                                            theme,
                                                                                                            row.status
                                                                                                        ) +
                                                                                                        ' !important',
                                                                                                    fontWeight: 600
                                                                                                }
                                                                                            }}
                                                                                        >
                                                                                            {row.title}
                                                                                        </StepLabel>
                                                                                    </Step>
                                                                                ))}
                                                                            </Stepper>
                                                                        </Box>

                                                                        {/* Current stage text similar to InterviewScheduler */}
                                                                        {activeRow && (
                                                                            <Box
                                                                                sx={{
                                                                                    mb: 2,
                                                                                    textAlign: 'center'
                                                                                }}
                                                                            >
                                                                                <Typography
                                                                                    variant="body2"
                                                                                    color="text.secondary"
                                                                                >
                                                                                    Current stage:{' '}
                                                                                    <strong
                                                                                        style={{
                                                                                            color: colorFor(
                                                                                                theme,
                                                                                                activeRow.status
                                                                                            )
                                                                                        }}
                                                                                    >
                                                                                        {activeRow.title}{' '}
                                                                                        ({activeRow.status})
                                                                                    </strong>
                                                                                </Typography>
                                                                            </Box>
                                                                        )}

                                                                        {/* ACTIVE STAGE DETAILS BELOW STEPPER */}
                                                                        {activeRow && activeSr && (
                                                                            <Box sx={{ mt: 2 }}>
                                                                                <List
                                                                                    component="ul"
                                                                                    sx={{
                                                                                        listStyleType:
                                                                                            'circle',
                                                                                        pl: 4
                                                                                    }}
                                                                                >
                                                                                    <ListItem
                                                                                        key={
                                                                                            activeRow.description
                                                                                        }
                                                                                        component="li"
                                                                                        sx={{
                                                                                            display:
                                                                                                'list-item'
                                                                                        }}
                                                                                    >
                                                                                        <ListItemText
                                                                                            primary="Description"
                                                                                            secondary={
                                                                                                activeRow.description ||
                                                                                                'N/A'
                                                                                            }
                                                                                        />
                                                                                    </ListItem>

                                                                                    <ListItem
                                                                                        key={
                                                                                            activeRow.status
                                                                                        }
                                                                                        component="li"
                                                                                        sx={{
                                                                                            display:
                                                                                                'list-item'
                                                                                        }}
                                                                                    >
                                                                                        <Box
                                                                                            sx={{
                                                                                                display: 'flex',
                                                                                                justifyContent:
                                                                                                    'space-between',
                                                                                                alignItems:
                                                                                                    'center'
                                                                                            }}
                                                                                        >
                                                                                            <ListItemText
                                                                                                primary="Stage Status"
                                                                                                secondary={
                                                                                                    <span
                                                                                                        style={{
                                                                                                            color: colorFor(
                                                                                                                theme,
                                                                                                                activeRow.status
                                                                                                            )
                                                                                                        }}
                                                                                                    >
                                                                                                        {activeRow.status ||
                                                                                                            'N/A'}
                                                                                                    </span>
                                                                                                }
                                                                                            />
                                                                                            <Tooltip
                                                                                                title="Edit Stage Status"
                                                                                                arrow
                                                                                            >
                                                                                                <IconButton
                                                                                                    onClick={() =>
                                                                                                        editStage !==
                                                                                                        activeSr._id &&
                                                                                                        setEditStage(
                                                                                                            activeSr._id
                                                                                                        )
                                                                                                    }
                                                                                                    sx={{
                                                                                                        minWidth: { xs: 36, sm: 48 }
                                                                                                    }}
                                                                                                >
                                                                                                    <DriveFileRenameOutlineRounded />
                                                                                                </IconButton>
                                                                                            </Tooltip>
                                                                                        </Box>
                                                                                    </ListItem>

                                                                                    <ListItem
                                                                                        key={
                                                                                            activeRow.remarkOrFeedback
                                                                                        }
                                                                                        component="li"
                                                                                        sx={{
                                                                                            display:
                                                                                                'list-item'
                                                                                        }}
                                                                                    >
                                                                                        <Box
                                                                                            sx={{
                                                                                                display: 'flex',
                                                                                                justifyContent:
                                                                                                    'space-between',
                                                                                                alignItems:
                                                                                                    'center'
                                                                                            }}
                                                                                        >
                                                                                            <ListItemText
                                                                                                primary="Remark Or Feedback"
                                                                                                secondary={
                                                                                                    activeRow.remarkOrFeedback ||
                                                                                                    'N/A'
                                                                                                }
                                                                                            />
                                                                                            <Tooltip
                                                                                                title="Edit Stage Remark Or Feedback"
                                                                                                arrow
                                                                                            >
                                                                                                <IconButton
                                                                                                    onClick={() =>
                                                                                                        editStage !==
                                                                                                        activeSr._id &&
                                                                                                        setEditStage(
                                                                                                            activeSr._id
                                                                                                        )
                                                                                                    }
                                                                                                    sx={{
                                                                                                        minWidth: { xs: 36, sm: 48 }
                                                                                                    }}
                                                                                                >
                                                                                                    <DriveFileRenameOutlineRounded />
                                                                                                </IconButton>
                                                                                            </Tooltip>
                                                                                        </Box>
                                                                                    </ListItem>
                                                                                </List>

                                                                                {/* Schedule button – centered, royal blue, hidden when Selected/Completed */}
                                                                                {activeRow.status !== 'Completed' &&
                                                                                    activeRow.status !== 'Selected' &&
                                                                                    activeRow.status !== 'Rejected' &&
                                                                                    activeRow.status !==
                                                                                    'Not Applicable' && (
                                                                                        <Box
                                                                                            sx={{
                                                                                                display: 'flex',
                                                                                                justifyContent:
                                                                                                    'center',
                                                                                                mt: 2
                                                                                            }}
                                                                                        >
                                                                                            <MUIButton
                                                                                                variant="contained"
                                                                                                color="primary"
                                                                                                onClick={() => {
                                                                                                    const params = new URLSearchParams({
                                                                                                        cid: String(cand._id || ''),
                                                                                                        jid: String(app.job?._id || ''),
                                                                                                        atsid: String(app._id || ''),
                                                                                                    });
                                                                                                    if (activeSr?.stage?._id) {
                                                                                                        params.set('stageId', String(activeSr.stage._id));
                                                                                                    }
                                                                                                    if (activeRow?.title) {
                                                                                                        params.set('stageTitle', String(activeRow.title));
                                                                                                    }
                                                                                                    navigate(`/interviews/schedule/?${params.toString()}`);
                                                                                                }}
                                                                                                sx={{
                                                                                                    textTransform: "none",
                                                                                                    fontWeight: 600,
                                                                                                    borderRadius: 2,
                                                                                                    paddingX: 3,
                                                                                                    paddingY: 1.2,
                                                                                                    boxShadow: `0px 6px 16px ${alpha(theme.palette.common.black, 0.16)}`,
                                                                                                }}
                                                                                            >
                                                                                                Schedule Interview
                                                                                            </MUIButton>
                                                                                        </Box>
                                                                                    )}

                                                                                {/* Edit form, only when this active stage is in edit mode */}
                                                                                {editStage === activeSr._id && (
                                                                                    <MUICreateForm
                                                                                        key={JSON.stringify(
                                                                                            activeSr
                                                                                        )}
                                                                                        initialValuesDict={{
                                                                                            ...activeSr
                                                                                        }}
                                                                                        fields={[
                                                                                            {
                                                                                                type: 'select',
                                                                                                AutocompleteProps:
                                                                                                {
                                                                                                    getOptionLabel:
                                                                                                        x => x,
                                                                                                    getOptionValue:
                                                                                                        x => x,
                                                                                                    options:
                                                                                                        STATUS_CHOICES,
                                                                                                    defaultValue:
                                                                                                        activeSr.stageStatus
                                                                                                },
                                                                                                AutocompleteInputProps:
                                                                                                {
                                                                                                    label:
                                                                                                        'Stage Status',
                                                                                                    name: 'stageStatus',
                                                                                                    defaultValue:
                                                                                                        activeSr.stageStatus,
                                                                                                    required: true
                                                                                                }
                                                                                            },
                                                                                            {
                                                                                                type: 'text',
                                                                                                AutocompleteInputProps:
                                                                                                {
                                                                                                    label:
                                                                                                        'Remark Or Feedback',
                                                                                                    name: 'remarkOrFeedback'
                                                                                                }
                                                                                            },
                                                                                            {
                                                                                                type: 'submit',
                                                                                                label: 'Save'
                                                                                            }
                                                                                        ]}
                                                                                        submitUrl={`/api/candidates/ats/${app._id}/stageresult/${activeSr._id}`}
                                                                                        submitMethod="PUT"
                                                                                        onSubmitExtended={() => {
                                                                                            setEditStage(
                                                                                                null
                                                                                            );
                                                                                            loadCandidateATS(queryState);
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </Box>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </AccordionDetails>
                                                        </Accordion>
                                                    );
                                                })}
                                            </AccordionDetails>
                                        </Accordion>
                                    ))
                                )}

                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>
        </>
    );
}
