import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import InterviewReminderSettings from './InterviewReminderSettings';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Tabs,
    Tab,
    Avatar,
    TextField,
    Divider,
    Switch,
    Stack,
    Chip,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useAuthContextState } from '../../contexts/AuthContext';
import MUIButton from '../MUI/commonUI/MUIButton';
import ArchivedBin from '../job/ArchivedBin';
import { fetchData } from '../../AppUtils/dataAPI';
import {
    COOKIE_CONSENT_STORAGE_KEY,
    DEFAULT_COOKIE_PREFERENCES,
    clearCookieConsent,
    readCookieConsent,
    writeCookieConsent,
} from '../../AppUtils/userConsent';

const tabOptions = [
    { label: 'Profile', value: 'profile' },
    { label: 'Subscription & Billing', value: 'billing' },
    { label: 'Notifications', value: 'notifications' },
    { label: 'Interview Reminder', value: 'interviewReminder' },
    { label: 'Interview Security', value: 'interviewSecurity' },
    { label: 'Cookies', value: 'cookies' },
    { label: 'Email Templates', value: 'emailTemplates' },
    { label: 'Archive Bin', value: 'archive' },
    { label: 'Permissions', value: 'permissions' },
    { label: 'Privacy & Legal', value: 'privacy' },
];

const buildInitials = (name) => {
    const trimmed = String(name || '').trim();
    if (!trimmed) return 'CA';
    return trimmed
        .split(' ')
        .filter(Boolean)
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
};

const defaultNotificationPrefs = {
    channels: {
        email: true,
        inApp: true,
        whatsapp: true,
    },
    hiringActivity: {
        newCandidate: true,
        candidateStageUpdated: true,
        interviewScheduled: true,
        interviewFeedbackSubmitted: true,
        candidateArchived: true,
    },
    systemAccount: {
        billingInvoiceUpdates: true,
        subscriptionChanges: true,
    },
};

const mergeNotificationPrefs = (incoming = {}) => ({
    channels: { ...defaultNotificationPrefs.channels, ...(incoming.channels || {}) },
    hiringActivity: { ...defaultNotificationPrefs.hiringActivity, ...(incoming.hiringActivity || {}) },
    systemAccount: { ...defaultNotificationPrefs.systemAccount, ...(incoming.systemAccount || {}) },
});

const notificationChannelOptions = [
    { key: 'email', title: 'Email Notifications' },
    { key: 'inApp', title: 'In-app Notifications' },
    { key: 'whatsapp', title: 'WhatsApp Alerts' },
];

const hiringActivityOptions = [
    { key: 'newCandidate', title: 'New candidate added' },
    {
        key: 'candidateStageUpdated',
        title: 'Candidate stage updated',
        description: 'Get notified when a candidate moves to a new stage.',
    },
    {
        key: 'interviewScheduled',
        title: 'Interview scheduled',
        description: 'Get notified when an interview is scheduled for your jobs.',
    },
    {
        key: 'interviewFeedbackSubmitted',
        title: 'Interview feedback submitted',
        description: 'Be alerted when feedback on an interview is submitted.',
    },
    {
        key: 'candidateArchived',
        title: 'Candidate archived',
        description: 'Receive a notification when a candidate is moved to the archive bin.',
    },
];

const systemAccountOptions = [
    { key: 'billingInvoiceUpdates', title: 'Billing & invoice updates' },
    { key: 'subscriptionChanges', title: 'Subscription changes' },
];

