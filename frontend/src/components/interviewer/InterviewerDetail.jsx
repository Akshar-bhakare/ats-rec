import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchData } from '../../AppUtils/dataAPI';
import MUIArchiveCnfModal from '../MUI/CommonCRUD/MUIArchiveCnfModal';
import {
    Box, Typography, Divider, CircularProgress, IconButton, Tabs, Tab, TextField, MenuItem,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ArrowBackIosIcon from '@mui/icons-material/ArrowBackIos';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useUiContextState } from '../../contexts/UiContext';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
} from 'recharts';
import { Archive, Edit } from '@mui/icons-material';
import { setDocumentTitle } from '../../AppUtils/documentTitle';

export default function InterviewerDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const theme = useTheme();
    const [interviewer, setInterviewer] = useState(null);
    const [, setUiState] = useUiContextState();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [activityLoading, setActivityLoading] = useState(false);
    const [activitySource, setActivitySource] = useState([]);
    const [rangePreset, setRangePreset] = useState('week');
    const [viewMode, setViewMode] = useState('day');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const loadInterviewer = () => {
        if (!id) return;
        // setUiState({ loadingMsg: 'Loading interviewer details...' });
        fetchData(`/api/users/${id}`)
            .then(setInterviewer)
            .catch(console.error)
            .finally(() => setUiState({ loadingMsg: null }));
    };

    const handleEdit = () => {
        navigate('/interviewers/new', { state: { interviewerInitialValuesDict: interviewer } });
    };

    const handleArchive = () => {
        fetchData(`/api/users/${id}`, { method: 'DELETE' })
            .then(() => navigate('/interviewers'))
            .catch(console.error);
    };

    const fullPhone = interviewer?.phoneNumber
        ? `${interviewer?.countryCode ? interviewer.countryCode + ' ' : ''}${interviewer.phoneNumber}`
        : '—';

    const interviewerId = interviewer?._id || interviewer?.id || id;

    const normalizeDate = (value) => {
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return null;
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const startOfWeek = (value) => {
        const d = new Date(value);
        const day = d.getDay();
        const diff = (day + 6) % 7;
        d.setDate(d.getDate() - diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    const buildBuckets = (start, end, mode) => {
        const buckets = [];
        const cursor = new Date(start);
        while (cursor <= end) {
            if (mode === 'month') {
                const key = `${cursor.getFullYear()}-${cursor.getMonth()}`;
                const label = cursor.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                buckets.push({ key, label, count: 0 });
                cursor.setMonth(cursor.getMonth() + 1, 1);
                cursor.setHours(0, 0, 0, 0);
            } else if (mode === 'week') {
                const wkStart = startOfWeek(cursor);
                const key = wkStart.toLocaleDateString('en-CA');
                const label = `Wk of ${wkStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
                buckets.push({ key, label, count: 0 });
                cursor.setDate(cursor.getDate() + 7);
                cursor.setHours(0, 0, 0, 0);
            } else {
                const key = cursor.toLocaleDateString('en-CA');
                const label = cursor.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                buckets.push({ key, label, count: 0 });
                cursor.setDate(cursor.getDate() + 1);
            }
        }
        return buckets;
    };

    const buildActivitySeries = (items, start, end, mode) => {
        if (!start || !end) return { data: [], total: 0 };
        const buckets = buildBuckets(start, end, mode);
        const map = new Map(buckets.map((b) => [b.key, b]));

        items.forEach((item) => {
            const raw = item?.startAt || item?.scheduledAt || item?.scheduleAt;
            const dt = normalizeDate(raw);
            if (!dt || dt < start || dt > end) return;

            let key = dt.toLocaleDateString('en-CA');
            if (mode === 'week') {
                key = startOfWeek(dt).toLocaleDateString('en-CA');
            } else if (mode === 'month') {
                key = `${dt.getFullYear()}-${dt.getMonth()}`;
            }
            const bucket = map.get(key);
            if (bucket) bucket.count += 1;
        });

        const data = buckets.map((b) => ({ date: b.label, count: b.count }));
        const total = data.reduce((sum, item) => sum + item.count, 0);
        return { data, total };
    };

    const loadActivity = async () => {
        if (!interviewerId) return;
        setActivityLoading(true);

        const params = new URLSearchParams();
        params.set('page', '1');
        params.set('pageSize', '200');
        params.set('sortBy', 'startAt');
        params.set('sortOrder', 'desc');

        try {
            const res = await fetchData(`/api/interviewschedules?${params.toString()}`);
            const list = Array.isArray(res) ? res : (res?.items || []);
            const matches = list.filter((item) => {
                const interviewers = Array.isArray(item?.interviewers) ? item.interviewers : [];
                const hasMatch = interviewers.some((entry) => {
                    if (!entry) return false;
                    if (typeof entry === 'string') return entry === interviewerId;
                    if (typeof entry === 'object') {
                        return entry._id === interviewerId || entry.id === interviewerId;
                    }
                    return false;
                });
                if (hasMatch) return true;
                const direct = item?.interviewerId || item?.interviewer?._id || item?.interviewer?.id;
                return direct === interviewerId;
            });

            setActivitySource(matches);
        } catch (err) {
            console.error('[InterviewerDetail] Failed to load interviewer activity', err);
            setActivitySource([]);
        } finally {
            setActivityLoading(false);
        }
    };

    useEffect(() => {
        loadActivity();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [interviewerId]);

    const { activitySeries, activityTotal, activityRangeLabel } = useMemo(() => {
        const today = new Date();
        const end = normalizeDate(today);

        let start = null;
        let label = 'Last 30 days';

        if (rangePreset === 'week') {
            start = new Date(end);
            start.setDate(end.getDate() - 6);
            label = 'Last 7 days';
        } else if (rangePreset === 'month') {
            start = new Date(end);
            start.setDate(end.getDate() - 29);
            label = 'Last 30 days';
        } else if (rangePreset === 'custom') {
            const from = customFrom ? normalizeDate(customFrom) : null;
            const to = customTo ? normalizeDate(customTo) : null;
            if (from && to) {
                start = from <= to ? from : to;
                const endDate = from <= to ? to : from;
                end.setTime(endDate.getTime());
                label = `${start.toLocaleDateString()} – ${end.toLocaleDateString()}`;
            } else {
                start = new Date(end);
                start.setDate(end.getDate() - 6);
                label = 'Select a custom range';
            }
        }

        if (!start || !end) {
            return { activitySeries: [], activityTotal: 0, activityRangeLabel: label };
        }

        const { data, total } = buildActivitySeries(activitySource, start, end, viewMode);
        return { activitySeries: data, activityTotal: total, activityRangeLabel: label };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activitySource, rangePreset, customFrom, customTo, viewMode]);

    useEffect(() => {
        loadInterviewer();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const interviewerName = [interviewer?.firstName, interviewer?.lastName].filter(Boolean).join(' ').trim();

    useEffect(() => {
        setDocumentTitle(interviewerName || 'Interviewer Detail');
    }, [interviewerName]);

    if (!interviewer) {
        return (
            <Box sx={{ p: 6, textAlign: 'center' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
            <Box sx={{ width: '100%', p: { xs: 2, sm: 4 } }}>
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: { xs: 'flex-start', sm: 'center' },
                        mb: 3,
                        gap: 2,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <IconButton onClick={() => navigate(-1)}>
                            <ArrowBackIosIcon />
                        </IconButton>
                        <Typography variant="h5">
                            {interviewer.firstName} {interviewer.lastName}
                        </Typography>
                        <IconButton size="small" onClick={loadInterviewer}>
                            <RefreshRoundedIcon fontSize="small" />
                        </IconButton>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <MUIButton startIcon={<Edit />} onClick={handleEdit}>Edit</MUIButton>
                        <MUIButton startIcon={<Archive />} onClick={() => setDeleteOpen(true)}>Archive</MUIButton>
                    </Box>
                </Box>

                {/* <Divider sx={{ mb: 3 }} /> */}

                <Box
                    sx={{
                        my: 5,
                        border: 0.5,
                        borderColor: "divider",
                        borderRadius: 2,
                        // boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        background: 'background.paper',
                    }}
                >
                    <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                        <Typography variant="h6" sx={{ mb: 2, borderBottom: 3, borderColor: "divider" }}>
                            Interviewer Information
                        </Typography>
                        <Box
                            sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: { xs: 2.5, md: 4 },
                            }}
                        >
                            <Box>
                                <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                                    Personal
                                </Typography>
                                <Box sx={{ display: 'grid', gap: 1.5 }}>
                                    <Box>
                                        <Typography color="text.secondary" variant="caption">First Name</Typography>
                                        <Typography sx={{ fontWeight: 600 }}>{interviewer.firstName || '—'}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography color="text.secondary" variant="caption">Last Name</Typography>
                                        <Typography sx={{ fontWeight: 600 }}>{interviewer.lastName || '—'}</Typography>
                                    </Box>
                                    <Box>
                                        <Typography color="text.secondary" variant="caption">Role</Typography>
                                        <Typography sx={{ textTransform: 'capitalize' }}>
                                            {interviewer.role || '—'}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                            <Box>
                                <Typography color="text.secondary" variant="subtitle2" sx={{ mb: 1 }}>
                                    Contact
                                </Typography>
                                <Box sx={{ display: 'grid', gap: 1.5 }}>
                                    <Box>
                                        <Typography color="text.secondary" variant="caption">Email</Typography>
                                        <Typography sx={{ wordBreak: 'break-word' }}>
                                            <Link to={interviewer.email ? ("mailto:" + interviewer.email) : undefined} >{interviewer.email || '—'}</Link>
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography color="text.secondary" variant="caption">Phone</Typography>
                                        <Typography><Link to={fullPhone ? ("tel:" + fullPhone) : undefined}>{fullPhone}</Link></Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Box>
                </Box>


                <Box
                    sx={{
                        my: 5,
                        border: 0.5,
                        borderColor: "divider",
                        borderRadius: 2,
                        // boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
                        background: 'background.paper',
                    }}
                >
                    <Box sx={{ p: { xs: 2.5, sm: 3.5 } }}>
                        <Typography variant="h6" sx={{ mb: 2, borderBottom: 3, borderColor: "divider" }}>
                            Interviewer Activity
                        </Typography>

                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 2,
                                mb: 1.5,
                            }}
                        >
                            <Tabs
                                value={rangePreset}
                                onChange={(_e, value) => setRangePreset(value)}
                                textColor="primary"
                                indicatorColor="primary"
                                sx={{
                                    minHeight: 24,
                                    '& .MuiTab-root': {
                                        minHeight: 24,
                                        minWidth: 'auto',
                                        padding: '4px 10px',
                                        fontSize: '0.75rem',
                                        letterSpacing: '0.06em',
                                    },
                                }}
                            >
                                <Tab label="Last Week" value="week" />
                                <Tab label="Last Months" value="month" />
                                <Tab label="Custom Range" value="custom" />
                            </Tabs>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <TextField
                                    select
                                    size="small"
                                    variant="standard"
                                    value={viewMode}
                                    onChange={(e) => setViewMode(e.target.value)}
                                    sx={{
                                        minWidth: 120,
                                        '& .MuiInputBase-root': {
                                            fontSize: '0.75rem',
                                            height: 28,
                                        },
                                        '& .MuiSelect-select': {
                                            padding: '4px 28px 4px 4px',
                                        },
                                        '& .MuiInput-underline:before': {
                                            borderBottomColor: 'divider',
                                        },
                                        '& .MuiInput-underline:hover:before': {
                                            borderBottomColor: 'divider',
                                        },
                                        '& .MuiInput-underline:after': {
                                            borderBottomColor: 'divider',
                                        },
                                    }}
                                >
                                    <MenuItem sx={{ p: 1, justifyContent: "center" }} value="day">Day View</MenuItem>
                                    <MenuItem sx={{ p: 1, justifyContent: "center" }} value="week">Week View</MenuItem>
                                    <MenuItem sx={{ p: 1, justifyContent: "center" }} value="month">Monthly View</MenuItem>
                                </TextField>
                            </Box>
                        </Box>

                        {rangePreset === 'custom' && (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                                <TextField
                                    label="From"
                                    type="date"
                                    size="small"
                                    value={customFrom}
                                    onChange={(e) => setCustomFrom(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                                <TextField
                                    label="To"
                                    type="date"
                                    size="small"
                                    value={customTo}
                                    onChange={(e) => setCustomTo(e.target.value)}
                                    InputLabelProps={{ shrink: true }}
                                />
                            </Box>
                        )}

                        <Box
                            sx={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: 1,
                                mb: 2,
                                color: 'text.secondary',
                            }}
                        >
                            <Typography variant="subtitle2">{activityRangeLabel}</Typography>
                            <Typography variant="subtitle2">
                                Total Interviews: <Box component="span" sx={{ color: 'text.primary', fontWeight: 600 }}>{activityTotal}</Box>
                            </Typography>
                        </Box>
                        <Box sx={{ height: 240 }}>
                            {activityLoading ? (
                                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CircularProgress size={28} />
                                </Box>
                            ) : activitySeries.some(item => item.count > 0) ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={activitySeries} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="interviewerActivityFill" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.35} />
                                                <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="4 6" stroke={theme.palette.divider} />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                            axisLine={false}
                                            tickLine={false}
                                            interval="preserveStartEnd"
                                        />
                                        <YAxis
                                            allowDecimals={false}
                                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <Tooltip
                                            cursor={{ stroke: theme.palette.primary.main, strokeWidth: 1 }}
                                            formatter={(value) => [`${value} interviews`, '']}
                                        />
                                        <Area
                                            type="monotone"
                                            dataKey="count"
                                            stroke={theme.palette.primary.main}
                                            strokeWidth={2}
                                            fill="url(#interviewerActivityFill)"
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            ) : (
                                <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Typography color="text.secondary">No interviews logged in the last 30 days.</Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                </Box>

                <MUIArchiveCnfModal
                    open={deleteOpen}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={handleArchive}
                    itemName={`${interviewer.firstName} ${interviewer.lastName}`}
                >
                    Archive
                </MUIArchiveCnfModal>
            </Box>
        </Box>
    );
}
