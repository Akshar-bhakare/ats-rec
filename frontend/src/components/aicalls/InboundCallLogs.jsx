import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box, Typography, Chip, Avatar, TextField, IconButton,
    InputAdornment, Divider, Stack, CircularProgress, Tooltip, Tab, Tabs,
    Drawer, useMediaQuery, useTheme,
} from '@mui/material';
import {
    SearchRounded, RefreshRounded, CloseRounded,
    PhoneRounded, AccessTimeRounded, WorkRounded,
    PlayArrowRounded, CallReceivedRounded, CallMadeRounded, CallRounded,
    EditNoteRounded, PersonAddRounded, FiberNewRounded, WhatsApp,
} from '@mui/icons-material';
import InboundCallScriptPanel from './InboundCallScriptPanel';
import { DataGrid } from '@mui/x-data-grid';
import { alpha } from '@mui/material/styles';
import MUIModal from '../MUI/commonUI/MUIModal';
import { fetchData } from '../../AppUtils/dataAPI';
import { useSearchParams } from 'react-router-dom';




const TABS = [
    { label: 'All Calls', value: '', icon: <CallRounded sx={{ fontSize: 16 }} /> },
    { label: 'Inbound', value: 'inbound', icon: <CallReceivedRounded sx={{ fontSize: 16 }} /> },
    { label: 'Outbound', value: 'outbound', icon: <CallMadeRounded sx={{ fontSize: 16 }} /> },
    { label: 'Inbound Leads', value: 'leads', icon: <PersonAddRounded sx={{ fontSize: 16 }} /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtDuration = (secs, fallbackStr) => {
    if (fallbackStr && fallbackStr !== '—') return fallbackStr;
    if (!secs || secs <= 0) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')} min`;
};

const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
    });
};

const statusColor = (s) => {
    if (!s) return 'default';
    const v = s.toLowerCase();
    if (['completed', 'answered'].includes(v)) return 'success';
    if (['in-progress', 'ringing'].includes(v)) return 'info';
    if (['failed', 'error', 'busy', 'no-answer', 'timeout', 'hangup'].includes(v)) return 'error';
    if (v === 'pending') return 'warning';
    return 'default';
};

const candName = (c) => (!c ? 'Unknown' : `${c.firstName || ''} ${c.lastName || ''}`.trim() || 'Unknown');
const candPhone = (c) => (!c ? '—' : `${c.countryCode || ''}${c.phoneNumber || ''}` || '—');
const initials = (c) => (!c ? '?' : `${(c.firstName || '')[0] || ''}${(c.lastName || '')[0] || ''}`.toUpperCase() || '?');

const CALL_TYPE_STYLES = {
    screening: { label: 'Screening', bg: '#1565c0', color: '#fff' },
    reminder: { label: 'Reminder', bg: '#e65100', color: '#fff' },
    inbound_screening: { label: 'Callback · Screen', bg: '#2e7d32', color: '#fff' },
    inbound_reminder: { label: 'Callback · Remind', bg: '#6a1b9a', color: '#fff' },
    inbound_fallback: { label: 'Inbound', bg: '#00695c', color: '#fff' },
    outbound_fallback: { label: 'Outbound', bg: '#37474f', color: '#fff' },
};

const callTypeConfig = (callType, direction) => {
    if (CALL_TYPE_STYLES[callType]) return CALL_TYPE_STYLES[callType];
    return direction === 'inbound' ? CALL_TYPE_STYLES.inbound_fallback : CALL_TYPE_STYLES.outbound_fallback;
};

const roleLabel = (role) => {
    if (['user', 'candidate'].includes(role)) return 'Candidate';
    if (['assistant', 'ai'].includes(role)) return 'AI';
    if (role === 'system') return null;
    return role;
};

const isWhatsAppConversation = (row) => String(row?.callUUID || '').startsWith('wa_conv_____');

const channelConfig = (row) => (
    isWhatsAppConversation(row)
        ? { label: 'WhatsApp Chat', bg: '#e9f8ef', color: '#177245', border: '#b7e4ca' }
        : { label: 'AI Call', bg: '#edf4ff', color: '#2f5fbf', border: '#c7d8fb' }
);

