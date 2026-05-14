import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Box,
    Avatar,
    Switch,
    FormControlLabel,
    Typography,
    Skeleton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import TableFilterBar from '../MUI/CommonCRUD/TableFilterBar';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useCompanyContextState } from '../../contexts/CompanyContext';
import { useUiContextState } from '../../contexts/UiContext';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIAlert from '../MUI/commonUI/MUIAlert';



const CompaniesList = () => {
    const [authState] = useAuthContextState();
    const [companyState, setCompanyState] = useCompanyContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
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
            return companyState?.companyListQuery || {};
        }
        return {
            ...(companyState?.companyListQuery || {}),
            ...queryFromUrl,
        };
    }, [companyState?.companyListQuery, queryFromUrl]);

    const [searchTerm, setSearchTerm] = useState(initialQuery.search || '');
    const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search || '');
    const [viewMode, setViewMode] = useState(initialQuery.viewMode || 'me');
    const [paginationModel, setPaginationModel] = useState(
        initialQuery.paginationModel || { page: 0, pageSize: 10 }
    );
    const [sortModel, setSortModel] = useState(initialQuery.sortModel || []);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [current, setCurrent] = useState(null);

    const [alertConfig, setAlertConfig] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const initialAppliedValue = initialQuery.appliedValue
        ? { label: initialQuery.appliedValueLabel || initialQuery.appliedValue, value: initialQuery.appliedValue }
        : { label: 'All', value: 'all' };
    const [appliedField, setAppliedField] = useState(initialQuery.appliedField || 'all');
    const [appliedValue, setAppliedValue] = useState(initialAppliedValue);
    const [appliedDateFrom, setAppliedDateFrom] = useState(initialQuery.appliedDateFrom || '');
    const [appliedDateTo, setAppliedDateTo] = useState(initialQuery.appliedDateTo || '');

    const requestRef = useRef(0);
    const inFlightKeyRef = useRef('');

    // All rows for filter value options (separate from paginated rows)
    const [filterAllRows, setFilterAllRows] = useState([]);
    const [filterRowsLoading, setFilterRowsLoading] = useState(false);
    const filterLoadedViewModeRef = useRef(null);

    const getCompanyId = useCallback((row) => {
        const raw = row?.id ?? row?._id;
        if (!raw) return '';
        const asString =
            typeof raw === 'string'
                ? raw
                : (raw?.$oid ? raw.$oid : String(raw));
        return /^[0-9a-fA-F]{24}$/.test(asString) ? asString : '';
    }, []);

    // Debounce search
    useEffect(() => {
        const handle = setTimeout(() => {
            setDebouncedSearch(searchTerm.trim());
            setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
        }, 400);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    // Reset filter data cache when viewMode changes
    useEffect(() => {
        filterLoadedViewModeRef.current = null;
        setFilterAllRows([]);
    }, [viewMode]);

    // Load ALL companies (no pagination) for filter value options
    const loadFilterRows = useCallback(async () => {
        if (filterLoadedViewModeRef.current === viewMode) return;
        setFilterRowsLoading(true);
        try {
            const res = await fetchData(
                `/api/companies/?viewMode=${viewMode}&pageSize=9999`
            );
            const list = Array.isArray(res) ? res : (res?.items || []);
            const dt = list.map(c => ({
                ...c,
                id: c._id || c.id,
                createdAt: typeof c.createdAt === 'string' ? c.createdAt.substring(0, 10) : '',
                createdByName: c.createdBy || c.createdByName || '',
            }));
            setFilterAllRows(dt);
            filterLoadedViewModeRef.current = viewMode;
        } catch (err) {
            console.error('[CompaniesList] Failed to load filter options:', err);
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

    const columns = [
        { field: '__serial', headerName: 'No.', maxWidth: 80, headerAlign: 'left', align: 'center' },
        {
            field: 'name',
            headerName: 'Name',
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            minWidth: 200,
            renderCell: ({ row }) => {
                const companyName = row?.name || '-';
                const companyInitials = companyName
                    .split(' ')
                    .filter(Boolean)
                    .map((part) => part[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                const secondaryText = row?.industry || row?.website || '—';

                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, height: '100%' }}>
                        <Avatar
                            sx={{
                                width: 34,
                                height: 34,
                                bgcolor: (theme) =>
                                    alpha(theme.palette.grey[400], theme.palette.mode === 'dark' ? 0.28 : 0.18),
                                color: 'text.primary',
                                fontWeight: 600,
                                fontSize: 12,
                                border: 1,
                                borderColor: (theme) =>
                                    alpha(theme.palette.grey[500], theme.palette.mode === 'dark' ? 0.5 : 0.3),
                            }}
                        >
                            {companyInitials || 'CO'}
                        </Avatar>
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
                                {companyName}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                                {secondaryText}
                            </Typography>
                        </Box>
                    </Box>
                );
            },
        },
        {
            field: 'size',
            headerName: 'Size',
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            minWidth: 140,
            renderCell: ({ row }) => renderPrimarySecondaryCell(row?.size, row?.industry),
        },
        {
            field: 'website',
            headerName: 'Website',
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            minWidth: 220,
            renderCell: ({ row }) => renderPrimarySecondaryCell(row?.website, row?.createdAt),
        },
        {
            field: 'createdBy',
            headerName: 'Created By',
            flex: 1,
            flexGrow: 1,
            headerAlign: 'left',
            align: 'left',
            minWidth: 200,
            renderCell: ({ row }) => renderPrimarySecondaryCell(row?.createdBy || row?.createdByName, row?.createdAt),
        },
    ];

    // Filter field config for TableFilterBar
    const filterFields = [
        { field: 'name', label: 'Name' },
        { field: 'industry', label: 'Industry' },
        { field: 'size', label: 'Size' },
        { field: 'createdByName', label: 'Created By' },
        { field: 'createdAt', label: 'Created Date', type: 'date' },
    ];

    // Extract a displayable value from a row for a given filter field
    const getFieldValue = (row, field) => {
        if (field === 'createdByName') return row?.createdBy || row?.createdByName || '';
        if (field === 'createdAt') return row.createdAt ? String(row.createdAt).substring(0, 10) : '';
        return row?.[field] ?? '';
    };

    const canModifyCompany =
        authState.user?.role === 'recruiter'
            ? authState.user?.accessRestrictions?.company !== false
            : true;

    const handleAlertClose = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertConfig(a => ({ ...a, open: false }));
    };

    const loadCompanies = useCallback(async (queryState) => {
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
        setCompaniesLoading(true);

        const params = new URLSearchParams();
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
            const res = await fetchData(`/api/companies/?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res)
                ? { total: list.length, page: 1, pageSize: list.length, totalPages: 1 }
                : (res?.meta || { total: list.length, page: 1, pageSize: list.length, totalPages: 1 });

            const dt = list.map(c => ({
                ...c,
                id: c._id || c.id,
                createdAt: typeof c.createdAt === 'string' ? c.createdAt.substring(0, 10) : '',
            }));

            if (reqId !== requestRef.current) return;

            setCompanyState({
                companyRowsList: dt,
                companiesListViewMode: queryState?.viewMode || 'me',
                companyListMeta: meta,
                companyListQuery: queryState,
            });
        } catch (err) {
            console.error('[CompaniesList] Failed to load companies:', err);
            setAlertConfig({
                open: true,
                message: err?.message || 'Failed to load companies',
                severity: 'error',
            });
        } finally {
            if (inFlightKeyRef.current === requestKey) inFlightKeyRef.current = '';
            if (reqId === requestRef.current) {
                setCompaniesLoading(false);
                setUiState({ loadingMsg: null });
            }
        }
    }, [setCompanyState, setUiState]);

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
        () => (companyState?.companyListQuery ? JSON.stringify(companyState.companyListQuery) : ''),
        [companyState?.companyListQuery]
    );

    useEffect(() => {
        if (companyState?.companyRowsList && cachedKey && cachedKey === queryKey) return;
        loadCompanies(queryState);
    }, [cachedKey, queryKey, companyState?.companyRowsList, loadCompanies, queryState]);

    // Toast from navigation state
    useEffect(() => {
        const toast = location?.state?.toast;
        if (toast?.open) {
            setAlertConfig({
                open: true,
                message: toast.message || 'Success.',
                severity: toast.severity || 'success',
            });
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location?.state]);

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
        setUiState({ loadingMsg: 'Loading, Please wait...' });
        try {
            await fetchData(`/api/companies/${current?.id}`, { method: 'DELETE' });
            setDeleteOpen(false);
            setAlertConfig({ open: true, message: 'Company archived.', severity: 'success' });
            loadCompanies(queryState);
        } catch (err) {
            console.error('Failed to archive company:', err);
            setAlertConfig({
                open: true,
                message: err?.message || 'Failed to archive company',
                severity: 'error',
            });
        } finally {
            setUiState({ loadingMsg: null });
        }
    };

    const rows = companyState?.companyRowsList || [];
    const rowCount = companyState?.companyListMeta?.total ?? rows.length;
    const rowsWithSerial = rows.map((row, idx) => ({
        ...row,
        __serial: (paginationModel.page * paginationModel.pageSize) + idx + 1,
    }));
    const showSkeleton = companiesLoading && rowsWithSerial.length === 0;

    // Client-side filter on filterAllRows when a filter is active — shows ALL matching
    // records regardless of server-side pagination page boundaries.
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

        if (debouncedSearch.trim()) {
            const q = debouncedSearch.trim().toLowerCase();
            out = out.filter(r =>
                [r.name, r.industry, r.size, r.website, r.createdByName, r.createdBy]
                    .filter(Boolean).join(' ').toLowerCase().includes(q)
            );
        }

        return out.map((row, idx) => ({ ...row, __serial: idx + 1 }));
    }, [filterAllRows, appliedField, appliedValue, appliedDateFrom, appliedDateTo, debouncedSearch, getFieldValue]);

    const useClientMode = filteredDisplayRows !== null;
    const displayRows = useClientMode ? filteredDisplayRows : rowsWithSerial;
    const displayRowCount = useClientMode ? filteredDisplayRows.length : rowCount;

    // View mode toggle
    const viewModeToggle = (
        <FormControlLabel
            control={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mx: 1 }}>My</Typography>
                    <Switch
                        checked={viewMode === 'all'}
                        onChange={e => {
                            setViewMode(e.target.checked ? 'all' : 'me');
                            setPaginationModel((prev) => ({ ...prev, page: 0 }));
                        }}
                        color="primary"
                    />
                    <Typography sx={{ mx: 1 }}>All</Typography>
                </Box>
            }
            label="Companies"
            sx={{ borderBottom: 1, mx: 1 }}
        />
    );

    return (
        <>
            <MUIAlert
                open={alertConfig.open}
                message={alertConfig.message}
                severity={alertConfig.severity}
                onClose={handleAlertClose}
            />

            <Box sx={{ m: { xs: 0, sm: 2, md: 3 }, mt: 0, pt: 1, p: { xs: 1.5, sm: 2 } }}>
                {showSkeleton ? (
                    <Box>
                        <Skeleton variant="text" width={220} height={32} sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                            <Skeleton variant="rounded" width={220} height={36} />
                            <Skeleton variant="rounded" width={44} height={36} />
                            <Skeleton variant="rounded" width={160} height={36} />
                            <Skeleton variant="rounded" width={140} height={36} />
                        </Box>
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <Skeleton key={idx} variant="rounded" height={54} />
                            ))}
                        </Box>
                    </Box>
                ) : (
                    <MUIRetrieveDataGrid
                        title={(viewMode === 'me' ? 'My' : 'All') + ' Companies'}
                        onRefresh={() => loadCompanies(queryState)}
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
                        loading={companiesLoading}
                        slots={{
                            noRowsOverlay: () => (
                                <Box sx={{ p: 4, color: 'text.secondary' }}>
                                    <Typography variant="subtitle1">No companies found</Typography>
                                    <Typography variant="body2">
                                        Try adjusting search, filters, or view mode.
                                    </Typography>
                                </Box>
                            )
                        }}
                        onRowClick={row => navigate(`/companies/${row.id}`)}
                        onEdit={
                            canModifyCompany ? row => {
                                const companyId = getCompanyId(row);
                                if (!companyId) {
                                    setAlertConfig({
                                        open: true,
                                        message: 'Invalid company ID. Please refresh and try again.',
                                        severity: 'error',
                                    });
                                    return;
                                }
                                setCurrent(row);
                                setCompanyState({
                                    companyInitialValuesDict: {
                                        ...row,
                                        _id: companyId,
                                        id: companyId,
                                    },
                                });
                                navigate('/companies/new/');
                            } : undefined
                        }
                        onDelete={
                            canModifyCompany ? row => {
                                setCurrent(row);
                                setDeleteOpen(true);
                            } : undefined
                        }
                        createButton={
                            <TableFilterBar
                                searchLabel="Search Companies"
                                searchValue={searchTerm}
                                onSearchChange={(v) => {
                                    setSearchTerm(v);
                                    setPaginationModel((prev) => (prev.page === 0 ? prev : { ...prev, page: 0 }));
                                }}
                                filterTitle="Filter Companies"
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
                                        {canModifyCompany && authState.user?.role !== 'ultra_admin' && (
                                            <MUIButton onClick={() => navigate('/companies/new/')}>
                                                <AddBusinessRoundedIcon sx={{ mx: 1 }} />
                                                New Company
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
                    itemName={current?.name}
                />
            </Box>
        </>
    );
};

export default CompaniesList;