export default function ClientAdminSettings({
    forcedTab = '',
    hideTabs = false,
    pageTitle = 'Settings',
    pageSubtitle = '(Account & System)',
    pageDescription = 'Manage your account preferences, system access, and data.',
}) {
    const theme = useTheme();
    const [authState] = useAuthContextState();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(forcedTab || 'profile');
    const [notificationPrefs, setNotificationPrefs] = useState(defaultNotificationPrefs);
    const [prefsLoading, setPrefsLoading] = useState(false);
    const [prefsSaving, setPrefsSaving] = useState(false);
    const [prefsError, setPrefsError] = useState('');
    const [emailTemplates, setEmailTemplates] = useState([]);
    const [emailTemplatesLoading, setEmailTemplatesLoading] = useState(false);
    const [emailTemplatesSaving, setEmailTemplatesSaving] = useState(false);
    const [emailTemplatesError, setEmailTemplatesError] = useState('');
    const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
    const [templateDraft, setTemplateDraft] = useState({ subject: '', html: '', text: '' });
    const [templateDirty, setTemplateDirty] = useState(false);
    const [cookieConsent, setCookieConsent] = useState(() => readCookieConsent());
    const [cookieStatusMsg, setCookieStatusMsg] = useState('');
    const [interviewSecurity, setInterviewSecurity] = useState({ faceDetectionEnabled: false, readingPassageEnabled: false });
    const [securityLoading, setSecurityLoading] = useState(false);
    const [securitySaving, setSecuritySaving] = useState(false);
    const [securityError, setSecurityError] = useState('');
    const me = authState?.user || {};

    const displayName = useMemo(() => {
        const name = `${me.firstName || ''} ${me.lastName || ''}`.trim();
        return name || me.email || 'Client Admin';
    }, [me.firstName, me.lastName, me.email]);

    const initials = useMemo(() => buildInitials(displayName), [displayName]);

    useEffect(() => {
        if (forcedTab) {
            if (activeTab !== forcedTab) {
                setActiveTab(forcedTab);
            }
            return;
        }
        const requestedTab = searchParams.get('tab');
        if (requestedTab && tabOptions.some((tab) => tab.value === requestedTab) && requestedTab !== activeTab) {
            setActiveTab(requestedTab);
        }
    }, [activeTab, forcedTab, searchParams]);

    const handleTabChange = (_event, nextTab) => {
        setActiveTab(nextTab);
        if (forcedTab) return;
        const nextParams = new URLSearchParams(searchParams);
        if (nextTab === 'profile') {
            nextParams.delete('tab');
        } else {
            nextParams.set('tab', nextTab);
        }
        setSearchParams(nextParams, { replace: true });
    };

    useEffect(() => {
        let alive = true;
        if (activeTab !== 'notifications') return () => { };

        setPrefsLoading(true);
        setPrefsError('');
        fetchData('/api/notification-preferences')
            .then((data) => {
                if (!alive) return;
                setNotificationPrefs(mergeNotificationPrefs(data || {}));
            })
            .catch((err) => {
                if (!alive) return;
                console.error('Failed to load notification preferences', err);
                setNotificationPrefs(defaultNotificationPrefs);
                setPrefsError('Unable to load notification settings. Please try again.');
            })
            .finally(() => {
                if (!alive) return;
                setPrefsLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [activeTab]);

    const syncCookieConsent = useCallback(() => {
        setCookieConsent(readCookieConsent());
    }, []);

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (!event?.key || event.key === COOKIE_CONSENT_STORAGE_KEY) {
                syncCookieConsent();
            }
        };

        const handleConsentChange = () => {
            syncCookieConsent();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('aiselekt-cookie-consent-changed', handleConsentChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('aiselekt-cookie-consent-changed', handleConsentChange);
        };
    }, [syncCookieConsent]);

    useEffect(() => {
        let alive = true;
        if (activeTab !== 'interviewSecurity') return () => { };

        setSecurityLoading(true);
        setSecurityError('');
        fetchData('/api/users/interview-security-settings')
            .then((data) => {
                if (!alive) return;
                setInterviewSecurity({
                    faceDetectionEnabled: !!data?.faceDetectionEnabled,
                    readingPassageEnabled: !!data?.readingPassageEnabled,
                });
            })
            .catch((err) => {
                if (!alive) return;
                console.error('Failed to load interview security settings', err);
                setSecurityError('Unable to load security settings. Please try again.');
            })
            .finally(() => {
                if (!alive) return;
                setSecurityLoading(false);
            });

        return () => { alive = false; };
    }, [activeTab]);

    const handleSaveSecuritySettings = async () => {
        setSecuritySaving(true);
        setSecurityError('');
        try {
            const updated = await fetchData('/api/users/interview-security-settings', {
                method: 'PUT',
                body: interviewSecurity,
            });
            setInterviewSecurity({
                faceDetectionEnabled: !!updated?.faceDetectionEnabled,
                readingPassageEnabled: !!updated?.readingPassageEnabled,
            });
        } catch (err) {
            console.error('Failed to save interview security settings', err);
            setSecurityError('Failed to save security settings. Please try again.');
        } finally {
            setSecuritySaving(false);
        }
    };

    const selectedEmailTemplate = useMemo(
        () => emailTemplates.find((tpl) => tpl.key === selectedTemplateKey) || null,
        [emailTemplates, selectedTemplateKey]
    );

    const applyTemplateToDraft = useCallback((template) => {
        setTemplateDraft({
            subject: template?.subject || '',
            html: template?.html || '',
            text: template?.text || ''
        });
        setTemplateDirty(false);
    }, []);

    useEffect(() => {
        let alive = true;
        if (activeTab !== 'emailTemplates') return () => { };

        setEmailTemplatesLoading(true);
        setEmailTemplatesError('');

        fetchData('/api/email-templates')
            .then((data) => {
                if (!alive) return;
                const rows = Array.isArray(data?.templates) ? data.templates : [];
                setEmailTemplates(rows);
                if (!rows.length) {
                    setSelectedTemplateKey('');
                    applyTemplateToDraft(null);
                    return;
                }
                setSelectedTemplateKey((prevKey) => {
                    const initialKey = rows.some((row) => row.key === prevKey)
                        ? prevKey
                        : rows[0].key;
                    const initialTemplate = rows.find((row) => row.key === initialKey) || rows[0];
                    applyTemplateToDraft(initialTemplate);
                    return initialTemplate?.key || '';
                });
            })
            .catch((err) => {
                if (!alive) return;
                console.error('Failed to load email templates', err);
                setEmailTemplates([]);
                setSelectedTemplateKey('');
                applyTemplateToDraft(null);
                setEmailTemplatesError('Unable to load email templates. Please try again.');
            })
            .finally(() => {
                if (!alive) return;
                setEmailTemplatesLoading(false);
            });

        return () => {
            alive = false;
        };
    }, [activeTab, applyTemplateToDraft]);

    const handleTemplateSelect = (key) => {
        if (!key) return;
        const next = emailTemplates.find((tpl) => tpl.key === key);
        setSelectedTemplateKey(key);
        applyTemplateToDraft(next);
        setEmailTemplatesError('');
    };

    const handleTemplateFieldChange = (field, value) => {
        setTemplateDraft((prev) => ({
            ...prev,
            [field]: value
        }));
        setTemplateDirty(true);
    };

    const handleSaveTemplate = async () => {
        if (!selectedTemplateKey) return;
        setEmailTemplatesSaving(true);
        setEmailTemplatesError('');
        try {
            const res = await fetchData(`/api/email-templates/${selectedTemplateKey}`, {
                method: 'PUT',
                body: templateDraft,
            });
            const updatedTemplate = res?.template || null;
            if (updatedTemplate) {
                setEmailTemplates((prev) =>
                    prev.map((item) => (item.key === selectedTemplateKey ? updatedTemplate : item))
                );
                applyTemplateToDraft(updatedTemplate);
            } else {
                setTemplateDirty(false);
            }
        } catch (err) {
            console.error('Failed to save email template', err);
            const details = Array.isArray(err?.details)
                ? err.details.join(', ')
                : (typeof err?.details === 'string' ? err.details : '');
            setEmailTemplatesError(
                details
                    ? `Failed to save template: ${details}`
                    : (err?.error || 'Failed to save template. Please check fields and try again.')
            );
        } finally {
            setEmailTemplatesSaving(false);
        }
    };

    const handleResetTemplate = async () => {
        if (!selectedTemplateKey) return;
        const shouldContinue = window.confirm('Reset this template to default?');
        if (!shouldContinue) return;
        setEmailTemplatesSaving(true);
        setEmailTemplatesError('');
        try {
            const res = await fetchData(`/api/email-templates/${selectedTemplateKey}`, {
                method: 'DELETE',
            });
            const updatedTemplate = res?.template || null;
            if (updatedTemplate) {
                setEmailTemplates((prev) =>
                    prev.map((item) => (item.key === selectedTemplateKey ? updatedTemplate : item))
                );
                applyTemplateToDraft(updatedTemplate);
            } else {
                setTemplateDirty(false);
            }
        } catch (err) {
            console.error('Failed to reset email template', err);
            const details = typeof err?.details === 'string' ? err.details : '';
            setEmailTemplatesError(
                details
                    ? `Failed to reset template: ${details}`
                    : (err?.error || 'Failed to reset template. Please try again.')
            );
        } finally {
            setEmailTemplatesSaving(false);
        }
    };

    const handleToggle = (section, key) => {
        setNotificationPrefs((prev) => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: !prev?.[section]?.[key],
            },
        }));
    };

    const handleSavePrefs = async () => {
        setPrefsSaving(true);
        setPrefsError('');
        try {
            const updated = await fetchData('/api/notification-preferences', {
                method: 'PUT',
                body: notificationPrefs,
            });
            setNotificationPrefs(mergeNotificationPrefs(updated || {}));
        } catch (err) {
            console.error('Failed to save notification preferences', err);
            setPrefsError('Failed to save notification settings. Please try again.');
        } finally {
            setPrefsSaving(false);
        }
    };

    const handleResetPrefs = async () => {
        const resetState = mergeNotificationPrefs(defaultNotificationPrefs);
        setNotificationPrefs(resetState);
        setPrefsSaving(true);
        setPrefsError('');
        try {
            const updated = await fetchData('/api/notification-preferences', {
                method: 'PUT',
                body: resetState,
            });
            setNotificationPrefs(mergeNotificationPrefs(updated || {}));
        } catch (err) {
            console.error('Failed to reset notification preferences', err);
            setPrefsError('Failed to reset notification settings. Please try again.');
        } finally {
            setPrefsSaving(false);
        }
    };

    const applyCookieConsentDecision = (source) => {
        writeCookieConsent({
            preferences: DEFAULT_COOKIE_PREFERENCES,
            source,
        });
        setCookieStatusMsg(source === 'accept_all'
            ? 'Cookie preference saved as Accept All.'
            : 'Cookie preference saved as Reject All.');
        syncCookieConsent();
    };

    const handleResetCookieConsent = () => {
        clearCookieConsent();
        setCookieStatusMsg('Cookie preference reset. Banner will appear again.');
        syncCookieConsent();
    };

    const cookieSourceLabel = (() => {
        if (!cookieConsent?.source) return 'No decision';
        if (cookieConsent.source === 'accept_all') return 'Accept All';
        if (cookieConsent.source === 'reject_all') return 'Reject All';
        if (cookieConsent.source === 'saved_preferences') return 'Saved Preferences';
        return cookieConsent.source;
    })();

    const cookieUpdatedAtLabel = cookieConsent?.updatedAt
        ? new Date(cookieConsent.updatedAt).toLocaleString()
        : 'Not available';

    const renderToggleRow = (option, checked, onChange, isLast) => (
        <Box
            key={option.key}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 2,
                py: 1.2,
                borderBottom: isLast ? 'none' : `1px solid ${theme.palette.divider}`,
            }}
        >
            <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                    {option.title}
                </Typography>
                {option.description && (
                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                        {option.description}
                    </Typography>
                )}
            </Box>
            <Switch
                checked={!!checked}
                onChange={onChange}
                disabled={prefsLoading || prefsSaving}
                sx={{
                    '& .MuiSwitch-switchBase.Mui-checked': {
                        color: theme.palette.primary.main,
                    },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: theme.palette.primary.main,
                        opacity: 1,
                    },
                    '& .MuiSwitch-track': {
                        backgroundColor: alpha(theme.palette.primary.main, 0.2),
                        opacity: 1,
                    },
                }}
            />
        </Box>
    );

    return (
        <Box
            sx={{
                px: { xs: 2, sm: 3, md: 5 },
                pt: { xs: 1, sm: 1.5, md: 2 },
                pb: { xs: 2, sm: 3, md: 5 },
                mx: { xs: 0, sm: "1vw" },
                my: { xs: 0, sm: 0.5 },
                minHeight: "80vh"
            }}
        >
            <Box sx={{}}>
                <Box sx={{ mb: 4, pl: 2, pb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {pageTitle}
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            sx={{ color: theme.palette.text.secondary, fontWeight: 500 }}
                        >
                            {pageSubtitle}
                        </Typography>
                    </Box>
                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5, maxWidth: 720 }}>
                        {pageDescription}
                    </Typography>
                </Box>

                <Card
                    sx={{
                        my: 4,
                        borderRadius: 3,
                        border: `1px solid ${theme.palette.divider}`,
                        background: `linear-gradient(180deg, ${alpha(
                            theme.palette.primary.light,
                            0.18,
                        )} 0%, ${alpha(theme.palette.background.paper, 0.96)} 60%, ${theme.palette.background.paper} 100%)`,
                        boxShadow: `0 20px 40px ${alpha(theme.palette.common.black, 0.1)}`,
                    }}
                >
                    <CardContent>
                        {!hideTabs && (
                            <Tabs
                                value={activeTab}
                                onChange={handleTabChange}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{
                                    mb: 3,
                                    '& .MuiTab-root': {
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        color: theme.palette.text.secondary,
                                    },
                                    '& .Mui-selected': {
                                        color: theme.palette.primary.main,
                                    },
                                    '& .MuiTabs-indicator': {
                                        borderRadius: 2,
                                        bgcolor: theme.palette.primary.main,
                                    },
                                }}
                            >
                                {tabOptions.map((tab) => (
                                    <Tab key={tab.value} label={tab.label} value={tab.value} />
                                ))}
                            </Tabs>
                        )}

                        {activeTab === 'profile' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                    <CardContent>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                            <Avatar
                                                sx={{
                                                    width: 56,
                                                    height: 56,
                                                    bgcolor: alpha(theme.palette.grey[400], 0.2),
                                                    color: theme.palette.text.primary,
                                                    fontWeight: 700,
                                                }}
                                            >
                                                {initials}
                                            </Avatar>
                                            <Box>
                                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                                    {displayName}
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                    Client Admin
                                                </Typography>
                                            </Box>
                                        </Box>

                                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                                            <TextField label="Email" size="small" defaultValue={me.email || ''} />
                                            <TextField label="Phone" size="small" defaultValue={me.phoneNumber || ''} />
                                            <TextField label="Company" size="small" defaultValue={me.companyName || me.clientCompany || ''} />
                                            <TextField label="Location" size="small" defaultValue={me.location || ''} />
                                        </Box>

                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                            <MUIButton variant="contained" color="primary">
                                                Save Changes
                                            </MUIButton>
                                        </Box>
                                    </CardContent>
                                </Card>

                                <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                    <CardContent>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                                            Social Media
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1.5 }}>
                                            <TextField size="small" label="LinkedIn" />
                                            <TextField size="small" label="Instagram" />
                                            <TextField size="small" label="Twitter" />
                                            <TextField size="small" label="Facebook" />
                                        </Box>
                                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                            <MUIButton variant="contained" color="primary">
                                                Save Changes
                                            </MUIButton>
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Box>
                        )}

                        {activeTab === 'archive' && (
                            <Box sx={{ '& .MuiCard-root': { m: 0 } }}>
                                <ArchivedBin />
                            </Box>
                        )}

                        {activeTab === 'notifications' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Notifications
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                        Manage how and when you receive updates.
                                    </Typography>
                                </Box>

                                {prefsError && (
                                    <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                        <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                                            {prefsError}
                                        </Typography>
                                    </Box>
                                )}

                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                                        gap: 2,
                                    }}
                                >
                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                            <CardContent>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                    Notification Channels
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                    Choose how you want to receive important updates.
                                                </Typography>
                                                <Box sx={{ mt: 1.5 }}>
                                                    {notificationChannelOptions.map((option, idx) =>
                                                        renderToggleRow(
                                                            option,
                                                            notificationPrefs.channels[option.key],
                                                            () => handleToggle('channels', option.key),
                                                            idx === notificationChannelOptions.length - 1
                                                        )
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>

                                        <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                            <CardContent>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                    Hiring Activity
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                    Stay updated on key activity in your pipeline.
                                                </Typography>
                                                <Box sx={{ mt: 1.5 }}>
                                                    {hiringActivityOptions.slice(0, 3).map((option, idx, arr) =>
                                                        renderToggleRow(
                                                            option,
                                                            notificationPrefs.hiringActivity[option.key],
                                                            () => handleToggle('hiringActivity', option.key),
                                                            idx === arr.length - 1
                                                        )
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Box>

                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                            <CardContent>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                    Hiring Activity
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                    Control additional hiring notifications.
                                                </Typography>
                                                <Box sx={{ mt: 1.5 }}>
                                                    {hiringActivityOptions.slice(3).map((option, idx, arr) =>
                                                        renderToggleRow(
                                                            option,
                                                            notificationPrefs.hiringActivity[option.key],
                                                            () => handleToggle('hiringActivity', option.key),
                                                            idx === arr.length - 1
                                                        )
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>

                                        <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                            <CardContent>
                                                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                    System & Account
                                                </Typography>
                                                <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                    Stay on top of billing and subscription updates.
                                                </Typography>
                                                <Box sx={{ mt: 1.5 }}>
                                                    {systemAccountOptions.map((option, idx) =>
                                                        renderToggleRow(
                                                            option,
                                                            notificationPrefs.systemAccount[option.key],
                                                            () => handleToggle('systemAccount', option.key),
                                                            idx === systemAccountOptions.length - 1
                                                        )
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </Card>
                                    </Box>
                                </Box>

                                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                                    <MUIButton
                                        variant="outlined"
                                        onClick={handleResetPrefs}
                                        disabled={prefsSaving || prefsLoading}
                                        sx={{
                                            borderColor: alpha(theme.palette.primary.main, 0.45),
                                            color: theme.palette.primary.dark,
                                            '&:hover': { borderColor: theme.palette.primary.main },
                                        }}
                                    >
                                        Reset to Default
                                    </MUIButton>
                                    <MUIButton
                                        variant="contained"
                                        onClick={handleSavePrefs}
                                        disabled={prefsSaving || prefsLoading}
                                        color="primary"
                                    >
                                        {prefsSaving ? 'Saving...' : 'Save Changes'}
                                    </MUIButton>
                                </Stack>
                            </Box>
                        )}

                        {activeTab === 'interviewReminder' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Interview Reminder & Rescheduling
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                        Configure AI reminder calls and candidate rescheduling behaviour.
                                    </Typography>
                                </Box>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <InterviewReminderSettings />
                                </Box>
                            </Box>
                        )}

                        {activeTab === 'cookies' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Cookie Preferences
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                        Manage your cookie consent choices. Essential authentication cookies always remain active.
                                    </Typography>
                                </Box>

                                <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                    <CardContent>
                                        <Stack spacing={2}>
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={cookieConsent ? 'Configured' : 'Not Set'}
                                                    color={cookieConsent ? 'success' : 'default'}
                                                    variant={cookieConsent ? 'filled' : 'outlined'}
                                                />
                                                <Chip
                                                    label={`Decision: ${cookieSourceLabel}`}
                                                    variant="outlined"
                                                />
                                            </Box>

                                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                Last updated: {cookieUpdatedAtLabel}
                                            </Typography>

                                            <Divider />

                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 2,
                                                }}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                        Essential Cookies (Always Active)
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                        Required for login, session security, and core platform functionality.
                                                    </Typography>
                                                </Box>
                                                <Switch checked disabled />
                                            </Box>

                                            {cookieStatusMsg && (
                                                <Typography variant="body2" sx={{ color: theme.palette.success.main }}>
                                                    {cookieStatusMsg}
                                                </Typography>
                                            )}

                                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="flex-end">
                                                <MUIButton
                                                    variant="outlined"
                                                    onClick={handleResetCookieConsent}
                                                    sx={{
                                                        borderColor: alpha(theme.palette.primary.main, 0.45),
                                                        color: theme.palette.primary.dark,
                                                        '&:hover': { borderColor: theme.palette.primary.main },
                                                    }}
                                                >
                                                    Reset Cookies
                                                </MUIButton>
                                                <MUIButton
                                                    variant="outlined"
                                                    onClick={() => applyCookieConsentDecision('reject_all')}
                                                    sx={{
                                                        borderColor: alpha(theme.palette.primary.main, 0.45),
                                                        color: theme.palette.primary.dark,
                                                        '&:hover': { borderColor: theme.palette.primary.main },
                                                    }}
                                                >
                                                    Reject All
                                                </MUIButton>
                                                <MUIButton
                                                    variant="contained"
                                                    color="primary"
                                                    onClick={() => applyCookieConsentDecision('accept_all')}
                                                >
                                                    Accept All
                                                </MUIButton>
                                            </Stack>
                                        </Stack>
                                    </CardContent>
                                </Card>
                            </Box>
                        )}

                        {activeTab === 'emailTemplates' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Email Templates
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                        Customize outgoing email format for this client. Use placeholders like <code>{'{{candidateName}}'}</code>.
                                    </Typography>
                                </Box>

                                {emailTemplatesError && (
                                    <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                        <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                                            {emailTemplatesError}
                                        </Typography>
                                    </Box>
                                )}

                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
                                        gap: 2,
                                    }}
                                >
                                    <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                        <CardContent sx={{ p: 1.5 }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 1, pb: 1 }}>
                                                Templates
                                            </Typography>
                                            <Stack spacing={1}>
                                                {(emailTemplates || []).map((template) => (
                                                    <Box
                                                        key={template.key}
                                                        onClick={() => handleTemplateSelect(template.key)}
                                                        sx={{
                                                            cursor: 'pointer',
                                                            px: 1.2,
                                                            py: 1.1,
                                                            borderRadius: 1.5,
                                                            border: `1px solid ${selectedTemplateKey === template.key
                                                                ? alpha(theme.palette.primary.main, 0.65)
                                                                : theme.palette.divider
                                                                }`,
                                                            bgcolor: selectedTemplateKey === template.key
                                                                ? alpha(theme.palette.primary.main, 0.08)
                                                                : 'transparent',
                                                        }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                                {template.label}
                                                            </Typography>
                                                            <Chip
                                                                size="small"
                                                                label={template.isCustomized ? 'Custom' : 'Default'}
                                                                color={template.isCustomized ? 'primary' : 'default'}
                                                                variant={template.isCustomized ? 'filled' : 'outlined'}
                                                            />
                                                        </Box>
                                                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                            {template.description}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                                {!emailTemplatesLoading && emailTemplates.length === 0 && (
                                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, px: 1 }}>
                                                        No email templates found.
                                                    </Typography>
                                                )}
                                                {emailTemplatesLoading && (
                                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary, px: 1 }}>
                                                        Loading templates...
                                                    </Typography>
                                                )}
                                            </Stack>
                                        </CardContent>
                                    </Card>

                                    <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                        <CardContent>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                                {selectedEmailTemplate?.label || 'Select a template'}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                {selectedEmailTemplate?.description || 'Choose a template from the left panel to edit.'}
                                            </Typography>

                                            {selectedEmailTemplate && (
                                                <>
                                                    <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.8 }}>
                                                        {(selectedEmailTemplate.variables || []).map((token) => (
                                                            <Chip
                                                                key={token}
                                                                size="small"
                                                                label={`{{${token}}}`}
                                                                variant="outlined"
                                                            />
                                                        ))}
                                                    </Box>

                                                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                                                        <TextField
                                                            label="Subject"
                                                            value={templateDraft.subject}
                                                            onChange={(e) => handleTemplateFieldChange('subject', e.target.value)}
                                                            disabled={emailTemplatesLoading || emailTemplatesSaving}
                                                            size="small"
                                                            fullWidth
                                                        />
                                                        <TextField
                                                            label="HTML Body"
                                                            value={templateDraft.html}
                                                            onChange={(e) => handleTemplateFieldChange('html', e.target.value)}
                                                            disabled={emailTemplatesLoading || emailTemplatesSaving}
                                                            multiline
                                                            minRows={12}
                                                            maxRows={24}
                                                            fullWidth
                                                        />
                                                        <TextField
                                                            label="Text Body"
                                                            value={templateDraft.text}
                                                            onChange={(e) => handleTemplateFieldChange('text', e.target.value)}
                                                            disabled={emailTemplatesLoading || emailTemplatesSaving}
                                                            multiline
                                                            minRows={8}
                                                            maxRows={20}
                                                            fullWidth
                                                        />
                                                    </Stack>

                                                    <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2 }}>
                                                        <MUIButton
                                                            variant="outlined"
                                                            onClick={handleResetTemplate}
                                                            disabled={emailTemplatesSaving || emailTemplatesLoading}
                                                            sx={{
                                                                borderColor: alpha(theme.palette.primary.main, 0.45),
                                                                color: theme.palette.primary.dark,
                                                                '&:hover': { borderColor: theme.palette.primary.main },
                                                            }}
                                                        >
                                                            Reset to Default
                                                        </MUIButton>
                                                        <MUIButton
                                                            variant="contained"
                                                            onClick={handleSaveTemplate}
                                                            disabled={
                                                                emailTemplatesSaving ||
                                                                emailTemplatesLoading ||
                                                                !templateDirty
                                                            }
                                                            color="primary"
                                                        >
                                                            {emailTemplatesSaving ? 'Saving...' : 'Save Template'}
                                                        </MUIButton>
                                                    </Stack>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                </Box>
                            </Box>
                        )}

                        {activeTab === 'interviewSecurity' && (
                            <Box sx={{ display: 'grid', gap: 2 }}>
                                <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                        Interview Security
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 0.5 }}>
                                        Control advanced security features for AI interviews. These settings apply to all candidates under your account.
                                    </Typography>
                                </Box>

                                {securityError && (
                                    <Box sx={{ px: { xs: 0.5, md: 1 } }}>
                                        <Typography variant="body2" sx={{ color: theme.palette.error.main }}>
                                            {securityError}
                                        </Typography>
                                    </Box>
                                )}

                                <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                    <CardContent>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                                            Identity & Proctoring
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                            Enable real-time checks to ensure interview integrity.
                                        </Typography>
                                        <Box sx={{ mt: 1.5 }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 2,
                                                    py: 1.2,
                                                    borderBottom: `1px solid ${theme.palette.divider}`,
                                                }}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                                                        Face Detection (Identity Verification)
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                        Candidates upload a photo or video before the interview. Their live camera feed is continuously matched against it to detect impersonation.
                                                    </Typography>
                                                </Box>
                                                <Switch
                                                    checked={!!interviewSecurity.faceDetectionEnabled}
                                                    onChange={() => setInterviewSecurity((prev) => ({ ...prev, faceDetectionEnabled: !prev.faceDetectionEnabled }))}
                                                    disabled={securityLoading || securitySaving}
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': { color: theme.palette.primary.main },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main, opacity: 1 },
                                                        '& .MuiSwitch-track': { backgroundColor: alpha(theme.palette.primary.main, 0.2), opacity: 1 },
                                                    }}
                                                />
                                            </Box>

                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: 2,
                                                    py: 1.2,
                                                }}
                                            >
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Typography variant="body2" sx={{ fontWeight: 600, color: theme.palette.text.primary }}>
                                                        Read Aloud (Communication Assessment)
                                                    </Typography>
                                                    <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                                                        After the AI interview ends, candidates read an AI-generated passage aloud. The recording is saved to assess English fluency and communication skills.
                                                    </Typography>
                                                </Box>
                                                <Switch
                                                    checked={!!interviewSecurity.readingPassageEnabled}
                                                    onChange={() => setInterviewSecurity((prev) => ({ ...prev, readingPassageEnabled: !prev.readingPassageEnabled }))}
                                                    disabled={securityLoading || securitySaving}
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': { color: theme.palette.primary.main },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: theme.palette.primary.main, opacity: 1 },
                                                        '& .MuiSwitch-track': { backgroundColor: alpha(theme.palette.primary.main, 0.2), opacity: 1 },
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </CardContent>
                                </Card>

                                <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                                    <MUIButton
                                        variant="contained"
                                        onClick={handleSaveSecuritySettings}
                                        disabled={securitySaving || securityLoading}
                                        color="primary"
                                    >
                                        {securitySaving ? 'Saving...' : 'Save Changes'}
                                    </MUIButton>
                                </Stack>
                            </Box>
                        )}

                        {activeTab !== 'profile' && activeTab !== 'archive' && activeTab !== 'notifications' && activeTab !== 'emailTemplates' && activeTab !== 'cookies' && activeTab !== 'interviewReminder' && activeTab !== 'interviewSecurity' && (
                            <Card sx={{ borderRadius: 3, border: `1px solid ${theme.palette.divider}` }}>
                                <CardContent>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                        {tabOptions.find((t) => t.value === activeTab)?.label}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: theme.palette.text.secondary, mt: 1 }}>
                                        This section will be available soon.
                                    </Typography>
                                </CardContent>
                            </Card>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
