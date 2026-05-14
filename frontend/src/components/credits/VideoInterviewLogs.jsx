import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Chip,
    Avatar,
    TextField,
    IconButton,
    InputAdornment,
    Tooltip,
    Tab,
    Tabs,
} from '@mui/material';
import {
    SearchRounded,
    RefreshRounded,
    CloseRounded,
    AccessTimeRounded,
    WorkRounded,
    PlayArrowRounded,
    VideocamOutlined,
    CheckCircleOutlineRounded,
    HighlightOffRounded,
} from '@mui/icons-material';
import { DataGrid } from '@mui/x-data-grid';
import { alpha } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';

const TABS = [
    { label: 'All Interviews', value: 'all', icon: <VideocamOutlined sx={{ fontSize: 16 }} /> },
    { label: 'Upcoming', value: 'upcoming', icon: <AccessTimeRounded sx={{ fontSize: 16 }} /> },
    { label: 'In Progress', value: 'in progress', icon: <PlayArrowRounded sx={{ fontSize: 16 }} /> },
    { label: 'Completed', value: 'completed', icon: <CheckCircleOutlineRounded sx={{ fontSize: 16 }} /> },
    { label: 'Unattended', value: 'unattended', icon: <HighlightOffRounded sx={{ fontSize: 16 }} /> },
];

const fmtDate = (value) => {
    if (!value) return '-';
    return new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
};

const fmtDuration = (minutes) => {
    const mins = Number(minutes || 0);
    if (!mins || mins <= 0) return '-';
    return `${mins} mins`;
};

const statusColor = (status) => {
    const value = String(status || '').toLowerCase().trim();
    if (value === 'completed') return 'success';
    if (value === 'in progress') return 'info';
    if (value === 'unattended' || value === 'cancelled') return 'error';
    if (value === 'upcoming') return 'warning';
    return 'default';
};

const candidateName = (candidate) => (
    !candidate
        ? 'Unknown'
        : `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.email || 'Unknown'
);

const candidateMeta = (candidate) => {
    if (!candidate) return '-';
    const phone = `${candidate.countryCode || ''}${candidate.phoneNumber || ''}`.trim();
    return phone || candidate.email || '-';
};

const initials = (candidate) => (
    !candidate
        ? '?'
        : `${(candidate.firstName || '')[0] || ''}${(candidate.lastName || '')[0] || ''}`.toUpperCase() || '?'
);

const interviewerTypeLabel = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return 'Interview';
    if (raw.toLowerCase() === 'human+ai') return 'Human + AI';
    return raw;
};

const interviewerLabel = (row) => {
    const names = (row?.interviewers || [])
        .map((user) => `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || user?.email || '')
        .filter(Boolean);

    if (names.length) return names.join(', ');

    const type = String(row?.interviewerType || '').toLowerCase().trim();
    if (type === 'ai') return 'AI Interviewer';
    if (type === 'human+ai') return 'Human + AI';
    if (type === 'human') return 'Unassigned';
    return '-';
};

const interviewTypeLabel = (row) => {
    if (String(row?.roundType || '').toLowerCase() === 'coding') return 'Coding';
    return row?.interviewType || 'Interview';
};

