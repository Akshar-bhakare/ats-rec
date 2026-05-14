/* eslint-disable react-hooks/exhaustive-deps */
import React from 'react';
import {
    Avatar,
    Badge,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    List,
    ListItem,
    ListItemAvatar,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Popover,
    Stack,
    Tooltip,
    Typography,
    Chip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { fetchData, performDeploySafeFetch } from '../../../AppUtils/dataAPI';

/* ---------- helpers ---------- */
function formatRelativeTime(value) {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
}

function normalizeNotification(record) {
    return {
        id: record._id || record.id,
        title: record.content || record.title || '(no title)',
        description: record.source || record.category || '',
        timestamp: record.occurredAt || record.createdAt || record.ts || record?.meta?.date || null,
        read: !!(record.isRead ?? record.read),
        href: record.href || undefined,
        category: record.category || undefined,
        from: record.from || record?.meta?.from || '',
        snippet: record.snippet || record?.meta?.snippet || record.description || '',
    };
}

function normalizeEmailAsNotification(email) {
    return {
        id: `gmail_${email.id}`,
        title: email.subject || '(no subject)',
        description: 'Email',
        timestamp: email.date || null,
        read: false,
        href: `/notifications/gmail_${email.id}/`,
        category: 'Email',
        from: email.from || '',
        snippet: email.snippet || '',
    };
}

/* ---------- component ---------- */
export default function MuiNotification({
    items: itemsProp,
    onItemClick: onItemClickProp,
    onMarkAllRead: onMarkAllReadProp,
    onClearAll: onClearAllProp,
    loading: loadingProp = false,
    renderItem,
    emptyState,
    maxHeight = 420,
    width = 380,
    disablePortal = false,
    badgeMax = 99,
    unreadCountOverride,
    open: controlledOpen,
    anchorEl: controlledAnchorEl,
    onOpenChange,
    ariaLabel = 'Notifications',
}) {
    const [anchorEl, setAnchorEl] = React.useState(null);
    const isControlled = typeof controlledOpen === 'boolean' || !!controlledAnchorEl;
    const open = isControlled ? !!controlledOpen : Boolean(anchorEl);
    const anchor = isControlled ? controlledAnchorEl : anchorEl;

    const [allNotifications, setAllNotifications] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    /* ----- data fetch ----- */
    const pullNotifications = React.useCallback(async () => {
        setLoading(true);
        try {
            const raw = await performDeploySafeFetch(
                "Notifications",
                async () => await fetchData('/api/notifications?isArchived=false&limit=200&skip=0&sort=-occurredAt'),
                null,
                null // silent retry
            );
            const list =
                Array.isArray(raw) ? raw
                    : Array.isArray(raw?.items) ? raw.items
                        : Array.isArray(raw?.details?.notifications) ? raw.details.notifications
                            : Array.isArray(raw?.details) ? raw.details
                                : [];

            let normalized = list.map(normalizeNotification);

            if (!normalized.length) {
                try {
                    const unreadEmails = await fetchData('/api/emails/unread');
                    const emails = Array.isArray(unreadEmails) ? unreadEmails : [];
                    normalized = emails.map(normalizeEmailAsNotification);
                    // eslint-disable-next-line no-empty
                } catch { }
            }

            normalized.sort((a, b) => {
                const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                return tb - ta;
            });

            setAllNotifications(normalized);
        } catch (err) {
            console.error('Failed to load notifications', err);
            setAllNotifications([]);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (!itemsProp) pullNotifications();
        const onFocus = () => { if (!itemsProp) pullNotifications(); };
        window.addEventListener('focus', onFocus);
        return () => window.removeEventListener('focus', onFocus);
    }, []);

    React.useEffect(() => {
        if (open && !itemsProp) pullNotifications();
    }, [open]);

    React.useEffect(() => {
        if (Array.isArray(itemsProp)) {
            setAllNotifications(itemsProp.map(normalizeNotification));
        }
    }, [itemsProp]);

    const unreadBadgeCount =
        typeof unreadCountOverride === 'number'
            ? unreadCountOverride
            : allNotifications.filter((n) => !n.read).length;

    const mostRecentThree = React.useMemo(
        () => allNotifications.slice(0, 3),
        [allNotifications]
    );

    const toggleOpen = (event) => {
        if (isControlled) onOpenChange?.(!controlledOpen);
        else setAnchorEl((prev) => (prev ? null : event.currentTarget));
    };

    const closePopover = () => {
        if (isControlled) onOpenChange?.(false);
        else setAnchorEl(null);
    };

    const markOneRead = async (id, read = true) => {
        try {
            if (!String(id).startsWith('gmail_')) {
                await fetchData(`/api/notifications/${id}/read`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ read }),
                });
            }
            setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        } catch (err) {
            console.error('markRead failed', err);
        }
    };

    const handleRowClick = async (id) => {
        onItemClickProp?.(id);
        await markOneRead(id, true);
        closePopover();
        window.location.href = `/notifications/${encodeURIComponent(id)}/`;
    };

    const handleMarkAllRead = async () => {
        onMarkAllReadProp?.();
        try {
            await fetchData('/api/notifications/mark-all-read', { method: 'PUT' });
            setAllNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        } catch (err) {
            console.error('mark all read failed', err);
        }
    };

    const handleClearAll = async () => {
        onClearAllProp?.();
        try {
            const serverIds = allNotifications.filter(n => !String(n.id).startsWith('gmail_')).map(n => n.id);
            await Promise.all(serverIds.map((id) => fetchData(`/api/notifications/${id}/archive`, { method: 'PUT' })));
            await pullNotifications();
        } catch (err) {
            console.error('clear all failed', err);
        }
    };

    const defaultEmpty = (
        <Stack alignItems="center" justifyContent="center" py={6}>
            <Typography variant="subtitle1" component="div">No notifications</Typography>
            <Typography variant="body2" color="text.secondary" component="div">You’re all caught up. A miracle.</Typography>
        </Stack>
    );

    const renderDefaultItem = (n) => {
        const leading = n.icon
            ? <ListItemIcon sx={{ minWidth: 40 }}>{n.icon}</ListItemIcon>
            : n.avatar
                ? <ListItemAvatar><Avatar src={n.avatar} alt={n.title} /></ListItemAvatar>
                : null;

        const secondary = (
            <Stack spacing={0.5} component="div">
                {n.description && (
                    <Typography variant="body2" color="text.secondary" noWrap component="div">
                        {n.description}
                    </Typography>
                )}
                {n.timestamp && (
                    <Typography variant="caption" color="text.disabled" component="div">
                        {formatRelativeTime(n.timestamp)}
                    </Typography>
                )}
            </Stack>
        );

        return (
            <React.Fragment key={n.id}>
                <ListItem disableGutters alignItems="flex-start">
                    <ListItemButton
                        onClick={() => handleRowClick(n.id)}
                        selected={!n.read}
                        sx={{ '&.Mui-selected': { backgroundColor: 'action.hover' } }}
                        component="div"
                    >
                        {leading}
                        <ListItemText
                            primary={
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }} component="div">
                                    <Typography variant="body1" fontWeight={n.read ? 500 : 700} noWrap sx={{ maxWidth: '70%' }} component="div">
                                        {n.title}
                                    </Typography>
                                    {n.category && <Chip size="small" label={n.category} variant="outlined" />}
                                </Stack>
                            }
                            secondary={secondary}
                            primaryTypographyProps={{ component: 'div' }}
                            secondaryTypographyProps={{ component: 'div' }}
                        />

                    </ListItemButton>
                </ListItem>
                <Divider component="li" />
            </React.Fragment>
        );
    };

    return (
        <>
            <Tooltip title={ariaLabel}>
                <IconButton
                    aria-label={ariaLabel}
                    onClick={toggleOpen}
                    aria-controls={open ? 'notification-popover' : undefined}
                    aria-haspopup="true"
                    aria-expanded={open ? 'true' : undefined}
                >
                    <Badge
                        badgeContent={unreadBadgeCount}
                        color="error"
                        max={badgeMax}
                        overlap="circular"
                        invisible={unreadBadgeCount === 0}
                    >
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Tooltip>

            <Popover
                id="notification-popover"
                open={open}
                anchorEl={anchor}
                onClose={closePopover}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                disablePortal={disablePortal}
                PaperProps={{ sx: { p: 0, width, borderRadius: 2 } }}
            >
                <Box sx={{ width, maxHeight, overflowY: 'auto' }} role="listbox" aria-label="Notification list">
                    <Box px={2} pt={2} pb={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Typography variant="subtitle1" fontWeight={600} component="div">Notifications</Typography>
                            <Stack direction="row" spacing={1}>
                                <span>
                                    <IconButton size="small" onClick={handleMarkAllRead} disabled={!allNotifications.length} aria-label="Mark all as read">
                                        <CheckCircleIcon fontSize="small" />
                                    </IconButton>
                                </span>
                                <span>
                                    <IconButton size="small" onClick={handleClearAll} disabled={!allNotifications.length} aria-label="Clear all">
                                        <DeleteSweepIcon fontSize="small" />
                                    </IconButton>
                                </span>
                            </Stack>
                        </Stack>
                    </Box>
                    <Divider />

                    {!mostRecentThree.length
                        ? (emptyState || defaultEmpty)
                        : (
                            <List disablePadding>
                                {mostRecentThree.map((n) =>
                                    renderItem ? (
                                        <React.Fragment key={n.id}>{renderItem(n)}</React.Fragment>
                                    ) : (
                                        renderDefaultItem(n)
                                    )
                                )}
                            </List>
                        )}

                    <Divider />
                    <Box px={2} py={1.5}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                            <Stack direction="row" spacing={1}>
                                <Button size="small" variant="outlined" onClick={() => { window.location.href = '/notifications/'; }}>
                                    View all
                                </Button>
                            </Stack>
                            {(loading || loadingProp) && (
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <CircularProgress size={16} />
                                    <Typography variant="caption" color="text.secondary" component="div">Loading…</Typography>
                                </Stack>
                            )}
                        </Stack>
                    </Box>
                </Box>
            </Popover>
        </>
    );
}
