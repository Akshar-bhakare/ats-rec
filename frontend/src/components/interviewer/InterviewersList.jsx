import React, { useEffect, useMemo, useState } from 'react';
import {
    Avatar,
    Box, Switch, FormControlLabel,
    Typography, Skeleton,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddBusinessRoundedIcon from '@mui/icons-material/AddBusinessRounded';
import { useNavigate } from 'react-router-dom';
import { useInterviewerContextState } from '../../contexts/InterviewerContext';
import { useUiContextState } from '../../contexts/UiContext';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import TableFilterBar from '../MUI/CommonCRUD/TableFilterBar';
import MUIButton from '../MUI/commonUI/MUIButton';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import MUIAlert from '../MUI/commonUI/MUIAlert';



export default function InterviewersList() {
    const [, setInterviewerState] = useInterviewerContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState('me');
    const [searchQuery, setSearchQuery] = useState('');

    // Column filter state
    const [appliedField, setAppliedField] = useState('all');
    const [appliedValue, setAppliedValue] = useState({ label: 'All', value: 'all' });
    const [appliedDateFrom, setAppliedDateFrom] = useState('');
    const [appliedDateTo, setAppliedDateTo] = useState('');

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [current, setCurrent] = useState(null);

    const [alertConfig, setAlertConfig] = useState({
        open: false,
        message: '',
        severity: 'success',
    });

    const handleAlertClose = (_e, reason) => {
        if (reason === 'clickaway') return;
        setAlertConfig(a => ({ ...a, open: false }));
    };

    const loadInterviewers = async (view) => {
        setLoading(true);
        try {
            const list = await fetchData(`/api/users?viewMode=${view}&includeCreatedBy=true`) || [];
            setRows(
                list
                    .filter(u => u.role === 'interviewer' && !u.isArchived)
                    .map(u => ({ ...u, id: u._id }))
            );
        } finally {
            setUiState({ loadingMsg: null });
            setLoading(false);
        }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadInterviewers(viewMode); }, [viewMode]);

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

    const renderNameCell = (row) => {
        const fullName = [row?.firstName, row?.lastName].filter(Boolean).join(' ').trim() || '-';
        const initials = fullName
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
                    {initials || 'IV'}
                </Avatar>
                {renderPrimarySecondaryCell(fullName, 'Interviewer')}
            </Box>
        );
    };

    const columns = [
        {
            field: '__serial',
            headerName: 'No.',
            maxWidth: 80,
            headerAlign: 'left',
            align: 'left',
            sortable: false,
            filterable: false,
            renderCell: (params) => {
                const idx = params.api.getAllRowIds().indexOf(params.id);
                return idx + 1;
            },
        },
        {
            field: 'firstName',
            headerName: 'Name',
            flex: 1,
            minWidth: 150,
            headerAlign: 'left',
            align: 'left',
            renderCell: ({ row }) => renderNameCell(row),
        },
        {
            field: 'email',
            headerName: 'Contact',
            flex: 1,
            minWidth: 220,
            headerAlign: 'left',
            align: 'left',
            renderCell: ({ row }) => renderPrimarySecondaryCell(row?.email, row?.phoneNumber),
        },
        {
            field: 'createdByName',
            headerName: 'Created By',
            flex: 1,
            minWidth: 200,
            headerAlign: 'left',
            align: 'left',
            renderCell: ({ row }) => renderPrimarySecondaryCell(
                row?.createdByName,
                row?.createdAt ? String(row.createdAt).substring(0, 10) : null
            ),
        },
    ];

    // Filter field config for TableFilterBar
    const filterFields = [
        { field: 'name', label: 'Name' },
        { field: 'email', label: 'Email' },
        { field: 'createdByName', label: 'Created By' },
        { field: 'createdAt', label: 'Created Date', type: 'date' },
    ];

    // Extract a displayable value from a row for a given filter field
    const getFieldValue = (row, field) => {
        if (field === 'name') return [row.firstName, row.lastName].filter(Boolean).join(' ');
        if (field === 'createdAt') return row.createdAt ? String(row.createdAt).substring(0, 10) : '';
        return row?.[field] ?? '';
    };

    // Combined search + column filter
    const filteredRows = useMemo(() => {
        let out = rows;

        // Full-text search across key fields
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            out = out.filter(r =>
                [r.firstName, r.lastName, r.email, r.phoneNumber, r.createdByName]
                    .filter(Boolean).join(' ').toLowerCase().includes(q)
            );
        }

        // Column filter
        if (appliedField !== 'all') {
            if (appliedField === 'createdAt') {
                out = out.filter(r => {
                    const d = r.createdAt ? String(r.createdAt).substring(0, 10) : '';
                    if (appliedDateFrom && d < appliedDateFrom) return false;
                    if (appliedDateTo && d > appliedDateTo) return false;
                    return true;
                });
            } else if (appliedValue?.value !== 'all') {
                out = out.filter(r =>
                    String(getFieldValue(r, appliedField)).toLowerCase() ===
                    String(appliedValue.value).toLowerCase()
                );
            }
        }

        return out;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, searchQuery, appliedField, appliedValue, appliedDateFrom, appliedDateTo]);

    const handleFilterApply = (field, value, dateFrom, dateTo) => {
        setAppliedField(field);
        setAppliedValue(value);
        setAppliedDateFrom(dateFrom);
        setAppliedDateTo(dateTo);
    };

    const handleFilterClear = () => {
        setAppliedField('all');
        setAppliedValue({ label: 'All', value: 'all' });
        setAppliedDateFrom('');
        setAppliedDateTo('');
    };

    const handleViewModeToggle = (e) => {
        const newMode = e.target.checked ? 'all' : 'me';
        setViewMode(newMode);
        // Reset filters when switching view
        handleFilterClear();
        setSearchQuery('');
    };

    const deleteRow = () => {
        fetchData(`/api/users/${current.id}`, { method: 'DELETE' });
        setRows(r => r.filter(x => x.id !== current.id));
        setDeleteOpen(false);
        setAlertConfig({ open: true, message: 'Interviewer archived.', severity: 'success' });
    };

    // View mode toggle passed as extraControls
    const viewModeToggle = (
        <FormControlLabel
            control={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Typography sx={{ mx: 1 }}>My</Typography>
                    <Switch
                        checked={viewMode === 'all'}
                        onChange={handleViewModeToggle}
                        color="primary"
                        inputProps={{ 'aria-label': 'toggle all interviewers view' }}
                    />
                    <Typography sx={{ mx: 1 }}>All</Typography>
                </Box>
            }
            label="Interviewers"
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

            <Box sx={{ m: { xs: 0, sm: 2, md: 3 }, p: { xs: 1.5, sm: 2 }, mt: 0, pt: 2 }}>
                {loading && filteredRows.length === 0 ? (
                    <Box>
                        <Skeleton variant="text" width={200} height={28} sx={{ mb: 2 }} />
                        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                            <Skeleton variant="rounded" width={220} height={36} />
                            <Skeleton variant="rounded" width={44} height={36} />
                            <Skeleton variant="rounded" width={160} height={36} />
                            <Skeleton variant="rounded" width={160} height={36} />
                        </Box>
                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                            {Array.from({ length: 6 }).map((_, idx) => (
                                <Skeleton key={idx} variant="rounded" height={54} />
                            ))}
                        </Box>
                    </Box>
                ) : (
                    <MUIRetrieveDataGrid
                        title={(viewMode === 'me' ? 'My' : 'All') + ' Interviewers'}
                        onRefresh={() => loadInterviewers(viewMode)}
                        rows={filteredRows}
                        columns={columns}
                        onRowClick={row => navigate(`/interviewers/${row.id}`)}
                        onEdit={row => {
                            setInterviewerState({ interviewerInitialValuesDict: row });
                            navigate('/interviewers/new');
                        }}
                        onDelete={row => {
                            setCurrent(row);
                            setDeleteOpen(true);
                        }}
                        createButton={
                            <TableFilterBar
                                searchLabel="Search Interviewers"
                                searchValue={searchQuery}
                                onSearchChange={setSearchQuery}
                                filterTitle="Filter Interviewers"
                                filterFields={filterFields}
                                rows={rows}
                                getFieldValue={getFieldValue}
                                appliedField={appliedField}
                                appliedValue={appliedValue}
                                appliedDateFrom={appliedDateFrom}
                                appliedDateTo={appliedDateTo}
                                onApply={handleFilterApply}
                                onClear={handleFilterClear}
                                extraControls={
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5 }}>
                                        <MUIButton
                                            onClick={() => {
                                                setInterviewerState({ interviewerInitialValuesDict: null });
                                                navigate('/interviewers/new');
                                            }}
                                        >
                                            <AddBusinessRoundedIcon sx={{ mr: 1 }} />
                                            New Interviewer
                                        </MUIButton>
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
                    itemName={`${current?.firstName} ${current?.lastName}`}
                >
                    Archive
                </MUIArchiveCnfModal>
            </Box>
        </>
    );
}