const channelChipSx = (row) => {
    const cfg = channelConfig(row);
    return {
        height: 24,
        fontSize: '0.72rem',
        fontWeight: 700,
        bgcolor: cfg.bg,
        color: cfg.color,
        border: '1px solid',
        borderColor: cfg.border,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)',
        '.MuiChip-icon': {
            color: 'inherit',
            ml: 0.7,
        },
        '.MuiChip-label': {
            px: 1.1,
        },
    };
};

// Extract plain text from msg.content which can be:
//   - a plain string
//   - an array like [{"type":"input_text","text":"..."}]
//   - a nested object with a "text" key
const extractText = (content) => {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content
            .map((item) => {
                if (typeof item === 'string') return item;
                if (item?.text) return item.text;
                if (item?.content) return extractText(item.content);
                return '';
            })
            .filter(Boolean)
            .join(' ');
    }
    if (content && typeof content === 'object') {
        if (content.text) return content.text;
        if (content.content) return extractText(content.content);
    }
    return String(content ?? '');
};

// ── Call Detail Modal ─────────────────────────────────────────────────────────

function CallDetailModal({ open, callId, onClose }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (!open || !callId) { setData(null); return; }
        setLoading(true);
        fetchData(`/api/conversations/ai-calls/${callId}`)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, [open, callId]);

    const candidate = data?.candidateId;
    const job = data?.jobId;
    const ats = data?.ats;
    const channel = channelConfig(data);
    const isWhatsApp = isWhatsAppConversation(data);
    const messages = useMemo(
        () => (data?.messages || []).filter((m) => roleLabel(m.role) !== null),
        [data],
    );

    return (
        <MUIModal
            open={open}
            onClose={onClose}
            contentSx={{ width: { xs: '92vw', sm: '85vw', md: '72vw', lg: '58vw' }, maxWidth: 820 }}
        >
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>{isWhatsApp ? 'WhatsApp Conversation Details' : 'Call Details'}</Typography>
                <IconButton size="small" onClick={onClose}><CloseRounded /></IconButton>
            </Box>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
                    <CircularProgress size={30} />
                </Box>
            )}

            {!loading && data && (
                <>
                    {/* Candidate + meta */}
                    <Box
                        sx={{
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                            borderRadius: 2, p: 2, mb: 2,
                            display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center',
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Avatar sx={{ width: 44, height: 44, bgcolor: 'primary.main', fontWeight: 700 }}>
                                {initials(candidate)}
                            </Avatar>
                            <Box>
                                <Typography fontWeight={700} lineHeight={1.3}>{candName(candidate)}</Typography>
                                <Typography variant="caption" color="text.secondary">{candPhone(candidate)}</Typography>
                            </Box>
                        </Box>

                        {job && (
                            <Chip
                                icon={<WorkRounded sx={{ fontSize: 13 }} />}
                                label={job.internalTitle || job.title}
                                size="small" color="primary" variant="outlined"
                            />
                        )}
                        <Chip
                            icon={isWhatsApp ? <WhatsApp sx={{ fontSize: 13 }} /> : <CallRounded sx={{ fontSize: 13 }} />}
                            label={channel.label}
                            size="small"
                            sx={channelChipSx(data)}
                        />
                        {(() => {
                            const cfg = callTypeConfig(data.callType, data.direction);
                            return (
                                <Chip
                                    label={cfg.label}
                                    size="small"
                                    sx={{ fontWeight: 600, bgcolor: cfg.bg, color: cfg.color }}
                                />
                            );
                        })()}
                        {ats?.aiCallStatus && (
                            <Chip label={ats.aiCallStatus} size="small" color={statusColor(ats.aiCallStatus)} />
                        )}
                    </Box>

                    {/* Stats row */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2.5, mb: 2 }}>
                        {[
                            { icon: <AccessTimeRounded sx={{ fontSize: 15 }} />, label: fmtDate(data.createdAt) },
                            { icon: <PhoneRounded sx={{ fontSize: 15 }} />, label: `Duration: ${fmtDuration(data.durationSeconds, ats?.callAudioDuration)}` },
                            data.mobile_num && { icon: <CallReceivedRounded sx={{ fontSize: 15, color: 'success.main' }} />, label: `${isWhatsApp ? 'Candidate WhatsApp' : 'Caller'}: ${data.mobile_num}` },
                            data.calledNumber && { icon: <CallMadeRounded sx={{ fontSize: 15, color: 'primary.main' }} />, label: `${isWhatsApp ? 'Our WhatsApp' : 'Our number'}: ${data.calledNumber}` },
                            ats?.aiCallHangUpCause && { icon: null, label: `End: ${ats.aiCallHangUpCause}` },
                        ].filter(Boolean).map((item, i) => (
                            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                                {item.icon}
                                <Typography variant="caption">{item.label}</Typography>
                            </Box>
                        ))}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {/* Audio */}
                    {data.audio_url && (
                        <Box sx={{ mb: 2.5 }}>
                            <Typography variant="body2" fontWeight={600} mb={0.75}>
                                Call Recording
                            </Typography>
                            <audio controls src={data.audio_url} style={{ width: '100%', height: 36, borderRadius: 8 }} />
                        </Box>
                    )}

                    {/* Transcript */}
                    <Typography variant="body2" fontWeight={600} mb={1}>{isWhatsApp ? 'Chat Messages' : 'Transcript'}</Typography>

                    {messages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            {isWhatsApp ? 'No chat messages available.' : 'No transcript available.'}
                        </Typography>
                    ) : (
                        <Stack spacing={1} sx={{ maxHeight: 380, overflowY: 'auto', pr: 0.5 }}>
                            {messages.map((msg, i) => {
                                const isAI = ['assistant', 'ai'].includes(msg.role);
                                const label = roleLabel(msg.role);
                                const content = extractText(msg.content);
                                return (
                                    <Box key={i} sx={{ display: 'flex', flexDirection: isAI ? 'row' : 'row-reverse', gap: 1, alignItems: 'flex-start' }}>
                                        <Avatar
                                            sx={{
                                                width: 26, height: 26, fontSize: 10, flexShrink: 0,
                                                bgcolor: isAI ? 'primary.main' : 'grey.500',
                                            }}
                                        >
                                            {isAI ? 'AI' : 'C'}
                                        </Avatar>
                                        <Box
                                            sx={{
                                                bgcolor: isAI
                                                    ? (t) => alpha(t.palette.primary.main, 0.08)
                                                    : (t) => t.palette.grey[100],
                                                border: 1,
                                                borderColor: isAI
                                                    ? (t) => alpha(t.palette.primary.main, 0.25)
                                                    : 'grey.200',
                                                borderRadius: 2, px: 1.5, py: 0.8, maxWidth: '82%',
                                            }}
                                        >
                                            <Typography
                                                variant="caption" fontWeight={600} display="block" mb={0.25}
                                                color={isAI ? 'primary.main' : 'text.secondary'}
                                            >
                                                {label}
                                            </Typography>
                                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.55 }}>
                                                {content}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </>
            )}

            {!loading && !data && open && (
                <Typography color="text.secondary" variant="body2">Failed to load call details.</Typography>
            )}
        </MUIModal>
    );
}

// ── Lead Detail Modal ─────────────────────────────────────────────────────────

function LeadDetailModal({ open, lead, onClose }) {
    if (!lead) return null;
    const rows = [
        { label: 'Phone', value: lead.phone },
        { label: 'Our Number', value: lead.calledNumber },
        { label: 'Job Interest', value: lead.jobInterest },
        { label: 'Current Company', value: lead.currentCompany },
        { label: 'Skills Answer', value: lead.skillsAnswer },
        { label: 'Call Date', value: fmtDate(lead.callDate || lead.createdAt) },
    ].filter((r) => r.value);

    return (
        <MUIModal open={open} onClose={onClose}
            contentSx={{ width: { xs: '92vw', sm: '80vw', md: '58vw' }, maxWidth: 680 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FiberNewRounded color="warning" />
                    <Typography variant="h6" fontWeight={700}>Inbound Lead Details</Typography>
                </Box>
                <IconButton size="small" onClick={onClose}><CloseRounded /></IconButton>
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
                {rows.map((r) => (
                    <Box key={r.label}
                        sx={{
                            p: 1.5, borderRadius: 1.5, border: 1, borderColor: 'divider',
                            bgcolor: (t) => alpha(t.palette.grey[100], 0.5),
                        }}
                    >
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                            {r.label}
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 0.3, wordBreak: 'break-word' }}>
                            {r.value}
                        </Typography>
                    </Box>
                ))}
            </Box>

            {lead.basicAnswers?.length > 0 && (
                <Box>
                    <Typography variant="body2" fontWeight={600} mb={1}>Basic Question Answers</Typography>
                    <Stack spacing={0.8}>
                        {lead.basicAnswers.map((ans, i) => (
                            <Box key={i} sx={{ p: 1.2, borderRadius: 1, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), border: 1, borderColor: (t) => alpha(t.palette.primary.main, 0.15) }}>
                                <Typography variant="caption" color="primary" fontWeight={600}>Answer {i + 1}</Typography>
                                <Typography variant="body2">{ans || '—'}</Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}
        </MUIModal>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const SCRIPT_PANEL_WIDTH = 380;

export default function InboundCallLogs() {
    const theme = useTheme();
    const isLg = useMediaQuery(theme.breakpoints.up('lg'));
    const [searchParams] = useSearchParams();

    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(25);
    const [selectedCallId, setSelectedCallId] = useState(null);
    const [selectedLead, setSelectedLead] = useState(null);
    const [activeTab, setActiveTab] = useState('');   // '' | 'inbound' | 'outbound' | 'leads'
    const [scriptOpen, setScriptOpen] = useState(false);

    const phoneFromUrl = searchParams.get("phone") || "";

    const isLeadsTab = activeTab === 'leads';

    const load = useCallback(async (pg = page, ps = pageSize, dir = activeTab) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: pg + 1, pageSize: ps });
            if (dir === 'leads') {
                const res = await fetchData(`/api/inbound-leads/?${params}`);
                setRows(res.items || []);
                setTotal(res.total || 0);
            } else {
                if (dir) params.set('direction', dir);
                const res = await fetchData(`/api/conversations/ai-calls/?${params}`);
                setRows(res.items || []);
                setTotal(res.total || 0);
            }
        } catch {
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, activeTab]);

    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => setSearch(phoneFromUrl), [phoneFromUrl]);

    const visibleCallRows = useMemo(
        () => rows.filter((row) => !isWhatsAppConversation(row)),
        [rows],
    );

    const filtered = useMemo(() => {
        if (!search.trim()) return visibleCallRows;
        const q = search.trim().toLowerCase();
        if (isLeadsTab) {
            return visibleCallRows.filter((r) =>
                (r.phone || '').toLowerCase().includes(q) ||
                (r.jobInterest || '').toLowerCase().includes(q) ||
                (r.currentCompany || '').toLowerCase().includes(q)
            );
        }
        return visibleCallRows.filter((r) => {
            const name = candName(r.candidateId).toLowerCase();
            const phone = candPhone(r.candidateId).toLowerCase();
            const from = (r.mobile_num || '').toLowerCase();
            const job = (r.jobId?.internalTitle || r.jobId?.title || '').toLowerCase();
            return name.includes(q) || phone.includes(q) || from.includes(q) || job.includes(q);
        });
    }, [visibleCallRows, search, isLeadsTab]);

    const showChannelUi = useMemo(
        () => filtered.some((row) => isWhatsAppConversation(row)),
        [filtered],
    );

    const leadStatusColor = (s) => {
        if (s === 'New') return 'warning';
        if (s === 'Reviewed') return 'info';
        if (s === 'Converted') return 'success';
        return 'default';
    };

    const leadColumns = useMemo(() => [
        {
            field: 'phone',
            headerName: 'Caller Phone',
            minWidth: 150,
            flex: 1.2,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                    <CallReceivedRounded sx={{ fontSize: 13, color: 'success.main' }} />
                    <Typography sx={{ fontSize: '0.83rem', fontWeight: 600 }}>{row.phone || '—'}</Typography>
                </Box>
            ),
        },
        {
            field: 'calledNumber',
            headerName: 'Our Number',
            minWidth: 140,
            flex: 1,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                    <CallMadeRounded sx={{ fontSize: 13, color: 'primary.main' }} />
                    <Typography noWrap sx={{ fontSize: '0.82rem' }}>{row.calledNumber || '—'}</Typography>
                </Box>
            ),
        },
        {
            field: 'jobInterest',
            headerName: 'Job Interest',
            minWidth: 160,
            flex: 1.4,
            renderCell: ({ row }) => (
                row.jobInterest
                    ? <Chip label={row.jobInterest} size="small" icon={<WorkRounded sx={{ fontSize: 12 }} />}
                        variant="outlined" color="primary"
                        sx={{ maxWidth: 160, height: 24, fontSize: '0.72rem', '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                    : <Typography variant="body2" color="text.disabled">—</Typography>
            ),
        },
        {
            field: 'currentCompany',
            headerName: 'Current Company',
            minWidth: 140,
            flex: 1.1,
            renderCell: ({ row }) => (
                <Typography noWrap sx={{ fontSize: '0.82rem' }}>{row.currentCompany || '—'}</Typography>
            ),
        },
        {
            field: 'callDate',
            headerName: 'Call Date',
            minWidth: 155,
            flex: 1.1,
            renderCell: ({ row }) => (
                <Typography sx={{ fontSize: '0.82rem' }}>{fmtDate(row.callDate || row.createdAt)}</Typography>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            minWidth: 110,
            flex: 0.75,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => (
                <Chip
                    label={row.status || 'New'}
                    size="small"
                    color={leadStatusColor(row.status)}
                    sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600 }}
                />
            ),
        },
        {
            field: '_view',
            headerName: '',
            width: 72,
            sortable: false,
            align: 'center',
            renderCell: () => (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'primary.main', fontSize: '0.75rem', fontWeight: 600, gap: 0.3 }}>
                    <PlayArrowRounded sx={{ fontSize: 15 }} />
                    View
                </Box>
            ),
        },
    ], []);

    const columns = useMemo(() => [
        {
            field: 'candidateId',
            headerName: 'Candidate',
            minWidth: 200,
            flex: 1.6,
            sortable: false,
            renderCell: ({ row }) => {
                const c = row.candidateId;
                return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, width: '100%', minWidth: 0 }}>
                        <Avatar
                            sx={{
                                width: 32, height: 32, fontSize: 12,
                                bgcolor: 'primary.main', fontWeight: 700, flexShrink: 0,
                            }}
                        >
                            {initials(c)}
                        </Avatar>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                                noWrap fontWeight={600}
                                sx={{ fontSize: '0.83rem', lineHeight: 1.35, display: 'block' }}
                            >
                                {candName(c)}
                            </Typography>
                            <Typography
                                noWrap color="text.secondary"
                                sx={{ fontSize: '0.73rem', lineHeight: 1.3, display: 'block' }}
                            >
                                {candPhone(c)}
                            </Typography>
                        </Box>
                    </Box>
                );
            },
        },
        {
            field: 'mobile_num',
            headerName: 'Caller Number',
            minWidth: 148,
            flex: 1,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, width: '100%' }}>
                    <CallReceivedRounded sx={{ fontSize: 13, color: 'success.main', flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.82rem' }}>
                        {row.mobile_num || '—'}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'calledNumber',
            headerName: 'Our Number',
            minWidth: 148,
            flex: 1,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6, minWidth: 0, width: '100%' }}>
                    <CallMadeRounded sx={{ fontSize: 13, color: 'primary.main', flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.82rem' }}>
                        {row.calledNumber || '—'}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'jobId',
            headerName: 'Job',
            minWidth: 140,
            flex: 1.1,
            sortable: false,
            renderCell: ({ row }) => {
                const title = row.jobId?.internalTitle || row.jobId?.title;
                if (!title) return <Typography variant="body2" color="text.disabled">—</Typography>;
                return (
                    <Chip
                        label={title}
                        size="small"
                        icon={<WorkRounded sx={{ fontSize: 12 }} />}
                        variant="outlined"
                        color="primary"
                        sx={{
                            maxWidth: 150, height: 24, fontSize: '0.72rem',
                            '.MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis', px: 0.8 },
                            '.MuiChip-icon': { ml: 0.6 },
                        }}
                    />
                );
            },
        },
        {
            field: 'callType',
            headerName: 'Type',
            minWidth: 148,
            flex: 1,
            sortable: false,
            renderCell: ({ row }) => {
                const cfg = callTypeConfig(row.callType, row.direction);
                return (
                    <Chip
                        label={cfg.label}
                        size="small"
                        sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, bgcolor: cfg.bg, color: cfg.color }}
                    />
                );
            },
        },
        {
            field: 'channel',
            headerName: 'Channel',
            minWidth: 136,
            flex: 0.95,
            sortable: false,
            renderCell: ({ row }) => {
                const cfg = channelConfig(row);
                const isWhatsApp = isWhatsAppConversation(row);
                return (
                    <Chip
                        icon={isWhatsApp ? <WhatsApp sx={{ fontSize: 12 }} /> : <CallRounded sx={{ fontSize: 12 }} />}
                        label={cfg.label}
                        size="small"
                        sx={channelChipSx(row)}
                    />
                );
            },
        },
        {
            field: 'createdAt',
            headerName: 'Date & Time',
            minWidth: 155,
            flex: 1.15,
            renderCell: ({ row }) => (
                <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                    {fmtDate(row.createdAt)}
                </Typography>
            ),
        },
        {
            field: 'durationSeconds',
            headerName: 'Duration',
            minWidth: 95,
            flex: 0.7,
            sortable: false,
            renderCell: ({ row }) => (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AccessTimeRounded sx={{ fontSize: 14, color: 'text.disabled', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ fontSize: '0.82rem' }}>
                        {fmtDuration(row.durationSeconds, row.ats?.callAudioDuration)}
                    </Typography>
                </Box>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            minWidth: 110,
            flex: 0.75,
            sortable: false,
            align: 'center',
            headerAlign: 'center',
            renderCell: ({ row }) => {
                const s = row.ats?.aiCallStatus;
                if (!s) return <Typography variant="body2" color="text.disabled">—</Typography>;
                return (
                    <Chip
                        label={s.charAt(0).toUpperCase() + s.slice(1)}
                        size="small"
                        color={statusColor(s)}
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
            disableFlexAdjustment: true,
            renderCell: () => (
                <Box
                    sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'primary.main', fontSize: '0.75rem', fontWeight: 600, gap: 0.3,
                    }}
                >
                    <PlayArrowRounded sx={{ fontSize: 15 }} />
                    View
                </Box>
            ),
        },
    ], []);

    const handleTabChange = (_, val) => {
        setActiveTab(val);
        setPage(0);
        setSearch('');
        load(0, pageSize, val);
    };

    return (
        <Box sx={{ display: 'flex', height: '100%', position: 'relative' }}>

            {/* ── Main content ── */}
            <Box
                sx={{
                    flex: 1,
                    minWidth: 0,
                    p: { xs: 2, sm: 3 },
                    transition: 'all 0.25s ease',
                }}
            >
                {/* Page Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                        <Typography variant="h5" fontWeight={700} lineHeight={1.2}>AI Call Logs</Typography>
                        <Typography variant="body2" color="text.secondary" mt={0.3}>
                            {total} {isLeadsTab ? 'inbound leads' : 'total calls'} &nbsp;·&nbsp; click a row to view details
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Tooltip title={scriptOpen ? 'Close Inbound Script' : 'Configure Inbound Script'}>
                            <IconButton
                                size="small"
                                onClick={() => setScriptOpen((v) => !v)}
                                color={scriptOpen ? 'primary' : 'default'}
                            >
                                <EditNoteRounded />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Refresh">
                            <span>
                                <IconButton onClick={() => load(page, pageSize, activeTab)} disabled={loading} size="small">
                                    <RefreshRounded />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Box>
                </Box>

                {/* Tabs */}
                <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        textColor="primary"
                        indicatorColor="primary"
                        sx={{ minHeight: 40 }}
                    >
                        {TABS.map((t) => (
                            <Tab
                                key={t.value}
                                value={t.value}
                                label={t.label}
                                icon={t.icon}
                                iconPosition="start"
                                sx={{ minHeight: 40, fontSize: '0.82rem', fontWeight: 600, py: 0, gap: 0.5 }}
                            />
                        ))}
                    </Tabs>
                </Box>

                {/* Search + Legend row */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                    <TextField
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by candidate, phone or job…"
                        size="small"
                        sx={{ width: { xs: '100%', sm: 340 } }}
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

                    {!isLeadsTab && (
                        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
                            {showChannelUi && (
                                <>
                                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mr: 0.25 }}>
                                        Channel:
                                    </Typography>
                                    {[channelConfig({ callUUID: '' }), channelConfig({ callUUID: 'wa_conv_____demo' })].map((cfg) => {
                                        const isWhatsApp = cfg.label === 'WhatsApp Chat';
                                        return (
                                            <Chip
                                                key={cfg.label}
                                                icon={isWhatsApp ? <WhatsApp sx={{ fontSize: 12 }} /> : <CallRounded sx={{ fontSize: 12 }} />}
                                                label={cfg.label}
                                                size="small"
                                                sx={{ ...channelChipSx({ callUUID: isWhatsApp ? 'wa_conv_____demo' : '' }), cursor: 'default' }}
                                            />
                                        );
                                    })}
                                </>
                            )}
                            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mr: 0.25 }}>
                                Call Type:
                            </Typography>
                            {[
                                { key: 'screening', desc: 'Outbound AI screening call' },
                                { key: 'reminder', desc: 'Outbound interview reminder call' },
                                { key: 'inbound_screening', desc: 'Called back after missed screening' },
                                { key: 'inbound_reminder', desc: 'Called back after missed reminder' },
                            ].map((item) => {
                                const cfg = callTypeConfig(item.key);
                                return (
                                    <Tooltip key={item.key} title={item.desc} arrow>
                                        <Chip
                                            label={cfg.label}
                                            size="small"
                                            sx={{ height: 22, fontSize: '0.72rem', fontWeight: 600, cursor: 'default', bgcolor: cfg.bg, color: cfg.color }}
                                        />
                                    </Tooltip>
                                );
                            })}
                        </Box>
                    )}
                </Box>

                {/* Table */}
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
                        columns={isLeadsTab ? leadColumns : columns}
                        columnVisibilityModel={{ channel: showChannelUi }}
                        loading={loading}
                        getRowId={(r) => r._id}
                        rowHeight={62}
                        disableRowSelectionOnClick
                        onRowClick={(params) => {
                            if (isLeadsTab) setSelectedLead(params.row);
                            else setSelectedCallId(params.row._id);
                        }}
                        paginationMode="server"
                        rowCount={total}
                        paginationModel={{ page, pageSize }}
                        onPaginationModelChange={({ page: pg, pageSize: ps }) => {
                            setPage(pg);
                            setPageSize(ps);
                            load(pg, ps);
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
                                bgcolor: (t) => alpha(t.palette.grey[200], 0.7),
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
                                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
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
                    />
                </Box>

                <CallDetailModal
                    open={Boolean(selectedCallId)}
                    callId={selectedCallId}
                    onClose={() => setSelectedCallId(null)}
                />
                <LeadDetailModal
                    open={Boolean(selectedLead)}
                    lead={selectedLead}
                    onClose={() => setSelectedLead(null)}
                />
            </Box>{/* end main content */}

            {/* ── Inbound Script Panel ── */}
            {isLg ? (
                /* On large screens: inline right panel */
                scriptOpen && (
                    <Box
                        sx={{
                            width: SCRIPT_PANEL_WIDTH,
                            flexShrink: 0,
                            borderLeft: 1,
                            borderColor: 'divider',
                            height: '100%',
                            overflowY: 'auto',
                        }}
                    >
                        <InboundCallScriptPanel onClose={() => setScriptOpen(false)} />
                    </Box>
                )
            ) : (
                /* On smaller screens: slide-in drawer */
                <Drawer
                    anchor="right"
                    open={scriptOpen}
                    onClose={() => setScriptOpen(false)}
                    PaperProps={{ sx: { width: { xs: '92vw', sm: SCRIPT_PANEL_WIDTH } } }}
                >
                    <InboundCallScriptPanel onClose={() => setScriptOpen(false)} />
                </Drawer>
            )}
        </Box>
    );
}
