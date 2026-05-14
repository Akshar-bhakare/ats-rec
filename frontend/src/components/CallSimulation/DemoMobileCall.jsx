/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useCallback } from "react";
import {
    Avatar,
    Box,
    CircularProgress,
    Container,
    Divider,
    IconButton,
    Stack,
    Typography,
    useTheme,
} from "@mui/material";
import { alpha, border } from "@mui/system";
import { Mic, MicOff, CallEnd, Call, SupportAgentRounded } from "@mui/icons-material";
import MUIButton from "../MUI/commonUI/MUIButton";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";

import MUIModal from "../MUI/commonUI/MUIModal";
import MUILoadingIcon from "../MUI/commonUI/MUILoadingIcon";
import { fetchData } from "../../AppUtils/dataAPI";
import { useCallSimulationContextState } from "../../contexts/CallSimulationContext";
import { useUiContextState } from "../../contexts/UiContext";
import DemoLeadForm from "../LeadCapturing/DemoLeadForm";



const formatClockTime = (timestamp) => {
    if (!timestamp) return "";
    const dateObj = new Date(timestamp);
    if (Number.isNaN(dateObj.getTime())) return "";
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const seconds = dateObj.getSeconds();
    const meridiem = hours >= 12 ? "pm" : "am";
    hours = hours % 12 || 12;
    const minutesPadded = minutes < 10 ? `0${minutes}` : minutes;
    return `${hours}:${minutesPadded}:${seconds} ${meridiem}`;
};

