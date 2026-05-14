/**
 * InterviewReminderSettings.jsx
 *
 * Client Admin–only settings panel for the Interview Reminder & Rescheduling feature.
 *
 * Controls:
 *  1. Reminder master toggle       – enable or disable interview reminders
 *  2. Reminder Call toggle         – send AI call 30 min before every interview
 *  3. Reminder Email toggle        – send reminder email 30 min before every interview
 *  4. Auto-Reschedule toggle       – allow AI interviews to be auto-rescheduled
 *  5. Max Reschedule Days input    – how many days from original date the candidate can pick
 *  6. New Link Valid Hours input   – how long the new interview link stays active
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    InputAdornment,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { fetchData } from '../../AppUtils/dataAPI';

// ─────────────────────────────────────────────────────────────
// DEFAULTS
// ─────────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
    reminderEnabled: true,
    reminderCallEnabled: true,
    reminderEmailEnabled: true,
    autoRescheduleEnabled: true,
    maxRescheduleDays: 15,
    newLinkValidHours: 24,
};

// ─────────────────────────────────────────────────────────────
// SETTING ROW  — reusable row with title, description, control
// ─────────────────────────────────────────────────────────────
function SettingRow({ title, description, control, divider = true }) {
    return (
        <>
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                justifyContent="space-between"
                spacing={2}
                sx={{ py: 1.5, px: 0.5 }}
            >
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={600}>
                        {title}
                    </Typography>
                    {description && (
                        <Typography variant="caption" color="text.secondary">
                            {description}
                        </Typography>
                    )}
                </Box>
                <Box sx={{ flexShrink: 0, pt: { xs: 0, sm: 0.25 }, alignSelf: { xs: 'flex-start', sm: 'flex-start' } }}>
                    {control}
                </Box>
            </Stack>
            {divider && <Divider />}
        </>
    );
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────
export default function InterviewReminderSettings() {
    const theme = useTheme();
    const saveTimeoutRef = useRef(null);
    const lastSavedSettingsRef = useRef('');
    const latestSettingsRef = useRef('');
    const hasLoadedSettingsRef = useRef(false);
    const saveRequestIdRef = useRef(0);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const remindersEnabled = Boolean(settings.reminderEnabled);
    const hasReminderChannel = Boolean(settings.reminderCallEnabled || settings.reminderEmailEnabled);
    const canConfigureAutoRescheduling = remindersEnabled && Boolean(settings.reminderCallEnabled);

    // ── Fetch settings on mount ──────────────────────────────
    const fetchSettings = useCallback(() => {
        setLoading(true);
        setError('');
        setSuccessMsg('');

        fetchData('/api/interview-reminders/settings')
            .then((data) => {
                const nextSettings = { ...DEFAULT_SETTINGS, ...(data?.settings || {}) };
                lastSavedSettingsRef.current = JSON.stringify(nextSettings);
                latestSettingsRef.current = JSON.stringify(nextSettings);
                hasLoadedSettingsRef.current = true;
                setSettings(nextSettings);
            })
            .catch((err) => {
                console.error('[InterviewReminderSettings] fetch error:', err);
                setError('Unable to load reminder settings. Please try again.');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    // ── Field change helpers ─────────────────────────────────
    const handleToggle = (field) => (e) => {
        setSettings((prev) => ({ ...prev, [field]: e.target.checked }));
        setSuccessMsg('');
    };

    const handleReminderEnabledToggle = (e) => {
        const checked = e.target.checked;
        setSettings((prev) => ({
            ...prev,
            reminderEnabled: checked,
            ...(checked && !prev.reminderCallEnabled && !prev.reminderEmailEnabled
                ? { reminderCallEnabled: true, reminderEmailEnabled: true }
                : {}),
        }));
        setSuccessMsg('');
    };

    const handleNumber = (field) => (e) => {
        const val = e.target.value;
        setSettings((prev) => ({ ...prev, [field]: val === '' ? '' : Number(val) }));
        setSuccessMsg('');
    };

    // ── Validation ───────────────────────────────────────────
    const validate = useCallback((nextSettings) => {
        if (nextSettings.reminderEnabled && !nextSettings.reminderCallEnabled && !nextSettings.reminderEmailEnabled) {
            return 'Enable at least one reminder option: Call or Email.';
        }

        const days = Number(nextSettings.maxRescheduleDays);
        if (Number.isNaN(days) || days < 1 || days > 90) {
            return 'Max Reschedule Days must be between 1 and 90.';
        }
        const hrs = Number(nextSettings.newLinkValidHours);
        if (Number.isNaN(hrs) || hrs < 1) {
            return 'New Link Valid Hours must be at least 1.';
        }
        return null;
    }, []);

    const saveSettings = useCallback((nextSettings) => {
        const requestId = ++saveRequestIdRef.current;
        const serializedSettings = JSON.stringify(nextSettings);
        setSaving(true);
        setError('');
        setSuccessMsg('');

        fetchData('/api/interview-reminders/settings', {
            method: 'PUT',
            body: serializedSettings,
        })
            .then(() => {
                if (requestId !== saveRequestIdRef.current) {
                    return;
                }
                lastSavedSettingsRef.current = serializedSettings;
                if (latestSettingsRef.current === serializedSettings) {
                    setSuccessMsg('Reminder settings saved successfully.');
                }
            })
            .catch((err) => {
                if (requestId !== saveRequestIdRef.current) {
                    return;
                }
                console.error('[InterviewReminderSettings] save error:', err);
                setError('Failed to save settings. Please try again.');
            })
            .finally(() => {
                if (requestId === saveRequestIdRef.current) {
                    setSaving(false);
                }
            });
    }, []);

    useEffect(() => {
        if (!hasLoadedSettingsRef.current) {
            return undefined;
        }

        const serializedSettings = JSON.stringify(settings);
        latestSettingsRef.current = serializedSettings;
        if (serializedSettings === lastSavedSettingsRef.current) {
            return undefined;
        }

        const validationError = validate(settings);
        if (validationError) {
            setError(validationError);
            setSuccessMsg('');
            return undefined;
        }

        setError('');
        setSuccessMsg('');

        saveTimeoutRef.current = setTimeout(() => {
            saveSettings(settings);
        }, 350);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
        };
    }, [settings, saveSettings, validate]);

    // ─────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <Box display="flex" justifyContent="center" py={6}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    return (
        <Stack spacing={3}>

            {/* ── Reminder Call Section ──────────────────────── */}
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                        📞 Pre-Interview Reminder
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                        30 minutes before each scheduled interview the system can send:
                        <br />
                        &nbsp;&nbsp;• <strong>Call</strong> — AI phone call to the candidate
                        <br />
                        &nbsp;&nbsp;• <strong>Email</strong> — reminder email with the interview link
                        <br />
                        Applies to AI-only, Human-only, and AI + Human interviews.
                    </Typography>

                    <SettingRow
                        title="Enable Interview Reminders"
                        description="Turn reminder communication on or off for scheduled interviews. You can choose call, email, or both below."
                        control={
                            <Switch
                                checked={remindersEnabled}
                                onChange={handleReminderEnabledToggle}
                                color="primary"
                                size="small"
                            />
                        }
                    />

                    <Box
                        sx={{
                            mt: 1,
                            ml: { xs: 0, sm: 1 },
                            p: 2,
                            borderRadius: 2,
                            border: `1px solid ${theme.palette.divider}`,
                            bgcolor: alpha(theme.palette.primary.light, remindersEnabled ? 0.06 : 0.03),
                            opacity: remindersEnabled ? 1 : 0.6,
                        }}
                    >
                        <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 0.6 }}>
                            Reminder Delivery Channels
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                            Choose how candidates receive reminders when interview reminders are enabled.
                        </Typography>

                        <SettingRow
                            title="Call Reminders"
                            description="Send an AI call to candidates 30 minutes before every scheduled interview."
                            control={
                                <Switch
                                    checked={Boolean(settings.reminderCallEnabled)}
                                    onChange={handleToggle('reminderCallEnabled')}
                                    color="primary"
                                    size="small"
                                    disabled={!remindersEnabled}
                                />
                            }
                        />

                        <SettingRow
                            title="Email Reminders"
                            description="Send a reminder email with the interview link 30 minutes before every scheduled interview."
                            control={
                                <Switch
                                    checked={Boolean(settings.reminderEmailEnabled)}
                                    onChange={handleToggle('reminderEmailEnabled')}
                                    color="primary"
                                    size="small"
                                    disabled={!remindersEnabled}
                                />
                            }
                            divider={false}
                        />

                        {!remindersEnabled && (
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                                Turn on interview reminders to choose call and email delivery options.
                            </Typography>
                        )}

                        {remindersEnabled && !hasReminderChannel && (
                            <Typography variant="caption" color="error.main" display="block" sx={{ mt: 1, fontWeight: 600 }}>
                                Select at least one delivery option: Call or Email.
                            </Typography>
                        )}
                    </Box>
                </CardContent>
            </Card>

            {/* ── Auto-Reschedule Section ────────────────────── */}
            <Box sx={{ position: 'relative', borderRadius: 2 }}>
                <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                        <Typography variant="subtitle1" fontWeight={700} mb={0.5}>
                            🔄 Auto-Rescheduling (AI Interviews Only)
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                            When a candidate requests rescheduling during an AI-only reminder call,
                            the system can automatically expire the current link and send a new one.
                            For Human or AI + Human interviews, the recruiter is notified by email instead.
                        </Typography>

                        <SettingRow
                            title="Enable Auto-Rescheduling"
                            description="Allow AI-only interviews to be automatically rescheduled when candidates request it."
                            control={
                                <Switch
                                    checked={Boolean(settings.autoRescheduleEnabled)}
                                    onChange={handleToggle('autoRescheduleEnabled')}
                                    color="primary"
                                    size="small"
                                    disabled={!canConfigureAutoRescheduling}
                                />
                            }
                        />

                        {/* Max Reschedule Days */}
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                            justifyContent="space-between"
                            spacing={2}
                            sx={{ py: 1.5, px: 0.5 }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    Maximum Reschedule Window
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    Candidates can only reschedule within this many days from the original
                                    interview date. Default is 15 days. Maximum allowed is 90 days.
                                </Typography>
                            </Box>
                            <TextField
                                type="number"
                                size="small"
                                value={settings.maxRescheduleDays}
                                onChange={handleNumber('maxRescheduleDays')}
                                disabled={!canConfigureAutoRescheduling || !settings.autoRescheduleEnabled}
                                inputProps={{ min: 1, max: 90 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Typography variant="caption" color="text.secondary">days</Typography>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ width: { xs: '100%', sm: 120 } }}
                            />
                        </Stack>

                        <Divider />

                        {/* New Link Valid Hours */}
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            alignItems={{ xs: 'stretch', sm: 'flex-start' }}
                            justifyContent="space-between"
                            spacing={2}
                            sx={{ py: 1.5, px: 0.5 }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    New Link Validity
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    How long the newly generated interview link remains valid after
                                    rescheduling. Default is 24 hours.
                                </Typography>
                            </Box>
                            <TextField
                                type="number"
                                size="small"
                                value={settings.newLinkValidHours}
                                onChange={handleNumber('newLinkValidHours')}
                                disabled={!canConfigureAutoRescheduling || !settings.autoRescheduleEnabled}
                                inputProps={{ min: 1 }}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Typography variant="caption" color="text.secondary">hours</Typography>
                                        </InputAdornment>
                                    ),
                                }}
                                sx={{ width: { xs: '100%', sm: 120 } }}
                            />
                        </Stack>
                    </CardContent>
                </Card>

                {/* Freeze overlay — shown when auto-rescheduling cannot be used */}
                {!canConfigureAutoRescheduling && (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            borderRadius: 2,
                            backdropFilter: 'blur(3px)',
                            backgroundColor: alpha(theme.palette.background.paper, 0.55),
                            zIndex: 1,
                            pointerEvents: 'all',
                            cursor: 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Typography
                            variant="caption"
                            fontWeight={600}
                            color="text.secondary"
                            sx={{
                                bgcolor: alpha(theme.palette.background.paper, 0.85),
                                px: 1.5,
                                py: 0.5,
                                borderRadius: 1,
                                border: `1px solid ${theme.palette.divider}`,
                            }}
                        >
                            {remindersEnabled
                                ? 'Enable reminder calls to configure auto-rescheduling'
                                : 'Enable interview reminders to configure auto-rescheduling'}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* ── Human/AI+Human Note ───────────────────────── */}
            <Card
                variant="outlined"
                sx={{
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.warning.light, 0.08),
                    borderColor: theme.palette.warning.light,
                }}
            >
                <CardContent>
                    <Typography variant="subtitle2" fontWeight={700} color="warning.dark" mb={0.5}>
                        ℹ️ Human & AI + Human Interviews
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Auto-rescheduling is <strong>not available</strong> for Human-only or AI + Human
                        interviews because the interviewer's calendar may already be booked.
                        If a candidate requests rescheduling during the reminder call, an email
                        notification will be sent to the recruiter, who will then contact the
                        candidate manually to arrange a new time.
                    </Typography>
                </CardContent>
            </Card>

            {/* ── Status messages ───────────────────────────── */}
            {error && (
                <Typography variant="body2" color="error">
                    {error}
                </Typography>
            )}
            {saving && (
                <Typography variant="body2" color="text.secondary">
                    Saving changes...
                </Typography>
            )}
            {successMsg && (
                <Typography variant="body2" color="success.main">
                    {successMsg}
                </Typography>
            )}
        </Stack>
    );
}
