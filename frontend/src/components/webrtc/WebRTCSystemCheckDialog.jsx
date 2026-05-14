import React from "react";
import {
    Dialog,
    DialogContent,
    Typography,
    Divider,
    Checkbox,
    FormControlLabel,
    Button,
    Box
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import MUIButton from "../MUI/commonUI/MUIButton";

const MEMORY_THRESHOLD_GB = 1;

const getCheckStatus = (value) => {
    if (value === true) return { label: "Pass", tone: "success" };
    if (value === false) return { label: "Fail", tone: "error" };
    if (value === "unavailable") {
        return { label: "Unavailable", tone: "muted" };
    }
    return { label: "Not checked", tone: "muted" };
};

const getMemoryStatus = (value) => {
    if (typeof value === "number" && Number.isFinite(value)) {
        const label = `${value} GB`;
        const ok = value >= MEMORY_THRESHOLD_GB;
        return { label, tone: ok ? "success" : "error", ok };
    }
    if (value === "unavailable") {
        return { label: "Unavailable", tone: "muted", ok: true };
    }
    return { label: "Not checked", tone: "muted", ok: false };
};

const computeSystemCheckOk = (results = {}) => {
    const isDeviceMemoryOk = (() => {
        const value = results.memory;
        if (typeof value !== "number" || !Number.isFinite(value)) return true;
        return value >= MEMORY_THRESHOLD_GB;
    })();

    const isTabMemoryOk = (() => {
        const value = results.tabMemory;
        if (typeof value !== "number" || !Number.isFinite(value)) return true;
        return value >= MEMORY_THRESHOLD_GB;
    })();

    const requiredChecks = ["browser", "secure", "devices", "permissions", "cameraActive", "micActive"].every(
        (key) => results[key] === true
    );

    return requiredChecks && isDeviceMemoryOk && isTabMemoryOk;
};

export default function WebRTCSystemCheckDialog({
    open,
    results,
    consentChecked,
    onConsentChange,
    errorMessage,
    running,
    attempted,
    onRunCheck,
    onContinue,
    previewStream,
    micLevel,
    isXs
}) {
    const theme = useTheme();
    const systemCheckOk = computeSystemCheckOk(results);
    const toneColor = {
        success: theme.palette.success.main,
        error: theme.palette.error.main,
        warning: theme.palette.warning.main,
        muted: theme.palette.text.secondary
    };
    const checkItems = [
        { label: "Browser supports WebRTC", key: "browser", kind: "check" },
        { label: "Secure context (HTTPS/localhost)", key: "secure", kind: "check" },
        { label: "Camera & microphone detected", key: "devices", kind: "check" },
        { label: "Camera & microphone permissions", key: "permissions", kind: "check" },
        { label: "Camera preview active", key: "cameraActive", kind: "check" },
        { label: "Microphone detects input", key: "micActive", kind: "check" },
        { label: "Chrome Tab memory (approx)", key: "tabMemory", kind: "memory" },
        { label: "Device memory (approx)", key: "memory", kind: "memory" }
    ];
    const videoRef = React.useRef(null);

    React.useEffect(() => {
        const videoEl = videoRef.current;
        if (!videoEl) return;
        if (previewStream) {
            try {
                videoEl.srcObject = previewStream;
                const playPromise = videoEl.play();
                if (playPromise && typeof playPromise.catch === "function") {
                    playPromise.catch(() => { });
                }
            // eslint-disable-next-line no-unused-vars
            } catch (err) {
                // ignore
            }
        } else {
            try {
                videoEl.srcObject = null;
            // eslint-disable-next-line no-unused-vars
            } catch (err) {
                // ignore
            }
        }
    }, [previewStream]);

    const micPercent = Math.round(Math.min(1, Math.max(0, micLevel || 0)) * 100);

    return (
        <Dialog
            open={open}
            onClose={() => { }}
            disableEscapeKeyDown
            PaperProps={{
                sx: {
                    borderRadius: "16px",
                    padding: "6px",
                    minWidth: isXs ? "92vw" : "460px",
                    maxWidth: "92vw"
                }
            }}
        >
            <DialogContent sx={{ padding: "24px 22px" }}>
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 2
                    }}
                >
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        System Check
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Please run the system check to ensure your camera, microphone, and browser are ready for the interview.
                    </Typography>
                    <Box
                        sx={{
                            display: "grid",
                            gridTemplateColumns: isXs ? "1fr" : "200px 1fr",
                            gap: 2,
                            mt: 1,
                            alignItems: "stretch"
                        }}
                    >
                        <Box
                            sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: "12px",
                                overflow: "hidden",
                                backgroundColor: "background.default",
                                height: isXs ? 160 : 130,
                                position: "relative"
                            }}
                        >
                            <video
                                ref={videoRef}
                                muted
                                playsInline
                                autoPlay
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "cover",
                                    transform: "scaleX(-1)",
                                    WebkitTransform: "scaleX(-1)"
                                }}
                            />
                            {!previewStream && (
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: 0,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        color: "text.secondary",
                                        fontSize: "0.8rem",
                                        textAlign: "center",
                                        px: 2
                                    }}
                                >
                                    Camera preview will appear here after running the check.
                                </Box>
                            )}
                        </Box>
                        <Box
                            sx={{
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: "12px",
                                p: 2,
                                display: "flex",
                                flexDirection: "column",
                                gap: 1
                            }}
                        >
                            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                Microphone Test
                            </Typography>
                            <Typography variant="body2" sx={{ color: "text.secondary" }}>
                                Speak for a few seconds. The meter should move when your mic is working.
                            </Typography>
                            <Box
                                sx={{
                                    height: 10,
                                    width: "100%",
                                    borderRadius: 999,
                                    backgroundColor: "action.hover",
                                    overflow: "hidden"
                                }}
                            >
                                <Box
                                    sx={{
                                        height: "100%",
                                        width: `${micPercent}%`,
                                        transition: "width 120ms linear",
                                        backgroundColor: micPercent > 30 ? "success.main" : "warning.main"
                                    }}
                                />
                            </Box>
                            <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Level: {micPercent}%
                            </Typography>
                            {!results?.micActive && attempted && (
                                <Typography variant="caption" sx={{ color: "error.main" }}>
                                    Please speak so we can detect your microphone.
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Divider />
                    <ul className="webrtc-consent-list" style={{ margin: 0 }}>
                        {checkItems.map((item) => {
                            const status =
                                item.kind === "memory"
                                    ? getMemoryStatus(results?.[item.key])
                                    : getCheckStatus(results?.[item.key]);
                            return (
                                <li key={item.key} style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span>{item.label}</span>
                                    <span style={{ color: toneColor[status.tone] || theme.palette.text.secondary, fontWeight: 600 }}>
                                        {status.label}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={consentChecked}
                                onChange={(e) => onConsentChange(e.target.checked)}
                            />
                        }
                        label="I allow the system check to access my camera and microphone."
                    />
                    {errorMessage ? (
                        <Typography variant="body2" sx={{ color: "error.main" }}>
                            {errorMessage}
                        </Typography>
                    ) : null}
                    <Box sx={{ display: "flex", gap: 1.5, justifyContent: "flex-end" }}>
                        <MUIButton
                            variant="outlined"
                            onClick={onRunCheck}
                            disabled={running || !consentChecked}
                            sx={{ textTransform: "none", fontWeight: 600, borderRadius: "10px" }}
                        >
                            {running ? "Checking..." : "Run System Check"}
                        </MUIButton>
                        <MUIButton
                            variant="contained"
                            onClick={() => {
                                if (!systemCheckOk) return;
                                onContinue();
                            }}
                            disabled={!systemCheckOk || running || !attempted}
                            sx={{
                                textTransform: "none",
                                fontWeight: 600,
                                borderRadius: "10px",
                                "&.Mui-disabled": {
                                    color: theme.palette.action.disabled,
                                    opacity: 0.7
                                }
                            }}
                        >
                            Continue
                        </MUIButton >
                    </Box>
                </Box>
            </DialogContent>
        </Dialog>
    );
}
