import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    Card, CardContent, Box, Checkbox, FormControlLabel,
    Chip, Autocomplete, TextField, Button,
    Typography,
    IconButton, Tooltip, MenuItem, Menu, ListItemIcon, ListItemText,
    Avatar,
    InputAdornment,
    ToggleButton,
    ToggleButtonGroup,
    useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import { fetchData } from '../../AppUtils/dataAPI';
import { useCandidateContextState } from '../../contexts/CandidateContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIModal from '../MUI/commonUI/MUIModal';



export default function CandidatesList() {
    const nav = useNavigate();
    const [searchParams] = useSearchParams();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const isMdDown = useMediaQuery(theme.breakpoints.down('md'));
    const isSmDown = useMediaQuery(theme.breakpoints.down('sm'));
    const [candidateState, setCandidateState] = useCandidateContextState();
    const [, setUiState] = useUiContextState();
    const hasUrlDrivenQuery = useMemo(
        () => ['ids', 'search', 'filterField', 'filterValue', 'dateFrom', 'dateTo', 'viewMode']
            .some((key) => searchParams.has(key)),
        [searchParams]
    );
    const queryFromUrl = useMemo(() => {
        const viewMode = searchParams.get('viewMode') || 'me';
        const search = searchParams.get('search') || '';
        const ids = searchParams.get('ids') || '';
        const appliedField = searchParams.get('filterField') || 'all';
        const appliedValue = searchParams.get('filterValue') || 'all';
        const appliedValueLabel = searchParams.get('filterLabel') || appliedValue;
        const appliedDateFrom = searchParams.get('dateFrom') || '';
        const appliedDateTo = searchParams.get('dateTo') || '';

        return {
            viewMode,
            search,
            ids,
            appliedField,
            appliedValue,
            appliedValueLabel,
            appliedDateFrom,
            appliedDateTo,
        };
    }, [searchParams]);
    const initialQuery = hasUrlDrivenQuery
        ? {
            ...(candidateState?.candidateListQuery || {}),
            ...queryFromUrl,
            paginationModel: { page: 0, pageSize: 10 },
            sortModel: [],
        }
        : (candidateState?.candidateListQuery || queryFromUrl);
    const [delOpen, setDel] = useState(false);
    const [curRow, setCurRow] = useState(null);
    const [selIds, setSelIds] = useState([]);
    const [dlgOpen, setDlg] = useState(false);
    const [multi, setMulti] = useState(false);
    const [jobOpts, setJobOpts] = useState([]);
    const [picked, setPicked] = useState([]);
    const [searchTerm, setSearchTerm] = useState(initialQuery.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search || '');
    const [viewMode, setViewMode] = useState(initialQuery.viewMode || 'me');
    const [paginationModel, setPaginationModel] = useState(
        initialQuery.paginationModel || { page: 0, pageSize: 10 }
    );
    const [sortModel, setSortModel] = useState(initialQuery.sortModel || []);
    const [candidatesLoading, setCandidatesLoading] = useState(false);
    const [fltOpen, setFltOpen] = useState(false);
    const [fltField, setFltField] = useState('all');
    const [fltValue, setFltValue] = useState({ label: 'All', value: 'all' });
    const [valueOptions, setValueOptions] = useState([{ label: 'All', value: 'all' }]);
    const [jobFilterOpts, setJobFilterOpts] = useState([]);
    const [fltDateFrom, setFltDateFrom] = useState('');
    const [fltDateTo, setFltDateTo] = useState('');
    const initialAppliedValue = initialQuery.appliedValue
        ? { label: initialQuery.appliedValueLabel || initialQuery.appliedValue, value: initialQuery.appliedValue }
        : { label: 'All', value: 'all' };
    const [appliedField, setAppliedField] = useState(initialQuery.appliedField || 'all');
    const [appliedValue, setAppliedValue] = useState(initialAppliedValue);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialQuery.appliedDateFrom || '');
    const [appliedDateTo, setAppliedDateTo] = useState(initialQuery.appliedDateTo || '');
    const [actionsAnchorEl, setActionsAnchorEl] = useState(null);
    const [actionsRow, setActionsRow] = useState(null);
    const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
    const [scheduleCandidateRow, setScheduleCandidateRow] = useState(null);
    const [scheduleJobOptions, setScheduleJobOptions] = useState([]);
    const [scheduleJobPicked, setScheduleJobPicked] = useState(null);
    const requestRef = useRef(0);
    const inFlightKeyRef = useRef('');
    const actionsMenuOpen = Boolean(actionsAnchorEl);

    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
        }, 400);

        return () => clearTimeout(handle);
    }, [searchTerm]);

    const ensureJobOptions = async () => {
        if (jobOpts.length) return jobOpts;
        setUiState({ loadingMsg: "Loading, Please wait..." });
        try {
            const list = await fetchData('/api/jobs?fields=_id,title,internalTitle');
            const opts = list.map(j => ({ label: j.title + `(${j.internalTitle})`, value: j._id }));
            setJobOpts(opts);
            return opts;
        } catch (err) {
            console.error(err);
            return [];
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const columnSizing = useMemo(() => {
        if (isSmDown) {
            return {
                candidate: 150,
                jobApplied: 150,
                skills: 140,
            };
        }
        if (isMdDown) {
            return {
                candidate: 190,
                jobApplied: 190,
                skills: 170,
            };
        }
        return {
            candidate: 220,
            jobApplied: 220,
            skills: 200,
        };
    }, [isSmDown, isMdDown]);

    const cols = useMemo(() => {
        const splitSkills = (raw) =>
            String(raw || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        const splitList = (raw) =>
            String(raw || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        const getJobNames = (row) => {
            if (Array.isArray(row.jobApplied)) {
                return row.jobApplied.map((job) => String(job || '').trim()).filter(Boolean);
            }
            if (row.jobApplied) {
                return splitList(row.jobApplied);
            }
            if (Array.isArray(row.jobs)) {
                return row.jobs
                    .map((job) => {
                        if (!job) return '';
                        if (typeof job === 'string') return '';
                        return job.title || job.internalTitle || job.name || '';
                    })
                    .filter(Boolean);
            }
            return [];
        };

        return [
            {
                field: 'firstName',
                headerName: 'Candidate',
                minWidth: columnSizing.candidate,
                flex: 1.4,
                align: 'left',
                headerAlign: 'left',
                renderCell: ({ row }) => {
                    const name =
                        [row.firstName, row.lastName].filter(Boolean).join(' ') ||
                        row.email ||
                        'Unknown';
                    const phone = String(row.phoneNumber || '').trim();
                    const initials = name
                        .split(' ')
                        .filter(Boolean)
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Avatar
                                sx={{
                                    width: 36,
                                    height: 36,
                                    bgcolor: alpha(
                                        theme.palette.grey[400],
                                        isDark ? 0.28 : 0.18,
                                    ),
                                    color: theme.palette.text.primary,
                                    border: '1px solid',
                                    borderColor: alpha(
                                        theme.palette.grey[500],
                                        isDark ? 0.5 : 0.3,
                                    ),
                                    fontWeight: 700,
                                    fontSize: 12,
                                    lineHeight: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                }}
                            >
                                {initials}
                            </Avatar>
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                    {name}
                                </Typography>
                                {phone ? (
                                    <Typography
                                        variant="caption"
                                        sx={{ color: 'text.secondary', display: 'block', lineHeight: 1.2 }}
                                    >
                                        {phone}
                                    </Typography>
                                ) : null}
                            </Box>
                        </Box>
                    );
                },
            },
            {
                field: 'jobApplied',
                headerName: 'Job Applied',
                minWidth: columnSizing.jobApplied,
                flex: 1.2,
                sortable: false,
                align: 'left',
                headerAlign: 'left',
                renderCell: ({ row }) => {
                    const jobs = getJobNames(row);
                    if (!jobs.length) {
                        return (
                            <Typography variant="caption" color="text.secondary">
                                N/A
                            </Typography>
                        );
                    }
                    const shown = jobs.slice(0, 1);
                    const extra = jobs.length - shown.length;
                    return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.6 }}>
                            {shown.map((job) => (
                                <Chip
                                    key={job}
                                    size="small"
                                    label={job}
                                    sx={{
                                        bgcolor: alpha(
                                            theme.palette.grey[300],
                                            isDark ? 0.28 : 0.65,
                                        ),
                                        color: 'text.primary',
                                        border: '1px solid',
                                        borderColor: alpha(
                                            theme.palette.grey[500],
                                            isDark ? 0.45 : 0.25,
                                        ),
                                        fontWeight: 600,
                                        maxWidth: 200,
                                        height: 24,
                                        '& .MuiChip-label': {
                                            maxWidth: 180,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            fontSize: '0.74rem',
                                        },
                                    }}
                                />
                            ))}
                            {extra > 0 && (
                                <Chip
                                    size="small"
                                    label={`+${extra}`}
                                    sx={{
                                        bgcolor: 'action.hover',
                                        color: 'text.secondary',
                                        fontWeight: 600,
                                        height: 24,
                                    }}
                                />
                            )}
                        </Box>
                    );
                },
            },
            {
                field: 'skills',
                headerName: 'Skills',
                minWidth: columnSizing.skills,
                flex: 1.4,
                sortable: false,
                align: 'left',
                headerAlign: 'left',
                renderCell: ({ row }) => {
                    const skills = splitSkills(row.skills);
                    if (!skills.length) {
                        return (
                            <Typography variant="caption" color="text.secondary">
                                N/A
                            </Typography>
                        );
                    }
                    const shown = skills.slice(0, 2);
                    const extra = skills.length - shown.length;
                    return (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.6 }}>
                            {shown.map((skill) => (
                                <Chip
                                    key={skill}
                                    size="small"
                                    label={skill}
                                    sx={{
                                        bgcolor: alpha(
                                            theme.palette.grey[300],
                                            isDark ? 0.24 : 0.58,
                                        ),
                                        color: 'text.secondary',
                                        border: '1px solid',
                                        borderColor: alpha(
                                            theme.palette.grey[500],
                                            isDark ? 0.4 : 0.22,
                                        ),
                                        fontWeight: 500,
                                        height: 24,
                                        '& .MuiChip-label': {
                                            fontSize: '0.74rem',
                                            textTransform: 'none',
                                            letterSpacing: '0.01em',
                                        },
                                    }}
                                />
                            ))}
                            {extra > 0 && (
                                <Chip
                                    size="small"
                                    label={`+${extra}`}
                                    sx={{
                                        bgcolor: 'action.hover',
                                        color: 'text.secondary',
                                        fontWeight: 600,
                                        height: 24,
                                    }}
                                />
                            )}
                        </Box>
                    );
                },
            },
        ];
    }, [theme, isDark, columnSizing]);

    const ensureJobFilterOpts = async () => {
        if (jobFilterOpts.length) return;
        try {
            setUiState({ loadingMsg: "Loading, Please wait..." });
            const l = await fetchData('/api/jobs?fields=_id,title,internalTitle');
            const opts = (l || []).map(j => ({
                label: j.title + `(${j.internalTitle})`,
                value: j._id
            }));
            setJobFilterOpts(opts);
        } catch (e) {
            console.error(e);
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const computeValueOptions = field => {
        if (field === 'all' || field === 'createdAt') {
            setValueOptions([{ label: 'All', value: 'all' }]);
            setFltValue({ label: 'All', value: 'all' });
            return;
        }
        if (field === 'jobApplied') {
            const opts = [{ label: 'All', value: 'all' }, ...jobFilterOpts];
            const currentVal = fltValue?.value ?? appliedValue?.value ?? 'all';
            const found = opts.find(o => o.value === currentVal) || opts[0];
            setValueOptions(opts);
            setFltValue(found);
            return;
        }
        const src = candidateState?.candidateListRows || [];
        let uniq = Array.from(new Set(src.map(r => (r?.[field] ?? '').toString().trim()).filter(Boolean)));
        uniq = uniq.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
        const opts = [{ label: 'All', value: 'all' }, ...uniq.map(v => ({ label: v, value: v }))];

        const currentVal = fltValue?.value ?? appliedValue?.value ?? 'all';
        const found = opts.find(o => o.value === currentVal) || opts[0];

        setValueOptions(opts);
        setFltValue(found);
    };

    const openFilterModal = async () => {
        await ensureJobFilterOpts();
        setFltField(appliedField);
        setFltValue(appliedValue);
        setFltDateFrom(appliedDateFrom);
        setFltDateTo(appliedDateTo);
        computeValueOptions(appliedField);
        setFltOpen(true);
    };

    const loadCandidates = useCallback(async (queryState) => {
        const hasIdsFilter = Boolean(String(queryState?.ids || '').trim());
        const requestKey = JSON.stringify({
            viewMode: queryState?.viewMode || 'me',
            paginationModel: queryState?.paginationModel || { page: 0, pageSize: 10 },
            sortModel: queryState?.sortModel || [],
            search: queryState?.search || '',
            ids: queryState?.ids || '',
            appliedField: queryState?.appliedField || 'all',
            appliedValue: queryState?.appliedValue || 'all',
            appliedDateFrom: queryState?.appliedDateFrom || '',
            appliedDateTo: queryState?.appliedDateTo || '',
        });

        if (inFlightKeyRef.current === requestKey) {
            return;
        }
        inFlightKeyRef.current = requestKey;

        const reqId = ++requestRef.current;
        setCandidatesLoading(true);
        setUiState({ loadingMsg: 'Loading candidates, Please wait...' });

        const params = new URLSearchParams();
        if (queryState?.viewMode) params.set('viewMode', queryState.viewMode);
        if (queryState?.ids) params.set('ids', queryState.ids);

        if (!hasIdsFilter) {
            params.set('page', String((queryState?.paginationModel?.page ?? 0) + 1));
            params.set('pageSize', String(queryState?.paginationModel?.pageSize ?? 10));

            const sort = queryState?.sortModel?.[0];
            if (sort?.field) params.set('sortBy', sort.field);
            if (sort?.sort) params.set('sortOrder', sort.sort);
        }

        if (queryState?.search) {
            params.set('search', queryState.search);
        }

        if (!hasIdsFilter && queryState?.appliedField && queryState.appliedField !== 'all') {
            params.set('filterField', queryState.appliedField);
            if (queryState.appliedField === 'createdAt') {
                if (queryState.appliedDateFrom) params.set('dateFrom', queryState.appliedDateFrom);
                if (queryState.appliedDateTo) params.set('dateTo', queryState.appliedDateTo);
            } else if (queryState.appliedValue && queryState.appliedValue !== 'all') {
                params.set('filterValue', queryState.appliedValue);
            }
        }

        try {
            const res = await fetchData(`/api/candidates/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res)
                ? {
                    total: list.length,
                    page: 1,
                    pageSize: list.length,
                    totalPages: 1
                }
                : (res?.meta || { total: list.length, page: 1, pageSize: list.length, totalPages: 1 });

            const dt = list.map(c => ({
                ...c,
                id: c._id || c.id,
                createdAt: typeof c.createdAt === 'string' ? c.createdAt.substring(0, 10) : '',
            }));

            if (reqId !== requestRef.current) return;

            setCandidateState({
                candidateListRows: dt,
                candidatesListViewMode: queryState?.viewMode || 'me',
                candidateListMeta: meta,
                candidateListQuery: queryState,
            });

            console.log('[CandidatesList] Candidates loaded', {
                count: dt.length,
                total: meta?.total ?? dt.length,
                page: (queryState?.paginationModel?.page ?? 0) + 1
            });
        } catch (err) {
            console.error('[CandidatesList] Failed to load candidates:', err);
        } finally {
            if (inFlightKeyRef.current === requestKey) {
                inFlightKeyRef.current = '';
            }
            if (reqId === requestRef.current) {
                setCandidatesLoading(false);
                setUiState({ loadingMsg: null });
            }
        }
    }, [setCandidateState, setUiState]);

    const appliedValueKey = appliedValue?.value ?? 'all';
    const appliedValueLabel = appliedValue?.label ?? appliedValueKey;

    const queryState = useMemo(() => ({
        viewMode,
        paginationModel,
        sortModel,
        search: debouncedSearch,
        ids: initialQuery.ids || '',
        appliedField,
        appliedValue: appliedValueKey,
        appliedValueLabel,
        appliedDateFrom,
        appliedDateTo,
    }), [
        viewMode,
        paginationModel,
        sortModel,
        debouncedSearch,
        initialQuery.ids,
        appliedField,
        appliedValueKey,
        appliedValueLabel,
        appliedDateFrom,
        appliedDateTo
    ]);

    const queryKey = useMemo(() => JSON.stringify(queryState), [queryState]);
    const cachedKey = useMemo(
        () => (candidateState?.candidateListQuery ? JSON.stringify(candidateState.candidateListQuery) : ''),
        [candidateState?.candidateListQuery]
    );

    useEffect(() => {
        if (candidateState?.candidateListRows && cachedKey && cachedKey === queryKey) {
            return;
        }
        loadCandidates(queryState);
    }, [cachedKey, queryKey, candidateState?.candidateListRows, loadCandidates, queryState]);

    const isFilterApplied =
        (appliedField === 'createdAt' && (appliedDateFrom || appliedDateTo)) ||
        (appliedField !== 'all' && appliedValue?.value !== 'all');

    const handleViewModeChange = (_event, nextView) => {
        if (!nextView || viewMode === nextView) return;
        setViewMode(nextView);
        setPaginationModel((prev) => ({ ...prev, page: 0 }));
    };

    const destroy = async () => {
        setUiState({ loadingMsg: "Loading, Please wait..." });
        await fetchData(`/api/candidates/${curRow.id}`, { method: 'DELETE' });
        setUiState({ loadingMsg: null });
        loadCandidates(queryState);
        setDel(false);
    };

    const handleApplyClick = async () => {
        if (!selIds.length) {
            alert('Select at least one candidate');
            return;
        }
        await ensureJobOptions();
        setDlg(true);
    };

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
        setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
    };

    const handleOpenActionsMenu = (event, row) => {
        event.stopPropagation();
        setActionsAnchorEl(event.currentTarget);
        setActionsRow(row);
    };

    const handleCloseActionsMenu = () => {
        setActionsAnchorEl(null);
        setActionsRow(null);
    };

    const getPrimaryJobId = (row) => {
        if (!row) return null;
        if (row.jobId) return row.jobId;
        if (Array.isArray(row.jobs) && row.jobs.length) {
            const job = row.jobs[0];
            return typeof job === 'string' ? job : job?._id || null;
        }
        if (Array.isArray(row.jobApplied) && row.jobApplied.length) {
            const job = row.jobApplied[0];
            return typeof job === 'string' ? job : job?._id || null;
        }
        return null;
    };

    const buildCandidateJobOptions = (row, allJobOpts = []) => {
        if (!row) return [];
        const jobMap = new Map((allJobOpts || []).map(j => [String(j.value), j.label]));
        const rawJobs = Array.isArray(row.jobs) ? row.jobs : [];

        return rawJobs
            .map((job) => {
                if (!job) return null;
                if (typeof job === 'string') {
                    const id = job;
                    return { value: id, label: jobMap.get(id) || id };
                }
                const id = job?._id ? String(job._id) : null;
                if (!id) return null;
                const label = job.title || job.internalTitle || job.name || jobMap.get(id) || id;
                return { value: id, label };
            })
            .filter(Boolean);
    };

    const navigateToCandidateATS = (candidateId, jobId) => {
        if (!candidateId) return;
        const params = new URLSearchParams({ cid: candidateId });
        if (jobId) params.set('jid', jobId);
        nav(`/ats/?${params.toString()}`);
    };

    const openScheduleModalForCandidate = async (row) => {
        const id = row?._id || row?.id;
        if (!id) return;

        const jobsRaw = Array.isArray(row.jobs) ? row.jobs : [];
        if (jobsRaw.length <= 1) {
            const jobId = getPrimaryJobId(row);
            navigateToCandidateATS(id, jobId);
            return;
        }

        const opts = (await ensureJobOptions()) || jobOpts;
        const options = buildCandidateJobOptions(row, opts);

        if (options.length <= 1) {
            const jobId = options[0]?.value || getPrimaryJobId(row);
            navigateToCandidateATS(id, jobId);
            return;
        }

        setScheduleCandidateRow(row);
        setScheduleJobOptions(options);
        setScheduleJobPicked(null);
        setScheduleModalOpen(true);
    };

    const closeScheduleModal = () => {
        setScheduleModalOpen(false);
        setScheduleCandidateRow(null);
        setScheduleJobOptions([]);
        setScheduleJobPicked(null);
    };

    const continueScheduleForJob = () => {
        const row = scheduleCandidateRow;
        const job = scheduleJobPicked;
        const id = row?._id || row?.id;
        if (!id || !job?.value) return;

        closeScheduleModal();
        navigateToCandidateATS(id, job.value);
    };

    const assignNow = async () => {
        if (!picked.length) return alert('Select at least one job');
        setUiState({ loadingMsg: "Loading, Please wait..." });
        const res = await fetchData('/api/candidates/assign-job', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidateIds: selIds, jobIds: picked.map(p => p.value) }),
        })
            .catch(e => ({ error: e?.message || 'Candidate is already applied for this job' }))
            .finally(() => setUiState({ loadingMsg: null }));

        if (res?.error) alert(res.error);
        else {
            if (res.skipped?.length)
                alert(`${res.skipped.length} candidate(s) were already on that job and skipped.`);
            loadCandidates(queryState);
        }
        setDlg(false); setSelIds([]); setPicked([]);
    };

    const visibleRowIds = useMemo(
        () => (candidateState?.candidateListRows || [])
            .map((row) => row?.id ?? row?._id)
            .filter(Boolean)
            .map((id) => String(id)),
        [candidateState?.candidateListRows]
    );

    const extractVisibleSelectionIds = useCallback((selection) => {
        if (Array.isArray(selection)) {
            return new Set(selection.map((id) => String(id)));
        }

        if (selection?.ids) {
            const ids = [...selection.ids].map((id) => String(id));
            if (selection.type === 'exclude') {
                const excluded = new Set(ids);
                return new Set(visibleRowIds.filter((id) => !excluded.has(id)));
            }
            return new Set(ids);
        }

        return new Set();
    }, [visibleRowIds]);

    const handleSelectionChange = useCallback((newSelection) => {
        const nextVisibleSelected = extractVisibleSelectionIds(newSelection);

        setSelIds((prev) => {
            const merged = new Set((prev || []).map((id) => String(id)));

            // Replace only the currently visible slice; keep selection from other pages/filters.
            visibleRowIds.forEach((id) => merged.delete(id));
            nextVisibleSelected.forEach((id) => merged.add(id));

            return [...merged];
        });
    }, [extractVisibleSelectionIds, visibleRowIds]);

    const rows = candidateState?.candidateListRows || [];
    const rowCount = candidateState?.candidateListMeta?.total ?? rows.length;
    const rowSelectionModel = useMemo(
        () => ({ type: 'include', ids: new Set(selIds) }),
        [selIds]
    );
    const columnVisibilityModel = useMemo(() => {
        if (isSmDown) {
            return { jobApplied: false, skills: false };
        }
        if (isMdDown) {
            return { skills: false };
        }
        return {};
    }, [isSmDown, isMdDown]);
    const gridRowHeight = 64;

    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 5 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh",
            }}
        >
            <CardContent>
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 2.5,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            Talent Pool
                        </Typography>
                        <Tooltip title="Refresh">
                            <IconButton size="small" onClick={() => loadCandidates(queryState)}>
                                <RefreshRoundedIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
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
                            placeholder="Search candidates"
                            variant="outlined"
                            size="small"
                            value={searchTerm}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchRoundedIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{
                                minWidth: { xs: '100%', sm: 220 },
                                backgroundColor: 'background.paper',
                            }}
                        />
                        <MUIButton
                            variant="outlined"
                            startIcon={<AssignmentIndIcon />}
                            onClick={handleApplyClick}

                        >
                            Apply to Job
                        </MUIButton>
                        <MUIButton
                            variant="outlined"
                            // color="primary"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => nav('/candidates/new/')}
                        // sx={{
                        //     bgcolor: '#1d4ed8',
                        //     borderColor: 'transparent',
                        //     '&:hover': { bgcolor: '#1e40af' },
                        // }}
                        >
                            Add New Candidate
                        </MUIButton>
                    </Box>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: 2,
                        mb: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ToggleButtonGroup
                            value={viewMode}
                            exclusive
                            onChange={handleViewModeChange}
                            sx={{
                                p: 0.3,
                                borderRadius: 999,
                                bgcolor: 'action.hover',
                                '& .MuiToggleButton-root': {
                                    textTransform: 'none',
                                    border: 'none',
                                    px: 2,
                                    py: 0.6,
                                    fontSize: '0.8rem',
                                    borderRadius: 999,
                                    color: 'text.secondary',
                                },
                                '& .MuiToggleButton-root.Mui-selected': {
                                    bgcolor: 'primary.main',
                                    color: 'primary.contrastText',
                                    boxShadow: theme.shadows[2],
                                },
                                '& .MuiToggleButton-root.Mui-selected:hover': {
                                    bgcolor: 'primary.dark',
                                },
                            }}
                        >
                            <ToggleButton value="all">All Candidates</ToggleButton>
                            <ToggleButton value="me">My Candidates</ToggleButton>
                        </ToggleButtonGroup>
                        <Tooltip title="Filter">
                            <IconButton
                                size="small"
                                onClick={openFilterModal}
                                sx={{
                                    bgcolor: isFilterApplied
                                        ? alpha(theme.palette.primary.main, isDark ? 0.18 : 0.12)
                                        : 'background.paper',
                                    border: '1px solid',
                                    borderColor: isFilterApplied
                                        ? alpha(theme.palette.primary.main, 0.45)
                                        : 'divider',
                                }}
                            >
                                <FilterAltIcon
                                    fontSize="small"
                                    sx={{ color: isFilterApplied ? 'primary.main' : 'text.secondary' }}
                                />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>

                <MUIRetrieveDataGrid
                    hideHeader
                    rows={rows}
                    rowCount={rowCount}
                    columns={cols}
                    rowHeight={gridRowHeight}
                    autoSizeColumns={false}
                    columnVisibilityModel={columnVisibilityModel}
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
                    loading={candidatesLoading}
                    slots={{
                        noRowsOverlay: () => (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <Typography variant="subtitle1">No candidates found</Typography>
                                <Typography variant="body2">
                                    Try adjusting search, filters, or view mode.
                                </Typography>
                            </Box>
                        )
                    }}
                    checkboxSelection
                    keepNonExistentRowsSelected
                    rowSelectionModel={rowSelectionModel}
                    onRowSelectionModelChange={handleSelectionChange}
                    selectedIds={selIds}
                    onRowClick={r => nav(`/candidates/${r._id}`)}
                    onEdit={row => {
                        const dict = {
                            _id: row._id,
                            ['firstName of Candidate 0']: row.firstName ?? '',
                            ['lastName  of Candidate 0']: row.lastName ?? '',
                            ['email     of Candidate 0']: row.email ?? '',
                            ['countryCode of Candidate 0']: row.countryCode ?? '+91',
                            ['phoneNumber of Candidate 0']: row.phoneNumber ?? '',
                            ['skills of Candidate 0']: row.skills ?? '',
                            ['Approved Candidate 0']: true,
                        };
                        setCandidateState({ candidateInitialValuesDict: dict });
                        nav(`/candidates/edit/${row._id}`);
                    }}
                    onDelete={r => { setCurRow(r); setDel(true); }}
                    customActionsRenderer={(params) => (
                        <IconButton
                            size="small"
                            onClick={(event) => handleOpenActionsMenu(event, params.row)}
                            aria-label="candidate actions"
                            sx={{
                                border: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'background.paper',
                            }}
                        >
                            <MoreHorizRoundedIcon fontSize="small" />
                        </IconButton>
                    )}
                    actionColumnsProps={{ minWidth: 90 }}
                    sx={{
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        "& .MuiDataGrid-columnHeaders": {
                            backgroundColor: 'action.hover',
                            borderBottom: '1px solid',
                            borderColor: 'divider',
                            color: 'text.secondary',
                            fontWeight: 600,
                            fontSize: "0.7rem",
                        },
                        "& .MuiDataGrid-row": {
                            backgroundColor: 'background.paper',
                            minHeight: gridRowHeight,
                            maxHeight: gridRowHeight,
                            "&:nth-of-type(even)": {
                                backgroundColor: 'action.hover',
                            },
                            "&:hover": {
                                boxShadow: theme.shadows[1],
                            },
                        },
                        "& .MuiDataGrid-cell": {
                            minHeight: gridRowHeight,
                            maxHeight: gridRowHeight,
                            py: 0,
                            display: "flex",
                            alignItems: "center",
                        },
                        "& .MuiDataGrid-cellContent": {
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-start",
                            width: "100%",
                        },
                        "& .MuiDataGrid-columnSeparator": {
                            color: theme.palette.divider,
                        },
                        "& .MuiCheckbox-root": {
                            color: 'text.disabled',
                            "&.Mui-checked": {
                                color: 'primary.main',
                            },
                        },
                    }}
                />

                <Menu
                    anchorEl={actionsAnchorEl}
                    open={actionsMenuOpen}
                    onClose={handleCloseActionsMenu}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                    PaperProps={{
                        sx: {
                            borderRadius: 2,
                            minWidth: 200,
                            boxShadow: theme.shadows[2],
                        },
                    }}
                >
                    <MenuItem
                        onClick={() => {
                            const id = actionsRow?._id || actionsRow?.id;
                            handleCloseActionsMenu();
                            if (id) nav(`/candidates/${id}`);
                        }}
                    >
                        <ListItemIcon>
                            <PersonOutlineOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="View Profile" />
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            handleCloseActionsMenu();
                            if (!actionsRow) return;
                            openScheduleModalForCandidate(actionsRow);
                        }}
                    >
                        <ListItemIcon>
                            <EventAvailableOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Schedule Interview" />
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            const id = actionsRow?._id || actionsRow?.id;
                            const jobId = getPrimaryJobId(actionsRow);
                            handleCloseActionsMenu();
                            if (!id) return;
                            const params = new URLSearchParams({ cid: id });
                            if (jobId) params.set('jid', jobId);
                            nav(`/ats/?${params.toString()}`);
                        }}
                    >
                        <ListItemIcon>
                            <SwapHorizRoundedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Move Stage" />
                    </MenuItem>
                    <MenuItem
                        onClick={() => {
                            handleCloseActionsMenu();
                            alert('Notes feature is coming soon.');
                        }}
                    >
                        <ListItemIcon>
                            <NoteAddOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Add Note" />
                    </MenuItem>
                </Menu>

                <MUIArchiveCnfModal
                    open={delOpen}
                    onClose={() => setDel(false)}
                    onConfirm={destroy}
                    itemName={`${curRow?.firstName ?? ''} ${curRow?.lastName ?? ''}`.trim()}
                    variant="candidate"
                />

                <MUIModal open={dlgOpen} onClose={() => setDlg(false)}>
                    <Box sx={{ mb: 2, fontWeight: 600, fontSize: '1.1rem' }}>
                        Assign {selIds.length} candidate(s)
                    </Box>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={multi}
                                onChange={e => { setMulti(e.target.checked); setPicked([]); }}
                            />
                        }
                        label="Enable multiple job selection"
                    />
                    <Autocomplete
                        multiple={multi}
                        options={jobOpts}
                        value={multi ? picked : picked[0] ?? null}
                        onChange={(_, v) => setPicked(multi ? v : v ? [v] : [])}
                        getOptionLabel={o => (typeof o === 'string' ? o : o.label)}
                        isOptionEqualToValue={(o, v) => o.value === (v?.value ?? v)}
                        renderInput={p => <TextField {...p} label="Job(s)" margin="normal" />}
                    />
                    {multi && picked.length > 0 && (
                        <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                            {picked.map(j => (
                                <Chip key={j.value} label={j.label}
                                    onDelete={() => setPicked(picked.filter(x => x.value !== j.value))} />
                            ))}
                        </Box>
                    )}
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button onClick={() => setDlg(false)}>Cancel</Button>
                        <Button variant="contained" onClick={assignNow}>Assign</Button>
                    </Box>
                </MUIModal>

                <MUIModal open={scheduleModalOpen} onClose={closeScheduleModal}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">Select Job</Typography>
                        <Typography variant="body2" color="text.secondary">
                            This candidate is applied to multiple jobs. Choose one to open the candidate ATS page.
                        </Typography>
                    </Box>
                    <Autocomplete
                        options={scheduleJobOptions}
                        value={scheduleJobPicked}
                        onChange={(_, v) => setScheduleJobPicked(v)}
                        getOptionLabel={o => (typeof o === 'string' ? o : o.label)}
                        isOptionEqualToValue={(o, v) => o.value === (v?.value ?? v)}
                        renderInput={(p) => <TextField {...p} label="Job" margin="normal" />}
                    />
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <MUIButton onClick={closeScheduleModal}>Cancel</MUIButton>
                        <MUIButton
                            variant="contained"
                            onClick={continueScheduleForJob}
                            disabled={!scheduleJobPicked}
                            sx={{
                                textTransform: 'none',
                                fontWeight: 600,
                                borderRadius: '999px',
                                padding: '8px 22px',
                            }}
                        >
                            Continue to ATS
                        </MUIButton>
                    </Box>
                </MUIModal>

                <MUIModal open={fltOpen} onClose={() => setFltOpen(false)}>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">Filter Candidates</Typography>
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
                            if (v === 'jobApplied') ensureJobFilterOpts().then(() => computeValueOptions(v));
                            else computeValueOptions(v);
                        }}
                        fullWidth
                        sx={{ mb: 2 }}
                        size="small"
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="firstName">First Name</MenuItem>
                        <MenuItem value="lastName">Last Name</MenuItem>
                        <MenuItem value="email">Email</MenuItem>
                        <MenuItem value="jobApplied">Job Applied</MenuItem>
                        <MenuItem value="uploadedBy">Source</MenuItem>
                        <MenuItem value="createdAt">Created Date</MenuItem>
                    </TextField>

                    {fltField === 'createdAt' ? (
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
                            isOptionEqualToValue={(o, v) => o.value === v.value}
                            ListboxProps={{
                                style: {
                                    maxHeight: 260,
                                    overflow: 'auto',
                                    overscrollBehavior: 'contain',
                                },
                                onWheel: (event) => event.stopPropagation(),
                                onTouchMove: (event) => event.stopPropagation(),
                            }}
                            renderInput={p => <TextField {...p} label="Value" size="small" />}
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
                                setAppliedDateFrom(fltField === 'createdAt' ? fltDateFrom : '');
                                setAppliedDateTo(fltField === 'createdAt' ? fltDateTo : '');
                                setPaginationModel((prev) => ({ ...prev, page: 0 }));
                                setFltOpen(false);
                            }}
                        >
                            Apply
                        </MUIButton>
                    </Box>
                </MUIModal>
            </CardContent>
        </Box>
    );
}
