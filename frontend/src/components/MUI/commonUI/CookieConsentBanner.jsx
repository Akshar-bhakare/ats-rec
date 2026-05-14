import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Link,
    Paper,
    Stack,
    Switch,
    Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import CookieOutlinedIcon from '@mui/icons-material/CookieOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import { Link as RouterLink } from 'react-router-dom';
import {
    COOKIE_CONSENT_STORAGE_KEY,
    COOKIE_CATEGORIES,
    DEFAULT_COOKIE_PREFERENCES,
    clearCookieConsent,
    normalizeCookiePreferences,
    readCookieConsent,
    writeCookieConsent,
} from '../../../AppUtils/userConsent';

const ALL_COOKIES_ENABLED = Object.freeze({
    [COOKIE_CATEGORIES.ESSENTIAL]: true,
});

const ESSENTIAL_ONLY_CONSENT = Object.freeze({
    [COOKIE_CATEGORIES.ESSENTIAL]: true,
});

export default function CookieConsentBanner() {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const initialConsent = readCookieConsent();

    const [showBanner, setShowBanner] = useState(() => !initialConsent);
    const [manageOpen, setManageOpen] = useState(false);
    const [draftPreferences, setDraftPreferences] = useState(
        () => initialConsent?.preferences || DEFAULT_COOKIE_PREFERENCES,
    );

    const syncConsentState = () => {
        const consent = readCookieConsent();
        if (consent?.preferences) {
            setShowBanner(false);
            setDraftPreferences(consent.preferences);
            return;
        }
        setShowBanner(true);
        setDraftPreferences(DEFAULT_COOKIE_PREFERENCES);
    };

    useEffect(() => {
        const handleStorageChange = (event) => {
            if (!event?.key || event.key === COOKIE_CONSENT_STORAGE_KEY) {
                syncConsentState();
            }
        };
        const handleConsentChange = () => {
            syncConsentState();
        };

        window.addEventListener('storage', handleStorageChange);
        window.addEventListener('aiselekt-cookie-consent-changed', handleConsentChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
            window.removeEventListener('aiselekt-cookie-consent-changed', handleConsentChange);
        };
    }, []);

    const applyConsent = (preferences, source) => {
        const normalized = normalizeCookiePreferences(preferences);
        writeCookieConsent({
            preferences: normalized,
            source,
        });

        setDraftPreferences(normalized);
        setShowBanner(false);
        setManageOpen(false);
    };

    const openManageDialog = () => {
        const existing = readCookieConsent();
        setDraftPreferences(existing?.preferences || DEFAULT_COOKIE_PREFERENCES);
        setManageOpen(true);
    };

    const handleResetCookies = () => {
        clearCookieConsent();
        setManageOpen(false);
    };

    return (
        <>
            {showBanner && (
                <Paper
                    elevation={10}
                    sx={{
                        position: 'fixed',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        transform: 'none',
                        width: '100%',
                        maxWidth: 'none',
                        p: { xs: 1.75, md: 2.25 },
                        borderRadius: 0,
                        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.7 : 0.9)}`,
                        bgcolor: alpha(theme.palette.background.paper, isDark ? 0.96 : 0.98),
                        backdropFilter: 'blur(10px)',
                        zIndex: theme.zIndex.modal + 1,
                    }}
                >
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={{ xs: 1.5, md: 2 }}
                        sx={{ alignItems: { xs: 'flex-start', md: 'center' }, justifyContent: 'space-between' }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.4 }}>
                                <CookieOutlinedIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                    We value your privacy
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6 }}>
                                We only use essential authentication cookies to keep login and session security working.
                                We do not use analytics or marketing cookies.
                                Review our{' '}
                                <Link component={RouterLink} to="/privacypolicy/" underline="hover">
                                    Privacy Policy
                                </Link>{' '}
                                and{' '}
                                <Link component={RouterLink} to="/termscondition/" underline="hover">
                                    Terms and Conditions
                                </Link>
                                .
                            </Typography>
                        </Box>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{ width: { xs: '100%', md: 'auto' } }}
                        >
                            <Button
                                variant="text"
                                color="inherit"
                                onClick={() => applyConsent(ESSENTIAL_ONLY_CONSENT, 'reject_all')}
                                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Reject All
                            </Button>
                            <Button
                                variant="outlined"
                                onClick={openManageDialog}
                                startIcon={<SettingsOutlinedIcon />}
                                sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Manage Cookies
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => applyConsent(ALL_COOKIES_ENABLED, 'accept_all')}
                                sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
                            >
                                Accept All
                            </Button>
                        </Stack>
                    </Stack>
                </Paper>
            )}

            <Dialog
                open={manageOpen}
                onClose={() => setManageOpen(false)}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    Manage Cookie Preferences
                </DialogTitle>
                <DialogContent dividers>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        This site only uses essential authentication cookies. These are required for login, session
                        protection, and secure access.
                    </Typography>

                    <Stack spacing={1.25}>
                        <FormControlLabel
                            control={<Switch checked disabled />}
                            label={
                                <Box>
                                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                        Essential Cookies (Always Active)
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                        Required for authentication, security, and core website operations. Cannot be disabled.
                                    </Typography>
                                </Box>
                            }
                            sx={{ alignItems: 'flex-start', m: 0 }}
                        />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 2, py: 1.5 }}>
                    <Button
                        variant="outlined"
                        color="inherit"
                        onClick={handleResetCookies}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Reset Cookies
                    </Button>
                    <Button
                        variant="text"
                        color="inherit"
                        onClick={() => applyConsent(ESSENTIAL_ONLY_CONSENT, 'reject_all')}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Reject All
                    </Button>
                    <Button
                        variant="text"
                        onClick={() => applyConsent(ALL_COOKIES_ENABLED, 'accept_all')}
                        sx={{ textTransform: 'none', fontWeight: 600 }}
                    >
                        Accept All
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => applyConsent(draftPreferences, 'saved_preferences')}
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                    >
                        Save Preferences
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