export default function VideoInterviewLogs() {
    const navigate = useNavigate();

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [activeTab, setActiveTab] = useState('all');

    const load = useCallback(async (pg = page, ps = pageSize, tab = activeTab) => {
        setLoading(true);
        setErr(null);
        try {
            const params = new URLSearchParams({
                page: String(pg + 1),
                pageSize: String(ps),
                sortBy: 'startAt',
                sortOrder: 'desc',
            });

            if (tab && tab !== 'all') params.set('statusTab', tab);

            const res = await fetchData(`/api/interviewschedules?${params.toString()}`);
            const items = Array.isArray(res) ? res : (res?.items || []);
            const meta = Array.isArray(res) ? { total: items.length } : (res?.meta || { total: items.length });

            setRows(items);
            setTotal(meta.total || 0);
        } catch (error) {
            console.error('[VideoInterviewLogs] Failed to load interview logs:', error);
            setErr(error?.message || 'Failed to load interview logs');
            setRows([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [activeTab, page, pageSize]);

    useEffect(() => {
        load();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const filtered = useMemo(() => {
        if (!search.trim()) return rows;
        const query = search.trim().toLowerCase();

        return rows.filter((row) => {
            const candidate = candidateName(row.candidate).toLowerCase();
            const candidateMetaValue = candidateMeta(row.candidate).toLowerCase();
            const interviewer = interviewerLabel(row).toLowerCase();
            const job = `${row.job?.internalTitle || ''} ${row.job?.title || ''}`.toLowerCase();
            const interviewType = `${interviewTypeLabel(row)} ${interviewerTypeLabel(row.interviewerType)}`.toLowerCase();

            return (
                candidate.includes(query) ||
                candidateMetaValue.includes(query) ||
                interviewer.includes(query) ||
                job.includes(query) ||
                interviewType.includes(query)
            );
        });
    }, [rows, search]);

    const columns = useMemo(() => [
        {
            field: 'candidate',
            headerName: 'Candidate',
            minWidth: 210,
            flex: 1.5,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', minWidth: 0 }}>
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            fontSize: 12,
                            bgcolor: 'primary.main',
                            fontWeight: 700,
                            flexShrink: 0,
                        }}
                    >
                        {initials(row.candidate)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                            noWrap
                            fontWeight={600}
                            sx={{ fontSize: '0.83rem', lineHeight: 1.35, display: 'block' }}
                        >
                            {candidateName(row.candidate)}
                        </Typography>
                        <Typography
                            noWrap
                            color="text.secondary"
                            sx={{ fontSize: '0.73rem', lineHeight: 1.3, display: 'block' }}
                        >
                            {candidateMeta(row.candidate)}
                        </Typography>
                    </Box>
                </Box>
            ),
        },
        {
            field: 'interviewer',
            headerName: 'Interviewer',
            minWidth: 170,
            flex: 1.15,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ minWidth: 0, width: '100%' }}>
                    <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {interviewerLabel(row)}
                    </Typography>
                    <Typography noWrap color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        {interviewerTypeLabel(row.interviewerType)}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'interviewType',
            headerName: 'Type',
            minWidth: 140,
            flex: 0.95,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>
                        {interviewTypeLabel(row)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                        {row.interviewMode || 'Virtual'}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'job',
            headerName: 'Job',
            minWidth: 150,
            flex: 1.05,
            sortable: false,
            renderCell: ({ row }) => {
                const title = row.job?.internalTitle || row.job?.title;
                if (!title) return <Typography variant="body2" color="text.disabled">-</Typography>;
                return (
                    <Chip
                        label={title}
                        size="small"
                        icon={<WorkRounded sx={{ fontSize: 12 }} />}
                        variant="outlined"
                        color="primary"
                        sx={{
                            maxWidth: 165,
                            height: 24,
                            fontSize: '0.72rem',
                            '.MuiChip-label': {
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                px: 0.8,
                            },
                            '.MuiChip-icon': { ml: 0.6 },
                        }}
                    />
                );
            },
        },
        {
            field: 'startAt',
            headerName: 'Date & Time',
            minWidth: 170,
            flex: 1.1,
            renderCell: ({ row }) => (
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {fmtDate(row.startAt)}
                </Typography>
            ),
        },
        {
            field: 'durationMinutes',
            headerName: 'Duration',
            minWidth: 95,
            flex: 0.75,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeRounded sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {fmtDuration(row.durationMinutes)}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'statusLabel',
            headerName: 'Status',
            minWidth: 120,
            flex: 0.8,
            sortable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => {
                const label = row.statusLabel || 'Upcoming';
                return (
                    <Chip
                        label={label}
                        size="small"
                        color={statusColor(label)}
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                    />
                );
            },
        },
        {
            field: '_view',
            headerName: '',
            width: 72,
            sortable: false,
            align: 'center',
            renderCell: () => (
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'primary.main',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        gap: 0.3,
                    }}
                >
                    <PlayArrowRounded sx={{ fontSize: 15 }} />
                    View
                </Box>
            ),
        },
    ], []);

    const handleTabChange = (_event, value) => {
        setActiveTab(value);
        setPage(0);
        setSearch('');
        load(0, pageSize, value);
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    p: { xs: 2, sm: 3 },
                    transition: 'all 0.25s ease',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                        <Typography variant="h5" fontWeight={700} lineHeight={1.2}>
                            AI Interview Logs
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.3}>
                            {total} total interviews - click a row to view details
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title="Refresh">
                            <span>
                                <IconButton onClick={() => load(page, pageSize, activeTab)} disabled={loading} size="small">
                                    <RefreshRounded />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>

                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        textColor="primary"
                        indicatorColor="primary"
                        variant="scrollable"
                        allowScrollButtonsMobile
                        sx={{ minHeight: 40 }}
                    >
                        {TABS.map((tab) => (
                            <Tab
                                key={tab.value}
                                value={tab.value}
                                label={tab.label}
                                icon={tab.icon}
                                iconPosition="start"
                                sx={{ minHeight: 40, fontSize: '0.82rem', fontWeight: 600, py: 0, gap: 0.5 }}
                            />
                        ))}
                    </Tabs>
                </Box>

                <TextField
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search by candidate, interviewer or job..."
                    size="small"
                    sx={{ mb: 2, width: { xs: '100%', sm: 420 } }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRounded sx={{ fontSize: 17, color: 'text.secondary' }} />
                            </InputAdornment>
                        ),
                        endAdornment: search ? (
                            <InputAdornment position="end">
                                <IconButton size="small" onClick={() => setSearch('')} edge="end">
                                    <CloseRounded sx={{ fontSize: 15 }} />
                                </IconButton>
                            </InputAdornment>
                        ) : null,
                    }}
                />

                <Box
                    sx={{
                        width: '100%',
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        border: 1,
                        borderColor: 'divider',
                        overflow: 'hidden',
                    }}
                >
                    <DataGrid
                        rows={filtered}
                        columns={columns}
                        loading={loading}
                        getRowId={(row) => row._id || row.id}
                        rowHeight={62}
                        disableRowSelectionOnClick
                        onRowClick={(params) => navigate(`/interviews/${params.row._id || params.row.id}`)}
                        paginationMode="server"
                        rowCount={total}
                        paginationModel={{ page, pageSize }}
                        onPaginationModelChange={({ page: nextPage, pageSize: nextPageSize }) => {
                            setPage(nextPage);
                            setPageSize(nextPageSize);
                            load(nextPage, nextPageSize, activeTab);
                        }}
                        pageSizeOptions={[10, 25, 50]}
                        autoHeight
                        disableColumnMenu
                        disableColumnResize
                        sx={{
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            '& .MuiDataGrid-columnHeaders': {
                                bgcolor: (muiTheme) => alpha(muiTheme.palette.grey[200], 0.7),
                                borderBottom: 1,
                                borderBottomColor: 'divider',
                                minHeight: '40px !important',
                                maxHeight: '40px !important',
                                lineHeight: '40px',
                            },
                            '& .MuiDataGrid-columnHeaderTitle': {
                                fontWeight: 700,
                                fontSize: '0.78rem',
                                color: 'text.secondary',
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                            },
                            '& .MuiDataGrid-row': {
                                borderBottom: 1,
                                borderBottomColor: 'divider',
                                '&:hover': {
                                    bgcolor: (muiTheme) => alpha(muiTheme.palette.primary.main, 0.04),
                                },
                                '&:last-child': { borderBottom: 'none' },
                            },
                            '& .MuiDataGrid-cell': {
                                display: 'flex',
                                alignItems: 'center',
                                borderBottom: 'none',
                                outline: 'none !important',
                                py: 0.5,
                                overflow: 'hidden',
                            },
                            '& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within': {
                                outline: 'none',
                            },
                            '& .MuiDataGrid-footerContainer': {
                                borderTop: 1,
                                borderTopColor: 'divider',
                                minHeight: 44,
                            },
                        }}
                        slots={{
                            noRowsOverlay: () => (
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                    <Typography variant="subtitle1">
                                        {err ? 'Failed to load interview logs' : 'No interview logs found'}
                                    </Typography>
                                    <Typography variant="body2">
                                        {err ? String(err) : 'Try adjusting the tab or search.'}
                                    </Typography>
                                </Box>
                            ),
                        }}
                    />
                </Box>
            </Box>
        </Box>
    );
}
