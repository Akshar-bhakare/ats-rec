import * as React from 'react';
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    IconButton,
    InputAdornment,
    Link,
    TextField,
    Typography,
} from '@mui/material';
import MuiCard from '@mui/material/Card';
import { styled, alpha } from '@mui/material/styles';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { useNavigate } from 'react-router-dom';

import ForgotPassword from './ForgotPassword';
import MUICenterLayout from '../MUI/commonUI/MUICenterLayout';
import AnimatedBackground from '../MUI/commonUI/AnimatedBackground';
import { useAuthContextState } from '../../contexts/AuthContext';
import { useUiContextState } from '../../contexts/UiContext';

import LoginLady from '../../assets/Login Leady.gif';
import LoginAnimation from '../../assets/Screening.gif';
import UserIcon from '../../assets/user.png';
import { trimFormStrings } from '../../AppUtils/formUtils';
import { loadRecaptchaScript } from './common/reCaptchaUtils';



const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const Card = styled(MuiCard)(({ theme }) => ({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(4),
    gap: theme.spacing(2),
    borderRadius: 22,
    background: `linear-gradient(160deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(theme.palette.background.paper, 0.82)} 100%)`,
    backdropFilter: 'blur(18px)',
    border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
    width: '100%',
    maxWidth: '520px',
    boxShadow: `0 24px 48px ${alpha(theme.palette.common.black, 0.16)}`,
    opacity: 0,
    animation: 'fadeIn 1.2s ease forwards',
    '@keyframes fadeIn': {
        '0%': { opacity: 0, transform: 'translateY(20px)' },
        '100%': { opacity: 1, transform: 'translateY(0)' }
    },
    [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(3),
        borderRadius: 16,
    }
}));

const AnimationBox = styled(Box)(() => ({
    position: 'absolute',
    pointerEvents: 'none',
    animation: 'float 3.5s ease-in-out infinite',
    '@keyframes float': {
        '0%': { transform: 'translateY(0px)' },
        '50%': { transform: 'translateY(-14px)' },
        '100%': { transform: 'translateY(0px)' }
    }
}));

