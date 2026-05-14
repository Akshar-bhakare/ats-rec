import React from 'react';
import {
    Avatar,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Paper,
    Skeleton,
    Stack,
    Typography,
    Grid,
    IconButton,
    Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useNavigate, useParams } from 'react-router-dom';
import { fetchData } from '../../../AppUtils/dataAPI';
import { useUiContextState } from '../../../contexts/UiContext';

function toDate(value) {
    if (!value) return null;
    return value instanceof Date ? value : new Date(value);
}

function formatFullDate(value) {
    const date = toDate(value);
    if (!date) return 'Unknown';
    return date.toLocaleString();
}

function formatRelativeDate(value) {
    const date = toDate(value);
    if (!date) return '';
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function toEmailOnly(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';
    const angled = text.match(/<([^>]+)>/);
    const candidate = (angled?.[1] || text).trim().toLowerCase();
    const basicEmailMatch = candidate.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return basicEmailMatch ? basicEmailMatch[0].toLowerCase() : '';
}

function classifyType(raw = {}) {
    const category = String(raw.category || '').toLowerCase();
    const source = String(raw.source || '').toLowerCase();
    const id = String(raw._id || raw.id || '');
    const from = String(raw.from || raw?.meta?.from || '').toLowerCase();
    const meta = raw?.meta || {};
    const hasGmailId = !!meta.gmailId;
    const hasEmailSender = !!toEmailOnly(from);

    if (
        category.includes('email') ||
        source.includes('gmail') ||
        id.startsWith('gmail_') ||
        hasGmailId ||
        hasEmailSender
    ) {
        return 'email';
    }

    if (
        category.includes('candidate') ||
        category.includes('interview') ||
        category.includes('hiring') ||
        category.includes('job')
    ) {
        return 'hiring';
    }

    if (
        category.includes('system') ||
        source.includes('system') ||
        category.includes('billing') ||
        category.includes('subscription')
    ) {
        return 'system';
    }

    return 'other';
}

function normalizeItem(raw) {
    const contentStr =
        typeof raw.content === 'string'
            ? raw.content
            : typeof raw.body === 'string'
                ? raw.body
                : '';

    const snippetStr =
        raw.snippet ||
        raw?.meta?.snippet ||
        (contentStr
            ? contentStr.replace(/\s+/g, ' ').trim().slice(0, 200)
            : '');

    return {
        id: raw._id || raw.id,
        title:
            raw.subject ||
            raw.title ||
            contentStr ||
            raw.content ||
            raw.description ||
            '(no subject)',
        description: raw.description || raw.source || raw.category || '',
        read: !!(raw.isRead ?? raw.read),
        href: raw.href || undefined,
        category: raw.category || undefined,
        from:
            raw.from ||
            raw?.meta?.from ||
            (raw.category ? String(raw.category) : 'Notification'),
        to: raw.to || raw?.meta?.to || 'me',
        timestamp:
            raw.occurredAt ||
            raw.createdAt ||
            raw.ts ||
            raw?.meta?.date ||
            null,
        snippet: snippetStr,
        body:
            raw.body ||
            raw.content ||
            raw?.meta?.snippet ||
            raw.snippet ||
            '',
        type: classifyType(raw),
    };
}

const TYPE_LABELS = {
    email: 'Email',
    hiring: 'Hiring',
    system: 'System',
    other: 'Other',
};

export default function NotificationDetailPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [, setUiState] = useUiContextState();

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState('');
    const [item, setItem] = React.useState(null);
    const [reloadTick, setReloadTick] = React.useState(0);
    const shouldShowOpenLink =
        !!item?.href && !String(item.href).startsWith('/notifications/');

    const handleRefresh = async () => {
        await fetchData('/api/emails/ingest-replies', { method: 'POST' }).catch(() => { });
        setReloadTick((prev) => prev + 1);
    };

    React.useEffect(() => {
        let mounted = true;

        const loadDetail = async () => {
            if (!id) return;

            setUiState({ loadingMsg: 'Loading, Please wait...' });
            setLoading(true);
            setError('');

            try {
                if (String(id).startsWith('gmail_')) {
                    const gmailId = String(id).replace('gmail_', '');

                    try {
                        const fullEmail = await fetchData(`/api/emails/${gmailId}`);
                        if (fullEmail?.id) {
                            if (mounted) {
                                setItem(normalizeItem({
                                    id: `gmail_${fullEmail.id}`,
                                    subject: fullEmail.subject,
                                    from: fullEmail.from,
                                    to: fullEmail.to || 'me',
                                    snippet: fullEmail.snippet || '',
                                    content: fullEmail.body || fullEmail.bodyText || fullEmail.snippet || '',
                                    body: fullEmail.body || fullEmail.bodyText || fullEmail.snippet || '',
                                    category: 'email',
                                    source: 'gmail',
                                    occurredAt: fullEmail.date,
                                    href: `/notifications/gmail_${fullEmail.id}/`,
                                }));
                            }
                            return;
                        }
                        // eslint-disable-next-line no-empty
                    } catch { }

                    const fromNotifications = await fetchData(
                        '/api/notifications?isArchived=false&limit=200&skip=0&sort=-occurredAt'
                    );

                    const notifications = Array.isArray(fromNotifications)
                        ? fromNotifications
                        : Array.isArray(fromNotifications?.items)
                            ? fromNotifications.items
                            : [];

                    const matchedNotification = notifications.find(
                        (n) => String(n?.meta?.gmailId || '') === gmailId
                    );

                    if (matchedNotification) {
                        if (matchedNotification?._id && !matchedNotification?.isRead) {
                            try {
                                await fetchData(`/api/notifications/${matchedNotification._id}/read`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ read: true }),
                                });
                                // eslint-disable-next-line no-empty
                            } catch { }
                        }

                        const normalized = normalizeItem({ ...matchedNotification, isRead: true });
                        if (mounted) setItem(normalized);
                        return;
                    }

                    const unreadEmails = await fetchData('/api/emails/unread');
                    const emails = Array.isArray(unreadEmails) ? unreadEmails : [];
                    const matchedEmail = emails.find((m) => String(m?.id || '') === gmailId);

                    if (!matchedEmail) {
                        if (mounted) setError('Notification not found.');
                        return;
                    }

                    if (mounted) {
                        setItem(normalizeItem({
                            id: `gmail_${matchedEmail.id}`,
                            subject: matchedEmail.subject,
                            from: matchedEmail.from,
                            to: matchedEmail.to || 'me',
                            snippet: matchedEmail.snippet,
                            content: matchedEmail.snippet,
                            category: 'email',
                            source: 'gmail',
                            occurredAt: matchedEmail.date,
                            href: `/notifications/gmail_${matchedEmail.id}/`,
                        }));
                    }

                    return;
                }

                const full = await fetchData(`/api/notifications/${id}`);
                if (!full || !full._id) {
                    if (mounted) setError('Notification not found.');
                    return;
                }

                let mergedFull = { ...full };
                if (full?.meta?.gmailId) {
                    try {
                        const fullEmail = await fetchData(`/api/emails/${full.meta.gmailId}`);
                        if (fullEmail?.id) {
                            mergedFull = {
                                ...mergedFull,
                                subject: fullEmail.subject || mergedFull.subject,
                                from: fullEmail.from || mergedFull.from,
                                to: fullEmail.to || mergedFull.to,
                                snippet: fullEmail.snippet || mergedFull.snippet,
                                body: fullEmail.body || fullEmail.bodyText || mergedFull.body,
                                content: fullEmail.body || fullEmail.bodyText || mergedFull.content,
                            };
                        }
                        // eslint-disable-next-line no-empty
                    } catch { }
                }

                try {
                    await fetchData(`/api/notifications/${id}/read`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ read: true }),
                    });
                    // eslint-disable-next-line no-empty
                } catch { }

                if (mounted) setItem(normalizeItem({ ...mergedFull, isRead: true }));
            } catch (err) {
                console.error('load notification detail failed', err);
                if (mounted) setError('Failed to load notification details.');
            } finally {
                if (mounted) {
                    setLoading(false);
                    setUiState({ loadingMsg: null });
                }
            }
        };

        loadDetail();

        return () => {
            mounted = false;
        };
        // Keyed by id (+ manual refresh tick) to avoid re-fetch loops caused by
        // context setter identity changes after each UiContext update.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, reloadTick]);

    return (
        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1080, mx: 'auto' }}>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                justifyContent="space-between"
                alignItems={{ xs: 'flex-start', sm: 'center' }}
                spacing={1.5}
                mb={2}
            >
                <Stack spacing={0.25}>
                    <Typography variant="h5" fontWeight={800}>Notification Details</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Review complete message context and metadata
                    </Typography>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                    <Tooltip title="Refresh">
                        <span>
                            <IconButton onClick={handleRefresh} disabled={loading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Button
                        variant="outlined"
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate('/notifications/')}
                    >
                        Back to Inbox
                    </Button>
                </Stack>
            </Stack>

            <Paper
                sx={{
                    minHeight: 280,
                    borderRadius: 2,
                    border: 1,
                    borderColor: 'divider',
                    overflow: 'hidden',
                }}
            >
                {loading && (
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Stack spacing={2}>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <CircularProgress size={24} />
                                <Typography color="text.secondary">Loading notification...</Typography>
                            </Stack>
                            <Skeleton variant="text" width="65%" height={36} />
                            <Skeleton variant="text" width="40%" />
                            <Skeleton variant="rectangular" width="100%" height={140} />
                        </Stack>
                    </Box>
                )}

                {!loading && error && (
                    <Box p={3}>
                        <Typography color="error.main" fontWeight={600}>{error}</Typography>
                    </Box>
                )}

                {!loading && !error && item && (
                    <Box sx={{ p: { xs: 2, sm: 2.5 } }}>
                        <Stack spacing={2.5}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                justifyContent="space-between"
                                alignItems={{ xs: 'flex-start', sm: 'center' }}
                                spacing={1}
                            >
                                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                    <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.25 }}>
                                        {item.title}
                                    </Typography>
                                    {!item.read && (
                                        <Chip size="small" label="Unread" color="primary" variant="outlined" />
                                    )}
                                    <Chip
                                        size="small"
                                        label={TYPE_LABELS[item.type] || 'Other'}
                                        variant="outlined"
                                    />
                                </Stack>

                                {shouldShowOpenLink && (
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        endIcon={<OpenInNewIcon />}
                                        href={item.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        Open link
                                    </Button>
                                )}
                            </Stack>

                            <Divider />

                            <Grid container spacing={2} sx={{ justifyContent: "space-between", alignItems: "center", px: 2 }}>
                                <Grid item xs={12} md={8}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                        <Avatar sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}>
                                            {(item.from && item.from[0]?.toUpperCase()) || 'N'}
                                        </Avatar>

                                        <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography fontWeight={700} noWrap>
                                                {item.from || 'Notification'}
                                            </Typography>
                                            <Typography color="text.secondary" noWrap>
                                                to {item.to || 'me'}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                </Grid>

                                <Grid item xs={12} md={4}>
                                    <Paper
                                        variant="outlined"
                                        sx={{ p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}
                                    >
                                        <Typography variant="caption" color="text.secondary">
                                            Received
                                        </Typography>
                                        <Typography variant="body2" fontWeight={600}>
                                            {formatFullDate(item.timestamp)}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            {formatRelativeDate(item.timestamp)}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            </Grid>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                    Message
                                </Typography>
                                <Paper
                                    variant="outlined"
                                    sx={{
                                        p: 2,
                                        borderRadius: 1.5,
                                        bgcolor: 'background.default',
                                    }}
                                >
                                    <Typography sx={{ whiteSpace: 'pre-wrap' }}>
                                        {item.body ||
                                            item.snippet ||
                                            item.description ||
                                            'No additional content.'}
                                    </Typography>
                                </Paper>
                            </Box>
                        </Stack>
                    </Box>
                )}
            </Paper>
        </Box>
    );
}
