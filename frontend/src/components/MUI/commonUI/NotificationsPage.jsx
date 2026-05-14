import React from 'react';
import {
    Avatar,
    Box,
    Chip,
    Checkbox,
    IconButton,
    InputAdornment,
    List,
    ListItem,
    Stack,
    TextField,
    Typography,
    Grid,
    Tooltip,
    Skeleton,
    Paper,
    Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import { fetchData } from '../../../AppUtils/dataAPI';
import { useUiContextState } from '../../../contexts/UiContext';

/* ---------- helpers ---------- */
function toEmailOnly(value = '') {
    const text = String(value || '').trim();
    if (!text) return '';

    const angled = text.match(/<([^>]+)>/);
    const candidate = (angled?.[1] || text).trim().toLowerCase();
    const basicEmailMatch = candidate.match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    return basicEmailMatch ? basicEmailMatch[0].toLowerCase() : '';
}

function formatListDate(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
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
            ? contentStr.replace(/\s+/g, ' ').trim().slice(0, 160)
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
        avatar: raw.avatar || null,
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
        isSent:
            /(^me[, ]|<me>| from:me )/i.test(String(raw.from || '')) ||
            raw.description === 'Sent',
        type: classifyType(raw),
    };
}

const TYPE_LABELS = {
    all: 'All',
    email: 'Email',
    hiring: 'Hiring',
    system: 'System',
    other: 'Other',
};