export default function CallScreenMobile({
    status: callStatus,
    triggerCall,
    onEnd,
    onToggleMute,
    speaking = false,
    playing = false,
    jobId,
    setJobId,
    candidateId,
    callUUID,
    candidateFirstName,
    setCandidateFirstName,
}) {
    const theme = useTheme();
    const isProduction = (window?.location?.origin
        ?.toLowerCase?.()
        ?.includes?.("aiselekt.com") || window?.location?.origin
            ?.toLowerCase?.()
            ?.includes?.("hirexit.ai"));
    const [gState, setGState] = useCallSimulationContextState();
    const [, setUiState] = useUiContextState();
    const setAiCallDemoSeconds = (val) =>
        setGState(
            typeof val === "function"
                ? (prev) => ({ aiCallDemoSeconds: val?.(prev?.aiCallDemoSeconds || 0) })
                : { aiCallDemoSeconds: val }
        );
    const setAiCallDemoMuted = (val) => setGState({ aiCallDemoMuted: val });

    const [callBtnState, setCallBtnState] = useState(0);
    const [opts, setOpts] = useState([
        {
            label: "FullStack Developer",
            value: isProduction ? "6927469930c53179d1444afa" : "69275dfb91a7281165e6d268",
        },
        {
            label: "HR Manager",
            value: isProduction ? "692747d730c53179d1444b2b" : "69275f2ece85fcf258c76ac4",
        },
    ]);

    const [updateInProgress, setUpdateInProgress] = useState(false);
    const [currConv, setCurrConv] = useState();

    const isDark = theme.palette.mode === "dark";
    const baseSurface = isDark ? theme.palette.background.paper : theme.palette.common.white;

    // richer glassy background
    const glassBg = `
      radial-gradient(circle at 10% 0%, ${alpha(
        theme.palette.primary.main,
        isDark ? 0.3 : 0.22
    )}, transparent 55%),
      radial-gradient(circle at 90% 100%, ${alpha(
        (theme.palette.secondary && theme.palette.secondary.main) || theme.palette.primary.light,
        isDark ? 0.3 : 0.22
    )}, transparent 55%),
      linear-gradient(
        160deg,
        ${alpha(baseSurface, isDark ? 0.96 : 0.98)},
        ${alpha(theme.palette.background.default, isDark ? 0.85 : 0.9)}
      )
    `;
    const glassBorder = `1px solid ${alpha(theme.palette.common.white, isDark ? 0.16 : 0.35)}`;
    const glassShadow = isDark
        ? `0 18px 55px ${alpha(
            theme.palette.common.black,
            0.75
        )}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.08)}`
        : `0 22px 60px ${alpha(
            theme.palette.common.black,
            0.2
        )}, 0 0 0 1px ${alpha(theme.palette.common.white, 0.6)}`;

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const WaveBar = ({ delay }) => (
        <Box
            sx={{
                width: 4,
                height: 32,
                borderRadius: 999,
                transformOrigin: "bottom",
                background:
                    speaking || playing
                        ? "linear-gradient(180deg, #22d3ee, #4ade80)"
                        : "rgba(148,163,184,0.5)",
                opacity: speaking || playing ? 1 : 0.5,
                boxShadow:
                    speaking || playing
                        ? "0 0 16px rgba(45,212,191,0.5)"
                        : "none",
                animation:
                    speaking || playing
                        ? `wave 1s ease-in-out ${delay}s infinite`
                        : "none",
            }}
        />
    );

    const getConvData = useCallback(async (modalFor = "Transcript") => {
        if (!currConv) {
            setUiState({
                loadingMsg: "Loading " + modalFor + " data, Please wait...",
            });
            try {
                const list = await fetchData(
                    `/api/conversations/demo/?candidateId=${candidateId}&jobId=${jobId}&callUUID=${callUUID}`
                );
                const finalData =
                    modalFor === "Transcript"
                        ? (list[0].messages || []).filter((message) => message.role !== "system")
                        : list[0].audio_url;
                setCurrConv({ modalFor, content: finalData });
            } finally {
                setUiState({ loadingMsg: null });
            }
        }
    }, [callUUID, candidateId, currConv, jobId, setUiState]);

    const downloadTracker = useCallback(async () => {
        if (!candidateId || !jobId) return;
        const safeTitle = opts?.find?.((val) => val.value === jobId)?.label?.trim?.() || jobId;
        try {
            setUiState({ loadingMsg: "Preparing tracker, Please wait..." });
            const excelBlob = await fetchData(
                `/api/candidates/tracker/demo/?ids=${candidateId}&jobId=${jobId}&callUUID=${callUUID}&candidateFirstName=${candidateFirstName}&jobTitle=${safeTitle}`,
                {
                    method: "GET",
                    headers: {
                        Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    },
                }
            );
            const url = URL.createObjectURL(excelBlob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `${candidateFirstName}___${safeTitle}___tracker.xlsx`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("[Call Simulation] Tracker download failed: ", err);
            alert("Could not download tracker...");
        } finally {
            setUiState({ loadingMsg: null });
        }
    }, [callUUID, candidateFirstName, candidateId, jobId, opts, setUiState]);

    const onModalClose = () => {
        setCurrConv(null);
    };

    useEffect(() => {
        let timer;
        if (callStatus === "in-call") {
            timer = setInterval(() => setAiCallDemoSeconds((s) => s + 1), 1000);
        } else {
            gState?.aiCallDemoSeconds !== 0 && setAiCallDemoSeconds(0);
            (gState?.aiCallDemoSeconds === 0 || callStatus === "AI Call") && setAiCallDemoMuted(false);

            if (callStatus === "ended") {
                setUpdateInProgress(true);
                setTimeout(() => {
                    setUpdateInProgress(false);
                }, 5_000);
                setCallBtnState(0);
            }
        }
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [callStatus]);

    useEffect(() => {
        if (!opts && !isProduction) {
            setUiState({
                loadingMsg: "Loading data, Please wait...",
            });

            fetchData("/api/candidates/" + candidateId)
                .then((candRes) => {
                    fetchData(
                        "/api/jobs/?fields=_id,title,internalTitle&ids=" + (candRes?.jobs || []).join(",")
                    )
                        .then((res) => {
                            let resOpts = res?.map?.((ele) => ({
                                label: `${ele.title}`,
                                value: `${ele._id}`,
                            }));

                            if (
                                (resOpts || [])?.length > 0 &&
                                !(resOpts || [])?.map((ele) => ele?.value).includes(jobId)
                            ) {
                                setJobId(resOpts?.[0]?.value);
                            }

                            setOpts(resOpts);
                        })
                        .catch((err) => {
                            console.error("[Call Simulation] Error in getting jobs: ", err);
                        })
                        .finally(() => {
                            setUiState({
                                loadingMsg: null,
                            });
                        });
                })
                .catch((err) => console.error("[Call Simulation] Error in getting candidates: ", err))
                .finally(() => {
                    setUiState({
                        loadingMsg: null,
                    });
                });
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getAssistantStateText = () => {
        if (callStatus === "connecting") return "Connecting to assistant...";
        if (callStatus === "in-call" && speaking) return "Assistant is speaking";
        if (callStatus === "in-call" && gState.aiCallDemoMuted) return "You are muted";
        if (callStatus === "in-call") return "Listening to candidate";
        if (callStatus === "ended") return "Call summary available";
        return "Ready for an AI voice demo";
    };

    const getStatusChipStyles = () => {
        const shared = {
            border: `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
            background: alpha(theme.palette.primary.main, 0.12),
            color: theme.palette.primary.contrastText,
            label: "AI READY",
        };

        switch (callStatus) {
            case "AI Call":
                return {
                    ...shared,
                    label: "AI CALL DEMO",
                };
            case "connecting":
                return {
                    label: "CONNECTING",
                    border: `1px solid ${alpha(theme.palette.warning.light, 0.6)}`,
                    background: alpha(theme.palette.warning.main, 0.2),
                    color: theme.palette.warning.contrastText || theme.palette.common.black,
                };
            case "in-call":
                return {
                    label: "LIVE CALL",
                    border: `1px solid ${alpha(theme.palette.success.light, 0.6)}`,
                    background: alpha(theme.palette.success.main, 0.25),
                    color: theme.palette.success.contrastText || theme.palette.common.white,
                };
            case "ended":
                return {
                    label: "CALL ENDED",
                    border: `1px solid ${alpha(theme.palette.error.light, 0.6)}`,
                    background: alpha(theme.palette.error.main, 0.2),
                    color: theme.palette.error.contrastText || theme.palette.common.white,
                };
            default:
                return shared;
        }
    };

    const statusChipStyles = getStatusChipStyles();
    const assistantStateText = getAssistantStateText();
    const callDuration = formatTime(gState.aiCallDemoSeconds || 0);
    const canStartCall = ["AI Call", "ended"].includes(callStatus);
    const jobLabel = opts?.find?.((ele) => ele.value === `${jobId}`)?.label;
    const phoneTopLabel = (() => {
        if (callStatus === "in-call") return callDuration;
        if (callStatus === "connecting") return "Connecting...";
        if (callStatus === "ended") return "Summary ready";
        return "Hirex REC";
    })();

    return (
        <>
            <Box
                sx={{
                    position: "relative",
                    borderRadius: 5,
                    p: { xs: 3, sm: 3.5 },
                    background: glassBg,
                    border: glassBorder,
                    boxShadow: glassShadow,
                    backdropFilter: "blur(20px)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: { xs: 1.5, md: 2 },
                    width: { xs: 290, sm: 310, md: 330 },
                    height: { xs: 540, sm: 560, md: 580 },
                    overflow: "hidden",
                    "&::before": {
                        content: '""',
                        position: "absolute",
                        inset: 0,
                        borderRadius: "inherit",
                        background:
                            "radial-gradient(circle at 20% 0%, rgba(255,255,255,0.24), transparent 55%)",
                        opacity: isDark ? 0.4 : 0.55,
                        pointerEvents: "none",
                    },
                    "& > *": {
                        position: "relative",
                        zIndex: 1,
                    },
                }}
            >
                {/* top bar */}
                <Box
                    sx={{
                        width: "100%",
                        display: "flex",
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Typography
                        variant="caption"
                        sx={{
                            fontSize: "0.7rem",
                            letterSpacing: "0.16em",
                            textTransform: "uppercase",
                            color: alpha(theme.palette.text.primary, 0.8),
                        }}
                    >
                        {phoneTopLabel}
                    </Typography>
                    <Stack direction="row" spacing={0.6}>
                        <Box
                            sx={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: "#22c55e",
                                boxShadow: "0 0 6px rgba(34,197,94,0.65)",
                            }}
                        />
                        <Box
                            sx={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: "#facc15",
                                boxShadow: "0 0 6px rgba(250,204,21,0.65)",
                            }}
                        />
                        <Box
                            sx={{
                                width: 9,
                                height: 9,
                                borderRadius: "50%",
                                bgcolor: "#f97373",
                                boxShadow: "0 0 6px rgba(248,113,113,0.7)",
                            }}
                        />
                    </Stack>
                </Box>

                {[1, 2].includes(callBtnState) ? (
                    <DemoLeadForm
                        callBtnState={callBtnState}
                        setSubmitBtnState={setCallBtnState}
                        setCandidateFirstName={setCandidateFirstName}
                        onSuccess={(email) => { triggerCall(email); setCallBtnState(3); }}
                        boxSx={{
                            height: { xs: 300, sm: 340, md: 360 },
                        }}
                    />
                ) : (
                    <>
                        <Stack alignItems="center" spacing={1.4} sx={{ mt: 4 }}>
                            <Avatar
                                sx={{
                                    width: 86,
                                    height: 86,
                                    background: `radial-gradient(circle at 30% 0%, ${theme.palette.primary.light}, ${theme.palette.primary.main})`,
                                    boxShadow: `0 12px 28px ${alpha(
                                        theme.palette.common.black,
                                        0.18
                                    )}`,
                                    animation:
                                        speaking || playing
                                            ? "pulseGlow 2.2s ease-out infinite"
                                            : "none",
                                    border: "3px solid rgba(255,255,255,0.65)",
                                }}
                            >
                                {gState.aiCallDemoMuted ? <MicOff /> : <SupportAgentRounded />}
                            </Avatar>
                            <Typography
                                variant="subtitle1"
                                sx={{ fontWeight: 700, textAlign: "center", fontSize: "1.05rem" }}
                            >
                                {candidateFirstName || "Layla"}
                            </Typography>
                            {jobLabel && (
                                <Typography variant="body2" color="text.secondary">
                                    for <b>{jobLabel}</b>
                                </Typography>
                            )}
                            <Box
                                sx={{
                                    mt: 1.4,
                                    px: 2.4,
                                    py: 0.6,
                                    borderRadius: 999,
                                    textTransform: "uppercase",
                                    fontSize: "0.7rem",
                                    letterSpacing: 1,
                                    border: statusChipStyles.border,
                                    background: statusChipStyles.background,
                                    color: statusChipStyles.color,
                                }}
                            >
                                {statusChipStyles.label}
                            </Box>
                        </Stack>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                                textAlign: "center",
                                mt: 3,
                                minHeight: 48,
                                maxWidth: 260,
                            }}
                        >
                            {assistantStateText}
                        </Typography>

                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "center",
                                gap: 0.75,
                                height: 46,
                                mt: 1.5,
                            }}
                        >
                            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((delay) => (
                                <WaveBar key={delay} delay={delay} />
                            ))}
                        </Box>

                        <Box
                            sx={{
                                m: 4,
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                            }}
                        >
                            {canStartCall && callStatus === "ended" && (
                                <Stack
                                    direction={{ xs: "column", sm: "row" }}
                                    spacing={1.2}
                                    sx={{
                                        width: "100%",
                                        justifyContent: "center",
                                        alignItems: "center",
                                        mt: 4,
                                        flexWrap: "wrap",
                                        gap: 3,
                                    }}
                                >
                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? (
                                                <MUILoadingIcon />
                                            ) : (
                                                <DescriptionIcon fontSize="small" />
                                            )
                                        }
                                        onClick={() => getConvData()}
                                        sx={{
                                            background: "transparent",
                                            borderColor: "rgba(148,163,184,0.4)",
                                            border: "none",
                                            borderBottom: 2,
                                            textTransform: "none",
                                            px: 2.6,
                                            "&:hover": {
                                                borderColor: "rgba(248,250,252,0.95)",
                                                background: "rgba(37,99,235,0.2)",
                                            },
                                        }}
                                    >
                                        Transcript
                                    </MUIButton>

                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? (
                                                <MUILoadingIcon />
                                            ) : (
                                                <RecordVoiceOverIcon fontSize="small" />
                                            )
                                        }
                                        onClick={() => getConvData("Audio")}
                                        sx={{
                                            background: "transparent",
                                            borderColor: "rgba(148,163,184,0.4)",
                                            border: "none",
                                            borderBottom: 2,
                                            textTransform: "none",
                                            px: 2.6,
                                            "&:hover": {
                                                borderColor: "rgba(248,250,252,0.95)",
                                                background: "rgba(22,163,74,0.2)",
                                            },
                                        }}
                                    >
                                        Audio
                                    </MUIButton>

                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? (
                                                <MUILoadingIcon />
                                            ) : (
                                                <DownloadIcon fontSize="small" />
                                            )
                                        }
                                        onClick={() => downloadTracker()}
                                        sx={{
                                            background: "transparent",
                                            borderColor: "rgba(148,163,184,0.4)",
                                            border: "none",
                                            borderBottom: 2,
                                            textTransform: "none",
                                            px: 2.8,
                                            "&:hover": {
                                                borderColor: "rgba(248,250,252,0.95)",
                                                background: "rgba(79,70,229,0.22)",
                                            },
                                        }}
                                    >
                                        Download Tracker
                                    </MUIButton>
                                </Stack>
                            )}
                        </Box>
                    </>
                )}

                {/* bottom controls */}
                <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="center"
                    spacing={2.5}
                    sx={{ mt: 2.5 }}
                >
                    {callStatus === "in-call" && (
                        <>
                            <IconButton
                                sx={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: "50%",
                                    background: gState.aiCallDemoMuted
                                        ? alpha(theme.palette.grey[700], 0.9)
                                        : `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                                    color: "common.white",
                                    boxShadow: `0 14px 36px ${alpha(
                                        theme.palette.common.black,
                                        0.2
                                    )}`,
                                    transform: "translateY(0)",
                                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
                                    "&:hover": {
                                        transform: "translateY(-2px)",
                                        boxShadow: `0 18px 40px ${alpha(
                                            theme.palette.common.black,
                                            0.26
                                        )}`,
                                    },
                                }}
                                onClick={() => {
                                    setAiCallDemoMuted((m) => !m);
                                    onToggleMute?.(!gState.aiCallDemoMuted);
                                }}
                            >
                                {gState.aiCallDemoMuted ? <MicOff /> : <Mic />}
                            </IconButton>
                            <IconButton
                                sx={{
                                    width: 56,
                                    height: 56,
                                    borderRadius: "50%",
                                    background: `linear-gradient(135deg, ${theme.palette.error.main}, ${theme.palette.error.light})`,
                                    color: "common.white",
                                    boxShadow: `0 14px 36px ${alpha(
                                        theme.palette.error.main,
                                        0.45
                                    )}`,
                                    transform: "translateY(0)",
                                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
                                    "&:hover": {
                                        transform: "translateY(-2px)",
                                        boxShadow: `0 18px 44px ${alpha(
                                            theme.palette.error.main,
                                            0.6
                                        )}`,
                                    },
                                }}
                                onClick={() => {
                                    onEnd?.();
                                    setAiCallDemoSeconds(0);
                                }}
                            >
                                <CallEnd />
                            </IconButton>
                        </>
                    )}

                    {callStatus === "connecting" && <CircularProgress size={36} color="inherit" />}

                    {(callStatus !== "in-call" && callStatus !== "connecting" && callBtnState !== 3) && (
                        <>
                            <IconButton
                                disabled={!canStartCall}
                                onClick={() => {
                                    if (canStartCall) {
                                        if ([1, 2].includes(callBtnState)) {
                                            document
                                                ?.getElementById?.("id_demo_form_submit_btn")
                                                ?.click?.();
                                        } else if ([0].includes(callBtnState)) {
                                            setCallBtnState((prev) => prev + 1);
                                        }
                                    }
                                }}
                                sx={{
                                    width: 68,
                                    height: 68,
                                    borderRadius: "50%",
                                    background: `radial-gradient(circle at 30% 0%, ${theme.palette.primary.light}, ${theme.palette.primary.dark})`,
                                    boxShadow: `0 20px 48px ${alpha(
                                        theme.palette.common.black,
                                        0.24
                                    )}`,
                                    color: "common.white",
                                    transform: "translateY(0)",
                                    transition: "transform 0.18s ease, box-shadow 0.18s ease",
                                    "&.Mui-disabled": {
                                        opacity: 0.35,
                                        boxShadow: "none",
                                    },
                                    "&:not(.Mui-disabled):hover": {
                                        transform: "translateY(-3px)",
                                        boxShadow: `0 24px 60px ${alpha(
                                            theme.palette.common.black,
                                            0.3
                                        )}`,
                                    },
                                }}
                            >
                                <Call />
                            </IconButton>
                        </>
                    )}
                </Stack>
            </Box>
            <style>{`
                        @keyframes wave {
                            0%, 100% {
                                transform: scaleY(0.25);
                                opacity: 0.5;
                            }
                            50% {
                                transform: scaleY(1);
                                opacity: 1;
                            }
                        }

                        @keyframes pulseGlow {
                            0% {
                                transform: scale(1);
                                box-shadow: 0 0 0 0 rgba(56,189,248,0.5);
                            }
                            70% {
                                transform: scale(1.08);
                                box-shadow: 0 0 0 16px rgba(56,189,248,0);
                            }
                            100% {
                                transform: scale(1);
                                box-shadow: 0 0 0 0 rgba(56,189,248,0);
                            }
                        }

                        .transcript-scroll::-webkit-scrollbar {
                            width: 6px;
                        }
                        .transcript-scroll::-webkit-scrollbar-track {
                            background: rgba(15,23,42,0.95);
                        }
                        .transcript-scroll::-webkit-scrollbar-thumb {
                            background: rgba(51,65,85,0.95);
                            border-radius: 999px;
                        }
                    `}</style>

            <MUIModal open={currConv} onClose={onModalClose}>
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}
                >
                    <Typography variant="h6">
                        Conversation&apos;s{" "}
                        {currConv?.modalFor === "Transcript"
                            ? "Transcript"
                            : "Audio Recording"}
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={onModalClose}
                        title="Close"
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
                <Divider sx={{ my: 2 }} />
                <Container
                    className="transcript-scroll"
                    sx={{
                        maxHeight: "75vh",
                        overflow: "auto",
                        pb: 1,
                    }}
                >
                    {currConv?.modalFor ===
                        "Transcript" &&
                        Array.isArray(currConv?.content) ? (
                        currConv?.content?.map?.(
                            (message, index) => {
                                const isCandidate = [
                                    "user",
                                    "candidate",
                                    "human",
                                ].includes(
                                    (message.role || "")
                                        .toLowerCase()
                                );
                                return (
                                    <Box
                                        key={index}
                                        sx={{
                                            display: "flex",
                                            flexDirection:
                                                isCandidate
                                                    ? "row-reverse"
                                                    : "row",
                                            mb: 2,
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                display: "flex",
                                                flexDirection:
                                                    "column",
                                                alignItems:
                                                    isCandidate
                                                        ? "flex-end"
                                                        : "flex-start",
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    px: 2,
                                                    py: 1.2,
                                                    borderRadius: 3,
                                                    maxWidth: {
                                                        xs: "85vw",
                                                        sm: "45vw",
                                                        md: "33vw",
                                                        lg: "26vw",
                                                    },
                                                    // color:
                                                    //     "text.primary",
                                                    fontSize:
                                                        "1rem",
                                                    wordBreak:
                                                        "break-word",
                                                    border:
                                                        "1px solid #e0e0e0",
                                                    boxShadow:
                                                        2,
                                                    // bgcolor:
                                                    //     isCandidate
                                                    //         ? "rgba(219,234,254,0.9)"
                                                    //         : "rgba(248,250,252,0.96)",
                                                }}
                                            >
                                                {(() => {
                                                    try {
                                                        return message
                                                            .content[0].text;
                                                    } catch {
                                                        return `${JSON.stringify(message.content)}`
                                                    }
                                                })()}

                                            </Box>
                                            <Typography
                                                sx={{
                                                    fontSize:
                                                        "0.8rem",
                                                    // color: "#888",
                                                    mr: isCandidate
                                                        ? 0.5
                                                        : 0,
                                                    ml: isCandidate
                                                        ? 0
                                                        : 0.5,
                                                    mt: 0.3,
                                                    textAlign:
                                                        isCandidate
                                                            ? "right"
                                                            : "left",
                                                }}
                                            >
                                                {formatClockTime(
                                                    message.time
                                                )}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            }
                        )
                    ) : (
                        <>
                            {currConv?.content ? (
                                <audio
                                    controls
                                    controlsList="nodownload"
                                    style={{ width: "100%" }}
                                >
                                    <source
                                        src={currConv?.content}
                                        type="audio/mpeg"
                                    />
                                    Your browser does not support the audio element.
                                </audio>
                            ) : (
                                <Typography variant="caption">
                                    The audio will be available only after the call has ended...
                                </Typography>
                            )}
                        </>
                    )}
                </Container>
            </MUIModal>
        </>
    );
}