export default function LoginForm() {
    const [authState, setAuthState] = useAuthContextState();
    const [, setUiState] = useUiContextState();
    const navigate = useNavigate();
    const [openReset, setOpenReset] = React.useState(false);
    const [submitting, setSubmitting] = React.useState(false);
    const [showPassword, setShowPassword] = React.useState(false);
    const recaptchaContainerRef = React.useRef(null);
    const recaptchaWidgetIdRef = React.useRef(null);
    const recaptchaResolveRef = React.useRef(null);
    const recaptchaRejectRef = React.useRef(null);

    const handleCloseReset = () => setOpenReset(false);

    const ensureRecaptchaWidget = React.useCallback(async () => {
        if (!RECAPTCHA_SITE_KEY) {
            throw new Error('reCAPTCHA is not configured.');
        }

        const grecaptcha = await loadRecaptchaScript();
        await new Promise((resolve) => grecaptcha.ready(resolve));

        if (recaptchaWidgetIdRef.current === null) {
            if (!recaptchaContainerRef.current) {
                throw new Error('reCAPTCHA container is unavailable.');
            }

            recaptchaWidgetIdRef.current = grecaptcha.render(recaptchaContainerRef.current, {
                sitekey: RECAPTCHA_SITE_KEY,
                size: 'invisible',
                callback: (token) => {
                    const resolveToken = recaptchaResolveRef.current;
                    recaptchaResolveRef.current = null;
                    recaptchaRejectRef.current = null;
                    resolveToken?.(token);
                },
                'expired-callback': () => {
                    const rejectToken = recaptchaRejectRef.current;
                    recaptchaResolveRef.current = null;
                    recaptchaRejectRef.current = null;
                    rejectToken?.(new Error('reCAPTCHA expired. Please try again.'));
                },
                'error-callback': () => {
                    const rejectToken = recaptchaRejectRef.current;
                    recaptchaResolveRef.current = null;
                    recaptchaRejectRef.current = null;
                    rejectToken?.(new Error('reCAPTCHA failed. Please try again.'));
                },
            });
        }

        return { grecaptcha, widgetId: recaptchaWidgetIdRef.current };
    }, []);

    const executeRecaptcha = React.useCallback(async () => {
        const { grecaptcha, widgetId } = await ensureRecaptchaWidget();

        return new Promise((resolve, reject) => {
            const timeoutId = window.setTimeout(() => {
                if (recaptchaRejectRef.current) {
                    const rejectToken = recaptchaRejectRef.current;
                    recaptchaResolveRef.current = null;
                    recaptchaRejectRef.current = null;
                    rejectToken(new Error('reCAPTCHA verification timed out.'));
                }
            }, 15000);

            recaptchaResolveRef.current = (token) => {
                window.clearTimeout(timeoutId);
                resolve(token);
            };

            recaptchaRejectRef.current = (error) => {
                window.clearTimeout(timeoutId);
                reject(error);
            };

            grecaptcha.reset(widgetId);
            grecaptcha.execute(widgetId);
        });
    }, [ensureRecaptchaWidget]);

    React.useEffect(() => {
        if (!RECAPTCHA_SITE_KEY) {
            return;
        }

        ensureRecaptchaWidget().catch((err) => {
            console.log('reCAPTCHA init error:', err?.message || err);
        });
    }, [ensureRecaptchaWidget]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);

        setUiState({
            loadingMsg: 'Logging you In, Please wait...',
        });

        const formData = new FormData(event.currentTarget);

        try {
            const recaptchaToken = await executeRecaptcha();
            if (!recaptchaToken) {
                throw new Error("ReCaptcha is not verified yet..!");
            }
            const payload = trimFormStrings({
                email: formData.get('email'),
                password: formData.get('password'),
                recaptchaToken,
            });

            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const data = await res.json();
            if (!data?.token) return alert(data?.message || 'Login failed');

            localStorage.setItem('token', data.token);
            setAuthState({ ...data, isAuthenticated: true, booleanSubmitEmail: data?.user?.email });
            // setUiState({ showJourneyResumeModal: true, hideJourneyGuide: false });

            if (['/auth/login/', '/auth/login'].includes(window.location.pathname)) {
                navigate('/dashboard/');
            }
        } catch {
            alert('Something went wrong.');
        } finally {
            setUiState({ loadingMsg: null });
            setSubmitting(false);
        }
    };

    return (
        <MUICenterLayout>
            <AnimatedBackground />

            {authState?.isAuthenticated ? (
                <Box
                    sx={(theme) => ({
                        width: '100%',
                        minHeight: '90vh',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        position: 'relative',
                        background: theme.palette.background.default,
                        overflow: 'hidden',
                        p: { xs: 2, sm: 3, md: 4 }
                    })}
                >
                    <Card variant="outlined" sx={{ textAlign: 'center', p: 5 }}>
                        <Box sx={{ mb: 3 }}>
                            <CheckCircleOutlineIcon 
                                sx={(theme) => ({ 
                                    fontSize: 100, 
                                    color: theme.palette.success.main,
                                    filter: `drop-shadow(0 0 15px ${alpha(theme.palette.success.main, 0.4)})`,
                                    animation: 'bounceIn 0.8s cubic-bezier(0.68, -0.55, 0.265, 1.55)'
                                })} 
                            />
                        </Box>
                        <Typography variant="h4" fontWeight={700} gutterBottom sx={{ mb: 1 }}>
                            Authenticated
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ mb: 4, px: 2 }}>
                            You are already logged in as<br />
                            <Box component="span" sx={{ fontWeight: 800, color: 'text.primary', fontSize: '1.1rem' }}>
                                {authState?.user?.email}
                            </Box>
                        </Typography>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/dashboard/')}
                            sx={(theme) => ({
                                py: 1.2,
                                px: 4,
                                borderRadius: 3,
                                textTransform: 'none',
                                fontWeight: 700,
                                fontSize: '1.05rem',
                                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
                                boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.35)}`,
                                transition: 'all 0.3s ease',
                                '&:hover': {
                                    transform: 'translateY(-2px)',
                                    boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.45)}`,
                                }
                            })}
                        >
                            Visit Dashboard &gt;
                        </Button>
                    </Card>

                    <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes bounceIn {
                            0% { transform: scale(0.3); opacity: 0; }
                            50% { transform: scale(1.05); opacity: 1; }
                            70% { transform: scale(0.9); }
                            100% { transform: scale(1); }
                        }
                    ` }} />
                </Box>
            ) : (
                <Box
                    sx={(theme) => ({
                    width: '100%',
                    minHeight: '90vh',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    position: 'relative',
                    background: theme.palette.background.default,
                    overflow: 'hidden',
                    p: { xs: 2, sm: 3, md: 4 }
                })}
            >
                <AnimationBox
                    sx={{
                        top: 20,
                        left: 20,
                        width: { xs: '0px', md: '240px', lg: '300px' },
                        display: { xs: 'none', md: 'block' },
                        opacity: 0.9
                    }}
                >
                    <Box
                        component="img"
                        src={LoginLady}
                        alt="Login Animation"
                        sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </AnimationBox>

                <Card variant="outlined">
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 0.5, gap: 1 }}>
                        <Box
                            sx={(theme) => ({
                                px: 1.2,
                                py: 0.35,
                                borderRadius: 999,
                                border: `1px solid ${alpha(theme.palette.primary.main, 0.25)}`,
                                backgroundColor: alpha(theme.palette.primary.main, 0.08),
                                color: theme.palette.primary.dark,
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase'
                            })}
                        >
                            Secure Login
                        </Box>
                        <Box
                            component="img"
                            src={UserIcon}
                            alt="User Icon"
                            sx={(theme) => ({
                                width: 76,
                                height: 76,
                                borderRadius: '50%',
                                objectFit: 'cover',
                                border: `4px solid ${alpha(theme.palette.common.white, 0.85)}`,
                                boxShadow: `0 10px 24px ${alpha(theme.palette.common.black, 0.16)}`,
                                backgroundColor: theme.palette.common.white
                            })}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.35, mt: 0.4 }}>
                        <Typography
                            variant="h3"
                            fontWeight={700}
                            textAlign="center"
                            sx={{ fontSize: { xs: '2rem', sm: '2.35rem' }, lineHeight: 1.08 }}
                        >
                            Welcome Back
                        </Typography>
                        <Typography
                            variant="body1"
                            textAlign="center"
                            color="text.secondary"
                            sx={{ lineHeight: 1.2 }}
                        >
                            Sign in to your account
                        </Typography>
                        <Typography
                            variant="caption"
                            textAlign="center"
                            color="text.secondary"
                            sx={{ lineHeight: 1.2 }}
                        >
                            Use your work email to continue
                        </Typography>
                    </Box>

                    <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.2 }}>
                        <FormControl>
                            <FormLabel sx={{ mb: 0.7, fontWeight: 600, color: 'text.primary' }}>Email</FormLabel>
                            <TextField
                                size="small"
                                name="email"
                                type="email"
                                placeholder="you@example.com"
                                required
                                fullWidth
                                sx={(theme) => ({
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: alpha(theme.palette.primary.main, 0.06),
                                    }
                                })}
                            />
                        </FormControl>

                        <FormControl>
                            <FormLabel sx={{ mb: 0.7, fontWeight: 600, color: 'text.primary' }}>Password</FormLabel>
                            <TextField
                                size="small"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                placeholder="********"
                                required
                                fullWidth
                                sx={(theme) => ({
                                    '& .MuiOutlinedInput-root': {
                                        borderRadius: 2,
                                        backgroundColor: alpha(theme.palette.primary.main, 0.06),
                                    }
                                })}
                                InputProps={{
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowPassword(p => !p)}
                                                edge="end"
                                                size="small"
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </FormControl>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, pt: 1.2 }}>
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={submitting}
                                sx={(theme) => ({
                                    minWidth: 128,
                                    py: 1.05,
                                    borderRadius: 2.25,
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    color: theme.palette.common.white,
                                    background: `linear-gradient(120deg, ${theme.palette.primary.dark}, ${theme.palette.primary.main})`,
                                    backgroundSize: '400% 400%',
                                    animation: 'gradientMove 6s ease infinite',
                                    boxShadow: `0 5px 15px ${alpha(theme.palette.common.black, 0.18)}`,
                                    '@keyframes gradientMove': {
                                        '0%': { backgroundPosition: '0% 50%' },
                                        '50%': { backgroundPosition: '100% 50%' },
                                        '100%': { backgroundPosition: '0% 50%' },
                                    },
                                    '&:hover': {
                                        boxShadow: `0 7px 22px ${alpha(theme.palette.common.black, 0.24)}`,
                                        transform: 'translateY(-1px)'
                                    },
                                    '&.Mui-disabled': {
                                        color: alpha(theme.palette.common.white, 0.9),
                                        background: alpha(theme.palette.primary.main, 0.45)
                                    }
                                })}
                            >
                                {submitting ? 'Signing in...' : 'Sign in'}
                            </Button>

                            <Link sx={{ cursor: 'pointer', fontWeight: 600 }} onClick={() => setOpenReset(true)}>
                                Forgot password?
                            </Link>

                            <Box ref={recaptchaContainerRef} sx={{ display: 'none' }} />
                        </Box>
                    </Box>
                </Card>

                <AnimationBox
                    sx={{
                        bottom: 20,
                        right: 20,
                        width: { xs: '0px', md: '280px', lg: '360px' },
                        display: { xs: 'none', md: 'block' },
                        opacity: 0.9
                    }}
                >
                    <Box
                        component="img"
                        src={LoginAnimation}
                        alt="Screening Animation"
                        sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                </AnimationBox>
                </Box>
            )}

            <ForgotPassword open={openReset} handleClose={handleCloseReset} />
        </MUICenterLayout>
    );
}
