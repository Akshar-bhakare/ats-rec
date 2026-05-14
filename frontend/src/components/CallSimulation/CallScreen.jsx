import React, { useState, useEffect, useCallback } from "react";
import { Box, Typography, IconButton, Paper, Divider, Container, Tabs, Tab } from "@mui/material";
import { Mic, MicOff, CallEnd, Call, SupportAgentRounded, BorderBottom } from "@mui/icons-material";
import MUIInput from "../MUI/commonUI/MUIInput";
import { fetchData } from "../../AppUtils/dataAPI";
import { useCallSimulationContextState } from "../../contexts/CallSimulationContext";
import { useUiContextState } from "../../contexts/UiContext";
import MUIButton from "../MUI/commonUI/MUIButton";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import MUIModal from "../MUI/commonUI/MUIModal";
import MUILoadingIcon from "../MUI/commonUI/MUILoadingIcon";

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

export default function CallScreen({
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
    callMode: controlledCallMode,
    onCallModeChange,
}) {
    const isProduction = (window?.location?.origin
        ?.toLowerCase?.()
        ?.includes?.("aiselekt.com") || window?.location?.origin
            ?.toLowerCase?.()
            ?.includes?.("hirexit.ai"));
    const [gState, setGState] = useCallSimulationContextState();
    const [, setUiState] = useUiContextState();
    const setAiCallDemoSeconds = (val) => setGState(typeof val === "function" ? (prev) => ({ aiCallDemoSeconds: val?.(prev?.aiCallDemoSeconds || 0) }) : { aiCallDemoSeconds: val });
    const setAiCallDemoMuted = (val) => setGState({ aiCallDemoMuted: val });

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
    const [internalCallMode, setInternalCallMode] = useState("normal");
    const isCallModeControlled = typeof controlledCallMode === "string";
    const callMode = isCallModeControlled ? controlledCallMode : internalCallMode;
    const isCallModeLocked = ["connecting", "in-call"].includes(callStatus);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    };

    const WaveBar = ({ delay }) => (
        <Box
            sx={{
                width: 5,
                height: 26,
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
                        ? (list[0].messages || []).filter(
                            (message) => message.role !== "system"
                        )
                        : list[0].audio_url;
                setCurrConv({ modalFor, content: finalData });
            } finally {
                setUiState({ loadingMsg: null });
            }
        }
    }, [callUUID, candidateId, currConv, jobId, setUiState]);

    const downloadTracker = useCallback(async () => {
        if (!candidateId || !jobId) return;
        const safeTitle =
            opts.find((val) => val.value === jobId)?.label?.trim?.() || jobId;
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

    const onCallModeTabChange = (_, nextMode) => {
        if (!nextMode || isCallModeLocked || nextMode === callMode) return;
        if (!isCallModeControlled) {
            setInternalCallMode(nextMode);
        }
        onCallModeChange?.(nextMode);
    };

    useEffect(() => {
        let timer;
        if (callStatus === "in-call") {
            timer = setInterval(
                () => setAiCallDemoSeconds((s) => s + 1),
                1000
            );
        } else {
            gState?.aiCallDemoSeconds !== 0 && setAiCallDemoSeconds(0);
            (gState?.aiCallDemoSeconds === 0 ||
                callStatus === "AI Call") &&
                setAiCallDemoMuted(false);

            if (callStatus === "ended") {
                setUpdateInProgress(true);
                setTimeout(() => {
                    setUpdateInProgress(false);
                }, 5_000);
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
                        "/api/jobs/?fields=_id,title,internalTitle&ids=" +
                        (candRes?.jobs || []).join(",")
                    )
                        .then((res) => {
                            let resOpts = res?.map?.((ele) => ({
                                label: `${ele.title}`,
                                value: `${ele._id}`,
                            }));

                            if (
                                (resOpts || [])?.length > 0 &&
                                !(resOpts || [])
                                    .map((ele) => ele?.value)
                                    .includes(jobId)
                            ) {
                                setJobId(resOpts?.[0]?.value);
                            }

                            setOpts(resOpts);
                        })
                        .catch((err) => {
                            console.error(
                                "[Call Simulation] Error in getting jobs: ",
                                err
                            );
                        })
                        .finally(() => {
                            setUiState({
                                loadingMsg: null,
                            });
                        });
                })
                .catch((err) =>
                    console.error("[Call Simulation] ", err)
                )
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



    return (
        opts && (
            <>
                <Box
                    component={Paper}
                    elevation={0}
                    sx={{
                        position: "relative",
                        overflow: "hidden",
                        minHeight: "60vh",
                        maxWidth: "960px",
                        width: "100%",
                        p: { xs: 3, md: 4 },
                        borderRadius: 4,
                        mx: "auto",
                        bgcolor: "rgba(5,10,25,0.98)",
                        color: "common.white",
                        boxShadow:
                            "0 34px 100px rgba(15, 23, 42, 0.9)",
                        // border: "1px solid rgba(125, 140, 180, 0.4)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backdropFilter: "blur(20px)",
                        "&::before": {
                            content: '""',
                            position: "absolute",
                            inset: 0,
                            background:
                                "radial-gradient(circle at 0% 0%, rgba(96,165,250,0.25), transparent 55%), radial-gradient(circle at 100% 100%, rgba(45,212,191,0.35), transparent 55%)",
                            opacity: 1,
                            pointerEvents: "none",
                        },
                    }}
                >
                    {/* Header */}
                    <Box
                        sx={{
                            position: "relative",
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: { xs: "flex-start", md: "center" },
                            mb: { xs: 3, md: 4 },
                            zIndex: 1,
                            gap: 2,
                        }}
                    >
                        <Box>
                            <Typography
                                variant="overline"
                                sx={{
                                    color: "rgba(148,163,184,0.9)",
                                    letterSpacing: 1,
                                }}
                            >
                                A VOICE ASSISTANT
                            </Typography>
                            <Typography
                                variant="h5"
                                sx={{ fontWeight: 600 }}
                            >
                                {candidateFirstName || "Candidate"}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: "rgba(191,219,254,0.85)" }}
                            >
                                {opts.find(
                                    (ele) => ele.value === `${jobId}`
                                )?.label || "Job role"}
                            </Typography>
                        </Box>
                        <Box
                            sx={{
                                position: "relative",
                                zIndex: 1,
                                display: "flex",
                                justifyContent: "center",
                                mb: { xs: 2.5, md: 3 },
                            }}
                        >
                            <Tabs
                                value={callMode}
                                onChange={onCallModeTabChange}
                                aria-label="Call mode switch"
                                sx={{
                                    minHeight: 46,
                                    p: 0.35,
                                    borderRadius: 999,
                                    bgcolor: "rgba(15,23,42,0.88)",
                                    border: "1px solid rgba(71,85,105,0.7)",
                                    "& .MuiTabs-indicator": {
                                        display: "none",
                                    },
                                }}
                            >
                                <Tab
                                    disableRipple
                                    disabled={isCallModeLocked}
                                    value="normal"
                                    label="Normal"
                                    sx={{
                                        minHeight: 38,
                                        minWidth: { xs: 120, sm: 150 },
                                        px: 2.5,
                                        borderRadius: 999,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        letterSpacing: 0.2,
                                        color: "rgba(203,213,225,0.9)",
                                        transition: "all 0.2s ease",
                                        "&.Mui-selected": {
                                            color: "#ffffff",
                                            bgcolor: "rgba(59,130,246,0.45)",
                                            boxShadow: "inset 0 0 0 1px rgba(147,197,253,0.6)",
                                        },
                                    }}
                                />
                                <Tab
                                    disableRipple
                                    disabled={isCallModeLocked}
                                    value="Multilingual"
                                    label="Multilingual"
                                    sx={{
                                        minHeight: 38,
                                        minWidth: { xs: 120, sm: 150 },
                                        px: 2.5,
                                        borderRadius: 999,
                                        textTransform: "none",
                                        fontWeight: 600,
                                        letterSpacing: 0.2,
                                        color: "rgba(203,213,225,0.9)",
                                        transition: "all 0.2s ease",
                                        "&.Mui-selected": {
                                            color: "#ffffff",
                                            bgcolor: "rgba(16,185,129,0.38)",
                                            boxShadow: "inset 0 0 0 1px rgba(110,231,183,0.55)",
                                        },
                                    }}
                                />
                            </Tabs>
                        </Box>
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: 0.75,
                            }}
                        >
                            <Box
                                sx={{
                                    px: 1.8,
                                    py: 0.45,
                                    borderRadius: 999,
                                    fontSize: "0.78rem",
                                    letterSpacing: 0.4,
                                    textTransform: "uppercase",
                                    bgcolor:
                                        callStatus === "in-call"
                                            ? "rgba(34,197,94,0.18)"
                                            : callStatus === "connecting"
                                                ? "rgba(234,179,8,0.18)"
                                                : callStatus === "ended"
                                                    ? "rgba(248,113,113,0.18)"
                                                    : "rgba(59,130,246,0.18)",
                                    border:
                                        callStatus === "in-call"
                                            ? "1px solid rgba(74,222,128,0.7)"
                                            : callStatus === "connecting"
                                                ? "1px solid rgba(250,204,21,0.7)"
                                                : callStatus === "ended"
                                                    ? "1px solid rgba(248,113,113,0.7)"
                                                    : "1px solid rgba(129,140,248,0.75)",
                                }}
                            >
                                {callStatus === "AI Call" && "AI CALL DEMO"}
                                {callStatus === "connecting" && "CONNECTING"}
                                {callStatus === "in-call" && "LIVE CALL"}
                                {callStatus === "ended" && "CALL ENDED"}
                            </Box>

                            {callStatus === "in-call" ? (
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color:
                                            "rgba(226,232,240,0.9)",
                                        fontVariantNumeric:
                                            "tabular-nums",
                                    }}
                                >
                                    {formatTime(
                                        gState.aiCallDemoSeconds || 0
                                    )}
                                </Typography>
                            ) : <p></p>}
                        </Box>
                    </Box>

                    {/* Center section: Avatar + Waves + State */}
                    <Box
                        sx={{
                            position: "relative",
                            zIndex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 2.5,
                        }}
                    >
                        {/* Circular assistant avatar */}
                        <Box
                            sx={{
                                position: "relative",
                                width: 210,
                                height: 210,
                                borderRadius: "50%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                mb: 0.5,
                            }}
                        >
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 0,
                                    borderRadius: "inherit",
                                    background:
                                        "conic-gradient(from 180deg, rgba(56,189,248,0.15), rgba(34,197,94,0.4), rgba(56,189,248,0.15))",
                                    opacity: speaking || playing ? 1 : 0.65,
                                    filter: "blur(16px)",
                                }}
                            />
                            <Box
                                sx={{
                                    position: "absolute",
                                    inset: 16,
                                    borderRadius: "inherit",
                                    // border: "1px solid rgba(148,163,184,0.7)",
                                    background:
                                        "radial-gradient(circle at 30% 0%, rgba(96,165,250,0.3), transparent 55%)",
                                    opacity: 0.6,
                                }}
                            />
                            <Paper
                                elevation={12}
                                sx={{
                                    position: "relative",
                                    width: 140,
                                    height: 140,
                                    borderRadius: "50%",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    bgcolor: "rgba(15,23,42,0.96)",
                                    boxShadow:
                                        "0 28px 60px rgba(15,23,42,0.95)",
                                    overflow: "hidden",
                                }}
                            >
                                <Box
                                    sx={{
                                        position: "absolute",
                                        inset: -40,
                                        borderRadius: "inherit",
                                        background:
                                            "radial-gradient(circle at 20% 0%, rgba(59,130,246,0.45), transparent 55%)",
                                        opacity: speaking || playing ? 1 : 0.8,
                                    }}
                                />
                                <Box
                                    sx={{
                                        width: 86,
                                        height: 86,
                                        borderRadius: "50%",
                                        // border: "1px solid rgba(148,163,184,0.7)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        bgcolor: "rgba(15,23,42,0.9)",
                                        backdropFilter: "blur(14px)",
                                        position: "relative",
                                        zIndex: 1,
                                        animation:
                                            speaking || playing
                                                ? "pulseGlow 2s ease-out infinite"
                                                : "none",
                                    }}
                                >
                                    {gState.aiCallDemoMuted ? (
                                        <MicOff
                                            sx={{
                                                fontSize: 40,
                                                color: "#fecaca",
                                            }}
                                        />
                                    ) : (
                                        <SupportAgentRounded
                                            sx={{
                                                fontSize: 44,
                                                color: "#e0f2fe",
                                            }}
                                        />
                                    )}
                                </Box>
                            </Paper>
                        </Box>

                        {/* Animated EQ wave */}
                        <Box
                            display="flex"
                            gap={0.6}
                            sx={{
                                px: 1.6,
                                py: 0.8,
                                borderRadius: 999,
                                bgcolor: "rgba(15,23,42,0.96)",
                                // border: "1px solid rgba(51,65,85,0.95)",
                                boxShadow: "0 14px 36px rgba(15,23,42,0.9)",
                            }}
                        >
                            <WaveBar delay={0} />
                            <WaveBar delay={0.15} />
                            <WaveBar delay={0.3} />
                            <WaveBar delay={0.45} />
                            <WaveBar delay={0.6} />
                            <WaveBar delay={0.75} />
                        </Box>

                        {/* Assistant state text */}
                        <Typography
                            variant="body2"
                            sx={{
                                color: "rgba(191,219,254,0.9)",
                                mt: 0.8,
                            }}
                        >
                            {getAssistantStateText()}
                        </Typography>
                    </Box>

                    {/* Bottom panel: inputs + controls + actions */}
                    <Box
                        sx={{
                            position: "relative",
                            width: "100%",
                            mt: { xs: 3, md: 4 },
                            zIndex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 2.5,
                        }}
                    >
                        {/* Setup form + Start button */}
                        {["AI Call", "ended"].includes(callStatus) && (
                            <Box
                                sx={{
                                    display: "flex",
                                    flexDirection: {
                                        xs: "column",
                                        md: "row",
                                    },
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 2.5,
                                    p: 2,
                                    borderRadius: 3,
                                    // bgcolor: "rgba(15,23,42,0.96)",
                                    // border: "1px solid rgba(51,65,85,0.95)",
                                }}
                            >
                                <MUIInput
                                    AutocompleteProps={{
                                        size: "small",
                                        options: opts,
                                        value:
                                            opts.find(
                                                (ele) =>
                                                    ele.value ===
                                                    `${jobId}`
                                            ) || opts[0],
                                        onChange: (_, val) =>
                                            setJobId?.(val.value),
                                    }}
                                    AutocompleteInputProps={{
                                        label: "Select Job",
                                        required: true,
                                    }}
                                    sx={{
                                        minWidth: {
                                            xs: "90%",
                                            md: "10vw",
                                        },
                                        "& .MuiInputLabel-root": {
                                            color:
                                                "rgba(226,232,240,0.9)",
                                        },
                                        "& .MuiInputLabel-root.Mui-focused": {
                                            color: "#ffffff",
                                        },
                                        "& .MuiOutlinedInput-input": {
                                            color: "#ffffff",
                                        },
                                        "& .MuiOutlinedInput-notchedOutline": {
                                            borderColor:
                                                "rgba(148,163,184,0.7)",
                                        },
                                        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                                            borderColor:
                                                "rgba(248,250,252,0.9)",
                                        },
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                "rgba(129,140,248,0.9)",
                                        },
                                    }}
                                />

                                <MUIInput
                                    AutocompleteProps={{
                                        size: "small",
                                    }}
                                    AutocompleteInputProps={{
                                        label: "Candidate Name",
                                        value: candidateFirstName,
                                        onChange: (ev) =>
                                            setCandidateFirstName?.(
                                                ev?.target?.value || ""
                                            ),
                                        required: true,
                                    }}
                                    sx={{
                                        minWidth: {
                                            xs: "90%",
                                            md: "10vw",
                                        },
                                        "& .MuiInputLabel-root": {
                                            color:
                                                "rgba(226,232,240,0.9)",
                                        },
                                        "& .MuiInputLabel-root.Mui-focused": {
                                            color: "#ffffff",
                                        },
                                        "& .MuiOutlinedInput-input": {
                                            color: "#ffffff",
                                        },
                                        "& .MuiOutlinedInput-notchedOutline": {
                                            borderColor:
                                                "rgba(148,163,184,0.7)",
                                        },
                                        "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
                                            borderColor:
                                                "rgba(248,250,252,0.9)",
                                        },
                                        "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline":
                                        {
                                            borderColor:
                                                "rgba(129,140,248,0.9)",
                                        },
                                    }}
                                />

                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <Box
                                        sx={{
                                            textAlign: "center",
                                        }}
                                    >
                                        <IconButton
                                            // size="medium"
                                            sx={{
                                                bgcolor:
                                                    "transparent",
                                                borderRadius: "999px",
                                                p: 0,
                                                mx: 2,
                                            }}
                                            onClick={() =>
                                                triggerCall?.(undefined, callMode)
                                            }
                                        >
                                            <Box
                                                sx={{
                                                    // width: 68,
                                                    // height: 68,
                                                    p: 3,
                                                    borderRadius: "50%",
                                                    display: "flex",
                                                    alignItems: "center",
                                                    justifyContent: "center",
                                                    background:
                                                        "radial-gradient(circle at 30% 0%, #4ade80, #16a34a)",
                                                    boxShadow:
                                                        "0 18px 40px rgba(34,197,94,0.7)",
                                                }}
                                            >
                                                <Call
                                                    sx={{
                                                        color: "white",
                                                    }}
                                                />
                                            </Box>
                                        </IconButton>
                                        {/* <Typography
                                            variant="caption"
                                            sx={{
                                                color:
                                                    "rgba(209,213,219,0.95)",
                                            }}
                                        >
                                            Start AI Call
                                        </Typography> */}
                                    </Box>
                                </Box>
                            </Box>
                        )}

                        {/* Live controls */}
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                gap: 4,
                            }}
                        >
                            {callStatus === "in-call" && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <IconButton
                                        size="large"
                                        sx={{
                                            // width: 60,
                                            // height: 60,
                                            p: 3,
                                            borderRadius: "50%",
                                            bgcolor:
                                                gState.aiCallDemoMuted
                                                    ? "rgba(75,85,99,1)"
                                                    : "rgba(37,99,235,1)",
                                            color: "white",
                                            boxShadow:
                                                "0 15px 35px rgba(30,64,175,0.75)",
                                        }}
                                        onClick={() => {
                                            setAiCallDemoMuted((m) => !m);
                                            onToggleMute?.(
                                                !gState.aiCallDemoMuted
                                            );
                                        }}
                                    >
                                        {gState.aiCallDemoMuted ? (
                                            <MicOff />
                                        ) : (
                                            <Mic />
                                        )}
                                    </IconButton>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color:
                                                "rgba(209,213,219,0.95)",
                                        }}
                                    >
                                        {gState.aiCallDemoMuted
                                            ? "Unmute"
                                            : "Mute"}
                                    </Typography>
                                </Box>
                            )}

                            {!["AI Call", "ended"].includes(callStatus) && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 1,
                                    }}
                                >
                                    <IconButton
                                        size="large"
                                        sx={{
                                            // width: 60,
                                            // height: 60,
                                            p: 3,
                                            borderRadius: "50%",
                                            bgcolor: "error.main",
                                            color: "white",
                                            boxShadow:
                                                "0 18px 40px rgba(248,113,113,0.8)",
                                        }}
                                        onClick={() => {
                                            onEnd();
                                            setAiCallDemoSeconds(0);
                                        }}
                                    >
                                        <CallEnd />
                                    </IconButton>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            color:
                                                "rgba(248,250,252,0.92)",
                                        }}
                                    >
                                        End Call
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        {/* Bottom actions */}
                        {["ended"].includes(callStatus) && (
                            <>
                                <Divider
                                    sx={{
                                        my: 2,
                                        borderColor:
                                            "rgba(51,65,85,0.9)",
                                    }}
                                />
                                <Box
                                    sx={{
                                        width: "100%",
                                        display: "flex",
                                        justifyContent: "space-evenly",
                                        flexWrap: "wrap",
                                        gap: 1.5,
                                    }}
                                >
                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? <MUILoadingIcon /> : <DescriptionIcon fontSize="small" />
                                        }
                                        onClick={() => getConvData()}
                                        sx={{
                                            background: "transparent",
                                            borderColor:
                                                "rgba(148,163,184,0.7)",
                                            color:
                                                "rgba(226,232,240,0.95)",
                                            textTransform: "none",
                                            px: 2.4,
                                            border: "none",
                                            borderBottom: 0.7,
                                            "&:hover": {
                                                borderColor:
                                                    "rgba(248,250,252,0.95)",
                                                background:
                                                    "rgba(37,99,235,0.35)",
                                            },
                                        }}
                                    >
                                        Transcript
                                    </MUIButton>

                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? <MUILoadingIcon /> : <RecordVoiceOverIcon fontSize="small" />
                                        }
                                        onClick={() =>
                                            getConvData("Audio")
                                        }
                                        sx={{
                                            background: "transparent",
                                            borderColor:
                                                "rgba(148,163,184,0.7)",
                                            color:
                                                "rgba(226,232,240,0.95)",
                                            textTransform: "none",
                                            px: 2.4,
                                            border: "none",
                                            borderBottom: 0.7,
                                            "&:hover": {
                                                borderColor:
                                                    "rgba(248,250,252,0.95)",
                                                background:
                                                    "rgba(22,163,74,0.35)",
                                            },
                                        }}
                                    >
                                        Audio
                                    </MUIButton>

                                    <MUIButton
                                        size="small"
                                        variant="outlined"
                                        startIcon={
                                            updateInProgress ? <MUILoadingIcon /> : <DownloadIcon fontSize="small" />
                                        }
                                        onClick={() => downloadTracker()}
                                        sx={{
                                            background: "transparent",
                                            borderColor:
                                                "rgba(148,163,184,0.7)",
                                            color:
                                                "rgba(226,232,240,0.95)",
                                            textTransform: "none",
                                            px: 2.6,
                                            border: "none",
                                            borderBottom: 0.7,
                                            "&:hover": {
                                                borderColor:
                                                    "rgba(248,250,252,0.95)",
                                                background:
                                                    "rgba(79,70,229,0.35)",
                                            },
                                        }}
                                    >
                                        Download Tracker
                                    </MUIButton>
                                </Box>
                            </>
                        )}
                    </Box>

                    {/* Keyframe styles */}
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
                                box-shadow: 0 0 0 0 rgba(56,189,248,0.6);
                            }
                            70% {
                                transform: scale(1.06);
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
                </Box>

                {/* Modal for transcript / audio */}
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
        )
    );
}
