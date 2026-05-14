import React, { useCallback, useEffect, useState } from 'react';
import {
    Box,
    Typography,
    Chip,
    Avatar,
    TextField,
    InputAdornment,
    IconButton,
    Tooltip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import MUIRetrieveDataGrid from '../MUI/CommonCRUD/MUIRetrieveDataGrid';
import { fetchData } from '../../AppUtils/dataAPI';
import { useUiContextState } from '../../contexts/UiContext';
import { useNavigate } from 'react-router-dom';

export default function MyInterviewsList() {
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 10 });
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const handle = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 400);
        return () => clearTimeout(handle);
    }, [searchTerm]);

    const formatDate = (v) => {
        if (!v) return '—';
        const d = new Date(v);
        return isNaN(d) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (v) => {
        if (!v) return '—';
        const d = new Date(v);
        return isNaN(d) ? '—' : d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    };

    const getStatusStyle = (status) => {
        const s = String(status || '').toLowerCase();
        if (s === 'completed') return { color: theme.palette.info.main };
        if (s === 'unattended') return { color: theme.palette.error.main };
        if (s === 'in progress') return { color: theme.palette.warning.main };
        if (s === 'cancelled') return { color: theme.palette.text.secondary };
        return { color: theme.palette.success.main };
    };

    const computeStatus = (row) => {
        const rawStatus = String(row?.interviewStatus || '').toLowerCase().trim();
        const isVirtualMode = String(row?.interviewMode || '').toLowerCase() === 'virtual';
        const hasStartedSignal =
            /in\s*progress|ongoing|started/.test(rawStatus) ||
            (isVirtualMode && Boolean(row?.webrtcAccessUsedAt));

        if (rawStatus.includes('complete')) return 'Completed';
        if (rawStatus.includes('miss')) return 'Unattended';
        if (rawStatus.includes('cancel')) return 'Cancelled';
        if (row?.endedAt) return 'Completed';

        const startAt = row?.startAt ? new Date(row.startAt) : null;
        if (startAt && !isNaN(startAt.getTime())) {
            const endAt = new Date(startAt.getTime() + (Number(row?.durationMinutes || 45)) * 60000);
            const now = Date.now();
            if (hasStartedSignal && now >= startAt.getTime() && now < endAt.getTime()) return 'In Progress';
            if (now >= endAt.getTime()) return 'Unattended';
        }

        if (rawStatus.includes('upcoming')) return 'Upcoming';
        return 'Upcoming';
    };

    const load = useCallback(async (page, pageSize) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('page', String(page + 1));
            params.set('pageSize', String(pageSize));
            const res = await fetchData(`/api/interviewschedules/my?${params.toString()}`);
            const list = res?.items || [];
            const meta = res?.meta || {};

            const mapped = list.map((x) => {
                const candidateName = x?.candidate
                    ? `${x.candidate.firstName || ''} ${x.candidate.lastName || ''}`.trim() || x.candidate.email
                    : 'N/A';
                const candidateInitials = candidateName.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'NA';
                const jobTitle = x?.job ? (x.job.title || x.job.internalTitle || 'N/A') : 'N/A';
                const companyName = x?.job?.company?.name || '';
                const status = computeStatus(x);
                const hasFeedback = Boolean(x?.interviewerFeedback?.submittedAt);
                return {
                    ...x,
                    id: x._id || x.id,
                    candidateName,
                    candidateInitials,
                    candidateEmail: x?.candidate?.email || '',
                    jobTitle,
                    companyName,
                    statusLabel: status,
                    hasFeedback,
                    timeLabel: formatTime(x?.startAt),
                    dateLabel: formatDate(x?.startAt),
                };
            });

            // client-side search filter
            const filtered = debouncedSearch
                ? mapped.filter(r =>
                    r.candidateName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                    r.jobTitle.toLowerCase().includes(debouncedSearch.toLowerCase())
                )
                : mapped;

            setRows(filtered);
            setTotal(meta.total || filtered.length);
        } catch (err) {
            console.error('[MyInterviewsList] Failed to load', err);
        } finally {
            setLoading(false);
            setUiState({ loadingMsg: null });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, setUiState]);

    useEffect(() => {
        load(paginationModel.page, paginationModel.pageSize);
    }, [paginationModel, load]);

    const columns = [
        {
            field: 'candidateName',
            headerName: 'Candidate',
            flex: 1.3,
            minWidth: 160,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, height: '100%', overflow: 'hidden' }}>
                    <Avatar sx={{ width: 32, height: 32, flexShrink: 0, bgcolor: alpha(theme.palette.grey[400], isDark ? 0.28 : 0.18), color: 'text.primary', fontWeight: 700, fontSize: 11, border: 1, borderColor: alpha(theme.palette.grey[500], isDark ? 0.55 : 0.32) }}>
                        {row.candidateInitials}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.candidateName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {row.candidateEmail || '—'}
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
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.jobTitle}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.companyName || '—'}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'startAt',
            headerName: 'Scheduled',
            flex: 0.9,
            minWidth: 120,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.timeLabel} · {row.dateLabel}</Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>{row.durationMinutes || 45} mins</Typography>
                </Box>
            ),
        },
        {
            field: 'statusLabel',
            headerName: 'Status',
            flex: 0.7,
            minWidth: 110,
            renderCell: ({ row }) => {
                const { color } = getStatusStyle(row.statusLabel);
                return (
                    <Chip
                        label={row.statusLabel}
                        size="small"
                        sx={{ bgcolor: alpha(color, isDark ? 0.2 : 0.12), color, fontWeight: 600 }}
                    />
                );
            },
        },
        {
            field: 'hasFeedback',
            headerName: 'Feedback',
            flex: 0.65,
            minWidth: 100,
            renderCell: ({ row }) => (
                row.hasFeedback
                    ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <CheckCircleOutlineIcon sx={{ fontSize: 15, color: 'success.main' }} />
                            <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>Submitted</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <RateReviewOutlinedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                            <Typography variant="caption" sx={{ color: 'text.disabled' }}>Pending</Typography>
                        </Box>
                    )
            ),
        },
    ];

    return (
        <Box sx={{ px: { xs: 2, sm: 3, md: 5 }, pt: { xs: 1, sm: 1.5, md: 2 }, pb: { xs: 2, sm: 3, md: 5 }, mx: { xs: 0, sm: '1vw' }, my: { xs: 0, sm: 0.5 }, minHeight: '80vh' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: 'text.primary' }}>
                        My Interviews
                    </Typography>
                    <Tooltip title="Refresh">
                        <IconButton size="small" onClick={() => load(paginationModel.page, paginationModel.pageSize)}>
                            <RefreshRoundedIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                <TextField
                    size="small"
                    placeholder="Search by candidate or job"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchRoundedIcon fontSize="small" />
                            </InputAdornment>
                        ),
                    }}
                    sx={{ minWidth: { xs: '100%', sm: 260 }, bgcolor: 'background.paper', borderRadius: 1.5 }}
                />
            </Box>

            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                Interviews assigned to you. Click a row to view details and submit your feedback.
            </Typography>

            <MUIRetrieveDataGrid
                hideHeader
                autoSizeColumns={false}
                rows={rows}
                rowCount={total}
                columns={columns}
                rowHeight={72}
                paginationMode="server"
                paginationModel={paginationModel}
                onPaginationModelChange={(model) => {
                    if (model.page === paginationModel.page && model.pageSize === paginationModel.pageSize) return;
                    setPaginationModel(model);
                }}
                loading={loading}
                slots={{
                    noRowsOverlay: () => (
                        <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                            <Typography variant="subtitle1">No interviews assigned</Typography>
                            <Typography variant="body2">You have no interviews scheduled yet.</Typography>
                        </Box>
                    ),
                }}
                onRowClick={(row) => navigate(`/interviews/${row.id}`)}
                sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    '& .MuiDataGrid-columnHeaders': { backgroundColor: 'background.default', borderBottom: 1, borderBottomColor: 'divider', color: 'text.secondary', fontWeight: 600, fontSize: '0.72rem' },
                    '& .MuiDataGrid-row': { backgroundColor: 'background.paper', '&:nth-of-type(even)': { backgroundColor: 'background.default' }, '&:hover': { boxShadow: 1, cursor: 'pointer' } },
                    '& .MuiDataGrid-cell': { py: 1.2, display: 'flex', alignItems: 'center' },
                }}
            />
        </Box>
    );
}
