import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    OutlinedInput,
    DialogContentText
} from '@mui/material';
import MUIButton from '../MUI/commonUI/MUIButton';
import { useUiContextState } from '../../contexts/UiContext';
import { trimFormStrings } from '../../AppUtils/formUtils';
import { loadRecaptchaScript } from './common/reCaptchaUtils';



const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

export default function ForgotPassword({ open, handleClose }) {
    const [currAction, setCurrAction] = useState("getEmail");
    const [prevData, setPrevData] = useState({});
    const [, setUiState] = useUiContextState();
    const recaptchaContainerRef = useRef(null);
    const recaptchaWidgetIdRef = useRef(null);
    const recaptchaResolveRef = useRef(null);
    const recaptchaRejectRef = useRef(null);

    const currSubmitUrl = useMemo(() => {
        switch (currAction) {
            case "getOtp":
                return "/api/auth/password/change/verify/otp/";
            case "getNewPassword":
                return "/api/auth/password/change/new/";
            default:
                return "/api/auth/password/change/send/otp/";
        }
    }, [currAction]);

    const ensureRecaptchaWidget = useCallback(async () => {
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

    const executeRecaptcha = useCallback(async () => {
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

    useEffect(() => {
        if (!RECAPTCHA_SITE_KEY || !open) {
            return;
        }

        ensureRecaptchaWidget().catch((err) => {
            console.log('reCAPTCHA init error:', err?.message || err);
        });
    }, [ensureRecaptchaWidget, open]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setUiState({
            loadingMsg: "Loading, Please wait..."
        });
        const form = new FormData(event.currentTarget);
        let data = Object.fromEntries(form.entries());
        data = trimFormStrings({ ...prevData, ...data });

        try {
            const recaptchaToken = await executeRecaptcha();
            if (!recaptchaToken) {
                throw new Error("ReCaptcha is not verified yet..!");
            }
            data = { ...data, recaptchaToken };

            const res = await fetch(currSubmitUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const result = await res.json();

            const withoutRecaptcha = { ...data };
            delete withoutRecaptcha.recaptchaToken;
            setPrevData(withoutRecaptcha);

            if (result?.action) setCurrAction(result.action);

            if (result?.action === "success") {
                handleClose();
            }
        } catch (err) {
            console.log("Forgot password error:", err?.message || err);
            setCurrAction("getEmail");
        } finally {
            setUiState({
                loadingMsg: null
            });
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            slotProps={{
                paper: {
                    component: "form",
                    onSubmit: handleSubmit,
                    sx: { borderRadius: 3, p: 1, width: "390px", maxWidth: "90%" }
                }
            }}
        >
            <DialogTitle sx={{ fontWeight: 600, textAlign: "center" }}>
                {currAction === "getEmail" && "Reset Password"}
                {currAction === "getOtp" && "Verify OTP"}
                {currAction === "getNewPassword" && "Set New Password"}
            </DialogTitle>

            <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

                {currAction === "getEmail" && (
                    <>
                        <DialogContentText sx={{ textAlign: "center" }}>
                            Enter your registered email and we'll send you a verification code.
                        </DialogContentText>
                        <OutlinedInput
                            name="email"
                            placeholder="Email address"
                            type="email"
                            required
                            fullWidth
                            autoFocus
                        />
                    </>
                )}

                {currAction === "getOtp" && (
                    <>
                        <DialogContentText sx={{ textAlign: "center" }}>
                            We have sent a verification code to your email.
                        </DialogContentText>
                        <OutlinedInput
                            name="otp"
                            placeholder="Enter verification code"
                            required
                            fullWidth
                            autoFocus
                        />
                    </>
                )}

                {currAction === "getNewPassword" && (
                    <>
                        <OutlinedInput
                            name="newPassword"
                            placeholder="New Password"
                            type="password"
                            required
                            fullWidth
                            autoFocus
                        />
                        <OutlinedInput
                            name="confirmPassword"
                            placeholder="Confirm Password"
                            type="password"
                            required
                            fullWidth
                        />
                    </>
                )}

            </DialogContent>

            <div ref={recaptchaContainerRef} style={{ display: 'none' }} />

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <MUIButton sx={{ borderRadius: 1 }} onClick={handleClose}>Cancel</MUIButton>
                <MUIButton sx={{ borderRadius: 1 }} type="submit" variant="contained">
                    {currAction === "getNewPassword" ? "Save Password" : "Continue"}
                </MUIButton>
            </DialogActions>
        </Dialog>
    );
}