export default function NotificationsPage({
    items: itemsProp,
    onItemClick: onItemClickProp,
    onRefresh: onRefreshProp,
    activeCategory = null,
    compact = false,
}) {
    const [, setUiState] = useUiContextState();
    const [items, setItems] = React.useState([]);
    const [localLoading, setLocalLoading] = React.useState(false);
    const [searchText, setSearchText] = React.useState('');
    const [activeType, setActiveType] = React.useState('all');
    const [selectedIds, setSelectedIds] = React.useState([]);

    const loadNotificationsFast = async () => {
        const notificationsRaw = await fetchData(
            '/api/notifications?isArchived=false&limit=50&skip=0&sort=-occurredAt'
        );

        const notificationList = Array.isArray(notificationsRaw)
            ? notificationsRaw
            : Array.isArray(notificationsRaw?.items)
                ? notificationsRaw.items
                : Array.isArray(notificationsRaw?.details?.notifications)
                    ? notificationsRaw.details.notifications
                    : Array.isArray(notificationsRaw?.details)
                        ? notificationsRaw.details
                        : [];

        const normalizedNotifications = notificationList.map(normalizeItem);
        setItems(normalizedNotifications);
        return normalizedNotifications;
    };

    const loadGmailBackground = async (current) => {
        try {
            const unreadEmailsRaw = await fetchData('/api/emails/unread');

            const normalizedUnreadEmails = (Array.isArray(unreadEmailsRaw)
                ? unreadEmailsRaw
                : []
            ).map((m) => ({
                id: `gmail_${m.id}`,
                title: m.subject || '(no subject)',
                description: 'Email',
                snippet: m.snippet || '',
                read: false,
                href: `/notifications/gmail_${m.id}/`,
                category: 'email',
                avatar: null,
                from: m.from || '',
                to: m.to || 'me',
                timestamp: m.date || null,
                body: m.snippet || '',
                isSent: /^me[, ]/i.test(String(m.from || '')),
                type: 'email',
            }));

            const merged = [...normalizedUnreadEmails, ...current].sort((a, b) => {
                const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return tb - ta;
            });

            setItems(merged);
        } catch (err) {
            console.error('gmail background load failed', err);
        }
    };

    const loadAll = React.useCallback(async () => {
        setUiState({ loadingMsg: 'Loading, Please wait...' });
        setLocalLoading(true);
        try {
            fetchData('/api/emails/ingest-replies', { method: 'POST' }).catch(() => { });
            const fastList = await loadNotificationsFast();
            loadGmailBackground(fastList);
        } catch (err) {
            console.error('Failed to fetch notifications page', err);
        } finally {
            setLocalLoading(false);
            setUiState({ loadingMsg: null });
        }
    }, [setUiState]);

    React.useEffect(() => {
        if (Array.isArray(itemsProp)) {
            setItems(itemsProp.map(normalizeItem));
        } else {
            loadAll();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemsProp]);

    const handleRefresh = async () => {
        fetchData('/api/emails/ingest-replies', { method: 'POST' }).catch(() => { });
        onRefreshProp?.();
        await loadAll();
    };

    const markReadIfNeeded = async (id) => {
        if (String(id).startsWith('gmail_')) return;
        try {
            await fetchData(`/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: true }),
            });
            setItems((prev) =>
                prev.map((i) => (i.id === id ? { ...i, read: true } : i))
            );
        } catch (err) {
            console.error('read update failed', err);
        }
    };

    const handleRowClick = async (id) => {
        onItemClickProp?.(id);
        await markReadIfNeeded(id);
        window.location.href = `/notifications/${encodeURIComponent(id)}/`;
    };

    const q = searchText.trim().toLowerCase();

    const baseFiltered = (items || []).filter((msg) => {
        if (activeCategory && msg.category !== activeCategory) return false;
        if (!q) return true;
        return (
            msg.title?.toLowerCase().includes(q) ||
            msg.description?.toLowerCase().includes(q) ||
            msg.category?.toLowerCase().includes(q) ||
            msg.from?.toLowerCase().includes(q) ||
            msg.snippet?.toLowerCase().includes(q)
        );
    });

    const typedFiltered = baseFiltered.filter((msg) =>
        activeType === 'all' ? true : msg.type === activeType
    );

    const folderFiltered = typedFiltered.filter((msg) => !msg.isSent);
    const visibleIds = React.useMemo(
        () => folderFiltered.map((msg) => String(msg.id)),
        [folderFiltered]
    );
    const selectedCount = selectedIds.length;
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    const someVisibleSelected = visibleIds.some((id) => selectedIds.includes(id));

    const typeCounts = React.useMemo(() => {
        const counts = { all: baseFiltered.length, email: 0, hiring: 0, system: 0, other: 0 };
        baseFiltered.forEach((item) => {
            if (counts[item.type] !== undefined) counts[item.type] += 1;
            else counts.other += 1;
        });
        return counts;
    }, [baseFiltered]);

    React.useEffect(() => {
        setSelectedIds((prev) => {
            const next = prev.filter((id) => visibleIds.includes(String(id)));
            if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
                return prev;
            }
            return next;
        });
    }, [visibleIds]);

    const toggleSelection = (id) => {
        const nextId = String(id);
        setSelectedIds((prev) =>
            prev.includes(nextId)
                ? prev.filter((x) => x !== nextId)
                : [...prev, nextId]
        );
    };

    const toggleSelectAllVisible = () => {
        if (allVisibleSelected) {
            setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
            return;
        }
        setSelectedIds((prev) => {
            const next = new Set(prev);
            visibleIds.forEach((id) => next.add(id));
            return Array.from(next);
        });
    };

    const bulkMarkReadStatus = async (read) => {
        const ids = [...selectedIds];
        if (!ids.length) return;

        const serverIds = ids.filter((id) => !String(id).startsWith('gmail_'));
        await Promise.all(
            serverIds.map((id) =>
                fetchData(`/api/notifications/${id}/read`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ read: !!read }),
                }).catch(() => null)
            )
        );

        setItems((prev) =>
            prev.map((msg) =>
                ids.includes(String(msg.id))
                    ? { ...msg, read: !!read }
                    : msg
            )
        );
        setSelectedIds([]);
    };

    return (
        <Box sx={{ p: { xs: 1.5, sm: 2.5 }, maxWidth: 1280, mx: 'auto' }}>
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.5}
                justifyContent="space-between"
                mb={2}
            >
                <Typography variant="h5" fontWeight={800}>
                    Notifications
                </Typography>

                <Stack direction="row" spacing={1}>
                    <TextField
                        size="small"
                        placeholder="Search notifications"
                        value={searchText}
                        onChange={(e) => setSearchText(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Tooltip title="Refresh">
                        <span>
                            <IconButton onClick={handleRefresh} disabled={localLoading}>
                                <RefreshIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Stack>
            </Stack>

            <Stack direction="row" spacing={1} mb={2} flexWrap="wrap" useFlexGap>
                {Object.keys(TYPE_LABELS).map((key) => {
                    const isActive = activeType === key;
                    return (
                        <Chip
                            key={key}
                            clickable
                            onClick={() => setActiveType(key)}
                            color={isActive ? 'primary' : 'default'}
                            variant={isActive ? 'filled' : 'outlined'}
                            label={`${TYPE_LABELS[key]} (${typeCounts[key] || 0})`}
                        />
                    );
                })}
            </Stack>

            <Grid container spacing={2}>
                <Grid item xs={12}>
                    <Paper>
                        <Box
                            sx={{
                                p: 2,
                                borderBottom: 1,
                                borderColor: 'divider',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 1,
                                flexWrap: 'wrap',
                            }}
                        >
                            <Stack direction="row" spacing={1.2} alignItems="center">
                                <Checkbox
                                    checked={allVisibleSelected}
                                    indeterminate={someVisibleSelected && !allVisibleSelected}
                                    onChange={toggleSelectAllVisible}
                                    inputProps={{ 'aria-label': 'Select all visible notifications' }}
                                />
                                <Typography variant="subtitle2" fontWeight={700}>
                                    Inbox
                                </Typography>
                                {selectedCount > 0 && (
                                    <Chip size="small" label={`${selectedCount} selected`} />
                                )}
                            </Stack>

                            <Stack direction="row" spacing={1}>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={!selectedCount}
                                    onClick={() => bulkMarkReadStatus(true)}
                                >
                                    Mark Read
                                </Button>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={!selectedCount}
                                    onClick={() => bulkMarkReadStatus(false)}
                                >
                                    Mark Unread
                                </Button>
                            </Stack>
                        </Box>

                        <List dense={compact} disablePadding>
                            {folderFiltered.length === 0 && (
                                <Box p={3} textAlign="center">
                                    {localLoading ? (
                                        <Stack spacing={1.5} alignItems="center">
                                            <Skeleton variant="circular" width={40} height={40} />
                                            <Skeleton variant="text" width={220} />
                                            <Skeleton variant="text" width={180} />
                                        </Stack>
                                    ) : (
                                        <>
                                            <Typography>Nothing here.</Typography>
                                            <Typography color="text.secondary">
                                                Try clearing your search or selecting another type.
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            )}

                            {folderFiltered.map((msg) => {
                                const unread = !msg.read;
                                const isSelected = selectedIds.includes(String(msg.id));

                                return (
                                    <ListItem
                                        key={msg.id}
                                        disableGutters
                                        sx={{
                                            borderBottom: 1,
                                            borderColor: 'divider',
                                            '&:hover': { bgcolor: 'action.hover', cursor: 'pointer' },
                                        }}
                                        onClick={() => handleRowClick(msg.id)}
                                    >
                                        <Box sx={{ px: 2, py: 1.1, display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                                            <Checkbox
                                                checked={isSelected}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={() => toggleSelection(msg.id)}
                                                inputProps={{ 'aria-label': `Select notification ${msg.id}` }}
                                            />

                                            <Avatar sx={{ width: 32, height: 32 }}>
                                                {(msg.from && msg.from[0]?.toUpperCase()) || 'N'}
                                            </Avatar>

                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Typography noWrap sx={{ fontWeight: unread ? 700 : 500 }}>
                                                    {msg.from || 'Notification'}
                                                </Typography>

                                                <Typography noWrap color="text.secondary">
                                                    <span style={{ fontWeight: unread ? 700 : 500 }}>
                                                        {msg.title}
                                                    </span>
                                                    {' - '}
                                                    {msg.snippet || msg.description}
                                                </Typography>
                                            </Box>

                                            <Stack alignItems="flex-end">
                                                <Typography variant="body2">
                                                    {formatListDate(msg.timestamp)}
                                                </Typography>
                                                {unread && <FiberManualRecordIcon sx={{ fontSize: 10 }} />}
                                            </Stack>
                                        </Box>
                                    </ListItem>
                                );
                            })}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Box>
    );
}
