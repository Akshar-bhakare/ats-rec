import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Avatar,
    FormControlLabel,
    Switch,
    Typography,
    Tooltip,
    IconButton,
    Skeleton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';

import { useNavigate, useLocation } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import TableFilterBar from '../MUI/CommonCRUD/TableFilterBar';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useJobContextState } from '../../contexts/JobContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import JobShareLinkModal from '../jobShare/ShareCvLinkModal';



export default function JobsList() {
    const [authState] = useAuthContextState();
    const [jobState, setJobState] = useJobContextState();
    const [, setUiState] = useUiContextState();

    const location = useLocation();
    const queryFromUrl = useMemo(() => {
        const params = new URLSearchParams(location.search);
        const viewMode = params.get('viewMode') || '';
        if (!viewMode) return {};
        return {
            viewMode,
            paginationModel: { page: 0, pageSize: 10 },
            sortModel: [],
        };
    }, [location.search]);
    const initialQuery = useMemo(() => {
        if (!queryFromUrl.viewMode) {
            return jobState?.jobListQuery || {};
        }
        return {
            ...(jobState?.jobListQuery || {}),
            ...queryFromUrl,
        };
    }, [jobState?.jobListQuery, queryFromUrl]);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [current, setCurrent] = useState(null);
    const [searchTerm, setSearchTerm] = useState(initialQuery.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search || '');
    const [viewMode, setViewMode] = useState(initialQuery.viewMode || 'me');
    const [paginationModel, setPaginationModel] = useState(
        initialQuery.paginationModel || { page: 0, pageSize: 10 }
    );
    const [sortModel, setSortModel] = useState(initialQuery.sortModel || []);
    const [jobsLoading, setJobsLoading] = useState(false);

    const initialAppliedValue = initialQuery.appliedValue
        ? { label: initialQuery.appliedValueLabel || initialQuery.appliedValue, value: initialQuery.appliedValue }
        : { label: 'All', value: 'all' };
    const [appliedField, setAppliedField] = useState(initialQuery.appliedField || 'all');
    const [appliedValue, setAppliedValue] = useState(initialAppliedValue);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialQuery.appliedDateFrom || '');
    const [appliedDateTo, setAppliedDateTo] = useState(initialQuery.appliedDateTo || '');

    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: '',
        severity: 'info',
    });
    const [shareModalCfg, setShareModalCfg] = useState({ open: false, job: null });
    const requestRef = useRef(0);
    const inFlightKeyRef = useRef('');

    // All rows for filter value options (separate from paginated rows)
    const [filterAllRows, setFilterAllRows] = useState([]);
    const [filterRowsLoading, setFilterRowsLoading] = useState(false);
    const filterLoadedViewModeRef = useRef(null); // tracks which viewMode we loaded filter data for

    const closeAlert = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertCfg(a => ({ ...a, open: false }));
    };

    const navigate = useNavigate();

    // Show toast coming from JobDetail navigation state (one-time)
    useEffect(() => {
        const toast = location?.state?.toast;
        if (toast?.open) {
            setAlertCfg({
                open: true,
                message: toast.message || 'Success.',
                severity: toast.severity || 'success',
            });
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location?.state]);

    // Debounce search
    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
        }, 400);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    // Reset filter data cache when viewMode changes so next filter open re-fetches
    useEffect(() => {
        filterLoadedViewModeRef.current = null;
        setFilterAllRows([]);
    }, [viewMode]);

    // Load ALL jobs (no pagination) for filter value options — called when filter modal opens
    const loadFilterRows = useCallback(async () => {
        if (filterLoadedViewModeRef.current === viewMode) return; // already loaded
        setFilterRowsLoading(true);
        try {
            const res = await fetchData(
                `/api/jobs/?resolveCompanies=true&viewMode=${viewMode}&pageSize=9999`
            );
            const list = Array.isArray(res) ? res : (res?.items || []);
            const dt = list.map(j => ({
                ...j,
                id: j._id || j.id,
                createdAt: typeof j.createdAt === 'string' ? j.createdAt.substring(0, 10) : '',
            }));
            setFilterAllRows(dt);
            filterLoadedViewModeRef.current = viewMode;
        } catch (err) {
            console.error('[JobsList] Failed to load filter options:', err);
        } finally {
            setFilterRowsLoading(false);
        }
    }, [viewMode]);

    const renderPrimarySecondaryCell = (primary, secondary) => (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.25 }}>
                {primary || '-'}
            </Typography>
            {secondary ? (
                <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.2, mt: 0.2 }}>
                    {secondary}
                </Typography>
            ) : null}
        </Box>
    );

    const renderEntityCellWithAvatar = (primary, secondary) => {
        const text = primary || '-';
        const initials = text
            .split(' ')
            .filter(Boolean)
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, height: '100%' }}>
                <Avatar
                    sx={{
                        width: 34,
                        height: 34,
                        bgcolor: (theme) =>
                            alpha(theme.palette.grey[400], theme.palette.mode === 'dark' ? 0.28 : 0.18),
                        color: 'text.primary',
                        fontWeight: 700,
                        fontSize: 12,
                        border: 1,
                        borderColor: (theme) =>
                            alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.5 : 0.3),
                    }}
                >
                    {initials || 'JB'}
                </Avatar>
                {renderPrimarySecondaryCell(text, secondary)}
            </Box>
        );
    };

    const columns = [
        {
            field: 'id',
            headerName: 'ID',
            maxWidth: 70,
            sortable: false,
            filterable: false,
            align: 'left',
            headerAlign: 'left',
            renderCell: (params) => {
                const idx = params.api.getAllRowIds().indexOf(params.id);
                return (paginationModel.page * paginationModel.pageSize) + idx + 1;
            },
        },
        {
            field: 'title',
            headerName: 'Title',
            minWidth: 240,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => renderEntityCellWithAvatar(
                params.row?.title,
                params.row?.internalTitle
            ),
        },
        {
            field: 'company',
            headerName: 'Company',
            minWidth: 200,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => renderPrimarySecondaryCell(
                params?.value?.name,
                params.row?.createdAt
            ),
        },
        {
            field: 'workMode',
            headerName: 'Mode',
            minWidth: 100,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => renderPrimarySecondaryCell(
                params.row?.jobType,
                params.row?.workMode
            ),
        },
        {
            field: 'locations',
            headerName: 'Location',
            minWidth: 200,
            maxWidth: 300,
            flex: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => {
                const locs = Array.isArray(params.row?.locations) ? params.row.locations : [];
                const primary = locs.length ? locs[0] : '-';
                const secondary = locs.length > 1 ? `+${locs.length - 1} more` : null;
                return renderPrimarySecondaryCell(primary, secondary);
            }
        },
        {
            field: 'createdByName',
            headerName: 'Created By',
            minWidth: 180,
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            renderCell: (params) => renderPrimarySecondaryCell(
                params.row?.createdByName,
                params.row?.createdAt
            ),
        },
    ];

    // Extract a displayable value from a row for a given filter field
    const getFieldValue = (row, field) => {
        switch (field) {
            case 'company': return row?.company?.name ?? '';
            case 'createdAt': return row.createdAt;
            case 'locations': return Array.isArray(row.locations) ? row.locations.join(', ') : row.locations ?? '';
            case 'title':
            case 'internalTitle':
            case 'workMode':
            case 'jobType':
            case 'createdByName':
                return row?.[field] ?? '';
            default: return '';
        }
    };

    // Filter fields config for TableFilterBar
    const filterFields = [
        { field: 'title', label: 'Title' },
        { field: 'internalTitle', label: 'Internal Title' },
        { field: 'company', label: 'Company' },
        { field: 'workMode', label: 'Mode' },
        { field: 'jobType', label: 'Type' },
        { field: 'locations', label: 'Location' },
        { field: 'createdByName', label: 'Created By' },
        { field: 'createdAt', label: 'Created Date', type: 'date' },
    ];

    const loadJobs = useCallback(async (queryState) => {
        const requestKey = JSON.stringify({
            viewMode: queryState?.viewMode || 'me',
            paginationModel: queryState?.paginationModel || { page: 0, pageSize: 10 },
            sortModel: queryState?.sortModel || [],
            search: queryState?.search || '',
            appliedField: queryState?.appliedField || 'all',
            appliedValue: queryState?.appliedValue || 'all',
            appliedDateFrom: queryState?.appliedDateFrom || '',
            appliedDateTo: queryState?.appliedDateTo || '',
        });

        if (inFlightKeyRef.current === requestKey) return;
        inFlightKeyRef.current = requestKey;

        const reqId = ++requestRef.current;
        setJobsLoading(true);

        const params = new URLSearchParams();
        params.set('resolveCompanies', 'true');
        if (queryState?.viewMode) params.set('viewMode', queryState.viewMode);
        params.set('page', String((queryState?.paginationModel?.page ?? 0) + 1));
        params.set('pageSize', String(queryState?.paginationModel?.pageSize ?? 10));

        const sort = queryState?.sortModel?.[0];
        if (sort?.field) params.set('sortBy', sort.field);
        if (sort?.sort) params.set('sortOrder', sort.sort);

        if (queryState?.search) params.set('search', queryState.search);

        if (queryState?.appliedField && queryState.appliedField !== 'all') {
            params.set('filterField', queryState.appliedField);
            if (queryState.appliedField === 'createdAt') {
                if (queryState.appliedDateFrom) params.set('dateFrom', queryState.appliedDateFrom);
                if (queryState.appliedDateTo) params.set('dateTo', queryState.appliedDateTo);
            } else if (queryState.appliedValue && queryState.appliedValue !== 'all') {
                params.set('filterValue', queryState.appliedValue);
            }
        }

        try {
            const res = await fetchData(`/api/jobs/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res)
                ? { total: list.length, page: 1, pageSize: list.length, totalPages: 1 }
                : (res?.meta || { total: list.length, page: 1, pageSize: list.length, totalPages: 1 });

            const dt = list.map(j => ({
                ...j,
                id: j._id || j.id,
                createdAt: typeof j.createdAt === 'string' ? j.createdAt.substring(0, 10) : '',
            }));

            if (reqId !== requestRef.current) return;

            setJobState({
                jobRowsList: dt,
                jobsListViewMode: queryState?.viewMode || 'me',
                jobListMeta: meta,
                jobListQuery: queryState,
            });
        } catch (err) {
            console.error('[JobsList] Failed to load jobs:', err);
            setAlertCfg({
                open: true,
                message: err?.message || 'Failed to load jobs',
                severity: 'error',
            });
        } finally {
            if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
            if (reqId === requestRef.current) {
                setJobsLoading(false);
                setUiState({ loadingMsg: null });
            }
        }
    }, [setJobState, setUiState]);

    const appliedValueKey = appliedValue?.value ?? 'all';
    const appliedValueLabel = appliedValue?.label ?? appliedValueKey;

    const queryState = useMemo(() => ({
        viewMode,
        paginationModel,
        sortModel,
        search: debouncedSearch,
        appliedField,
        appliedValue: appliedValueKey,
        appliedValueLabel,
        appliedDateFrom,
        appliedDateTo,
    }), [
        viewMode, paginationModel, sortModel, debouncedSearch,
        appliedField, appliedValueKey, appliedValueLabel, appliedDateFrom, appliedDateTo,
    ]);

    const queryKey = useMemo(() => JSON.stringify(queryState), [queryState]);
    const cachedKey = useMemo(
        () => (jobState?.jobListQuery ? JSON.stringify(jobState.jobListQuery) : ''),
        [jobState?.jobListQuery]
    );

    useEffect(() => {
        if (jobState?.jobRowsList && cachedKey && cachedKey === queryKey) return;
        loadJobs(queryState);
    }, [cachedKey, queryKey, jobState?.jobRowsList, loadJobs, queryState]);

    const handleViewModeToggle = e => {
        const newMode = e.target.checked ? 'all' : 'me';
        setViewMode(newMode);
        setPaginationModel((prev) => ({ ...prev, page: 0 }));
    };

    const handleFilterApply = (field, value, dateFrom, dateTo) => {
        setAppliedField(field);
        setAppliedValue(value);
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
        setPaginationModel((prev) => ({ ...prev, page: 0 }));
    };

    const handleFilterClear = () => {
        setAppliedField('all');
        setAppliedValue({ label: 'All', value: 'all' });
        setAppliedDateFrom('');
        setAppliedDateTo('');
        setPaginationModel((prev) => ({ ...prev, page: 0 }));
    };

    const deleteRow = async () => {
        try {
            await fetchData(`/api/jobs/${current.id}`, { method: 'DELETE' });
            setDeleteOpen(false);
            setAlertCfg({ open: true, message: 'Job archived successfully', severity: 'success' });
            loadJobs(queryState);
        } catch (err) {
            console.error('Failed to archive job:', err);
            setAlertCfg({ open: true, message: err?.message || 'Failed to archive job', severity: 'error' });
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const canModifyJob =
        authState.user?.role === 'recruiter'
            ? authState.user?.accessRestrictions?.job !== false
            : true;

    const rows = jobState?.jobRowsList || [];
    const rowCount = jobState?.jobListMeta?.total ?? rows.length;
    const showSkeleton = jobsLoading && rows.length === 0;

    // Client-side filter on filterAllRows when a filter is active.
    // This guarantees ALL matching items are shown regardless of which server-side
    // page they'd normally appear on, and handles nested/array fields correctly.
    const filteredDisplayRows = useMemo(() => {
        if (appliedField === 'all' || filterAllRows.length === 0) return null;

        let out = filterAllRows;

        if (appliedField === 'createdAt') {
            out = out.filter(r => {
                const d = r.createdAt ? String(r.createdAt).substring(0, 10) : '';
                if (appliedDateFrom && d < appliedDateFrom) return false;
                if (appliedDateTo && d > appliedDateTo) return false;
                return true;
            });
        } else if (appliedValue?.value && appliedValue.value !== 'all') {
            out = out.filter(r =>
                String(getFieldValue(r, appliedField)).toLowerCase() ===
                String(appliedValue.value).toLowerCase()
            );
        }

        // Also apply search on the filtered set
        if (debouncedSearch.trim()) {
            const q = debouncedSearch.trim().toLowerCase();
            out = out.filter(r =>
                [r.title, r.internalTitle, r.company?.name, r.workMode, r.jobType,
                r.createdByName, ...(Array.isArray(r.locations) ? r.locations : [])]
                    .filter(Boolean).join(' ').toLowerCase().includes(q)
            );
        }

        return out.map((row, idx) => ({ ...row, __serial: idx + 1 }));
    }, [filterAllRows, appliedField, appliedValue, appliedDateFrom, appliedDateTo, debouncedSearch, getFieldValue]);

    // When a filter is active and we have all rows loaded → use client-side mode
    const useClientMode = filteredDisplayRows !== null;
    const displayRows = useClientMode ? filteredDisplayRows : rows;
    const displayRowCount = useClientMode ? filteredDisplayRows.length : rowCount;

    // View mode toggle passed as extra control
    const viewModeToggle = (
        <FormControlLabel
            control={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mx: 1 }}>My</Typography>
                    <Switch
                        checked={viewMode === 'all'}
                        onChange={handleViewModeToggle}
                        color="primary"
                    />
                    <Typography sx={{ mx: 1 }}>All</Typography>
                </Box>
            }
            label="Jobs"
            sx={{ borderBottom: 1, mx: 1 }}
        />
    );

    return (
        <Box sx={{ m: { xs: 0, sm: 2, md: 3 }, p: { xs: 1.5, sm: 2 }, mt: 0, pt: 2 }}>
            <MUIAlert {...alertCfg} onClose={closeAlert} />

            {showSkeleton ? (
                <Box>
                    <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                        <Skeleton variant="rounded" width={220} height={36} />
                        <Skeleton variant="rounded" width={44} height={36} />
                        <Skeleton variant="rounded" width={160} height={36} />
                        <Skeleton variant="rounded" width={160} height={36} />
                        <Skeleton variant="rounded" width={140} height={36} />
                    </Box>
                    <Box sx={{ display: 'grid', gap: 1.5 }}>
                        {Array.from({ length: 6 }).map((_, idx) => (
                            <Skeleton key={idx} variant="rounded" height={56} />
                        ))}
                    </Box>
                </Box>
            ) : (
                <MUIRetrieveDataGrid
                    title={(viewMode === 'me' ? 'My' : 'All') + ' Jobs'}
                    onRefresh={() => loadJobs(queryState)}
                    rows={displayRows}
                    rowCount={displayRowCount}
                    columns={columns}
                    paginationMode={useClientMode ? 'client' : 'server'}
                    paginationModel={paginationModel}
                    onPaginationModelChange={(model) => {
                        if (model.page === paginationModel.page && model.pageSize === paginationModel.pageSize) return;
                        setPaginationModel(model);
                    }}
                    sortingMode={useClientMode ? 'client' : 'server'}
                    sortModel={sortModel}
                    onSortModelChange={(model) => {
                        const next = model || [];
                        if (JSON.stringify(sortModel || []) === JSON.stringify(next)) return;
                        setSortModel(next);
                        setPaginationModel((prev) => ({ ...prev, page: 0 }));
                    }}
                    loading={jobsLoading}
                    slots={{
                        noRowsOverlay: () => (
                            <Box sx={{ p: 4, color: 'text.secondary' }}>
                                <Typography variant="subtitle1">No jobs found</Typography>
                                <Typography variant="body2">
                                    Try adjusting search, filters, or view mode.
                                </Typography>
                            </Box>
                        )
                    }}
                    onRowClick={row => navigate(`/jobs/${row.id}`)}
                    onEdit={
                        canModifyJob ? row => {
                            setCurrent(row);
                            setJobState((prev = {}) => ({
                                ...prev,
                                jobFormData: null,
                                jobInitialValuesDict: { _id: row?.id },
                            }));
                            navigate(`/jobs/edit/${row?.id}/`);
                        } : undefined
                    }
                    onDelete={
                        canModifyJob ? row => {
                            setCurrent(row);
                            setDeleteOpen(true);
                        } : undefined
                    }
                    customActionsRenderer={(params) => (
                        <Tooltip title="Generate upload link">
                            <IconButton
                                size="small"
                                color="primary"
                                onClick={(event) => {
                                    event.stopPropagation();
                                    setShareModalCfg({ open: true, job: params.row });
                                }}
                            >
                                <ShareOutlinedIcon fontSize="inherit" />
                            </IconButton>
                        </Tooltip>
                    )}
                    createButton={
                        <TableFilterBar
                            searchLabel="Search Jobs"
                            searchValue={searchTerm}
                            onSearchChange={(v) => {
                                setSearchTerm(v);
                                setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                            }}
                            filterTitle="Filter Jobs"
                            filterFields={filterFields}
                            rows={rows}
                            allRows={filterAllRows}
                            getFieldValue={getFieldValue}
                            onFilterOpen={loadFilterRows}
                            filterOptionsLoading={filterRowsLoading}
                            appliedField={appliedField}
                            appliedValue={appliedValue}
                            appliedDateFrom={appliedDateFrom}
                            appliedDateTo={appliedDateTo}
                            onApply={handleFilterApply}
                            onClear={handleFilterClear}
                            extraControls={
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                                    {authState.user?.role !== 'ultra_admin' && (
                                        <MUIButton onClick={() => navigate('/candidates/new/')}>
                                            <CloudUploadIcon sx={{ mr: 1 }} />
                                            New Candidate(s)
                                        </MUIButton>
                                    )}
                                    {canModifyJob && authState.user?.role !== 'ultra_admin' && (
                                        <MUIButton onClick={() => {
                                            setJobState({ jobFormData: null, jobInitialValuesDict: null });
                                            navigate('/jobs/new/');
                                        }}>
                                            <AddBusinessRoundedIcon sx={{ mr: 1 }} />
                                            New Job
                                        </MUIButton>
                                    )}
                                    {viewModeToggle}
                                </Box>
                            }
                        />
                    }
                />
            )}

            <MUIArchiveCnfModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={deleteRow}
                itemName={current?.title}
            />

            <JobShareLinkModal
                open={shareModalCfg.open}
                job={shareModalCfg.job}
                user={authState.user}
                onClose={() => setShareModalCfg({ open: false, job: null })}
            />
        </Box>
    );
}
