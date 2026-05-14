import React, { useEffect, useMemo, useState } from 'react';
import {
    Box,
    Chip,
    Divider,
    IconButton,
    MenuItem,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ShareOutlinedIcon from '@mui/icons-material/ShareOutlined';
import FacebookIcon from '@mui/icons-material/Facebook';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import TwitterIcon from '@mui/icons-material/Twitter';
import EmailIcon from '@mui/icons-material/Email';

import MUIModal from '../MUI/commonUI/MUIModal';
import MUIButton from '../MUI/commonUI/MUIButton';
import Button from '../MUI/commonUI/MUIButton';
import MUIAlert from '../MUI/commonUI/MUIAlert';
import {
    createShareLinkRecord,
} from '../../AppUtils/jobShareStorage';

const PLATFORM_OPTIONS = [
    'LinkedIn',
    'WhatsApp',
    'Facebook',
    'Telegram',
    'Instagram',
    'Email',
    'Custom'
];

const defaultState = {
    platform: PLATFORM_OPTIONS[0],
    customSource: '',
    generatedLink: null,
    alert: { open: false, message: '', severity: 'info' },
};

const SHARE_TARGETS = [
    {
        key: 'facebook',
        label: 'Facebook',
        icon: FacebookIcon,
        buildHref: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
        key: 'linkedin',
        label: 'LinkedIn',
        icon: LinkedInIcon,
        buildHref: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
        key: 'whatsapp',
        label: 'WhatsApp',
        icon: WhatsAppIcon,
        buildHref: (url, ctx) =>
            `https://wa.me/?text=${encodeURIComponent(`${ctx?.message || 'Quick apply link'} ${url}`)}`,
    },
    {
        key: 'telegram',
        label: 'Telegram',
        icon: TelegramIcon,
        buildHref: (url, ctx) =>
            `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(ctx?.message || '')}`,
    },
    {
        key: 'twitter',
        label: 'X / Twitter',
        icon: TwitterIcon,
        buildHref: (url, ctx) =>
            `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(ctx?.message || '')}`,
    },
    {
        key: 'email',
        label: 'Email',
        icon: EmailIcon,
        buildHref: (url, ctx) =>
            `mailto:?subject=${encodeURIComponent(ctx?.subject || 'Interesting role to apply for')}&body=${encodeURIComponent(`${ctx?.message || ''} ${url}`)}`,
    },
];



const JobShareLinkModal = ({ open, job, user, onClose }) => {
    const [{ platform, customSource, generatedLink, alert }, setState] = useState(defaultState);
    const jobId = job?._id;
    const sharerName = useMemo(() => {
        if (!user) return '';
        return (
            user.fullName ||
            [user.firstName, user.lastName].filter(Boolean).join(' ') ||
            user.name ||
            user.email ||
            ''
        );
    }, [user]);

    useEffect(() => {
        if (!open) {
            setState(defaultState);
        } else {
            setState((prev) => ({ ...defaultState, platform: prev.platform }));
        }
    }, [open]);

    const shortDescription = useMemo(() => {
        if (!job) return '';
        const base =
            job.shortDescription ||
            job.description ||
            '';
        return base?.slice?.(0, 220) || '';
    }, [job]);

    const updateAlert = (cfg) => setState((prev) => ({ ...prev, alert: cfg }));
    const shareMessage = useMemo(() => {
        if (!job) return 'Apply quickly with this CV upload link.';
        const company = job?.company?.name;
        if (job.title && company) return `${job.title} @ ${company} – upload your CV in seconds.`;
        if (job.title) return `${job.title} – upload your CV in seconds.`;
        return 'Apply quickly with this CV upload link.';
    }, [job]);
    const shareSubject = useMemo(() => {
        if (!job?.title) return 'Quick referral to apply';
        return `Referral: ${job.title}${job?.company?.name ? ` @ ${job.company.name}` : ''}`;
    }, [job]);
    const messageWithSnippet = useMemo(() => {
        if (!shortDescription) return shareMessage;
        return `${shareMessage}\n\n${shortDescription}`;
    }, [shareMessage, shortDescription]);

    const openShareTarget = (target) => {
        if (!job || !user) {
            updateAlert({ open: true, severity: 'error', message: 'Missing job or sharer context.' });
            return;
        }
        const desiredSource = target.label;
        let link = generatedLink;
        const needsFreshLink = !link || link.defaultSource !== desiredSource;
        try {
            if (needsFreshLink) {
                link = createShareLinkRecord({
                    job,
                    sharer: user,
                    defaultSource: desiredSource,
                });
                setState((prev) => ({ ...prev, generatedLink: link, platform: desiredSource }));
            }
            const href = target.buildHref(link.shareUrl, {
                message: messageWithSnippet,
                subject: shareSubject,
                snippet: shortDescription,
            });
            window.open(href, '_blank', 'noopener,noreferrer');
        } catch (err) {
            console.error('Unable to open share target', err);
            updateAlert({ open: true, severity: 'error', message: err?.message || 'Could not prepare link for sharing.' });
        }
    };
    const handleGenerate = () => {
        if (!job || !user) {
            updateAlert({ open: true, severity: 'error', message: 'Missing job or sharer context.' });
            return;
        }
        const source = platform === 'Custom' ? customSource.trim() : platform;
        if (!source) {
            updateAlert({ open: true, severity: 'warning', message: 'Please specify a source name.' });
            return;
        }
        try {
            const link = createShareLinkRecord({
                job,
                sharer: user,
                defaultSource: source,
            });
            setState((prev) => ({ ...prev, generatedLink: link }));
            updateAlert({ open: true, severity: 'success', message: 'Share link created and stored locally.' });
        } catch (err) {
            updateAlert({ open: true, severity: 'error', message: err?.message || 'Failed to create link.' });
        }
    };

    const copyLink = (value) => {
        if (!value) return;
        if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(value)
                .then(() => updateAlert({ open: true, severity: 'success', message: 'Copied. Paste it anywhere you like!' }))
                .catch(() => updateAlert({ open: true, severity: 'warning', message: 'Copy failed. Please copy manually.' }));
        } else {
            updateAlert({ open: true, severity: 'info', message: 'Clipboard not supported here. Please copy manually.' });
        }
    };

    const closeAlert = (_e, reason) => {
        if (reason === 'clickaway') return;
        updateAlert({ ...alert, open: false });
    };

    return (
        <MUIModal open={open} onClose={onClose}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <MUIAlert {...alert} onClose={closeAlert} />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ShareOutlinedIcon />
                    <Typography variant="h6">Create Upload CV Share Link</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                    Share a lightweight upload experience with candidates. We keep everything inside localStorage for now.
                </Typography>

                <Box
                    sx={{
                        p: 2,
                        borderRadius: 2,
                        border: '1px dashed',
                        borderColor: 'divider',
                        backgroundColor: 'background.default',
                    }}
                >
                    <Typography variant="subtitle2" color="text.secondary">Job Snapshot</Typography>
                    <Typography variant="h6">{job?.title}</Typography>
                    {job?.company?.name && (
                        <Typography variant="body2" color="text.secondary">
                            {job.company.name}
                        </Typography>
                    )}
                    {shortDescription && (
                        <Typography sx={{ mt: 1 }} variant="body2">
                            {shortDescription}
                            {job?.description?.length > shortDescription.length ? '…' : ''}
                        </Typography>
                    )}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        <Chip label={`Job ID: ${jobId}`} size="small" />
                        {sharerName && <Chip label={`Sharer: ${sharerName}`} size="small" />}
                        <Chip label={`Role: ${user?.role || 'N/A'}`} size="small" />
                    </Box>
                </Box>

                <TextField
                    select
                    label="Default Source"
                    value={platform}
                    onChange={(e) => setState((prev) => ({ ...prev, platform: e.target.value }))}
                    size="small"
                >
                    {PLATFORM_OPTIONS.map((opt) => (
                        <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                    ))}
                </TextField>

                {platform === 'Custom' && (
                    <TextField
                        label="Custom Source Label"
                        value={customSource}
                        onChange={(e) => setState((prev) => ({ ...prev, customSource: e.target.value }))}
                        size="small"
                        helperText="Example: Discord, Meetup group, etc."
                    />
                )}

                <MUIButton onClick={handleGenerate}>
                    Generate Link (Manual Sharing)
                </MUIButton>

                {generatedLink?.shareUrl && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Share URL</Typography>
                        <TextField
                            value={generatedLink.shareUrl}
                            fullWidth
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <Tooltip title="Copy">
                                        <IconButton onClick={() => copyLink(generatedLink.shareUrl)}>
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )
                            }}
                        />
                    </Box>
                )}

                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Share directly</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    {SHARE_TARGETS.map((target) => {
                        const IconCmp = target.icon;
                        return (
                            <Button
                                key={target.key}
                                onClick={() => openShareTarget(target)}
                                startIcon={<IconCmp fontSize="small" />}
                                size="small"
                                variant="outlined"
                                sx={{ px: 2, }}
                            >
                                {target.label}
                            </Button>
                        );
                    })}
                </Box>
            </Box>
        </MUIModal>
    );
};

export default JobShareLinkModal;
